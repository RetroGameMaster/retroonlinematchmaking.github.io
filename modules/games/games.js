// modules/games/games.js
let isInitialized = false;

async function initGamesModule(rom) {
    console.log('🎮 Initializing games module...');
    const pageSize = 36;
    let activeQueryFactory;
    let loadedGameCount = 0;
    let totalGameCount = null;
    let gameRequestId = 0;
    let isLoadingMore = false;
    let activeLetter = '';
    const consoleSections = new Map();
    
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
        initLetterFilter();
        const letterFilter = document.getElementById('game-letter-filter');
        if (letterFilter) {
            letterFilter.addEventListener('click', event => {
                const button = event.target.closest('[data-game-letter]');
                if (!button) return;
                activeLetter = button.dataset.gameLetter || '';
                const searchInput = document.getElementById('game-search');
                if (searchInput) searchInput.value = '';
                initLetterFilter();
                applyFilters();
            });
        }
        loadConsoleOptions();
        
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

        const loadMoreButton = document.getElementById('load-more-games');
        if (loadMoreButton) {
            loadMoreButton.addEventListener('click', () => loadPagedGames(activeQueryFactory, true));
        }

        if (gamesList) {
            gamesList.addEventListener('click', (event) => {
                const card = event.target.closest('.game-card');
                if (!card || event.target.closest('.favorite-btn, .hub-tag')) return;

                const gameId = card.dataset.gameId;
                const gameSlug = card.dataset.gameSlug;
                window.location.hash = `#/game/${gameSlug || gameId}`;
            });
        }
    }

    function initLetterFilter() {
        const letterFilter = document.getElementById('game-letter-filter');
        if (!letterFilter) return;

        const letters = ['All', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
        letterFilter.innerHTML = letters.map(letter => {
            const value = letter === 'All' ? '' : letter;
            const selected = value === activeLetter;
            return `<button type="button" data-game-letter="${value}"
                aria-pressed="${selected}"
                class="min-w-8 px-2 py-1 rounded text-sm font-semibold transition ${selected
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'}">${letter}</button>`;
        }).join('');
    }

    async function loadConsoleOptions() {
        const consoleFilter = document.getElementById('console-filter');
        if (!consoleFilter) return;

        try {
            const consoles = new Set(
                [...consoleFilter.options].map(option => option.value.trim()).filter(Boolean)
            );
            const batchSize = 500;
            for (let offset = 0; ; offset += batchSize) {
                const { data, error } = await rom.supabase
                    .from('games')
                    .select('id, console')
                    .eq('status', 'approved')
                    .order('console', { ascending: true })
                    .order('id', { ascending: true })
                    .range(offset, offset + batchSize - 1);
                if (error) throw error;
                for (const game of data || []) {
                    if (game.console?.trim()) consoles.add(game.console.trim());
                }
                if (!data || data.length < batchSize) break;
                if (offset >= 50000) throw new Error('Console list exceeded the safety limit.');
            }

            const selectedConsole = consoleFilter.value;
            consoleFilter.replaceChildren(new Option('All consoles', ''));
            [...consoles].sort((a, b) => a.localeCompare(b)).forEach(consoleName => {
                consoleFilter.add(new Option(consoleName, consoleName));
            });
            consoleFilter.value = [...consoles].includes(selectedConsole) ? selectedConsole : '';
        } catch (error) {
            console.error('Failed to load console filters:', error);
            showMessage('error', 'Console filters could not be loaded. The game library is still available.');
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
        if (!value || value === 'Unknown' || value === 'N/A') return;
        
        console.log(`🔗 Hub Clicked: ${type} = ${value}`);
        
        // Clear existing filters
        const consoleFilter = document.getElementById('console-filter');
        if (consoleFilter) consoleFilter.value = '';
        
        const sortOrder = document.getElementById('sortOrder');
        if (sortOrder) sortOrder.value = 'title_asc'; // Default to A-Z for hubs
        
        const searchInput = document.getElementById('game-search');
        if (searchInput) searchInput.value = '';

        // Reuse applyFilters logic but inject our specific filter
        loadGamesByField(type, value);
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    async function loadGamesByField(field, value) {
        activeLetter = '';
        initLetterFilter();
        const header = document.getElementById('hub-header') || document.createElement('div');
        header.id = 'hub-header';
        header.className = 'mb-6 text-center animate-fade-in';
        header.innerHTML = `<h2 class="text-2xl font-bold text-cyan-400">📂 ${escapeHtml(value)}</h2>
            <button id="clear-hub-filter" class="mt-2 text-sm text-gray-400 hover:text-white underline">Clear Filter</button>`;
        const gamesList = document.getElementById('games-list');
        if (!header.parentElement && gamesList) gamesList.prepend(header);
        header.querySelector('#clear-hub-filter').addEventListener('click', loadGames);

        await loadPagedGames((withCount) => {
            let query = rom.supabase.from('games').select('*', withCount ? { count: 'exact' } : undefined)
                .eq('status', 'approved');
            query = field === 'year' ? query.eq('year', value) : query.ilike(field, `%${value}%`);
            return query.order('console', { ascending: true }).order('title', { ascending: true }).order('id', { ascending: true });
        });
    }
    
    async function loadGames() {
        console.log('🔄 Loading games...');
        
        // Remove hub header if going back to main list
        const header = document.getElementById('hub-header');
        if (header) header.remove();

        await loadPagedGames((withCount) => {
            let query = rom.supabase
                .from('games')
                .select('*', withCount ? { count: 'exact' } : undefined)
                .eq('status', 'approved');
            query = addLibraryFilters(query);
            return query.order('console', { ascending: true })
                .order('title', { ascending: true })
                .order('id', { ascending: true });
        });
    }

    function addLibraryFilters(query) {
        const consoleFilter = document.getElementById('console-filter');
        if (consoleFilter?.value) {
            query = query.eq('console', consoleFilter.value.trim());
        }
        if (activeLetter) query = query.ilike('title', `${activeLetter}%`);
        return query;
    }
    
    async function searchGames(query) {
        activeLetter = '';
        initLetterFilter();
        const header = document.getElementById('hub-header');
        if (header) header.remove();

        await loadPagedGames((withCount) => rom.supabase
                .from('games')
                .select('*', withCount ? { count: 'exact' } : undefined)
                .eq('status', 'approved')
                .or(`title.ilike.%${query}%,description.ilike.%${query}%,console.ilike.%${query}%`)
                .order('console', { ascending: true })
                .order('title', { ascending: true })
                .order('id', { ascending: true }));
    }
    
    async function applyFilters() {
        const header = document.getElementById('hub-header');
        if (header) header.remove();

        await loadPagedGames((withCount) => {
            let query = rom.supabase
                .from('games')
                .select('*', withCount ? { count: 'exact' } : undefined)
                .eq('status', 'approved');
            query = addLibraryFilters(query);
            
            const sortOrder = document.getElementById('sortOrder');
            if (sortOrder) {
                switch(sortOrder.value) {
                    case 'newest': query = query.order('console', { ascending: true }).order('approved_at', { ascending: false }).order('title', { ascending: true }); break;
                    case 'oldest': query = query.order('console', { ascending: true }).order('approved_at', { ascending: true }).order('title', { ascending: true }); break;
                    case 'title_desc': query = query.order('console', { ascending: true }).order('title', { ascending: false }); break;
                    case 'most_players': query = query.order('console', { ascending: true }).order('players_max', { ascending: false }).order('title', { ascending: true }); break;
                    default: query = query.order('console', { ascending: true }).order('title', { ascending: true });
                }
            } else {
                query = query.order('console', { ascending: true }).order('title', { ascending: true });
            }
            return query.order('id', { ascending: true });
        });
    }
    
    function clearFilters() {
        const consoleFilter = document.getElementById('console-filter');
        if (consoleFilter) consoleFilter.value = '';
        
        const sortOrder = document.getElementById('sortOrder');
        if (sortOrder) sortOrder.value = 'title_asc';
        
        const searchInput = document.getElementById('game-search');
        if (searchInput) searchInput.value = '';
        activeLetter = '';
        initLetterFilter();
        
        const header = document.getElementById('hub-header');
        if (header) header.remove();
        
    }
    
    async function loadPagedGames(queryFactory, append = false) {
        if (!queryFactory || (append && isLoadingMore)) return;
        const requestId = append ? gameRequestId : ++gameRequestId;
        isLoadingMore = true;
        activeQueryFactory = queryFactory;
        const loadMoreButton = document.getElementById('load-more-games');
        if (loadMoreButton) loadMoreButton.disabled = true;
        showLoading(true);

        if (!append) {
            loadedGameCount = 0;
            totalGameCount = null;
            consoleSections.clear();
            const list = document.getElementById('games-list');
            const header = document.getElementById('hub-header');
            if (list) {
                [...list.children].forEach(child => {
                    if (child !== header && child.id !== 'gamesLoading') child.remove();
                });
            }
            updatePagination(0);
        }

        try {
            const query = queryFactory(!append).range(loadedGameCount, loadedGameCount + pageSize - 1);
            const { data: games, error, count } = await query;
            if (error) throw error;
            if (requestId !== gameRequestId) return;

            const result = games || [];
            totalGameCount = count ?? totalGameCount;
            displayGames(result, append);
            loadedGameCount += result.length;
            updatePagination(result.length);
            console.log(`✅ Loaded ${loadedGameCount}${totalGameCount === null ? '' : ` of ${totalGameCount}`} games`);
        } catch (error) {
            if (requestId === gameRequestId) {
                console.error('Error loading games:', error);
                showMessage('error', `Failed to load games: ${error.message}`);
            }
        } finally {
            if (requestId === gameRequestId) {
                isLoadingMore = false;
                if (loadMoreButton) loadMoreButton.disabled = false;
                showLoading(false);
            }
        }
    }

    function updatePagination(lastPageLength) {
        const pagination = document.getElementById('games-pagination');
        const button = document.getElementById('load-more-games');
        const summary = document.getElementById('games-results-summary');
        const hasMore = totalGameCount === null ? lastPageLength === pageSize : loadedGameCount < totalGameCount;
        if (pagination) pagination.classList.toggle('hidden', loadedGameCount === 0);
        if (button) {
            button.classList.toggle('hidden', !hasMore);
            button.disabled = isLoadingMore;
        }
        if (summary) {
            summary.textContent = totalGameCount === null
                ? `Showing ${loadedGameCount} games`
                : `Showing ${loadedGameCount} of ${totalGameCount} games`;
        }
    }

    function displayGames(games, append = false) {
        const gamesList = document.getElementById('games-list');
        if (!gamesList) return;
        
        if (!append && games.length === 0) {
            const header = document.getElementById('hub-header');
            gamesList.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-6xl mb-4">🕹️</div>
                    <h3 class="text-xl font-bold text-gray-300">No Games Found</h3>
                    <p class="text-gray-500 mt-2">Try adjusting your search or filters.</p>
                </div>
            `;
            if (header) gamesList.prepend(header);
            showLoading(false);
            return;
        }
        
        let gamesGrid = document.getElementById('gamesGrid');
        if (!gamesGrid) {
            gamesGrid = document.createElement('div');
            gamesGrid.id = 'gamesGrid';
            gamesGrid.className = 'space-y-8 mt-8';
            gamesList.appendChild(gamesGrid);
        }
        
        if (!append) {
            gamesGrid.innerHTML = '';
            consoleSections.clear();
        }
        
        games.forEach(game => {
            const consoleName = game.console || 'Unspecified Console';
            let section = consoleSections.get(consoleName);
            if (!section) {
                section = document.createElement('section');
                section.className = 'console-game-section';
                const heading = document.createElement('h2');
                heading.className = 'text-2xl font-bold text-cyan-300 mb-4 border-b border-gray-700 pb-2';
                heading.textContent = consoleName;
                const cardsGrid = document.createElement('div');
                cardsGrid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
                section.append(heading, cardsGrid);
                gamesGrid.appendChild(section);
                section.cardsGrid = cardsGrid;
                consoleSections.set(consoleName, section);
            }
            section.cardsGrid.insertAdjacentHTML('beforeend', createGameCard(game));
        });
    }
    
    function createGameCard(game) {
        const rating = game.rating || 0;
        const views = game.views_count || 0;
        const platforms = game.console?.split(',').map(p => p.trim()) || [];
        
        const platformBadges = platforms.map(platform => 
            `<span class="inline-block bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded mr-1 mb-1">${escapeHtml(platform)}</span>`
        ).join('');
        
        // Helper for Hub Tags
        const createHubTag = (type, value, icon) => {
            if (!value || value === 'Unknown' || value === 'N/A') return '';
            // Escape single quotes for onclick handlers
            const safeValue = escapeHtml(value).replace(/'/g, "\\'");
            return `<button onclick="event.stopPropagation(); window.handleHubClick('${type}', '${safeValue}')" 
                         class="hub-tag inline-flex items-center gap-1 bg-gray-700 hover:bg-cyan-700 text-gray-300 hover:text-white text-xs px-2 py-1 rounded transition mr-2 mb-2 border border-gray-600 hover:border-cyan-500 cursor-pointer">
                         <span>${icon}</span> ${escapeHtml(value)}
                    </button>`;
        };

        const yearVal = game.year || 'Unknown';
        const safeYear = escapeHtml(yearVal).replace(/'/g, "\\'");

        return `
            <div class="game-card bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-cyan-500 transition-all duration-300 cursor-pointer flex flex-col"
                 data-game-id="${escapeHtml(game.id || '')}"
                 data-game-slug="${escapeHtml(game.slug || '')}">
                <div class="relative shrink-0">
                    <div class="h-48 bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center">
                        ${game.cover_image_url ? 
                            `<img src="${escapeHtml(game.cover_image_url)}" alt="${escapeHtml(game.title)}" loading="lazy" decoding="async" class="w-full h-full object-cover">` :
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
                        <button onclick="event.stopPropagation(); window.handleHubClick('year', '${safeYear}')" 
                                class="hub-tag ml-2 bg-gray-700 hover:bg-cyan-700 text-gray-300 hover:text-white text-xs px-2 py-1 rounded transition border border-gray-600 shrink-0 cursor-pointer">
                            ${yearVal}
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
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export default initGamesModule;
