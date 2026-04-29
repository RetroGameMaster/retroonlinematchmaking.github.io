// modules/home/home.js - ENHANCED WITH LFG & TOURNAMENT TICKER
import { supabase } from '../../lib/supabase.js';
import { getRecentTournamentsForTicker } from '../tournaments/tournaments.js';

let realtimeChannel = null;
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
  loadFeaturedGame();
  loadGameOfTheWeek();
  loadOnlineUsers();
  loadRecentActivity();
  loadCommunitySpotlight();
  
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
      "@context": "https://schema.org ",
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

      <!-- Welcome Header with Stats -->
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
        
        <!-- Live Stats Counter -->
        <div class="flex justify-center gap-4 md:gap-8 text-sm md:text-base">
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
            <span class="text-gray-500 text-xs uppercase">Online</span>
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

          <!-- Random Pick -->
          <div class="ambient-card bg-gray-800 rounded-xl overflow-hidden border border-cyan-500/30 shadow-lg shadow-cyan-900/20 flex flex-col">
            <div class="bg-gradient-to-r from-cyan-900/50 to-blue-900/50 p-4 border-b border-cyan-500/30 flex justify-between items-center">
              <h2 class="text-xl font-bold text-cyan-300 flex items-center gap-2">
                <span class="text-2xl">🎲</span> Random Pick
              </h2>
              <span id="featured-game-status" class="text-xs text-gray-400 italic">Loading...</span>
            </div>
            <div id="featured-game-content" class="flex-1 flex flex-col"></div>
          </div>

          <!-- Clip of the Week -->
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
        </div>

        <!-- RIGHT COLUMN -->
        <div class="space-y-6">
          
          <!-- Who's Online -->
          <div class="ambient-card bg-gray-800 rounded-xl border border-gray-700 shadow-lg overflow-hidden">
            <div class="bg-gray-900/50 p-4 border-b border-gray-700 flex justify-between items-center">
              <h3 class="font-bold text-white flex items-center gap-2">
                <span class="relative flex h-2.5 w-2.5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span></span>
                Who's Online
              </h3>
              <span id="online-count" class="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded-full">0</span>
            </div>
            <div id="online-users-list" class="p-2 max-h-64 overflow-y-auto custom-scrollbar"></div>
          </div>

          <!-- Community Spotlight -->
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

          <!-- Live Activity -->
          <div class="ambient-card bg-gray-800 rounded-xl border border-gray-700 shadow-lg overflow-hidden">
            <div class="bg-gray-900/50 p-4 border-b border-gray-700">
              <h3 class="font-bold text-white flex items-center gap-2">
                <span class="text-yellow-400">⚡</span> Live Activity
              </h3>
            </div>
            <div id="activity-feed" class="p-4 space-y-4"></div>
          </div>

          <!-- Social Links -->
          <div class="grid grid-cols-1 gap-3">
            <a id="discord-link" href="#" target="_blank" class="ambient-card flex items-center gap-3 bg-[#5865F2]/10 hover:bg-[#5865F2]/20 border border-[#5865F2]/30 p-3 rounded-lg transition group">
              <div class="text-2xl">💬</div>
              <div>
                <div class="text-white font-bold text-sm group-hover:text-[#5865F2]">Join Discord</div>
                <div class="text-xs text-gray-400">Chat & Support</div>
              </div>
            </a>
            <a id="patreon-link" href="#" target="_blank" class="ambient-card flex items-center gap-3 bg-[#F96854]/10 hover:bg-[#F96854]/20 border border-[#F96854]/30 p-3 rounded-lg transition group">
              <div class="text-2xl">❤️</div>
              <div>
                <div class="text-white font-bold text-sm group-hover:text-[#F96854]">Support ROM</div>
                <div class="text-xs text-gray-400">Keep us running</div>
              </div>
            </a>
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
    const [gamesRes, usersRes] = await Promise.all([
      supabase.from('games').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('profiles').select('*', { count: 'exact', head: true })
    ]);

    const gameCount = gamesRes.count || 0;
    const userCount = usersRes.count || 0;

    animateValue("stat-games", 0, gameCount, 1500);
    animateValue("stat-users", 0, userCount, 1500);
  } catch (error) {
    console.error('Stats error:', error);
  }
}

function animateValue(id, start, end, duration) {
  const obj = document.getElementById(id);
  if (!obj) return;
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

async function loadFeaturedGame() {
  const container = document.getElementById('featured-game-content');
  const statusEl = document.getElementById('featured-game-status');
  if (!container) return;

  try {
    const { count, error: countError } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    if (countError || count === 0) {
       container.innerHTML = `<div class="p-8 text-center text-gray-500">No games available yet.</div>`;
       return;
    }

    const randomOffset = Math.floor(Math.random() * count);
    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'approved')
      .range(randomOffset, randomOffset)
      .single();

    if (error || !games) {
      const { data: fallback } = await supabase.from('games').select('*').eq('status', 'approved').limit(1).single();
      if(fallback) renderGameCard(fallback, container, statusEl, false);
    } else {
      renderGameCard(games, container, statusEl, false);
    }
  } catch (error) {
    console.error('Featured game error:', error);
  }
}

