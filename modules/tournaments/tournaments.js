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

        <!-- CREATE/EDIT MODAL -->
        <div id="tourney-modal" class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div class="bg-gray-800 rounded-xl border border-gray-600 w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
                <button id="close-tourney-modal" class="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">&times;</button>
                <h2 id="modal-title" class="text-2xl font-bold text-white mb-4">🏆 Host a Tournament</h2>
                
                <form id="tourney-form" class="space-y-4">
                    <input type="hidden" id="edit-tourney-id">
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
                        <label class="block text-sm text-gray-300 mb-1">External Link (Discord/Challonge) *</label>
                        <input type="url" id="tourney-link" required placeholder="https://discord.gg/... or https://challonge.com/..." 
                            class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white break-all">
                        <p class="text-xs text-gray-500 mt-1">Users will be sent here for brackets/chat.</p>
                    </div>

                    <div>
                        <label class="block text-sm text-gray-300 mb-1">Description / Rules</label>
                        <textarea id="tourney-desc" rows="3" placeholder="Rules, format, etc." class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"></textarea>
                    </div>

                    <button type="submit" class="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg">Create Tournament</button>
                </form>
            </div>
        </div>

        <!-- DETAILS MODAL (View Full Info, Join, External Link) -->
        <div id="details-modal" class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div class="bg-gray-800 rounded-xl border border-gray-600 w-full max-w-2xl p-6 relative max-h-[90vh] overflow-y-auto">
                <button id="close-details-modal" class="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">&times;</button>
                
                <div id="details-content">
                    <!-- Content injected dynamically -->
                    <div class="text-center py-8 text-gray-400">Loading details...</div>
                </div>
            </div>
        </div>
    `;

    // 2. Initialize Logic
    if (rom.currentUser) {
        const btn = document.getElementById('btn-new-tourney');
        if(btn) btn.addEventListener('click', () => openModal());
        
        const closeBtn = document.getElementById('close-tourney-modal');
        if(closeBtn) closeBtn.addEventListener('click', () => closeModal());
        
        const form = document.getElementById('tourney-form');
        if(form) form.addEventListener('submit', (e) => handlePost(e, rom));

        await loadGameSuggestions(rom);
    }

    // Details Modal Listeners
    const closeDetailsBtn = document.getElementById('close-details-modal');
    if(closeDetailsBtn) closeDetailsBtn.addEventListener('click', () => closeDetailsModal());

    // Setup Filters
    const searchInput = document.getElementById('filter-search');
    const statusFilter = document.getElementById('filter-status');
    
    if(searchInput) searchInput.addEventListener('input', () => renderList(rom));
    if(statusFilter) statusFilter.addEventListener('change', () => renderList(rom));

    await renderList(rom);
}

// --- Global Functions for HTML OnClick ---

window.openTourneyModal = function() {
    const modal = document.getElementById('tourney-modal');
    if (modal) modal.classList.remove('hidden');
};

window.closeTourneyModal = function() {
    const modal = document.getElementById('tourney-modal');
    if (modal) modal.classList.add('hidden');
    const form = document.getElementById('tourney-form');
    if(form) {
        form.reset();
        document.getElementById('edit-tourney-id').value = '';
        document.getElementById('modal-title').textContent = '🏆 Host a Tournament';
    }
};

window.openDetailsModal = async function(tournamentId) {
    const modal = document.getElementById('details-modal');
    const content = document.getElementById('details-content');
    if (!modal || !content) return;

    modal.classList.remove('hidden');
    content.innerHTML = `<div class="text-center py-8 text-gray-400">Loading details...</div>`;

    try {
        // Fetch Tournament Data
        const { data: tourney, error } = await window.rom.supabase
            .from('tournaments')
            .select('*')
            .eq('id', tournamentId)
            .single();

        if (error || !tourney) throw error;

        // Fetch Participant Count
        const { count, error: countErr } = await window.rom.supabase
            .from('tournament_participants')
            .select('*', { count: 'exact', head: true })
            .eq('tournament_id', tournamentId);

        const participantCount = count || 0;

        // Check if current user has joined
        let hasJoined = false;
        if (window.rom.currentUser) {
            const { data: myEntry } = await window.rom.supabase
                .from('tournament_participants')
                .select('id')
                .eq('tournament_id', tournamentId)
                .eq('user_id', window.rom.currentUser.id)
                .single();
            hasJoined = !!myEntry;
        }

        // Check if user is organizer
        const isOrganizer = window.rom.currentUser && window.rom.currentUser.id === tourney.organizer_id;

        // Render Details
        const dateObj = new Date(tourney.start_date);
        const dateStr = dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

        content.innerHTML = `
            <div class="border-b border-gray-700 pb-4 mb-4">
                <h2 class="text-3xl font-bold text-white mb-2">${escapeHtml(tourney.title)}</h2>
                <div class="flex items-center gap-2 text-purple-400 font-bold">
                    <span>🎮 ${escapeHtml(tourney.game_title)}</span>
                    <span>•</span>
                    <span class="${tourney.status === 'open' ? 'text-green-400' : 'text-gray-400'} uppercase text-sm">${tourney.status}</span>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4 mb-6 bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                <div>
                    <span class="text-xs text-gray-500 uppercase block">Start Date</span>
                    <span class="text-white font-medium">${dateStr} @ ${timeStr}</span>
                </div>
                <div>
                    <span class="text-xs text-gray-500 uppercase block">Platform</span>
                    <span class="text-white font-medium">${tourney.platform || 'Any'}</span>
                </div>
                <div>
                    <span class="text-xs text-gray-500 uppercase block">Prize Pool</span>
                    <span class="text-yellow-400 font-medium">${tourney.prize_pool || 'TBD'}</span>
                </div>
                <div>
                    <span class="text-xs text-gray-500 uppercase block">Players Joined</span>
                    <span class="text-cyan-400 font-bold text-lg">${participantCount} <span class="text-xs text-gray-500 font-normal">registered</span></span>
                </div>
            </div>

            <div class="mb-6">
                <h3 class="text-lg font-bold text-white mb-2">📜 Rules & Description</h3>
                <div class="bg-gray-900/50 p-4 rounded-lg border border-gray-700 text-gray-300 whitespace-pre-line leading-relaxed">
                    ${tourney.description ? escapeHtml(tourney.description) : '<span class="italic text-gray-500">No description provided.</span>'}
                </div>
            </div>

            <div class="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-700">
                ${isOrganizer ? `
                    <button onclick="editTournament('${tourney.id}')" class="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2">
                        ✏️ Edit Tournament
                    </button>
                ` : ''}
                
                ${!isOrganizer && window.rom.currentUser ? (
                    hasJoined 
                    ? `<button disabled class="flex-1 bg-green-900/50 border border-green-700 text-green-400 font-bold py-3 rounded-lg cursor-default flex items-center justify-center gap-2">✓ Registered</button>`
                    : `<button onclick="joinTournament('${tourney.id}', '${tourney.registration_link}')" class="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2">📝 Join Tournament</button>`
                ) : ''}

                <a href="${tourney.registration_link}" target="_blank" rel="noopener noreferrer" 
                   class="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg transition text-center flex items-center justify-center gap-2">
                    🔗 Open External Link
                </a>
            </div>
        `;
    } catch (err) {
        console.error('Error loading details:', err);
        content.innerHTML = `<div class="text-center py-8 text-red-400">Error loading details: ${err.message}</div>`;
    }
};

window.closeDetailsModal = function() {
    const modal = document.getElementById('details-modal');
    if (modal) modal.classList.add('hidden');
};

window.joinTournament = async function(tournamentId, externalLink) {
    if (!window.rom.currentUser) {
        alert('Please log in to join.');
        return;
    }

    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '⏳ Joining...';

    try {
        // 1. Register Internally
        const { error } = await window.rom.supabase.from('tournament_participants').insert([{
            tournament_id: tournamentId,
            user_id: window.rom.currentUser.id,
            status: 'joined'
        }]);

        if (error) throw error;

        alert('✅ You have successfully joined! Opening external link...');
        
        // 2. Open External Link in New Tab
        window.open(externalLink, '_blank');

        // Refresh modal to show updated count/state
        setTimeout(() => window.openDetailsModal(tournamentId), 1000);

    } catch (err) {
        console.error('Join error:', err);
        alert('❌ Failed to join: ' + err.message);
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

window.editTournament = function(tournamentId) {
    // Close details modal
    window.closeDetailsModal();
    // Open edit modal
    openModal(tournamentId);
};

// Aliases
const openModal = async (editId = null) => {
    const modal = document.getElementById('tourney-modal');
    const titleEl = document.getElementById('modal-title');
    const form = document.getElementById('tourney-form');
    const idInput = document.getElementById('edit-tourney-id');
    
    if (!modal) return;

    if (editId) {
        // Load existing data for editing
        titleEl.textContent = '✏️ Edit Tournament';
        idInput.value = editId;
        
        const { data, error } = await window.rom.supabase.from('tournaments').select('*').eq('id', editId).single();
        if (data && !error) {
            document.getElementById('tourney-game').value = data.game_title;
            document.getElementById('tourney-title').value = data.title;
            document.getElementById('tourney-date').value = data.start_date.slice(0, 16); // Format for datetime-local
            document.getElementById('tourney-platform').value = data.platform || '';
            document.getElementById('tourney-prize').value = data.prize_pool || '';
            document.getElementById('tourney-status').value = data.status;
            document.getElementById('tourney-link').value = data.registration_link;
            document.getElementById('tourney-desc').value = data.description || '';
        }
    } else {
        // Reset for new
        titleEl.textContent = '🏆 Host a Tournament';
        form.reset();
        idInput.value = '';
    }

    modal.classList.remove('hidden');
};

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

    const editId = document.getElementById('edit-tourney-id').value;
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
    btn.textContent = editId ? 'Updating...' : 'Creating...';

    try {
        let payload = {
            game_title: gameTitle,
            title: title,
            start_date: new Date(startDate).toISOString(),
            platform: platform,
            prize_pool: prizePool,
            status: status,
            registration_link: regLink,
            description: description
        };

        let error;
        if (editId) {
            // Update existing
            const { error: updError } = await rom.supabase.from('tournaments').update(payload).eq('id', editId);
            error = updError;
        } else {
            // Create new
            const { data: profile } = await rom.supabase.from('profiles').select('username, avatar_url').eq('id', rom.currentUser.id).single();
            const organizerUsername = profile?.username || rom.currentUser.email.split('@')[0];
            const organizerAvatar = profile?.avatar_url;

            payload.organizer_id = rom.currentUser.id;
            payload.organizer_username = organizerUsername;
            payload.organizer_avatar = organizerAvatar;

            const { error: insError } = await rom.supabase.from('tournaments').insert([payload]);
            error = insError;
        }

        if (error) throw error;

        alert(editId ? '✅ Tournament updated!' : '✅ Tournament created!');
        closeModal();
        await renderList(rom);

    } catch (err) {
        console.error('Error saving tournament:', err);
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
                <div onclick="window.openDetailsModal('${t.id}')" class="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-purple-500 transition shadow-lg flex flex-col h-full cursor-pointer group">
                    <!-- Header Image -->
                    <div class="relative h-40 w-full overflow-hidden">
                        <img src="${coverUrl}" alt="${t.game_title}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500">
                        <div class="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"></div>
                        <div class="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                            <span class="text-lg font-bold text-white drop-shadow-md hover:text-purple-400 transition truncate max-w-[70%]">
                                ${escapeHtml(t.game_title)}
                            </span>
                            <span class="px-2 py-1 rounded text-xs font-bold border ${statusColor} uppercase">${t.status}</span>
                        </div>
                    </div>

                    <div class="p-5 flex-1 flex flex-col">
                        <h3 class="text-xl font-bold text-white mb-2 line-clamp-1">${escapeHtml(t.title)}</h3>
                        
                        <!-- Organizer -->
                        <div class="flex items-center gap-2 mb-4 text-sm">
                            <span class="text-gray-400 text-xs">Host:</span>
                            <span class="text-gray-300 font-medium">${escapeHtml(orgName)}</span>
                        </div>

                        <!-- Details Grid -->
                        <div class="grid grid-cols-2 gap-2 text-sm text-gray-400 mb-4">
                            <div class="flex items-center gap-1"><span>📅</span> ${dateStr}</div>
                            <div class="flex items-center gap-1"><span>🕒</span> ${timeStr}</div>
                            <div class="flex items-center gap-1"><span>🎮</span> ${t.platform || 'Any'}</div>
                            <div class="flex items-center gap-1"><span>💰</span> ${t.prize_pool || 'TBD'}</div>
                        </div>

                        ${t.description ? `<p class="text-gray-500 text-xs mb-4 line-clamp-2">${escapeHtml(t.description)}</p>` : ''}

                        <!-- Action Hint -->
                        <div class="mt-auto pt-4 border-t border-gray-700 text-center text-xs text-purple-400 font-bold group-hover:text-purple-300">
                            Click to View Details & Join
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
