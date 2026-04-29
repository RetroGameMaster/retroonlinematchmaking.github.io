export default async function initTournaments(rom) {
    console.log('🏆 Initializing Tournaments Module...');
    
    const content = document.getElementById('app-content');
    if (!content) return;

    // 1. Render HTML
    content.innerHTML = `
        <div class="max-w-7xl mx-auto p-4">
            <div class="flex justify-between items-center mb-8">
                <div>
                    <h1 class="text-4xl font-bold text-white mb-2">🏆 Community Tournaments</h1>
                    <p class="text-gray-400">Join or host competitive events. Prizes, glory, and bragging rights.</p>
                </div>
                ${rom.currentUser ? 
                    '<button id="btn-new-tourney" class="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg transition flex items-center gap-2"><span>➕</span> Host Tournament</button>' : 
                    '<button onclick="window.location.hash=\'#/auth\'" class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-bold">Log In to Host</button>'
                }
            </div>

            <!-- Filters -->
            <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-6 flex flex-wrap gap-4">
                <select id="filter-status" class="bg-gray-900 border border-gray-600 text-white rounded px-3 py-2">
                    <option value="">All Statuses</option>
                    <option value="open">Registration Open</option>
                    <option value="live">Live Now</option>
                    <option value="completed">Completed</option>
                </select>
                <input type="text" id="filter-search" placeholder="Search games..." class="bg-gray-900 border border-gray-600 text-white rounded px-3 py-2 flex-1">
            </div>

            <!-- Grid -->
            <div id="tourney-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div class="col-span-full text-center py-12 text-gray-500">Loading tournaments...</div>
            </div>
        </div>

        <!-- Modal -->
        <div id="tourney-modal" class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div class="bg-gray-800 rounded-xl border border-gray-600 w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
                <button id="close-tourney-modal" class="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">&times;</button>
                <h2 class="text-2xl font-bold text-white mb-4">🏆 Host a Tournament</h2>
                
                <form id="tourney-form" class="space-y-4">
                    <div>
                        <label class="block text-sm text-gray-300 mb-1">Game Title *</label>
                        <input type="text" id="tourney-game" list="game-suggestions" required 
                            class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white focus:border-purple-500 focus:outline-none"
                            placeholder="Start typing to search games...">
                        <datalist id="game-suggestions"></datalist>
                    </div>

                    <div>
                        <label class="block text-sm text-gray-300 mb-1">Tournament Name *</label>
                        <input type="text" id="tourney-title" required placeholder="e.g. Summer Smash Bros Finals" 
                            class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white">
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">Start Date & Time *</label>
                            <input type="datetime-local" id="tourney-date" required class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">Platform</label>
                            <input type="text" id="tourney-platform" placeholder="e.g. PS2, PC" class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">Prize Pool</label>
                            <input type="text" id="tourney-prize" placeholder="e.g. $50 PayPal, Steam Key" class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">Status</label>
                            <select id="tourney-status" class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white">
                                <option value="open">Registration Open</option>
                                <option value="live">Live Now</option>
                                <option value="completed">Completed</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm text-gray-300 mb-1">Registration Link (External) *</label>
                        <input type="url" id="tourney-link" required placeholder="https://challonge.com/... , https://discord.gg/... " 
                            class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white break-all">
                        <p class="text-xs text-gray-500 mt-1">Users will see this link before clicking register.</p>
                    </div>

                    <div>
                        <label class="block text-sm text-gray-300 mb-1">Description / Rules</label>
                        <textarea id="tourney-desc" rows="3" placeholder="Rules, format, etc." class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"></textarea>
                    </div>

                    <button type="submit" class="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg">Create Tournament</button>
                </form>
            </div>
        </div>
    `;

    // 2. Initialize Logic
    if (rom.currentUser) {
        const btn = document.getElementById('btn-new-tourney');
        if(btn) btn.addEventListener('click', openModal);
        
        const closeBtn = document.getElementById('close-tourney-modal');
        if(closeBtn) closeBtn.addEventListener('click', closeModal);
        
        const form = document.getElementById('tourney-form');
        if(form) form.addEventListener('submit', (e) => handlePost(e, rom));

        await loadGameSuggestions(rom);
    }

    // Setup Filters
    const searchInput = document.getElementById('filter-search');
    const statusFilter = document.getElementById('filter-status');
    
    if(searchInput) searchInput.addEventListener('input', () => renderList(rom));
    if(statusFilter) statusFilter.addEventListener('change', () => renderList(rom));

    await renderList(rom);
}

