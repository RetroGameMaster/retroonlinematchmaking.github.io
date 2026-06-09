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

        <!-- Create/Edit Modal -->
        <div id="tourney-modal" class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div class="bg-gray-800 rounded-xl border border-gray-600 w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
                <button id="close-tourney-modal" class="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">&times;</button>
                <h2 id="modal-title" class="text-2xl font-bold text-white mb-4">🏆 Host a Tournament</h2>
                
                <form id="tourney-form" class="space-y-4">
                    <input type="hidden" id="tourney-id">
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
                        <label class="block text-sm text-gray-300 mb-1">Registration Link (External)</label>
                        <input type="url" id="tourney-link" placeholder="https://challonge.com/... or leave blank for internal join" 
                            class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white break-all">
                        <p class="text-xs text-gray-500 mt-1">Optional. If empty, users join directly via website.</p>
                    </div>

                    <div>
                        <label class="block text-sm text-gray-300 mb-1">Description / Rules *</label>
                        <textarea id="tourney-desc" rows="4" required placeholder="Rules, format, bracket info, etc." class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"></textarea>
                    </div>

                    <button type="submit" class="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg">Save Tournament</button>
                </form>
            </div>
        </div>

        <!-- Details Modal (Read Only) -->
        <div id="details-modal" class="hidden fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div class="bg-gray-800 rounded-xl border border-purple-500/50 w-full max-w-2xl p-0 relative max-h-[90vh] overflow-y-auto shadow-[0_0_50px_rgba(168,85,247,0.3)]">
                <button id="close-details-modal" class="absolute top-4 right-4 bg-black/50 hover:bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center transition">&times;</button>
                
                <div id="details-content">
                    <!-- Injected via JS -->
                </div>
            </div>
        </div>
    `;

    // 2. Initialize Logic
    if (rom.currentUser) {
        const btn = document.getElementById('btn-new-tourney');
        if(btn) btn.addEventListener('click', () => openModal(rom));
        
        const closeBtn = document.getElementById('close-tourney-modal');
        if(closeBtn) closeBtn.addEventListener('click', closeModal);
        
        const form = document.getElementById('tourney-form');
        if(form) form.addEventListener('submit', (e) => handlePost(e, rom));
        
        // Close details modal
        const closeDetailsBtn = document.getElementById('close-details-modal');
        if(closeDetailsBtn) closeDetailsBtn.addEventListener('click', () => {
            document.getElementById('details-modal').classList.add('hidden');
        });

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

window.openTourneyModal = function(rom) { openModal(rom); };
window.closeTourneyModal = function() { closeModal(); };

const openModal = (rom) => {
    // Reset form for new entry
    document.getElementById('tourney-form').reset();
    document.getElementById('tourney-id').value = '';
    document.getElementById('modal-title').textContent = '🏆 Host a Tournament';
    document.getElementById('tourney-modal').classList.remove('hidden');
};

const closeModal = () => {
    document.getElementById('tourney-modal').classList.add('hidden');
};

const openDetailsModal = (tour, isJoined, isOrganizer, rom) => {
    const modal = document.getElementById('details-modal');
    const content = document.getElementById('details-content');
    
    const dateObj = new Date(tour.start_date);
    const dateStr = dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    let actionButtonHTML = '';
    
    // Internal Join Logic
    if (tour.status === 'open') {
        if (!rom.currentUser) {
            actionButtonHTML = `<button onclick="window.location.hash='#/auth'" class="w-full bg-gray-700 text-white font-bold py-3 rounded-lg">Log In to Join</button>`;
        } else if (isJoined) {
            actionButtonHTML = `
                <div class="flex gap-3">
                    <button disabled class="flex-1 bg-green-900/50 border border-green-600 text-green-400 font-bold py-3 rounded-lg cursor-default">✓ Registered</button>
                    <button onclick="handleLeaveTourney('${tour.id}', '${rom.currentUser.id}')" class="px-4 bg-red-900/50 hover:bg-red-700 border border-red-600 text-red-400 font-bold rounded-lg transition">Leave</button>
                </div>
            `;
        } else {
            actionButtonHTML = `<button onclick="handleJoinTourney('${tour.id}', '${rom.currentUser.id}')" class="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg shadow-lg transform hover:scale-[1.02] transition">🚀 Join Tournament</button>`;
        }
    } else {
        actionButtonHTML = `<button disabled class="w-full bg-gray-700 text-gray-500 font-bold py-3 rounded-lg cursor-not-allowed">Registration Closed</button>`;
    }

    // Edit Button (If Organizer or Admin)
    const editBtn = (isOrganizer || rom.currentUser?.user_metadata?.role === 'admin') 
        ? `<button onclick="openEditModal('${tour.id}')" class="mt-3 w-full bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold py-2 rounded border border-gray-500">✏️ Edit Tournament</button>` 
        : '';

    content.innerHTML = `
        <div class="relative h-48 w-full">
            <img src="${tour.cover_url || 'https://via.placeholder.com/800x400/1f2937/6b7280?text=No+Cover'}" class="w-full h-full object-cover opacity-60">
            <div class="absolute inset-0 bg-gradient-to-t from-gray-800 to-transparent"></div>
            <div class="absolute bottom-4 left-6">
                <span class="px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded uppercase">${tour.status}</span>
                <h2 class="text-3xl font-bold text-white mt-2 drop-shadow-lg">${escapeHtml(tour.title)}</h2>
                <p class="text-purple-300 font-medium">🎮 ${escapeHtml(tour.game_title)}</p>
            </div>
        </div>
        
        <div class="p-6 space-y-6">
            <!-- Info Grid -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                <div>
                    <span class="text-xs text-gray-500 uppercase block">Date</span>
                    <span class="text-white font-bold">${dateStr}</span>
                </div>
                <div>
                    <span class="text-xs text-gray-500 uppercase block">Time</span>
                    <span class="text-white font-bold">${timeStr}</span>
                </div>
                <div>
                    <span class="text-xs text-gray-500 uppercase block">Platform</span>
                    <span class="text-white font-bold">${tour.platform || 'Any'}</span>
                </div>
                <div>
                    <span class="text-xs text-gray-500 uppercase block">Prize</span>
                    <span class="text-yellow-400 font-bold">${tour.prize_pool || 'TBD'}</span>
                </div>
            </div>

            <!-- Description -->
            <div>
                <h3 class="text-xl font-bold text-white mb-2 border-b border-gray-700 pb-2">📜 Rules & Description</h3>
                <div class="text-gray-300 leading-relaxed whitespace-pre-line bg-gray-900/30 p-4 rounded border border-gray-700">
                    ${escapeHtml(tour.description)}
                </div>
            </div>

            <!-- Organizer -->
            <div class="flex items-center gap-3 pt-4 border-t border-gray-700">
                <span class="text-gray-400 text-sm">Hosted by:</span>
                <a href="#/profile/${tour.organizer_username}" class="flex items-center gap-2 hover:bg-gray-700 p-1.5 rounded transition">
                    <img src="${tour.organizer_avatar || 'https://ui-avatars.com/api/?name=${tour.organizer_username}'}" class="w-8 h-8 rounded-full border border-purple-500">
                    <span class="text-purple-400 font-bold hover:underline">${escapeHtml(tour.organizer_username)}</span>
                </a>
                <span class="ml-auto text-gray-500 text-sm">👥 ${tour.participant_count || 0} Joined</span>
            </div>

            <!-- Actions -->
            <div class="pt-4">
                ${actionButtonHTML}
                ${editBtn}
                
                ${tour.registration_link && !isJoined ? `
                    <div class="mt-4 text-center">
                        <p class="text-xs text-gray-500 mb-2">Or register via external link:</p>
                        <a href="${tour.registration_link}" target="_blank" class="text-purple-400 hover:text-purple-300 underline break-all">${tour.registration_link}</a>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
};

// Expose join/leave/edit functions to window
window.handleJoinTourney = async (tId, uId) => {
    if(!confirm("Confirm joining this tournament?")) return;
    try {
        const { error } = await window.rom.supabase.from('tournament_participants').insert({ tournament_id: tId, user_id: uId });
        if(error) throw error;
        alert("✅ Successfully joined!");
        document.getElementById('details-modal').classList.add('hidden');
        await renderList(window.rom); // Refresh list
    } catch(err) {
        alert("Error joining: " + err.message);
    }
};

window.handleLeaveTourney = async (tId, uId) => {
    if(!confirm("Are you sure you want to leave?")) return;
    try {
        const { error } = await window.rom.supabase.from('tournament_participants').delete().match({ tournament_id: tId, user_id: uId });
        if(error) throw error;
        alert("You have left the tournament.");
        document.getElementById('details-modal').classList.add('hidden');
        await renderList(window.rom);
    } catch(err) {
        alert("Error leaving: " + err.message);
    }
};

window.openEditModal = async (tId) => {
    // Fetch single tourney data
    const { data } = await window.rom.supabase.from('tournaments').select('*').eq('id', tId).single();
    if(!data) return;

    document.getElementById('tourney-id').value = data.id;
    document.getElementById('tourney-game').value = data.game_title;
    document.getElementById('tourney-title').value = data.title;
    document.getElementById('tourney-date').value = new Date(data.start_date).toISOString().slice(0, 16);
    document.getElementById('tourney-platform').value = data.platform || '';
    document.getElementById('tourney-prize').value = data.prize_pool || '';
    document.getElementById('tourney-status').value = data.status;
    document.getElementById('tourney-link').value = data.registration_link || '';
    document.getElementById('tourney-desc').value = data.description || '';

    document.getElementById('modal-title').textContent = '✏️ Edit Tournament';
    document.getElementById('details-modal').classList.add('hidden'); // Close details
    document.getElementById('tourney-modal').classList.remove('hidden'); // Open form
};

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

    const id = document.getElementById('tourney-id').value;
    const gameTitle = document.getElementById('tourney-game').value.trim();
    const title = document.getElementById('tourney-title').value.trim();
    const startDate = document.getElementById('tourney-date').value;
    const platform = document.getElementById('tourney-platform').value.trim();
    const prizePool = document.getElementById('tourney-prize').value.trim();
    const status = document.getElementById('tourney-status').value;
    const regLink = document.getElementById('tourney-link').value.trim();
    const description = document.getElementById('tourney-desc').value.trim();

    if (!gameTitle || !title || !startDate || !description) {
        alert('Please fill in all required fields.');
        return;
    }

    const btn = document.querySelector('#tourney-form button[type="submit"]');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        // Fetch organizer profile info (only needed for insert, not update)
        let orgData = {};
        if (!id) {
            const { data: profile } = await rom.supabase.from('profiles').select('username, avatar_url').eq('id', rom.currentUser.id).single();
            orgData = {
                organizer_id: rom.currentUser.id,
                organizer_username: profile?.username || rom.currentUser.email.split('@')[0],
                organizer_avatar: profile?.avatar_url
            };
        }

        const payload = {
            game_title: gameTitle,
            title: title,
            start_date: new Date(startDate).toISOString(),
            platform: platform,
            prize_pool: prizePool,
            status: status,
            registration_link: regLink,
            description: description,
            ...orgData
        };

        let error;
        if (id) {
            // Update
            const res = await rom.supabase.from('tournaments').update(payload).eq('id', id);
            error = res.error;
        } else {
            // Insert
            const res = await rom.supabase.from('tournaments').insert([payload]);
            error = res.error;
        }

        if (error) throw error;

        alert(id ? '✅ Tournament Updated!' : '✅ Tournament Created!');
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

        // Pre-fetch game data & Participant Counts
        const gameTitles = [...new Set(filtered.map(t => t.game_title))];
        const { data: gamesData } = await rom.supabase.from('games').select('title, slug, cover_image_url').in('title', gameTitles);
        const gameMap = {};
        if(gamesData) gamesData.forEach(g => gameMap[g.title] = g);

        // Fetch Participant Counts
        const tourneyIds = filtered.map(t => t.id);
        const { data: countsData } = await rom.supabase
            .from('tournament_participants')
            .select('tournament_id', { count: 'exact' })
            .in('tournament_id', tourneyIds);
        
        const countMap = {};
        if(countsData) {
             // Note: Supabase count logic in select might vary, simpler to just group if we had full rows. 
             // Actually, let's do a proper count query per item if the above is tricky, or assume RPC.
             // Simpler approach for now: Just map the count if available, else 0.
             // Better: Use RPC or aggregate. Let's stick to simple mapping if possible, otherwise skip count for perf.
             // Re-doing count fetch properly:
        }
        
        // Proper Count Fetch
        const { data: participantCounts } = await rom.supabase.rpc('get_tournament_counts', { tournament_ids: tourneyIds });
        // Fallback if RPC doesn't exist yet: Just show "Join" without count or fetch individually (slow)
        // Let's assume no RPC and just display "Join" for now to avoid breaking, 
        // OR we can just count locally if we fetched all participants (too heavy).
        // We will skip displaying exact count in the grid card for performance, but show it in details.

        // Check Current User Joins
        let myJoins = [];
        if (rom.currentUser) {
            const { data: joins } = await rom.supabase
                .from('tournament_participants')
                .select('tournament_id')
                .eq('user_id', rom.currentUser.id)
                .in('tournament_id', tourneyIds);
            if(joins) myJoins = joins.map(j => j.tournament_id);
        }

        container.innerHTML = filtered.map(t => {
            const gameInfo = gameMap[t.game_title] || {};
            const coverUrl = gameInfo.cover_image_url || 'https://via.placeholder.com/400x220/1f2937/6b7280?text=No+Cover';
            const gameSlug = gameInfo.slug;
            const gameLink = gameSlug ? `#/game/${gameSlug}` : `#/games?search=${encodeURIComponent(t.game_title)}`;
            
            const dateObj = new Date(t.start_date);
            const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            
            const isJoined = myJoins.includes(t.id);
            const isOrganizer = rom.currentUser && t.organizer_id === rom.currentUser.id;

            let statusColor = 'bg-gray-700 text-gray-300';
            if(t.status === 'open') statusColor = 'bg-green-900/50 text-green-400 border-green-700';
            if(t.status === 'live') statusColor = 'bg-red-900/50 text-red-400 border-red-700';
            if(t.status === 'completed') statusColor = 'bg-blue-900/50 text-blue-400 border-blue-700';

            return `
                <div class="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-purple-500 transition shadow-lg flex flex-col h-full group cursor-pointer" 
                     onclick="openDetailsModal(${JSON.stringify(t).replace(/"/g, '&quot;')}, ${isJoined}, ${isOrganizer}, window.rom)">
                    
                    <!-- Header Image -->
                    <div class="relative h-40 w-full overflow-hidden">
                        <img src="${coverUrl}" alt="${t.game_title}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500">
                        <div class="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"></div>
                        <div class="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                            <a href="${gameLink}" onclick="event.stopPropagation()" class="text-lg font-bold text-white drop-shadow-md hover:text-purple-400 transition truncate max-w-[70%]">
                                ${escapeHtml(t.game_title)} ↗
                            </a>
                            <span class="px-2 py-1 rounded text-xs font-bold border ${statusColor} uppercase">${t.status}</span>
                        </div>
                    </div>

                    <div class="p-5 flex-1 flex flex-col">
                        <h3 class="text-xl font-bold text-white mb-2 line-clamp-1">${escapeHtml(t.title)}</h3>
                        
                        <div class="flex items-center gap-2 mb-4 text-sm">
                            <span class="text-gray-400">📅 ${dateStr}</span>
                            ${isJoined ? '<span class="ml-auto text-green-400 text-xs font-bold flex items-center gap-1">✓ Joined</span>' : ''}
                            ${isOrganizer ? '<span class="ml-auto text-purple-400 text-xs font-bold flex items-center gap-1">✏️ Edit</span>' : ''}
                        </div>

                        <p class="text-gray-500 text-xs mb-4 line-clamp-2">${escapeHtml(t.description)}</p>

                        <div class="mt-auto pt-4 border-t border-gray-700 flex gap-2">
                             ${t.status === 'open' && rom.currentUser ? (
                                 isJoined 
                                 ? `<button onclick="event.stopPropagation(); handleLeaveTourney('${t.id}', '${rom.currentUser.id}')" class="flex-1 bg-gray-700 hover:bg-red-900 text-gray-300 hover:text-red-400 text-xs font-bold py-2 rounded border border-gray-600 hover:border-red-600 transition">Leave</button>`
                                 : `<button onclick="event.stopPropagation(); handleJoinTourney('${t.id}', '${rom.currentUser.id}')" class="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-2 rounded shadow transition">Join Now</button>`
                             ) : (
                                 t.registration_link ? 
                                 `<a href="${t.registration_link}" target="_blank" class="flex-1 text-center bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-bold py-2 rounded border border-gray-600">External Reg</a>` 
                                 : `<span class="flex-1 text-center text-gray-500 text-xs py-2">Closed</span>`
                             )}
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

// Helper for ticker (unchanged)
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
