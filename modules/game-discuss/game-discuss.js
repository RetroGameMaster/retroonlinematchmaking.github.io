import { supabase } from '../../lib/supabase.js';

let currentGameId = null;
let currentGameSlug = null;
let currentUser = null;
let currentUserId = null;
let isAdmin = false;

export default async function initModule(rom, params) {
  console.log('💬 Game Discuss module initialized for:', params.slug);
  
  currentGameSlug = params.slug;
  
  // 1. Get User & Admin Status
  const { data: { user } } = await supabase.auth.getUser();
  currentUser = user;
  if (user) {
    currentUserId = user.id;
    const adminEmails = ['retrogamemasterra@gmail.com', 'admin@retroonlinematchmaking.com'];
    isAdmin = adminEmails.includes(user.email);
  }

  const container = document.getElementById('app-content');
  if (!container) return;

  // 2. LOAD THE HTML FILE MANUALLY
  try {
    const response = await fetch('./modules/game-discuss/game-discuss.html');
    if (response.ok) {
      const html = await response.text();
      container.innerHTML = html;
      
      setTimeout(() => {
        initPageLogic();
      }, 50);
      
    } else {
      container.innerHTML = '<div class="text-red-400 text-center mt-10">Error loading discussion interface.</div>';
      return;
    }
  } catch (e) {
    console.error('Failed to load HTML:', e);
    container.innerHTML = '<div class="text-red-400 text-center mt-10">Failed to load template.</div>';
    return;
  }
}

