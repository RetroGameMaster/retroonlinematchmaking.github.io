// modules/home/home.js 
import { supabase } from '../../lib/supabase.js';

export default function initModule(rom) {
  console.log('🏠 Homepage initialized');
  loadSiteSettings(); // YouTube + social links
  loadXLinkStats();   // LIVE XLINK DATA 
  setInterval(loadXLinkStats, 15000); // Refresh every 15s
}

// Load YouTube clip + social links (UNCHANGED - WORKING)
async function loadSiteSettings() {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['clip_title', 'clip_youtube_id', 'discord_url', 'patreon_url', 'youtube_url']);

    if (error) throw error;

    const settings = {};
    data.forEach(s => settings[s.key] = s.value);

    // YouTube ID extraction (FIXED REGEX)
    const cleanId = (settings.clip_youtube_id || 'dQw4w9WgXcQ')
      .replace(/.*(?:youtu\.be\/|v\/|u\/\w+\/|embed\/|watch\?v=|&v=|\/shorts\/)([^#&?]{11}).*/, '$1')
      .trim() || 'dQw4w9WgXcQ';

    document.getElementById('clip-title').textContent = settings.clip_title || 'ROM Community Highlights';
    document.getElementById('clip-iframe').src = `https://www.youtube.com/embed/${cleanId}?rel=0&modestbranding=1`;
    
    // Update social links
    ['discord', 'patreon', 'youtube'].forEach(key => {
      const el = document.getElementById(`${key}-link`);
      if (el) el.href = (settings[`${key}_url`] || `https://${key}.com`).trim() || '#';
    });
  } catch (error) {
    console.error('Site settings error:', error);
    // Fallbacks
    document.getElementById('clip-title').textContent = 'ROM Community Highlights';
    document.getElementById('clip-iframe').src = 'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1';
    document.getElementById('discord-link').href = 'https://discord.gg/example';
    document.getElementById('patreon-link').href = 'https://patreon.com/example';
    document.getElementById('youtube-link').href = 'https://youtube.com/example';
  }
}

// ✅ LIVE XLINK KAI STATS 
async function loadXLinkStats() {
  try {
    // DIRECT CALL TO XLINK'S PUBLIC ENDPOINT
    const response = await fetch('https://xlinkkai.com/api/v1/sessions?limit=20');
    
    if (!response.ok) {
      console.warn('XLink API unavailable - using fallback stats');
      updateStatsFallback();
      return;
    }

    const sessions = await response.json();
    
    // Process live data
    const activeSessions = sessions.filter(s => s.players && s.players.length > 0);
    const totalPlayers = activeSessions.reduce((sum, s) => sum + s.players.length, 0);
    const activeGames = [...new Set(activeSessions.map(s => s.gameTitle))].length;

    // Update DOM
    updateStat('active-players', totalPlayers);
    updateStat('active-games', activeGames);
    updateStat('chat-messages', activeSessions.length); // Active sessions = "LFG Posts"
    updateStat('active-lobbies', activeSessions.length); // Sessions = lobbies

    console.log(`✅ XLink Live Data: ${totalPlayers} players across ${activeGames} games`);
    
  } catch (error) {
    console.error('⚠️ XLink fetch failed (using fallback):', error.message);
    updateStatsFallback(); // Safe fallback on error
  }
}

// Fallback stats if XLink API fails
function updateStatsFallback() {
  // Keep existing values visible (don't reset to 0)
  // Optional: Show "Offline" badge
  const badge = document.getElementById('api-status-badge');
  if (badge) {
    badge.textContent = 'Offline';
    badge.className = 'text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded';
  }
}

// Helper: Update stat safely
function updateStat(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value.toLocaleString();
}
