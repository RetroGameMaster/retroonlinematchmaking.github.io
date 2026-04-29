export default async function initLFG(rom) {
    console.log('📅 Initializing LFG Module...');
    
    const content = document.getElementById('app-content');
    if (!content) return;

    // 1. Render HTML (Updated for Live Lobbies)
    content.innerHTML = `
        <div class="max-w-7xl mx-auto p-4">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 class="text-4xl font-bold text-white mb-2">📡 Live Lobbies</h1>
                    <p class="text-gray-400">Start a live session or join an existing lobby. Rooms expire after 1 hour of inactivity.</p>
                </div>
                ${rom.currentUser ? 
                    '<button id="btn-new-lfg" class="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg transition flex items-center gap-2 whitespace-nowrap"><span>➕</span> Start Live Lobby</button>' : 
                    '<button onclick="window.location.hash=\'#/auth\'" class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-bold">Log In to Start</button>'
                }
            </div>

            <!-- Filters -->
            <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-6 flex flex-wrap gap-4">
                <select id="filter-region" class="bg-gray-900 border border-gray-600 text-white rounded px-3 py-2 min-w-[150px]">
                    <option value="">All Regions</option>
                    <option value="NA">North America</option>
                    <option value="EU">Europe</option>
                    <option value="SA">South America</option>
                    <option value="ASIA">Asia</option>
                    <option value="OCE">Oceania</option>
                    <option value="Global">Global</option>
                </select>
                <input type="text" id="filter-search" placeholder="Search games..." class="bg-gray-900 border border-gray-600 text-white rounded px-3 py-2 flex-1 min-w-[200px]">
            </div>

            <!-- Grid -->
            <div id="lfg-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div class="col-span-full text-center py-12 text-gray-500">Scanning for active lobbies...</div>
            </div>
        </div>

        <!-- Modal (Responsive & Updated Fields) -->
        <div id="lfg-modal" class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div class="bg-gray-800 rounded-xl border border-gray-600 w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto shadow-2xl">
                <button id="close-lfg-modal" class="absolute top-4 right-4 text-gray-400 hover:text-white text-xl z-10">&times;</button>
                <h2 class="text-2xl font-bold text-white mb-2">🚀 Start Live Lobby</h2>
                <p class="text-sm text-gray-400 mb-6">This creates a temporary chat room for 1 hour. Players can join via the game page.</p>
                
                <form id="lfg-form" class="space-y-4">
                    <div>
                        <label class="block text-sm text-gray-300 mb-1">Game Title *</label>
                        <input type="text" id="lfg-game" list="game-suggestions" required 
                            class="w-full bg-gray-900 border border-gray-600 rounded p-2.5 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition"
                            placeholder="Type to search games...">
                        <datalist id="game-suggestions"></datalist>
                        <p class="text-xs text-gray-500 mt-1">Select from the list to link to the correct game page.</p>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">Region *</label>
                            <select id="lfg-region" required class="w-full bg-gray-900 border border-gray-600 rounded p-2.5 text-white focus:border-cyan-500 focus:outline-none">
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
                            <input type="text" id="lfg-platform" placeholder="e.g. PS2, Dreamcast" class="w-full bg-gray-900 border border-gray-600 rounded p-2.5 text-white focus:border-cyan-500 focus:outline-none">
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">Players Needed *</label>
                            <select id="lfg-players" required class="w-full bg-gray-900 border border-gray-600 rounded p-2.5 text-white focus:border-cyan-500 focus:outline-none">
                                <option value="1">1 More Player</option>
                                <option value="2">2 More Players</option>
                                <option value="3">3 More Players</option>
                                <option value="4">4+ More Players</option>
                                <option value="Full">Full Lobby (Spectate/Wait)</option>
                            </select>
                        </div>
                        <div class="flex items-end pb-2">
                             <div class="text-xs text-cyan-400 bg-cyan-900/20 p-2 rounded border border-cyan-800/50">
                                ⏱️ Room expires in 1 hour
                             </div>
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm text-gray-300 mb-1">Description / Rules</label>
                        <textarea id="lfg-desc" rows="3" placeholder="e.g. Ranked matches only, mic required..." class="w-full bg-gray-900 border border-gray-600 rounded p-2.5 text-white focus:border-cyan-500 focus:outline-none"></textarea>
                    </div>

                    <button type="submit" class="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 rounded-lg shadow-lg transform transition hover:-translate-y-0.5">
                        🚀 Launch Lobby
                    </button>
                </form>
            </div>
        </div>
    `;

    // 2. Initialize Logic
    if (rom.currentUser) {
        const btn = document.getElementById('btn-new-lfg');
        if(btn) btn.addEventListener('click', openPostModal);
        
        const closeBtn = document.getElementById('close-lfg-modal');
        if(closeBtn) closeBtn.addEventListener('click', closePostModal);
        
        const form = document.getElementById('lfg-form');
        if(form) form.addEventListener('submit', (e) => handlePostLFG(e, rom));

        await loadGameSuggestions(rom);
    }

    // Setup Filters
    const searchInput = document.getElementById('filter-search');
    const regionFilter = document.getElementById('filter-region');
    
    if(searchInput) searchInput.addEventListener('input', () => renderLFGList(rom));
    if(regionFilter) regionFilter.addEventListener('change', () => renderLFGList(rom));

    await renderLFGList(rom);
}

