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
                    <p class="text-gray-400">Join internal brackets or connect via external links.</p>
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
                        <input type="url" id="tourney-link" required placeholder="https://challonge.com/... or https://discord.gg/..." 
                            class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white break-all">
                        <p class="text-xs text-gray-500 mt-1">Users can join internally OR use this external link.</p>
                    </div>

                    <div>
                        <label class="block text-sm text-gray-300 mb-1">Description / Rules</label>
                        <textarea id="tourney-desc" rows="4" placeholder="Full rules, format, bracket info..." class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"></textarea>
                    </div>

                    <button type="submit" class="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg">Create Tournament</button>
                </form>
            </div>
        </div>

        <!-- DETAILS MODAL (New) -->
        <div id="details-modal" class="hidden fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div class="bg-gray-800 rounded-xl border border-purple-500/50 w-full max-w-2xl p-0 relative max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                <!-- Header -->
                <div class="p-6 border-b border-gray-700 bg-gray-900/50 flex justify-between items-start">
                    <div>
                        <h2 id="details-title" class="text-2xl font-bold text-white mb-1"></h2>
                        <div class="flex items-center gap-2 text-sm text-gray-400">
                            <span id="details-game" class="text-purple-400 font-bold"></span>
                            <span>•</span>
                            <span id="details-date"></span>
                        </div>
                    </div>
                    <button id="close-details-modal" class="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>

                <!-- Content -->
                <div class="p-6 overflow-y-auto flex-1 space-y-6">
                    <!-- Stats Row -->
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-gray-900 p-3 rounded border border-gray-700">
                            <div class="text-xs text-gray-500 uppercase">Organizer</div>
                            <div id="details-organizer" class="font-bold text-white truncate"></div>
                        </div>
                        <div class="bg-gray-900 p-3 rounded border border-gray-700">
                            <div class="text-xs text-gray-500 uppercase">Players Joined</div>
                            <div id="details-count" class="font-bold text-green-400 text-lg">0</div>
                        </div>
                    </div>

                    <!-- Description -->
                    <div>
                        <h3 class="text-lg font-bold text-white mb-2 border-b border-gray-700 pb-1">📜 Rules & Description</h3>
                        <div id="details-desc" class="text-gray-300 text-sm leading-relaxed whitespace-pre-line"></div>
                    </div>

                    <!-- Participants List (Preview) -->
                    <div>
                        <h3 class="text-lg font-bold text-white mb-2 border-b border-gray-700 pb-1">👥 Recent Participants</h3>
                        <div id="details-participants" class="flex flex-wrap gap-2">
                            <div class="text-gray-500 text-sm">Loading participants...</div>
                        </div>
                    </div>
                </div>

                <!-- Footer Actions -->
                <div class="p-6 border-t border-gray-700 bg-gray-900/50 flex flex-col sm:flex-row gap-3">
                    <button id="btn-join-internal" class="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2">
                        <span>📝</span> Join Tournament (Internal)
                    </button>
                    <a id="btn-join-external" href="#" target="_blank" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition text-center flex items-center justify-center gap-2">
                        <span>🔗</span> Open External Link
                    </a>
                    <button id="btn-edit-tourney" class="hidden bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition">
                        ✏️ Edit
                    </button>
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

        // Internal Join Button
        document.getElementById('btn-join-internal')?.addEventListener('click', () => handleInternalJoin(rom));
        
        // Edit Button
        document.getElementById('btn-edit-tourney')?.addEventListener('click', () => openEditFromDetails(rom));

        await loadGameSuggestions(rom);
    }

    // Close Details Modal
    document.getElementById('close-details-modal')?.addEventListener('click', () => closeDetailsModal());

    // Setup Filters
    const searchInput = document.getElementById('filter-search');
    const statusFilter = document.getElementById('filter-status');
    
    if(searchInput) searchInput.addEventListener('input', () => renderList(rom));
    if(statusFilter) statusFilter.addEventListener('change', () => renderList(rom));

    await renderList(rom);
}

// --- Global Functions for HTML Onclick ---

