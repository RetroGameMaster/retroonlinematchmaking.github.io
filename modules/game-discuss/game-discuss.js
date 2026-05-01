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
    // Simple admin check (update with your actual admin logic)
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
    } else {
      container.innerHTML = '<div class="text-red-400 text-center mt-10">Error loading discussion interface.</div>';
      return;
    }
  } catch (e) {
    console.error('Failed to load HTML:', e);
    container.innerHTML = '<div class="text-red-400 text-center mt-10">Failed to load template.</div>';
    return;
  }

  // 3. Fetch Game Details
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

  // Collect unique user IDs to fetch profiles (for avatars)
  const userIds = [...new Set(posts.map(p => p.user_id).filter(Boolean))];
  let profilesMap = new Map();

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);
    
    if (profiles) {
      profiles.forEach(p => profilesMap.set(p.id, p));
    }
  }

  listEl.innerHTML = posts.map(post => {
    const catColors = {
      general: 'bg-gray-600',
      mods: 'bg-green-600',
      textures: 'bg-pink-600',
      lfg: 'bg-cyan-600',
      bugs: 'bg-red-600'
    };

    // Get Profile Data
    const profile = profilesMap.get(post.user_id);
    const displayUsername = profile?.username || post.username || 'Unknown';
    const displayAvatar = profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayUsername)}&background=6b21a8&color=fff`;
    const profileLink = `#/profile/${displayUsername}`;
    
    // Check Delete Permission
    const canDelete = currentUser && (currentUserId === post.user_id || isAdmin);
    const deleteBtn = canDelete ? `
      <button onclick="deletePost('${post.id}')" class="text-xs text-red-400 hover:text-red-300 font-bold ml-2">
        🗑️ Delete
      </button>
    ` : '';

    // Process Content for Links
    const processedContent = linkifyHtml(escapeHtml(post.content));

    return `
      <div class="bg-gray-800/80 backdrop-blur border border-gray-700 rounded-xl p-5 hover:border-purple-500/50 transition shadow-lg relative">
        ${deleteBtn}
        <div class="flex justify-between items-start mb-2">
          <span class="${catColors[post.category] || 'bg-gray-600'} text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
            ${post.category}
          </span>
          <span class="text-xs text-gray-500">${new Date(post.created_at).toLocaleDateString()}</span>
        </div>
        <h3 class="text-xl font-bold text-white mb-2">${escapeHtml(post.title)}</h3>
        <div class="text-gray-300 text-sm mb-4 whitespace-pre-wrap break-words leading-relaxed">
          ${processedContent}
        </div>
        <div class="flex items-center justify-between border-t border-gray-700 pt-3">
          <a href="${profileLink}" class="flex items-center gap-2 group hover:bg-gray-700/50 p-1 rounded transition">
            <img src="${displayAvatar}" class="w-6 h-6 rounded-full border border-gray-600">
            <span class="text-xs text-cyan-400 font-bold group-hover:underline">${displayUsername}</span>
          </a>
          <!-- Optional: Add a "Read More" if you implement single post view later -->
        </div>
      </div>
    `;
  }).join('');
}

// Helper: Convert URLs to clickable links
function linkifyHtml(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, function(url) {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-cyan-400 hover:text-cyan-300 underline break-all">${url}</a>`;
  });
}

// Helper: Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Global function for delete button
window.deletePost = async function(postId) {
  if(!confirm('Are you sure you want to delete this post?')) return;

  const { error } = await supabase
    .from('game_discussions')
    .delete()
    .eq('id', postId);

  if (error) {
    alert('Error deleting: ' + error.message);
  } else {
    loadDiscussions('all'); // Reload list
  }
};