// --- Global Functions ---

window.openTourneyModal = function() {
    const modal = document.getElementById('tourney-modal');
    if (modal) modal.classList.remove('hidden');
};

window.closeTourneyModal = function() {
    const modal = document.getElementById('tourney-modal');
    if (modal) modal.classList.add('hidden');
    const form = document.getElementById('tourney-form');
    if(form) form.reset();
};

// Aliases for internal use
const openModal = window.openTourneyModal;
const closeModal = window.closeTourneyModal;

async function loadGameSuggestions(rom) {
    const datalist = document.getElementById('game-suggestions');
    if (!datalist) return;
    try {
        const { data, error } = await rom.supabase.from('games').select('title').order('title', { ascending: true }).limit(100);
        if (error) throw error;
        if (data) {
            datalist.innerHTML = data.map(game => `<option value="${escapeHtml(game.title)}">`).join('');
        }
    } catch (err) {
        console.error('Error loading game suggestions:', err);
    }
}

async function handlePost(e, rom) {
    e.preventDefault();

    const gameTitle = document.getElementById('tourney-game').value.trim();
    const title = document.getElementById('tourney-title').value.trim();
    const startDate = document.getElementById('tourney-date').value;
    const platform = document.getElementById('tourney-platform').value.trim();
    const prizePool = document.getElementById('tourney-prize').value.trim();
    const status = document.getElementById('tourney-status').value;
    const regLink = document.getElementById('tourney-link').value.trim();
    const description = document.getElementById('tourney-desc').value.trim();

    if (!gameTitle || !title || !startDate || !regLink) {
        alert('Please fill in all required fields.');
        return;
    }

    const btn = document.querySelector('#tourney-form button[type="submit"]');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
        // Fetch organizer profile info
        const { data: profile } = await rom.supabase.from('profiles').select('username, avatar_url').eq('id', rom.currentUser.id).single();
        const organizerUsername = profile?.username || rom.currentUser.email.split('@')[0];
        const organizerAvatar = profile?.avatar_url;

        const { error } = await rom.supabase.from('tournaments').insert([{
            organizer_id: rom.currentUser.id,
            organizer_username: organizerUsername,
            organizer_avatar: organizerAvatar,
            game_title: gameTitle,
            title: title,
            start_date: new Date(startDate).toISOString(),
            platform: platform,
            prize_pool: prizePool,
            status: status,
            registration_link: regLink,
            description: description
        }]);

        if (error) throw error;

        alert('✅ Tournament created!');
        closeModal();
        await renderList(rom);

    } catch (err) {
        console.error('Error posting tournament:', err);
        alert('❌ Error: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function renderList(rom) {
    const container = document.getElementById('tourney-grid');
    if (!container) return;

    container.innerHTML = `<div class="col-span-full text-center py-8 text-gray-400">Loading...</div>`;

    try {
        const { data, error } = await rom.supabase
            .from('tournaments')
            .select('*')
            .order('start_date', { ascending: true });

        if (error) throw error;

        // Apply Filters
        const searchVal = document.getElementById('filter-search')?.value.toLowerCase() || '';
        const statusVal = document.getElementById('filter-status')?.value || '';

        let filtered = data || [];
        if (searchVal) filtered = filtered.filter(t => t.game_title && t.game_title.toLowerCase().includes(searchVal));
        if (statusVal) filtered = filtered.filter(t => t.status === statusVal);

        if (filtered.length === 0) {
            container.innerHTML = `<div class="col-span-full text-center py-12 text-gray-500">No tournaments found.</div>`;
            return;
        }

        // Pre-fetch game data for images/slugs
        const gameTitles = [...new Set(filtered.map(t => t.game_title))];
        const { data: gamesData } = await rom.supabase.from('games').select('title, slug, cover_image_url').in('title', gameTitles);
        const gameMap = {};
        if(gamesData) gamesData.forEach(g => gameMap[g.title] = g);

        container.innerHTML = filtered.map(t => {
            const gameInfo = gameMap[t.game_title] || {};
            const coverUrl = gameInfo.cover_image_url || 'https://via.placeholder.com/400x220/1f2937/6b7280?text=No+Cover';
            const gameSlug = gameInfo.slug;
            const gameLink = gameSlug ? `#/game/${gameSlug}` : `#/games?search=${encodeURIComponent(t.game_title)}`;
            
            const dateObj = new Date(t.start_date);
            const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

            // Organizer Info
            const orgName = t.organizer_username || 'Unknown';
            const orgAvatar = t.organizer_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(orgName)}&background=8b5cf6&color=fff`;
            const orgLink = `#/profile/${orgName}`; 

            // Status Badge Color
            let statusColor = 'bg-gray-700 text-gray-300';
            if(t.status === 'open') statusColor = 'bg-green-900/50 text-green-400 border-green-700';
            if(t.status === 'live') statusColor = 'bg-red-900/50 text-red-400 border-red-700';
            if(t.status === 'completed') statusColor = 'bg-blue-900/50 text-blue-400 border-blue-700';

            return `
                <div class="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-purple-500 transition shadow-lg flex flex-col h-full">
                    <!-- Header Image -->
                    <div class="relative h-40 w-full overflow-hidden group">
                        <img src="${coverUrl}" alt="${t.game_title}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500">
                        <div class="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"></div>
                        <div class="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                            <a href="${gameLink}" class="text-lg font-bold text-white drop-shadow-md hover:text-purple-400 transition truncate max-w-[70%]">
                                ${escapeHtml(t.game_title)} ↗
                            </a>
                            <span class="px-2 py-1 rounded text-xs font-bold border ${statusColor} uppercase">${t.status}</span>
                        </div>
                    </div>

                    <div class="p-5 flex-1 flex flex-col">
                        <h3 class="text-xl font-bold text-white mb-2 line-clamp-1">${escapeHtml(t.title)}</h3>
                        
                        <!-- Organizer -->
                        <div class="flex items-center gap-2 mb-4 text-sm">
                            <a href="${orgLink}" class="flex items-center gap-2 hover:bg-gray-700 p-1 rounded transition">
                                <img src="${orgAvatar}" class="w-6 h-6 rounded-full border border-purple-500">
                                <span class="text-gray-300 hover:text-white">Host: ${escapeHtml(orgName)}</span>
                            </a>
                        </div>

                        <!-- Details Grid -->
                        <div class="grid grid-cols-2 gap-2 text-sm text-gray-400 mb-4">
                            <div class="flex items-center gap-1"><span>📅</span> ${dateStr}</div>
                            <div class="flex items-center gap-1"><span>🕒</span> ${timeStr}</div>
                            <div class="flex items-center gap-1"><span>🎮</span> ${t.platform || 'Any'}</div>
                            <div class="flex items-center gap-1"><span>💰</span> ${t.prize_pool || 'TBD'}</div>
                        </div>

                        ${t.description ? `<p class="text-gray-500 text-xs mb-4 line-clamp-2">${escapeHtml(t.description)}</p>` : ''}

                        <!-- Registration Section -->
                        <div class="mt-auto pt-4 border-t border-gray-700">
                            <div class="mb-3">
                                <span class="text-xs text-gray-500 block mb-1">Registration Link:</span>
                                <a href="${t.registration_link}" target="_blank" rel="noopener noreferrer" 
                                   class="text-xs text-purple-400 hover:text-purple-300 hover:underline break-all block">
                                    ${t.registration_link}
                                </a>
                            </div>
                            <a href="${t.registration_link}" target="_blank" rel="noopener noreferrer" 
                               class="block w-full text-center bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded-lg transition shadow-lg">
                                Register Now
                            </a>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Error loading tournaments:', err);
        container.innerHTML = `<div class="col-span-full text-center py-8 text-red-400">Error: ${err.message}</div>`;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// HELPER FOR HOME PAGE TICKER
// ============================================================================

/**
 * Fetches recent open tournaments formatted for the scrolling marquee
 */
export async function getRecentTournamentsForTicker(rom) {
    try {
        const { data, error } = await rom.supabase
            .from('tournaments')
            .select('title, game_title, organizer_username')
            .eq('status', 'open')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error || !data) return [];

        return data.map(tour => ({
            text: `🏆 <strong>${tour.organizer_username}</strong> is hosting a <strong>${tour.game_title}</strong> tournament: ${tour.title}`,
            link: '#/tournaments'
        }));
    } catch (err) {
        console.error('Error fetching tournaments for ticker:', err);
        return [];
    }
}