window.openDetailsModal = async function(tourneyId, rom) {
    const modal = document.getElementById('details-modal');
    if (!modal) return;
    
    // Fetch Full Data
    const { data: tourney, error } = await rom.supabase
        .from('tournaments')
        .select('*')
        .eq('id', tourneyId)
        .single();
    
    if (error || !tourney) return alert('Tournament not found');

    // Populate Details
    document.getElementById('details-title').textContent = tourney.title;
    document.getElementById('details-game').textContent = tourney.game_title;
    
    const dateObj = new Date(tourney.start_date);
    document.getElementById('details-date').textContent = dateObj.toLocaleString();
    
    document.getElementById('details-organizer').textContent = tourney.organizer_username || 'Unknown';
    document.getElementById('details-desc').textContent = tourney.description || 'No description provided.';
    
    // External Link
    const extBtn = document.getElementById('btn-join-external');
    extBtn.href = tourney.registration_link;
    
    // Show/Hide Edit Button (Only for organizer)
    const editBtn = document.getElementById('btn-edit-tourney');
    if (rom.currentUser && rom.currentUser.id === tourney.organizer_id) {
        editBtn.classList.remove('hidden');
        editBtn.onclick = () => openEditFromDetails(rom, tourney);
    } else {
        editBtn.classList.add('hidden');
    }

    // Load Participant Count & List
    loadParticipantData(rom, tourneyId);

    // Store ID for Join Action
    modal.dataset.tourneyId = tourneyId;
    modal.classList.remove('hidden');
};

window.closeDetailsModal = function() {
    const modal = document.getElementById('details-modal');
    if (modal) modal.classList.add('hidden');
};

window.openTourneyModal = function() {
    const modal = document.getElementById('tourney-modal');
    if (modal) {
        document.getElementById('modal-title').textContent = '🏆 Host a Tournament';
        document.getElementById('edit-tourney-id').value = '';
        document.getElementById('tourney-form').reset();
        modal.classList.remove('hidden');
    }
};

window.closeTourneyModal = function() {
    const modal = document.getElementById('tourney-modal');
    if (modal) modal.classList.add('hidden');
};

// Aliases
const openModal = window.openTourneyModal;
const closeModal = window.closeTourneyModal;

// --- Helper Functions ---

async function loadParticipantData(rom, tourneyId) {
    const countEl = document.getElementById('details-count');
    const listEl = document.getElementById('details-participants');
    
    // Fetch participants
    const { data: participants, error } = await rom.supabase
        .from('tournament_participants')
        .select('user_id, joined_at, profiles(username, avatar_url)')
        .eq('tournament_id', tourneyId)
        .order('joined_at', { ascending: false });

    if (error || !participants) {
        countEl.textContent = '0';
        listEl.innerHTML = '<div class="text-gray-500 text-sm">No participants yet.</div>';
        return;
    }

    countEl.textContent = participants.length;

    if (participants.length === 0) {
        listEl.innerHTML = '<div class="text-gray-500 text-sm">Be the first to join!</div>';
    } else {
        listEl.innerHTML = participants.slice(0, 8).map(p => {
            const user = p.profiles;
            const name = user?.username || 'Anonymous';
            const avatar = user?.avatar_url || `https://ui-avatars.com/api/?name=${name}&background=10b981&color=fff`;
            return `
                <div class="flex items-center gap-2 bg-gray-900 px-2 py-1 rounded border border-gray-700">
                    <img src="${avatar}" class="w-5 h-5 rounded-full">
                    <span class="text-xs text-gray-300">${name}</span>
                </div>
            `;
        }).join('');
        if (participants.length > 8) {
            listEl.innerHTML += `<div class="text-xs text-gray-500 self-center">+${participants.length - 8} more</div>`;
        }
    }
}

