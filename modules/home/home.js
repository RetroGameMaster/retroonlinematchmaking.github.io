// modules/home/home.js - SAFE REAL-TIME STATS INTEGRATION
import { supabase } from '../../lib/supabase.js';
import * as api from '../api/api.js'; // ✅ ONLY CHANGE: Import API module

export default function initModule(rom) {
  console.log('🏠 Homepage module initialized');
  loadSiteSettings();
  loadRealTimeStats(); // Load REAL stats immediately
  setInterval(loadRealTimeStats, 20000); // Refresh every 20s
}

// Load site settings (clip + social links) - UNCHANGED
async function loadSiteSettings() {
  try {
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

    const settingsMap = {};
    if (Array.isArray(data)) {
      data.forEach(s => settingsMap[s.key] = s.value);
    }

    // ✅ FIXED: YouTube ID extraction (critical regex fix)
    const rawId = settingsMap.clip_youtube_id || 'dQw4w9WgXcQ';
    const cleanId = rawId
      .replace(/.*(?:youtu\.be\/|v\/|u\/\w+\/|embed\/|watch\?v=|&v=|\/shorts\/)([^#&?]{11}).*/, '$1')
      .trim() || 'dQw4w9WgXcQ';

    // Update Clip of the Week
    if (settingsMap.clip_title) {
      document.getElementById('clip-title').textContent = settingsMap.clip_title;
    }
    
    // ✅ FIXED: NO EXTRA SPACES in iframe src
    const iframe = document.getElementById('clip-iframe');
    if (iframe) {
      iframe.src = `https://www.youtube.com/embed/${cleanId}?rel=0&modestbranding=1&autoplay=0`;
    }

    // Update Social Links
    updateSocialLink('discord-link', (settingsMap.discord_url || 'https://discord.gg/example').trim());
    updateSocialLink('patreon-link', (settingsMap.patreon_url || 'https://patreon.com/example').trim());
    updateSocialLink('youtube-link', (settingsMap.youtube_url || 'https://youtube.com/example').trim());
  } catch (error) {
    console.error('❌ Error loading site settings:', error);
    // Fallback content
    document.getElementById('clip-title').textContent = 'ROM Community Highlights';
    document.getElementById('clip-iframe').src = 'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1';
    updateSocialLink('discord-link', 'https://discord.gg/example');
    updateSocialLink('patreon-link', 'https://patreon.com/example');
    updateSocialLink('youtube-link', 'https://youtube.com/example');
  }
}

function updateSocialLink(elementId, url) {
  const el = document.getElementById(elementId);
  if (el) el.href = url || '#';
}

// ✅ SAFE REAL-TIME STATS: Uses API module with error handling
async function loadRealTimeStats() {
  try {
    const data = await api.getRealTimeActivity();
    
    // Update stats with REAL Discord bot data
    const playersEl = document.getElementById('active-players');
    if (playersEl) playersEl.textContent = data.active_users || 0;
    
    const gamesEl = document.getElementById('active-games');
    if (gamesEl) {
      const totalServers = (data.active_rewired_games || 0) + 
                          (data.active_socom_games || 0) + 
                          (data.active_openspy_games || 0);
      gamesEl.textContent = totalServers;
    }
    
    const lfgEl = document.getElementById('chat-messages');
    if (lfgEl) lfgEl.textContent = data.active_lfg_games || 0;
    
    const serversEl = document.getElementById('active-lobbies');
    if (serversEl) {
      const totalServers = (data.active_rewired_games || 0) + 
                          (data.active_socom_games || 0) + 
                          (data.active_openspy_games || 0);
      serversEl.textContent = totalServers;
    }
    
    // Log top games for debugging (optional)
    if (data.top_games?.length > 0) {
      console.log('🎮 Top Active Games:', data.top_games);
    }
    
  } catch (error) {
    console.error('⚠️ Real-time stats failed (using existing values):', error);
    // CRITICAL: Do NOT reset stats to 0 on error - keep existing values
  }
}
