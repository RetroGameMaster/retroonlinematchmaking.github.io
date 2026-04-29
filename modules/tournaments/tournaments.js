export default async function initTournaments(rom) {
    console.log('🏆 Initializing Tournaments Module...');
    
    const content = document.getElementById('app-content');
    if (!content) return;

    // 1. Render HTML
    content.innerHTML = `
        <div class="max-w-6xl mx-auto p-4">
            <div class="flex justify-between items-center mb-8">
                <div>
                    <h1 class="text-4xl font-bold text-white mb-2">🏆 Community Tournaments</h1>
                    <p class="text-gray-400">Host or join competitive retro gaming events.</p>
                </div>
                ${rom.currentUser ? 
                    '<button id="btn-new-tournament" class="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg transition flex items-center gap-2"><span>➕</span> Host Tournament</button>' : 
                    '<button onclick="window.location.hash=\'#/auth\'" class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-bold">Log In to Host</button>'
                }
            </div>

            <!-- Filters -->
            <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-6 flex flex-wrap gap-4">
                <select id="filter-status" class="bg-gray-900 border border-gray-600 text-white rounded px-3 py-2">
                    <option value="">All Statuses</option>
                    <option value="open">Open for Registration</option>
                    <option value="active">Active / In Progress</option>
                    <option value="completed">Completed</option>
                </select>
                <input type="text" id="filter-search" placeholder="Search games..." class="bg-gray-900 border border-gray-600 text-white rounded px-3 py-2 flex-1">
            </div>

            <!-- Grid -->
            <div id="tournament-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div class="col-span-full text-center py-12 text-gray-500">Loading tournaments...</div>
            </div>
        </div>

        <!-- Modal (FIXED: max-h, overflow-y-auto, responsive width) -->
        <div id="tournament-modal" class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div class="bg-gray-800 rounded-xl border border-gray-600 w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 relative shadow-2xl">
                <button id="close-tournament-modal" class="absolute top-4 right-4 text-gray-400 hover:text-white text-xl z-10">&times;</button>
                <h2 class="text-2xl font-bold text-white mb-4 sticky top-0 bg-gray-800 pb-2 border-b border-gray-700">🏆 Host Tournament</h2>
                
                <form id="tournament-form" class="space-y-4">
                    <div>
                        <label class="block text-sm text-gray-300 mb-1">Tournament Title *</label>
                        <input type="text" id="tour-title" required placeholder="e.g. Summer Smash Bros Melee" 
                            class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white focus:border-purple-500 focus:outline-none">
                    </div>

                    <div>
                        <label class="block text-sm text-gray-300 mb-1">Game Title *</label>
                        <input type="text" id="tour-game" list="game-suggestions" required placeholder="Start typing..." 
                            class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white focus:border-purple-500 focus:outline-none">
                        <datalist id="game-suggestions"></datalist>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">Start Date *</label>
                            <input type="datetime-local" id="tour-date" required 
                                class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white focus:border-purple-500 focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">Prize Pool</label>
                            <input type="text" id="tour-prize" placeholder="e.g. $50 or Bragging Rights" 
                                class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white focus:border-purple-500 focus:outline-none">
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm text-gray-300 mb-1">Registration Link (Discord/Challonge/Start.gg) *</label>
                        <input type="url" id="tour-link" required placeholder="https://..." 
                            class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white focus:border-purple-500 focus:outline-none">
                        <p class="text-xs text-gray-500 mt-1">Where users sign up.</p>
                    </div>

                    <div>
                        <label class="block text-sm text-gray-300 mb-1">Description / Rules</label>
                        <textarea id="tour-desc" rows="3" placeholder="Rules, format, etc." 
                            class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white focus:border-purple-500 focus:outline-none"></textarea>
                    </div>

                    <button type="submit" class="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg mt-4">Create Tournament</button>
                </form>
            </div>
        </div>
    `;

    // 2. Initialize Logic
    if (rom.currentUser) {
        const btn = document.getElementById('btn-new-tournament');
        if(btn) btn.addEventListener('click', openTournamentModal);
        
        const closeBtn = document.getElementById('close-tournament-modal');
        if(closeBtn) closeBtn.addEventListener('click', closeTournamentModal);
        
        const form = document.getElementById('tournament-form');
        if(form) form.addEventListener('submit', (e) => handlePostTournament(e, rom));

        await loadGameSuggestions(rom);
    }

    // Setup Filters
    const searchInput = document.getElementById('filter-search');
    const statusFilter = document.getElementById('filter-status');
    
    if(searchInput) searchInput.addEventListener('input', () => renderTournamentList(rom));
    if(statusFilter) statusFilter.addEventListener('change', () => renderTournamentList(rom));

    await renderTournamentList(rom);
}

