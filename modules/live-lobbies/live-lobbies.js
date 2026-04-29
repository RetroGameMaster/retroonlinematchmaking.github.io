import { supabase } from '../../lib/supabase.js';

let realtimeChannel = null;

export default function initModule(rom) {
  console.log('🌍 Live Lobbies module initialized');
  
  renderLayout();
  loadActiveLobbies(rom);
  startRealtimeListener(rom);
}

function renderLayout() {
  const appContent = document.getElementById('app-content');
  if (!appContent) return;

  appContent.innerHTML = `
    <div class="max-w-7xl mx-auto p-4 animate-fade-in">
      
      <!-- Header -->
      <div class="text-center mb-10 relative">
        <h1 class="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-500 mb-4 drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]">
          🔴 Live Now
        </h1>
        <p class="text-gray-400 text-lg max-w-2xl mx-auto">
          Jump into active game sessions. Chat, stream, and play with the community in real-time.
          <br><span class="text-xs text-gray-500">(Rooms expire after 1 hour of inactivity)</span>
        </p>
        
        <!-- Live Counter -->
        <div class="mt-6 inline-flex items-center gap-2 bg-gray-800/80 backdrop-blur px-6 py-2 rounded-full border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)]">
          <span class="relative flex h-3 w-3">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span class="text-green-400 font-bold text-sm tracking-wide" id="lobby-count">Scanning...</span>
          <span class="text-gray-500 text-xs uppercase">Active Rooms</span>
        </div>
      </div>

      <!-- Filters -->
      <div class="bg-gray-800/50 backdrop-blur p-4 rounded-xl border border-gray-700 mb-8 flex flex-wrap gap-4 items-center justify-between">
        <div class="flex gap-2 items-center">
          <span class="text-gray-400 text-sm font-bold">Filter:</span>
          <input type="text" id="filter-search" placeholder="Search games..." class="bg-gray-900 border border-gray-600 text-white rounded px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none min-w-[200px]">
        </div>
        <div class="flex gap-2">
           <select id="filter-sort" class="bg-gray-900 border border-gray-600 text-white rounded px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      <!-- Grid -->
      <div id="lobbies-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div class="col-span-full text-center py-20">
          <div class="inline-block animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-500 mb-4"></div>
          <p class="text-gray-400 text-lg">Scanning for active signals...</p>
        </div>
      </div>

      <!-- Empty State (Hidden by default) -->
      <div id="empty-state" class="hidden text-center py-20">
        <div class="text-6xl mb-4">👻</div>
        <h3 class="text-2xl font-bold text-white mb-2">No Active Lobbies</h3>
        <p class="text-gray-400 mb-6">It's quiet... too quiet. Be the first to start a session!</p>
        <a href="#/games" class="inline-block bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-8 rounded-lg transition shadow-lg transform hover:-translate-y-1">
          Browse Games & Start Lobby
        </a>
      </div>

    </div>
  `;

  // Attach Filter Listeners
  const searchInput = document.getElementById('filter-search');
  const sortSelect = document.getElementById('filter-sort');
  
  if(searchInput) searchInput.addEventListener('input', () => loadActiveLobbies(rom));
  if(sortSelect) sortSelect.addEventListener('change', () => loadActiveLobbies(rom));
}

