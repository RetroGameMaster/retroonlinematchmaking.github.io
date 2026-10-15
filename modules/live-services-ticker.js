import { supabase } from '../lib/supabase.js';

let channel = null;
let refreshTimer = null;

function makeTickerItem(item) {
  const wrapper = document.createElement(item.url ? 'a' : 'span');
  wrapper.className = 'rom-ticker-item';
  if (item.url) {
    wrapper.href = item.url;
    wrapper.target = '_blank';
    wrapper.rel = 'noopener noreferrer';
    wrapper.title = 'Open Discord activity';
  }
  const dot = document.createElement('span');
  dot.className = 'rom-ticker-dot';
  dot.textContent = '●';
  const game = document.createElement('strong');
  game.textContent = item.game;
  const service = document.createElement('span');
  service.className = 'rom-ticker-service';
  service.textContent = item.service || 'Discord matchmaking';
  const players = document.createElement('span');
  players.className = 'rom-ticker-players';
  players.textContent = item.players > 0 ? item.players + ' online' : 'Looking for players';
  wrapper.append(dot, game, service, players);
  return wrapper;
}

function renderTicker(items) {
  const track = document.getElementById('rom-live-ticker-track');
  const status = document.getElementById('rom-live-ticker-status');
  if (!track || !status) return;
  track.replaceChildren();
  if (!items.length) {
    status.textContent = 'WAITING FOR LIVE GAME DATA';
    const idle = document.createElement('span');
    idle.className = 'rom-ticker-item rom-ticker-idle';
    idle.textContent = 'No current API activity or active matchmaking searches reported.';
    track.append(idle);
    return;
  }
  status.textContent = items.length + ' LIVE';
  // Duplicate the sequence so the CSS marquee loops without a blank gap.
  for (let copy = 0; copy < 2; copy++) {
    const group = document.createElement('div');
    group.className = 'rom-ticker-group';
    group.setAttribute('aria-hidden', copy === 1 ? 'true' : 'false');
    items.forEach(item => group.append(makeTickerItem(item)));
    track.append(group);
  }
}

async function refreshTicker() {
  const [servicesResult, lobbiesResult] = await Promise.all([
    supabase.from('discord_live_services')
      .select('source_key,service_name,game_title,console,players_online,discord_url,updated_at')
      .eq('is_active', true).order('updated_at', { ascending: false }).limit(250),
    supabase.from('discord_live_lobbies')
      .select('discord_lobby_key,game_title,console,minimum_players,joined_players,connection_methods,discord_url,expires_at')
      .eq('is_expired', false).gt('expires_at', new Date().toISOString()).order('updated_at', { ascending: false }).limit(250)
  ]);

  const items = [];
  if (!servicesResult.error && servicesResult.data) {
    servicesResult.data.forEach(row => items.push({
      key: 'service:' + row.source_key,
      game: row.game_title + (row.console ? ' (' + row.console + ')' : ''),
      service: row.service_name,
      players: Number(row.players_online) || 0,
      url: row.discord_url
    }));
  }
  if (!lobbiesResult.error && lobbiesResult.data) {
    lobbiesResult.data.forEach(row => items.push({
      key: 'lobby:' + row.discord_lobby_key,
      game: row.game_title + (row.console ? ' (' + row.console + ')' : ''),
      service: row.connection_methods || 'ROM Discord LFG',
      players: Number(row.joined_players) || 0,
      url: row.discord_url
    }));
  }
  const unique = [...new Map(items.map(item => [item.key, item])).values()];
  renderTicker(unique);
  if (servicesResult.error && lobbiesResult.error) {
    const status = document.getElementById('rom-live-ticker-status');
    if (status) status.textContent = 'LIVE DATA NOT CONFIGURED';
  }
}

export function initLiveServicesTicker() {
  if (!document.getElementById('rom-live-ticker-track')) return;
  refreshTicker();
  if (channel) supabase.removeChannel(channel);
  channel = supabase.channel('rom-live-services-ticker')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'discord_live_services' }, refreshTicker)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'discord_live_lobbies' }, refreshTicker)
    .subscribe();
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(refreshTicker, 60000);
}
