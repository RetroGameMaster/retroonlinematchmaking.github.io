// modules/home/home.js - FIXED: REAL-TIME STATS VIA API MODULE
import { supabase } from '../../lib/supabase.js';
import * as api from '../api/api.js';

export default function initModule(rom) {
  console.log('🏠 Homepage module initialized');
  loadSiteSettings();
  loadRealTimeStats();
  setInterval(loadRealTimeStats, 20000);
}

async function loadSiteSettings() {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['clip_title', 'clip_youtube_id', 'discord_url', 'patreon_url', 'youtube_url']);
    
    if (error) throw error;
    
    const settingsMap = {};
    if (Array.isArray(data)) data.forEach(s => settingsMap[s.key] = s.value);
    
    const rawId = settingsMap.clip_youtube_id || 'dQw4w9WgXcQ';
    const cleanId = rawId.replace(/.*(?:youtu\.be\/|v\/|u\/\w+\/|embed\/|watch\?v=|&v=|\/shorts\/)([^#&?]{11}).*/, '$1').trim() || 'dQw4w9WgXcQ';
    
    if (settingsMap.clip_title) document.getElementById('clip-title').textContent = settingsMap.clip_title;
    
    const iframe = document.getElementById('clip-iframe');
    if (iframe) iframe.src = `https://www.youtube.com/embed/${cleanId}?rel=0&modestbranding=1&autoplay=0`;
    
    updateSocialLink('discord-link', (settingsMap.discord_url || 'https://discord.gg/example').trim());
    updateSocialLink('patreon-link', (settingsMap.patreon_url || 'https://patreon.com/example').trim());
    updateSocialLink('youtube-link', (settingsMap.youtube_url || 'https://youtube.com/example').trim());
  } catch (error) {
    console.error('❌ Error loading site settings:', error);
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

async function loadRealTimeStats() {
  try {
    const data = await api.getRealTimeActivity();
    
    const playersEl = document.getElementById('active-players');
    if (playersEl) playersEl.textContent = data.active_users || 0;
    
    const gamesEl = document.getElementById('active-games');
    if (gamesEl) {
      gamesEl.textContent = (data.active_rewired_games || 0) + 
                            (data.active_socom_games || 0) + 
                            (data.active_openspy_games || 0);
    }
    
    const lfgEl = document.getElementById('chat-messages');
    if (lfgEl) lfgEl.textContent = data.active_lfg_games || 0;
    
    const serversEl = document.getElementById('active-lobbies');
    if (serversEl) {
      serversEl.textContent = (data.active_rewired_games || 0) + 
                              (data.active_socom_games || 0) + 
                              (data.active_openspy_games || 0);
    }
    
    if (data.top_games?.length > 0) console.log('🎮 Top Active Games:', data.top_games);
  } catch (error) {
    console.error('⚠️ Real-time stats failed (using existing values):', error);
  }
}