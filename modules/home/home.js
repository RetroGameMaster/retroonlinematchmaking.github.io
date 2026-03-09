// modules/home/home.js - FIXED VERSION (USES API MODULE)
import { supabase } from '../../lib/supabase.js';
import * as api from '../api/api.js'; // ✅ IMPORT API MODULE

export default function initModule(rom) {
  console.log('🏠 Homepage module initialized');
  loadSiteSettings();
  loadRealTimeStats(); // Load REAL stats immediately
  setInterval(loadRealTimeStats, 20000); // Refresh every 20s
}

// Load site settings (clip + social links)
async function loadSiteSettings() {
  try {
    // ✅ CORRECT: Use 'data' not 'settings'
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

    // Convert to object safely
    const settingsMap = {};
    if (Array.isArray(data)) {
      data.forEach(s => settingsMap[s.key] = s.value);
    }

    // ✅ FIXED: YouTube ID extraction with CORRECT regex
    const rawId = settingsMap.clip_youtube_id || 'dQw4w9WgXcQ';
    const cleanId = rawId
      .replace(/.*(?:youtu\.be\/|v\/|u\/\w+\/|embed\/|watch\?v=|&v=|\/shorts\/)([^#&?]{11}).*/, '$1')
      .trim() || 'dQw4w9WgXcQ';

    // Update Clip of the Week
    if (settingsMap.clip_title) {
      document.getElementById('clip-title').textContent = settingsMap.clip_title;
    }
    
    // ✅ FIXED: Set iframe src CORRECTLY (no spaces!)
    const iframe = document.getElementById('clip-iframe');
    if (iframe) {
      iframe.src = `https://www.youtube.com/embed/${cleanId}?rel=0&modestbranding=1&autoplay=0`;
    }

    // Update Social Links - ✅ FIXED: Proper fallbacks + trim
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

// Update social link helper
function updateSocialLink(elementId, url) {
  const el = document.getElementById(elementId);
  if (el) el.href = url || '#';
}

// ✅ REAL-TIME STATS: Fetch from Discord bot API via API module
async function loadRealTimeStats() {
  try {
    // ✅ USE API MODULE INSTEAD OF DIRECT FETCH
    const data = await api.getRealTimeActivity();
    
    // ✅ SAFE ASSIGNMENTS (NO optional chaining on left side of =)
    const activePlayersEl = document.getElementById('active-players');
    if (activePlayersEl) activePlayersEl.textContent = data.active_users || 0;
    
    const activeGamesEl = document.getElementById('active-games');
    if (activeGamesEl) {
      activeGamesEl.textContent = (data.active_rewired_games || 0) + 
                                   (data.active_socom_games || 0) + 
                                   (data.active_openspy_games || 0);
    }
    
    const lfgEl = document.getElementById('chat-messages'); // LFG = "Live Chat" replacement
    if (lfgEl) lfgEl.textContent = data.active_lfg_games || 0;
    
    const serverGamesEl = document.getElementById('active-lobbies');
    if (serverGamesEl) {
      serverGamesEl.textContent = (data.active_rewired_games || 0) + 
                                   (data.active_socom_games || 0) + 
                                   (data.active_openspy_games || 0);
    }
    
    // Optional: Log top games for debugging
    if (data.top_games?.length > 0) {
      console.log('🎮 Top Active Games:', data.top_games);
    }
    
  } catch (error) {
    console.error('❌ Failed to load real-time stats:', error);
    // Keep existing values on error (don't reset to 0)
  }
}