// --- Global Functions ---

window.openTournamentModal = function() {
    const modal = document.getElementById('tournament-modal');
    if (modal) {
        modal.classList.remove('hidden');
        // Reset scroll to top
        modal.querySelector('.overflow-y-auto').scrollTop = 0;
    }
};

window.closeTournamentModal = function() {
    const modal = document.getElementById('tournament-modal');
    if (modal) modal.classList.add('hidden');
    const form = document.getElementById('tournament-form');
    if(form) form.reset();
};

async function loadGameSuggestions(rom) {
    const datalist = document.getElementById('game-suggestions');
    if (!datalist) return;
    try {
        const { data, error } = await rom.supabase.from('games').select('title').order('title', { ascending: true }).limit(100);
        if (error) throw error;
        if (data) datalist.innerHTML = data.map(g => `<option value="${escapeHtml(g.title)}">`).join('');
    } catch (err) { console.error('Error loading games:', err); }
}

async function handlePostTournament(e, rom) {
    e.preventDefault();
    const title = document.getElementById('tour-title').value.trim();
    const game = document.getElementById('tour-game').value.trim();
    const startDate = document.getElementById('tour-date').value;
    const prize = document.getElementById('tour-prize').value.trim();
    const link = document.getElementById('tour-link').value.trim();
    const desc = document.getElementById('tour-desc').value.trim();

    if (!title || !game || !startDate || !link) {
        alert('Please fill in all required fields.');
        return;
    }

    const btn = document.querySelector('#tournament-form button[type="submit"]');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
        const { error } = await rom.supabase.from('tournaments').insert([{
            organizer_id: rom.currentUser.id,
            title: title,
            game_title: game, // Assuming you added game_title or use game_id
            start_date: new Date(startDate).toISOString(),
            prize_pool: prize || null,
            registration_link: link,
            description: desc,
            status: 'open'
        }]);

        if (error) throw error;
        alert('✅ Tournament created!');
        window.closeTournamentModal();
        await renderTournamentList(rom);
    } catch (err) {
        console.error('Error creating tournament:', err);
        alert('❌ Error: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function renderTournamentList(rom) {
    const container = document.getElementById('tournament-grid');
    if (!container) return;
    container.innerHTML = `<div class="col-span-full text-center py-8 text-gray-400">Loading...</div>`;

    try {
        let query = rom.supabase.from('tournaments').select('*').order('start_date', { ascending: true });
        const { data, error } = await query;
        if (error) throw error;

        // Client-side filtering
        const searchVal = document.getElementById('filter-search')?.value.toLowerCase() || '';
        const statusVal = document.getElementById('filter-status')?.value || '';
        
        let filtered = data || [];
        if (searchVal) filtered = filtered.filter(t => t.title.toLowerCase().includes(searchVal) || (t.game_title && t.game_title.toLowerCase().includes(searchVal)));
        if (statusVal) filtered = filtered.filter(t => t.status === statusVal);

        if (filtered.length === 0) {
            container.innerHTML = `<div class="col-span-full text-center py-12 text-gray-500">No tournaments found.</div>`;
            return;
        }

        container.innerHTML = filtered.map(t => {
            const dateObj = new Date(t.start_date);
            const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            
            const statusColor = t.status === 'open' ? 'bg-green-900 text-green-300 border-green-700' : 
                                t.status === 'active' ? 'bg-blue-900 text-blue-300 border-blue-700' : 
                                'bg-gray-700 text-gray-400 border-gray-600';

            return `
                <div class="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-purple-500 transition shadow-lg flex flex-col h-full">
                    <div class="mb-3">
                        <span class="px-2 py-1 rounded text-xs font-bold border ${statusColor} uppercase">${t.status || 'Open'}</span>
                    </div>
                    <h3 class="text-xl font-bold text-white mb-1 leading-tight">${escapeHtml(t.title)}</h3>
                    <p class="text-purple-400 text-sm font-bold mb-3">${escapeHtml(t.game_title || 'TBA')}</p>
                    
                    <div class="space-y-2 text-sm text-gray-300 mb-4 flex-1">
                        <div class="flex items-center gap-2">
                            <span>📅</span> ${dateStr} @ ${timeStr}
                        </div>
                        ${t.prize_pool ? `<div class="flex items-center gap-2"><span>🏆</span> ${escapeHtml(t.prize_pool)}</div>` : ''}
                        ${t.description ? `<p class="text-gray-400 text-xs mt-2 line-clamp-2">${escapeHtml(t.description)}</p>` : ''}
                    </div>

                    <a href="${t.registration_link}" target="_blank" rel="noopener noreferrer" 
                       class="w-full block text-center py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold text-sm transition">
                        Register Now ↗
                    </a>
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
