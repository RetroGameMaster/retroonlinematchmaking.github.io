// lib/lobby-aggregator.js

/**
 * Fetches and normalizes data from all supported lobby APIs
 * Returns a unified array of active lobbies
 */
export async function fetchGlobalLobbies() {
  const sources = [
    { name: 'Dolphin', url: 'https://lobby.dolphin-emu.org/v0/list', type: 'json' },
    { name: 'Insignia (Wii)', url: 'https://insignia.live/api/v1/titles', type: 'json' },
    { name: 'RetroArch', url: 'http://lobby.libretro.com/list', type: 'json' },
    { name: 'OpenSpy', url: 'https://openspy-website.nyc3.digitaloceanspaces.com/servers.json', type: 'json' },
    { name: 'SOCOM CC', url: 'https://www.socom.cc/status.xml', type: 'xml' },
    { name: 'SOCOM FR', url: 'https://www.socom.fr/status.xml', type: 'xml' },
    { name: 'SOCOM FTB2', url: 'https://www.socomftb2.com/status.xml', type: 'xml' },
    // Note: TeamXLink and SVO might need specific CORS proxies if they block browser requests
  ];

  const allLobbies = [];

  // Helper to fetch with timeout
  const fetchWithTimeout = async (url, timeout = 5000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      return res;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  };

  for (const source of sources) {
    try {
      const response = await fetchWithTimeout(source.url);
      if (!response.ok) continue;

      let data;
      if (source.type === 'json') {
        data = await response.json();
      } else if (source.type === 'xml') {
        const text = await response.text();
        const parser = new DOMParser();
        data = parser.parseFromString(text, "text/xml");
      }

      // Normalize based on source
      const normalized = normalizeData(source.name, data, source.type);
      allLobbies.push(...normalized);
      
    } catch (error) {
      console.warn(`Failed to fetch ${source.name}:`, error.message);
    }
  }

  return allLobbies.sort((a, b) => b.players - a.players); // Sort by popularity
}

function normalizeData(sourceName, data, type) {
  const lobbies = [];

  if (sourceName.includes('Dolphin')) {
    // Dolphin returns an array of games with rooms
    if (Array.isArray(data)) {
      data.forEach(game => {
        if (game.rooms) {
          game.rooms.forEach(room => {
            lobbies.push({
              game: game.name,
              room: room.room_name || 'Lobby',
              players: room.num_players || 0,
              max: room.max_players || 0,
              source: 'Dolphin',
              region: 'Global'
            });
          });
        }
      });
    }
  } 
  else if (sourceName.includes('Insignia')) {
    // Insignia returns titles with connected users
    if (Array.isArray(data)) {
      data.forEach(title => {
        if (title.connected_users > 0) {
          lobbies.push({
            game: title.name || title.title_id,
            room: 'Online Service',
            players: title.connected_users,
            max: 999,
            source: 'Wii Insignia',
            region: 'Global'
          });
        }
      });
    }
  }
  else if (sourceName.includes('SOCOM')) {
    // XML Parsing for SOCOM
    const servers = data.querySelectorAll('server');
    servers.forEach(server => {
      const current = parseInt(server.getAttribute('current_players') || server.getAttribute('players') || 0);
      const max = parseInt(server.getAttribute('max_players') || 0);
      const name = server.getAttribute('name') || server.getAttribute('gamename') || 'Unknown';
      
      if (current > 0) {
        lobbies.push({
          game: 'SOCOM II / Confrontation',
          room: name,
          players: current,
          max: max,
          source: sourceName.replace('SOCOM', '').trim() || 'SOCOM',
          region: 'PS2'
        });
      }
    });
  }
  else if (sourceName.includes('RetroArch')) {
     if (Array.isArray(data)) {
       data.forEach(room => {
         lobbies.push({
           game: room.core_name || 'RetroArch',
           room: room.room_name || 'Lobby',
           players: room.users || 0,
           max: room.max_users || 0,
           source: 'RetroArch',
           region: 'Netplay'
         });
       });
     }
  }
  // Add custom logic for OpenSpy, TeamXLink here as needed based on their JSON structure

  return lobbies;
}
