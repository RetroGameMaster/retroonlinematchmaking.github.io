import { supabase } from '../../lib/supabase.js';

let currentGameId = null;
let currentGameSlug = null;
let currentUser = null;
let currentUserId = null;
let isAdmin = false;

// Configuration for Reaction Types
const REACTION_TYPES = [
  { id: 'fire', icon: '🔥', label: 'Lit' },
  { id: 'trophy', icon: '🏆', label: 'GG' },
  { id: 'skull', icon: '💀', label: 'RIP' },
  { id: 'heart', icon: '❤️', label: 'Love' },
  { id: 'laugh', icon: '😂', label: 'LOL' },
  { id: 'thinking', icon: '🤔', label: 'Hmm' }
];

// Helper: Escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Helper: Render Gamercard HTML
function renderGamercard(profile, isChat = false) {
  const username = profile?.username || 'Unknown';
  const avatar = profile?.avatar_url || `https://ui-avatars.com/api/?name=${username}&background=06b6d4&color=fff`;
  const rank = profile?.rank;
  const motto = profile?.motto;
  const xp = profile?.xp_total || 0;
  
  const xpPercent = Math.min(100, (xp / 5000) * 100); 

  // --- UPDATED BACKGROUND LOGIC FOR VISIBILITY ---
  let bgStyle = '';
  if (profile?.gamercard_bg_type === 'image') {
    // Increased opacity to 0.6 so image is clearly visible
    bgStyle = `background-image: url('${profile.gamercard_bg_value}'); background-size: cover; background-position: center; opacity: 0.9;`;
  } else if (profile?.gamercard_bg_type === 'gradient') {
    // Increased opacity to 0.7 for gradients
    bgStyle = `background-image: ${profile.gamercard_bg_value}; opacity: 0.1;`;
  } else {
    // Solid color with higher opacity
    bgStyle = `background-color: ${profile?.gamercard_bg_value || '#1f2937'}; opacity: 0.9;`;
  }

  const rankBadge = rank ? 
    `<span class="gc-rank" style="background:${rank.color}20; color:${rank.color}; border:1px solid ${rank.color}">${escapeHtml(rank.name)}</span>` : 
    `<span class="gc-rank" style="background:#9ca3af20; color:#9ca3af">NPC</span>`;

  const mottoHtml = motto && !isChat ? `<span class="gc-motto">"${escapeHtml(motto)}"</span>` : '';

  return `
    <div class="gamercard ${isChat ? 'chat-gamercard' : ''} relative overflow-hidden border border-gray-600 shadow-xl">
      <!-- Background Layer (Now More Visible) -->
      <div class="gc-bg absolute inset-0 z-0" style="${bgStyle}"></div>
      
      <!-- Gradient Overlay (Lightened to let background show through) -->
      <!-- Changed from black/80 to black/50 to ensure background is seen -->
      <div class="absolute inset-0 z-0 bg-gradient-to-r from-black/70 via-black/50 to-black/70"></div>
      
      <!-- Content Layer (Higher Z-Index to stay on top) -->
      <div class="gc-content relative z-10">
        <img src="${avatar}" alt="${escapeHtml(username)}" class="gc-avatar">
        <div class="gc-info">
          <span class="gc-name text-shadow-md">${escapeHtml(username)}</span>
          ${rankBadge}
          ${mottoHtml}
          <div class="gc-xp-bar-container">
            <div class="gc-xp-fill" style="width: ${xpPercent}%"></div>
          </div>
          <span class="gc-xp-text">${xp} XP</span>
        </div>
      </div>
    </div>
  `;
}

export default async function initModule(rom, params) {
  console.log('💬 Game Discuss module initialized for:', params.slug);
  
  currentGameSlug = params.slug;
  
  const { data: { user } } = await supabase.auth.getUser();
  currentUser = user;
  if (user) {
    currentUserId = user.id;
    const adminEmails = ['retrogamemasterra@gmail.com', 'admin@retroonlinematchmaking.com'];
    isAdmin = adminEmails.includes(user.email);
  }

  const container = document.getElementById('app-content');
  if (!container) return;

  try {
    const response = await fetch('./modules/game-discuss/game-discuss.html');
    if (response.ok) {
      const html = await response.text();
      container.innerHTML = html;
      setTimeout(() => { initPageLogic(); }, 50);
    } else {
      container.innerHTML = '<div class="text-red-400 text-center mt-10">Error loading discussion interface.</div>';
    }
  } catch (e) {
    console.error('Failed to load HTML:', e);
    container.innerHTML = '<div class="text-red-400 text-center mt-10">Failed to load template.</div>';
  }
}

