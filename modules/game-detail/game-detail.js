// modules/game-detail/game-detail.js - FIXED REFERENCE ERROR
let isInitialized = false; // Add this at the top

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
    
    // Load game data
    const game = await loadGameByIdentifier(identifier);
    
    if (!game) {
        showNotFound();
        return;
    }
    
    // Display game data
    displayGame(game);
    
    // Load comments
    loadComments(game.id);
    
    // Initialize rating
    initRating(game.id);
    
    // Initialize edit button (if admin) - FIXED: Define this function before using it
    initEditButton(game);
    
    // Load game by identifier (slug or ID)
    async function loadGameByIdentifier(identifier) {
        console.log('Loading game with identifier:', identifier);
        
        try {
            let query = rom.supabase
                .from('games')
                .select('*');
            
            // Check if identifier is a UUID (ID) or a slug
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
            
            console.log(`Is UUID? ${isUuid} for identifier: ${identifier}`);
            
            if (isUuid) {
                query = query.eq('id', identifier);
            } else {
                query = query.eq('slug', identifier);
            }
            
            const { data: game, error } = await query.single();
            
            if (error) {
                console.error('Error loading game:', error);
                
                // If not found by slug, try ID as fallback (only if it looks like a UUID)
                if (!isUuid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)) {
                    console.log('Trying as ID fallback...');
                    const { data: gameById, error: idError } = await rom.supabase
                        .from('games')
                        .select('*')
                        .eq('id', identifier)
                        .single();
                    
                    if (idError) {
                        console.error('Also not found by ID:', idError);
                        return null;
                    }
                    
                    console.log('Found by ID fallback:', gameById.title);
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
    
    // Display game data
    function displayGame(game) {
        // Update page title
        document.title = `${game.title} - Retro Online Matchmaking`;
        
        // Set game ID as data attribute for reference
        const gameDetail = document.getElementById('gameDetail');
        if (gameDetail) {
            gameDetail.dataset.gameId = game.id;
        }
        
        // Update game title
        const titleElement = document.getElementById('gameTitle');
        if (titleElement) {
            titleElement.textContent = game.title;
        }
        
        // Update game year
        const yearElement = document.getElementById('gameYear');
        if (yearElement) {
            yearElement.textContent = game.year || 'N/A';
        }
        
        // Update game description
        const descriptionElement = document.getElementById('gameDescription');
        if (descriptionElement) {
            descriptionElement.innerHTML = formatDescription(game.description);
        }
        
        // Update platforms
        const platformsElement = document.getElementById('gamePlatforms');
        if (platformsElement) {
            const platforms = game.console?.split(',').map(p => p.trim()) || [];
            platformsElement.innerHTML = platforms.map(platform => 
                `<span class="inline-block bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded mr-1 mb-1">${platform}</span>`
            ).join('');
        }
        
        // Update player count
        const playersElement = document.getElementById('gamePlayers');
        if (playersElement) {
            playersElement.textContent = `${game.players_min || 1}-${game.players_max || '?'} players`;
        }
        
        // Update connection methods
        const connectionElement = document.getElementById('gameConnection');
        if (connectionElement && game.connection_method) {
            const methods = game.connection_method.split(',').map(m => m.trim());
            connectionElement.innerHTML = methods.map(method => 
                `<span class="inline-block bg-cyan-900/50 text-cyan-300 text-xs px-2 py-1 rounded mr-1 mb-1">${method}</span>`
            ).join('');
        }
        
        // Update server details
        const serverElement = document.getElementById('gameServers');
        if (serverElement && game.server_details) {
            const servers = game.server_details.split(',').map(s => s.trim());
            serverElement.innerHTML = servers.map(server => 
                `<div class="server-item">
                    <span class="text-green-400">●</span>
                    <code class="ml-2 font-mono text-sm">${server}</code>
                </div>`
            ).join('');
        } else if (serverElement) {
            serverElement.innerHTML = '<span class="text-gray-500">No server details available</span>';
        }
        
        // Update rating
        const ratingElement = document.getElementById('gameRating');
        if (ratingElement) {
            ratingElement.innerHTML = `
                <span class="text-yellow-400 text-xl">★</span>
                <span class="text-2xl font-bold ml-2">${(game.rating || 0).toFixed(1)}</span>
            `;
        }
        
        // Update game stats
        const statsElement = document.getElementById('gameStats');
        if (statsElement) {
            const views = game.views_count || 0;
            const downloads = game.downloads || 0;
            const approvedDate = game.approved_at ? new Date(game.approved_at).toLocaleDateString() : 'Unknown';
            
            statsElement.innerHTML = `
                <div class="flex flex-wrap gap-4">
                    <div class="stat-item">
                        <span class="text-gray-400">Views:</span>
                        <span class="text-cyan-300 ml-2">${views}</span>
                    </div>
                    <div class="stat-item">
                        <span class="text-gray-400">Downloads:</span>
                        <span class="text-cyan-300 ml-2">${downloads}</span>
                    </div>
                    <div class="stat-item">
                        <span class="text-gray-400">Approved:</span>
                        <span class="text-cyan-300 ml-2">${approvedDate}</span>
                    </div>
                </div>
            `;
        }
        
        // Update favorite button
        const favoriteBtn = document.getElementById('favoriteBtn');
        if (favoriteBtn) {
            const isFavorited = isFavorite(game.id);
            favoriteBtn.innerHTML = isFavorited ? 
                '♥ Remove from Favorites' : 
                '♡ Add to Favorites';
            favoriteBtn.dataset.favorited = isFavorited;
            
            favoriteBtn.onclick = () => toggleFavorite(game.id, favoriteBtn);
        }
        
        // Display cover image if available
        const coverImageElement = document.getElementById('gameCoverImage');
        if (coverImageElement && game.cover_image_url) {
            coverImageElement.innerHTML = `
                <img src="${game.cover_image_url}" alt="${escapeHtml(game.title)}" 
                     class="w-full h-64 object-cover rounded-lg">
            `;
        }
        
        // Update URL if we're using ID but have slug
        if (game.slug && !identifier.includes(game.slug)) {
            updateUrlToSlug(game.slug);
        }
    }
    
    // Initialize edit button - NOW DEFINED BEFORE BEING CALLED
    function initEditButton(game) {
        const editBtn = document.getElementById('editGameBtn');
        if (!editBtn) return;
        
        // Show edit button if user is admin or game submitter
        const canEdit = rom.currentUser && (
            rom.currentUser.email === game.submitted_email || 
            rom.currentUser.email === 'retrogamemasterra@gmail.com' ||
            rom.currentUser.email === 'admin@retroonlinematchmaking.com'
        );
        
        if (canEdit) {
            editBtn.classList.remove('hidden');
            editBtn.onclick = () => editGame(game);
        } else {
            editBtn.classList.add('hidden');
        }
    }
    
    // Check if game is favorited
    function isFavorite(gameId) {
        const favorites = JSON.parse(localStorage.getItem('rom_favorites') || '[]');
        return favorites.includes(gameId);
    }
    
    // Toggle favorite
    async function toggleFavorite(gameId, button) {
        const isFavorited = button.dataset.favorited === 'true';
        
        if (isFavorited) {
            button.innerHTML = '♡ Add to Favorites';
            button.dataset.favorited = 'false';
            showMessage('info', 'Removed from favorites');
            
            // Remove from localStorage
            const favorites = JSON.parse(localStorage.getItem('rom_favorites') || '[]');
            const index = favorites.indexOf(gameId);
            if (index > -1) {
                favorites.splice(index, 1);
                localStorage.setItem('rom_favorites', JSON.stringify(favorites));
            }
        } else {
            button.innerHTML = '♥ Remove from Favorites';
            button.dataset.favorited = 'true';
            showMessage('success', 'Added to favorites');
            
            // Add to localStorage
            const favorites = JSON.parse(localStorage.getItem('rom_favorites') || '[]');
            favorites.push(gameId);
            localStorage.setItem('rom_favorites', JSON.stringify(favorites));
        }
    }
    
    // Update URL to use slug (for SEO)
    function updateUrlToSlug(slug) {
        const currentHash = window.location.hash;
        if (!currentHash.includes(`/${slug}`)) {
            const newHash = `#/game/${slug}`;
            window.history.replaceState(null, '', newHash);
            console.log('Updated URL to slug:', newHash);
        }
    }
    
    // Edit game function
    async function editGame(game) {
        console.log('Editing game:', game.title);
        
        // Show edit form
        const editForm = document.getElementById('editGameForm');
        const gameDisplay = document.getElementById('gameDisplay');
        
        if (editForm && gameDisplay) {
            // Populate form
            document.getElementById('editGameId').value = game.id;
            document.getElementById('editTitle').value = game.title;
            document.getElementById('editYear').value = game.year || '';
            document.getElementById('editDescription').value = game.description || '';
            document.getElementById('editPlayersMin').value = game.players_min || 1;
            document.getElementById('editPlayersMax').value = game.players_max || 1;
            document.getElementById('editConsole').value = game.console || '';
            document.getElementById('editConnectionMethod').value = game.connection_method || '';
            document.getElementById('editServerDetails').value = game.server_details || '';
            document.getElementById('editCoverImage').value = game.cover_image_url || '';
            document.getElementById('editMultiplayerType').value = game.multiplayer_type || 'Online';
            
            // Show form, hide display
            editForm.classList.remove('hidden');
            gameDisplay.classList.add('hidden');
            
            // Focus on title
            document.getElementById('editTitle').focus();
        }
    }
    
    // Format description with line breaks
    function formatDescription(text) {
        if (!text) return '<span class="text-gray-500">No description available</span>';
        return text
            .replace(/\n/g, '<br>')
            .replace(/\[b\](.*?)\[\/b\]/g, '<strong>$1</strong>')
            .replace(/\[i\](.*?)\[\/i\]/g, '<em>$1</em>')
            .replace(/\[url\](.*?)\[\/url\]/g, '<a href="$1" target="_blank" class="text-cyan-400 hover:underline">$1</a>');
    }
    
    // Load comments
    async function loadComments(gameId) {
        const commentsContainer = document.getElementById('commentsContainer');
        if (!commentsContainer) return;
        
        try {
            const { data: comments, error } = await rom.supabase
                .from('game_comments')
                .select('*')
                .eq('game_id', gameId)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            displayComments(comments || []);
            
        } catch (error) {
            console.error('Error loading comments:', error);
            commentsContainer.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    Failed to load comments: ${error.message}
                </div>
            `;
        }
    }
    
    // Display comments
    function displayComments(comments) {
        const commentsContainer = document.getElementById('commentsContainer');
        if (!commentsContainer) return;
        
        if (comments.length === 0) {
            commentsContainer.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    No comments yet. Be the first to comment!
                </div>
            `;
            return;
        }
        
        commentsContainer.innerHTML = comments.map(comment => createCommentHTML(comment)).join('');
        
        // Initialize comment form
        initCommentForm();
    }
    
    // Create comment HTML
    function createCommentHTML(comment) {
        const date = new Date(comment.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
            <div class="comment bg-gray-800/50 rounded-lg p-4 mb-4">
                <div class="flex items-start gap-3 mb-3">
                    <div class="flex-shrink-0">
                        <div class="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                            <span class="text-gray-400">👤</span>
                        </div>
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between items-center">
                            <div>
                                <span class="font-bold text-cyan-300">${comment.username || comment.user_email || 'Anonymous'}</span>
                                <span class="text-gray-500 text-sm ml-2">${date}</span>
                            </div>
                        </div>
                        <p class="text-gray-300 mt-2">${escapeHtml(comment.comment || comment.content)}</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Initialize comment form
    function initCommentForm() {
        const commentForm = document.getElementById('commentForm');
        const commentInput = document.getElementById('commentInput');
        const submitCommentBtn = document.getElementById('submitComment');
        
        if (!commentForm || !commentInput || !submitCommentBtn) return;
        
        // Show/hide form based on auth
        if (rom.currentUser) {
            commentForm.classList.remove('hidden');
            commentInput.placeholder = 'Add a comment...';
        } else {
            commentForm.classList.add('hidden');
            // Show login prompt
            const loginPrompt = document.getElementById('loginToComment');
            if (loginPrompt) {
                loginPrompt.classList.remove('hidden');
            }
        }
        
        // Handle comment submission
        commentForm.onsubmit = async (e) => {
            e.preventDefault();
            
            if (!rom.currentUser) {
                showMessage('error', 'Please log in to comment');
                rom.loadModule('auth');
                return;
            }
            
            const content = commentInput.value.trim();
            if (!content) {
                showMessage('error', 'Please enter a comment');
                return;
            }
            
            const gameId = document.getElementById('gameDetail').dataset.gameId;
            
            try {
                const { error } = await rom.supabase
                    .from('game_comments')
                    .insert({
                        game_id: gameId,
                        user_id: rom.currentUser.id,
                        user_email: rom.currentUser.email,
                        username: rom.currentUser.email,
                        comment: content,
                        created_at: new Date().toISOString()
                    });
                
                if (error) throw error;
                
                showMessage('success', 'Comment added successfully');
                commentInput.value = '';
                
                // Reload comments
                loadComments(gameId);
                
            } catch (error) {
                console.error('Error adding comment:', error);
                showMessage('error', `Failed to add comment: ${error.message}`);
            }
        };
    }
    
    // Initialize rating system
    function initRating(gameId) {
        const ratingStars = document.getElementById('ratingStars');
        if (!ratingStars) return;
        
        // Show/hide based on auth
        if (rom.currentUser) {
            ratingStars.classList.remove('hidden');
        } else {
            ratingStars.classList.add('hidden');
        }
        
        // Star click events
        const stars = ratingStars.querySelectorAll('.star');
        stars.forEach((star, index) => {
            star.onclick = () => submitRating(gameId, index + 1);
        });
    }
    
    // Submit rating
    async function submitRating(gameId, rating) {
        if (!rom.currentUser) {
            showMessage('error', 'Please log in to rate games');
            rom.loadModule('auth');
            return;
        }
        
        try {
            const { error } = await rom.supabase
                .from('game_ratings')
                .upsert({
                    game_id: gameId,
                    user_id: rom.currentUser.id,
                    rating: rating
                }, {
                    onConflict: 'game_id,user_id'
                });
            
            if (error) throw error;
            
            showMessage('success', `Rated ${rating} star${rating !== 1 ? 's' : ''}`);
            
            // Reload game to update rating
            const game = await loadGameByIdentifier(identifier);
            if (game) {
                const ratingElement = document.getElementById('gameRating');
                if (ratingElement) {
                    ratingElement.innerHTML = `
                        <span class="text-yellow-400 text-xl">★</span>
                        <span class="text-2xl font-bold ml-2">${(game.rating || 0).toFixed(1)}</span>
                    `;
                }
            }
            
        } catch (error) {
            console.error('Error submitting rating:', error);
            showMessage('error', `Failed to submit rating: ${error.message}`);
        }
    }
    
    // Show not found message
    function showNotFound() {
        const gameDetail = document.getElementById('gameDetail');
        if (gameDetail) {
            gameDetail.innerHTML = `
                <div class="text-center py-16 px-4">
                    <div class="text-6xl mb-6">🎮</div>
                    <h2 class="text-2xl font-bold text-red-400 mb-4">Game Not Found</h2>
                    <p class="text-gray-400 mb-8">The game you're looking for doesn't exist or has been removed.</p>
                    <a href="#/games" class="inline-block bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg">
                        Browse All Games
                    </a>
                </div>
            `;
        }
    }
    
    // Show message
    function showMessage(type, text) {
        // Create or get message container
        let messageContainer = document.getElementById('gameMessage');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.id = 'gameMessage';
            messageContainer.className = 'fixed top-4 right-4 z-50 max-w-sm';
            document.body.appendChild(messageContainer);
        }
        
        const messageId = 'msg-' + Date.now();
        const bgColor = type === 'error' ? 'bg-red-600' : 
                       type === 'success' ? 'bg-green-600' : 'bg-blue-600';
        
        messageContainer.innerHTML += `
            <div id="${messageId}" class="${bgColor} text-white p-4 rounded-lg shadow-lg mb-2 animate-fade-in">
                <div class="flex justify-between items-center">
                    <span>${text}</span>
                    <button onclick="document.getElementById('${messageId}').remove()" class="ml-4 text-white hover:text-gray-200">
                        ✕
                    </button>
                </div>
            </div>
        `;
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            const msg = document.getElementById(messageId);
            if (msg) msg.remove();
        }, 5000);
    }
    
    // Save edit function (exposed globally)
    window.saveGameEdit = async function() {
        const gameId = document.getElementById('editGameId').value;
        const title = document.getElementById('editTitle').value.trim();
        const description = document.getElementById('editDescription').value.trim();
        
        if (!title) {
            showMessage('error', 'Title is required');
            return;
        }
        
        if (!description) {
            showMessage('error', 'Description is required');
            return;
        }
        
        try {
            // Generate slug from title
            const slug = await generateSlug(title, gameId);
            
            const updates = {
                title: title,
                year: document.getElementById('editYear').value ? parseInt(document.getElementById('editYear').value) : null,
                description: description,
                players_min: parseInt(document.getElementById('editPlayersMin').value) || 1,
                players_max: parseInt(document.getElementById('editPlayersMax').value) || 1,
                console: document.getElementById('editConsole').value.trim(),
                connection_method: document.getElementById('editConnectionMethod').value.trim(),
                server_details: document.getElementById('editServerDetails').value.trim(),
                cover_image_url: document.getElementById('editCoverImage').value.trim() || null,
                multiplayer_type: document.getElementById('editMultiplayerType').value,
                slug: slug,
                updated_at: new Date().toISOString()
            };
            
            const { error } = await rom.supabase
                .from('games')
                .update(updates)
                .eq('id', gameId);
            
            if (error) throw error;
            
            showMessage('success', 'Game updated successfully');
            
            // Hide form, show updated game
            document.getElementById('editGameForm').classList.add('hidden');
            document.getElementById('gameDisplay').classList.remove('hidden');
            
            // Reload game data
            const game = await loadGameByIdentifier(slug);
            if (game) {
                displayGame(game);
            }
            
        } catch (error) {
            console.error('Error updating game:', error);
            showMessage('error', `Failed to update game: ${error.message}`);
        }
    };
    
    // Cancel edit function (exposed globally)
    window.cancelEdit = function() {
        document.getElementById('editGameForm').classList.add('hidden');
        document.getElementById('gameDisplay').classList.remove('hidden');
    };
    
    // Generate slug function
    async function generateSlug(title, gameId) {
        try {
            // Call Supabase function to generate slug
            const { data, error } = await rom.supabase.rpc('generate_game_slug', {
                title_param: title,
                existing_id_param: gameId
            });
            
            if (error) throw error;
            
            return data;
        } catch (error) {
            console.error('Error generating slug:', error);
            // Fallback to simple slug generation
            return title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .substring(0, 100);
        }
    }
    
    // Utility function to escape HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for module system
export default initGameDetail;

// REMOVE THE AUTO-INITIALIZE AT THE BOTTOM
// if (typeof window.rom !== 'undefined' && window.location.hash.includes('game')) {
//     console.log('Auto-initializing game detail module...');
//     const identifier = window.location.hash.split('/').pop();
//     initGameDetail(window.rom, identifier);
// }