async function initPageLogic() {
  console.log('🔧 Initializing page logic...');

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
  console.log('📎 Attaching listeners...');

  // 1. Category Tabs
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

  // 2. New Post Button
  const btnNew = document.getElementById('btn-new-post');
  const modal = document.getElementById('new-post-modal');
  
  if (btnNew) {
    const newBtn = btnNew.cloneNode(true);
    btnNew.parentNode.replaceChild(newBtn, btnNew);
    
    newBtn.addEventListener('click', () => {
      if (!currentUser) {
        alert('Please log in to post.');
        window.location.hash = '#/auth';
        return;
      }
      if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
          const titleInput = document.getElementById('post-title');
          if(titleInput) titleInput.focus();
        }, 100);
      }
    });
  }

  // 3. Cancel Button
  const btnCancel = document.getElementById('cancel-post');
  if (btnCancel && modal) {
    btnCancel.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  }

  // 4. Form Submit
  const form = document.getElementById('new-post-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const title = document.getElementById('post-title').value;
      const category = document.getElementById('post-category').value;
      const content = document.getElementById('post-content').value;

      if (!title || !content) {
        alert('Title and content are required.');
        return;
      }

      const username = currentUser.user_metadata?.username || currentUser.email.split('@')[0];

      const { error } = await supabase.from('game_discussions').insert([{
        game_id: currentGameId,
        user_id: currentUserId,
        username: username, 
        avatar_url: null, 
        category,
        title,
        content
      }]);

      if (error) {
        console.error('DB Error:', error);
        alert('Error posting: ' + error.message);
      } else {
        // Award XP for posting (10 XP)
        await supabase.rpc('award_xp', { user_uuid: currentUserId, amount: 10, reason: 'forum_post' });
        
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

  let query = supabase.from('game_discussions').select('*').eq('game_id', currentGameId).is('parent_id', null);
  
  if (category !== 'all') {
    query = query.eq('category', category);
  }

  const { data: posts, error } = await query.order('created_at', { ascending: false });

  if (error) {
    listEl.innerHTML = '<div class="text-red-400 text-center">Error loading posts.</div>';
    return;
  }

  if (!posts || posts.length === 0) {
    listEl.innerHTML = '<div class="text-gray-500 text-center py-10">No discussions yet. Be the first!</div>';
    return;
  }

  // Fetch Avatars AND Ranks for Main Posts
  const authorIds = [...new Set(posts.map(p => p.user_id))];
  let profilesMap = new Map();
  
  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select(`
        id, 
        username, 
        avatar_url, 
        xp_total, 
        motto, 
        gamercard_bg_type, 
        gamercard_bg_value,
        current_rank_id,
        user_ranks!inner (
          id,
          name,
          color
        )
      `)
      .in('id', authorIds);
    
    if (profiles) profiles.forEach(p => profilesMap.set(p.id, p));
  }

  listEl.innerHTML = posts.map(post => {
    const catColors = {
      general: 'bg-gray-600',
      mods: 'bg-green-600',
      textures: 'bg-pink-600',
      lfg: 'bg-cyan-600',
      bugs: 'bg-red-600'
    };
    
    const profile = profilesMap.get(post.user_id);
    // Handle the join result structure
    const rank = profile?.user_ranks?.[0] || null; 
    
    const displayUsername = profile?.username || post.username || 'Unknown';
    const displayAvatar = profile?.avatar_url || `https://ui-avatars.com/api/?name=${displayUsername}&background=06b6d4&color=fff`;
    const profileLink = `#/profile/${displayUsername}`;
    
    const processedContent = processContentWithLinks(post.content);
    const canDelete = (currentUser && post.user_id === currentUserId) || isAdmin;
    
    const deleteBtn = canDelete ? `
      <button onclick="window.deletePost('${post.id}')" class="text-xs text-red-400 hover:text-red-300 font-bold ml-2">
        Delete
      </button>
    ` : '';

    const rankBadge = rank ? 
      `<span class="text-[10px] px-1.5 py-0.5 rounded font-bold border" style="background:${rank.color}20; color:${rank.color}; border-color:${rank.color}">${escapeHtml(rank.name)}</span>` : '';

    return `
      <div class="bg-gray-800/80 backdrop-blur border border-gray-700 rounded-xl p-5 hover:border-purple-500/50 transition shadow-lg mb-4">
        <div class="flex justify-between items-start mb-2">
          <span class="${catColors[post.category] || 'bg-gray-600'} text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
            ${post.category}
          </span>
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-500">${new Date(post.created_at).toLocaleDateString()}</span>
            ${deleteBtn}
          </div>
        </div>
        
        <h3 class="text-xl font-bold text-white mb-2">${escapeHtml(post.title)}</h3>
        
        <div class="text-gray-300 text-sm mb-4 whitespace-pre-wrap break-words leading-relaxed">
          ${processedContent}
        </div>
        
        <div class="flex items-center justify-between border-t border-gray-700 pt-3 mb-3">
          <div class="flex items-center gap-2">
            <img src="${displayAvatar}" class="w-6 h-6 rounded-full border border-gray-600">
            <a href="${profileLink}" class="text-xs text-cyan-400 font-bold hover:underline">${escapeHtml(displayUsername)}</a>
            ${rankBadge}
          </div>
          ${currentUser ? `
            <button onclick="toggleReplyForm('${post.id}')" class="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1">
              💬 Reply
            </button>
          ` : ''}
        </div>

        <!-- Reply Form -->
        ${currentUser ? `
          <div id="reply-form-${post.id}" class="hidden ml-8 mt-3 bg-gray-900/50 p-3 rounded-lg border border-gray-700">
            <textarea id="reply-content-${post.id}" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none" rows="2" placeholder="Write a reply..."></textarea>
            <div class="flex gap-2 mt-2">
              <button onclick="submitReply('${post.id}')" class="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1 rounded text-xs font-bold">Post Reply</button>
              <button onclick="toggleReplyForm('${post.id}')" class="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs">Cancel</button>
            </div>
          </div>
        ` : ''}

        <!-- Replies List -->
        <div id="replies-container-${post.id}" class="ml-8 mt-4 space-y-3 border-l-2 border-gray-700 pl-4">
          <!-- Replies injected via JS -->
        </div>
      </div>
    `;
  }).join('');

  posts.forEach(async (post) => {
    await loadReplies(post.id);
  });
}

