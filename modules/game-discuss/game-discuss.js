import { supabase } from '../../lib/supabase.js';

let currentGameId = null;
let currentGameSlug = null;
let currentUser = null;

export default async function initModule(rom, params) {
  console.log('💬 Game Discuss module initialized for:', params.slug);
  
  currentGameSlug = params.slug;
  const {  { user } } = await supabase.auth.getUser();
  currentUser = user;

  const container = document.getElementById('app-content');
  if (!container) return;

  // 1. Fetch Game Details to get ID and Title
  const {  game, error } = await supabase
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
  
  setTimeout(() => {
    document.getElementById('discuss-game-title').textContent = game.title;
    loadDiscussions('all');
    attachListeners();
  }, 100);
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
    modal.classList.remove('hidden');
  });

  if (btnCancel) btnCancel.addEventListener('click', () => modal.classList.add('hidden'));

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('post-title').value;
      const category = document.getElementById('post-category').value;
      const content = document.getElementById('post-content').value;

      const { error } = await supabase.from('game_discussions').insert([{
        game_id: currentGameId,
        user_id: currentUser.id,
        username: currentUser.email.split('@')[0], // Or fetch from profile
        avatar_url: null, // Fetch from profile if needed
        category,
        title,
        content
      }]);

      if (error) {
        alert('Error posting: ' + error.message);
      } else {
        modal.classList.add('hidden');
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

  const {  posts, error } = await query.order('created_at', { ascending: false });

  if (error) {
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
            <span class="text-xs text-gray-400 font-bold">${post.username}</span>
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
