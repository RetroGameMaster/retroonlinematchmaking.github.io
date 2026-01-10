// modules/games/games.js - FIXED FOR YOUR SCHEMA
async function initGamesModule(rom) {
    console.log('🎮 Initializing games module...');
    
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
    
    // Initialize filters and search
    initFilters();
    initSearch();
    loadGames();
    
    // Initialize filters
    function initFilters() {
        const filterBtn = document.getElementById('filterBtn');
        const filterPanel = document.getElementById('filterPanel');
        const applyFiltersBtn = document.getElementById('applyFilters');
        const clearFiltersBtn = document.getElementById('clearFilters');
        
        if (filterBtn && filterPanel) {
            filterBtn.addEventListener('click', () => {
                filterPanel.classList.toggle('hidden');
            });
        }
        
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => {
                applyFilters();
                filterPanel.classList.add('hidden');
            });
        }
        
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                clearFilters();
                loadGames();
                filterPanel.classList.add('hidden');
            });
        }
    }
    
    // Initialize search
    function initSearch() {
        const searchInput = document.getElementById('gameSearch');
        const searchBtn = document.getElementById('searchBtn');
        
        const performSearch = () => {
            const query = searchInput.value.trim();
            if (query.length >= 2) {
                searchGames(query);
            } else if (query.length === 0) {
                loadGames();
            }
        };
        
        if (searchInput) {
            searchInput.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') {
                    performSearch();
                }
            });
        }
        
        if (searchBtn) {
            searchBtn.addEventListener('click', performSearch);
        }
    }
    
    // Load games - FIXED FOR YOUR SCHEMA
    async function loadGames() {
        showLoading(true);
        
        try {
            // Get all games using the correct column names from your schema
            const { data: games, error } = await rom.supabase
                .from('games')
                .select('*')
                .order('last_activity', { ascending: false });
            
            if (error) {
                throw error;
            }
            
            // Get additional data for each game
            const gamesWithDetails = await Promise.all(
                (games || []).map(async (game) => {
                    // Get average rating
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
                    
                    return {
                        ...game,
                        avg_rating: avgRating,
                        comment_count: commentCount || 0
                    };
                })
            );
            
            displayGames(gamesWithDetails);
            
        } catch (error) {
            console.error('Error loading games:', error);
            showMessage('error', `Failed to load games: ${error.message}`);
        } finally {
            showLoading(false);
        }
    }
    
    // Search games - FIXED FOR YOUR SCHEMA
    async function searchGames(query) {
        showLoading(true);
        
        try {
            const { data: games, error } = await rom.supabase
                .from('games')
                .select('*')
                .or(`title.ilike.%${query}%,description.ilike.%${query}%,console.ilike.%${query}%`)
                .order('title', { ascending: true });
            
            if (error) {
                throw error;
            }
            
            // Get additional data for each game
            const gamesWithDetails = await Promise.all(
                (games || []).map(async (game) => {
                    // Get average rating
                    const { data: ratings } = await rom.supabase
                        .from('game_ratings')
                        .select('rating')
                        .eq('game_id', game.id);
                    
                    // Get comment count
                    const { count: commentCount } = await rom.supabase
                        .from('game_comments')
                        .select('*', { count: 'exact', head: true })
                        .eq('game_id', game.id);
                    
                    // Calculate average rating
                    const avgRating = game.rating || (ratings && ratings.length > 0 
                        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
                        : 0);
                    
                    return {
                        ...game,
                        avg_rating: avgRating,
                        comment_count: commentCount || 0
                    };
                })
            );
            
            displayGames(gamesWithDetails);
            
            // Update results count
            const resultsCount = document.getElementById('resultsCount');
            if (resultsCount) {
                resultsCount.textContent = `Found ${gamesWithDetails.length} games`;
                resultsCount.classList.remove('hidden');
            }
            
        } catch (error) {
            console.error('Error searching games:', error);
            showMessage('error', `Search failed: ${error.message}`);
        } finally {
            showLoading(false);
        }
    }
    
    // Apply filters - FIXED FOR YOUR SCHEMA
    async function applyFilters() {
        showLoading(true);
        
        try {
            let query = rom.supabase
                .from('games')
                .select('*');
            
            // Platform filter
            const platformFilter = document.querySelector('input[name="platformFilter"]:checked');
            if (platformFilter && platformFilter.value !== 'all') {
                query = query.ilike('console', `%${platformFilter.value}%`);
            }
            
            // Year filter
            const yearFilter = document.querySelector('input[name="yearFilter"]:checked');
            if (yearFilter && yearFilter.value !== 'all') {
                const currentYear = new Date().getFullYear();
                let startYear, endYear;
                
                switch(yearFilter.value) {
                    case '2000s':
                        startYear = 2000; endYear = 2009;
                        break;
                    case '2010s':
                        startYear = 2010; endYear = 2019;
                        break;
                    case '2020s':
                        startYear = 2020; endYear = currentYear;
                        break;
                    case 'retro':
                        startYear = 1990; endYear = 1999;
                        break;
                }
                
                if (startYear && endYear) {
                    query = query.gte('year', startYear).lte('year', endYear);
                }
            }
            
            // Player count filter
            const playersFilter = document.querySelector('input[name="playersFilter"]:checked');
            if (playersFilter && playersFilter.value !== 'all') {
                switch(playersFilter.value) {
                    case '2-4':
                        query = query.gte('players_max', 2).lte('players_max', 4);
                        break;
                    case '5-8':
                        query = query.gte('players_max', 5).lte('players_max', 8);
                        break;
                    case '9+':
                        query = query.gte('players_max', 9);
                        break;
                }
            }
            
            // Sort order - FIXED FOR YOUR SCHEMA COLUMNS
            const sortOrder = document.getElementById('sortOrder').value;
            switch(sortOrder) {
                case 'newest':
                    query = query.order('approved_at', { ascending: false });
                    break;
                case 'oldest':
                    query = query.order('approved_at', { ascending: true });
                    break;
                case 'title_asc':
                    query = query.order('title', { ascending: true });
                    break;
                case 'title_desc':
                    query = query.order('title', { ascending: false });
                    break;
                case 'most_players':
                    query = query.order('players_max', { ascending: false });
                    break;
                case 'most_views':
                    query = query.order('views_count', { ascending: false });
                    break;
                case 'highest_rating':
                    query = query.order('rating', { ascending: false });
                    break;
            }
            
            const { data: games, error } = await query;
            
            if (error) {
                throw error;
            }
            
            // Get additional data for each game
            const gamesWithDetails = await Promise.all(
                (games || []).map(async (game) => {
                    // Get average rating
                    const { data: ratings } = await rom.supabase
                        .from('game_ratings')
                        .select('rating')
                        .eq('game_id', game.id);
                    
                    // Get comment count
                    const { count: commentCount } = await rom.supabase
                        .from('game_comments')
                        .select('*', { count: 'exact', head: true })
                        .eq('game_id', game.id);
                    
                    // Calculate average rating
                    const avgRating = game.rating || (ratings && ratings.length > 0 
                        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
                        : 0);
                    
                    return {
                        ...game,
                        avg_rating: avgRating,
                        comment_count: commentCount || 0
                    };
                })
            );
            
            displayGames(gamesWithDetails);
            
        } catch (error) {
            console.error('Error filtering games:', error);
            showMessage('error', `Filter failed: ${error.message}`);
        } finally {
            showLoading(false);
        }
    }
    
    // Clear filters
    function clearFilters() {
        // Reset all filter inputs
        document.querySelectorAll('input[name="platformFilter"]').forEach(radio => {
            if (radio.value === 'all') radio.checked = true;
        });
        
        document.querySelectorAll('input[name="yearFilter"]').forEach(radio => {
            if (radio.value === 'all') radio.checked = true;
        });
        
        document.querySelectorAll('input[name="playersFilter"]').forEach(radio => {
            if (radio.value === 'all') radio.checked = true;
        });
        
        document.getElementById('sortOrder').value = 'newest';
        
        // Clear search
        const searchInput = document.getElementById('gameSearch');
        if (searchInput) searchInput.value = '';
        
        const resultsCount = document.getElementById('resultsCount');
        if (resultsCount) resultsCount.classList.add('hidden');
    }
    
    // Display games in grid
    function displayGames(games) {
        const gamesGrid = document.getElementById('gamesGrid');
        const emptyState = document.getElementById('emptyState');
        
        if (!gamesGrid) return;
        
        if (games.length === 0) {
            gamesGrid.innerHTML = '';
            if (emptyState) {
                emptyState.classList.remove('hidden');
            }
            return;
        }
        
        if (emptyState) {
            emptyState.classList.add('hidden');
        }
        
        gamesGrid.innerHTML = games.map(game => createGameCard(game)).join('');
        
        // Add click event listeners to cards
        document.querySelectorAll('.game-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't navigate if clicking on favorite button
                if (e.target.closest('.favorite-btn') || e.target.closest('.rating-stars')) {
                    return;
                }
                
                const gameId = card.dataset.gameId;
                const gameSlug = card.dataset.gameSlug;
                
                // Use slug URL if available, otherwise use ID
                if (gameSlug) {
                    rom.loadModule(`game-detail/${gameSlug}`);
                } else {
                    rom.loadModule(`game-detail/${gameId}`);
                }
            });
        });
        
        // Initialize favorite buttons
        initFavoriteButtons(games);
    }
    
    // Create game card HTML - FIXED FOR YOUR SCHEMA
    function createGameCard(game) {
        const rating = game.avg_rating || 0;
        const commentCount = game.comment_count || 0;
        const views = game.views_count || 0;
        const downloads = game.downloads || 0;
        
        // Get platforms as array
        const platforms = game.console?.split(',').map(p => p.trim()) || [];
        
        // Create platform badges
        const platformBadges = platforms.map(platform => 
            `<span class="platform-badge">${platform}</span>`
        ).join('');
        
        // Determine game URL - use slug if available, otherwise use ID
        const gameUrl = game.slug ? `#/game-detail/${game.slug}` : `#/game-detail/${game.id}`;
        
        // Format date
        const approvedDate = game.approved_at ? new Date(game.approved_at).toLocaleDateString() : 'N/A';
        
        return `
            <div class="game-card bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-cyan-500 transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-cyan-500/20"
                 data-game-id="${game.id}"
                 data-game-slug="${game.slug || ''}">
                <div class="relative">
                    <div class="h-48 bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center">
                        ${game.cover_image_url ? 
                            `<img src="${game.cover_image_url}" alt="${escapeHtml(game.title)}" class="w-full h-full object-cover">` :
                            `<span class="text-6xl text-gray-600">🎮</span>`
                        }
                    </div>
                    <div class="absolute top-3 right-3">
                        <button class="favorite-btn p-2 bg-gray-900/80 backdrop-blur-sm rounded-full hover:bg-red-500/80 transition ${isFavorite(game.id) ? 'text-red-400' : 'text-gray-400'}"
                                data-game-id="${game.id}"
                                onclick="event.stopPropagation(); toggleFavorite('${game.id}')">
                            ♥
                        </button>
                    </div>
                </div>
                
                <div class="p-4">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="text-xl font-bold text-cyan-300 truncate">${escapeHtml(game.title)}</h3>
                        <span class="bg-cyan-900/50 text-cyan-300 text-sm px-2 py-1 rounded">
                            ${game.year || 'N/A'}
                        </span>
                    </div>
                    
                    <p class="text-gray-400 text-sm mb-3 line-clamp-2">
                        ${escapeHtml(game.description || 'No description available')}
                    </p>
                    
                    <div class="flex flex-wrap gap-1 mb-3">
                        ${platformBadges}
                    </div>
                    
                    <div class="flex items-center justify-between text-sm text-gray-400 mb-3">
                        <div class="flex items-center gap-1">
                            <span>👥 ${game.players_min || 1}-${game.players_max || 1}</span>
                        </div>
                        <div class="text-xs text-gray-500">
                            Added: ${approvedDate}
                        </div>
                    </div>
                    
                    <div class="flex items-center justify-between text-sm text-gray-400 mb-4">
                        <div class="flex items-center gap-4">
                            <div class="flex items-center gap-1">
                                <span class="text-yellow-400">★</span>
                                <span>${rating.toFixed(1)}</span>
                            </div>
                            <div class="flex items-center gap-1">
                                <span>💬</span>
                                <span>${commentCount}</span>
                            </div>
                            <div class="flex items-center gap-1">
                                <span>👁️</span>
                                <span>${views}</span>
                            </div>
                        </div>
                    </div>
                    
                    <a href="${gameUrl}" class="block mt-2 text-center bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-4 rounded transition">
                        View Details
                    </a>
                </div>
            </div>
        `;
    }
    
    // Initialize favorite buttons
    function initFavoriteButtons(games) {
        games.forEach(game => {
            const favoriteBtn = document.querySelector(`.favorite-btn[data-game-id="${game.id}"]`);
            if (favoriteBtn) {
                updateFavoriteButton(favoriteBtn, game.id);
            }
        });
    }
    
    // Check if game is favorited
    function isFavorite(gameId) {
        const favorites = JSON.parse(localStorage.getItem('rom_favorites') || '[]');
        return favorites.includes(gameId);
    }
    
    // Update favorite button state
    function updateFavoriteButton(button, gameId) {
        if (isFavorite(gameId)) {
            button.classList.add('text-red-400');
            button.classList.remove('text-gray-400');
        } else {
            button.classList.remove('text-red-400');
            button.classList.add('text-gray-400');
        }
    }
    
    // Toggle favorite
    window.toggleFavorite = async function(gameId) {
        const favorites = JSON.parse(localStorage.getItem('rom_favorites') || '[]');
        const index = favorites.indexOf(gameId);
        
        if (index === -1) {
            favorites.push(gameId);
            showMessage('success', 'Added to favorites');
        } else {
            favorites.splice(index, 1);
            showMessage('info', 'Removed from favorites');
        }
        
        localStorage.setItem('rom_favorites', JSON.stringify(favorites));
        
        // Update button
        const button = document.querySelector(`.favorite-btn[data-game-id="${gameId}"]`);
        if (button) {
            updateFavoriteButton(button, gameId);
        }
        
        // If user is logged in, sync with server
        if (rom.currentUser) {
            try {
                await syncFavoritesWithServer(gameId, index === -1);
            } catch (error) {
                console.error('Failed to sync favorite with server:', error);
            }
        }
    };
    
    // Sync favorites with server
    async function syncFavoritesWithServer(gameId, isFavorite) {
        if (!rom.currentUser) return;
        
        try {
            if (isFavorite) {
                const { error } = await rom.supabase
                    .from('user_favorites')
                    .upsert({
                        user1: rom.currentUser.email,
                        user2: gameId,
                        created_at: new Date().toISOString()
                    });
                
                if (error) throw error;
            } else {
                const { error } = await rom.supabase
                    .from('user_favorites')
                    .delete()
                    .eq('user1', rom.currentUser.email)
                    .eq('user2', gameId);
                
                if (error) throw error;
            }
        } catch (error) {
            console.error('Failed to sync favorite:', error);
            throw error;
        }
    }
    
    // Show loading state
    function showLoading(show) {
        const loadingDiv = document.getElementById('gamesLoading');
        const gamesGrid = document.getElementById('gamesGrid');
        
        if (loadingDiv) {
            loadingDiv.classList.toggle('hidden', !show);
        }
        
        if (gamesGrid && show) {
            gamesGrid.innerHTML = '';
        }
    }
    
    // Show message
    function showMessage(type, text) {
        // Create or get message container
        let messageContainer = document.getElementById('gamesMessage');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.id = 'gamesMessage';
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
    
    // Utility function to escape HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for module system
export default initGamesModule;

// Auto-initialize if loaded directly
if (typeof window.rom !== 'undefined') {
    console.log('Auto-initializing games module...');
    initGamesModule(window.rom);
}
