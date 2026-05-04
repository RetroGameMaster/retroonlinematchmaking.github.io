// modules/articles/article.js
import { supabase } from '../../lib/supabase.js';
import { REACTIONS_CONFIG, getReactionVisual } from './reactions-config.js'; // Import your config from Step 3

export default async function initArticleModule(rom, params) {
  const container = document.getElementById('app-content');
  if (!container) return;

  const articleId = params.id || params.slug; // Support ID or Slug
  if (!articleId) {
    container.innerHTML = '<div class="text-center text-red-400">Article not found.</div>';
    return;
  }

  // Load HTML structure
  const response = await fetch('./modules/articles/article.html');
  container.innerHTML = await response.text();

  await loadArticle(articleId, rom);
  setupInteractions(articleId, rom);
}

async function loadArticle(id, rom) {
  try {
    // 1. Fetch Article Data
    const {  article, error } = await supabase
      .from('articles')
      .select(`
        *,
        profiles!articles_author_id_fkey (
          id, username, avatar_url, motto, xp_total, 
          gamercard_bg_type, gamercard_bg_value,
          rank:user_ranks (name, color),
          stats
        )
      `)
      .eq('id', id)
      .single();

    if (error || !article) throw new Error('Article not found');

    // Update Meta Tags
    document.title = `${article.title} | ROM Writers Guild`;

    // Render Header
    document.getElementById('article-title').textContent = article.title;
    document.getElementById('article-date').textContent = new Date(article.created_at).toLocaleDateString();
    
    const catBadge = document.getElementById('article-category-badge');
    catBadge.textContent = article.category_slug?.toUpperCase() || 'GENERAL';
    
    // Render Body (Sanitize if needed, but trusting DB content for now)
    document.getElementById('article-body').innerHTML = article.content_html;

    // Render Author Gamercard
    const authorSlot = document.getElementById('author-gamercard-slot');
    if (article.profiles) {
      authorSlot.innerHTML = createAuthorGamercard(article.profiles);
    }

    // Load Reactions
    await loadReactions(id, rom);

    // Load Comments
    await loadComments(id, rom);

    // Show Content
    document.getElementById('article-loading').classList.add('hidden');
    document.getElementById('article-content').classList.remove('hidden');

  } catch (err) {
    console.error(err);
    document.getElementById('article-loading').innerHTML = `<div class="text-red-400">Error: ${err.message}</div>`;
  }
}

function createAuthorGamercard(profile) {
  // Reuse your existing gamercard logic here or import it
  const username = profile.username || 'Anonymous';
  const avatar = profile.avatar_url || `https://ui-avatars.com/api/?name=${username}&background=06b6d4&color=fff`;
  const rank = profile.rank;
  const motto = profile.motto;
  
  // Check for Writer Badge (Logic: if they have published articles)
  const articlesCount = profile.stats?.articles_published || 0;
  const isWriter = articlesCount > 0;
  const writerBadge = isWriter ? `<span class="ml-2 text-[10px] bg-yellow-900 text-yellow-300 px-1.5 py-0.5 rounded border border-yellow-600">✒️ Writer</span>` : '';

  let bgStyle = `background-color: ${profile.gamercard_bg_value || '#1f2937'};`;
  if (profile.gamercard_bg_type === 'image') bgStyle = `background-image: url('${profile.gamercard_bg_value}'); background-size: cover;`;
  else if (profile.gamercard_bg_type === 'gradient') bgStyle = `background-image: ${profile.gamercard_bg_value};`;

  return `
    <div class="gamercard relative overflow-hidden rounded-lg border border-gray-600 shadow-md bg-gray-900 max-w-md">
      <div class="absolute inset-0 opacity-40" style="${bgStyle} filter: brightness(0.7);"></div>
      <div class="absolute inset-0 bg-gradient-to-r from-black/80 to-black/40"></div>
      <div class="relative z-10 p-3 flex items-center gap-3">
        <img src="${avatar}" class="w-12 h-12 rounded-full border-2 border-purple-500 object-cover">
        <div class="flex-1">
          <div class="flex items-center">
            <span class="text-sm font-bold text-white drop-shadow-md">${username}</span>
            ${writerBadge}
          </div>
          ${rank ? `<span class="text-[10px] text-purple-300 font-bold">${rank.name}</span>` : ''}
          ${motto ? `<p class="text-[10px] text-gray-300 italic truncate">"${motto}"</p>` : ''}
        </div>
      </div>
    </div>
  `;
}

