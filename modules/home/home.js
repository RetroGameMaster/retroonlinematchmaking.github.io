// modules/home/home.js - ENHANCED WITH LFG & TOURNAMENT TICKER
import { supabase } from '../../lib/supabase.js';
import { getRecentTournamentsForTicker } from '../tournaments/tournaments.js';

let realtimeChannel = null;
let homeStatsInterval = null;
let onlineUsersInterval = null;
let currentlyHotInterval = null;
let currentlyHotRefreshTimeout = null;
let tickerDisplayInterval = null;
let tickerRefreshInterval = null;
let dynamicMessages = []; // Stores combined LFG and Tournament messages
let standardMessages = [
  "Welcome to ROM! 🎮", 
  "Check out the Game of the Week! 🏆", 
  "Join the Discord for chat! 💬", 
  "Listen to Vivi_Gaming Radio! 📻",
  "Submit your favorite retro game! ➕"
];

export default function initModule(rom) {
  console.log('🏠 Homepage initialized');
  
  // 1. Inject SEO Meta Tags
  injectSEOMeta();
  
  // 2. Render Layout
  renderHomeLayout();
  
  // 3. Initialize Effects
  initAmbientEffects();
  
  // 4. Load Dynamic Content
  loadSiteSettings();
  loadGameOfTheWeek();
  loadCurrentlyHot();
  if (currentlyHotInterval) clearInterval(currentlyHotInterval);
  currentlyHotInterval = setInterval(loadCurrentlyHot, 60000);
  loadOnlineUsers();
  if (onlineUsersInterval) clearInterval(onlineUsersInterval);
  onlineUsersInterval = setInterval(loadOnlineUsers, 60000);
  loadHomeLeaderboardPreview(); // Load Top Players
  loadRecentActivity();
  loadCommunitySpotlight();
  loadDecompSpotlight();
  
  // 5. Start Realtime Listeners & Ticker
  refreshDynamicTicker(rom); // Initial Load of LFG + Tournaments
  startRealtimeFeed(rom);
}

// ============================================================================
// 0. SEO INJECTION
// ============================================================================
function injectSEOMeta() {
  document.title = "Retro Online Matchmaking | Play Classic Games Online";
  
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.name = "description";
    document.head.appendChild(metaDesc);
  }
  metaDesc.content = "Connect with retro gaming communities. Play SOCOM II, Twisted Metal, Warhawk, and more with modern matchmaking. Join lobbies, track achievements, and find friends today.";

  const scriptId = 'home-schema-jsonld';
  if (!document.getElementById(scriptId)) {
    const script = document.createElement('script');
    script.id = scriptId;
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Retro Online Matchmaking",
      "url": window.location.origin,
      "description": "The premier destination for retro online multiplayer gaming.",
      "potentialAction": {
        "@type": "SearchAction",
        "target": `${window.location.origin}/#/games?q={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    });
    document.head.appendChild(script);
  }
}

// ============================================================================
// 1. AMBIENT EFFECTS
// ============================================================================
function initAmbientEffects() {
  if (!document.getElementById('crt-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'crt-overlay';
    overlay.style.pointerEvents = 'none';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '9998';
    overlay.style.background = 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%)';
    overlay.style.backgroundSize = '100% 4px';
    overlay.style.animation = 'scanline 10s linear infinite';
    document.body.appendChild(overlay);

    const style = document.createElement('style');
    style.textContent = `
      @keyframes scanline { 0% { background-position: 0 0; } 100% { background-position: 0 100%; } }
      @keyframes breathe { 0%, 100% { box-shadow: 0 0 15px rgba(6, 182, 212, 0.15); border-color: rgba(6, 182, 212, 0.3); } 50% { box-shadow: 0 0 25px rgba(6, 182, 212, 0.3); border-color: rgba(6, 182, 212, 0.6); } }
      @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      .animate-marquee { animation: marquee 20s linear infinite; }
      .ambient-card { animation: breathe 4s ease-in-out infinite; transition: transform 0.2s, box-shadow 0.2s; position: relative; overflow: hidden; }
      .ambient-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(6, 182, 212, 0.15) 0%, transparent 50%); opacity: 0; transition: opacity 0.3s; pointer-events: none; z-index: 1; }
      .ambient-card:hover::before { opacity: 1; }
      .ambient-card:hover { transform: translateY(-2px); z-index: 2; }
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('mousemove', (e) => {
    const cards = document.querySelectorAll('.ambient-card');
    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
      card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
    });
  });
}

