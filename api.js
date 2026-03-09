// modules/api/api.js - DISCORD BOT API CLIENT
const API_BASE = 'https://visional-nondiligently-ha.ngrok-free.dev';

export async function getRealTimeActivity() {
  const res = await fetch(`${API_BASE}/api/real_time_activity`);
  if (!res.ok) throw new Error(`Failed to fetch activity: ${res.status}`);
  return await res.json();
}

export async function getLiveGames() {
  const res = await fetch(`${API_BASE}/api/live_games`);
  if (!res.ok) throw new Error(`Failed to fetch live games: ${res.status}`);
  return await res.json();
}

export async function getActiveServers() {
  const res = await fetch(`${API_BASE}/api/active_servers`);
  if (!res.ok) throw new Error(`Failed to fetch active servers: ${res.status}`);
  return await res.json();
}

export async function getUpcomingEvents() {
  const res = await fetch(`${API_BASE}/api/upcoming_events`);
  if (!res.ok) throw new Error(`Failed to fetch events: ${res.status}`);
  return await res.json();
}

// Health check endpoint
export async function checkApiHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error(`API health check failed: ${res.status}`);
  return await res.json();
}
