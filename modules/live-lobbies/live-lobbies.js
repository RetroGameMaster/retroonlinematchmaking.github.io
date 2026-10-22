import { supabase } from '../../lib/supabase.js';

let realtimeChannel = null;
let activeWebsiteRoomCount = 0;
let activeServiceRoomCount = 0;

function updateActiveRoomCount() {
  const countEl = document.getElementById('lobby-count');
  if (countEl) countEl.textContent = activeWebsiteRoomCount + activeServiceRoomCount;
}

export default function initModule(rom) {
  console.log('🌍 Live Lobbies module initialized');
  
  renderLayout(rom);
  loadActiveLobbies(rom);
  loadDiscordServices(rom);
  loadDiscordLobbies(rom);
  startRealtimeListener(rom);
  startDiscordRealtimeListener(rom);
}

function renderLayout(rom) {
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

      <!-- Tracked Network Activity -->
      <section class="mb-8 rounded-xl border border-green-500/40 bg-gray-900/70 p-5 shadow-lg">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 class="text-2xl font-bold text-green-300">🟢 Games Live by Network</h2>
            <p class="text-sm text-gray-400 mt-1">Live activity reported by the ROM bot and public game networks. Counts may overlap.</p>
          </div>
          <span id="discord-service-count" class="text-xs font-bold rounded-full border border-green-400/40 bg-green-900/40 px-3 py-1 text-green-200">Loading…</span>
        </div>
        <div id="discord-services-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div class="col-span-full text-center py-6 text-gray-500">Connecting to active game data…</div>
        </div>
      </section>

      <!-- Discord Bot Matchmaking -->
      <section class="mb-8 rounded-xl border border-indigo-500/40 bg-gray-900/70 p-5 shadow-lg">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 class="text-2xl font-bold text-indigo-300">🎮 Discord Matchmaking</h2>
            <p class="text-sm text-gray-400 mt-1">Live searches started through the ROM Discord bot.</p>
          </div>
          <span id="discord-lobby-count" class="text-xs font-bold rounded-full border border-indigo-400/40 bg-indigo-900/40 px-3 py-1 text-indigo-200">Loading…</span>
        </div>
        <div id="discord-lobbies-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div class="col-span-full text-center py-6 text-gray-500">Connecting to Discord matchmaking…</div>
        </div>
      </section>

      <!-- Filters -->
      <div class="bg-gray-800/50 backdrop-blur p-4 rounded-xl border border-gray-700 mb-8 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div class="flex min-w-0 flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <span class="text-gray-400 text-sm font-bold">Filter:</span>
          <input type="text" id="filter-search" placeholder="Search games..." class="w-full min-w-0 sm:w-auto sm:min-w-[200px] bg-gray-900 border border-gray-600 text-white rounded px-3 py-3 sm:py-2 text-sm focus:border-cyan-500 focus:outline-none">
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
  
  if(searchInput) searchInput.addEventListener('input', () => { loadActiveLobbies(rom); loadDiscordServices(rom); loadDiscordLobbies(rom); });
  if(sortSelect) sortSelect.addEventListener('change', () => { loadActiveLobbies(rom); loadDiscordServices(rom); loadDiscordLobbies(rom); });
}