// ============================================================================
// 2. RENDER LAYOUT
// ============================================================================
function renderHomeLayout() {
  const appContent = document.getElementById('app-content');
  if (!appContent) return;

  appContent.innerHTML = `
    <div class="max-w-7xl mx-auto space-y-6 animate-fade-in relative z-10">
      
      <!-- LIVE TICKER -->
      <div class="bg-gray-900/80 backdrop-blur border border-cyan-500/30 rounded-lg overflow-hidden h-10 relative flex items-center shadow-[0_0_15px_rgba(6,182,212,0.2)]">
        <div class="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-gray-900 to-transparent z-10"></div>
        <div class="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-gray-900 to-transparent z-10"></div>
        <div class="whitespace-nowrap animate-marquee flex items-center gap-8 px-4">
          <span class="text-cyan-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2 shrink-0">
            <span class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span> Live Feed
          </span>
          <span id="ticker-content" class="text-gray-300 text-sm font-mono shrink-0">Loading feed...</span>
          <!-- Duplicate for seamless loop -->
          <span class="text-cyan-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2 shrink-0">
            <span class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span> Live Feed
          </span>
          <span id="ticker-content-dup" class="text-gray-300 text-sm font-mono shrink-0">Loading feed...</span>
        </div>
      </div>

      <!-- Welcome Header with Stats & Community Hub -->
      <div class="text-center py-8 relative">
        <div class="absolute top-0 right-0 flex items-center gap-2 text-xs text-green-400 bg-green-900/20 px-3 py-1 rounded-full border border-green-500/30">
          <span class="relative flex h-2 w-2"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>
          System Online
        </div>
        <h1 class="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 glow mb-4 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
          WELCOME TO ROM
        </h1>
        <p class="text-gray-400 text-lg max-w-2xl mx-auto mb-6">
          The ultimate hub for retro online multiplayer. Connect, compete, and relive the golden age of gaming.
        </p>
        
        <!-- TOP ROW: Stats + Social + Online -->
        <div class="flex flex-col lg:flex-row justify-center items-center gap-6 mb-8">
          
          <!-- Stats Counters -->
          <div class="flex flex-wrap justify-center gap-3 text-sm md:gap-8 md:text-base">
            <div class="bg-gray-800/50 px-4 py-2 rounded-lg border border-gray-700">
              <span class="block text-2xl font-bold text-cyan-400" id="stat-games">-</span>
              <span class="text-gray-500 text-xs uppercase">Games</span>
            </div>
            <div class="bg-gray-800/50 px-4 py-2 rounded-lg border border-gray-700">
              <span class="block text-2xl font-bold text-purple-400" id="stat-users">-</span>
              <span class="text-gray-500 text-xs uppercase">Members</span>
            </div>
            <div class="bg-gray-800/50 px-4 py-2 rounded-lg border border-gray-700">
              <span class="block text-2xl font-bold text-green-400" id="stat-online">-</span>
              <span class="text-gray-500 text-xs uppercase" title="Signed-in website members seen in the last five minutes">Online Members</span>
            </div>
            <div class="bg-gray-800/50 px-4 py-2 rounded-lg border border-gray-700">
              <span class="block text-2xl font-bold text-indigo-400" id="stat-live-players">-</span>
              <span class="text-gray-500 text-xs uppercase" title="Sum of recent player counts from active game services; upstream sources may overlap">Players Reported Online</span>
            </div>
            <div class="bg-gray-800/50 px-4 py-2 rounded-lg border border-gray-700">
              <span class="block text-2xl font-bold text-indigo-400" id="stat-bot-lfg">-</span>
              <span class="text-gray-500 text-xs uppercase">Discord LFG</span>
            </div>
          </div>

          <!-- Social Links (Moved Up) -->
          <div class="flex flex-wrap items-start justify-center gap-3">
            <a id="discord-link" href="#" target="_blank" class="ambient-card flex items-center gap-2 bg-[#5865F2]/10 hover:bg-[#5865F2]/20 border border-[#5865F2]/30 px-4 py-2 rounded-lg transition group">
              <div class="text-xl">💬</div>
              <div class="text-left">
                <div class="text-white font-bold text-xs group-hover:text-[#5865F2]">Join Discord</div>
                <div class="text-[10px] text-gray-400">Chat & Support</div>
              </div>
            </a>
            <a id="patreon-link" href="#" target="_blank" class="ambient-card flex items-center gap-2 bg-[#F96854]/10 hover:bg-[#F96854]/20 border border-[#F96854]/30 px-4 py-2 rounded-lg transition group">
              <div class="text-xl">❤️</div>
              <div class="text-left">
                <div class="text-white font-bold text-xs group-hover:text-[#F96854]">Support ROM</div>
                <div class="text-[10px] text-gray-400">Keep us running</div>
              </div>
            </a>
          </div>

          <!-- Who's Online Mini (Moved Up) -->
          <div class="ambient-card bg-gray-800 rounded-lg border border-gray-700 shadow-lg overflow-hidden min-w-[200px]">
            <div class="bg-gray-900/50 p-2 border-b border-gray-700 flex justify-between items-center">
              <h3 class="font-bold text-white text-xs flex items-center gap-2">
                <span class="relative flex h-2 w-2"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>
                Online Now
              </h3>
              <span id="online-count-mini" class="text-[10px] bg-green-900 text-green-300 px-1.5 py-0.5 rounded-full">0</span>
            </div>
            <div id="online-users-list-mini" class="p-2 max-h-32 overflow-y-auto custom-scrollbar"></div>
          </div>
        </div>
      </div>

      <!-- Main Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <!-- LEFT COLUMN -->
        <div class="lg:col-span-2 space-y-8">
          
          <!-- Game of the Week -->
          <div class="ambient-card bg-gradient-to-br from-purple-900/40 to-gray-800 rounded-xl overflow-hidden border border-purple-500/40 shadow-lg shadow-purple-900/20 flex flex-col relative group">
            <div class="absolute top-0 right-0 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg z-10 shadow-lg">
              🏆 GAME OF THE WEEK
            </div>
            <div id="gotw-content" class="flex-1 flex flex-col">
              <div class="p-8 text-center text-gray-500">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mb-2"></div>
                <p>Selecting champion...</p>
              </div>
            </div>
          </div>

          <!-- Clip of the Week (Moved Up) -->
          <div class="ambient-card bg-gray-800 rounded-xl overflow-hidden border border-pink-500/30 shadow-lg shadow-pink-900/20 flex flex-col">
            <div class="bg-gradient-to-r from-pink-900/50 to-red-900/50 p-4 border-b border-pink-500/30">
              <h2 id="clip-title" class="text-xl font-bold text-pink-300 flex items-center gap-2">
                <span class="text-2xl">🎬</span> Community Highlights
              </h2>
            </div>
            <div class="relative aspect-video bg-black">
              <iframe id="clip-iframe" class="absolute top-0 left-0 w-full h-full" src="" frameborder="0" allowfullscreen></iframe>
            </div>
          </div>

          <!-- Currently Hot -->
          <div class="ambient-card overflow-hidden rounded-xl border border-green-500/30 bg-gray-800 shadow-lg shadow-green-900/20">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-green-500/30 bg-gradient-to-r from-green-950/70 to-cyan-950/50 p-4">
              <div>
                <h2 class="flex items-center gap-2 text-xl font-bold text-green-200">
                  <span class="relative flex h-3 w-3">
                    <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                    <span class="relative inline-flex h-3 w-3 rounded-full bg-green-400"></span>
                  </span>
                  Currently Hot
                </h2>
                <p class="mt-1 text-xs text-gray-400">Games active in ROM lobbies or tracked networks</p>
              </div>
              <a href="#/live-lobbies" class="rounded-lg border border-green-500/30 px-3 py-2 text-xs font-bold text-green-200 hover:bg-green-900/40">View live lobbies</a>
            </div>
            <div id="currently-hot-games" class="space-y-2 p-4" aria-live="polite">
              <p class="text-sm text-gray-400">Checking live activity…</p>
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN -->
        <div class="space-y-6">

          <!-- Decomp Community Hub -->
          <section class="ambient-card overflow-hidden rounded-xl border border-purple-500/40 bg-gradient-to-br from-purple-950/80 via-gray-900 to-gray-800 shadow-lg shadow-purple-900/20">
            <div class="border-b border-purple-500/30 p-4">
              <h2 class="text-lg font-bold text-purple-200">🧩 Decomp Community Hub</h2>
              <p class="mt-1 text-xs leading-relaxed text-gray-300">Discover community-led game decompilation projects and help bring their player communities together.</p>
            </div>
            <div id="home-decomp-projects" class="space-y-2 p-4">
              <p class="text-sm text-gray-400">Loading approved projects…</p>
            </div>
            <div class="flex flex-wrap gap-2 border-t border-gray-700 p-4">
              <a href="#/games" class="rounded-lg border border-gray-600 px-3 py-2 text-xs font-bold text-gray-200 hover:border-purple-400">Browse games</a>
              <a href="#/submit-game?tab=decomp" class="rounded-lg bg-purple-700 px-3 py-2 text-xs font-bold text-white hover:bg-purple-600">Submit a project</a>
            </div>
          </section>
          
          <!-- Top Players (Leaderboard Preview) -->
          <div class="ambient-card bg-gray-800 rounded-xl border border-yellow-500/30 shadow-lg shadow-yellow-900/10 overflow-hidden">
            <div class="bg-gradient-to-r from-yellow-900/40 to-gray-900/50 p-4 border-b border-yellow-500/30 flex justify-between items-center">
              <h3 class="font-bold text-yellow-300 flex items-center gap-2">
                <span class="text-xl">👑</span> Top Players
              </h3>
              <a href="#/site-xp-leaderboard" class="text-[10px] text-yellow-400 hover:text-yellow-200 underline">View All</a>
            </div>
            <div id="home-leaderboard-preview" class="p-2 space-y-2">
              <div class="animate-pulse text-gray-500 text-xs text-center py-4">Calculating rankings...</div>
            </div>
          </div>

          <!-- Live Activity -->
          <div class="ambient-card bg-gray-800 rounded-xl border border-gray-700 shadow-lg overflow-hidden">
            <div class="bg-gray-900/50 p-4 border-b border-gray-700">
              <h3 class="font-bold text-white flex items-center gap-2">
                <span class="text-yellow-400">⚡</span> Live Activity
              </h3>
            </div>
            <div id="activity-feed" class="p-4 space-y-4"></div>
          </div>

          <!-- Community Spotlight (Moved to bottom or kept if space) -->
          <div class="ambient-card bg-gray-800 rounded-xl border border-yellow-500/30 shadow-lg shadow-yellow-900/10 overflow-hidden">
            <div class="bg-gradient-to-r from-yellow-900/40 to-gray-900/50 p-4 border-b border-yellow-500/30">
              <h3 class="font-bold text-yellow-300 flex items-center gap-2">
                <span class="text-xl">⭐</span> Member Spotlight
              </h3>
            </div>
            <div id="spotlight-content" class="p-4 text-center">
              <div class="animate-pulse text-gray-500 text-sm">Finding standout member...</div>
            </div>
          </div>

        </div>
      </div>

      <!-- SEO Text Block -->
      <div class="mt-12 pt-8 border-t border-gray-800 text-gray-500 text-sm leading-relaxed">
        <h2 class="text-gray-400 font-bold mb-2 text-lg">About Retro Online Matchmaking</h2>
        <p class="mb-4">
          ROM is the premier destination for playing classic retro games online. Whether you're looking to play <strong>SOCOM II</strong> on PS2, <strong>Twisted Metal: Black</strong> on PS2, or <strong>Tekken 5 Dark Ressurection</strong> on PSP, our community provides the servers, lobbies, and guides to get you connected. 
          We support a wide range of consoles including PlayStation, Xbox, Nintendo, and PC classics. Join thousands of players who are keeping the retro multiplayer dream alive.
        </p>
      </div>

      <!-- Radio Reminder -->
      <div class="text-center py-6 border-t border-gray-800">
        <p class="text-gray-500 text-sm flex items-center justify-center gap-2">
          <span class="animate-pulse w-2 h-2 bg-red-500 rounded-full"></span>
          Don't forget to turn on <strong class="text-cyan-400">Vivi_Gaming Radio</strong> in the bottom right corner! 📻
        </p>
      </div>

    </div>
  `;
}

