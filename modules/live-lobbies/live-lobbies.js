import { fetchGlobalLobbies } from '../../lib/lobby-aggregator.js';

export default function initModule(rom) {
  console.log('🌍 Live Lobbies module initialized');
  
  const container = document.getElementById('lobbies-container');
  const refreshBtn = document.getElementById('refresh-lobbies');

  const renderLobbies = async () => {
    if (!container) return;
    
    // Show loading state if empty
    if (container.children.length === 0 || container.innerText.includes('Loading')) {
       container.innerHTML = '<div class="col-span-full text-center py-12 text-gray-500">Scanning networks...</div>';
    }

    try {
      const lobbies = await fetchGlobalLobbies();
      
      if (lobbies.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center py-12 text-gray-400">No active lobbies found right now. Try again later!</div>';
        return;
      }

      container.innerHTML = lobbies.map(lobby => `
        <div class="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-cyan-500 transition group relative overflow-hidden">
          <div class="absolute top-0 right-0 w-16 h-16 bg-cyan-500/10 rounded-bl-full -mr-8 -mt-8 transition group-hover:bg-cyan-500/20"></div>
          
          <div class="flex justify-between items-start mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-cyan-400 bg-cyan-900/30 px-2 py-1 rounded">${lobby.source}</span>
            <div class="flex items-center gap-1 text-green-400 text-sm font-bold">
              <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              ${lobby.players} / ${lobby.max}
            </div>
          </div>
          
          <h3 class="text-lg font-bold text-white mb-1 truncate" title="${lobby.game}">${lobby.game}</h3>
          <p class="text-gray-400 text-sm truncate mb-3">📂 ${lobby.room}</p>
          
          <div class="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
            <div class="bg-gradient-to-r from-cyan-500 to-purple-500 h-full" style="width: ${Math.min((lobby.players / lobby.max) * 100, 100)}%"></div>
          </div>
        </div>
      `).join('');

    } catch (error) {
      console.error(error);
      container.innerHTML = '<div class="col-span-full text-center py-12 text-red-400">Failed to load lobby data. Some services might be offline or blocking requests.</div>';
    }
  };

  // Initial Load
  renderLobbies();

  // Refresh Button
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      refreshBtn.textContent = '⏳ Refreshing...';
      refreshBtn.disabled = true;
      renderLobbies().then(() => {
        refreshBtn.textContent = '🔄 Refresh Data';
        refreshBtn.disabled = false;
      });
    });
  }
}
