import { supabase } from '../../lib/supabase.js';

export async function initModule(container) {
  if (!container) {
    console.error('❌ Container not found for Site XP Leaderboard');
    return;
  }

  // Render Layout
  container.innerHTML = `
    <div class="max-w-5xl mx-auto p-4 md:p-6">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-3xl md:text-4xl font-bold text-white mb-2 drop-shadow-md">
          🏆 Site XP Leaderboard
        </h1>
        <p class="text-gray-400 text-sm md:text-base">
          Top contributors across the entire platform. Earn XP by posting, guiding, and helping.
        </p>
      </div>

      <!-- Filters -->
      <div class="flex justify-center gap-2 mb-6 flex-wrap">
        <button class="filter-btn active bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition hover:bg-cyan-500" data-range="all">
          All Time
        </button>
        <button class="filter-btn bg-gray-800 text-gray-400 px-4 py-2 rounded-lg text-sm font-bold transition hover:bg-gray-700" data-range="month">
          This Month
        </button>
        <button class="filter-btn bg-gray-800 text-gray-400 px-4 py-2 rounded-lg text-sm font-bold transition hover:bg-gray-700" data-range="week">
          This Week
        </button>
      </div>

      <!-- Loading State -->
      <div id="leaderboard-loading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
        <p class="text-gray-400 mt-2">Calculating rankings...</p>
      </div>

      <!-- Content Area -->
      <div id="leaderboard-content" class="hidden">
        
        <!-- PODIUM (Top 3) -->
        <div id="podium-container" class="flex justify-center items-end gap-4 mb-10 h-48 md:h-64">
          <!-- Injected via JS -->
        </div>

        <!-- LIST (Rank 4+) -->
        <div class="bg-gray-900/80 backdrop-blur rounded-xl border border-gray-700 overflow-hidden shadow-xl">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                <th class="p-4 font-bold">Rank</th>
                <th class="p-4 font-bold">User</th>
                <th class="p-4 font-bold text-right">XP Total</th>
                <th class="p-4 font-bold text-right hidden md:table-cell">Site Posts</th>
                <th class="p-4 font-bold text-right hidden sm:table-cell">Rank Title</th>
              </tr>
            </thead>
            <tbody id="leaderboard-list" class="text-gray-300 text-sm divide-y divide-gray-800">
              <!-- Rows injected via JS -->
            </tbody>
          </table>
        </div>
        
        <!-- Pagination / Load More -->
        <div class="text-center mt-6">
          <button id="load-more-btn" class="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-bold transition border border-gray-600">
            Load More
          </button>
        </div>
      </div>
    </div>
  `;

  // Attach Logic
  attachLeaderboardLogic();
}

