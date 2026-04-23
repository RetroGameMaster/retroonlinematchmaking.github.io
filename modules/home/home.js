// modules/home/home.js
import { supabase } from '../../lib/supabase.js';

let realtimeChannel = null;

export default function initModule(rom) {
  console.log('🏠 Homepage initialized');
  renderHomeLayout();
  
  // Initialize Ambient Effects
  initAmbientEffects();
  
  // Load all dynamic content
  loadSiteSettings();
  loadFeaturedGame();
  loadOnlineUsers();
  loadRecentActivity();
  
  // Start Realtime Listeners for Live Feed
  startRealtimeFeed();
}

// ============================================================================
// 1. AMBIENT EFFECTS (CRT Scanlines, Breathing Glow, Mouse Spotlight)
// ============================================================================

function initAmbientEffects() {
  // Add CRT Scanline Overlay to Body
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

    // Add Keyframes for Scanline
    const style = document.createElement('style');
    style.textContent = `
      @keyframes scanline {
        0% { background-position: 0 0; }
        100% { background-position: 0 100%; }
      }
      @keyframes breathe {
        0%, 100% { box-shadow: 0 0 15px rgba(6, 182, 212, 0.15), inset 0 0 10px rgba(6, 182, 212, 0.05); border-color: rgba(6, 182, 212, 0.3); }
        50% { box-shadow: 0 0 25px rgba(6, 182, 212, 0.3), inset 0 0 20px rgba(6, 182, 212, 0.1); border-color: rgba(6, 182, 212, 0.6); }
      }
      .ambient-card {
        animation: breathe 4s ease-in-out infinite;
        transition: transform 0.2s, box-shadow 0.2s;
        position: relative;
        overflow: hidden;
      }
      .ambient-card::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background: radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(6, 182, 212, 0.15) 0%, transparent 50%);
        opacity: 0;
        transition: opacity 0.3s;
        pointer-events: none;
        z-index: 1;
      }
      .ambient-card:hover::before {
        opacity: 1;
      }
      .ambient-card:hover {
        transform: translateY(-2px);
        z-index: 2;
      }
    `;
    document.head.appendChild(style);
  }

  // Mouse Spotlight Logic
  document.addEventListener('mousemove', (e) => {
    const cards = document.querySelectorAll('.ambient-card');
    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
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
      
      <!-- LIVE TICKER (New) -->
      <div class="bg-gray-900/80 backdrop-blur border border-cyan-500/30 rounded-lg overflow-hidden h-10 relative flex items-center shadow-[0_0_15px_rgba(6,182,212,0.2)]">
        <div class="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-gray-900 to-transparent z-10"></div>
        <div class="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-gray-900 to-transparent z-10"></div>
        
        <div class="whitespace-nowrap animate-marquee flex items-center gap-8 px-4">
          <span class="text-cyan-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
            <span class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span> Live Feed
          </span>
          <span id="ticker-content" class="text-gray-300 text-sm font-mono">
            Waiting for activity...
          </span>
        </div>
      </div>

      <!-- Welcome Header -->
      <div class="text-center py-6 relative">
        <div class="absolute top-0 right-0 flex items-center gap-2 text-xs text-green-400 bg-green-900/20 px-3 py-1 rounded-full border border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.3)]">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          System Online
        </div>
        <h1 class="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 glow mb-2 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
          WELCOME TO ROM
        </h1>
        <p class="text-gray-400 text-lg">RetroOnlineMatchmaking • Connect • Play • Compete</p>
      </div>

      <!-- Main Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <!-- LEFT COLUMN -->
        <div class="lg:col-span-2 space-y-8">
          
          <!-- Featured Game -->
          <div class="ambient-card bg-gray-800 rounded-xl overflow-hidden border border-cyan-500/30 shadow-lg shadow-cyan-900/20 flex flex-col">
            <div class="bg-gradient-to-r from-cyan-900/50 to-blue-900/50 p-4 border-b border-cyan-500/30 flex justify-between items-center">
              <h2 class="text-xl font-bold text-cyan-300 flex items-center gap-2">
                <span class="text-2xl">🎮</span> Random Pick
              </h2>
              <span id="featured-game-status" class="text-xs text-gray-400 italic">Loading...</span>
            </div>
            <div id="featured-game-content" class="flex-1 flex flex-col">
              <div class="p-8 text-center text-gray-500">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500 mb-2"></div>
                <p>Scanning library...</p>
              </div>
            </div>
          </div>

          <!-- Clip of the Week -->
          <div class="ambient-card bg-gray-800 rounded-xl overflow-hidden border border-purple-500/30 shadow-lg shadow-purple-900/20 flex flex-col">
            <div class="bg-gradient-to-r from-purple-900/50 to-pink-900/50 p-4 border-b border-purple-500/30">
              <h2 id="clip-title" class="text-xl font-bold text-purple-300 flex items-center gap-2">
                <span class="text-2xl">🎬</span> Loading Clip...
              </h2>
            </div>
            <div class="relative aspect-video bg-black">
              <iframe id="clip-iframe" 
                class="absolute top-0 left-0 w-full h-full" 
                src="" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen>
              </iframe>
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN -->
        <div class="space-y-6">
          
          <!-- Who's Online -->
          <div class="ambient-card bg-gray-800 rounded-xl border border-gray-700 shadow-lg overflow-hidden">
            <div class="bg-gray-900/50 p-4 border-b border-gray-700 flex justify-between items-center">
              <h3 class="font-bold text-white flex items-center gap-2">
                <span class="relative flex h-2.5 w-2.5">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </span>
                Who's Online
              </h3>
              <span id="online-count" class="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.5)]">0</span>
            </div>
            <div id="online-users-list" class="p-2 max-h-64 overflow-y-auto custom-scrollbar">
              <div class="p-4 text-center text-gray-500 text-sm">Scanning network...</div>
            </div>
          </div>

          <!-- Recent Community Activity -->
          <div class="ambient-card bg-gray-800 rounded-xl border border-gray-700 shadow-lg overflow-hidden">
            <div class="bg-gray-900/50 p-4 border-b border-gray-700">
              <h3 class="font-bold text-white flex items-center gap-2">
                <span class="text-yellow-400">⚡</span> Live Activity
              </h3>
            </div>
            <div id="activity-feed" class="p-4 space-y-4">
              <div class="text-center text-gray-500 text-sm">Fetching recent events...</div>
            </div>
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

async function loadSiteSettings() {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['clip_title', 'clip_youtube_id', 'discord_url', 'patreon_url', 'youtube_url']);

    if (error) throw error;

    const settings = {};
    if (Array.isArray(data)) data.forEach(s => settings[s.key] = s.value);

    const rawId = settings.clip_youtube_id || 'dQw4w9WgXcQ';
    const cleanId = rawId.replace(/.*(?:youtu\.be\/|v\/|u\/\w+\/|embed\/|watch\?v=|&v=|\/shorts\/)([^#&?]{11}).*/, '$1').trim() || 'dQw4w9WgXcQ';

    const titleEl = document.getElementById('clip-title');
    const iframeEl = document.getElementById('clip-iframe');
    
    if (titleEl) titleEl.innerHTML = `<span class="text-2xl">🎬</span> ${settings.clip_title || 'ROM Community Highlights'}`;
    if (iframeEl) iframeEl.src = `https://www.youtube.com/embed/${cleanId}?rel=0&modestbranding=1&autoplay=0`;
    
    ['discord', 'patreon', 'youtube'].forEach(key => {
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
    // Get ALL approved games first to count them
    const { count, error: countError } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    if (countError || count === 0) {
       container.innerHTML = `
        <div class="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div class="text-6xl mb-4 opacity-50">🕹️</div>
          <h3 class="text-xl font-bold text-gray-300">No Games Yet</h3>
          <p class="text-gray-500 mt-2">Be the first to submit a game!</p>
          <a href="#/admin" class="mt-6 px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-full font-bold transition">Submit Game</a>
        </div>
      `;
      if(statusEl) statusEl.textContent = "Empty";
      return;
    }

    // Pick a random offset
    const randomOffset = Math.floor(Math.random() * count);

    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'approved')
      .range(randomOffset, randomOffset)
      .single();

    if (error || !games) {
      // Fallback to first if range fails
      const { data: fallback } = await supabase.from('games').select('*').eq('status', 'approved').limit(1).single();
      if(!fallback) throw new Error("No games");
      renderGameCard(fallback, container, statusEl);
    } else {
      renderGameCard(games, container, statusEl);
    }

  } catch (error) {
    console.error('Featured game error:', error);
    container.innerHTML = `<div class="p-4 text-red-400 text-center">Failed to load featured game.</div>`;
  }
}

function renderGameCard(game, container, statusEl) {
  const coverUrl = game.cover_image_url || 'https://via.placeholder.com/400x220/1f2937/06b6d4?text=No+Cover';
  const gameLink = game.slug ? `#/game/${game.slug}` : `#/game/${game.id}`;

  container.innerHTML = `
    <div class="relative h-48 w-full overflow-hidden">
      <img src="${coverUrl}" alt="${game.title}" class="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity duration-500">
      <div class="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"></div>
      <div class="absolute bottom-4 left-4">
        <span class="px-3 py-1 bg-cyan-600 text-white text-xs font-bold rounded-full uppercase tracking-wider shadow-[0_0_10px_rgba(8,145,178,0.6)]">${game.console}</span>
      </div>
    </div>
    <div class="p-6 flex-1 flex flex-col justify-between">
      <div>
        <h3 class="text-2xl font-bold text-white mb-2 line-clamp-1 drop-shadow-md">${game.title}</h3>
        <p class="text-gray-400 text-sm line-clamp-3 mb-4">${game.description || 'No description available.'}</p>
        <div class="flex flex-wrap gap-2 mb-4">
          <span class="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded border border-gray-600">${game.multiplayer_type || 'Multiplayer'}</span>
          ${game.year ? `<span class="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded border border-gray-600">${game.year}</span>` : ''}
        </div>
      </div>
      <a href="${gameLink}" class="w-full block text-center py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg transition transform hover:-translate-y-1 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]">
        View Game Details
      </a>
    </div>
  `;
  if(statusEl) statusEl.textContent = "Random Pick";
}

async function loadOnlineUsers() {
  const listEl = document.getElementById('online-users-list');
  const countEl = document.getElementById('online-count');
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

    if (!users || users.length === 0) {
      listEl.innerHTML = `
        <div class="text-center text-gray-500 text-sm py-4">
          <p>No one is online right now.</p>
          <p class="text-xs mt-1 opacity-70">Be the first to log in!</p>
        </div>`;
      if(countEl) countEl.textContent = "0";
      return;
    }

    if(countEl) countEl.textContent = users.length;

    listEl.innerHTML = users.map(user => {
      const link = user.username ? `#/profile/${user.username}` : `#/profile/${user.id}`;
      const avatar = user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}&background=06b6d4&color=fff`;
      
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
    listEl.innerHTML = `<div class="text-center text-red-400 text-xs">Failed to load users</div>`;
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

    if (latestGame) {
      activities.push({
        type: 'game',
        text: `New game added: <strong>${latestGame.title}</strong>`,
        time: latestGame.approved_at,
        icon: '🎮',
        color: 'text-cyan-400',
        link: latestGame.slug ? `#/game/${latestGame.slug}` : '#'
      });
    }

    if (latestUser) {
      activities.push({
        type: 'user',
        text: `<strong>${latestUser.username}</strong> joined the community`,
        time: latestUser.created_at,
        icon: '👤',
        color: 'text-purple-400',
        link: latestUser.username ? `#/profile/${latestUser.username}` : '#'
      });
    }

    if (activities.length === 0) {
      feedEl.innerHTML = `<div class="text-center text-gray-500 text-sm">No recent activity.</div>`;
      return;
    }

    activities.sort((a, b) => new Date(b.time) - new Date(a.time));

    feedEl.innerHTML = activities.map(act => `
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
    feedEl.innerHTML = `<div class="text-center text-gray-500 text-xs">Activity unavailable</div>`;
  }
}

// ============================================================================
// 4. REALTIME LIVE FEED (Ticker)
// ============================================================================

function startRealtimeFeed() {
  const tickerEl = document.getElementById('ticker-content');
  if (!tickerEl) return;

  // Initial Message
  let messages = [
    "Welcome to ROM!",
    "Check out the Random Game of the Hour!",
    "Join the Discord to chat!",
    "Listen to Vivi_Gaming Radio!"
  ];
  
  let msgIndex = 0;
  const updateTicker = () => {
    tickerEl.style.opacity = '0';
    setTimeout(() => {
      tickerEl.textContent = messages[msgIndex];
      tickerEl.style.opacity = '1';
      msgIndex = (msgIndex + 1) % messages.length;
    }, 500);
  };
  
  updateTicker();
  setInterval(updateTicker, 4000); // Rotate static messages every 4s

  // Subscribe to Database Changes
  realtimeChannel = supabase.channel('live-feed')
    .on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'games' }, 
      (payload) => {
        flashTicker(`🎮 New Game Added: ${payload.new.title}`);
      }
    )
    .on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'profiles' }, 
      (payload) => {
        flashTicker(`👤 New Member: ${payload.new.username}`);
      }
    )
    .subscribe();
}

function flashTicker(text) {
  const tickerEl = document.getElementById('ticker-content');
  if (!tickerEl) return;

  // Visual Flash Effect
  tickerEl.parentElement.classList.add('shadow-[0_0_20px_rgba(34,211,238,0.6)]');
  tickerEl.classList.add('text-cyan-200');
  
  setTimeout(() => {
    tickerEl.parentElement.classList.remove('shadow-[0_0_20px_rgba(34,211,238,0.6)]');
    tickerEl.classList.remove('text-cyan-200');
  }, 1000);

  // Update Text with Fade
  tickerEl.style.transition = 'opacity 0.3s';
  tickerEl.style.opacity = '0';
  
  setTimeout(() => {
    tickerEl.textContent = text;
    tickerEl.style.opacity = '1';
  }, 300);
}

// Cleanup on unload (optional but good practice)
window.addEventListener('beforeunload', () => {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
  }
});
