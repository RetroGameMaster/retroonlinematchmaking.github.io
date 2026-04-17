let isInitialized = false;

async function initGameDetail(rom, identifier) {
    console.log('🎮 Initializing game detail module for identifier:', identifier);
    
    // Prevent double initialization
    if (isInitialized) {
        console.log('⚠️ Game detail module already initialized, skipping...');
        return;
    }
    isInitialized = true;
    
    // Ensure we have supabase
    if (!rom.supabase) {
        console.error('❌ No Supabase client in rom object');
        if (window.supabase) {
            rom.supabase = window.supabase;
        } else {
            showMessage('error', 'Database connection error');
            return;
        }
    }
    
    // Get the container elements from your HTML
    const gameLoading = document.getElementById('game-loading');
    const gameContent = document.getElementById('game-content');
    const gameError = document.getElementById('game-error');
    
    if (!gameLoading || !gameContent || !gameError) {
        console.error('❌ Game detail container elements not found');
        return;
    }
    
    // Load game data
    try {
        const game = await loadGameByIdentifier(rom, identifier);
        
        if (!game) {
            gameLoading.classList.add('hidden');
            gameError.classList.remove('hidden');
            return;
        }
        
        gameLoading.classList.add('hidden');
        gameContent.classList.remove('hidden');
        
        displayGame(rom, game, gameContent);
        
    } catch (error) {
        console.error('Error loading game:', error);
        gameLoading.classList.add('hidden');
        gameError.classList.remove('hidden');
    }
}

async function loadGameByIdentifier(rom, identifier) {
    console.log('Loading game with identifier:', identifier);
    
    try {
        let query = rom.supabase.from('games').select('*');
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
        
        if (isUuid) {
            query = query.eq('id', identifier);
        } else {
            query = query.eq('slug', identifier);
        }
        
        const { data: game, error } = await query.single();
        
        if (error) {
            console.error('Error loading game:', error);
            if (!isUuid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)) {
                console.log('Trying as ID fallback...');
                const { data: gameById, error: idError } = await rom.supabase
                    .from('games')
                    .select('*')
                    .eq('id', identifier)
                    .single();
                if (idError) return null;
                return gameById;
            }
            return null;
        }
        
        console.log('Game loaded successfully:', game.title);
        return game;
        
    } catch (error) {
        console.error('Error in loadGameByIdentifier:', error);
        return null;
    }
}

