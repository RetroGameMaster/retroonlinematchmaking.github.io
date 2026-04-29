import { supabase } from '../../lib/supabase.js';

export async function initModule(rom) {
    const list = document.getElementById('tourney-list');
    const modal = document.getElementById('tourney-modal');
    const btnNew = document.getElementById('btn-new-tourney');
    const btnClose = document.getElementById('close-tourney-modal');
    const form = document.getElementById('tourney-form');
    const gameInput = document.getElementById('t-game');
    const datalist = document.getElementById('t-game-list');

    // Load Games
    async function loadGames() {
        const { data } = await supabase.from('games').select('title').order('title');
        if (data) datalist.innerHTML = data.map(g => `<option value="${g.title}">`).join('');
    }
    loadGames();

    // Fetch Tournaments
    async function fetchTournaments() {
        const { data, error } = await supabase
            .from('tournaments')
            .select(`*, games(title, console, cover_image_url), profiles(username)`)
            .gte('start_date', new Date().toISOString())
            .order('start_date', { ascending: true });

        if (error) {
            list.innerHTML = `<div class="text-red-400">Error loading</div>`;
            return;
        }

        if (!data || data.length === 0) {
            list.innerHTML = `<div class="text-center py-12 bg-gray-800/50 rounded-lg border border-gray-700">
                <h3 class="text-xl font-bold text-white mb-2">No upcoming tournaments</h3>
                <p class="text-gray-400">Host the first one!</p>
            </div>`;
            return;
        }

        list.innerHTML = data.map(t => {
            const dateObj = new Date(t.start_date);
            const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
            
            return `
            <div class="bg-gray-800 rounded-xl border border-gray-700 p-6 flex flex-col md:flex-row gap-6 hover:border-purple-500 transition">
                <img src="${t.games?.cover_image_url || 'https://via.placeholder.com/100'}" 
                     class="w-full md:w-32 h-32 object-cover rounded border border-gray-600">
                
                <div class="flex-1">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="text-2xl font-bold text-white mb-1">${escapeHtml(t.title)}</h3>
                            <p class="text-purple-400 font-bold mb-2">${escapeHtml(t.games?.title)} (${t.games?.console})</p>
                        </div>
                        <span class="bg-green-900 text-green-300 px-3 py-1 rounded text-sm font-bold">Open</span>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4 mb-4 text-sm text-gray-300">
                        <div>📅 ${dateStr}</div>
                        <div>🏆 Prize: ${escapeHtml(t.prize_pool || 'TBD')}</div>
                        <div>👤 Host: ${t.profiles?.username || 'Anonymous'}</div>
                    </div>
                    
                    <p class="text-gray-400 text-sm mb-4 line-clamp-2">${escapeHtml(t.description)}</p>
                    
                    <a href="${t.registration_link}" target="_blank" rel="noopener noreferrer" 
                       class="inline-block bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-2 rounded-lg transition">
                        🔗 Register Now
                    </a>
                </div>
            </div>
            `;
        }).join('');
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Events
    btnNew.addEventListener('click', () => {
        if (!rom.currentUser) {
            alert('Log in to host.');
            rom.navigateTo('auth');
            return;
        }
        modal.classList.remove('hidden');
    });
    btnClose.addEventListener('click', () => modal.classList.add('hidden'));

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button');
        btn.disabled = true;
        btn.textContent = 'Creating...';

        try {
            const gameTitle = document.getElementById('t-game').value;
            const { data: gameData } = await supabase.from('games').select('id').eq('title', gameTitle).single();
            if (!gameData) throw new Error('Game not found');

            const { error } = await supabase.from('tournaments').insert({
                organizer_id: rom.currentUser.id,
                game_id: gameData.id,
                title: document.getElementById('t-title').value,
                start_date: document.getElementById('t-date').value,
                prize_pool: document.getElementById('t-prize').value,
                description: document.getElementById('t-desc').value,
                registration_link: document.getElementById('t-link').value
            });

            if (error) throw error;
            alert('Tournament created!');
            modal.classList.add('hidden');
            form.reset();
            fetchTournaments();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Host Tournament';
        }
    });

    fetchTournaments();
}