// ============================================================================
// 3. DATA LOADERS
// ============================================================================

async function loadStats() {
  try {
    const [gamesRes, usersRes, botStatsRes] = await Promise.all([
      supabase.from('games').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('discord_bot_public_stats')
        .select('active_invite_count')
        .eq('scope_key', 'global')
        .maybeSingle()
    ]);

    if (gamesRes.error) throw gamesRes.error;
    if (usersRes.error) throw usersRes.error;
    const gameCount = gamesRes.count || 0;
    const userCount = usersRes.count || 0;

    animateValue("stat-games", 0, gameCount, 1500);
    animateValue("stat-users", 0, userCount, 1500);
    if (!botStatsRes.error && botStatsRes.data) {
      animateValue("stat-bot-lfg", 0, botStatsRes.data.active_invite_count || 0, 1500);
    } else if (botStatsRes.error) {
      console.error('Discord LFG stats error:', botStatsRes.error);
    }
    await loadLivePlayerCount();
  } catch (error) {
    console.error('Stats error:', error);
  }
}

async function loadLivePlayerCount() {
  const cutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  const pageSize = 500;
  let offset = 0;
  let playerCount = 0;

  while (true) {
    const { data, error } = await supabase
      .from('discord_live_services')
      .select('players_online')
      .eq('is_active', true)
      .gte('updated_at', cutoff)
      .range(offset, offset + pageSize - 1);
    if (error) throw error;

    playerCount += (data || []).reduce((total, service) =>
      total + Math.max(0, Number(service.players_online) || 0), 0);
    if (!data || data.length < pageSize) break;
    offset += pageSize;
    if (offset > 50000) throw new Error('Live service player count exceeded the safety limit.');
  }
  animateValue('stat-live-players', 0, playerCount, 1000);
}

