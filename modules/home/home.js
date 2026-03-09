// modules/home/home.js - HOMEPAGE WITH CLIP OF THE WEEK & SOCIAL BUTTONS
import { supabase } from '../../lib/supabase.js';

// modules/home/home.js - FIXED VERSION (NO DUPLICATE DECLARATION)
import { supabase } from '../../lib/supabase.js';

// ✅ FIXED: Single default export (NO duplicate declaration)
export default function initModule(rom) {
  console.log('🏠 Homepage module initialized');
  loadSiteSettings();
  loadRealTimeStats(); // Load REAL stats immediately
  setInterval(loadRealTimeStats, 20000); // Refresh every 20s
}

// Load site settings (clip + social links) - FIXED DATA ACCESS
async function loadSiteSettings() {
  try {
    // ✅ CRITICAL FIX: Use 'data' not 'settings' (was causing silent failure)
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

    // Update Social Links - ✅ FIXED: Proper fallbacks
    updateSocialLink('discord-link', settingsMap.discord_url?.trim() || 'https://discord.gg/example');
    updateSocialLink('patreon-link', settingsMap.patreon_url?.trim() || 'https://patreon.com/example');
    updateSocialLink('youtube-link', settingsMap.youtube_url?.trim() || 'https://youtube.com/example');

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
  if (el) el.href = url.trim() || '#';
}

// ✅ REAL-TIME STATS: Fetch from Discord bot API
async function loadRealTimeStats() {
  try {
    const response = await fetch('/api/real_time_activity');
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    
    const data = await response.json();
    
    // Update stats with REAL Discord bot data
    document.getElementById('active-players')?.textContent = data.active_users || 0;
    document.getElementById('active-games')?.textContent = (data.active_rewired_games || 0) + 
                                                           (data.active_socom_games || 0) + 
                                                           (data.active_openspy_games || 0);
    document.getElementById('chat-messages')?.textContent = data.active_lfg_games || 0; // LFG = "Live Chat" replacement
    document.getElementById('active-lobbies')?.textContent = (data.active_rewired_games || 0) + 
                                                             (data.active_socom_games || 0) + 
                                                             (data.active_openspy_games || 0);
    
    // Optional: Log top games for debugging
    if (data.top_games?.length > 0) {
      console.log('🎮 Top Active Games:', data.top_games);
    }
    
  } catch (error) {
    console.error('❌ Failed to load real-time stats:', error);
    // Keep existing values on error (don't reset to 0)
  }
}

// Helper: Escape HTML for safety (unused but kept for completeness)
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function initModule(rom) { }