async function loadActiveLobbies(rom) {
  const container = document.getElementById('lobbies-grid');
  const emptyState = document.getElementById('empty-state');
  const countEl = document.getElementById('lobby-count');
  
  if (!container) return;

  try {
    // 1. Fetch Active Ephemeral Rooms (Active within last 60 mins)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // Select game_id to link to the correct page
    let { data: rooms, error } = await rom.supabase
      .from('chat_rooms')
      .select('*, games(slug, title)') // Join with games table to get slug
      .eq('is_ephemeral', true)
      .gte('last_activity', oneHourAgo)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 2. Apply Client-Side Filters
    const searchVal = document.getElementById('filter-search')?.value.toLowerCase() || '';
    const sortVal = document.getElementById('filter-sort')?.value || 'newest';

    if (searchVal) {
      rooms = rooms.filter(r => {
        const gameTitle = r.games?.title || r.name || '';
        return gameTitle.toLowerCase().includes(searchVal);
      });
    }

    if (sortVal === 'oldest') {
      rooms.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else {
      rooms.sort((a, b) => new Date(b.created_at) - new Date(b.created_at));
    }

    // 3. Update UI
    if (countEl) countEl.textContent = rooms?.length || 0;

    if (!rooms || rooms.length === 0) {
      container.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }

    container.classList.remove('hidden');
    emptyState.classList.add('hidden');

    // 4. Render Cards
    container.innerHTML = rooms.map(room => {
      const timeDiff = Date.now() - new Date(room.last_activity).getTime();
      const minsAgo = Math.floor(timeDiff / 60000);
      
      let statusBadge = '';
      let statusColor = '';
      
      if (minsAgo < 5) {
        statusBadge = '● Live Now';
        statusColor = 'text-green-400 animate-pulse';
      } else if (minsAgo < 30) {
        statusBadge = '● Active';
        statusColor = 'text-cyan-400';
      } else {
        statusBadge = '● Idle';
        statusColor = 'text-yellow-400';
      }

      // Use the joined game data for display and linking
      const gameSlug = room.games?.slug;
      const displayName = room.games?.title || room.name.replace('Live Lobby', '').replace('lobby-', '').trim() || 'Unknown Game';
      
      // FIXED: Link directly to the game slug if available, otherwise fallback to search
      const joinLink = gameSlug ? `#/game/${gameSlug}` : `#/games?search=${encodeURIComponent(displayName)}`;

      return `
        <a href="${joinLink}" class="group block bg-gray-800/60 backdrop-blur hover:bg-gray-800 rounded-xl border border-gray-700 hover:border-green-500/50 transition-all duration-300 overflow-hidden shadow-lg hover:shadow-[0_0_20px_rgba(34,197,94,0.15)] transform hover:-translate-y-1">
          <div class="p-6 relative">
            <!-- Status Indicator -->
            <div class="absolute top-4 right-4 ${statusColor} text-xs font-bold bg-gray-900/80 px-2 py-1 rounded border border-gray-600 backdrop-blur">
              ${statusBadge}
            </div>

            <!-- Icon -->
            <div class="w-12 h-12 bg-gradient-to-br from-green-900/50 to-gray-900 rounded-lg flex items-center justify-center mb-4 border border-green-500/30 group-hover:scale-110 transition-transform">
              <span class="text-2xl">🎮</span>
            </div>

            <!-- Info -->
            <h3 class="text-xl font-bold text-white mb-2 line-clamp-1 group-hover:text-green-400 transition-colors">
              ${escapeHtml(displayName)}
            </h3>
            
            <div class="flex items-center gap-2 text-sm text-gray-400 mb-4">
              <span>Hosted by:</span>
              <span class="text-cyan-300 font-medium truncate">${room.created_by || 'Anonymous'}</span>
            </div>

            <!-- Meta -->
            <div class="flex items-center justify-between text-xs text-gray-500 border-t border-gray-700 pt-4 mt-2">
              <span>Room ID: ${room.id.slice(0,8)}...</span>
              <span>Last active: ${minsAgo}m ago</span>
            </div>
          </div>
          
          <!-- Hover Action -->
          <div class="bg-gray-900/50 px-6 py-3 border-t border-gray-700 flex justify-between items-center group-hover:bg-green-900/20 transition-colors">
            <span class="text-green-400 text-sm font-bold flex items-center gap-2">
              Join Session <span>→</span>
            </span>
            ${room.stream_url ? '<span class="text-purple-400 text-xs font-bold bg-purple-900/30 px-2 py-1 rounded border border-purple-500/30">📺 Streaming</span>' : ''}
          </div>
        </a>
      `;
    }).join('');

  } catch (err) {
    console.error('Error loading live lobbies:', err);
    if(container) container.innerHTML = `<div class="col-span-full text-center text-red-400">Error loading lobbies: ${err.message}</div>`;
  }
}

function startRealtimeListener(rom) {
  realtimeChannel = rom.supabase.channel('live-lobbies-monitor');

  realtimeChannel
    .on('postgres_changes', { 
      event: '*', // Listen to Insert, Update, Delete
      schema: 'public', 
      table: 'chat_rooms',
      filter: 'is_ephemeral=eq.true'
    }, () => {
      // Debounce slightly to prevent rapid flickering
      clearTimeout(window.lobbyRefreshTimeout);
      window.lobbyRefreshTimeout = setTimeout(() => {
        loadActiveLobbies(rom);
      }, 500);
    })
    .subscribe();
    
  console.log('✅ Realtime listener started for live lobbies');
}

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
});

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
