// lib/lobby-aggregator.js

const API_ENDPOINTS = [
  { name: 'Dolphin', url: 'https://lobby.dolphin-emu.org/v0/list', type: 'json' },
  { name: 'Insignia (Wii)', url: 'https://insignia.live/api/v1/titles', type: 'json' },
  { name: 'RetroArch', url: 'https://lobby.libretro.com/list', type: 'json' }, // Forced HTTPS
  { name: 'OpenSpy', url: 'https://openspy-website.nyc3.digitaloceanspaces.com/servers.json', type: 'json' },
  { name: 'SV0 (AGRacing)', url: 'https://svo.agracingfoundation.org/medius_db/api/GetPlayerCount', type: 'json' },
  { name: 'XLink Kai', url: 'https://api.teamxlink.co.uk/rom/GetActiveGames/v1', type: 'json' },
  { name: 'SOCOM US', url: 'https://www.socom.cc/status.xml', type: 'xml' },
  { name: 'SOCOM EU', url: 'https://www.socom.fr/status.xml', type: 'xml' },
  { name: 'SOCOM FTB2', url: 'https://www.socomftb2.com/status.xml', type: 'xml' }
];

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

// Helper to parse XML
function parseXML(str) {
  const parser = new DOMParser();
  return parser.parseFromString(str, "text/xml");
}

// Normalize data from different APIs into a standard format
async function fetchAllLobbies() {
  const results = [];

  for (const api of API_ENDPOINTS) {
    try {
      // Wrap URL in CORS Proxy
      const proxyUrl = CORS_PROXY + encodeURIComponent(api.url);

      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json, text/xml' }
      });

      if (!response.ok) {
        console.warn(`⚠️ ${api.name} returned ${response.status}`);
        continue;
      }

      let data;
      if (api.type === 'xml') {
        const text = await response.text();
        const xml = parseXML(text);
        
        // Try various XML structures
        const players = xml.getElementsByTagName('playercount')[0]?.textContent || 
                        xml.getElementsByTagName('total_players')[0]?.textContent || '0';
        const games = xml.getElementsByTagName('game') || xml.getElementsByTagName('server') || xml.getElementsByTagName('room');
        
        if (games.length > 0) {
           Array.from(games).forEach(g => {
             const name = g.getAttribute('name') || g.getElementsByTagName('name')[0]?.textContent || 'Unknown Game';
             const count = g.getAttribute('players') || g.getElementsByTagName('players')[0]?.textContent || '0';
             if (parseInt(count) > 0) {
               results.push({
                 game: name,
                 players: parseInt(count),
                 source: api.name,
                 timestamp: new Date()
               });
             }
           });
        } else {
          const total = parseInt(players) || 0;
          if (total > 0) {
            results.push({
              game: `${api.name} Network`,
              players: total,
              source: api.name,
              timestamp: new Date()
            });
          }
        }

      } else {
        // JSON Parsing
        const json = await response.json();
        
        if (api.name === 'Dolphin') {
          if(Array.isArray(json)) {
            json.forEach(room => {
              if (room.players > 0) {
                results.push({
                  game: room.game,
                  players: room.players,
                  source: api.name,
                  timestamp: new Date()
                });
              }
            });
          }
        } 
        else if (api.name === 'Insignia (Wii)') {
           if(typeof json === 'object') {
             Object.entries(json).forEach(([id, data]) => {
               if (data.players > 0) {
                 results.push({
                   game: data.name || `Title ${id}`,
                   players: data.players,
                   source: api.name,
                   timestamp: new Date()
                 });
               }
             });
           }
        }
        else if (api.name === 'XLink Kai') {
           if(Array.isArray(json)) {
             json.forEach(game => {
               if (game.totalPlayers > 0) {
                 results.push({
                   game: game.title,
                   players: game.totalPlayers,
                   source: api.name,
                   timestamp: new Date()
                 });
               }
             });
           }
        }
        else if (api.name === 'OpenSpy') {
           if(Array.isArray(json)) {
             json.forEach(server => {
               if (server.numplayers > 0) {
                 results.push({
                   game: server.gamename || server.name,
                   players: server.numplayers,
                   source: api.name,
                   timestamp: new Date()
                 });
               }
             });
           }
        }
        else if (api.name === 'SV0 (AGRacing)') {
           const count = json.count || json.total || 0;
           if (count > 0) {
             results.push({
               game: 'AntiGravity Racing',
               players: count,
               source: api.name,
               timestamp: new Date()
             });
           }
        }
        else if (api.name === 'RetroArch') {
           if(Array.isArray(json)) {
             json.forEach(room => {
               if (room.clients > 0) {
                 results.push({
                   game: room.core || room.game || 'RetroArch Room',
                   players: room.clients,
                   source: api.name,
                   timestamp: new Date()
                 });
               }
             });
           }
        }
        else {
          console.warn(`Unhandled JSON structure for ${api.name}`, json);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to fetch ${api.name}:`, error.message);
    }
  }

  // Sort by player count (highest first)
  return results.sort((a, b) => b.players - a.players);
}

export { fetchAllLobbies };
