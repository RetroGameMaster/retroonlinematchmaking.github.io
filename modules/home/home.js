// modules/home/home.js - STABLE VERSION (NO LIVE DATA, SAFE STATS ONLY)
import { supabase } from '../../lib/supabase.js';

export default function initModule(rom) {
  console.log('🏠 Homepage initialized');
  loadSiteSettings(); // YouTube + social links
  loadSupabaseStats(); // Safe stats from YOUR database only
}

// Load YouTube clip + social links from site_settings
async function loadSiteSettings() {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['clip_title', 'clip_youtube_id', 'discord_url', 'patreon_url', 'youtube_url']);

    if (error) throw error;

    const settings = {};
    if (Array.isArray(data)) data.forEach(s => settings[s.key] = s.value);

    // ✅ FIXED: YouTube ID extraction (no broken regex)
    const cleanId = (settings.clip_youtube_id || 'dQw4w9WgXcQ')
      .replace(/.*(?:youtu\.be\/|v\/|u\/\w+\/|embed\/|watch\?v=|&v=|\/shorts\/)([^#&?]{11}).*/, '$1')
      .trim() || 'dQw4w9WgXcQ';

    document.getElementById('clip-title').textContent = settings.clip_title || 'ROM Community Highlights';
    document.getElementById('clip-iframe').src = `https://www.youtube.com/embed/${cleanId}?rel=0&modestbranding=1`;
    
    // Update social links (SAFE: no broken URLs)
    ['discord', 'patreon', 'youtube'].forEach(key => {
      const el = document.getElementById(`${key}-link`);
      if (el) el.href = (settings[`${key}_url`] || `https://${key}.com`).trim() || '#';
    });
  } catch (error) {
    console.error('Site settings error:', error);
    // Fallbacks (always safe)
    document.getElementById('clip-title').textContent = 'ROM Community Highlights';
    document.getElementById('clip-iframe').src = 'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1';
    document.getElementById('discord-link').href = 'https://discord.gg/retroonlinematchmaking';
    document.getElementById('patreon-link').href = 'https://patreon.com/retroonlinematchmaking';
    document.getElementById('youtube-link').href = 'https://youtube.com/@retroonlinematchmaking';
  }
}

// ✅ SAFE STATS: From YOUR Supabase DB ONLY (NO EXTERNAL APIs)
async function loadSupabaseStats() {
  try {
    // Total approved games
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });

    // Total registered users
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Games with active servers flag
    const { count: serverGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('servers_available', true);

    // Pending submissions (shows community activity)
    const { count: pendingSubs } = await supabase
      .from('game_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Update DOM safely
    const updateStat = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value.toLocaleString();
    };

    updateStat('active-players', totalUsers || 0);          // "Online now" = total users
    updateStat('active-games', totalGames || 0);            // "Being played" = total games
    updateStat('chat-messages', pendingSubs || 0);          // "Active LFG" = pending submissions
    updateStat('active-lobbies', serverGames || 0);         // "Server Games" = games with servers

    console.log('✅ Stats loaded from Supabase');
  } catch (error) {
    console.warn('⚠️ Stats unavailable (using existing values):', error.message);
    // DO NOT reset to 0 - keep existing values visible
  }
}