async function loadGameOfTheWeek() {
  const container = document.getElementById('gotw-content');
  if (!container) return;

  try {
    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'approved')
      .not('cover_image_url', 'is', null)
      .order('approved_at', { ascending: false })
      .limit(5);

    if (error || !games || games.length === 0) {
      container.innerHTML = `<div class="p-8 text-center text-gray-500">No featured game this week.</div>`;
      return;
    }

    const selected = games[Math.floor(Math.random() * games.length)];
    renderGameCard(selected, container, null, true);

  } catch (error) {
    console.error('Game of the week error:', error);
  }
}

function renderGameCard(game, container, statusEl, isFeatured = false) {
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
  if(statusEl) statusEl.textContent = isFeatured ? "This Week's Pick" : "Random Pick";
}

async function loadOnlineUsers() {
  const listEl = document.getElementById('online-users-list');
  const countEl = document.getElementById('online-count');
  const statEl = document.getElementById('stat-online');
  if (!listEl) return;

  try {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .gte('last_seen', twoMinutesAgo)
      .order('last_seen', { ascending: false })
      .limit(10);

    if (error) throw error;

    const count = users?.length || 0;
    if(countEl) countEl.textContent = count;
    if(statEl) animateValue("stat-online", 0, count, 1000);

    if (!users || count === 0) {
      listEl.innerHTML = `<div class="text-center text-gray-500 text-sm py-4">No one online right now.</div>`;
      return;
    }

    listEl.innerHTML = users.map(user => {
      const link = user.username ? `#/profile/${user.username}` : `#/profile/${user.id}`;
      const avatar = user.avatar_url || ` https://ui-avatars.com/api/?name=${user.username}&background=06b6d4&color=fff`;
      
      return `
        <a href="${link}" class="flex items-center gap-3 p-2 hover:bg-gray-700/50 rounded-lg transition group relative z-10">
          <div class="relative">
            <img src="${avatar}" class="w-10 h-10 rounded-full border border-gray-600 group-hover:border-cyan-400 transition shadow-md">
            <span class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-gray-800 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.8)]"></span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-white text-sm font-bold truncate group-hover:text-cyan-400 drop-shadow-sm">${user.username}</div>
            <div class="text-xs text-green-400">Online</div>
          </div>
        </a>
      `;
    }).join('');

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
    const avatar = user.avatar_url || ` https://ui-avatars.com/api/?name=${user.username}&background=FBBF24&color=000`;

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

    // Process LFG
    if (lfgData && lfgData.length > 0) {
      lfgData.forEach(post => {
        newMessages.push(`📡 <strong>${post.posted_username}</strong> is looking for players in <strong>${post.game_title}</strong> (${post.region})`);
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
      console.log(`✅ Loaded ${dynamicMessages.length} dynamic messages (LFG + Tours) into ticker`);
    } else {
      dynamicMessages = [];
      console.log('ℹ️ No active LFG or Tournament posts for ticker');
    }
  } catch (err) {
    console.error('Error loading dynamic ticker:', err);
  }
}

function startRealtimeFeed(rom) {
  // Initial Stats Load
  loadStats();

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
  setInterval(updateTicker, 6000); 

  // Subscribe to Realtime Changes
  realtimeChannel = supabase.channel('live-feed');

  // Listen for New Games
  realtimeChannel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'games' }, (payload) => {
    if (payload.new.status === 'approved') {
      flashTicker(`🎮 New Game Added: ${payload.new.title}`);
      loadFeaturedGame();
      loadRecentActivity();
      loadStats();
    }
  });

  // Listen for New Users
  realtimeChannel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, (payload) => {
    flashTicker(`👤 New Member: ${payload.new.username}`);
    loadOnlineUsers();
    loadRecentActivity();
    loadStats();
  });

  // Listen for NEW LFG Posts
  realtimeChannel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lfg_posts' }, (payload) => {
    const post = payload.new;
    if (post.status === 'open') {
      const newMsg = `📡 <strong>${post.posted_username}</strong> is looking for players in <strong>${post.game_title}</strong> (${post.region})`;
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
      const newMsg = `🏆 <strong>${tour.organizer_username}</strong> is hosting a <strong>${tour.game_title}</strong> tournament: ${tour.title}`;
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

  realtimeChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') console.log('✅ REALTIME SUBSCRIBED');
  });
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
});
