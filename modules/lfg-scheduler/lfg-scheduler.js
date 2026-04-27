import { supabase } from '../../lib/supabase.js';

export default async function initSchedulerModule(rom) {
    console.log('📅 Initializing LFG Scheduler...');
    
    const grid = document.getElementById('events-grid');
    const countEl = document.getElementById('lobby-count');
    const createBtn = document.getElementById('btn-create-event');
    const modal = document.getElementById('create-modal');
    const closeBtn = document.getElementById('close-modal');
    const cancelBtn = document.getElementById('cancel-create');
    const form = document.getElementById('create-form');
    const consoleFilter = document.getElementById('filter-console');
    const statusFilter = document.getElementById('filter-status');

    if (!grid) return;

    // Load initial data
    await loadEvents();

    // Event Listeners
    if (createBtn) createBtn.addEventListener('click', () => {
        // Set default time to now + 1 hour
        const now = new Date();
        now.setHours(now.getHours() + 1);
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('event-time').value = now.toISOString().slice(0, 16);
        modal.classList.remove('hidden');
    });

    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    if (cancelBtn) cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));
    
    if (consoleFilter) consoleFilter.addEventListener('change', loadEvents);
    if (statusFilter) statusFilter.addEventListener('change', loadEvents);

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await createEvent();
        });
    }

    // --- Core Functions ---

    async function loadEvents() {
        if (!grid) return;
        grid.innerHTML = `<div class="col-span-full text-center py-12"><div class="inline-block animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-500"></div></div>`;

        let query = supabase
            .from('lfg_events')
            .select(`
                *,
                host_profile:profiles!host_id (username, avatar_url),
                game:games (title, cover_image_url),
                participants:lfg_participants(count)
            `)
            .order('start_time', { ascending: true });

        // Apply Filters
        const consoleVal = consoleFilter?.value;
        const statusVal = statusFilter?.value;

        if (consoleVal) query = query.eq('console', consoleVal);
        if (statusVal) query = query.eq('status', statusVal);

        const { data, error } = await query;

        if (error) {
            console.error('Error loading events:', error);
            grid.innerHTML = `<div class="text-red-400 text-center">Failed to load schedule.</div>`;
            return;
        }

        if (countEl) countEl.textContent = data?.length || 0;

        if (!data || data.length === 0) {
            grid.innerHTML = `<div class="col-span-full text-center text-gray-500 py-12">No scheduled sessions found. Be the first to plan one!</div>`;
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
            const isCompleted = event.status === 'completed';
            const participantCount = event.participants?.[0]?.count || 0;
            const startTime = new Date(event.start_time).toLocaleString();
            
            let statusColor = 'border-cyan-500/50';
            let statusText = 'OPEN';
            let statusTextColor = 'text-green-400';
            let btnText = 'Join Session';
            let btnDisabled = false;

            if (isFull) {
                statusColor = 'border-red-500/50';
                statusText = 'FULL';
                statusTextColor = 'text-red-400';
                btnText = 'Session Full';
                btnDisabled = true;
            } else if (isCompleted) {
                statusColor = 'border-gray-500/50';
                statusText = 'ENDED';
                statusTextColor = 'text-gray-400';
                btnText = 'Ended';
                btnDisabled = true;
            }

            const card = document.createElement('div');
            card.className = `bg-gray-800/80 backdrop-blur border ${statusColor} rounded-xl p-5 hover:border-cyan-400 transition-all group relative overflow-hidden`;
            
            card.innerHTML = `
                <div class="absolute top-0 right-0 bg-gray-900/80 px-3 py-1 rounded-bl-lg border-l border-b border-gray-700">
                    <span class="text-xs font-bold ${statusTextColor}">${statusText}</span>
                </div>

                <div class="flex items-start gap-4 mb-4">
                    <div class="w-12 h-12 rounded-full bg-gray-700 overflow-hidden border-2 border-cyan-500/50">
                        ${host?.avatar_url ? `<img src="${host.avatar_url}" class="w-full h-full object-cover">` : '<div class="w-full h-full flex items-center justify-center text-xl">👤</div>'}
                    </div>
                    <div>
                        <h3 class="font-bold text-white text-lg leading-tight group-hover:text-cyan-400 transition">${escapeHtml(event.title)}</h3>
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

                <button 
                    onclick="window.joinLobbyEvent('${event.id}')"
                    ${btnDisabled ? 'disabled class="w-full bg-gray-700 text-gray-500 py-2 rounded cursor-not-allowed"' : 'class="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 rounded transition shadow-lg hover:shadow-cyan-500/50"'}
                >
                    ${btnText}
                </button>
            `;
            grid.appendChild(card);
        });
    }

    async function createEvent() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return alert('Please log in to host a session.');

        const title = document.getElementById('event-title').value;
        const consoleVal = document.getElementById('event-console').value;
        const max = parseInt(document.getElementById('event-max').value);
        const time = document.getElementById('event-time').value;
        const desc = document.getElementById('event-desc').value;

        if (!time) return alert('Please select a start time.');

        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.textContent = 'Creating...';
        btn.disabled = true;

        try {
            const { error } = await supabase.from('lfg_events').insert({
                host_id: user.id,
                title,
                console: consoleVal,
                max_players: max,
                start_time: new Date(time).toISOString(),
                description: desc,
                status: 'open'
            });

            if (error) throw error;

            modal.classList.add('hidden');
            form.reset();
            loadEvents();
            alert('Session scheduled successfully!');
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    // Helper
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Expose join function globally for the HTML onclick
    window.joinLobbyEvent = async (eventId) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return alert('Log in to join.');

        if(!confirm('Join this scheduled session?')) return;

        try {
            const { error } = await supabase.from('lfg_participants').insert({
                event_id: eventId,
                user_id: user.id
            });
            if (error) throw error;
            alert('Joined! See you there.');
            loadEvents();
        } catch (err) {
            alert('Failed to join: ' + err.message);
        }
    };
}
