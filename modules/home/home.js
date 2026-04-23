// modules/home/home.js
import { supabase } from '../../lib/supabase.js';

export default function initModule(rom) {
  console.log('🏠 Homepage initialized');
  renderHomeLayout();
  loadSiteSettings();
  loadFeaturedGame();
}

// 1. Render the Base Layout Immediately
function renderHomeLayout() {
  const appContent = document.getElementById('app-content');
  if (!appContent) return;

  appContent.innerHTML = `
    <div class="max-w-7xl mx-auto space-y-8 animate-fade-in">
      
      <!-- Welcome Header -->
      <div class="text-center py-8">
        <h1 class="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 glow mb-2">
          WELCOME TO ROM
        </h1>
        <p class="text-gray-400 text-lg">RetroOnlineMatchmaking • Connect • Play • Compete</p>
      </div>

      <!-- Main Grid: Featured Game & Clip of the Week -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        <!-- Left: Featured Game (Dynamic) -->
        <div class="bg-gray-800 rounded-xl overflow-hidden border border-cyan-500/30 shadow-lg shadow-cyan-900/20 flex flex-col">
          <div class="bg-gradient-to-r from-cyan-900/50 to-blue-900/50 p-4 border-b border-cyan-500/30">
            <h2 class="text-xl font-bold text-cyan-300 flex items-center gap-2">
              <span class="text-2xl">🎮</span> Featured Game
            </h2>
          </div>
          <div id="featured-game-content" class="flex-1 flex flex-col">
            <div class="p-8 text-center text-gray-500">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500 mb-2"></div>
              <p>Loading latest release...</p>
            </div>
          </div>
        </div>

        <!-- Right: Clip of the Week (Dynamic) -->
        <div class="bg-gray-800 rounded-xl overflow-hidden border border-purple-500/30 shadow-lg shadow-purple-900/20 flex flex-col">
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

      <!-- Community Hub / Social Links -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Discord -->
        <a id="discord-link" href="#" target="_blank" class="group block bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-[#5865F2] hover:shadow-lg hover:shadow-[#5865F2]/20 transition-all duration-300">
          <div class="flex items-center gap-4 mb-3">
            <div class="w-12 h-12 rounded-full bg-[#5865F2]/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">💬</div>
            <h3 class="text-lg font-bold text-white group-hover:text-[#5865F2]">Join Discord</h3>
          </div>
          <p class="text-gray-400 text-sm">Chat with players, find matches, and get support in real-time.</p>
        </a>

        <!-- Patreon -->
        <a id="patreon-link" href="#" target="_blank" class="group block bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-[#F96854] hover:shadow-lg hover:shadow-[#F96854]/20 transition-all duration-300">
          <div class="flex items-center gap-4 mb-3">
            <div class="w-12 h-12 rounded-full bg-[#F96854]/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">❤️</div>
            <h3 class="text-lg font-bold text-white group-hover:text-[#F96854]">Support ROM</h3>
          </div>
          <p class="text-gray-400 text-sm">Help keep the servers running and get exclusive badges.</p>
        </a>

        <!-- YouTube -->
        <a id="youtube-link" href="#" target="_blank" class="group block bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-[#FF0000] hover:shadow-lg hover:shadow-[#FF0000]/20 transition-all duration-300">
          <div class="flex items-center gap-4 mb-3">
            <div class="w-12 h-12 rounded-full bg-[#FF0000]/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">▶️</div>
            <h3 class="text-lg font-bold text-white group-hover:text-[#FF0000]">Watch Tutorials</h3>
          </div>
          <p class="text-gray-400 text-sm">Guides on how to set up netplay, mods, and more.</p>
        </a>
      </div>

      <!-- Radio Reminder -->
      <div class="text-center py-6 border-t border-gray-800">
        <p class="text-gray-500 text-sm flex items-center justify-center gap-2">
          <span class="animate-pulse w-2 h-2 bg-red-500 rounded-full"></span>
          Don't forget to turn on <strong class="text-cyan-400">ROM Radio</strong> in the bottom right corner! 📻
        </p>
      </div>

    </div>
  `;
}