async function loadCurrentlyHot() {
  const container = document.getElementById('currently-hot-games');
  if (!container) return;

  try {
    const roomCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const serviceCutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const pageSize = 500;
    const rooms = [];
    const services = [];

    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from('chat_rooms')
        .select('id, game_id')
        .eq('is_ephemeral', true)
        .gte('last_activity', roomCutoff)
        .order('last_activity', { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      rooms.push(...(data || []));
      if (!data || data.length < pageSize) break;
      if (offset >= 50000) throw new Error('Active ROM lobbies exceeded the 50,000-row safety limit.');
    }

    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from('discord_live_services')
        .select('service_name, game_title, console, players_online, updated_at')
        .eq('is_active', true)
        .gte('updated_at', serviceCutoff)
        .gt('players_online', 0)
        .order('updated_at', { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      services.push(...(data || []));
      if (!data || data.length < pageSize) break;
      if (offset >= 50000) throw new Error('Active tracked services exceeded the 50,000-row safety limit.');
    }

    const gameIds = [...new Set(rooms.map(room => room.game_id).filter(Boolean))];
    const trackedTitles = [...new Set(services.map(service => service.game_title).filter(Boolean))];
    const games = [];

    for (let offset = 0; offset < gameIds.length; offset += 100) {
      const { data, error } = await supabase
        .from('games')
        .select('id, slug, title, console')
        .in('id', gameIds.slice(offset, offset + 100))
        .eq('status', 'approved');
      if (error) throw error;
      games.push(...(data || []));
    }

    for (let offset = 0; offset < trackedTitles.length; offset += 100) {
      const { data, error } = await supabase
        .from('games')
        .select('id, slug, title, console')
        .in('title', trackedTitles.slice(offset, offset + 100))
        .eq('status', 'approved');
      if (error) throw error;
      games.push(...(data || []));
    }

    const uniqueGames = new Map(games.map(game => [game.id, game]));
    const gamesByTitle = new Map();
    for (const game of uniqueGames.values()) {
      const key = normalizeLiveGameTitle(game.title);
      if (!gamesByTitle.has(key)) gamesByTitle.set(key, []);
      gamesByTitle.get(key).push(game);
    }

    const hotGames = new Map();
    const getEntry = (game, fallbackTitle, fallbackConsole = '') => {
      const title = game?.title || fallbackTitle || 'Unknown game';
      const consoleName = game?.console || fallbackConsole || '';
      const key = game?.id || `${normalizeLiveGameTitle(title)}|${normalizeLiveGameTitle(consoleName)}`;
      if (!hotGames.has(key)) {
        hotGames.set(key, {
          game,
          title,
          console: consoleName,
          roomCount: 0,
          servicePlayers: 0,
          services: new Set(),
        });
      }
      return hotGames.get(key);
    };

    const gamesById = new Map(uniqueGames);
    for (const room of rooms) {
      const game = gamesById.get(room.game_id);
      if (!game) continue;
      getEntry(game).roomCount += 1;
    }

    for (const service of services) {
      const titleMatches = gamesByTitle.get(normalizeLiveGameTitle(service.game_title)) || [];
      const consoleMatches = titleMatches.filter(game =>
        normalizeLiveGameTitle(game.console) === normalizeLiveGameTitle(service.console)
      );
      const game = consoleMatches[0] || (titleMatches.length === 1 ? titleMatches[0] : null);
      const entry = getEntry(game, service.game_title, service.console);
      entry.servicePlayers += Math.max(0, Number(service.players_online) || 0);
      if (service.service_name) entry.services.add(service.service_name);
    }

    const rankedGames = [...hotGames.values()]
      .sort((a, b) =>
        ((b.servicePlayers + b.roomCount) - (a.servicePlayers + a.roomCount)) ||
        (b.servicePlayers - a.servicePlayers) ||
        a.title.localeCompare(b.title)
      )
      .slice(0, 10);

    if (!rankedGames.length) {
      container.innerHTML = '<p class="py-5 text-center text-sm text-gray-400">No active games reported right now. Start a ROM game lobby or check back when tracked networks have players online.</p>';
      return;
    }

    container.innerHTML = rankedGames.map((entry, index) => {
      const gameHref = entry.game
        ? `#/game/${encodeURIComponent(entry.game.slug || entry.game.id)}`
        : '#/live-lobbies';
      const indicators = [];
      if (entry.servicePlayers) {
        indicators.push(`<span class="rounded-full border border-green-500/20 bg-green-950/50 px-2 py-1 text-[11px] text-green-200">${entry.servicePlayers.toLocaleString()} tracked</span>`);
      }
      if (entry.roomCount) {
        indicators.push(`<span class="rounded-full border border-cyan-500/20 bg-cyan-950/50 px-2 py-1 text-[11px] text-cyan-200">${entry.roomCount} ROM ${entry.roomCount === 1 ? 'lobby' : 'lobbies'}</span>`);
      }
      const serviceNames = [...entry.services].sort().join(', ');
      const consoleLabel = entry.console
        ? `<span class="mt-0.5 block truncate text-[10px] text-gray-500">${escapeTickerHTML(entry.console)}</span>`
        : '';
      return `
        <a href="${gameHref}" class="flex items-center gap-3 rounded-lg border border-gray-700/80 bg-gray-950/60 p-3 transition hover:border-green-500/50 hover:bg-gray-900">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-800 text-sm font-black ${index < 3 ? 'text-green-300' : 'text-gray-400'}">${index + 1}</span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-bold text-white">${escapeTickerHTML(entry.title)}</span>
            ${consoleLabel}
            <span class="mt-1 flex flex-wrap gap-1.5">${indicators.join('')}</span>
            ${serviceNames ? `<span class="mt-1 block truncate text-[10px] text-gray-500">${escapeTickerHTML(serviceNames)}</span>` : ''}
          </span>
          <span class="shrink-0 text-lg text-green-300" aria-label="Active">●</span>
        </a>`;
    }).join('') + '<p class="pt-2 text-[10px] leading-relaxed text-gray-500">Tracked player totals are reported by external services and may overlap across networks.</p>';
  } catch (error) {
    console.error('Could not load currently hot games:', error);
    container.innerHTML = '<p class="rounded-lg border border-amber-800/60 bg-amber-950/30 p-4 text-sm text-amber-200">Live game activity is temporarily unavailable.</p>';
  }
}

function normalizeLiveGameTitle(value) {
  return String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function scheduleCurrentlyHotRefresh() {
  clearTimeout(currentlyHotRefreshTimeout);
  currentlyHotRefreshTimeout = setTimeout(() => void loadCurrentlyHot(), 500);
}

function animateValue(id, start, end, duration) {
  const obj = document.getElementById(id);
  if (!obj) return;
  const currentValue = Number(obj.textContent.replaceAll(',', ''));
  if (Number.isFinite(currentValue)) start = currentValue;
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    obj.innerHTML = Math.floor(progress * (end - start) + start).toLocaleString();
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

async function loadSiteSettings() {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['clip_title', 'clip_youtube_id', 'discord_url', 'patreon_url']);

    if (error) throw error;
    const settings = {};
    if (Array.isArray(data)) data.forEach(s => settings[s.key] = s.value);

    const rawId = settings.clip_youtube_id || 'ujuGjJ1W6jg';
    const cleanId = rawId.replace(/.*(?:youtu\.be\/|v\/|u\/\w+\/|embed\/|watch\?v=|&v=|\/shorts\/)([^#&?]{11}).*/, '$1').trim() || 'dQw4w9WgXcQ';

    const titleEl = document.getElementById('clip-title');
    const iframeEl = document.getElementById('clip-iframe');
    
    if (titleEl) titleEl.innerHTML = `<span class="text-2xl">🎬</span> ${settings.clip_title || 'ROM Community Highlights'}`;
    if (iframeEl) iframeEl.src = `https://www.youtube.com/embed/${cleanId}?rel=0&modestbranding=1&autoplay=0`;
    
    ['discord', 'patreon'].forEach(key => {
      const el = document.getElementById(`${key}-link`);
      if (el) {
        const url = (settings[`${key}_url`] || `https://${key}.com`).trim();
        el.href = url !== 'https://.com' ? url : '#';
      }
    });
  } catch (error) {
    console.error('Site settings error:', error);
  }
}

// UPDATED: Game of the Week Logic (Persists for 7 Days)
async function loadGameOfTheWeek() {
  const container = document.getElementById('gotw-content');
  if (!container) return;

  try {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNum = Math.ceil((((now - startOfYear) / 86400000) + startOfYear.getDay() + 1) / 7);
    const year = now.getFullYear();
    const seedKey = `gotw_${year}_week_${weekNum}`;

    // 1. Check if we already picked a game for this week
    const { data: storedSetting } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', seedKey)
      .single();

    let selectedGame = null;

    if (storedSetting && storedSetting.value) {
      // Fetch the stored game ID
      const gameId = storedSetting.value;
      const { data: game } = await supabase.from('games').select('*').eq('id', gameId).single();
      selectedGame = game;
    }

    // 2. If no game found (new week), pick a random one and save it
    if (!selectedGame) {
      const { count } = await supabase.from('games').select('*', { count: 'exact', head: true }).eq('status', 'approved');
      if (!count || count === 0) return;

      const randomOffset = Math.floor(Math.random() * count);
      const { data: randomGame } = await supabase
        .from('games')
        .select('*')
        .eq('status', 'approved')
        .range(randomOffset, randomOffset)
        .single();

      if (randomGame) {
        selectedGame = randomGame;
        // Save to DB
        await supabase.from('site_settings').upsert({ key: seedKey, value: randomGame.id });
      }
    }

    if (selectedGame) {
      renderGameCard(selectedGame, container, true);
    } else {
      container.innerHTML = `<div class="p-8 text-center text-gray-500">No featured game this week.</div>`;
    }

  } catch (error) {
    console.error('Game of the week error:', error);
  }
}

function renderGameCard(game, container, isFeatured = false) {
  const coverUrl = game.cover_image_url || 'https://via.placeholder.com/400x220/1f2937/06b6d4?text=No+Cover';
  const gameLink = game.slug ? `#/game/${game.slug}` : `#/game/${game.id}`;
  const themeClass = isFeatured ? 'from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-500/40' : 'from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-cyan-500/40';

  container.innerHTML = `
    <div class="relative h-56 w-full overflow-hidden group">
      <img src="${coverUrl}" alt="${game.title}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700">
      <div class="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent"></div>
      ${isFeatured ? '<div class="absolute top-4 left-4 px-3 py-1 bg-yellow-500 text-black text-xs font-black rounded-full uppercase tracking-wider shadow-lg animate-pulse">🏆 Game of the Week</div>' : ''}
      <div class="absolute bottom-4 left-4">
        <span class="px-3 py-1 bg-gray-900/80 backdrop-blur text-white text-xs font-bold rounded border border-gray-600">${game.console}</span>
      </div>
    </div>
    <div class="p-6 flex-1 flex flex-col justify-between">
      <div>
        <h3 class="text-2xl font-bold text-white mb-2 line-clamp-1 drop-shadow-md">${game.title}</h3>
        <p class="text-gray-400 text-sm line-clamp-3 mb-4">${game.description || 'No description available.'}</p>
        <div class="flex flex-wrap gap-2 mb-4">
          <span class="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded border border-gray-600">${game.multiplayer_type || 'Multiplayer'}</span>
          ${game.year ? `<span class="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded border border-gray-600">${game.year}</span>` : ''}
          ${game.rating > 0 ? `<span class="px-2 py-1 bg-yellow-900/30 text-yellow-400 text-xs rounded border border-yellow-700/50">★ ${game.rating.toFixed(1)}</span>` : ''}
        </div>
      </div>
      <a href="${gameLink}" class="w-full block text-center py-3 bg-gradient-to-r ${themeClass} text-white font-bold rounded-lg transition transform hover:-translate-y-1 shadow-lg">
        ${isFeatured ? 'View Featured Game' : 'View Game Details'}
      </a>
    </div>
  `;
}

async function loadOnlineUsers() {
  const listEl = document.getElementById('online-users-list');
  const countEl = document.getElementById('online-count');
  const statEl = document.getElementById('stat-online');
  
  // Also target the mini version in the new layout
  const miniListEl = document.getElementById('online-users-list-mini');
  const miniCountEl = document.getElementById('online-count-mini');

  if (!listEl && !miniListEl) return;

  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const [countResult, usersResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('last_seen', fiveMinutesAgo),
      supabase
        .from('profiles')
        .select('id, username, avatar_url, last_seen')
        .gte('last_seen', fiveMinutesAgo)
        .order('last_seen', { ascending: false })
        .limit(10),
    ]);
    if (countResult.error) throw countResult.error;
    if (usersResult.error) throw usersResult.error;

    const count = countResult.count || 0;
    const users = usersResult.data || [];
    if(countEl) countEl.textContent = count;
    if(miniCountEl) miniCountEl.textContent = count;
    if(statEl) animateValue("stat-online", 0, count, 1000);

    if (!users || count === 0) {
      const emptyHtml = `<div class="text-center text-gray-500 text-sm py-4">No one online right now.</div>`;
      if(listEl) listEl.innerHTML = emptyHtml;
      if(miniListEl) miniListEl.innerHTML = emptyHtml;
      return;
    }

    const generateHtml = (isMini) => users.map(user => {
      const link = user.username ? `#/profile/${user.username}` : `#/profile/${user.id}`;
      const avatar = user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}&background=06b6d4&color=fff`;
      const textSize = isMini ? 'text-xs' : 'text-sm';
      const imgSize = isMini ? 'w-8 h-8' : 'w-10 h-10';
      
      return `
        <a href="${link}" class="flex items-center gap-2 p-1.5 hover:bg-gray-700/50 rounded-lg transition group relative z-10">
          <div class="relative">
            <img src="${avatar}" class="${imgSize} rounded-full border border-gray-600 group-hover:border-cyan-400 transition shadow-md">
            <span class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-gray-800 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.8)]"></span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-white ${textSize} font-bold truncate group-hover:text-cyan-400 drop-shadow-sm">${user.username}</div>
            ${!isMini ? '<div class="text-[10px] text-green-400">Online</div>' : ''}
          </div>
        </a>
      `;
    }).join('');

    if(listEl) listEl.innerHTML = generateHtml(false);
    if(miniListEl) miniListEl.innerHTML = generateHtml(true);

  } catch (error) {
    console.error('Online users error:', error);
  }
}

async function loadCommunitySpotlight() {
  const container = document.getElementById('spotlight-content');
  if (!container) return;

  try {
    const { count, error: countErr } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).not('username', 'is', null);
    
    if (countErr || count === 0) {
      container.innerHTML = `<div class="text-gray-500 text-sm">No members to spotlight yet.</div>`;
      return;
    }

    const offset = Math.floor(Math.random() * count);
    const { data: user, error } = await supabase
      .from('profiles')
      .select('username, avatar_url, bio')
      .not('username', 'is', null)
      .range(offset, offset)
      .single();

    if (error || !user) return;

    const link = `#/profile/${user.username}`;
    const avatar = user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}&background=FBBF24&color=000`;

    container.innerHTML = `
      <a href="${link}" class="group block">
        <div class="relative inline-block mb-3">
          <img src="${avatar}" alt="${user.username}" class="w-20 h-20 rounded-full border-2 border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.4)] group-hover:scale-110 transition-transform">
          <div class="absolute -bottom-1 -right-1 bg-yellow-500 text-black text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">★</div>
        </div>
        <h4 class="text-white font-bold text-lg group-hover:text-yellow-400 transition">${user.username}</h4>
        <p class="text-gray-400 text-xs mt-1 line-clamp-2 italic">"${user.bio || 'Active community member'}"</p>
        <button class="mt-3 text-xs bg-gray-700 hover:bg-yellow-600 hover:text-black text-gray-300 px-3 py-1 rounded-full transition font-bold">View Profile</button>
      </a>
    `;

  } catch (error) {
    console.error('Spotlight error:', error);
  }
}

async function loadDecompSpotlight() {
  const container = document.getElementById('home-decomp-projects');
  if (!container) return;
  try {
    const { data: games, error } = await supabase
      .from('games')
      .select('id, slug, title, description, github_url')
      .eq('status', 'approved')
      .eq('console', 'Decomps')
      .order('approved_at', { ascending: false })
      .limit(3);
    if (error) throw error;

    container.replaceChildren();
    if (!games?.length) {
      const empty = document.createElement('p');
      empty.className = 'text-sm text-gray-400';
      empty.textContent = 'No projects are listed yet. Submit a project and help kick off the hub.';
      container.appendChild(empty);
      return;
    }

    for (const game of games) {
      const link = document.createElement('a');
      link.href = `#/game/${encodeURIComponent(game.slug || game.id)}`;
      link.className = 'block rounded-lg border border-gray-700 bg-gray-950/60 p-3 hover:border-purple-400';
      const title = document.createElement('span');
      title.className = 'block truncate text-sm font-bold text-white';
      title.textContent = game.title || 'Untitled project';
      link.appendChild(title);
      if (game.description) {
        const description = document.createElement('span');
        description.className = 'mt-1 block line-clamp-2 text-xs text-gray-400';
        description.textContent = game.description;
        link.appendChild(description);
      }
      if (game.github_url) {
        const repo = document.createElement('span');
        repo.className = 'mt-2 block text-[10px] text-cyan-300';
        repo.textContent = 'View project details ↗';
        link.appendChild(repo);
      }
      container.appendChild(link);
    }
  } catch (error) {
    console.error('Could not load Decomp projects for home:', error);
    container.innerHTML = '<p class="text-sm text-amber-300">Project listings are temporarily unavailable. You can still submit a project.</p>';
  }
}

