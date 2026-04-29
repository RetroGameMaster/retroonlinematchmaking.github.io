export default async function initLFG(rom) {
    const container = document.getElementById('lfg-content');
    if (!container) return;

    const user = rom.currentUser;

    // Render Layout
    container.innerHTML = `
        <div class="max-w-6xl mx-auto p-4">
            <div class="flex justify-between items-center mb-8">
                <h1 class="text-3xl font-bold text-cyan-400">📅 Looking For Group</h1>
                ${user ? `
                    <button onclick="document.getElementById('create-lfg-modal').classList.remove('hidden')" 
                            class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                        <span>➕</span> Post LFG
                    </button>
                ` : ''}
            </div>

            <!-- Filters -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-gray-800 p-4 rounded-lg border border-gray-700">
                <select id="filter-game" class="bg-gray-700 text-white p-2 rounded border border-gray-600">
                    <option value="">All Games</option>
                    <!-- Populated by JS -->
                </select>
                <select id="filter-region" class="bg-gray-700 text-white p-2 rounded border border-gray-600">
                    <option value="">All Regions</option>
                    <option value="NA">North America</option>
                    <option value="EU">Europe</option>
                    <option value="SA">South America</option>
                    <option value="ASIA">Asia</option>
                    <option value="OCE">Oceania</option>
                </select>
                <div class="flex items-center gap-2">
                    <input type="checkbox" id="filter-open" class="w-4 h-4">
                    <label for="filter-open" class="text-gray-300 text-sm">Show Open Only</label>
                </div>
            </div>

            <!-- List -->
            <div id="lfg-list" class="space-y-4">
                <div class="text-center py-8 text-gray-400">Loading posts...</div>
            </div>
        </div>

        <!-- Create Modal -->
        ${user ? `
        <div id="create-lfg-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
            <div class="bg-gray-800 p-6 rounded-lg max-w-lg w-full border border-cyan-500 shadow-2xl">
                <h2 class="text-2xl font-bold text-white mb-4">Create LFG Post</h2>
                <form id="lfg-form" class="space-y-4">
                    <div>
                        <label class="block text-gray-300 text-sm mb-1">Game *</label>
                        <input type="text" id="lfg-game" list="games-list" required class="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white">
                        <datalist id="games-list"></datalist>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-gray-300 text-sm mb-1">Region *</label>
                            <select id="lfg-region" required class="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white">
                                <option value="NA">North America</option>
                                <option value="EU">Europe</option>
                                <option value="SA">South America</option>
                                <option value="ASIA">Asia</option>
                                <option value="OCE">Oceania</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-gray-300 text-sm mb-1">Platform</label>
                            <input type="text" id="lfg-platform" placeholder="e.g. RetroArch, PC" class="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white">
                        </div>
                    </div>

                    <div>
                        <label class="block text-gray-300 text-sm mb-1">Scheduled Time (Optional)</label>
                        <div class="flex gap-2">
                            <input type="time" id="lfg-time" class="bg-gray-700 border border-gray-600 rounded p-2 text-white flex-1">
                            <select id="lfg-timezone" class="bg-gray-700 border border-gray-600 rounded p-2 text-white flex-1">
                                <option value="UTC">UTC</option>
                                <option value="America/New_York">EST (NY)</option>
                                <option value="America/Chicago">CST (Chicago)</option>
                                <option value="America/Denver">MST (Denver)</option>
                                <option value="America/Los_Angeles">PST (LA)</option>
                                <option value="Europe/London">GMT (London)</option>
                                <option value="Europe/Paris">CET (Paris)</option>
                                <option value="Asia/Tokyo">JST (Tokyo)</option>
                                <option value="Australia/Sydney">AEST (Sydney)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label class="block text-gray-300 text-sm mb-1">Notes / Rules</label>
                        <textarea id="lfg-notes" rows="3" class="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"></textarea>
                    </div>

                    <div class="flex justify-end gap-3 mt-6">
                        <button type="button" onclick="document.getElementById('create-lfg-modal').classList.add('hidden')" class="px-4 py-2 bg-gray-600 rounded text-white">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded text-white font-bold">Post</button>
                    </div>
                </form>
            </div>
        </div>
        ` : ''}
    `;

    if (!user) return;

    // Load Data
    await loadLFGPosts();
    await populateGamesList();

    // Form Submit
    document.getElementById('lfg-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const game = document.getElementById('lfg-game').value;
        const region = document.getElementById('lfg-region').value;
        const platform = document.getElementById('lfg-platform').value;
        const notes = document.getElementById('lfg-notes').value;
        const time = document.getElementById('lfg-time').value || null;
        const timezone = document.getElementById('lfg-timezone').value;

        const { error } = await rom.supabase.from('lfg_posts').insert({
            user_id: user.id,
            game_title: game,
            region: region,
            platform: platform,
            notes: notes,
            scheduled_time: time,
            timezone: timezone,
            status: 'open',
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });

        if (error) {
            alert('Error posting: ' + error.message);
        } else {
            document.getElementById('create-lfg-modal').classList.add('hidden');
            loadLFGPosts();
        }
    });

    // Filters
    document.getElementById('filter-game').addEventListener('change', loadLFGPosts);
    document.getElementById('filter-region').addEventListener('change', loadLFGPosts);
    document.getElementById('filter-open').addEventListener('change', loadLFGPosts);

    async function populateGamesList() {
        const { data } = await rom.supabase.from('games').select('title').order('title').limit(50);
        if (!data) return;
        const datalist = document.getElementById('games-list');
        const filter = document.getElementById('filter-game');
        data.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.title;
            datalist.appendChild(opt);
            
            const fOpt = document.createElement('option');
            fOpt.value = g.title;
            filter.appendChild(fOpt);
        });
    }

    async function loadLFGPosts() {
        const list = document.getElementById('lfg-list');
        const gameFilter = document.getElementById('filter-game').value;
        const regionFilter = document.getElementById('filter-region').value;
        const openOnly = document.getElementById('filter-open').checked;

        let query = rom.supabase
            .from('lfg_posts')
            .select('*, profiles(username, avatar_url)')
            .eq('status', 'open')
            .order('created_at', { ascending: false });

        if (gameFilter) query = query.eq('game_title', gameFilter);
        if (regionFilter) query = query.eq('region', regionFilter);

        const { data, error } = await query;

        if (error) {
            list.innerHTML = `<p class="text-red-400">Error: ${error.message}</p>`;
            return;
        }

        if (!data || data.length === 0) {
            list.innerHTML = `<p class="text-gray-400 text-center py-8">No active LFG posts found.</p>`;
            return;
        }

        list.innerHTML = data.map(post => {
            const host = post.profiles;
            const avatar = host?.avatar_url || `https://ui-avatars.com/api/?name=${host?.username || 'User'}&background=06b6d4&color=fff`;
            const timeDisplay = post.scheduled_time ? `⏰ ${post.scheduled_time} (${post.timezone})` : '';
            
            // Check if current user is host
            const isHost = post.user_id === user.id;
            const isAccepted = post.accepted_by === user.id;

            let actionButton = '';
            if (!isHost && !isAccepted) {
                actionButton = `
                    <button onclick="window.acceptLFG('${post.id}', '${post.user_id}', '${post.game_title}')" 
                            class="w-full mt-3 bg-green-600 hover:bg-green-700 text-white py-2 rounded font-bold transition">
                        ✅ Accept Match
                    </button>`;
            } else if (isAccepted) {
                actionButton = `
                    <div class="w-full mt-3 bg-green-900/50 border border-green-500 text-green-200 py-2 rounded text-center font-bold">
                        🤝 Match Accepted! Check Alerts
                    </div>`;
            } else if (isHost) {
                actionButton = `
                    <div class="w-full mt-3 bg-gray-700 text-gray-300 py-2 rounded text-center text-sm">
                        Waiting for players...
                    </div>`;
            }

            return `
                <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 hover:border-cyan-500 transition relative">
                    <div class="flex items-start gap-4">
                        <img src="${avatar}" alt="${host?.username}" class="w-12 h-12 rounded-full border-2 border-cyan-600">
                        <div class="flex-1">
                            <div class="flex justify-between items-start">
                                <h3 class="text-xl font-bold text-white">${post.game_title}</h3>
                                <span class="px-2 py-1 rounded text-xs font-bold ${post.region === 'NA' ? 'bg-blue-900 text-blue-200' : 'bg-purple-900 text-purple-200'}">${post.region}</span>
                            </div>
                            <p class="text-sm text-gray-400 mt-1">Hosted by <span class="text-cyan-400 font-bold">${host?.username || 'Unknown'}</span></p>
                            
                            ${timeDisplay ? `<p class="text-sm text-yellow-400 font-bold mt-2">${timeDisplay}</p>` : ''}
                            ${post.platform ? `<p class="text-sm text-gray-300 mt-1">🎮 Platform: ${post.platform}</p>` : ''}
                            ${post.notes ? `<p class="text-sm text-gray-400 mt-2 italic">"${post.notes}"</p>` : ''}

                            ${actionButton}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Global function for accepting matches
window.acceptLFG = async function(postId, hostId, gameTitle) {
    if (!confirm(`Accept match for ${gameTitle}? The host will be notified.`)) return;

    const user = window.rom?.currentUser;
    if (!user) return alert('You must be logged in.');

    // 1. Update Post Status
    const { error: updateError } = await window.supabase
        .from('lfg_posts')
        .update({ 
            status: 'full', 
            accepted_by: user.id 
        })
        .eq('id', postId);

    if (updateError) return alert('Error accepting: ' + updateError.message);

    // 2. Create Alert for Host
    const { error: alertError } = await window.supabase.rpc('create_alert', {
        target_user_id: hostId,
        alert_title: 'New Match Request!',
        alert_message: `${user.email} accepted your LFG post for ${gameTitle}. Check your profile!`,
        alert_link: '/profile'
    });

    if (alertError) console.error('Failed to send alert', alertError);

    alert('Success! The host has been notified via their profile alerts.');
    
    // Refresh list
    if (typeof window.loadModule === 'function') {
        // Simple reload of current module logic or just re-run function if available
        location.reload(); 
    }
};