async function loadReplies(parentId) {
  const container = document.getElementById(`replies-container-${parentId}`);
  if (!container) return;

  const { data: replies, error } = await supabase
    .from('game_discussions')
    .select('*')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: true });

  if (error || !replies || replies.length === 0) {
    container.innerHTML = '';
    return;
  }

  const authorIds = [...new Set(replies.map(r => r.user_id))];
  let profilesMap = new Map();
  
  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select(`
        id, 
        username, 
        avatar_url, 
        xp_total, 
        motto, 
        current_rank_id,
        user_ranks!inner (
          id,
          name,
          color
        )
      `)
      .in('id', authorIds);
    
    if (profiles) profiles.forEach(p => profilesMap.set(p.id, p));
  }

  container.innerHTML = replies.map(reply => {
    const profile = profilesMap.get(reply.user_id);
    const rank = profile?.user_ranks?.[0] || null;
    
    const displayUsername = profile?.username || reply.username || 'Unknown';
    const displayAvatar = profile?.avatar_url || `https://ui-avatars.com/api/?name=${displayUsername}&background=06b6d4&color=fff`;
    const profileLink = `#/profile/${displayUsername}`;
    const canDelete = (currentUser && reply.user_id === currentUserId) || isAdmin;

    const deleteBtn = canDelete ? `
      <button onclick="window.deletePost('${reply.id}')" class="text-[10px] text-red-400 hover:text-red-300 font-bold ml-2">
        Delete
      </button>
    ` : '';

    const rankBadge = rank ? 
      `<span class="text-[9px] px-1 py-0.5 rounded font-bold border" style="background:${rank.color}20; color:${rank.color}; border-color:${rank.color}">${escapeHtml(rank.name)}</span>` : '';

    return `
      <div class="bg-gray-800/30 p-3 rounded-lg text-sm relative group">
        <div class="flex justify-between items-start mb-1">
          <div class="flex items-center gap-2">
            <img src="${displayAvatar}" class="w-5 h-5 rounded-full border border-gray-600">
            <a href="${profileLink}" class="text-xs font-bold text-cyan-400 hover:underline">${escapeHtml(displayUsername)}</a>
            ${rankBadge}
          </div>
          <div class="flex items-center">
            <span class="text-[10px] text-gray-500">${new Date(reply.created_at).toLocaleDateString()}</span>
            ${deleteBtn}
          </div>
        </div>
        <p class="text-gray-300 text-xs whitespace-pre-wrap break-words">${escapeHtml(reply.content)}</p>
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
      return `<div class="my-2"><a href="${url}" target="_blank" rel="noopener noreferrer"><img src="${url}" alt="Image" class="max-h-64 rounded-lg border border-gray-600 hover:border-cyan-400 transition object-contain bg-black/50 cursor-pointer"></a></div>`;
    }
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-cyan-400 hover:text-cyan-300 underline break-all">${url}</a>`;
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
  if (!currentUser) return alert("You must be logged in to reply.");

  const username = currentUser.user_metadata?.username || currentUser.email.split('@')[0];

  try {
    const { error } = await supabase.from('game_discussions').insert([{
      game_id: currentGameId,
      user_id: currentUserId,
      username: username,
      avatar_url: null,
      content: content,
      parent_id: parentId,
      category: 'general',
      title: 'Reply'
    }]);

    if (error) throw error;

    // Award XP for reply (5 XP)
    await supabase.rpc('award_xp', { user_uuid: currentUserId, amount: 5, reason: 'forum_reply' });

    contentInput.value = '';
    toggleReplyForm(parentId);
    loadReplies(parentId);
    
  } catch (err) {
    console.error("Error posting reply:", err);
    alert("Failed to post reply: " + err.message);
  }
};

window.deletePost = async function(postId) {
  if(!confirm('Are you sure you want to delete this post?')) return;
  const { error } = await supabase.from('game_discussions').delete().eq('id', postId);
  if (error) alert('Error deleting: ' + error.message);
  else loadDiscussions('all');
};

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