async function handleInternalJoin(rom) {
    const modal = document.getElementById('details-modal');
    const tourneyId = modal?.dataset.tourneyId;
    
    if (!tourneyId || !rom.currentUser) return alert('Please log in to join.');

    const btn = document.getElementById('btn-join-internal');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Joining...';

    try {
        // Check if already joined
        const { data: existing } = await rom.supabase
            .from('tournament_participants')
            .select('id')
            .eq('tournament_id', tourneyId)
            .eq('user_id', rom.currentUser.id)
            .single();

        if (existing) return alert('You have already joined this tournament!');

        const { error } = await rom.supabase.from('tournament_participants').insert([{
            tournament_id: tourneyId,
            user_id: rom.currentUser.id
        }]);

        if (error) throw error;

        alert('✅ Successfully joined! Good luck.');
        loadParticipantData(rom, tourneyId); // Refresh count
    } catch (err) {
        alert('Error joining: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function openEditFromDetails(rom, tourneyData = null) {
    closeDetailsModal();
    setTimeout(() => {
        openModal();
        const modal = document.getElementById('tourney-modal');
        document.getElementById('modal-title').textContent = '✏️ Edit Tournament';
        
        if (tourneyData) {
            document.getElementById('edit-tourney-id').value = tourneyData.id;
            document.getElementById('tourney-game').value = tourneyData.game_title;
            document.getElementById('tourney-title').value = tourneyData.title;
            
            // Format date for input
            const dateObj = new Date(tourneyData.start_date);
            dateObj.setMinutes(dateObj.getMinutes() - dateObj.getTimezoneOffset());
            document.getElementById('tourney-date').value = dateObj.toISOString().slice(0, 16);
            
            document.getElementById('tourney-platform').value = tourneyData.platform || '';
            document.getElementById('tourney-prize').value = tourneyData.prize_pool || '';
            document.getElementById('tourney-status').value = tourneyData.status;
            document.getElementById('tourney-link').value = tourneyData.registration_link;
            document.getElementById('tourney-desc').value = tourneyData.description || '';
        }
    }, 300);
}

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
    btn.textContent = 'Saving...';

    try {
        let error;
        
        if (editId) {
            // UPDATE
            const { error: updError } = await rom.supabase
                .from('tournaments')
                .update({
                    game_title: gameTitle,
                    title: title,
                    start_date: new Date(startDate).toISOString(),
                    platform: platform,
                    prize_pool: prizePool,
                    status: status,
                    registration_link: regLink,
                    description: description,
                    updated_at: new Date().toISOString()
                })
                .eq('id', editId)
                .eq('organizer_id', rom.currentUser.id); // Security check
            error = updError;
        } else {
            // INSERT
            const { data: profile } = await rom.supabase.from('profiles').select('username, avatar_url').eq('id', rom.currentUser.id).single();
            const organizerUsername = profile?.username || rom.currentUser.email.split('@')[0];
            const organizerAvatar = profile?.avatar_url;

            const { error: insError } = await rom.supabase.from('tournaments').insert([{
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

        // Pre-fetch game data
        const gameTitles = [...new Set(filtered.map(t => t.game_title))];
        const { data: gamesData } = await rom.supabase.from('games').select('title, slug, cover_image_url').in('title', gameTitles);
        const gameMap = {};
        if(gamesData) gamesData.forEach(g => gameMap[g.title] = g);

        // Pre-fetch participant counts (Optional optimization, otherwise fetch on click)
        // For now, we'll just show a generic icon, real count loads in modal

        container.innerHTML = filtered.map(t => {
            const gameInfo = gameMap[t.game_title] || {};
            const coverUrl = gameInfo.cover_image_url || 'https://via.placeholder.com/400x220/1f2937/6b7280?text=No+Cover';
            const gameSlug = gameInfo.slug;
            const gameLink = gameSlug ? `#/game/${gameSlug}` : `#/games?search=${encodeURIComponent(t.game_title)}`;
            
            const dateObj = new Date(t.start_date);
            const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

            const orgName = t.organizer_username || 'Unknown';
            const orgAvatar = t.organizer_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(orgName)}&background=8b5cf6&color=fff`;
            const orgLink = `#/profile/${orgName}`; 

            let statusColor = 'bg-gray-700 text-gray-300';
            if(t.status === 'open') statusColor = 'bg-green-900/50 text-green-400 border-green-700';
            if(t.status === 'live') statusColor = 'bg-red-900/50 text-red-400 border-red-700';
            if(t.status === 'completed') statusColor = 'bg-blue-900/50 text-blue-400 border-blue-700';

            return `
                <div class="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-purple-500 transition shadow-lg flex flex-col h-full cursor-pointer group" 
                     onclick="window.openDetailsModal('${t.id}', window.rom)">
                    
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
                        
                        <div class="flex items-center gap-2 mb-4 text-sm">
                            <span class="text-gray-400">Host:</span>
                            <span class="text-purple-300 font-bold">${escapeHtml(orgName)}</span>
                        </div>

                        <div class="grid grid-cols-2 gap-2 text-sm text-gray-400 mb-4">
                            <div>📅 ${dateStr}</div>
                            <div>🕒 ${timeStr}</div>
                        </div>

                        ${t.description ? `<p class="text-gray-500 text-xs mb-4 line-clamp-2 italic">"${escapeHtml(t.description)}"</p>` : ''}

                        <!-- Action Buttons (Stop Propagation so they don't open modal) -->
                        <div class="mt-auto pt-4 border-t border-gray-700 flex flex-col gap-2" onclick="event.stopPropagation()">
                            <a href="${t.registration_link}" target="_blank" 
                               class="block w-full text-center bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-2 rounded transition">
                                🔗 External Link
                            </a>
                            ${rom.currentUser ? `
                                <button onclick="window.openDetailsModal('${t.id}', window.rom)" 
                                    class="block w-full text-center bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold py-2 rounded transition">
                                    📝 View Details & Join
                                </button>
                            ` : ''}
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
