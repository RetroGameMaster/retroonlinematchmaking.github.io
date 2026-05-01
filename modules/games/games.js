// modules/games/games.js
let isInitialized = false;

async function initGamesModule(rom) {
    console.log('🎮 Initializing games module...');
    
    const gamesList = document.getElementById('games-list');
    const hasGamesLoaded = gamesList && gamesList.querySelectorAll('.game-card').length > 0;

    if (isInitialized && hasGamesLoaded) {
        console.log('⚠️ Games module already initialized and populated, skipping...');
        return;
    }
    
    if (!hasGamesLoaded) {
        console.log('🔄 Games grid empty or missing, re-initializing...');
        isInitialized = true;
    } else {
        isInitialized = true;
    }
    
    if (!rom.supabase) {
        console.error('❌ No Supabase client in rom object');
        if (window.supabase) {
            rom.supabase = window.supabase;
        } else {
            showMessage('error', 'Database connection error');
            return;
        }
    }
    
    setTimeout(() => {
        initFilters();
        initSearch();
        loadGames();
    }, 100);
    
    function initFilters() {
        const filterBtn = document.getElementById('filterBtn');
        const filterPanel = document.getElementById('filterPanel');
        const applyFiltersBtn = document.getElementById('applyFilters');
        const clearFiltersBtn = document.getElementById('clearFilters');
        const resetViewBtn = document.getElementById('resetViewBtn');
        
        const consoleFilter = document.getElementById('console-filter');
        if (consoleFilter) {
            consoleFilter.addEventListener('change', () => {
                applyFilters();
            });
        }
        
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
    
    function initSearch() {
        const searchInput = document.getElementById('game-search');
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
                if (e.key === 'Enter') performSearch();
            });
            searchInput.addEventListener('input', () => {
                if (searchInput.value.trim().length === 0) loadGames();
            });
        }
        
        if (searchBtn) {
            searchBtn.addEventListener('click', performSearch);
        }
    }

    // --- NEW: Handle Hub Clicks (Developer, Publisher, etc) ---
    window.handleHubClick = function(type, value) {
        if (!value) return;
        
        console.log(`🔗 Hub Clicked: ${type} = ${value}`);
        
        // Clear existing filters
        const consoleFilter = document.getElementById('console-filter');
        if (consoleFilter) consoleFilter.value = '';
        
        const sortOrder = document.getElementById('sortOrder');
        if (sortOrder) sortOrder.value = 'title_asc'; // Default to A-Z for hubs
        
        const searchInput = document.getElementById('game-search');
        if (searchInput) searchInput.value = '';

        // Reuse applyFilters logic but inject our specific filter
        // We'll manually trigger a filtered load
        loadGamesByField(type, value);
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    async function loadGamesByField(field, value) {
        showLoading(true);
        try {
            let query = rom.supabase
                .from('games')
                .select('*')
                .eq('status', 'approved');

            // Dynamic filter based on field
            if (field === 'year') {
                query = query.eq('year', value);
            } else {
                // Use ilike for text fields (developer, publisher, genre) to handle case sensitivity
                query = query.ilike(field, `%${value}%`);
            }

            // Always sort A-Z for hubs
            query = query.order('title', { ascending: true });

            const { data: games, error } = await query;
            
            if (error) throw error;
            
            // Update UI to show what we are viewing
            const gamesList = document.getElementById('games-list');
            let header = document.getElementById('hub-header');
            if (!header) {
                header = document.createElement('div');
                header.id = 'hub-header';
                header.className = 'mb-6 text-center animate-fade-in';
                gamesList.insertBefore(header, gamesList.firstChild);
            }
            header.innerHTML = `
                <h2 class="text-2xl font-bold text-cyan-400">
                    📂 ${value} <span class="text-gray-500 text-lg">(${games.length} games)</span>
                </h2>
                <button onclick="document.getElementById('hub-header').remove(); loadGames();" class="mt-2 text-sm text-gray-400 hover:text-white underline">Clear Filter</button>
            `;

            displayGames(games || []);
        } catch (error) {
            console.error('Error loading hub:', error);
            showMessage('error', `Failed to load: ${error.message}`);
        } finally {
            showLoading(false);
        }
    }
    
    async function loadGames() {
        console.log('🔄 Loading games...');
        
        // Remove hub header if going back to main list
        const header = document.getElementById('hub-header');
        if (header) header.remove();

        showLoading(true);
        
        try {
            const { data: games, error } = await rom.supabase
                .from('games')
                .select('*')
                .eq('status', 'approved')
                .order('title', { ascending: true }); // ✅ FORCE A-Z ORDER
            
            if (error) throw error;
            
            console.log(`✅ Loaded ${games?.length || 0} games (Sorted A-Z)`);
            displayGames(games || []);
            
        } catch (error) {
            console.error('Error loading games:', error);
            showMessage('error', `Failed to load games: ${error.message}`);
        } finally {
            showLoading(false);
        }
    }
    
    async function searchGames(query) {
        showLoading(true);
        const header = document.getElementById('hub-header');
        if (header) header.remove();

        try {
            const { data: games, error } = await rom.supabase
                .from('games')
                .select('*')
                .eq('status', 'approved')
                .or(`title.ilike.%${query}%,description.ilike.%${query}%,console.ilike.%${query}%`)
                .order('title', { ascending: true });
            
            if (error) throw error;
            displayGames(games || []);
        } catch (error) {
            console.error('Error searching games:', error);
            showMessage('error', `Search failed: ${error.message}`);
        } finally {
            showLoading(false);
        }
    }
    
    async function applyFilters() {
        showLoading(true);
        const header = document.getElementById('hub-header');
        if (header) header.remove();

        try {
            let query = rom.supabase
                .from('games')
                .select('*')
                .eq('status', 'approved');
            
            const consoleFilter = document.getElementById('console-filter');
            if (consoleFilter && consoleFilter.value) {
                const selectedConsole = consoleFilter.value.trim();
                query = query.ilike('console', `%${selectedConsole}%`);
            }
            
            const sortOrder = document.getElementById('sortOrder');
            if (sortOrder) {
                switch(sortOrder.value) {
                    case 'newest': query = query.order('approved_at', { ascending: false }); break;
                    case 'oldest': query = query.order('approved_at', { ascending: true }); break;
                    case 'title_asc': query = query.order('title', { ascending: true }); break;
                    case 'title_desc': query = query.order('title', { ascending: false }); break;
                    case 'most_players': query = query.order('players_max', { ascending: false }); break;
                    default: query = query.order('title', { ascending: true }); // Default to A-Z
                }
            } else {
                query = query.order('title', { ascending: true }); // Ensure A-Z if no sort selected
            }
            
            const { data: games, error } = await query;
            if (error) throw error;
            
            console.log(`✅ Filter result: ${games.length} games found`);
            displayGames(games || []);
            
        } catch (error) {
            console.error('Error filtering games:', error);
            showMessage('error', `Filter failed: ${error.message}`);
        } finally {
            showLoading(false);
        }
    }
    
    function clearFilters() {
        const consoleFilter = document.getElementById('console-filter');
        if (consoleFilter) consoleFilter.value = '';
        
        const sortOrder = document.getElementById('sortOrder');
        if (sortOrder) sortOrder.value = 'title_asc';
        
        const searchInput = document.getElementById('game-search');
        if (searchInput) searchInput.value = '';
        
        const header = document.getElementById('hub-header');
        if (header) header.remove();
        
        loadGames();
    }
    
    function displayGames(games) {
        const gamesList = document.getElementById('games-list');
        if (!gamesList) return;
        
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
        
        setTimeout(() => {
            document.querySelectorAll('.game-card').forEach(card => {
                card.addEventListener('click', function(e) {
                    if (e.target.closest('.favorite-btn') || e.target.classList.contains('favorite-btn') || 
                        e.target.closest('.hub-tag')) {
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
    
    function createGameCard(game) {
        const rating = game.rating || 0;
        const views = game.views_count || 0;
        const platforms = game.console?.split(',').map(p => p.trim()) || [];
        
        const platformBadges = platforms.map(platform => 
            `<span class="inline-block bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded mr-1 mb-1">${platform}</span>`
        ).join('');
        
        const approvedDate = game.approved_at ? new Date(game.approved_at).toLocaleDateString() : 'N/A';
        
        // Helper for Hub Tags
        const createHubTag = (type, value, icon) => {
            if (!value) return '';
            return `<button onclick="event.stopPropagation(); window.handleHubClick('${type}', '${escapeHtml(value)}')" 
                         class="hub-tag inline-flex items-center gap-1 bg-gray-700 hover:bg-cyan-700 text-gray-300 hover:text-white text-xs px-2 py-1 rounded transition mr-2 mb-2 border border-gray-600 hover:border-cyan-500">
                         <span>${icon}</span> ${escapeHtml(value)}
                    </button>`;
        };

        return `
            <div class="game-card bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-cyan-500 transition-all duration-300 cursor-pointer flex flex-col"
                 data-game-id="${game.id}"
                 data-game-slug="${game.slug || ''}">
                <div class="relative shrink-0">
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
                
                <div class="p-4 flex flex-col flex-grow">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="text-xl font-bold text-cyan-300 truncate flex-grow">${escapeHtml(game.title || 'Untitled')}</h3>
                        <button onclick="event.stopPropagation(); window.handleHubClick('year', '${game.year || 'Unknown'}')" 
                                class="hub-tag ml-2 bg-gray-700 hover:bg-cyan-700 text-gray-300 hover:text-white text-xs px-2 py-1 rounded transition border border-gray-600 shrink-0">
                            ${game.year || 'N/A'}
                        </button>
                    </div>
                    
                    <p class="text-gray-400 text-sm mb-3 line-clamp-2 flex-grow">
                        ${escapeHtml(game.description || 'No description available')}
                    </p>
                    
                    <div class="mb-3">
                        ${platformBadges}
                    </div>
                    
                    <!-- NEW: Info Hubs -->
                    <div class="mt-auto pt-3 border-t border-gray-700">
                        <div class="flex flex-wrap gap-1">
                            ${createHubTag('developer', game.developer, '🛠️')}
                            ${createHubTag('publisher', game.publisher, '🏢')}
                            ${createHubTag('genre', game.genre, '🏷️')}
                        </div>
                    </div>

                    <div class="flex items-center justify-between text-sm text-gray-400 mt-3 mb-2">
                        <div class="flex items-center gap-1">
                            <span>👥 ${game.players_min || 1}-${game.players_max || 1}</span>
                        </div>
                        <div class="flex items-center gap-3">
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
                </div>
            </div>
        `;
    }
    
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
        const bgColor = type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-green-600' : 'bg-blue-600';
        
        messageContainer.innerHTML += `
            <div id="${messageId}" class="${bgColor} text-white p-4 rounded-lg shadow-lg mb-2 animate-fade-in">
                <div class="flex justify-between items-center">
                    <span>${text}</span>
                    <button onclick="document.getElementById('${messageId}').remove()" class="ml-4 text-white hover:text-gray-200">✕</button>
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
        // Escape single quotes for onclick handlers
        return text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }
}

export default initGamesModule;
