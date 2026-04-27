// modules/games/games.js - FIXED RE-INITIALIZATION & CONSOLE FILTER
let isInitialized = false;

async function initGamesModule(rom) {
    console.log('🎮 Initializing games module...');
    
    // FIX: Check if the DOM element actually exists and has content.
    // If the grid is missing (because we navigated away and back), we MUST re-initialize.
    const gamesList = document.getElementById('games-list');
    const hasGamesLoaded = gamesList && gamesList.querySelectorAll('.game-card').length > 0;

    if (isInitialized && hasGamesLoaded) {
        console.log('⚠️ Games module already initialized and populated, skipping...');
        return;
    }
    
    // Reset flag if DOM was cleared, allowing re-initialization
    if (!hasGamesLoaded) {
        console.log('🔄 Games grid empty or missing, re-initializing...');
        isInitialized = true; // Set to true immediately to prevent double calls during this load
    } else {
        isInitialized = true;
    }
    
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
        
        // --- FIX: Add Console Dropdown Listener ---
        const consoleFilter = document.getElementById('console-filter');
        if (consoleFilter) {
            consoleFilter.addEventListener('change', () => {
                applyFilters(); // Auto-apply when selection changes
            });
        }
        // ----------------------------------------
        
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
            // Also search on input change for instant results
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
                .eq('status', 'approved')
                .order('approved_at', { ascending: false });
            
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
            
            // Console filter
            const consoleFilter = document.getElementById('console-filter');
            if (consoleFilter && consoleFilter.value) {
                const selectedConsole = consoleFilter.value.trim();
                
                console.log(`🔍 Filtering by console: "${selectedConsole}"`);

                query = query.ilike('console', `%${selectedConsole}%`);
            }
            
            // Sort order
            const sortOrder = document.getElementById('sortOrder');
            if (sortOrder) {
                switch(sortOrder.value) {
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
                    default:
                        query = query.order('approved_at', { ascending: false });
                }
            }
            
            const { data: games, error } = await query;
            
            if (error) {
                throw error;
            }
            
            console.log(`✅ Filter result: ${games.length} games found`);
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
        const consoleFilter = document.getElementById('console-filter');
        if (consoleFilter) consoleFilter.value = '';
        
        const sortOrder = document.getElementById('sortOrder');
        if (sortOrder) sortOrder.value = 'newest';
        
        const searchInput = document.getElementById('game-search');
        if (searchInput) searchInput.value = '';
        
        loadGames();
    }
    
    // Display games in grid
    function displayGames(games) {
        const gamesList = document.getElementById('games-list');
        const emptyState = document.getElementById('emptyState');
        
        console.log('🖥️ Displaying games...');
        console.log('games-list element:', !!gamesList);
        
        if (!gamesList) {
            console.error('❌ games-list element not found!');
            showMessage('error', 'Container not found');
            showLoading(false);
            return;
        }
        
        if (games.length === 0) {
            gamesList.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-6xl mb-4">🕹️</div>
                    <h3 class="text-xl font-bold text-gray-300">No Games Found</h3>
                    <p class="text-gray-500 mt-2">Try adjusting your search or filters.</p>
                </div>
            `;
            showLoading(false);
            return;
        }
        
        // Create Grid Container inside games-list
        let gamesGrid = document.getElementById('gamesGrid');
        if (!gamesGrid) {
            gamesList.innerHTML = '<div id="gamesGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8"></div>';
            gamesGrid = document.getElementById('gamesGrid');
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
                    if (e.target.closest('.favorite-btn') || e.target.classList.contains('favorite-btn')) {
                        return;
                    }
                    
                    const gameId = this.dataset.gameId;
                    const gameSlug = this.dataset.gameSlug;
                    
                    if (gameSlug) {
                        window.location.hash = `#/game/${gameSlug}`;
                    } else {
                        window.location.hash = `#/game/${gameId}`;
                    }
                });
            });
        }, 100);
        
        showLoading(false);
    }
    
    // Create game card HTML
    function createGameCard(game) {
        const rating = game.rating || 0;
        const views = game.views_count || 0;
        const platforms = game.console?.split(',').map(p => p.trim()) || [];
        
        const platformBadges = platforms.map(platform => 
            `<span class="inline-block bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded mr-1 mb-1">${platform}</span>`
        ).join('');
        
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
        if (!gamesList) return;
        
        let loader = document.getElementById('gamesLoading');
        
        if (show) {
            if (!loader) {
                loader = document.createElement('div');
                loader.id = 'gamesLoading';
                loader.className = 'text-center py-12';
                loader.innerHTML = `
                    <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
                    <p class="text-gray-400 mt-4">Loading game library...</p>
                `;
                gamesList.appendChild(loader);
            }
            loader.style.display = 'block';
        } else {
            if (loader) loader.style.display = 'none';
        }
    }
    
    // Show message
    function showMessage(type, text) {
        console.log(`💬 ${type.toUpperCase()}: ${text}`);
        
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
        
        setTimeout(() => {
            const msg = document.getElementById(messageId);
            if (msg) msg.remove();
        }, 5000);
    }
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export default initGamesModule;
