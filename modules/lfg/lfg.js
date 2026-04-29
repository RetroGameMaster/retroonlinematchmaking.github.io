export default async function initLFG(rom) {
    console.log('📅 Initializing LFG Module...');
    
    const content = document.getElementById('app-content');
    if (!content) return;

    // 1. Render HTML (Using the structure from your HTML file for consistency)
    content.innerHTML = `
        <div class="max-w-6xl mx-auto p-4">
            <div class="flex justify-between items-center mb-8">
                <div>
                    <h1 class="text-4xl font-bold text-white mb-2">📡 Live LFG Board</h1>
                    <p class="text-gray-400">Find players for retro games. Posts expire after 24h.</p>
                </div>
                ${rom.currentUser ? 
                    '<button id="btn-new-lfg" class="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg transition flex items-center gap-2"><span>➕</span> Post Request</button>' : 
                    '<button onclick="window.location.hash=\'#/auth\'" class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-bold">Log In to Post</button>'
                }
            </div>

            <!-- Filters -->
            <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-6 flex flex-wrap gap-4">
                <select id="filter-region" class="bg-gray-900 border border-gray-600 text-white rounded px-3 py-2">
                    <option value="">All Regions</option>
                    <option value="NA">North America</option>
                    <option value="EU">Europe</option>
                    <option value="SA">South America</option>
                    <option value="ASIA">Asia</option>
                    <option value="OCE">Oceania</option>
                </select>
                <input type="text" id="filter-search" placeholder="Search games..." class="bg-gray-900 border border-gray-600 text-white rounded px-3 py-2 flex-1">
            </div>

            <!-- Grid -->
            <div id="lfg-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div class="col-span-full text-center py-12 text-gray-500">Loading posts...</div>
            </div>
        </div>

        <!-- Modal -->
        <div id="lfg-modal" class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div class="bg-gray-800 rounded-xl border border-gray-600 w-full max-w-md p-6 relative">
                <button id="close-lfg-modal" class="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">&times;</button>
                <h2 class="text-2xl font-bold text-white mb-4">📡 Post LFG Request</h2>
                
                <form id="lfg-form" class="space-y-4">
                    <div>
                        <label class="block text-sm text-gray-300 mb-1">Game Title *</label>
                        <input type="text" id="lfg-game" list="game-suggestions" required 
                            class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white focus:border-cyan-500 focus:outline-none"
                            placeholder="Start typing to search games...">
                        <datalist id="game-suggestions">
                            <!-- Options injected by JS -->
                        </datalist>
                        <p class="text-xs text-gray-500 mt-1">Select a game from the dropdown.</p>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">Region *</label>
                            <select id="lfg-region" required class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white">
                                <option value="NA">North America</option>
                                <option value="EU">Europe</option>
                                <option value="SA">South America</option>
                                <option value="ASIA">Asia</option>
                                <option value="OCE">Oceania</option>
                                <option value="Global">Global</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">Platform</label>
                            <input type="text" id="lfg-platform" placeholder="e.g. PS2, Dreamcast" class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">Scheduled Time *</label>
                            <input type="datetime-local" id="lfg-time" required class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">Time Zone *</label>
                            <select id="lfg-timezone" required class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white">
                                <option value="UTC">UTC</option>
                                <option value="America/New_York">Eastern (ET)</option>
                                <option value="America/Chicago">Central (CT)</option>
                                <option value="America/Denver">Mountain (MT)</option>
                                <option value="America/Los_Angeles">Pacific (PT)</option>
                                <option value="Europe/London">London (GMT)</option>
                                <option value="Europe/Paris">Paris (CET)</option>
                                <option value="Asia/Tokyo">Tokyo (JST)</option>
                                <option value="Australia/Sydney">Sydney (AEST)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm text-gray-300 mb-1">Description / Rules</label>
                        <textarea id="lfg-desc" rows="3" placeholder="e.g. Need 1 more player..." class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"></textarea>
                    </div>

                    <button type="submit" class="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-lg">Post Request</button>
                </form>
            </div>
        </div>
    `;

    // 2. Initialize Logic
    if (rom.currentUser) {
        document.getElementById('btn-new-lfg').addEventListener('click', openPostModal);
        document.getElementById('close-lfg-modal').addEventListener('click', closePostModal);
        
        const form = document.getElementById('lfg-form');
        form.addEventListener('submit', (e) => handlePostLFG(e, rom));

        // Load game suggestions for autocomplete
        await loadGameSuggestions(rom);
    }

    // Setup Filters
    document.getElementById('filter-search').addEventListener('input', () => renderLFGList(rom));
    document.getElementById('filter-region').addEventListener('change', () => renderLFGList(rom));

    // Initial Load
    await renderLFGList(rom);
}

// --- Global Functions ---

window.openPostModal = function() {
    const modal = document.getElementById('lfg-modal');
    if (modal) modal.classList.remove('hidden');
};

window.closePostModal = function() {
    const modal = document.getElementById('lfg-modal');
    if (modal) modal.classList.add('hidden');
    document.getElementById('lfg-form').reset();
};

async function loadGameSuggestions(rom) {
    const datalist = document.getElementById('game-suggestions');
    if (!datalist) return;

    try {
        // Fetch all games (or limit to popular ones if DB is huge)
        const { data, error } = await rom.supabase
            .from('games')
            .select('title')
            .order('title', { ascending: true })
            .limit(100); // Limit to 100 for performance, adjust as needed

        if (error) throw error;

        if (data) {
            datalist.innerHTML = data.map(game => 
                `<option value="${escapeHtml(game.title)}">`
            ).join('');
        }
    } catch (err) {
        console.error('Error loading game suggestions:', err);
        // Fallback or silent fail
    }
}

