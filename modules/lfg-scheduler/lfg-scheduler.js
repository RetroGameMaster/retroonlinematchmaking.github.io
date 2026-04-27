import { supabase } from '../../lib/supabase.js';

// CORRECT EXPORT NAME
export default async function initSchedulerModule(rom) {
    console.log('📅 Initializing LFG Scheduler...');
    
    // SEO: Optimize the Feature Page 
    
    function updateSEOMeta() {
        // 1. Dynamic Title Tag
        document.title = "LFG Scheduler - Find Retro Gaming Partners | ROM";

        // 2. Meta Description (Targets keywords like 'find players', 'retro multiplayer')
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.name = "description";
            document.head.appendChild(metaDesc);
        }
        metaDesc.content = "Join the ultimate retro gaming community. Schedule sessions, find players for PS2, GameCube, Xbox, and more. Organize tournaments and climb the leaderboards on ROM.";

        // 3. Canonical URL (Prevents duplicate content issues with hash routing)
        let canonical = document.querySelector('link[rel="canonical"]');
        if (!canonical) {
            canonical = document.createElement('link');
            canonical.rel = "canonical";
            document.head.appendChild(canonical);
        }
        // Sets canonical to the clean URL without hashes if possible, or current hash
        canonical.href = window.location.href.split('#')[0] + '#/lfg-scheduler';

        // 4. Structured Data (Schema.org) - Tells Google this is a Community/Service
        const schemaScript = document.getElementById('lfg-schema');
        if (schemaScript) schemaScript.remove();

        const schema = {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "ROM LFG Scheduler",
            "applicationCategory": "GameApplication",
            "description": "A real-time scheduling tool for retro gamers to organize multiplayer sessions.",
            "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
            },
            "featureList": "Session Scheduling, Player Matching, Tournament Hosting, Console Filtering"
        };

        const script = document.createElement('script');
        script.id = 'lfg-schema';
        script.type = 'application/ld+json';
        script.text = JSON.stringify(schema);
        document.head.appendChild(script);
    }

    // Run SEO Update
    updateSEOMeta();
    const grid = document.getElementById('lobby-grid');
    const countEl = document.getElementById('lobby-count');
    const createBtn = document.getElementById('btn-create-event');
    const modal = document.getElementById('create-modal');
    const closeBtn = document.getElementById('close-modal');
    const cancelBtn = document.getElementById('cancel-create');
    const form = document.getElementById('create-form');
    const consoleFilter = document.getElementById('filter-console');
    const statusFilter = document.getElementById('filter-status');
    const eventConsoleSelect = document.getElementById('event-console');
    
    // Edit Mode State
    let currentEditId = null;

    if (!grid) return;

    // Get Current User
    const { data: { user } } = await supabase.auth.getUser();
    const currentUser = user;

    // 1. Load Consoles Dynamically
    await loadConsoles();

    // 2. Load initial data
    await loadLobbies();

    // Event Listeners
    if (createBtn) createBtn.addEventListener('click', () => {
        resetForm();
        modal.classList.remove('hidden');
    });

    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    if (cancelBtn) cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));
    
    if (consoleFilter) consoleFilter.addEventListener('change', loadLobbies);
    if (statusFilter) statusFilter.addEventListener('change', loadLobbies);

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (currentEditId) {
                await updateEvent();
            } else {
                await createEvent();
            }
        });
    }

    // --- Core Functions ---

    async function loadConsoles() {
        // Fetch distinct consoles from games table
        const { data, error } = await supabase
            .from('games')
            .select('console')
            .eq('status', 'approved')
            .not('console', 'is', null);

        if (error) {
            console.error('Error loading consoles:', error);
            return;
        }

        // Extract unique values
        const uniqueConsoles = [...new Set(data.map(item => item.console))].sort();

        // Clear existing options (keep first "Loading..." or "All" placeholder)
        const filterOptions = '<option value="">All Consoles</option>';
        const formOptions = '<option value="" disabled selected>Select Console</option>';

        let filterHtml = filterOptions;
        let formHtml = formOptions;

        uniqueConsoles.forEach(consoleName => {
            const option = `<option value="${consoleName}">${consoleName}</option>`;
            filterHtml += option;
            formHtml += option;
        });

        if (consoleFilter) consoleFilter.innerHTML = filterHtml;
        if (eventConsoleSelect) eventConsoleSelect.innerHTML = formHtml;
    }

    async function loadLobbies() {
        if (!grid) return;
        grid.innerHTML = `<div class="col-span-full text-center py-12"><div class="inline-block animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-500"></div></div>`;

        let query = supabase
            .from('lfg_events')
            .select(`
                *,
                host_profile:profiles!host_id (username, avatar_url),
                participants:lfg_participants(count)
            `)
            .order('start_time', { ascending: true });

        const consoleVal = consoleFilter?.value;
        const statusVal = statusFilter?.value;

        if (consoleVal) query = query.eq('console', consoleVal);
        if (statusVal) query = query.eq('status', statusVal);

        const { data, error } = await query;

        if (error) {
            console.error('Error loading lobbies:', error);
            grid.innerHTML = `<div class="text-red-400 text-center">Failed to load lobbies.</div>`;
            return;
        }

        if (countEl) countEl.textContent = data?.length || 0;

        if (!data || data.length === 0) {
            grid.innerHTML = `<div class="col-span-full text-center text-gray-500 py-12">No scheduled sessions found.</div>`;
            return;
        }

        renderGrid(data);
    }

    function renderGrid(events) {
        if (!grid) return;
        grid.innerHTML = '';
        
        events.forEach(event => {
            const host = event.host_profile;
            const isFull = event.status === 'full';
            const participantCount = event.participants?.[0]?.count || 0;
            const startTime = new Date(event.start_time).toLocaleString();
            const isHost = currentUser && currentUser.id === event.host_id;
            
            const card = document.createElement('div');
            card.className = `bg-gray-800/80 backdrop-blur border ${isFull ? 'border-red-500/50' : 'border-cyan-500/50'} rounded-xl p-5 hover:border-cyan-400 transition-all group relative overflow-hidden`;
            
            // Admin Controls (Edit/Delete) - Only visible to host
            const adminControls = isHost ? `
                <div class="absolute top-2 left-2 flex gap-2 z-10">
                    <button onclick="window.editLobby('${event.id}')" class="bg-yellow-600 hover:bg-yellow-500 text-white text-xs px-2 py-1 rounded shadow">✏️ Edit</button>
                    <button onclick="window.deleteLobby('${event.id}')" class="bg-red-600 hover:bg-red-500 text-white text-xs px-2 py-1 rounded shadow">🗑️</button>
                </div>
            ` : '';

            const hostBadge = isHost ? `<span class="text-[10px] bg-cyan-900 text-cyan-300 px-2 py-0.5 rounded ml-2">YOU ARE HOSTING</span>` : '';
            
            card.innerHTML = `
                ${adminControls}
                <div class="absolute top-0 right-0 bg-gray-900/80 px-3 py-1 rounded-bl-lg border-l border-b border-gray-700">
                    <span class="text-xs font-bold ${isFull ? 'text-red-400' : 'text-green-400'}">${isFull ? 'FULL' : 'OPEN'}</span>
                </div>

                <div class="flex items-start gap-4 mb-4 mt-4">
                    <div class="w-12 h-12 rounded-full bg-gray-700 overflow-hidden border-2 border-cyan-500/50">
                        ${host?.avatar_url ? `<img src="${host.avatar_url}" class="w-full h-full object-cover">` : '<div class="w-full h-full flex items-center justify-center text-xl">👤</div>'}
                    </div>
                    <div>
                        <h3 class="font-bold text-white text-lg leading-tight group-hover:text-cyan-400 transition flex items-center">
                            ${escapeHtml(event.title)} ${hostBadge}
                        </h3>
                        <p class="text-sm text-gray-400">Hosted by <span class="text-cyan-300">${host?.username || 'Unknown'}</span></p>
                    </div>
                </div>

                <div class="space-y-2 mb-4 text-sm text-gray-300">
                    <div class="flex justify-between">
                        <span class="text-gray-500">Console:</span>
                        <span class="font-bold text-purple-300">${event.console}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-500">Time:</span>
                        <span>${startTime}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-500">Players:</span>
                        <span class="${participantCount >= event.max_players ? 'text-red-400' : 'text-green-400'}">${participantCount} / ${event.max_players}</span>
                    </div>
                </div>

                ${event.description ? `<p class="text-xs text-gray-500 italic mb-4 line-clamp-2">"${event.description}"</p>` : ''}

                ${!isHost ? `
                    <button 
                        onclick="window.joinLobby('${event.id}')"
                        ${isFull ? 'disabled class="w-full bg-gray-700 text-gray-500 py-2 rounded cursor-not-allowed"' : 'class="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 rounded transition shadow-lg hover:shadow-cyan-500/50"'}
                    >
                        ${isFull ? 'Session Full' : 'Join Session'}
                    </button>
                ` : `
                    <div class="w-full text-center text-xs text-gray-500 py-2 border border-gray-700 rounded bg-gray-900/50">
                        You are managing this session
                    </div>
                `}
            `;
            grid.appendChild(card);
        });
    }

    function resetForm() {
        currentEditId = null;
        form.reset();
        document.querySelector('#create-modal h2').textContent = '📅 Schedule New Session';
        document.querySelector('#create-form button[type="submit"]').textContent = 'Create Event';
        
        // Set default time
        const now = new Date();
        now.setHours(now.getHours() + 1);
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('event-time').value = now.toISOString().slice(0, 16);
    }

    async function createEvent() {
        if (!currentUser) return alert('Please log in to host a session.');

        const title = document.getElementById('event-title').value;
        const consoleVal = document.getElementById('event-console').value;
        const max = parseInt(document.getElementById('event-max').value);
        const time = document.getElementById('event-time').value;
        const desc = document.getElementById('event-desc').value;

        if (!consoleVal) return alert('Please select a console.');
        if (!time) return alert('Please select a start time.');

        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.textContent = 'Broadcasting...';
        btn.disabled = true;

        try {
            const { error } = await supabase.from('lfg_events').insert({
                host_id: currentUser.id,
                title,
                console: consoleVal,
                max_players: max,
                start_time: new Date(time).toISOString(),
                description: desc,
                status: 'open'
            });

            if (error) throw error;

            modal.classList.add('hidden');
            loadLobbies();
            alert('Session broadcasted successfully!');
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    async function updateEvent() {
        if (!currentUser || !currentEditId) return;

        const title = document.getElementById('event-title').value;
        const consoleVal = document.getElementById('event-console').value;
        const max = parseInt(document.getElementById('event-max').value);
        const time = document.getElementById('event-time').value;
        const desc = document.getElementById('event-desc').value;

        const btn = form.querySelector('button[type="submit"]');
        btn.textContent = 'Updating...';
        btn.disabled = true;

        try {
            const { error } = await supabase.from('lfg_events').update({
                title,
                console: consoleVal,
                max_players: max,
                start_time: new Date(time).toISOString(),
                description: desc,
                updated_at: new Date().toISOString()
            }).eq('id', currentEditId).eq('host_id', currentUser.id); // Security check

            if (error) throw error;

            modal.classList.add('hidden');
            loadLobbies();
            alert('Session updated!');
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            btn.textContent = 'Create Event';
            btn.disabled = false;
        }
    }

    // Expose Global Functions
    window.editLobby = async (eventId) => {
        if (!currentUser) return alert('Log in first.');
        
        // Fetch event details
        const { data: event, error } = await supabase
            .from('lfg_events')
            .select('*')
            .eq('id', eventId)
            .single();

        if (error || !event) return alert('Event not found.');
        if (event.host_id !== currentUser.id) return alert('You can only edit your own events.');

        // Populate Form
        currentEditId = eventId;
        document.getElementById('event-title').value = event.title;
        document.getElementById('event-console').value = event.console;
        document.getElementById('event-max').value = event.max_players;
        
        // Format datetime for input
        const dateObj = new Date(event.start_time);
        dateObj.setMinutes(dateObj.getMinutes() - dateObj.getTimezoneOffset());
        document.getElementById('event-time').value = dateObj.toISOString().slice(0, 16);
        
        document.getElementById('event-desc').value = event.description || '';

        // Update Modal UI
        document.querySelector('#create-modal h2').textContent = '✏️ Edit Session';
        document.querySelector('#create-form button[type="submit"]').textContent = 'Save Changes';
        
        modal.classList.remove('hidden');
    };

    window.deleteLobby = async (eventId) => {
        if (!currentUser) return alert('Log in first.');
        if (!confirm('Are you sure you want to cancel this session?')) return;

        try {
            const { error } = await supabase
                .from('lfg_events')
                .delete()
                .eq('id', eventId)
                .eq('host_id', currentUser.id); // Security check

            if (error) throw error;
            loadLobbies();
            alert('Session cancelled.');
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    window.joinLobby = async (eventId) => {
        if (!currentUser) return alert('Log in to join.');
        if(!confirm('Join this session?')) return;

        try {
            const { error } = await supabase.from('lfg_participants').insert({
                event_id: eventId,
                user_id: currentUser.id
            });
            if (error) throw error;
            alert('Joined! Good luck.');
            loadLobbies();
        } catch (err) {
            alert('Failed to join: ' + err.message);
        }
    };

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