async function loadRecentActivity() {
  const feedEl = document.getElementById('activity-feed');
  if (!feedEl) return;

  try {
    const { data: latestGame } = await supabase
      .from('games')
      .select('title, slug, approved_at')
      .eq('status', 'approved')
      .order('approved_at', { ascending: false })
      .limit(1)
      .single();

    const { data: latestUser } = await supabase
      .from('profiles')
      .select('username, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const activities = [];
    if (latestGame) activities.push({ type: 'game', text: `New game: <strong>${latestGame.title}</strong>`, time: latestGame.approved_at, icon: '🎮', color: 'text-cyan-400', link: `#/game/${latestGame.slug || latestGame.id}` });
    if (latestUser) activities.push({ type: 'user', text: `<strong>${latestUser.username}</strong> joined`, time: latestUser.created_at, icon: '👤', color: 'text-purple-400', link: `#/profile/${latestUser.username || latestUser.id}` });

    if (activities.length === 0) {
      feedEl.innerHTML = `<div class="text-center text-gray-500 text-sm">No recent activity.</div>`;
      return;
    }

    activities.sort((a, b) => new Date(b.time) - new Date(a.time));

    feedEl.innerHTML = activities.slice(0, 5).map(act => `
      <div class="flex gap-3 items-start relative z-10">
        <div class="mt-1 ${act.color} text-lg drop-shadow-md">${act.icon}</div>
        <div class="flex-1">
          <div class="text-gray-300 text-sm leading-tight">
            <a href="${act.link}" class="hover:text-white hover:underline transition decoration-cyan-500 underline-offset-4">${act.text}</a>
          </div>
          <div class="text-xs text-gray-500 mt-1">${new Date(act.time).toLocaleDateString()}</div>
        </div>
      </div>
    `).join('');

  } catch (error) {
    console.error('Activity feed error:', error);
  }
}

// NEW: Leaderboard Preview Loader
async function loadHomeLeaderboardPreview() {
  const container = document.getElementById('home-leaderboard-preview');
  if (!container) return;

  try {
    const { data: users, error } = await supabase
      .from('profiles')
      .select(`
        id,
        username,
        avatar_url,
        xp_total,
        rank:user_ranks (name, color)
      `)
      .order('xp_total', { ascending: false })
      .limit(5);

    if (error || !users || users.length === 0) {
      container.innerHTML = `<div class="text-center text-gray-500 text-xs py-4">No rankings yet.</div>`;
      return;
    }

    const medals = ['🥇', '🥈', '🥉', '🏅', '🏅'];
    
    container.innerHTML = users.map((user, index) => {
      const link = user.username ? `#/profile/${user.username}` : `#/profile/${user.id}`;
      const avatar = user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}&background=06b6d4&color=fff`;
      const medal = medals[index] || '•';
      const isTop3 = index < 3;
      
      return `
        <a href="${link}" class="flex items-center gap-3 p-2 hover:bg-gray-700/50 rounded-lg transition group">
          <div class="w-6 text-center text-lg font-bold ${isTop3 ? 'text-yellow-400' : 'text-gray-500'}">${medal}</div>
          <img src="${avatar}" class="w-8 h-8 rounded-full border border-gray-600 group-hover:border-cyan-400 transition">
          <div class="flex-1 min-w-0">
            <div class="text-white text-xs font-bold truncate group-hover:text-cyan-400">${user.username}</div>
            <div class="text-[10px] text-cyan-400 font-mono">${user.xp_total.toLocaleString()} XP</div>
          </div>
        </a>
      `;
    }).join('');

  } catch (err) {
    console.error('Leaderboard preview error:', err);
    container.innerHTML = `<div class="text-center text-red-400 text-xs py-4">Error loading ranks.</div>`;
  }
}

// ============================================================================
// 4. REALTIME LIVE FEED & DYNAMIC TICKER (LFG + TOURNAMENTS)
// ============================================================================

// Fetch LFG posts and Tournaments, then merge them into the global message queue
async function refreshDynamicTicker(rom) {
  try {
    // 1. Fetch LFG
    const { data: lfgData, error: lfgError } = await rom.supabase
      .from('lfg_posts')
      .select('posted_username, game_title, region')
      .eq('status', 'open')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    // 2. Fetch Tournaments (using the helper we created)
    const tourneyData = await getRecentTournamentsForTicker(rom);

    if (lfgError) throw lfgError;

    const newMessages = [];
    const { data: activeServices, error: servicesError } = await rom.supabase
      .from('discord_live_services')
      .select('service_name, game_title, players_online')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (servicesError) throw servicesError;

    // Process active games tracked by any connected service.
    (activeServices || []).forEach(service => {
      newMessages.push(
        `🎮 <strong>${escapeTickerHTML(service.game_title || 'Game')}</strong> is active via <strong>${escapeTickerHTML(service.service_name || 'Online service')}</strong> (${Math.max(0, Number(service.players_online) || 0)} reported online)`
      );
    });

    // Process LFG
    if (lfgData && lfgData.length > 0) {
      lfgData.forEach(post => {
        newMessages.push(`📡 <strong>${escapeTickerHTML(post.posted_username)}</strong> is looking for players in <strong>${escapeTickerHTML(post.game_title)}</strong> (${escapeTickerHTML(post.region)})`);
      });
    }

    // Process Tournaments
    if (tourneyData && tourneyData.length > 0) {
      tourneyData.forEach(t => {
        newMessages.push(t.text);
      });
    }

    if (newMessages.length > 0) {
      dynamicMessages = newMessages;
      console.log(`✅ Loaded ${dynamicMessages.length} dynamic messages (active games, LFG + tours) into ticker`);
    } else {
      dynamicMessages = [];
      console.log('ℹ️ No active games, LFG, or tournament posts for ticker');
    }
  } catch (err) {
    console.error('Error loading dynamic ticker:', err);
  }
}

function startRealtimeFeed(rom) {
  if (tickerDisplayInterval) clearInterval(tickerDisplayInterval);
  if (tickerRefreshInterval) clearInterval(tickerRefreshInterval);
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);

  // Initial Stats Load
  loadStats();
  if (homeStatsInterval) clearInterval(homeStatsInterval);
  homeStatsInterval = setInterval(loadStats, 60000);

  const tickerEl = document.getElementById('ticker-content');
  const tickerDup = document.getElementById('ticker-content-dup');
  if (!tickerEl) return;

  let msgIndex = 0;

  const getNextMessage = () => {
    // Prioritize dynamic messages (LFG/Tournaments) if they exist
    if (dynamicMessages.length > 0) {
      // 70% chance to show a dynamic message if available
      if (Math.random() > 0.3) {
        return dynamicMessages[Math.floor(Math.random() * dynamicMessages.length)];
      }
    }
    // Fallback to standard messages
    return standardMessages[msgIndex++ % standardMessages.length];
  };
  
  const updateTicker = () => {
    const nextMsg = getNextMessage();
    
    // Fade out
    tickerEl.style.opacity = '0';
    if(tickerDup) tickerDup.style.opacity = '0';
    
    setTimeout(() => {
      tickerEl.innerHTML = nextMsg;
      if(tickerDup) tickerDup.innerHTML = nextMsg;
      // Fade in
      tickerEl.style.opacity = '1';
      if(tickerDup) tickerDup.style.opacity = '1';
    }, 500);
  };
  
  // Start loop
  updateTicker();
  tickerDisplayInterval = setInterval(updateTicker, 6000);
  tickerRefreshInterval = setInterval(() => refreshDynamicTicker(rom), 60000);

  // Subscribe to Realtime Changes
  realtimeChannel = supabase.channel('live-feed');

  // Listen for New Games
  realtimeChannel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'games' }, (payload) => {
    if (payload.new.status === 'approved') {
      flashTicker(`🎮 New Game Added: ${escapeTickerHTML(payload.new.title)}`);
      loadRecentActivity();
      loadStats();
    }
  });

  // Listen for New Users
  realtimeChannel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, (payload) => {
    flashTicker(`👤 New Member: ${escapeTickerHTML(payload.new.username)}`);
    loadOnlineUsers();
    loadRecentActivity();
    loadStats();
  });

  // Listen for NEW LFG Posts
  realtimeChannel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lfg_posts' }, (payload) => {
    const post = payload.new;
    if (post.status === 'open') {
      const newMsg = `📡 <strong>${escapeTickerHTML(post.posted_username)}</strong> is looking for players in <strong>${escapeTickerHTML(post.game_title)}</strong> (${escapeTickerHTML(post.region)})`;
      dynamicMessages.unshift(newMsg);
      if (dynamicMessages.length > 10) dynamicMessages.pop(); 
      flashTicker(newMsg);
      console.log('🚀 New LFG post detected');
    }
  });

  // Listen for NEW Tournaments
  realtimeChannel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tournaments' }, (payload) => {
    const tour = payload.new;
    if (tour.status === 'open') {
      const newMsg = `🏆 <strong>${escapeTickerHTML(tour.organizer_username)}</strong> is hosting a <strong>${escapeTickerHTML(tour.game_title)}</strong> tournament: ${escapeTickerHTML(tour.title)}`;
      dynamicMessages.unshift(newMsg);
      if (dynamicMessages.length > 10) dynamicMessages.pop();
      flashTicker(newMsg);
      console.log('🚀 New Tournament detected');
    }
  });

  // Listen for Updates (Refresh list if something changes/expires)
  realtimeChannel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lfg_posts' }, () => {
    refreshDynamicTicker(rom);
  });
  
  realtimeChannel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tournaments' }, () => {
    refreshDynamicTicker(rom);
  });

  realtimeChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'discord_live_services' }, () => {
    refreshDynamicTicker(rom);
    scheduleCurrentlyHotRefresh();
  });

  realtimeChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' }, () => {
    scheduleCurrentlyHotRefresh();
  });

  realtimeChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'game_lobby_activity' }, () => {
    scheduleCurrentlyHotRefresh();
  });

  realtimeChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') console.log('✅ REALTIME SUBSCRIBED');
  });
}

function escapeTickerHTML(value) {
  const element = document.createElement('span');
  element.textContent = String(value ?? '');
  return element.innerHTML;
}

function flashTicker(text) {
  const tickerEl = document.getElementById('ticker-content');
  const tickerDup = document.getElementById('ticker-content-dup');
  if (!tickerEl) return;

  // Visual Flash Effect
  tickerEl.parentElement.classList.add('shadow-[0_0_20px_rgba(34,211,238,0.6)]', 'border-cyan-400');
  tickerEl.classList.add('text-cyan-200', 'font-bold');
  
  setTimeout(() => {
    tickerEl.parentElement.classList.remove('shadow-[0_0_20px_rgba(34,211,238,0.6)]', 'border-cyan-400');
    tickerEl.classList.remove('text-cyan-200', 'font-bold');
  }, 2000);

  // Text Update with Fade
  tickerEl.style.transition = 'opacity 0.3s';
  tickerEl.style.opacity = '0';
  if(tickerDup) tickerDup.style.opacity = '0';
  
  setTimeout(() => {
    tickerEl.innerHTML = text;
    if(tickerDup) tickerDup.innerHTML = text;
    tickerEl.style.opacity = '1';
    if(tickerDup) tickerDup.style.opacity = '1';
  }, 300);
}

window.addEventListener('beforeunload', () => {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  if (homeStatsInterval) clearInterval(homeStatsInterval);
  if (onlineUsersInterval) clearInterval(onlineUsersInterval);
  if (tickerDisplayInterval) clearInterval(tickerDisplayInterval);
  if (tickerRefreshInterval) clearInterval(tickerRefreshInterval);
});
