// modules/home/home.js 
import { supabase } from '../../lib/supabase.js';

export default function initModule(rom) {
  console.log('🏠 Homepage initialized');
  loadSiteSettings(); // YouTube + social links only
}

async function loadSiteSettings() {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['clip_title', 'clip_youtube_id', 'discord_url', 'patreon_url', 'youtube_url']);

    if (error) throw error;

    const settings = {};
    if (Array.isArray(data)) data.forEach(s => settings[s.key] = s.value);

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
