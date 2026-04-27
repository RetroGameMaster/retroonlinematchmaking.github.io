// modules/games/games.js - FIXED DOUBLE INITIALIZATION & ID MISMATCH
let isInitialized = false;

async function initGamesModule(rom) {
    console.log('🎮 Initializing games module...');
    
    // Prevent double initialization
    if (isInitialized) {
        console.log('⚠️ Games module already initialized, skipping...');
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
    
    // Wait a moment for HTML to be fully loaded
    setTimeout(() => {
        // Initialize filters and search
        initFilters();
        initSearch();
        loadGames();
    }, 100);
    
    // Initialize filters
    function initFilters() {
        const filterBtn = document.getElementById('filterBtn');
        const filterPanel = document.getElementById('filterPanel');
        const applyFiltersBtn = document.getElementById('applyFilters');
        const clearFiltersBtn = document.getElementById('clearFilters');
        const resetViewBtn = document.getElementById('resetViewBtn');
        
        console.log('Initializing filters...');
        console.log('filterBtn:', !!filterBtn);
        console.log('filterPanel:', !!filterPanel);
        
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
        
        if (resetViewBtn) {
            resetViewBtn.addEventListener('click', () => {
                clearFilters();
                loadGames();
            });
        }
    }
    
    // Initialize search
    function initSearch() {
        // FIX: Updated ID to match HTML (game-search instead of gameSearch)
        const searchInput = document.getElementById('game-search');
        const searchBtn = document.getElementById('searchBtn');
        
        console.log('Initializing search...');
        console.log('searchInput:', !!searchInput);
        console.log('searchBtn:', !!searchBtn);
        
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
            
            // Also listen for input to search as you type (optional)
            searchInput.addEventListener('input', () => {
                 if (searchInput.value.trim().length === 0) {
                    loadGames();
                 }
            });
        }
        
        if (searchBtn) {
            searchBtn.addEventListener('click', performSearch);
        }
    }
    
    // Load games
    async function loadGames() {
        console.log('🔄 Loading games...');
        showLoading(true);
        
        try {
            const { data: games, error } = await rom.supabase
                .from('games')
                .select('*')
                .eq('status', 'approved') // Only show approved games
                .order('created_at', { ascending: false });
            
            if (error) {
                throw error;
            }
            
            console.log(`✅ Loaded ${games?.length || 0} games`);
            
            if (games && games.length > 0) {
                console.log('📋 Sample game:', games[0].title);
            }
            
            displayGames(games || []);
            
        } catch (error) {
            console.error('Error loading games:', error);
            showMessage('error', `Failed to load games: ${error.message}`);
        } finally {
            showLoading(false);
        }
    }
    
    // Search games
    async function searchGames(query) {
        showLoading(true);
        
        try {
            const { data: games, error } = await rom.supabase
                .from('games')
                .select('*')
                .eq('status', 'approved')
                .or(`title.ilike.%${query}%,description.ilike.%${query}%,console.ilike.%${query}%`)
                .order('title', { ascending: true });
            
            if (error) {
                throw error;
            }
            
            displayGames(games || []);
            
        } catch (error) {
            console.error('Error searching games:', error);
            showMessage('error', `Search failed: ${error.message}`);
        } finally {
            showLoading(false);
        }
    }
    
    // Apply filters
    async function applyFilters() {
        showLoading(true);
        
        try {
            let query = rom.supabase
                .from('games')
                .select('*')
                .eq('status', 'approved');
            
            // Platform filter (Using the dropdown in HTML)
            const consoleFilter = document.getElementById('console-filter');
            if (consoleFilter && consoleFilter.value) {
                query = query.ilike('console', `%${consoleFilter.value}%`);
            }
            
            // Note: Year and Player filters removed as they don't exist in your current HTML
            // If you add them back to HTML later, you can re-enable this logic
            
            const { data: games, error } = await query;
            
            if (error) {
                throw error;
            }
            
            displayGames(games || []);
            
        } catch (error) {
            console.error('Error filtering games:', error);
            showMessage('error', `Filter failed: ${error.message}`);
        } finally {
            showLoading(false);
        }
    }
    
    // Clear filters
    function clearFilters() {
        // Reset console dropdown
        const consoleFilter = document.getElementById('console-filter');
        if (consoleFilter) consoleFilter.value = '';
        
        // Reset search
        const searchInput = document.getElementById('game-search');
        if (searchInput) searchInput.value = '';
        
        // Reload all games
        loadGames();
    }
    
    // Display games in grid
    function displayGames(games) {
        // FIX: Updated ID to match HTML (games-list instead of gamesGrid)
        const gamesList = document.getElementById('games-list');
        const emptyState = document.getElementById('emptyState');
        
        console.log('🖥️ Displaying games...');
        console.log('gamesList element:', !!gamesList);
        console.log('emptyState element:', !!emptyState);
        console.log(`Number of games: ${games.length}`);
        
        if (!gamesList) {
            console.error('❌ games-list element not found!');
            return;
        }
        
        if (games.length === 0) {
            gamesList.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-6xl mb-4 opacity-50">🕹️</div>
                    <h3 class="text-xl font-bold text-gray-300">No Games Found</h3>
                    <p class="text-gray-500 mt-2">Try adjusting your search or filters.</p>
                </div>
            `;
            if (emptyState) emptyState.classList.remove('hidden');
            console.log('📭 No games to display');
            return;
        }
        
        if (emptyState) emptyState.classList.add('hidden');
        
        // Create the grid container inside games-list
        let gamesGrid = document.getElementById('games-grid-container');
        if (!gamesGrid) {
            gamesList.innerHTML = '<div id="games-grid-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8"></div>';
            gamesGrid = document.getElementById('games-grid-container');
        }
        
        gamesGrid.innerHTML = '';
        
        games.forEach(game => {
            const gameCard = createGameCard(game);
            gamesGrid.innerHTML += gameCard;
        });
        
        console.log(`✅ Added ${games.length} game cards to grid`);
        
        // Add click event listeners
        setTimeout(() => {
            document.querySelectorAll('.game-card').forEach(card => {
                card.addEventListener('click', function(e) {
                    // Don't navigate if clicking on favorite button
                    if (e.target.closest('.favorite-btn') || e.target.classList.contains('favorite-btn')) {
                        return;
                    }
                    
                    const gameId = this.dataset.gameId;
                    const gameSlug = this.dataset.gameSlug;
                    
                    console.log(`🎮 Clicked game: ${gameId}, slug: ${gameSlug || 'none'}`);
                    
                    // Use slug URL if available, otherwise use ID
                    if (gameSlug) {
                        window.location.hash = `#/game/${gameSlug}`;
                    } else {
                        window.location.hash = `#/game/${gameId}`;
                    }
                });
            });
        }, 100);
    }
    
    // Create game card HTML
    function createGameCard(game) {
        const rating = game.rating || 0;
        const views = game.views_count || 0;
        
        // Get platforms as array
        const platforms = game.console?.split(',').map(p => p.trim()) || [];
        
        // Create platform badges
        const platformBadges = platforms.map(platform => 
            `<span class="inline-block bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded mr-1 mb-1">${platform}</span>`
        ).join('');
        
        // Determine game URL
        const gameUrl = game.slug ? `#/game/${game.slug}` : `#/game/${game.id}`;
        
        // Format date
        const approvedDate = game.approved_at ? new Date(game.approved_at).toLocaleDateString() : 'N/A';
        
        return `
            <div class="game-card bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-cyan-500 transition-all duration-300 cursor-pointer"
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
                        <button class="favorite-btn p-2 bg-gray-900/80 backdrop-blur-sm rounded-full hover:bg-red-500/80 transition"
                                data-game-id="${game.id}"
                                onclick="event.stopPropagation(); toggleFavorite('${game.id}')">
                            ♥
                        </button>
                    </div>
                </div>
                
                <div class="p-4">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="text-xl font-bold text-cyan-300 truncate">${escapeHtml(game.title || 'Untitled')}</h3>
                        <span class="bg-cyan-900/50 text-cyan-300 text-sm px-2 py-1 rounded">
                            ${game.year || 'N/A'}
                        </span>
                    </div>
                    
                    <p class="text-gray-400 text-sm mb-3 line-clamp-2">
                        ${escapeHtml(game.description || 'No description available')}
                    </p>
                    
                    <div class="mb-3">
                        ${platformBadges}
                    </div>
                    
                    <div class="flex items-center justify-between text-sm text-gray-400 mb-3">
                        <div class="flex items-center gap-1">
                            <span>👥 ${game.players_min || 1}-${game.players_max || 1}</span>
                        </div>
                        <div class="text-xs text-gray-500">
                            ${approvedDate}
                        </div>
                    </div>
                    
                    <div class="flex items-center justify-between text-sm text-gray-400 mb-4">
                        <div class="flex items-center gap-4">
                            <div class="flex items-center gap-1">
                                <span class="text-yellow-400">★</span>
                                <span>${rating.toFixed(1)}</span>
                            </div>
                            <div class="flex items-center gap-1">
                                <span>👁️</span>
                                <span>${views}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mt-2 text-center">
                        <button class="view-game-btn bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-4 rounded transition w-full"
                                data-game-id="${game.id}"
                                data-game-slug="${game.slug || ''}">
                            View Details
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Show loading state
    function showLoading(show) {
        const gamesList = document.getElementById('games-list');
        
        if (gamesList && show) {
            // Only show spinner if list is empty
            if (gamesList.innerHTML.trim() === '') {
                gamesList.innerHTML = `
                    <div class="text-center py-12">
                        <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
                        <p class="text-gray-400 mt-4">Loading game library...</p>
                    </div>
                `;
            }
        }
    }
    
    // Show message
    function showMessage(type, text) {
        console.log(`💬 ${type.toUpperCase()}: ${text}`);
        
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
    
    // Global function for favorite button (placeholder)
    window.toggleFavorite = function(gameId) {
        console.log('Toggle favorite for:', gameId);
        showMessage('info', 'Favorite feature coming soon!');
    };
}

// Export for module system
export default initGamesModule;