async function handlePostLFG(e, rom) {
    e.preventDefault();

    const game = document.getElementById('lfg-game').value.trim();
    const region = document.getElementById('lfg-region').value;
    const platform = document.getElementById('lfg-platform').value.trim();
    const scheduledTime = document.getElementById('lfg-time').value;
    const timezone = document.getElementById('lfg-timezone').value;
    const description = document.getElementById('lfg-desc').value.trim();

    if (!game || !region || !scheduledTime || !timezone) {
        alert('Please fill in all required fields.');
        return;
    }

    const btn = document.querySelector('#lfg-form button[type="submit"]');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Posting...';

    try {
        const { error } = await rom.supabase.from('lfg_posts').insert([{
            user_id: rom.currentUser.id,
            username: rom.currentUser.user_metadata?.username || rom.currentUser.email.split('@')[0],
            avatar_url: rom.currentUser.user_metadata?.avatar_url || null,
            game_title: game,
            platform: platform,
            region: region,
            scheduled_time: new Date(scheduledTime).toISOString(),
            timezone: timezone,
            description: description,
            status: 'open',
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }]);

        if (error) throw error;

        alert('✅ LFG Post created!');
        window.closePostModal();
        await renderLFGList(rom);

    } catch (err) {
        console.error('Error posting LFG:', err);
        alert('❌ Error: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

window.acceptLFG = async function(postId, hostId, rom) {
    if (!rom.currentUser) {
        alert('You must be logged in to accept.');
        return;
    }
    if (hostId === rom.currentUser.id) {
        alert('You cannot accept your own post.');
        return;
    }

    if (!confirm('Accept this match request? The host will be notified.')) return;

    try {
        // Update Post
        const { error: updateError } = await rom.supabase
            .from('lfg_posts')
            .update({ 
                status: 'full', 
                accepted_by: rom.currentUser.id,
                accepted_username: rom.currentUser.user_metadata?.username || rom.currentUser.email.split('@')[0]
            })
            .eq('id', postId);

        if (updateError) throw updateError;

        // Create Alert
        const { error: alertError } = await rom.supabase.from('alerts').insert([{
            user_id: hostId,
            type: 'lfg_accepted',
            title: 'LFG Request Accepted!',
            message: `Your LFG post for ${escapeHtml(document.getElementById(`game-title-${postId}`)?.textContent || 'a game')} was accepted!`,
            link: '#/lfg',
            is_read: false
        }]);

        if (alertError) throw alertError;

        alert('✅ You joined the match! Host notified.');
        await renderLFGList(rom);

    } catch (err) {
        console.error('Error accepting LFG:', err);
        alert('❌ Error: ' + err.message);
    }
};

async function renderLFGList(rom) {
    const container = document.getElementById('lfg-grid');
    if (!container) return;

    container.innerHTML = `<div class="col-span-full text-center py-8 text-gray-400">Loading...</div>`;

    try {
        const { data, error } = await rom.supabase
            .from('lfg_posts')
            .select('*')
            .eq('status', 'open')
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Apply Filters
        const searchVal = document.getElementById('filter-search').value.toLowerCase();
        const regionVal = document.getElementById('filter-region').value;

        let filtered = data || [];
        if (searchVal) filtered = filtered.filter(p => p.game_title.toLowerCase().includes(searchVal));
        if (regionVal) filtered = filtered.filter(p => p.region === regionVal);

        if (filtered.length === 0) {
            container.innerHTML = `<div class="col-span-full text-center py-12 text-gray-500">No active posts found.</div>`;
            return;
        }

        container.innerHTML = filtered.map(post => {
            const dateObj = new Date(post.scheduled_time);
            const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            
            // Use real avatar or fallback
            const avatarUrl = post.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.username)}&background=06b6d4&color=fff`;

            return `
                <div class="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-cyan-500 transition shadow-lg flex flex-col h-full">
                    <div class="flex items-start gap-3 mb-3">
                        <img src="${avatarUrl}" alt="${post.username}" class="w-10 h-10 rounded-full border border-cyan-500">
                        <div class="flex-1">
                            <h3 id="game-title-${post.id}" class="text-lg font-bold text-white leading-tight">${escapeHtml(post.game_title)}</h3>
                            <div class="text-xs text-gray-400 mt-1">Posted by ${escapeHtml(post.username)}</div>
                        </div>
                    </div>
                    
                    <div class="flex flex-wrap gap-2 mb-3">
                        <span class="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs font-bold">${post.platform || 'Any'}</span>
                        <span class="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs font-bold">${post.region}</span>
                    </div>

                    <div class="bg-gray-900/50 p-3 rounded mb-4 flex-1">
                        <div class="text-cyan-400 text-sm font-bold mb-1 flex items-center gap-2">
                            <span>🕒</span> ${dateStr} @ ${timeStr} <span class="text-gray-500 font-normal">(${post.timezone})</span>
                        </div>
                        ${post.description ? `<p class="text-gray-400 text-sm line-clamp-3">${escapeHtml(post.description)}</p>` : ''}
                    </div>

                    ${rom.currentUser && rom.currentUser.id !== post.user_id ? `
                        <button onclick="acceptLFG('${post.id}', '${post.user_id}', window.rom)" class="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded font-bold text-sm transition">
                            Accept Match
                        </button>
                    ` : `
                        <div class="w-full text-center text-gray-500 text-sm py-2 bg-gray-900/30 rounded">
                            ${rom.currentUser?.id === post.user_id ? 'Your Post' : 'Log in to join'}
                        </div>
                    `}
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Error loading LFG:', err);
        container.innerHTML = `<div class="col-span-full text-center py-8 text-red-400">Error: ${err.message}</div>`;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