async function initPageLogic() {
  const { data: game, error } = await supabase
    .from('games')
    .select('id, title')
    .eq('slug', currentGameSlug)
    .single();

  if (error || !game) {
    document.getElementById('app-content').innerHTML = '<div class="text-center text-red-400 mt-10">Game not found.</div>';
    return;
  }

  currentGameId = game.id;
  document.title = `${game.title} - Community | ROM`;
  const titleEl = document.getElementById('discuss-game-title');
  if(titleEl) titleEl.textContent = game.title;
  
  await loadDiscussions('all');
  attachListeners();
}

function attachListeners() {
  const tabs = document.querySelectorAll('.cat-tab');
  if (tabs.length > 0) {
    tabs.forEach(btn => {
      btn.addEventListener('click', (e) => {
        tabs.forEach(b => {
          b.classList.remove('bg-purple-600', 'text-white');
          b.classList.add('bg-gray-800', 'text-gray-300');
        });
        e.target.classList.remove('bg-gray-800', 'text-gray-300');
        e.target.classList.add('bg-purple-600', 'text-white');
        loadDiscussions(e.target.dataset.cat);
      });
    });
  }

  const btnNew = document.getElementById('btn-new-post');
  const modal = document.getElementById('new-post-modal');
  
  if (btnNew) {
    const newBtn = btnNew.cloneNode(true);
    btnNew.parentNode.replaceChild(newBtn, btnNew);
    newBtn.addEventListener('click', () => {
      if (!currentUser) { alert('Please log in to post.'); window.location.hash = '#/auth'; return; }
      if (modal) { modal.classList.remove('hidden'); setTimeout(() => document.getElementById('post-title')?.focus(), 100); }
    });
  }

  const btnCancel = document.getElementById('cancel-post');
  if (btnCancel && modal) {
    btnCancel.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
  }

  const form = document.getElementById('new-post-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('post-title').value;
      const category = document.getElementById('post-category').value;
      const content = document.getElementById('post-content').value;

      if (!title || !content) { alert('Title and content are required.'); return; }

      const username = currentUser.user_metadata?.username || currentUser.email.split('@')[0];

      const { error } = await supabase.from('game_discussions').insert([{
        game_id: currentGameId, user_id: currentUserId, username, avatar_url: null, category, title, content
      }]);

      if (error) { alert('Error posting: ' + error.message); } 
      else {
        modal.classList.add('hidden'); form.reset();
        // Award XP for Post
        if(currentUser) await supabase.rpc('award_xp', { user_uuid: currentUserId, amount: 10, reason: 'forum_post' });
        loadDiscussions('all');
      }
    });
  }
}