// 2. Load Site Settings (Clip & Socials)
async function loadSiteSettings() {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['clip_title', 'clip_youtube_id', 'discord_url', 'patreon_url', 'youtube_url']);

    if (error) throw error;

    const settings = {};
    if (Array.isArray(data)) data.forEach(s => settings[s.key] = s.value);

    // YouTube ID extraction
    const rawId = settings.clip_youtube_id || 'dQw4w9WgXcQ';
    const cleanId = rawId.replace(/.*(?:youtu\.be\/|v\/|u\/\w+\/|embed\/|watch\?v=|&v=|\/shorts\/)([^#&?]{11}).*/, '$1').trim() || 'dQw4w9WgXcQ';

    // Update DOM safely
    const titleEl = document.getElementById('clip-title');
    const iframeEl = document.getElementById('clip-iframe');
    
    if (titleEl) titleEl.innerHTML = `<span class="text-2xl">🎬</span> ${settings.clip_title || 'ROM Community Highlights'}`;
    // Fixed: Removed space after embed/
    if (iframeEl) iframeEl.src = `https://www.youtube.com/embed/${cleanId}?rel=0&modestbranding=1&autoplay=0`;
    
    // Update social links
    ['discord', 'patreon', 'youtube'].forEach(key => {
      const el = document.getElementById(`${key}-link`);
      if (el) {
        const url = (settings[`${key}_url`] || `https://${key}.com`).trim();
        el.href = url !== 'https://.com' ? url : '#';
      }
    });
  } catch (error) {
    console.error('Site settings error:', error);
    // Fallbacks
    const titleEl = document.getElementById('clip-title');
    const iframeEl = document.getElementById('clip-iframe');
    if (titleEl) titleEl.innerHTML = `<span class="text-2xl">🎬</span> ROM Community Highlights`;
    if (iframeEl) iframeEl.src = 'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1';
  }
}

// 3. Load Featured Game (Latest Approved)
async function loadFeaturedGame() {
  const container = document.getElementById('featured-game-content');
  if (!container) return;

  try {
    // FIX: Changed order column from 'approved_at' (doesn't exist) to 'updated_at'
    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'approved') 
      .order('updated_at', { ascending: false }) // Use updated_at instead
      .limit(1);

    if (error) {
      console.error('Supabase error fetching featured game:', error);
      throw error;
    }

    // Check if we got any results
    if (!games || games.length === 0) {
      container.innerHTML = `
        <div class="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div class="text-6xl mb-4 opacity-50">🕹️</div>
          <h3 class="text-xl font-bold text-gray-300">No Games Yet</h3>
          <p class="text-gray-500 mt-2">Be the first to submit a game via the Admin panel!</p>
          <a href="#/games" class="mt-6 px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-full font-bold transition">Browse Library</a>
        </div>
      `;
      return;
    }

    const game = games[0]; // Get the first item from the array

    // Render Featured Game Card
    const coverUrl = game.cover_image_url || 'https://via.placeholder.com/400x220/1f2937/06b6d4?text=No+Cover';
    const gameLink = game.slug ? `#/game/${game.slug}` : `#/game/${game.id}`;

    container.innerHTML = `
      <div class="relative h-48 w-full overflow-hidden">
        <img src="${coverUrl}" alt="${game.title}" class="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity duration-500">
        <div class="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"></div>
        <div class="absolute bottom-4 left-4">
          <span class="px-3 py-1 bg-cyan-600 text-white text-xs font-bold rounded-full uppercase tracking-wider">${game.console || 'Console'}</span>
        </div>
      </div>
      
      <div class="p-6 flex-1 flex flex-col justify-between">
        <div>
          <h3 class="text-2xl font-bold text-white mb-2 line-clamp-1">${game.title}</h3>
          <p class="text-gray-400 text-sm line-clamp-3 mb-4">${game.description || 'No description available.'}</p>
          
          <div class="flex flex-wrap gap-2 mb-4">
            <span class="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">${game.multiplayer_type || 'Multiplayer'}</span>
            ${game.year ? `<span class="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">${game.year}</span>` : ''}
          </div>
        </div>

        <a href="${gameLink}" class="w-full block text-center py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg transition transform hover:-translate-y-1 shadow-lg shadow-cyan-900/50">
          View Game Details
        </a>
      </div>
    `;

  } catch (error) {
    console.error('Featured game error:', error);
    container.innerHTML = `
      <div class="p-8 text-center text-red-400">
        <p>Failed to load featured game.</p>
        <button onclick="location.reload()" class="mt-2 text-sm underline">Retry</button>
      </div>
    `;
  }
}