// --- Global Functions ---

window.openPostModal = function() {
    const modal = document.getElementById('lfg-modal');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => document.getElementById('lfg-game')?.focus(), 100);
    }
};

window.closePostModal = function() {
    const modal = document.getElementById('lfg-modal');
    if (modal) modal.classList.add('hidden');
    const form = document.getElementById('lfg-form');
    if(form) form.reset();
};

async function loadGameSuggestions(rom) {
    const datalist = document.getElementById('game-suggestions');
    if (!datalist) return;

    try {
        const { data, error } = await rom.supabase
            .from('games')
            .select('title')
            .order('title', { ascending: true })
            .limit(200);

        if (error) throw error;

        if (data) {
            datalist.innerHTML = data.map(game => 
                `<option value="${escapeHtml(game.title)}">`
            ).join('');
        }
    } catch (err) {
        console.error('Error loading game suggestions:', err);
    }
}

async function handlePostLFG(e, rom) {
    e.preventDefault();

    const gameTitle = document.getElementById('lfg-game').value.trim();
    const region = document.getElementById('lfg-region').value;
    const platform = document.getElementById('lfg-platform').value.trim();
    const playersNeeded = document.getElementById('lfg-players').value;
    const description = document.getElementById('lfg-desc').value.trim();

    if (!gameTitle || !region || !playersNeeded) {
        alert('Please fill in all required fields.');
        return;
    }

    const btn = document.querySelector('#lfg-form button[type="submit"]');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Launching Lobby...';

    try {
        // 1. Get User Profile
        const { data: profile } = await rom.supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', rom.currentUser.id)
            .single();

        const username = profile?.username || rom.currentUser.email.split('@')[0];
        const avatarUrl = profile?.avatar_url;

        // 2. Check for Existing Active Ephemeral Room for this Game
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        let roomId = null;
        let isNewRoom = false;

        // Try to find an existing room linked to this game title
        // NOTE: This assumes your chat_rooms table has a 'name' column or similar to match against
        // If you don't have a direct match column, you might need to adjust this query
        // For now, we assume we create a new room every time if no specific linking exists yet
        // OR if you added 'name' column: .eq('name', `lobby-${gameTitle}`)
        const { data: existingRoom } = await rom.supabase
            .from('chat_rooms')
            .select('id')
            .eq('is_ephemeral', true)
            .gte('last_activity', oneHourAgo)
            .limit(1); 

        if (existingRoom && existingRoom.length > 0) {
            roomId = existingRoom[0].id;
            await rom.supabase.from('chat_rooms').update({ last_activity: new Date().toISOString() }).eq('id', roomId);
            console.log('✅ Joined existing active lobby:', roomId);
        } else {
            // Create New Room
            const roomName = `lobby-${gameTitle}-${Date.now()}`;
            const { data: newRoom, error: roomError } = await rom.supabase.from('chat_rooms').insert([{
                name: roomName,
                description: `Live lobby for ${gameTitle}`,
                is_public: true,
                is_ephemeral: true,
                last_activity: new Date().toISOString()
            ]).select().single();

            if (roomError) throw roomError;
            roomId = newRoom.id;
            isNewRoom = true;
            console.log('🆕 Created new lobby:', roomId);
        }

        // 3. Create the LFG Post linked to this Room
        const { error: lfgError } = await rom.supabase.from('lfg_posts').insert([{
            user_id: rom.currentUser.id,
            posted_username: username,
            avatar_url: avatarUrl,
            game_title: gameTitle,
            platform: platform,
            region: region,
            players_needed: playersNeeded,
            description: description,
            status: 'open',
            chat_room_id: roomId,
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 Hour Expiry
        }]);

        if (lfgError) throw lfgError;

        alert(`✅ Lobby Live! Chat room ${isNewRoom ? 'created' : 'extended'} for 1 hour.`);
        window.closePostModal();
        await renderLFGList(rom);

    } catch (err) {
        console.error('Error launching lobby:', err);
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

    if (!confirm('Join this lobby? This will extend the room timer by 1 hour.')) return;

    try {
        const accepterUsername = rom.currentUser.user_metadata?.username || rom.currentUser.email.split('@')[0];

        // 1. Update Post
        const { error: updateError } = await rom.supabase
            .from('lfg_posts')
            .update({ 
                status: 'full', 
                accepted_by: rom.currentUser.id,
                accepted_username: accepterUsername
            })
            .eq('id', postId);

        if (updateError) throw updateError;

        // 2. Extend Room Heartbeat
        const { data: postData } = await rom.supabase.from('lfg_posts').select('chat_room_id, game_title').eq('id', postId).single();
        
        if (postData?.chat_room_id) {
            await rom.supabase.from('chat_rooms')
                .update({ last_activity: new Date().toISOString() })
                .eq('id', postData.chat_room_id);
        }

        // 3. Create Alert
        const gameTitle = postData?.game_title || 'a game';

        await rom.supabase.from('alerts').insert([{
            user_id: hostId,
            type: 'lfg_accepted',
            title: 'Lobby Joined!',
            message: `${accepterUsername} joined your ${gameTitle} lobby!`,
            link_url: '#/lfg',
            is_read: false
        }]);

        alert('✅ You joined the lobby! Host notified.');
        if (window.updateNotificationUI) window.updateNotificationUI(); 
        
        await renderLFGList(rom);

    } catch (err) {
        console.error('Error joining lobby:', err);
        alert('❌ Error: ' + err.message);
    }
};

async function renderLFGList(rom) {
    const container = document.getElementById('lfg-grid');
    if (!container) return;

    container.innerHTML = `<div class="col-span-full text-center py-8 text-gray-400">Scanning active sessions...</div>`;

    try {
        const { data, error } = await rom.supabase
            .from('lfg_posts')
            .select('*')
            .eq('status', 'open')
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;

        const searchVal = document.getElementById('filter-search')?.value.toLowerCase() || '';
        const regionVal = document.getElementById('filter-region')?.value || '';

        let filtered = data || [];
        if (searchVal) filtered = filtered.filter(p => p.game_title && p.game_title.toLowerCase().includes(searchVal));
        if (regionVal) filtered = filtered.filter(p => p.region === regionVal);

        if (filtered.length === 0) {
            container.innerHTML = `<div class="col-span-full text-center py-12 text-gray-500">No active lobbies found.<br><span class="text-sm">Be the first to start one!</span></div>`;
            return;
        }

        const gameTitles = [...new Set(filtered.map(p => p.game_title))];
        const { data: gamesData } = await rom.supabase
            .from('games')
            .select('title, slug, cover_image_url')
            .in('title', gameTitles);
        
        const gameMap = {};
        if(gamesData) gamesData.forEach(g => gameMap[g.title] = g);

        container.innerHTML = filtered.map(post => {
            const gameData = gameMap[post.game_title] || {};
            const coverUrl = gameData.cover_image_url || 'https://via.placeholder.com/150x200/1f2937/06b6d4?text=No+Cover';
            const gameSlug = gameData.slug;
            const gameLink = gameSlug ? `#/game/${gameSlug}` : `#/games?search=${encodeURIComponent(post.game_title)}`;
            
            const displayName = post.posted_username || 'Anonymous';
            const avatarUrl = post.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=06b6d4&color=fff`;
            const profileLink = `#/profile/${displayName}`;

            const expiresAt = new Date(post.expires_at);
            const now = new Date();
            const diffMs = expiresAt - now;
            const minsLeft = Math.floor(diffMs / 60000);
            let timeBadge = '';
            
            if (minsLeft > 60) {
                timeBadge = `<span class="text-green-400 text-xs font-bold">● Live</span>`;
            } else if (minsLeft > 15) {
                timeBadge = `<span class="text-yellow-400 text-xs font-bold">● Ending Soon</span>`;
            } else {
                timeBadge = `<span class="text-red-400 text-xs font-bold">● Expiring</span>`;
            }

            let playersBadgeColor = 'bg-blue-900/50 text-blue-300 border-blue-700';
            if(post.players_needed === 'Full') playersBadgeColor = 'bg-gray-700 text-gray-300 border-gray-500';
            if(post.players_needed === '1') playersBadgeColor = 'bg-green-900/50 text-green-300 border-green-700';

            return `
                <div class="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-cyan-500 transition shadow-lg flex flex-col h-full group relative">
                    <div class="absolute top-2 right-2 z-10 bg-gray-900/90 backdrop-blur px-2 py-1 rounded border border-gray-600 shadow-sm">
                        ${timeBadge}
                    </div>

                    <div class="flex p-4 gap-4 border-b border-gray-700 bg-gray-800/50">
                        <a href="${gameLink}" class="flex-shrink-0 relative group/img">
                            <img src="${coverUrl}" alt="${post.game_title}" class="w-20 h-24 object-cover rounded border border-gray-600 group-hover/img:border-cyan-400 transition shadow-md">
                            <div class="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition rounded flex items-center justify-center">
                                <span class="opacity-0 group-hover/img:opacity-100 text-white text-xs font-bold drop-shadow-md">View</span>
                            </div>
                        </a>
                        
                        <div class="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                                <a href="${gameLink}" class="text-lg font-bold text-white leading-tight hover:text-cyan-400 transition block truncate" title="View Game Page">
                                    ${escapeHtml(post.game_title)}
                                </a>
                                <div class="flex items-center gap-2 mt-2">
                                    <a href="${profileLink}" class="flex items-center gap-2 hover:opacity-80 transition">
                                        <img src="${avatarUrl}" alt="${displayName}" class="w-6 h-6 rounded-full border border-cyan-500 object-cover">
                                        <span class="text-xs text-gray-400 hover:text-cyan-300 transition">${escapeHtml(displayName)}</span>
                                    </a>
                                </div>
                            </div>
                            
                            <div class="flex flex-wrap gap-2 mt-2">
                                <span class="bg-gray-700 text-gray-300 px-2 py-0.5 rounded text-[10px] font-bold border border-gray-600">${post.platform || 'Any'}</span>
                                <span class="bg-gray-700 text-gray-300 px-2 py-0.5 rounded text-[10px] font-bold border border-gray-600">${post.region}</span>
                                <span class="${playersBadgeColor} px-2 py-0.5 rounded text-[10px] font-bold border">
                                    ${post.players_needed === 'Full' ? 'Full' : (post.players_needed == '1' ? 'Needs 1' : `Needs ${post.players_needed}`)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="p-4 flex-1 flex flex-col justify-between bg-gray-800">
                        <div class="mb-4">
                            ${post.description ? `<p class="text-gray-400 text-sm line-clamp-2">${escapeHtml(post.description)}</p>` : '<p class="text-gray-500 text-sm italic">No specific rules.</p>'}
                        </div>

                        ${rom.currentUser && rom.currentUser.id !== post.user_id ? `
                            <button onclick="acceptLFG('${post.id}', '${post.user_id}', window.rom)" class="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded font-bold text-sm transition shadow-lg transform active:scale-95 flex items-center justify-center gap-2">
                                <span>🎮</span> Join Lobby
                            </button>
                        ` : `
                            <div class="w-full text-center text-gray-500 text-sm py-2 bg-gray-900/30 rounded border border-gray-700">
                                ${rom.currentUser?.id === post.user_id ? 'Your Active Lobby' : 'Log in to join'}
                            </div>
                        `}
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Error loading lobbies:', err);
        container.innerHTML = `<div class="col-span-full text-center py-8 text-red-400">Error: ${err.message}</div>`;
    }
}

export async function getRecentLFGForTicker(rom) {
    try {
        const { data, error } = await rom.supabase
            .from('lfg_posts')
            .select('game_title, posted_username, region')
            .eq('status', 'open')
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(5);

        if (error || !data) return [];

        return data.map(post => ({
            text: `📡 <strong>${post.posted_username}</strong> started a live lobby for <strong>${post.game_title}</strong> (${post.region})`,
            link: '#/lfg'
        }));
    } catch (err) {
        console.error('Error fetching LFG for ticker:', err);
        return [];
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