async function loadDiscussions(category) {
  const listEl = document.getElementById('discussions-list');
  if (!listEl) return;

  let query = supabase.from('game_discussions').select('*').eq('game_id', currentGameId).is('parent_id', null);
  if (category !== 'all') query = query.eq('category', category);

  const { data: posts, error } = await query.order('created_at', { ascending: false });

  if (error) { listEl.innerHTML = '<div class="text-red-400 text-center">Error loading posts.</div>'; return; }
  if (!posts || posts.length === 0) { listEl.innerHTML = '<div class="text-gray-500 text-center py-10">No discussions yet.</div>'; return; }

  const authorIds = [...new Set(posts.map(p => p.user_id))];
  let profilesMap = new Map();
  
  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select(`id, username, avatar_url, xp_total, motto, gamercard_bg_type, gamercard_bg_value, rank:user_ranks (name, color)`)
      .in('id', authorIds);
    if (profiles) profiles.forEach(p => profilesMap.set(p.id, p));
  }

  // Fetch Reactions for all posts in one go
  const postIds = posts.map(p => p.id);
  let reactionsMap = new Map(); // Map<postId, Array<reaction>>
  let userReactionsSet = new Set(); // Set<"postId-reactionType">

  if (postIds.length > 0 && currentUser) {
    const { data: allReactions } = await supabase
      .from('post_reactions')
      .select('*')
      .in('post_id', postIds);
    
    if (allReactions) {
      allReactions.forEach(r => {
        if (!reactionsMap.has(r.post_id)) reactionsMap.set(r.post_id, []);
        reactionsMap.get(r.post_id).push(r);
        if (r.user_id === currentUserId) {
          userReactionsSet.add(`${r.post_id}-${r.reaction_type}`);
        }
      });
    }
  } else if (postIds.length > 0) {
     // Public view (no user reactions to highlight)
     const { data: allReactions } = await supabase.from('post_reactions').select('*').in('post_id', postIds);
     if (allReactions) {
        allReactions.forEach(r => {
          if (!reactionsMap.has(r.post_id)) reactionsMap.set(r.post_id, []);
          reactionsMap.get(r.post_id).push(r);
        });
     }
  }

  listEl.innerHTML = posts.map(post => {
    const profile = profilesMap.get(post.user_id);
    const canDelete = (currentUser && post.user_id === currentUserId) || isAdmin;
    const deleteBtn = canDelete ? `<button onclick="window.deletePost('${post.id}')" class="text-xs text-red-400 hover:text-red-300 font-bold ml-2">Delete</button>` : '';

    // Generate Reaction Bar HTML
    const postReactions = reactionsMap.get(post.id) || [];
    const reactionCounts = {};
    postReactions.forEach(r => {
      reactionCounts[r.reaction_type] = (reactionCounts[r.reaction_type] || 0) + 1;
    });

    const reactionBarHtml = REACTION_TYPES.map(type => {
      const count = reactionCounts[type.id] || 0;
      const isActive = userReactionsSet.has(`${post.id}-${type.id}`);
      return `
        <button onclick="handleReaction('${post.id}', '${type.id}')" 
                class="reaction-btn ${isActive ? 'active' : ''}" 
                data-type="${type.id}">
          <span class="reaction-icon">${type.icon}</span>
          <span class="reaction-count">${count > 0 ? count : ''}</span>
        </button>
      `;
    }).join('');

    return `
      <div class="bg-gray-800/80 backdrop-blur border border-gray-700 rounded-xl p-5 hover:border-purple-500/50 transition shadow-lg mb-4">
        <div class="flex justify-between items-start mb-2">
          <span class="bg-gray-600 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">${post.category}</span>
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-500">${new Date(post.created_at).toLocaleDateString()}</span>
            ${deleteBtn}
          </div>
        </div>
        <h3 class="text-xl font-bold text-white mb-2">${escapeHtml(post.title)}</h3>
        <div class="text-gray-300 text-sm mb-4 whitespace-pre-wrap break-words leading-relaxed">${processContentWithLinks(post.content)}</div>
        
        <div class="border-t border-gray-700 pt-3 mb-3">
          ${renderGamercard(profile)}
        </div>

        <!-- Reaction Bar -->
        ${currentUser ? `
          <div class="reaction-bar">
            ${reactionBarHtml}
          </div>
        ` : '<div class="text-xs text-gray-500 mt-2 italic">Log in to react</div>'}

        <div class="flex justify-end mb-3 mt-2">
          ${currentUser ? `<button onclick="toggleReplyForm('${post.id}')" class="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1">💬 Reply</button>` : ''}
        </div>

        ${currentUser ? `
          <div id="reply-form-${post.id}" class="hidden ml-8 mt-3 bg-gray-900/50 p-3 rounded-lg border border-gray-700">
            <textarea id="reply-content-${post.id}" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none" rows="2" placeholder="Write a reply..."></textarea>
            <div class="flex gap-2 mt-2">
              <button onclick="submitReply('${post.id}')" class="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1 rounded text-xs font-bold">Post Reply</button>
              <button onclick="toggleReplyForm('${post.id}')" class="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs">Cancel</button>
            </div>
          </div>
        ` : ''}

        <div id="replies-container-${post.id}" class="ml-8 mt-4 space-y-3 border-l-2 border-gray-700 pl-4"></div>
      </div>
    `;
  }).join('');

  posts.forEach(async (post) => { await loadReplies(post.id); });
}

