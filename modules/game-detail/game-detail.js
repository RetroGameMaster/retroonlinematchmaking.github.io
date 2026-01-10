// modules/game-detail/game-detail.js - FIXED FOR YOUR SCHEMA
async function initGameDetail(rom, identifier) {
    console.log('🎮 Initializing game detail module for identifier:', identifier);
    
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
    
    // Initialize edit button (if admin)
    initEditButton(game);
    
    // Load game by identifier (slug or ID)
    async function loadGameByIdentifier(identifier) {
        console.log('Loading game with identifier:', identifier);
        
        try {
            // First get the game
            let query = rom.supabase
                .from('games')
                .select('*');
            
            // Check if identifier is a UUID (ID) or a slug
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
            
            if (isUuid) {
                query = query.eq('id', identifier);
            } else {
                query = query.eq('slug', identifier);
            }
            
            const { data: game, error } = await query.single();
            
            if (error) {
                console.error('Error loading game:', error);
                return null;
            }
            
            // Get average rating from game_ratings table
            const { data: ratings } = await rom.supabase
                .from('game_ratings')
                .select('rating')
                .eq('game_id', game.id);
            
            // Get comment count
            const { count: commentCount } = await rom.supabase
                .from('game_comments')
                .select('*', { count: 'exact', head: true })
                .eq('game_id', game.id);
            
            // Calculate average rating (use existing rating column if available)
            const avgRating = game.rating || (ratings && ratings.length > 0 
                ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
                : 0);
            
            // Check if user has favorited this game
            let isFavorited = false;
            if (rom.currentUser) {
                const { data: favorite } = await rom.supabase
                    .from('user_favorites')
                    .select('id')
                    .eq('user1', rom.currentUser.email)
                    .eq('user2', game.id)
                    .single()
                    .catch(() => ({ data: null }));
                
                isFavorited = !!favorite;
            }
            
            console.log('Game loaded successfully:', game.title);
            return {
                ...game,
                avg_rating: avgRating,
                rating_count: ratings?.length || 0,
                comment_count: commentCount || 0,
                is_favorited: isFavorited
            };
            
        } catch (error) {
            console.error('Error in loadGameByIdentifier:', error);
            return null;
        }
    }
    
    // Display game data - FIXED FOR YOUR SCHEMA
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
                `<span class="platform-badge">${platform}</span>`
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
                `<span class="method-badge">${method}</span>`
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
                <span class="text-2xl font-bold ml-2">${game.avg_rating.toFixed(1)}</span>
                <span class="text-gray-400 ml-2">(${game.rating_count} ratings)</span>
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
                    <div class="stat-item">
                        <span class="text-gray-400">Submitted by:</span>
                        <span class="text-cyan-300 ml-2">${game.submitted_by || 'Unknown'}</span>
                    </div>
                </div>
            `;
        }
        
        // Update comments count
        const commentsElement = document.getElementById('gameCommentsCount');
        if (commentsElement) {
            commentsElement.textContent = `${game.comment_count} comments`;
        }
        
        // Update favorite button
        const favoriteBtn = document.getElementById('favoriteBtn');
        if (favoriteBtn) {
            favoriteBtn.innerHTML = game.is_favorited ? 
                '♥ Remove from Favorites' : 
                '♡ Add to Favorites';
            favoriteBtn.dataset.favorited = game.is_favorited;
            
            favoriteBtn.onclick = () => toggleFavorite(game.id, favoriteBtn);
        }
        
        // Update edit button visibility
        const editBtn = document.getElementById('editGameBtn');
        if (editBtn) {
            editBtn.dataset.gameId = game.id;
            editBtn.dataset.gameSlug = game.slug || '';
        }
        
        // Display cover image if available
        const coverImageElement = document.getElementById('gameCoverImage');
        if (coverImageElement && game.cover_image_url) {
            coverImageElement.innerHTML = `
                <img src="${game.cover_image_url}" alt="${escapeHtml(game.title)}" 
                     class="w-full h-64 object-cover rounded-lg">
            `;
        }
        
        // Display screenshots if available
        const screenshotsElement = document.getElementById('gameScreenshots');
        if (screenshotsElement && game.screenshot_urls && game.screenshot_urls.length > 0) {
            screenshotsElement.innerHTML = `
                <h3 class="text-xl font-bold text-cyan-300 mb-4">Screenshots</h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    ${game.screenshot_urls.map(url => `
                        <img src="${url}" alt="Screenshot" class="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-80">
                    `).join('')}
                </div>
            `;
        }
        
        // Update URL if we're using ID but have slug
        if (game.slug && !identifier.includes(game.slug)) {
            updateUrlToSlug(game.slug);
        }
    }
    
    // Update URL to use slug (for SEO)
    function updateUrlToSlug(slug) {
        const currentHash = window.location.hash;
        if (!currentHash.includes(`/${slug}`)) {
            const newHash = `#/game-detail/${slug}`;
            window.history.replaceState(null, '', newHash);
            console.log('Updated URL to slug:', newHash);
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
                .select(`
                    *,
                    user:profiles(username, avatar_url)
                `)
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
        const user = comment.user;
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
                            ${user?.avatar_url ? 
                                `<img src="${user.avatar_url}" class="w-10 h-10 rounded-full" alt="${user.username}">` :
                                `<span class="text-gray-400">👤</span>`
                            }
                        </div>
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between items-center">
                            <div>
                                <span class="font-bold text-cyan-300">${user?.username || comment.username || 'Anonymous'}</span>
                                <span class="text-gray-500 text-sm ml-2">${date}</span>
                            </div>
                            ${comment.user_id === rom.currentUser?.id ? `
                                <button onclick="deleteComment('${comment.id}')" 
                                        class="text-red-400 hover:text-red-300 text-sm">
                                    Delete
                                </button>
                            ` : ''}
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
            
            if (content.length > 1000) {
                showMessage('error', 'Comment must be less than 1000 characters');
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
                        username: rom.currentUser.email, // You might want to get the actual username
                        comment: content,
                        created_at: new Date().toISOString()
                    });
                
                if (error) throw error;
                
                showMessage('success', 'Comment added successfully');
                commentInput.value = '';
                
                // Reload comments
                loadComments(gameId);
                
                // Update comment count
                const game = await loadGameByIdentifier(identifier);
                if (game) {
                    const commentsElement = document.getElementById('gameCommentsCount');
                    if (commentsElement) {
                        commentsElement.textContent = `${game.comment_count} comments`;
                    }
                }
                
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
            loadUserRating(gameId);
        } else {
            ratingStars.classList.add('hidden');
        }
        
        // Star click events
        const stars = ratingStars.querySelectorAll('.star');
        stars.forEach((star, index) => {
            star.onclick = () => submitRating(gameId, index + 1);
            star.onmouseover = () => highlightStars(index + 1);
            star.onmouseout = resetStars;
        });
        
        ratingStars.onmouseout = resetStars;
    }
    
    // Load user's existing rating
    async function loadUserRating(gameId) {
        if (!rom.currentUser) return;
        
        try {
            const { data, error } = await rom.supabase
                .from('game_ratings')
                .select('rating')
                .eq('game_id', gameId)
                .eq('user_id', rom.currentUser.id)
                .single();
            
            if (!error && data) {
                highlightStars(data.rating);
            }
        } catch (error) {
            // No existing rating is fine
        }
    }
    
    // Highlight stars
    function highlightStars(rating) {
        const stars = document.querySelectorAll('.star');
        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.add('text-yellow-400');
                star.classList.remove('text-gray-400');
            } else {
                star.classList.remove('text-yellow-400');
                star.classList.add('text-gray-400');
            }
        });
    }
    
    // Reset stars to current rating
    function resetStars() {
        // This would reset to the user's current rating
        // For simplicity, we'll just remove all highlights
        // In a real implementation, you'd want to track the current rating
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
            highlightStars(rating);
            
            // Reload game to update average rating
            const game = await loadGameByIdentifier(identifier);
            if (game) {
                const ratingElement = document.getElementById('gameRating');
                if (ratingElement) {
                    ratingElement.innerHTML = `
                        <span class="text-yellow-400 text-xl">★</span>
                        <span class="text-2xl font-bold ml-2">${game.avg_rating.toFixed(1)}</span>
                        <span class="text-gray-400 ml-2">(${game.rating_count} ratings)</span>
                    `;
                }
            }
            
        } catch (error) {
            console.error('Error submitting rating:', error);
            showMessage('error', `Failed to submit rating: ${error.message}`);
        }
    }
    
    // Initialize edit button - FIXED FOR YOUR SCHEMA
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
    
    // Edit game function - FIXED FOR YOUR SCHEMA
    async function editGame(game) {
        console.log('Editing game:', game.title);
        
        // Show edit form
        const editForm = document.getElementById('editGameForm');
        const gameDisplay = document.getElementById('gameDisplay');
        
        if (editForm && gameDisplay) {
            // Populate form with correct column names
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
    
    // Toggle favorite - FIXED FOR YOUR SCHEMA
    async function toggleFavorite(gameId, button) {
        if (!rom.currentUser) {
            showMessage('error', 'Please log in to save favorites');
            rom.loadModule('auth');
            return;
        }
        
        const isFavorited = button.dataset.favorited === 'true';
        
        try {
            if (isFavorited) {
                // Remove favorite - using user_favorites table
                const { error } = await rom.supabase
                    .from('user_favorites')
                    .delete()
                    .eq('user1', rom.currentUser.email)
                    .eq('user2', gameId);
                
                if (error) throw error;
                
                button.innerHTML = '♡ Add to Favorites';
                button.dataset.favorited = 'false';
                showMessage('info', 'Removed from favorites');
                
            } else {
                // Add favorite - using user_favorites table
                const { error } = await rom.supabase
                    .from('user_favorites')
                    .upsert({
                        user1: rom.currentUser.email,
                        user2: gameId,
                        created_at: new Date().toISOString()
                    });
                
                if (error) throw error;
                
                button.innerHTML = '♥ Remove from Favorites';
                button.dataset.favorited = 'true';
                showMessage('success', 'Added to favorites');
            }
            
        } catch (error) {
            console.error('Error toggling favorite:', error);
            showMessage('error', `Failed to update favorites: ${error.message}`);
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
    
    // Delete comment function (exposed globally)
    window.deleteComment = async function(commentId) {
        if (!confirm('Are you sure you want to delete this comment?')) return;
        
        try {
            const { error } = await rom.supabase
                .from('game_comments')
                .delete()
                .eq('id', commentId);
            
            if (error) throw error;
            
            showMessage('success', 'Comment deleted');
            
            // Reload comments
            const gameId = document.getElementById('gameDetail').dataset.gameId;
            loadComments(gameId);
            
        } catch (error) {
            console.error('Error deleting comment:', error);
            showMessage('error', `Failed to delete comment: ${error.message}`);
        }
    };
    
    // Save edit function (exposed globally) - FIXED FOR YOUR SCHEMA
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

// Auto-initialize if loaded directly
if (typeof window.rom !== 'undefined' && window.location.hash.includes('game')) {
    console.log('Auto-initializing game detail module...');
    const identifier = window.location.hash.split('/').pop();
    initGameDetail(window.rom, identifier);
}
