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
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // STEP 1: Fetch Rooms + Game Data ONLY (Removed profiles join to avoid FK error)
    let { data: rooms, error } = await rom.supabase
      .from('chat_rooms')
      .select(`
        *,
        games (
          slug, 
          title, 
          cover_image_url, 
          background_image_url, 
          background_video_url
        )
      `)
      .eq('is_ephemeral', true)
      .gte('last_activity', oneHourAgo)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // STEP 2: Fetch Host Profiles Separately
    let hostProfilesMap = new Map();
    if (rooms && rooms.length > 0) {
      // Collect unique user IDs
      const hostIds = [...new Set(rooms.map(r => r.created_by).filter(Boolean))];
      
      if (hostIds.length > 0) {
        const { data: profiles, error: profileError } = await rom.supabase
          .from('profiles')
          .select(`
            id,
            username,
            avatar_url,
            motto,
            xp_total,
            gamercard_bg_type,
            gamercard_bg_value,
            rank:user_ranks (name, color)
          `)
          .in('id', hostIds);
        
        if (!profileError && profiles) {
          profiles.forEach(p => hostProfilesMap.set(p.id, p));
        }
      }
    }

    // Apply Client-Side Filters
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
      rooms.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    // Update UI
    if (countEl) countEl.textContent = rooms?.length || 0;

    if (!rooms || rooms.length === 0) {
      container.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }

    container.classList.remove('hidden');
    emptyState.classList.add('hidden');

    // Render Cards
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

      const game = room.games || {};
      // Get host data from our manual map
      const host = hostProfilesMap.get(room.created_by) || {};
      
      const gameSlug = game.slug;
      const displayName = game.title || room.name.replace('Live Lobby', '').trim() || 'Unknown Game';
      const joinLink = gameSlug ? `#/game/${gameSlug}` : `#/games?search=${encodeURIComponent(displayName)}`;

      // Determine Background Image
      let bgImageStyle = '';
      if (game.background_image_url) {
        bgImageStyle = `background-image: url('${game.background_image_url}'); background-size: cover; background-position: center;`;
      } else if (game.cover_image_url) {
        bgImageStyle = `background-image: url('${game.cover_image_url}'); background-size: cover; background-position: center;`;
      } else {
        bgImageStyle = `background: linear-gradient(135deg, #064e3b 0%, #111827 100%);`;
      }

      // Generate Host Gamercard HTML
      const hostUsername = host.username || 'Anonymous';
      const hostAvatar = host.avatar_url || `https://ui-avatars.com/api/?name=${hostUsername}&background=06b6d4&color=fff`;
      const hostRank = host.rank;
      const hostMotto = host.motto;
      
      let gcBgStyle = '';
      if (host.gamercard_bg_type === 'image') {
        gcBgStyle = `background-image: url('${host.gamercard_bg_value}'); background-size: cover;`;
      } else if (host.gamercard_bg_type === 'gradient') {
        gcBgStyle = `background-image: ${host.gamercard_bg_value};`;
      } else {
        gcBgStyle = `background-color: ${host.gamercard_bg_value || '#1f2937'};`;
      }

      const rankBadge = hostRank ? 
        `<span class="text-[9px] px-1 py-0.5 rounded font-bold" style="background:${hostRank.color}30; color:${hostRank.color}; border:1px solid ${hostRank.color}">${escapeHtml(hostRank.name)}</span>` : 
        `<span class="text-[9px] px-1 py-0.5 rounded font-bold bg-gray-700 text-gray-400">Player</span>`;

      return `
        <a href="${joinLink}" class="group block bg-gray-800/60 backdrop-blur rounded-xl border border-gray-700 hover:border-green-500/50 transition-all duration-300 overflow-hidden shadow-lg hover:shadow-[0_0_20px_rgba(34,197,94,0.15)] transform hover:-translate-y-1 flex flex-col h-full">
          
          <!-- Game Background Header -->
          <div class="relative h-32 w-full overflow-hidden">
            <div class="absolute inset-0 ${bgImageStyle} transition-transform duration-500 group-hover:scale-105"></div>
            <!-- Overlay Gradient -->
            <div class="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent"></div>
            
            <!-- Status Badge -->
            <div class="absolute top-3 right-3 ${statusColor} text-xs font-bold bg-gray-900/90 px-2 py-1 rounded border border-gray-600 backdrop-blur shadow-lg">
              ${statusBadge}
            </div>

            <!-- Game Title Overlay -->
            <div class="absolute bottom-3 left-4 right-4">
              <h3 class="text-xl font-bold text-white drop-shadow-md line-clamp-1 group-hover:text-green-400 transition-colors">
                ${escapeHtml(displayName)}
              </h3>
              ${room.stream_url ? '<span class="text-[10px] text-purple-300 font-bold bg-purple-900/80 px-1.5 py-0.5 rounded border border-purple-500/50 mt-1 inline-block">📺 Streaming</span>' : ''}
            </div>
          </div>

          <!-- Content Body -->
          <div class="p-4 flex-1 flex flex-col justify-between">
            
            <!-- Host Gamercard Section -->
            <div class="mb-4">
              <p class="text-xs text-gray-500 mb-2 uppercase tracking-wider font-bold">Hosted By</p>
              <div class="gamercard chat-gamercard relative overflow-hidden rounded-lg border border-gray-600 shadow-md bg-gray-900">
                <!-- Gamercard Background -->
                <div class="absolute inset-0 opacity-40" style="${gcBgStyle} filter: brightness(0.7);"></div>
                <!-- Overlay for readability -->
                <div class="absolute inset-0 bg-gradient-to-r from-black/80 to-black/40"></div>
                
                <!-- Content -->
                <div class="relative z-10 p-2 flex items-center gap-3">
                  <img src="${hostAvatar}" alt="${hostUsername}" class="w-10 h-10 rounded-full border-2 border-cyan-500 object-cover flex-shrink-0 shadow-sm">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1 mb-0.5">
                      <span class="text-xs font-bold text-white truncate drop-shadow-md">${escapeHtml(hostUsername)}</span>
                    </div>
                    ${rankBadge}
                    ${hostMotto ? `<p class="text-[9px] text-gray-300 italic truncate drop-shadow-md mt-0.5">"${escapeHtml(hostMotto)}"</p>` : ''}
                  </div>
                </div>
              </div>
            </div>

            <!-- Meta Footer -->
            <div class="flex items-center justify-between text-xs text-gray-500 border-t border-gray-700 pt-3 mt-auto">
              <span>ID: ${room.id.slice(0,6)}...</span>
              <span>${minsAgo}m ago</span>
            </div>
          </div>
          
          <!-- Hover Action Bar -->
          <div class="bg-gray-900/80 px-4 py-2 border-t border-gray-700 flex justify-between items-center group-hover:bg-green-900/30 transition-colors">
            <span class="text-green-400 text-xs font-bold flex items-center gap-1">
              Join Session <span>→</span>
            </span>
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
      event: '*',
      schema: 'public', 
      table: 'chat_rooms',
      filter: 'is_ephemeral=eq.true'
    }, () => {
      clearTimeout(window.lobbyRefreshTimeout);
      window.lobbyRefreshTimeout = setTimeout(() => {
        loadActiveLobbies(rom);
      }, 500);
    })
    .subscribe();
    
  console.log('✅ Realtime listener started for live lobbies');
}

window.addEventListener('beforeunload', () => {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
});

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
