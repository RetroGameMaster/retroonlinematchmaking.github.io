// lib/lobby-aggregator.js

const API_ENDPOINTS = [
  { name: 'Dolphin', url: 'https://lobby.dolphin-emu.org/v0/list', type: 'json' },
  { name: 'Insignia (Wii)', url: 'https://insignia.live/api/v1/titles', type: 'json' },
  { name: 'RetroArch', url: 'http://lobby.libretro.com/list', type: 'json' },
  { name: 'OpenSpy', url: 'https://openspy-website.nyc3.digitaloceanspaces.com/servers.json', type: 'json' },
  { name: 'SV0 (AGRacing)', url: 'https://svo.agracingfoundation.org/medius_db/api/GetPlayerCount', type: 'json' },
  { name: 'XLink Kai', url: 'https://api.teamxlink.co.uk/rom/GetActiveGames/v1', type: 'json' },
  { name: 'SOCOM US', url: 'https://www.socom.cc/status.xml', type: 'xml' },
  { name: 'SOCOM EU', url: 'https://www.socom.fr/status.xml', type: 'xml' },
  { name: 'SOCOM FTB2', url: 'https://www.socomftb2.com/status.xml', type: 'xml' }
];

const PROXIES = [
  'https://thingproxy.free.beeceptor.com/fetch/', 
  'https://api.allorigins.win/raw?url=',          
  'https://corsproxy.io/?'                         
];

function parseXML(str) {
  const parser = new DOMParser();
  return parser.parseFromString(str, "text/xml");
}

async function fetchWithRetry(url) {
  for (const proxy of PROXIES) {
    try {
      let targetUrl = url;
      // Fix mixed content for RetroArch if using a strict HTTPS proxy
      if (targetUrl.startsWith('http://') && !proxy.includes('beeceptor')) {
        targetUrl = targetUrl.replace('http://', 'https://');
      }

      const finalUrl = proxy + encodeURIComponent(targetUrl);
      
      const response = await fetch(finalUrl, {
        method: 'GET',
        headers: { 
          'Accept': 'application/json, text/xml',
          'User-Agent': 'ROM-Website/1.0' 
        }
      });

      if (!response.ok) continue; // Try next proxy if this one fails
      
      return await response.text(); 
    } catch (e) {
      continue; // Try next proxy
    }
  }
  throw new Error('All proxies failed');
}

export async function fetchGlobalLobbies() {
  const results = [];

  for (const api of API_ENDPOINTS) {
    try {
      const rawText = await fetchWithRetry(api.url);

      if (api.type === 'xml') {
        const xml = parseXML(rawText);
        const players = xml.getElementsByTagName('playercount')[0]?.textContent || 
                        xml.getElementsByTagName('total_players')[0]?.textContent || '0';
        const games = xml.getElementsByTagName('game') || xml.getElementsByTagName('server');
        
        if (games.length > 0) {
          Array.from(games).forEach(g => {
            const name = g.getAttribute('name') || g.getElementsByTagName('name')[0]?.textContent || 'Unknown';
            const count = parseInt(g.getAttribute('players') || g.getElementsByTagName('players')[0]?.textContent || '0');
            if (count > 0) {
              results.push({ game: name, players: count, source: api.name });
            }
          });
        } else {
          const total = parseInt(players) || 0;
          if (total > 0) results.push({ game: `${api.name} Network`, players: total, source: api.name });
        }

      } else {
        const json = JSON.parse(rawText);
        
        if (api.name === 'Dolphin' && Array.isArray(json)) {
          json.forEach(r => { if(r.players > 0) results.push({ game: r.game, players: r.players, source: api.name }); });
        } 
        else if (api.name === 'Insignia (Wii)' && typeof json === 'object') {
          Object.entries(json).forEach(([id, d]) => { if(d.players > 0) results.push({ game: d.name || id, players: d.players, source: api.name }); });
        }
        else if (api.name === 'XLink Kai' && Array.isArray(json)) {
          json.forEach(g => { if(g.totalPlayers > 0) results.push({ game: g.title, players: g.totalPlayers, source: api.name }); });
        }
        else if (api.name === 'OpenSpy' && Array.isArray(json)) {
          json.forEach(s => { if(s.numplayers > 0) results.push({ game: s.gamename || s.name, players: s.numplayers, source: api.name }); });
        }
        else if (api.name === 'SV0 (AGRacing)') {
          const count = json.count || json.total || 0;
          if (count > 0) results.push({ game: 'AntiGravity Racing', players: count, source: api.name });
        }
        else if (api.name === 'RetroArch' && Array.isArray(json)) {
          json.forEach(r => { if(r.clients > 0) results.push({ game: r.core || 'RetroArch', players: r.clients, source: api.name }); });
        }
      }
    } catch (error) {
      console.warn(`⚠️ ${api.name} unavailable (Blocked or Offline)`);
    }
  }

  return results.sort((a, b) => b.players - a.players);
}
