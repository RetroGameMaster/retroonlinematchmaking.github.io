const API_BASE = "https://YOUR-NGROK-URL.ngrok-free.app"; 

export async function getLiveGames() {
    const res = await fetch(`${API_BASE}/api/live_games`);
    if (!res.ok) throw new Error("Failed to fetch live games");
    return await res.json();
}

export async function getActivity() {
    const res = await fetch(`${API_BASE}/api/activity`);
    if (!res.ok) throw new Error("Failed to fetch activity");
    return await res.json();
}