async function attachLeaderboardLogic() {
  const loadingEl = document.getElementById('leaderboard-loading');
  const contentEl = document.getElementById('leaderboard-content');
  const podiumEl = document.getElementById('podium-container');
  const listEl = document.getElementById('leaderboard-list');
  const loadMoreBtn = document.getElementById('load-more-btn');
  const filterBtns = document.querySelectorAll('.filter-btn');

  let currentPage = 1;
  const limit = 20;
  let currentRange = 'all';
  let allData = []; // Cache for client-side filtering if needed

  // Fetch Data Function
  const fetchLeaders = async (page = 1, range = 'all') => {
    loadingEl.classList.remove('hidden');
    contentEl.classList.add('hidden');

    try {
      // For MVP, we fetch based on xp_total. 
      // Future: Add created_at filters for 'week'/'month' logic in Supabase RPC
      let query = supabase
        .from('profiles')
        .select(`
          id,
          username,
          avatar_url,
          xp_total,
          stats,
          rank:user_ranks (name, color)
        `, { count: 'exact' })
        .order('xp_total', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      // If first page, reset list. If more, append.
      if (page === 1) {
        allData = data;
        renderPodium(data.slice(0, 3));
        renderList(data.slice(3));
      } else {
        allData = [...allData, ...data];
        renderList(data); // Append only new rows
      }

      // Toggle Load More button
      if (allData.length >= count) {
        loadMoreBtn.classList.add('hidden');
      } else {
        loadMoreBtn.classList.remove('hidden');
      }

      loadingEl.classList.add('hidden');
      contentEl.classList.remove('hidden');

    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      loadingEl.innerHTML = `<p class="text-red-400">Failed to load rankings.</p>`;
    }
  };

  // Render Podium (Top 3)
  const renderPodium = (top3) => {
    podiumEl.innerHTML = '';
    if (top3.length === 0) return;

    // Order for Flexbox: 2nd, 1st, 3rd
    const orderMap = [1, 0, 2]; 
    const heights = ['h-32', 'h-40', 'h-24']; // Heights for 2nd, 1st, 3rd
    const colors = ['border-gray-400', 'border-yellow-400', 'border-orange-400'];
    const medals = ['🥈', '🥇', '🥉'];

    orderMap.forEach((idx, i) => {
      const user = top3[idx];
      if (!user) return;

      const rankIndex = idx + 1;
      const div = document.createElement('div');
      div.className = `flex flex-col items-center justify-end w-1/3 ${heights[i]} relative group`;
      
      div.innerHTML = `
        <div class="absolute -top-12 text-4xl filter drop-shadow-lg animate-bounce">${medals[i]}</div>
        <div class="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 ${colors[i]} overflow-hidden bg-gray-800 shadow-xl z-10">
          <img src="${user.avatar_url || 'https://ui-avatars.com/api/?name=' + user.username}" class="w-full h-full object-cover">
        </div>
        <div class="mt-2 text-center z-10">
          <p class="font-bold text-white text-xs md:text-sm truncate max-w-[80px] md:max-w-none">${user.username}</p>
          <p class="text-[10px] text-cyan-400 font-bold">${user.xp_total} XP</p>
        </div>
        <!-- Podium Block -->
        <div class="absolute bottom-0 w-full bg-gradient-to-t from-gray-800 to-gray-700 border-t ${colors[i]} rounded-t-lg opacity-90"></div>
      `;
      podiumEl.appendChild(div);
    });
  };

  // Render List (Rank 4+)
  const renderList = (users) => {
    users.forEach((user, index) => {
      const actualRank = index + 4; // Since we sliced top 3
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-gray-800/50 transition-colors group';
      
      const rankName = user.rank?.name || 'Novice';
      const rankColor = user.rank?.color || '#9ca3af';
      const posts = user.stats?.site_posts_total || 0;

      tr.innerHTML = `
        <td class="p-4 font-bold text-gray-500 w-16">
          #${actualRank}
        </td>
        <td class="p-4">
          <div class="flex items-center gap-3">
            <img src="${user.avatar_url || 'https://ui-avatars.com/api/?name=' + user.username}" class="w-8 h-8 rounded-full bg-gray-700">
            <span class="font-bold text-white group-hover:text-cyan-400 transition-colors cursor-pointer" onclick="window.location.hash='#/profile/${user.username}'">
              ${user.username}
            </span>
          </div>
        </td>
        <td class="p-4 text-right font-mono font-bold text-cyan-400">
          ${user.xp_total.toLocaleString()}
        </td>
        <td class="p-4 text-right text-gray-400 hidden md:table-cell">
          ${posts.toLocaleString()}
        </td>
        <td class="p-4 text-right hidden sm:table-cell">
          <span class="text-xs px-2 py-1 rounded border" style="color:${rankColor}; border-color:${rankColor}; background:${rankColor}10">
            ${rankName}
          </span>
        </td>
      `;
      listEl.appendChild(tr);
    });
  };

  // Event Listeners
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update UI
      filterBtns.forEach(b => {
        b.classList.remove('active', 'bg-cyan-600', 'text-white');
        b.classList.add('bg-gray-800', 'text-gray-400');
      });
      btn.classList.remove('bg-gray-800', 'text-gray-400');
      btn.classList.add('active', 'bg-cyan-600', 'text-white');

      // Reset Data
      currentRange = btn.dataset.range;
      currentPage = 1;
      listEl.innerHTML = '';
      
      // Refetch (In a real app, pass range to DB)
      fetchLeaders(1, currentRange);
    });
  });

  loadMoreBtn.addEventListener('click', () => {
    currentPage++;
    fetchLeaders(currentPage, currentRange);
  });

  // Initial Load
  fetchLeaders(1, 'all');
}
