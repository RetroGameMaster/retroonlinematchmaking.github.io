export default async function initLFG(rom) {
    console.log('📡 Initializing LFG Module (Ephemeral Lobby System)...');
    
    const content = document.getElementById('app-content');
    if (!content) return;

    // 1. Render HTML
    content.innerHTML = `
        <div class="max-w-6xl mx-auto p-4">
            <div class="flex justify-between items-center mb-8">
                <div>
                    <h1 class="text-4xl font-bold text-white mb-2">📡 Live LFG Board</h1>
                    <p class="text-gray-400">Find players now. Rooms stay live for 1 hour of activity.</p>
                </div>
                ${rom.currentUser ? 
                    '<button id="btn-new-lfg" class="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg transition flex items-center gap-2"><span>➕</span> Start Session</button>' : 
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
                <div class="col-span-full text-center py-12 text-gray-500">Loading sessions...</div>
            </div>
        </div>

        <!-- Modal -->
        <div id="lfg-modal" class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div class="bg-gray-800 rounded-xl border border-gray-600 w-full max-w-md p-6 relative">
                <button id="close-lfg-modal" class="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">&times;</button>
                <h2 class="text-2xl font-bold text-white mb-4">📡 Start Gaming Session</h2>
                
                <form id="lfg-form" class="space-y-4">
                    <div>
                        <label class="block text-sm text-gray-300 mb-1">Game Title *</label>
                        <input type="text" id="lfg-game" list="game-suggestions" required 
                            class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white focus:border-cyan-500 focus:outline-none"
                            placeholder="Start typing to search games...">
                        <datalist id="game-suggestions"></datalist>
                        <p class="text-xs text-cyan-400 mt-1">✨ This will create or join a live chat room for this game.</p>
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
                            <label class="block text-sm text-gray-300 mb-1">Players Needed *</label>
                            <select id="lfg-players" required class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white">
                                <option value="1">1 More Player</option>
                                <option value="2">2 More Players</option>
                                <option value="3">3 More Players</option>
                                <option value="4">4+ More Players</option>
                                <option value="Full">Full Lobby (Spectate/Wait)</option>
                            </select>
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
                        <label class="block text-sm text-gray-300 mb-1">Scheduled Time *</label>
                        <input type="datetime-local" id="lfg-time" required class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white">
                    </div>

                    <div>
                        <label class="block text-sm text-gray-300 mb-1">Description / Rules</label>
                        <textarea id="lfg-desc" rows="3" placeholder="e.g. Need 1 more player, ranked matches only..." class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"></textarea>
                    </div>

                    <button type="submit" class="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-lg">Start Session & Post LFG</button>
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
    if (modal) modal.classList.remove('hidden');
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
        const { data, error } = await rom.supabase.from('games').select('title').order('title', { ascending: true }).limit(100);
        if (error) throw error;
        if (data) datalist.innerHTML = data.map(game => `<option value="${escapeHtml(game.title)}">`).join('');
    } catch (err) { console.error('Error loading game suggestions:', err); }
}

async function handlePostLFG(e, rom) {
    e.preventDefault();

    const gameTitle = document.getElementById('lfg-game').value.trim();
    const region = document.getElementById('lfg-region').value;
    const platform = document.getElementById('lfg-platform').value.trim();
    const playersNeeded = document.getElementById('lfg-players').value;
    const scheduledTime = document.getElementById('lfg-time').value;
    const timezone = document.getElementById('lfg-timezone').value;
    const description = document.getElementById('lfg-desc').value.trim();

    if (!gameTitle || !region || !scheduledTime || !timezone || !playersNeeded) {
        alert('Please fill in all required fields.');
        return;
    }

    const btn = document.querySelector('#lfg-form button[type="submit"]');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Creating Session...';

    try {
        // 1. Fetch Profile
        const { data: profile } = await rom.supabase.from('profiles').select('username, avatar_url').eq('id', rom.currentUser.id).single();
        const username = profile?.username || rom.currentUser.email.split('@')[0];
        const avatarUrl = profile?.avatar_url;

        // 2. Find Game ID (needed for chat room linking)
        const { data: gameData } = await rom.supabase.from('games').select('id').eq('title', gameTitle).single();
        const gameId = gameData ? gameData.id : null;

        // 3. CHECK FOR EXISTING EPHEMERAL ROOM
        let chatRoomId = null;
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        if (gameId) {
            const { data: existingRoom } = await rom.supabase
                .from('chat_rooms')
                .select('id')
                .eq('game_id', gameId)
                .eq('is_ephemeral', true)
                .gte('last_activity', oneHourAgo)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (existingRoom) {
                chatRoomId = existingRoom.id;
                // Extend the life of the existing room
                await rom.supabase.from('chat_rooms').update({ last_activity: new Date().toISOString() }).eq('id', chatRoomId);
                console.log('✅ Joined existing ephemeral room:', chatRoomId);
            } else {
                // Create NEW ephemeral room
                const roomName = `LFG-${gameTitle}-${Date.now()}`;
                const { data: newRoom, error: roomError } = await rom.supabase.from('chat_rooms').insert([{
                    name: roomName,
                    game_id: gameId,
                    is_ephemeral: true,
                    is_public: true,
                    created_by: rom.currentUser.id,
                    last_activity: new Date().toISOString(),
                    description: `Auto-created session for ${gameTitle}`
                }]).select().single();

                if (roomError) throw roomError;
                chatRoomId = newRoom.id;
                console.log('🆕 Created new ephemeral room:', chatRoomId);
            }
        }

        // 4. Insert LFG Post linked to the room
        const { error: lfgError } = await rom.supabase.from('lfg_posts').insert([{
            user_id: rom.currentUser.id,
            posted_username: username,
            avatar_url: avatarUrl,
            game_title: gameTitle,
            platform: platform,
            region: region,
            players_needed: playersNeeded,
            scheduled_time: new Date(scheduledTime).toISOString(),
            timezone: timezone,
            description: description,
            status: 'open',
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 Hour Expiry
            chat_room_id: chatRoomId // LINK THE ROOM
        }]);

        if (lfgError) throw lfgError;

        alert('✅ Session Started! Chat room is now live on the game page.');
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
    if (!rom.currentUser) { alert('You must be logged in to accept.'); return; }
    if (hostId === rom.currentUser.id) { alert('You cannot accept your own post.'); return; }
    if (!confirm('Accept this match request? This will extend the chat room timer.')) return;

    try {
        const accepterUsername = rom.currentUser.user_metadata?.username || rom.currentUser.email.split('@')[0];
        const { data: postData } = await rom.supabase.from('lfg_posts').select('game_title, chat_room_id').eq('id', postId).single();
        
        // Update Post
        const { error: updateError } = await rom.supabase.from('lfg_posts').update({ 
            status: 'full', accepted_by: rom.currentUser.id, accepted_username: accepterUsername 
        }).eq('id', postId);
        if (updateError) throw updateError;

        // Extend Chat Room Activity if it exists
        if (postData?.chat_room_id) {
            await rom.supabase.from('chat_rooms').update({ last_activity: new Date().toISOString() }).eq('id', postData.chat_room_id);
        }

        // Create Alert
        const { error: alertError } = await rom.supabase.from('alerts').insert([{
            user_id: hostId, type: 'lfg_accepted', title: 'LFG Request Accepted!',
            message: `Your session for ${escapeHtml(postData?.game_title || 'a game')} was accepted by ${accepterUsername}!`,
            link_url: '#/lfg', is_read: false
        }]);
        if (alertError) throw alertError;

        alert('✅ You joined the match! Host notified. Chat room extended.');
        if (window.updateNotificationUI) window.updateNotificationUI(); 
        await renderLFGList(rom);

    } catch (err) {
        console.error('Error accepting LFG:', err);
        alert('❌ Error: ' + err.message);
    }
};

async function renderLFGList(rom) {
    const container = document.getElementById('lfg-grid');
    if (!container) return;
    container.innerHTML = `<div class="col-span-full text-center py-8 text-gray-400">Loading sessions...</div>`;

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
            container.innerHTML = `<div class="col-span-full text-center py-12 text-gray-500">No active sessions found.</div>`;
            return;
        }

        const gameTitles = [...new Set(filtered.map(p => p.game_title))];
        const { data: gamesData } = await rom.supabase.from('games').select('title, slug, cover_image_url').in('title', gameTitles);
        const gameMap = {};
        if(gamesData) gamesData.forEach(g => gameMap[g.title] = g);

        container.innerHTML = filtered.map(post => {
            let dateStr = 'TBD', timeStr = '';
            if (post.scheduled_time) {
                const dateObj = new Date(post.scheduled_time);
                dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            }
            
            const displayName = post.posted_username || 'Anonymous';
            const avatarUrl = post.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=06b6d4&color=fff`;
            const profileLink = `#/profile/${displayName}`;

            const gameData = gameMap[post.game_title] || {};
            const coverUrl = gameData.cover_image_url || 'https://via.placeholder.com/150x200/1f2937/06b6d4?text=No+Cover';
            const gameSlug = gameData.slug;
            const gameLink = gameSlug ? `#/game/${gameSlug}` : `#/games?search=${encodeURIComponent(post.game_title)}`;

            // Check if room is active
            const hasActiveChat = !!post.chat_room_id;

            let playersBadgeColor = 'bg-blue-900 text-blue-300 border-blue-700';
            if(post.players_needed === 'Full') playersBadgeColor = 'bg-gray-700 text-gray-300 border-gray-500';
            if(post.players_needed === '1') playersBadgeColor = 'bg-green-900 text-green-300 border-green-700';

            return `
                <div class="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-cyan-500 transition shadow-lg flex flex-col h-full group">
                    <div class="flex p-4 gap-4 border-b border-gray-700 bg-gray-800/50 relative">
                        ${hasActiveChat ? '<div class="absolute top-2 right-2 flex items-center gap-1 bg-green-900/80 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-700 animate-pulse"><span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span> LIVE CHAT</div>' : ''}
                        
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
                                    ${post.players_needed === 'Full' ? 'Full Lobby' : (post.players_needed == '1' ? 'Needs 1' : `Needs ${post.players_needed}`)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="p-4 flex-1 flex flex-col justify-between bg-gray-800">
                        <div class="mb-4">
                            <div class="text-cyan-400 text-xs font-bold mb-2 flex items-center gap-2">
                                <span>🕒</span> ${dateStr} ${timeStr ? '@ ' + timeStr : ''} <span class="text-gray-500 font-normal">(${post.timezone || 'UTC'})</span>
                            </div>
                            ${post.description ? `<p class="text-gray-400 text-sm line-clamp-3">${escapeHtml(post.description)}</p>` : ''}
                        </div>

                        ${rom.currentUser && rom.currentUser.id !== post.user_id ? `
                            <button onclick="acceptLFG('${post.id}', '${post.user_id}', window.rom)" class="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded font-bold text-sm transition shadow-lg transform active:scale-95">
                                Accept Match
                            </button>
                        ` : `
                            <div class="w-full text-center text-gray-500 text-sm py-2 bg-gray-900/30 rounded border border-gray-700">
                                ${rom.currentUser?.id === post.user_id ? 'Your Session' : 'Log in to join'}
                            </div>
                        `}
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Error loading LFG:', err);
        container.innerHTML = `<div class="col-span-full text-center py-8 text-red-400">Error: ${err.message}</div>`;
    }
}

export async function getRecentLFGForTicker(rom) {
    try {
        const { data, error } = await rom.supabase.from('lfg_posts').select('game_title, posted_username, region')
            .eq('status', 'open').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(5);
        if (error || !data) return [];
        return data.map(post => ({
            text: `${post.posted_username} started a session for ${post.game_title} (${post.region})`,
            link: '#/lfg'
        }));
    } catch (err) { console.error('Error fetching LFG for ticker:', err); return []; }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
