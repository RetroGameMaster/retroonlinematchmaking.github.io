const API_BASE =  https://visional-nondiligently-ha.ngrok-free.dev -> http://localhost:8000; 

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
