import { supabase } from '../../lib/supabase.js';

let currentGameId = null;
let currentGameSlug = null;
let currentUser = null;

export default async function initModule(rom, params) {
  console.log('💬 Game Discuss module initialized for:', params.slug);
  
  currentGameSlug = params.slug;
  
  // 1. Get User
  const { data: { user } } = await supabase.auth.getUser();
  currentUser = user;

  const container = document.getElementById('app-content');
  if (!container) return;

  // 2. LOAD THE HTML FILE MANUALLY
  // Since the router bypassed loadModule(), we must fetch the HTML ourselves
  try {
    const response = await fetch('./modules/game-discuss/game-discuss.html');
    if (response.ok) {
      const html = await response.text();
      container.innerHTML = html;
    } else {
      container.innerHTML = '<div class="text-red-400 text-center mt-10">Error loading discussion interface.</div>';
      return;
    }
  } catch (e) {
    console.error('Failed to load HTML:', e);
    container.innerHTML = '<div class="text-red-400 text-center mt-10">Failed to load template.</div>';
    return;
  }

  // 3. Fetch Game Details to get ID and Title
  const { data: game, error } = await supabase
    .from('games')
    .select('id, title')
    .eq('slug', currentGameSlug)
    .single();

  if (error || !game) {
    container.innerHTML = '<div class="text-center text-red-400 mt-10">Game not found.</div>';
    return;
  }

  currentGameId = game.id;
  document.title = `${game.title} - Community | ROM`;
  
  // 4. Now that HTML is in DOM, we can safely access elements
  const titleEl = document.getElementById('discuss-game-title');
  if(titleEl) titleEl.textContent = game.title;
  
  loadDiscussions('all');
  attachListeners();
}

function attachListeners() {
  // Category Tabs
  document.querySelectorAll('.cat-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.cat-tab').forEach(b => {
        b.classList.remove('bg-purple-600', 'text-white');
        b.classList.add('bg-gray-800', 'text-gray-300');
      });
      e.target.classList.remove('bg-gray-800', 'text-gray-300');
      e.target.classList.add('bg-purple-600', 'text-white');
      loadDiscussions(e.target.dataset.cat);
    });
  });

  // New Post Modal
  const modal = document.getElementById('new-post-modal');
  const btnNew = document.getElementById('btn-new-post');
  const btnCancel = document.getElementById('cancel-post');
  const form = document.getElementById('new-post-form');

  if (btnNew) btnNew.addEventListener('click', () => {
    if (!currentUser) return alert('Please log in to post.');
    if(modal) modal.classList.remove('hidden');
  });

  if (btnCancel) btnCancel.addEventListener('click', () => {
    if(modal) modal.classList.add('hidden');
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('post-title').value;
      const category = document.getElementById('post-category').value;
      const content = document.getElementById('post-content').value;

      // Fallback username if profile not fetched
      const username = currentUser.user_metadata?.username || currentUser.email.split('@')[0];

      const { error } = await supabase.from('game_discussions').insert([{
        game_id: currentGameId,
        user_id: currentUser.id,
        username: username, 
        avatar_url: null, // You can fetch this from profiles if needed
        category,
        title,
        content
      }]);

      if (error) {
        alert('Error posting: ' + error.message);
      } else {
        if(modal) modal.classList.add('hidden');
        form.reset();
        loadDiscussions('all');
      }
    });
  }
}

async function loadDiscussions(category) {
  const listEl = document.getElementById('discussions-list');
  if (!listEl) return;

  let query = supabase.from('game_discussions').select('*').eq('game_id', currentGameId);
  
  if (category !== 'all') {
    query = query.eq('category', category);
  }

  const { data: posts, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading posts:', error);
    listEl.innerHTML = '<div class="text-red-400 text-center">Error loading posts.</div>';
    return;
  }

  if (!posts || posts.length === 0) {
    listEl.innerHTML = '<div class="text-gray-500 text-center py-10">No discussions yet. Be the first!</div>';
    return;
  }

  listEl.innerHTML = posts.map(post => {
    const catColors = {
      general: 'bg-gray-600',
      mods: 'bg-green-600',
      textures: 'bg-pink-600',
      lfg: 'bg-cyan-600',
      bugs: 'bg-red-600'
    };
    
    return `
      <div class="bg-gray-800/80 backdrop-blur border border-gray-700 rounded-xl p-5 hover:border-purple-500/50 transition shadow-lg">
        <div class="flex justify-between items-start mb-2">
          <span class="${catColors[post.category] || 'bg-gray-600'} text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
            ${post.category}
          </span>
          <span class="text-xs text-gray-500">${new Date(post.created_at).toLocaleDateString()}</span>
        </div>
        <h3 class="text-xl font-bold text-white mb-2">${escapeHtml(post.title)}</h3>
        <p class="text-gray-300 text-sm mb-4 whitespace-pre-wrap line-clamp-3">${escapeHtml(post.content)}</p>
        <div class="flex items-center justify-between border-t border-gray-700 pt-3">
          <div class="flex items-center gap-2">
            <img src="${post.avatar_url || 'https://ui-avatars.com/api/?name=' + post.username}" class="w-6 h-6 rounded-full">
            <span class="text-xs text-gray-400 font-bold">${escapeHtml(post.username)}</span>
          </div>
          <button class="text-xs text-purple-400 hover:text-purple-300 font-bold">Read More →</button>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