// Global Handler for Reactions
window.handleReaction = async function(postId, reactionType) {
  if (!currentUser) return alert("Please log in to react!");

  const key = `${postId}-${reactionType}`;
  // Optimistic UI Toggle could go here, but for simplicity we reload counts
  
  try {
    // Check if already reacted
    const { data: existing } = await supabase
      .from('post_reactions')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', currentUserId)
      .eq('reaction_type', reactionType)
      .single();

    if (existing) {
      // Remove Reaction
      await supabase.from('post_reactions').delete().eq('id', existing.id);
    } else {
      // Add Reaction
      await supabase.from('post_reactions').insert({
        post_id: postId,
        user_id: currentUserId,
        reaction_type: reactionType
      });

      // Award XP to Post Author (3 XP per unique reaction)
      const { data: postData } = await supabase.from('game_discussions').select('user_id').eq('id', postId).single();
      if (postData && postData.user_id !== currentUserId) {
        await supabase.rpc('award_xp', { user_uuid: postData.user_id, amount: 3, reason: 'post_reaction' });
      }
    }
    
    // Reload discussions to update counts and active states
    loadDiscussions('all'); 
  } catch (err) {
    console.error("Reaction error:", err);
    alert("Failed to react");
  }
};

async function loadReplies(parentId) {
  const container = document.getElementById(`replies-container-${parentId}`);
  if (!container) return;

  const { data: replies, error } = await supabase
    .from('game_discussions')
    .select('*')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: true });

  if (error || !replies || replies.length === 0) { container.innerHTML = ''; return; }

  const authorIds = [...new Set(replies.map(r => r.user_id))];
  let profilesMap = new Map();
  
  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select(`id, username, avatar_url, xp_total, motto, gamercard_bg_type, gamercard_bg_value, rank:user_ranks (name, color)`)
      .in('id', authorIds);
    if (profiles) profiles.forEach(p => profilesMap.set(p.id, p));
  }

  container.innerHTML = replies.map(reply => {
    const profile = profilesMap.get(reply.user_id);
    const canDelete = (currentUser && reply.user_id === currentUserId) || isAdmin;
    const deleteBtn = canDelete ? `<button onclick="window.deletePost('${reply.id}')" class="text-[10px] text-red-400 hover:text-red-300 font-bold ml-2">Delete</button>` : '';

    return `
      <div class="bg-gray-800/30 p-3 rounded-lg text-sm relative group mb-2">
        <div class="flex justify-between items-start mb-2">
          <div class="flex items-center gap-2 w-full">
             ${renderGamercard(profile, true)}
          </div>
          <div class="flex items-center">
            <span class="text-[10px] text-gray-500">${new Date(reply.created_at).toLocaleDateString()}</span>
            ${deleteBtn}
          </div>
        </div>
        <p class="text-gray-300 text-xs whitespace-pre-wrap break-words ml-0 md:ml-0">${escapeHtml(reply.content)}</p>
      </div>
    `;
  }).join('');
}

function processContentWithLinks(text) {
  if (!text) return '';
  let safeText = escapeHtml(text);
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return safeText.replace(urlRegex, (url) => {
    if (url.match(/\.(jpeg|jpg|gif|png|webp|bmp)(\?.*)?$/i)) {
      return `<div class="my-2"><a href="${url}" target="_blank"><img src="${url}" class="max-h-64 rounded-lg border border-gray-600 object-contain bg-black/50"></a></div>`;
    }
    return `<a href="${url}" target="_blank" class="text-cyan-400 hover:text-cyan-300 underline break-all">${url}</a>`;
  });
}

window.toggleReplyForm = function(parentId) {
  const form = document.getElementById(`reply-form-${parentId}`);
  if (form) form.classList.toggle('hidden');
};

window.submitReply = async function(parentId) {
  const contentInput = document.getElementById(`reply-content-${parentId}`);
  const content = contentInput.value.trim();
  if (!content) return alert("Please write a reply.");
  if (!currentUser) return alert("You must be logged in.");

  const username = currentUser.user_metadata?.username || currentUser.email.split('@')[0];

  try {
    const { error } = await supabase.from('game_discussions').insert([{
      game_id: currentGameId, user_id: currentUserId, username, avatar_url: null, content, parent_id: parentId, category: 'general', title: 'Reply'
    }]);
    if (error) throw error;
    
    contentInput.value = '';
    toggleReplyForm(parentId);
    // Award XP for Reply
    await supabase.rpc('award_xp', { user_uuid: currentUserId, amount: 5, reason: 'forum_reply' });
    loadReplies(parentId);
  } catch (err) {
    alert("Failed: " + err.message);
  }
};

window.deletePost = async function(postId) {
  if(!confirm('Delete this post?')) return;
  const { error } = await supabase.from('game_discussions').delete().eq('id', postId);
  if (error) alert('Error: ' + error.message);
  else loadDiscussions('all');
};
