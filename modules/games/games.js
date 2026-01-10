// modules/games/games.js - WORKING VERSION WITH SEO IMPROVEMENTS
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
    
    // Load games - SIMPLE VERSION THAT WORKS
    async function loadGames() {
        showLoading(true);
        
        try {
            // Get all games - simple query that works with your schema
            const { data: games, error } = await rom.supabase
                .from('games')
                .select('*')
                .order('last_activity', { ascending: false });
            
            if (error) {
                throw error;
            }
            
            console.log(`✅ Loaded ${games?.length || 0} games`);
            
            // Display games
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
                .or(`title.ilike.%${query}%,description.ilike.%${query}%,console.ilike.%${query}%`)
                .order('title', { ascending: true });
            
            if (error) {
                throw error;
            }
            
            displayGames(games || []);
            
            // Update results count
            const resultsCount = document.getElementById('resultsCount');
            if (resultsCount) {
                resultsCount.textContent = `Found ${games?.length || 0} games`;
                resultsCount.classList.remove('hidden');
            }
            
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
            
            // Sort order
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
            }
            
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
        
        if (!gamesGrid) {
            console.error('❌ gamesGrid element not found!');
            return;
        }
        
        console.log(`📊 Displaying ${games.length} games`);
        
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
        
        // Clear the grid first
        gamesGrid.innerHTML = '';
        
        // Add game cards
        games.forEach(game => {
            const gameCard = createGameCard(game);
            gamesGrid.innerHTML += gameCard;
        });
        
        console.log(`✅ Added ${games.length} game cards to grid`);
        
        // Add click event listeners to cards
        document.querySelectorAll('.game-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't navigate if clicking on favorite button
                if (e.target.closest('.favorite-btn')) {
                    return;
                }
                
                const gameId = card.dataset.gameId;
                const gameSlug = card.dataset.gameSlug;
                
                console.log(`🎮 Clicked game: ${gameId}, slug: ${gameSlug}`);
                
                // Use slug URL if available, otherwise use ID
                if (gameSlug) {
                    rom.loadModule(`game/${gameSlug}`); // ← THIS MUST BE 'game' NOT 'game-detail'
                } else {
                    rom.loadModule(`game/${gameId}`);
                }
            });
        });
    }
    
    // Create game card HTML - WITH SEO URLS
    function createGameCard(game) {
        const rating = game.rating || 0;
        const views = game.views_count || 0;
        
        // Get platforms as array
        const platforms = game.console?.split(',').map(p => p.trim()) || [];
        
        // Create platform badges
        const platformBadges = platforms.map(platform => 
            `<span class="platform-badge">${platform}</span>`
        ).join('');
        
        // Determine game URL - use slug if available, otherwise use ID
        const gameUrl = game.slug ? `#/game/${game.slug}` : `#/game/${game.id}`;
        
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
                        <h3 class="text-xl font-bold text-cyan-300 truncate">${escapeHtml(game.title || 'Untitled')}</h3>
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
                    
                    <a href="${gameUrl}" class="block mt-2 text-center bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-4 rounded transition">
                        View Details
                    </a>
                </div>
            </div>
        `;
    }
    
    // Check if game is favorited
    function isFavorite(gameId) {
        const favorites = JSON.parse(localStorage.getItem('rom_favorites') || '[]');
        return favorites.includes(gameId);
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
            if (isFavorite(gameId)) {
                button.classList.add('text-red-400');
                button.classList.remove('text-gray-400');
            } else {
                button.classList.remove('text-red-400');
                button.classList.add('text-gray-400');
            }
        }
    };
    
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
