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
    // Fetch all site settings in one query
    const {  settings, error } = await supabase
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

    // Convert to object for easy access
    const settingsMap = {};
    settings.forEach(setting => {
      settingsMap[setting.key] = setting.value;
    });

    // Update Clip of the Week
    if (settingsMap.clip_title) {
      document.getElementById('clip-title').textContent = settingsMap.clip_title;
    }
    
    if (settingsMap.clip_youtube_id) {
      // Sanitize YouTube ID (remove any URL parameters or full URLs)
      const cleanId = settingsMap.clip_youtube_id
        .replace(/.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#&?]*).*/, '$1')
        .trim();
      
      const iframe = document.getElementById('clip-iframe');
      iframe.src = `https://www.youtube.com/embed/${cleanId}?rel=0&modestbranding=1&autohide=1&showinfo=0&autoplay=0`;
    }

    // Update Social Links
    updateSocialLink('discord-link', settingsMap.discord_url || '#');
    updateSocialLink('patreon-link', settingsMap.patreon_url || '#');
    updateSocialLink('youtube-link', settingsMap.youtube_url || '#');

  } catch (error) {
    console.error('Error loading site settings:', error);
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

// Animate stats counters (existing functionality)
function initStatsAnimation() {
  setInterval(() => {
    const elements = {
      'active-players': Math.floor(100 + Math.random() * 50),
      'active-games': Math.floor(20 + Math.random() * 10),
      'chat-messages': Math.floor(300 + Math.random() * 100),
      'active-lobbies': Math.floor(10 + Math.random() * 8)
    };
    
    Object.entries(elements).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });
  }, 3000);
}

// Export for module system
export default initModule;
