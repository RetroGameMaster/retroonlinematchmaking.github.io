// modules/home/home.js - HOMEPAGE WITH CLIP OF THE WEEK & SOCIAL BUTTONS
import { supabase } from '../../lib/supabase.js';

export function initModule(rom) {
  console.log('🏠 Homepage module initialized');
  loadSiteSettings();
  initStatsAnimation();
}

// Load site settings (clip + social links)
async function loadSiteSettings() {
  try {
    // ✅ CORRECT: Use 'data' not 'settings' in destructuring
    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', [
        'clip_title', 
        'clip_youtube_id',
        'discord_url',
        'patreon_url',
        'youtube_url'
      ]);

    if (error) throw error;

    // ✅ SAFE: Handle missing data gracefully
    const settingsMap = {};
    if (Array.isArray(data)) {
      data.forEach(setting => {
        settingsMap[setting.key] = setting.value;
      });
    } else {
      console.warn('⚠️ site_settings table empty or missing - using defaults');
    }

    // Update Clip of the Week
    if (settingsMap.clip_title) {
      document.getElementById('clip-title').textContent = settingsMap.clip_title;
    }
    
    if (settingsMap.clip_youtube_id) {
      // Sanitize YouTube ID (remove any URL parameters or full URLs)
      const cleanId = settingsMap.clip_youtube_id
        .replace(/.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|\/shorts\/)([^#&?]{11}).*/, '$1')
        .trim() || 'dQw4w9WgXcQ';
      
      const iframe = document.getElementById('clip-iframe');
      iframe.src = `https://www.youtube.com/embed/${cleanId}?rel=0&modestbranding=1&autohide=1&showinfo=0&autoplay=0`;
    }

    // Update Social Links
    updateSocialLink('discord-link', settingsMap.discord_url || 'https://discord.gg/example');
    updateSocialLink('patreon-link', settingsMap.patreon_url || 'https://patreon.com/example');
    updateSocialLink('youtube-link', settingsMap.youtube_url || 'https://youtube.com/example');

  } catch (error) {
    console.error('❌ Error loading site settings:', error);
    // Fallback content if error occurs
    document.getElementById('clip-title').textContent = 'ROM Community Highlights';
    document.getElementById('clip-iframe').src = 'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1';
    updateSocialLink('discord-link', 'https://discord.gg/example');
    updateSocialLink('patreon-link', 'https://patreon.com/example');
    updateSocialLink('youtube-link', 'https://youtube.com/example');
  }
}

function updateSocialLink(elementId, url) {
  const el = document.getElementById(elementId);
  if (el) el.href = url;
}

// REMOVE OLD initStatsAnimation FUNCTION COMPLETELY
// ADD THIS NEW FUNCTION IN ITS PLACE:
async function loadRealTimeStats() {
  try {
    const response = await fetch('/api/real_time_activity');
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    
    const data = await response.json();
    
    // Update Active Players (distinct users in active LFG)
    const playersEl = document.getElementById('active-players');
    if (playersEl) playersEl.textContent = data.active_users || 0;
    
    // Update Active Games (games with players online in ActiveGames table)
    const gamesEl = document.getElementById('active-games');
    if (gamesEl) {
      // Sum players from top_games if available, else use active server games count
      const totalPlayers = data.top_games?.reduce((sum, game) => sum + (game.player_count || 0), 0) || 0;
      gamesEl.textContent = totalPlayers > 0 ? totalPlayers : (data.active_rewired_games + data.active_socom_games + data.active_openspy_games);
    }
    
    // Update Active LFG Posts (was "Live Chat")
    const lfgEl = document.getElementById('chat-messages');
    if (lfgEl) lfgEl.textContent = data.active_lfg_games || 0;
    
    // Update Active Server Games (was "Matchmaking")
    const serverGamesEl = document.getElementById('active-lobbies');
    if (serverGamesEl) {
      const totalServers = (data.active_rewired_games || 0) + 
                          (data.active_socom_games || 0) + 
                          (data.active_openspy_games || 0);
      serverGamesEl.textContent = totalServers;
    }
    
    // Optional: Log top games to console for debugging
    if (data.top_games && data.top_games.length > 0) {
      console.log('🎮 Top Active Games:', data.top_games);
    }
    
  } catch (error) {
    console.error('❌ Failed to load real-time stats:', error);
    // Fallback to safe defaults on error
    document.getElementById('active-players').textContent = '0';
    document.getElementById('active-games').textContent = '0';
    document.getElementById('chat-messages').textContent = '0';
    document.getElementById('active-lobbies').textContent = '0';
  }
}

// UPDATE initModule TO USE REAL DATA
export function initModule(rom) {
  console.log('🏠 Homepage module initialized');
  loadSiteSettings(); // Clip of the Week + Social Links
  loadRealTimeStats(); // Load REAL stats immediately
  
  // Refresh stats every 20 seconds (Discord bot updates DB frequently)
  setInterval(loadRealTimeStats, 20000);
}

// Export for module system
export default initModule;