async function loadActiveLobbies(rom) {
  const container = document.getElementById('lobbies-grid');
  const emptyState = document.getElementById('empty-state');
  
  if (!container) return;

  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // STEP 1: Fetch ONLY Rooms (No Joins to prevent FK errors)
    let { data: rooms, error } = await rom.supabase
      .from('chat_rooms')
      .select('*') 
      .eq('is_ephemeral', true)
      .gte('last_activity', oneHourAgo)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Safety check: ensure rooms is an array
    if (!rooms) {
      rooms = [];
    }

    // STEP 2: Collect IDs for Batch Fetching
    const gameIds = [...new Set(rooms.map(r => r.game_id).filter(Boolean))];
    const hostIds = [...new Set(rooms.map(r => r.created_by).filter(Boolean))];

    // STEP 3: Fetch Games and Profiles in Parallel
    let gamesMap = new Map();
    let hostsMap = new Map();

    const fetchPromises = [];

    if (gameIds.length > 0) {
      fetchPromises.push(
        rom.supabase
          .from('games')
          .select('id, slug, title, cover_image_url, background_image_url, background_video_url')
          .in('id', gameIds)
          .then(({ data, error }) => {
            if (!error && data) data.forEach(g => gamesMap.set(g.id, g));
          })
      );
    }

    if (hostIds.length > 0) {
      fetchPromises.push(
        rom.supabase
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
          .in('id', hostIds)
          .then(({ data, error }) => {
            if (!error && data) data.forEach(h => hostsMap.set(h.id, h));
          })
      );
    }

    await Promise.all(fetchPromises);

    // Apply Client-Side Filters
    const searchVal = document.getElementById('filter-search')?.value.toLowerCase() || '';
    const sortVal = document.getElementById('filter-sort')?.value || 'newest';

    if (searchVal) {
      rooms = rooms.filter(r => {
        const game = gamesMap.get(r.game_id);
        const gameTitle = game?.title || r.name || '';
        return gameTitle.toLowerCase().includes(searchVal);
      });
    }

    if (sortVal === 'oldest') {
      rooms.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else {
      rooms.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    // The total includes both ROM website lobbies and service-reported active rooms.
    activeWebsiteRoomCount = rooms.length;
    updateActiveRoomCount();

    if (rooms.length === 0) {
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

      // Get Data from Maps
      const game = gamesMap.get(room.game_id) || {};
      const host = hostsMap.get(room.created_by) || {};
      
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

async function loadDiscordLobbies(rom) {
  const container = document.getElementById('discord-lobbies-grid');
  const count = document.getElementById('discord-lobby-count');
  if (!container) return;
  try {
    const { data, error } = await rom.supabase
      .from('discord_bot_lfg_invites')
      .select('external_invite_id, game_title, console, minimum_players, player_count, connection_methods, additional_notes, discord_url, expires_at, created_at')
      .eq('is_expired', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    const search = document.getElementById('filter-search')?.value?.trim().toLowerCase() || '';
    const sort = document.getElementById('filter-sort')?.value || 'newest';
    let lobbies = (data || []).filter(l => !search || `${l.game_title} ${l.console || ''}`.toLowerCase().includes(search));
    lobbies.sort((a, b) => sort === 'oldest'
      ? new Date(a.created_at) - new Date(b.created_at)
      : new Date(b.created_at) - new Date(a.created_at));
    if (count) count.textContent = `${lobbies.length} active`;
    if (!lobbies.length) {
      container.innerHTML = '<div class="col-span-full rounded-lg border border-gray-700 bg-gray-950/50 p-5 text-sm text-gray-400">No active Discord matchmaking searches right now. When someone uses Find Players in Discord, their lobby will appear here.</div>';
      return;
    }
    container.innerHTML = lobbies.map(lobby => {
      const game = escapeHtml(lobby.game_title || 'Unknown game');
      const consoleName = escapeHtml(lobby.console || '');
      const methods = escapeHtml(lobby.connection_methods || 'Ask the host in Discord');
      const notes = escapeHtml(lobby.additional_notes || '');
      const joined = Number(lobby.player_count || 0);
      const minimum = Number(lobby.minimum_players || 2);
      const expires = new Date(lobby.expires_at);
      const remainingMinutes = Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 60000));
      const discordUrl = /^https:\/\/discord\.com\/channels\/\d+\/\d+\/\d+$/.test(lobby.discord_url || '') ? lobby.discord_url : '#';
      return `
        <article class="rounded-lg border border-indigo-500/30 bg-gray-950/70 p-4 flex flex-col gap-3">
          <div class="flex items-start justify-between gap-2">
            <div>
              <h3 class="text-lg font-bold text-white">${game}</h3>
              ${consoleName ? `<p class="text-xs text-gray-400 mt-1">${consoleName}</p>` : ''}
            </div>
            <span class="shrink-0 text-[10px] uppercase tracking-wide rounded border border-green-500/30 bg-green-900/30 text-green-300 px-2 py-1">Discord Live</span>
          </div>
          <div class="text-sm text-gray-300">
            <p><strong class="text-indigo-200">Players:</strong> ${joined} joined · target ${minimum}</p>
            <p class="mt-1"><strong class="text-indigo-200">Connection:</strong> ${methods}</p>
            ${notes ? `<p class="mt-2 text-gray-400">${notes}</p>` : ''}
          </div>
          <div class="mt-auto flex items-center justify-between gap-3 border-t border-gray-800 pt-3">
            <span class="text-xs text-gray-500">Expires in about ${remainingMinutes} min</span>
            <a href="${discordUrl}" target="_blank" rel="noopener noreferrer" class="rounded bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-sm font-bold text-white">Open Discord ↗</a>
          </div>
        </article>
      `;
    }).join('');
  } catch (error) {
    console.error('Discord lobby feed unavailable:', error);
    if (container) container.innerHTML = '<div class="col-span-full rounded-lg border border-gray-700 bg-gray-950/50 p-5 text-sm text-gray-400">Discord lobby sync is not configured yet. Existing ROM live lobbies are still available below.</div>';
    if (count) count.textContent = 'Not connected';
  }
}

async function loadDiscordServices(rom) {
  const container = document.getElementById('discord-services-grid');
  const count = document.getElementById('discord-service-count');
  if (!container) return;

  try {
    const pageSize = 500;
    const services = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await rom.supabase
        .from('discord_live_services')
        .select('source_key, service_name, game_title, console, players_online, discord_url, updated_at')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      services.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }

    const externalServiceCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await rom.supabase
        .from('external_live_services')
        .select('source_key, service_name, game_title, console, matched_game_id, activity_kind, players_online, updated_at')
        .eq('is_active', true)
        .gte('updated_at', externalServiceCutoff)
        .order('updated_at', { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      services.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }

    const search = document.getElementById('filter-search')?.value?.trim().toLowerCase() || '';
    const sort = document.getElementById('filter-sort')?.value || 'newest';
    const filteredServices = services.filter(service =>
      !search || `${service.game_title} ${service.console || ''} ${service.service_name || ''}`.toLowerCase().includes(search)
    );
    activeServiceRoomCount = filteredServices.length;
    updateActiveRoomCount();
    filteredServices.sort((a, b) => sort === 'oldest'
      ? new Date(a.updated_at) - new Date(b.updated_at)
      : new Date(b.updated_at) - new Date(a.updated_at));

    if (count) count.textContent = `${filteredServices.length} active`;
    if (!filteredServices.length) {
      container.innerHTML = '<div class="col-span-full rounded-lg border border-gray-700 bg-gray-950/50 p-5 text-sm text-gray-400">No games are currently reported live. When the bot sees players online, games will appear here grouped by network.</div>';
      return;
    }

    const gameTitles = [...new Set(filteredServices.map(service => service.game_title).filter(Boolean))];
    const { data: games, error: gamesError } = await rom.supabase
      .from('games')
      .select('id, slug, title, console')
      .eq('status', 'approved')
      .in('title', gameTitles);
    if (gamesError) throw gamesError;
    const matchedGameIds = [...new Set(services.map(service => service.matched_game_id).filter(Boolean))];
    let mappedGames = [];
    if (matchedGameIds.length) {
      const { data, error } = await rom.supabase
        .from('games')
        .select('id, slug, title, console')
        .eq('status', 'approved')
        .in('id', matchedGameIds);
      if (error) throw error;
      mappedGames = data || [];
    }

    const gamesByTitle = new Map();
    const gamesById = new Map();
    [...(games || []), ...mappedGames].forEach(game => {
      gamesById.set(game.id, game);
      const key = normalizeGameTitle(game.title);
      if (!gamesByTitle.has(key)) gamesByTitle.set(key, []);
      gamesByTitle.get(key).push(game);
    });

    const servicesByNetwork = new Map();
    filteredServices.forEach(service => {
      const rawName = String(service.service_name || 'Other').trim();
      const key = rawName.toLocaleLowerCase();
      const displayName = ({
        'socom.cc': 'SOCOM.cc',
        'psrewired': 'PSRewired',
        'retroarch netplay': 'RetroArch Netplay'
      })[key] || rawName;
      if (!servicesByNetwork.has(displayName)) servicesByNetwork.set(displayName, []);
      servicesByNetwork.get(displayName).push(service);
    });

    const networkSections = [...servicesByNetwork.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([networkName, networkServices]) => {
        const cards = networkServices.map(service => {
          const title = escapeHtml(service.game_title || 'Unknown game');
          const consoleName = escapeHtml(service.console || '');
          const playerCount = Number(service.players_online || 0);
          const activityLabel = service.activity_kind === 'lobbies' ? 'lobby' : 'player';
          const titleMatches = gamesByTitle.get(normalizeGameTitle(service.game_title)) || [];
          const matchingGame = gamesById.get(service.matched_game_id) || titleMatches.find(game =>
            !service.console || normalizeGameTitle(game.console) === normalizeGameTitle(service.console)
          ) || (titleMatches.length === 1 ? titleMatches[0] : null);
          const gameHref = matchingGame
            ? `#/game/${encodeURIComponent(matchingGame.slug || matchingGame.id)}`
            : `#/games?search=${encodeURIComponent(service.game_title || '')}`;
          const url = /^https:\/\/discord\.com\/channels\/\d+(?:\/\d+){1,2}$/.test(service.discord_url || '')
            ? service.discord_url
            : null;
          return `
            <article class="rounded-lg border border-green-500/30 bg-gray-950/70 p-4 flex flex-col gap-3">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <h4 class="text-lg font-bold text-white"><a href="${gameHref}" class="rounded-sm hover:text-cyan-300 hover:underline focus:outline-none focus:ring-2 focus:ring-cyan-400">${title}</a></h4>
                  ${consoleName ? `<p class="text-xs text-gray-400 mt-1">${consoleName}</p>` : ''}
                </div>
                <span class="shrink-0 text-[10px] uppercase tracking-wide rounded border border-green-500/30 bg-green-900/30 text-green-300 px-2 py-1">Online</span>
              </div>
              <div class="mt-auto flex items-center justify-between gap-3 border-t border-gray-800 pt-3">
                <span class="text-xs text-gray-400">${playerCount} ${activityLabel}${playerCount === 1 ? '' : 's'} ${activityLabel === 'lobby' ? 'reported' : 'online'}</span>
                ${url ? `<a href="${url}" target="_blank" rel="noopener noreferrer" class="rounded bg-green-700 hover:bg-green-600 px-3 py-2 text-sm font-bold text-white">Open Discord ↗</a>` : ''}
              </div>
            </article>
          `;
        }).join('');
        return `
          <details class="col-span-full rounded-lg border border-gray-700 bg-gray-900/60 p-4">
            <summary class="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400">
              <span class="text-xl font-bold text-green-200">${escapeHtml(networkName)}</span>
              <span class="flex items-center gap-3">
                <span class="text-xs text-gray-400">${networkServices.length} live game${networkServices.length === 1 ? '' : 's'}</span>
                <span class="text-gray-400" aria-hidden="true">▾</span>
              </span>
            </summary>
            <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">${cards}</div>
          </details>
        `;
      });
    container.innerHTML = networkSections.join('');
  } catch (error) {
    console.error('Discord active game feed unavailable:', error);
    container.innerHTML = '<div class="col-span-full rounded-lg border border-gray-700 bg-gray-950/50 p-5 text-sm text-gray-400">Discord active game sync is not available right now.</div>';
    if (count) count.textContent = 'Not connected';
  }
}

function normalizeGameTitle(value) {
  return String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function startDiscordRealtimeListener(rom) {
  const channel = rom.supabase.channel('discord-live-lobbies-monitor');
  channel.on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'discord_bot_lfg_invites'
  }, () => {
    clearTimeout(window.discordLobbyRefreshTimeout);
    window.discordLobbyRefreshTimeout = setTimeout(() => loadDiscordLobbies(rom), 350);
  }).on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'discord_live_services'
  }, () => {
    clearTimeout(window.discordServicesRefreshTimeout);
    window.discordServicesRefreshTimeout = setTimeout(() => loadDiscordServices(rom), 350);
  }).on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'external_live_services'
  }, () => {
    clearTimeout(window.discordServicesRefreshTimeout);
    window.discordServicesRefreshTimeout = setTimeout(() => loadDiscordServices(rom), 350);
  }).subscribe();
  window.addEventListener('beforeunload', () => rom.supabase.removeChannel(channel), { once: true });
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