async function loadReactions(articleId, rom) {
  const container = document.getElementById('reaction-buttons');
  const countsContainer = document.getElementById('reaction-counts');
  
  // 1. Fetch Counts
  const {  counts } = await supabase.rpc('get_reaction_counts', { post_id: articleId });
  // Note: You might need a simple SQL view or JS aggregation if RPC isn't set up yet. 
  // For now, we'll assume we fetch raw rows and aggregate in JS if RPC fails.
  
  // Fallback JS Aggregation if RPC missing:
  if (!counts) {
    const {  rows } = await supabase.from('article_reactions').select('reaction_key').eq('post_id', articleId);
    // Aggregate logic here...
  }

  // 2. Render Buttons
  container.innerHTML = Object.keys(REACTIONS_CONFIG).map(key => {
    const config = REACTIONS_CONFIG[key];
    return `
      <button 
        data-key="${key}" 
        class="reaction-btn px-3 py-1.5 rounded-full bg-gray-700 hover:bg-gray-600 border border-gray-600 transition transform hover:scale-110 flex items-center gap-1.5"
      >
        ${getReactionVisual(key)}
        <span class="text-xs font-bold text-gray-300">${config.label}</span>
      </button>
    `;
  }).join('');

  // 3. Add Click Listeners
  container.querySelectorAll('.reaction-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!rom.currentUser) return alert('Please log in to react!');
      await addReaction(articleId, rom.currentUser.id, btn.dataset.key);
    });
  });
}

async function addReaction(postId, userId, key) {
  // Upsert logic: If exists, remove (toggle). If not, insert.
  const {  existing } = await supabase
    .from('article_reactions')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .eq('reaction_key', key)
    .single();

  if (existing) {
    await supabase.from('article_reactions').delete().eq('id', existing.id);
  } else {
    // Remove other reactions by this user for this post (optional: limit 1 reaction per user)
    await supabase.from('article_reactions').delete().eq('post_id', postId).eq('user_id', userId);
    
    await supabase.from('article_reactions').insert({
      post_id: postId,
      user_id: userId,
      reaction_key: key
    });
  }
  
  // Refresh UI
  loadReactions(postId, { currentUser: { id: userId } }); // Re-fetch locally
}

async function loadComments(postId, rom) {
  const {  comments } = await supabase
    .from('article_comments')
    .select(`
      *,
      profiles!article_comments_author_id_fkey (username, avatar_url)
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  const list = document.getElementById('comments-list');
  if (!comments || comments.length === 0) {
    list.innerHTML = '<p class="text-gray-500 text-sm italic">No comments yet. Be the first!</p>';
    return;
  }

  list.innerHTML = comments.map(c => `
    <div class="bg-gray-900/50 p-3 rounded-lg border border-gray-700 flex gap-3">
      <img src="${c.profiles?.avatar_url || 'https://via.placeholder.com/32'}" class="w-8 h-8 rounded-full">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="text-sm font-bold text-cyan-400">${c.profiles?.username || 'Anonymous'}</span>
          <span class="text-xs text-gray-500">${new Date(c.created_at).toLocaleDateString()}</span>
        </div>
        <p class="text-sm text-gray-300">${c.content}</p>
      </div>
    </div>
  `).join('');
}

function setupInteractions(articleId, rom) {
  const btn = document.getElementById('btn-post-comment');
  const input = document.getElementById('comment-input');

  btn.addEventListener('click', async () => {
    const content = input.value.trim();
    if (!content) return;
    if (!rom.currentUser) return alert('Log in to comment');

    btn.disabled = true;
    btn.textContent = 'Posting...';

    const { error } = await supabase.from('article_comments').insert({
      post_id: articleId,
      author_id: rom.currentUser.id,
      content: content
    });

    if (error) {
      alert('Failed to post: ' + error.message);
    } else {
      input.value = '';
      loadComments(articleId, rom);
    }
    
    btn.disabled = false;
    btn.textContent = 'Post';
  });
}