async function displayGame(rom, game, container) {
    document.title = `${game.title} - Retro Online Matchmaking`;
    container.dataset.gameId = game.id;
    
    const isAdmin = rom.currentUser && (
        rom.currentUser.email === 'retrogamemasterra@gmail.com' || 
        rom.currentUser.email === 'admin@retroonlinematchmaking.com' ||
        rom.currentUser.email === game.submitted_email
    );

    const gameHTML = `
        <div class="max-w-7xl mx-auto p-4 md:p-6">
            <div class="mb-6">
                <a href="#/games" class="inline-flex items-center text-cyan-400 hover:text-cyan-300">
                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    Back to Games
                </a>
            </div>
            
            <div class="flex flex-col lg:flex-row gap-8 mb-8">
                <div class="lg:w-1/3">
                    <div class="mb-6">
                        ${game.cover_image_url ? 
                            `<img src="${game.cover_image_url}" alt="${escapeHtml(game.title)}" class="w-full rounded-lg shadow-lg game-screenshot">` :
                            `<div class="w-full h-64 bg-gray-800 rounded-lg flex items-center justify-center"><span class="text-gray-500 text-4xl">🎮</span></div>`
                        }
                    </div>
                    
                    <div class="bg-gray-800/50 rounded-lg p-4 mb-4">
                        <h3 class="text-lg font-bold text-white mb-3">📊 Game Info</h3>
                        <div class="space-y-3">
                            <div><span class="text-gray-400 text-sm">Release Year:</span><p class="text-white">${game.year || 'N/A'}</p></div>
                            <div><span class="text-gray-400 text-sm">Players:</span><p class="text-white">${game.players_min || 1}-${game.players_max || '?'}</p></div>
                            <div><span class="text-gray-400 text-sm">Multiplayer Type:</span><p class="text-cyan-300">${game.multiplayer_type || 'Online'}</p></div>
                            <div><span class="text-gray-400 text-sm">Connection Method:</span><p class="text-green-300">${game.connection_method || 'Not specified'}</p></div>
                        </div>
                    </div>
                    
                    <div class="bg-gray-800/50 rounded-lg p-4 mb-4">
                        <h3 class="text-lg font-bold text-white mb-3">⭐ Rating</h3>
                        <div class="flex items-center">
                            <span class="text-yellow-400 text-2xl mr-2">★</span>
                            <span class="text-3xl font-bold text-white">${(game.rating || 0).toFixed(1)}</span>
                            <span class="text-gray-400 ml-2">/5.0</span>
                        </div>
                    </div>
                    
                    <div class="space-y-3">
                        <button id="favoriteBtn" class="w-full bg-cyan-600 hover:bg-cyan-700 text-white py-3 px-4 rounded-lg transition-colors">
                            ${isFavorite(game.id) ? '♥ Remove from Favorites' : '♡ Add to Favorites'}
                        </button>
                        ${isAdmin ? `<button id="editGameBtn" class="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-lg transition-colors">✏️ Edit Game</button>` : ''}
                    </div>
                </div>
                
                <div class="lg:w-2/3">
                    <div class="mb-6">
                        <h1 id="gameTitle" class="text-4xl font-bold text-white mb-3">${escapeHtml(game.title)}</h1>
                        <div class="flex flex-wrap gap-2 mb-4">
                            ${game.console ? game.console.split(',').map(platform => `<span class="inline-block bg-gray-700 text-gray-300 text-sm px-3 py-1 rounded">${platform.trim()}</span>`).join('') : ''}
                        </div>
                        <div class="flex items-center text-gray-400 text-sm flex-wrap gap-2">
                            <span>Submitted by: ${game.submitted_by || 'Unknown'}</span>
                            <span>•</span>
                            <span>Approved: ${game.approved_at ? new Date(game.approved_at).toLocaleDateString() : 'Pending'}</span>
                            ${(game.multiplayer_type && game.multiplayer_type !== 'Single Player Only') ? '<span class="ml-2 bg-purple-900 text-purple-300 px-2 py-0.5 rounded text-xs">🌐 Multiplayer</span>' : ''}
                        </div>
                    </div>
                    
                    <div class="mb-8">
                        <h2 class="text-2xl font-bold text-white mb-4">📝 Description</h2>
                        <div id="gameDescription" class="text-gray-300 leading-relaxed text-lg">${formatDescription(game.description)}</div>
                    </div>
                    
                    ${game.connection_details ? `<div class="mb-8"><h2 class="text-2xl font-bold text-white mb-4">🔗 Connection Details</h2><div class="bg-gray-800/30 rounded-lg p-4"><p class="text-gray-300 whitespace-pre-line">${escapeHtml(game.connection_details)}</p></div></div>` : ''}
                    ${game.server_details ? `<div class="mb-8"><h2 class="text-2xl font-bold text-white mb-4">🖥️ Server Details</h2><div class="bg-gray-800/30 rounded-lg p-4"><p class="text-gray-300 whitespace-pre-line">${escapeHtml(game.server_details)}</p></div></div>` : ''}
                    
                    <div class="mb-8">
                        <h2 class="text-2xl font-bold text-white mb-4">📊 Game Stats</h2>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div class="bg-gray-800/50 rounded-lg p-4 text-center"><div class="text-cyan-300 text-2xl font-bold">${game.views_count || 0}</div><div class="text-gray-400 text-sm">Views</div></div>
                            <div class="bg-gray-800/50 rounded-lg p-4 text-center"><div class="text-green-300 text-2xl font-bold">${game.downloads || 0}</div><div class="text-gray-400 text-sm">Downloads</div></div>
                            <div class="bg-gray-800/50 rounded-lg p-4 text-center"><div class="text-yellow-300 text-2xl font-bold">${game.rating ? game.rating.toFixed(1) : '0.0'}</div><div class="text-gray-400 text-sm">Rating</div></div>
                            <div class="bg-gray-800/50 rounded-lg p-4 text-center"><div class="text-purple-300 text-2xl font-bold">${game.last_activity ? new Date(game.last_activity).getFullYear() : 'N/A'}</div><div class="text-gray-400 text-sm">Last Active</div></div>
                        </div>
                    </div>

                    <!-- NEW: Recent Players Section -->
                    <div class="mb-8 bg-gray-800 rounded-xl p-6 border border-gray-700">
                        <h2 class="text-xl font-bold text-white mb-4">👥 Recently Active</h2>
                        <div id="recent-players-list" class="flex flex-wrap gap-3">
                            <div class="text-gray-500 text-sm">Loading players...</div>
                        </div>
                    </div>

                    <!-- NEW: Achievements Section -->
                    <div class="mb-8 bg-gray-800 rounded-xl p-6 border border-gray-700">
                        <h2 class="text-xl font-bold text-white mb-4">🏆 Achievements</h2>
                        <div id="achievements-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div class="text-gray-500 text-sm">Loading achievements...</div>
                        </div>
                    </div>
                    
                    <!-- Comments Section -->
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-4">💬 Comments</h2>
                        <div id="loginToComment" class="${rom.currentUser ? 'hidden' : ''} mb-6 p-4 bg-gray-800/50 rounded-lg">
                            <p class="text-gray-300">Please <a href="#/auth" class="text-cyan-400 hover:underline">log in</a> to comment.</p>
                        </div>
                        
                        <form id="commentForm" class="${rom.currentUser ? '' : 'hidden'} mb-6">
                            <textarea id="commentInput" class="w-full bg-gray-800 border border-gray-700 rounded-lg p-4 text-white mb-3 focus:border-cyan-500 focus:outline-none" rows="4" placeholder="Add a comment about this game..."></textarea>
                            <div class="flex justify-end">
                                <button type="submit" id="submitComment" class="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">Post Comment</button>
                            </div>
                        </form>
                        
                        <div id="commentsContainer" class="space-y-4">
                            <div class="text-center py-8"><div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div><p class="text-gray-400 mt-2">Loading comments...</p></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Edit Form (hidden initially) -->
            <div id="editGameForm" class="hidden bg-gray-800/70 rounded-lg p-6 mt-8 border border-gray-700">
                <h2 class="text-2xl font-bold text-white mb-6">✏️ Edit Game</h2>
                <input type="hidden" id="editGameId" value="${game.id}">
                <div class="grid md:grid-cols-2 gap-4 mb-6">
                    <div><label class="block text-gray-300 mb-2">Title *</label><input type="text" id="editTitle" value="${escapeHtml(game.title)}" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none"></div>
                    <div><label class="block text-gray-300 mb-2">Year</label><input type="number" id="editYear" value="${game.year || ''}" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none"></div>
                </div>
                <div class="mb-4"><label class="block text-gray-300 mb-2">Description *</label><textarea id="editDescription" rows="4" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">${escapeHtml(game.description || '')}</textarea></div>
                <div class="grid md:grid-cols-2 gap-4 mb-6">
                    <div><label class="block text-gray-300 mb-2">Minimum Players</label><input type="number" id="editPlayersMin" value="${game.players_min || 1}" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none"></div>
                    <div><label class="block text-gray-300 mb-2">Maximum Players</label><input type="number" id="editPlayersMax" value="${game.players_max || 1}" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none"></div>
                </div>
                <div class="mb-4"><label class="block text-gray-300 mb-2">Console(s)</label><input type="text" id="editConsole" value="${escapeHtml(game.console || '')}" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none"></div>
                <div class="mb-4"><label class="block text-gray-300 mb-2">Connection Method</label><input type="text" id="editConnectionMethod" value="${escapeHtml(game.connection_method || '')}" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none"></div>
                <div class="mb-4"><label class="block text-gray-300 mb-2">Multiplayer Type</label>
                    <select id="editMultiplayerType" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">
                        <option value="LAN" ${game.multiplayer_type === 'LAN' ? 'selected' : ''}>LAN</option>
                        <option value="Online" ${game.multiplayer_type === 'Online' ? 'selected' : ''}>Online</option>
                        <option value="Split-screen" ${game.multiplayer_type === 'Split-screen' ? 'selected' : ''}>Split-screen</option>
                        <option value="Hotseat" ${game.multiplayer_type === 'Hotseat' ? 'selected' : ''}>Hotseat</option>
                        <option value="Mixed" ${game.multiplayer_type === 'Mixed' ? 'selected' : ''}>Mixed</option>
                        <option value="Other" ${game.multiplayer_type === 'Other' ? 'selected' : ''}>Other</option>
                    </select>
                </div>
                <div class="mb-6"><label class="block text-gray-300 mb-2">Server Details</label><textarea id="editServerDetails" rows="3" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">${escapeHtml(game.server_details || '')}</textarea></div>
                <div class="mb-6"><label class="block text-gray-300 mb-2">Cover Image URL</label><input type="text" id="editCoverImage" value="${escapeHtml(game.cover_image_url || '')}" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none"><p class="text-gray-400 text-sm mt-1">Direct URL to image (optional)</p></div>
                <div class="flex justify-end gap-3">
                    <button onclick="window.cancelEdit()" class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors">Cancel</button>
                    <button onclick="window.saveGameEdit()" class="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg transition-colors">Save Changes</button>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = gameHTML;
    
    // Initialize event listeners
    setTimeout(() => {
        // Favorites
        const favoriteBtn = document.getElementById('favoriteBtn');
        if (favoriteBtn) {
            favoriteBtn.onclick = () => toggleFavorite(game.id, favoriteBtn);
        }
        
        // Edit button
        const editBtn = document.getElementById('editGameBtn');
        if (editBtn) editBtn.onclick = () => editGame(game);
        
        // Comments
        const commentForm = document.getElementById('commentForm');
        if (commentForm) {
            commentForm.onsubmit = async (e) => {
                e.preventDefault();
                if (!rom.currentUser) { showMessage('error', 'Please log in to comment'); return; }
                const content = document.getElementById('commentInput').value.trim();
                if (!content) return;
                
                const btn = document.getElementById('submitComment');
                btn.disabled = true;
                btn.textContent = 'Posting...';
                
                try {
                    const { error } = await rom.supabase.from('game_comments').insert({
                        game_id: game.id,
                        user_id: rom.currentUser.id,
                        user_email: rom.currentUser.email,
                        username: rom.currentUser.email.split('@')[0],
                        comment: content,
                        created_at: new Date().toISOString()
                    });
                    if (error) throw error;
                    showMessage('success', 'Comment added successfully');
                    document.getElementById('commentInput').value = '';
                    loadComments(rom, game.id);
                } catch (err) {
                    showMessage('error', `Failed to add comment: ${err.message}`);
                } finally {
                    btn.disabled = false;
                    btn.textContent = 'Post Comment';
                }
            };
        }
        
        loadComments(rom, game.id);
        loadRecentPlayers(rom, game.id);
        loadAchievements(rom, game.id);
        
    }, 100);
    
    if (game.slug && !identifier.includes(game.slug)) {
        updateUrlToSlug(game.slug);
    }
}

// ===== NEW: Load Recent Players =====
async function loadRecentPlayers(rom, gameId) {
    const list = document.getElementById('recent-players-list');
    if (!list) return;
    try {
        const { data, error } = await rom.supabase
            .from('user_activity')
            .select('*, profiles(username)')
            .eq('game_id', gameId)
            .order('last_seen', { ascending: false })
            .limit(8);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            list.innerHTML = '<p class="text-gray-500 text-sm">No recent activity</p>';
            return;
        }
        
        list.innerHTML = data.map(p => `
            <div class="flex items-center gap-2 bg-gray-900 px-3 py-2 rounded-lg border border-gray-700">
                <div class="w-8 h-8 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    ${(p.profiles?.username || 'U').charAt(0).toUpperCase()}
                </div>
                <span class="text-sm text-gray-200">${escapeHtml(p.profiles?.username || 'Anonymous')}</span>
                <span class="text-xs text-gray-500">${timeAgo(p.last_seen)}</span>
            </div>
        `).join('');
    } catch (err) {
        console.error('Error loading recent players:', err);
        list.innerHTML = '<p class="text-red-400 text-sm">Failed to load</p>';
    }
}

// ===== NEW: Load Achievements =====
async function loadAchievements(rom, gameId) {
    const grid = document.getElementById('achievements-grid');
    if (!grid) return;
    try {
        const { data, error } = await rom.supabase
            .from('achievements')
            .select('*')
            .eq('game_id', gameId)
            .order('points', { ascending: false });
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            grid.innerHTML = '<p class="text-gray-500 text-sm col-span-full">No achievements yet</p>';
            return;
        }
        
        grid.innerHTML = data.map(a => `
            <div class="bg-gray-900 rounded-lg p-4 border border-gray-700 hover:border-yellow-500 transition">
                <div class="flex items-start gap-3">
                    <img src="${a.badge_url || 'https://via.placeholder.com/48/1f2937/6b7280?text=🏆'}" 
                         alt="${escapeHtml(a.title)}" class="w-12 h-12 rounded-lg object-cover flex-shrink-0">
                    <div class="flex-1">
                        <div class="flex justify-between items-start">
                            <h3 class="font-bold text-white text-sm">${escapeHtml(a.title)}</h3>
                            <span class="bg-yellow-900 text-yellow-300 px-2 py-0.5 rounded text-xs font-bold">${a.points} pts</span>
                        </div>
                        <p class="text-gray-400 text-xs mt-1 line-clamp-2">${escapeHtml(a.description || '')}</p>
                        ${a.is_multiplayer ? '<span class="inline-block mt-2 bg-purple-900 text-purple-300 px-2 py-0.5 rounded text-xs">🌐 MP</span>' : ''}
                        ${a.memory_logic ? `
                            <details class="mt-2">
                                <summary class="cursor-pointer text-xs text-gray-500 hover:text-gray-300">Memory Logic</summary>
                                <code class="block mt-1 p-2 bg-black rounded text-green-400 text-xs overflow-x-auto font-mono">${escapeHtml(a.memory_logic)}</code>
                            </details>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Error loading achievements:', err);
        grid.innerHTML = '<p class="text-red-400 text-sm">Failed to load</p>';
    }
}

// ===== EXISTING HELPERS =====
function isFavorite(gameId) {
    const favorites = JSON.parse(localStorage.getItem('rom_favorites') || '[]');
    return favorites.includes(gameId);
}

async function toggleFavorite(gameId, button) {
    const isFavorited = button.textContent.includes('Remove');
    if (isFavorited) {
        button.innerHTML = '♡ Add to Favorites';
        showMessage('info', 'Removed from favorites');
        const favorites = JSON.parse(localStorage.getItem('rom_favorites') || '[]');
        const index = favorites.indexOf(gameId);
        if (index > -1) { favorites.splice(index, 1); localStorage.setItem('rom_favorites', JSON.stringify(favorites)); }
    } else {
        button.innerHTML = '♥ Remove from Favorites';
        showMessage('success', 'Added to favorites');
        const favorites = JSON.parse(localStorage.getItem('rom_favorites') || '[]');
        favorites.push(gameId);
        localStorage.setItem('rom_favorites', JSON.stringify(favorites));
    }
}

function updateUrlToSlug(slug) {
    const currentHash = window.location.hash;
    if (!currentHash.includes(`/${slug}`)) {
        const newHash = `#/game/${slug}`;
        window.history.replaceState(null, '', newHash);
    }
}

function editGame(game) {
    const editForm = document.getElementById('editGameForm');
    const gameDisplay = document.querySelector('#game-content > div');
    if (editForm && gameDisplay) {
        gameDisplay.classList.add('hidden');
        editForm.classList.remove('hidden');
        editForm.scrollIntoView({ behavior: 'smooth' });
    }
}

function formatDescription(text) {
    if (!text) return '<span class="text-gray-500 italic">No description available</span>';
    return escapeHtml(text)
        .replace(/\n/g, '<br>')
        .replace(/\[b\](.*?)\[\/b\]/gi, '<strong>$1</strong>')
        .replace(/\[i\](.*?)\[\/i\]/gi, '<em>$1</em>')
        .replace(/\[u\](.*?)\[\/u\]/gi, '<u>$1</u>')
        .replace(/\[url\](.*?)\[\/url\]/gi, '<a href="$1" target="_blank" class="text-cyan-400 hover:underline">$1</a>')
        .replace(/\[url=(.*?)\](.*?)\[\/url\]/gi, '<a href="$1" target="_blank" class="text-cyan-400 hover:underline">$2</a>');
}

async function loadComments(rom, gameId) {
    const commentsContainer = document.getElementById('commentsContainer');
    if (!commentsContainer) return;
    try {
        const { data, error } = await rom.supabase
            .from('game_comments')
            .select('*')
            .eq('game_id', gameId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        displayComments(data || []);
    } catch (error) {
        console.error('Error loading comments:', error);
        commentsContainer.innerHTML = `<div class="text-center py-8 text-gray-500">Failed to load comments: ${error.message}</div>`;
    }
}

function displayComments(comments) {
    const commentsContainer = document.getElementById('commentsContainer');
    if (!commentsContainer) return;
    if (comments.length === 0) {
        commentsContainer.innerHTML = `<div class="text-center py-8 text-gray-500">No comments yet. Be the first to comment!</div>`;
        return;
    }
    commentsContainer.innerHTML = comments.map(comment => createCommentHTML(comment)).join('');
}

function createCommentHTML(comment) {
    const date = new Date(comment.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const username = comment.username || comment.user_email?.split('@')[0] || 'Anonymous';
    return `
        <div class="comment bg-gray-800/50 rounded-lg p-4 comment-box">
            <div class="flex items-start gap-3 mb-3">
                <div class="flex-shrink-0">
                    <div class="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center comment-avatar">
                        <span class="text-gray-400">👤</span>
                    </div>
                </div>
                <div class="flex-1">
                    <div class="flex justify-between items-center mb-2">
                        <div><span class="font-bold text-cyan-300">${username}</span><span class="text-gray-500 text-sm ml-2">${date}</span></div>
                        ${comment.is_edited ? '<span class="text-gray-400 text-xs">(edited)</span>' : ''}
                    </div>
                    <p class="text-gray-300">${escapeHtml(comment.comment)}</p>
                </div>
            </div>
        </div>
    `;
}

function showMessage(type, text) {
    let messageContainer = document.getElementById('gameMessage');
    if (!messageContainer) {
        messageContainer = document.createElement('div');
        messageContainer.id = 'gameMessage';
        messageContainer.className = 'fixed top-4 right-4 z-50 max-w-sm';
        document.body.appendChild(messageContainer);
    }
    const messageId = 'msg-' + Date.now();
    const bgColor = type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-green-600' : 'bg-blue-600';
    messageContainer.innerHTML += `
        <div id="${messageId}" class="${bgColor} text-white p-4 rounded-lg shadow-lg mb-2 animate-fade-in">
            <div class="flex justify-between items-center">
                <span>${text}</span>
                <button onclick="document.getElementById('${messageId}').remove()" class="ml-4 text-white hover:text-gray-200">✕</button>
            </div>
        </div>
    `;
    setTimeout(() => { const msg = document.getElementById(messageId); if (msg) msg.remove(); }, 5000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

// ===== GLOBAL FUNCTIONS FOR EDIT FORM =====
window.saveGameEdit = async function() {
    const rom = window.rom;
    const gameId = document.getElementById('editGameId').value;
    const title = document.getElementById('editTitle').value.trim();
    const description = document.getElementById('editDescription').value.trim();
    
    if (!title) { showMessage('error', 'Title is required'); return; }
    if (!description) { showMessage('error', 'Description is required'); return; }
    
    try {
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 100);
        const updates = {
            title, year: document.getElementById('editYear').value ? parseInt(document.getElementById('editYear').value) : null,
            description, players_min: parseInt(document.getElementById('editPlayersMin').value) || 1,
            players_max: parseInt(document.getElementById('editPlayersMax').value) || 1,
            console: document.getElementById('editConsole').value.trim(),
            connection_method: document.getElementById('editConnectionMethod').value.trim(),
            server_details: document.getElementById('editServerDetails').value.trim(),
            cover_image_url: document.getElementById('editCoverImage').value.trim() || null,
            multiplayer_type: document.getElementById('editMultiplayerType').value,
            slug, updated_at: new Date().toISOString()
        };
        
        const { error } = await rom.supabase.from('games').update(updates).eq('id', gameId);
        if (error) throw error;
        showMessage('success', 'Game updated successfully');
        setTimeout(() => { window.location.hash = `#/game/${slug}`; window.location.reload(); }, 1000);
    } catch (error) {
        console.error('Error updating game:', error);
        showMessage('error', `Failed to update game: ${error.message}`);
    }
};

window.cancelEdit = function() {
    const editForm = document.getElementById('editGameForm');
    const gameDisplay = document.querySelector('#game-content > div');
    if (editForm && gameDisplay) {
        editForm.classList.add('hidden');
        gameDisplay.classList.remove('hidden');
    }
};

export default initGameDetail;
window.initGameDetail = initGameDetail;
