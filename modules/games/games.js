// modules/games/games.js
export function initModule(rom) {
    console.log('🎮 Games module initialized');
    console.log('rom.supabase available:', !!rom?.supabase);
    console.log('rom.currentUser:', rom?.currentUser?.email);
    
    // Store rom globally for this module
    window.rom = rom;
    
    // Get supabase from rom or window
    const supabase = rom?.supabase || window.supabase;
    
    if (!supabase) {
        console.error('❌ No Supabase client available!');
        showError('Database connection error. Please refresh the page.');
        return;
    }
    
    console.log('✅ Supabase client available');
    
    // Load existing games with supabase
    loadGames(supabase);
    
    // Setup search and filter
    setupSearchAndFilter();
    
    // Add submit game button if not already present
    addSubmitGameButton();
}

function addSubmitGameButton() {
    const gamesContainer = document.getElementById('games-list');
    if (!gamesContainer) return;
    
    // Check if button already exists
    const existingButton = gamesContainer.querySelector('.submit-game-button-container');
    if (existingButton) return;
    
    // Add submit game button at the top
    const submitButtonHTML = `
        <div class="submit-game-button-container mb-8 text-center">
            <a href="#/submit-game" 
               class="inline-block bg-gradient-to-r from-green-600 to-cyan-600 hover:from-green-700 hover:to-cyan-700 text-white font-bold py-4 px-8 rounded-lg text-lg transition-all transform hover:scale-105 shadow-lg hover:shadow-xl">
                🎮 Submit a New Game to ROM
            </a>
            <p class="text-gray-400 text-sm mt-3">Help grow our retro gaming community by adding new games!</p>
        </div>
    `;
    
    gamesContainer.insertAdjacentHTML('afterbegin', submitButtonHTML);
}

function setupSearchAndFilter() {
    const searchInput = document.getElementById('game-search');
    const consoleFilter = document.getElementById('console-filter');
    
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
    
    if (consoleFilter) {
        consoleFilter.addEventListener('change', handleFilter);
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function handleSearch() {
    const searchTerm = document.getElementById('game-search').value.toLowerCase();
    const gameCards = document.querySelectorAll('#games-list > div');
    
    gameCards.forEach(card => {
        const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
        const description = card.querySelector('p.text-gray-300')?.textContent.toLowerCase() || '';
        const platform = card.querySelector('span.bg-cyan-600')?.textContent.toLowerCase() || '';
        
        if (title.includes(searchTerm) || description.includes(searchTerm) || platform.includes(searchTerm)) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    });
}

function handleFilter() {
    const selectedPlatform = document.getElementById('console-filter').value;
    const gameCards = document.querySelectorAll('#games-list > div');
    
    gameCards.forEach(card => {
        const platform = card.querySelector('span.bg-cyan-600')?.textContent || '';
        
        if (!selectedPlatform || platform === selectedPlatform) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    });
}

async function loadGames(supabase) {
    const gamesContainer = document.getElementById('games-list');
    if (!gamesContainer) {
        console.error('Games container not found');
        return;
    }
    
    console.log('🔄 Loading games...');
    gamesContainer.innerHTML = `
        <div class="text-center py-12">
            <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
            <p class="text-gray-400 mt-4">Loading game library...</p>
        </div>
    `;
    
    try {
        console.log('📡 Querying games from Supabase...');
        const { data: games, error, count } = await supabase
            .from('games')
            .select('*')
            .order('title', { ascending: true });
        
        if (error) {
            console.error('Database error:', error);
            throw error;
        }
        
        console.log(`✅ Found ${games?.length || 0} games`);
        
        if (!games || games.length === 0) {
            gamesContainer.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-4xl mb-4">🎮</div>
                    <h3 class="text-xl font-bold text-white mb-2">No Games Available</h3>
                    <p class="text-gray-300">No games have been approved yet.</p>
                    <p class="text-gray-400 text-sm mt-2">Be the first to submit a game!</p>
                </div>
            `;
            return;
        }
        
        console.log('🎨 Rendering game cards...');
        gamesContainer.innerHTML = games.map(game => {
            const playerCount = game.players_min === game.players_max 
                ? `${game.players_min} player${game.players_min > 1 ? 's' : ''}` 
                : `${game.players_min}-${game.players_max} players`;
            
            const coverImage = game.cover_image_url || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&h=600&fit=crop';
            const screenshots = game.screenshot_urls || [];
            
            // Get display name for submitted by (extract from email)
            const submittedByDisplay = game.submitted_email ? 
                                      game.submitted_email.split('@')[0] : 
                                      (game.submitted_by ? game.submitted_by.split('@')[0] : 'Unknown');
            
            return `
                <div class="bg-gray-800 p-6 rounded-lg mb-6 border border-gray-700 hover:border-cyan-500 transition group">
                    <div class="flex flex-col md:flex-row gap-6">
                        <!-- Cover Image -->
                        <div class="md:w-1/4">
                            <img src="${coverImage}" 
                                 alt="${game.title} cover"
                                 class="w-full h-48 md:h-64 object-cover rounded-lg cursor-pointer"
                                 onclick="window.location.hash = '#/game/${game.id}'">
                        </div>
                        
                        <!-- Game Info -->
                        <div class="md:w-3/4">
                            <div class="flex flex-col md:flex-row justify-between items-start mb-4">
                                <div class="flex-1">
                                    <h3 class="text-2xl font-bold text-white mb-2 group-hover:text-cyan-300 transition cursor-pointer" 
                                        onclick="window.location.hash = '#/game/${game.id}'">
                                        ${game.title}
                                    </h3>
                                    <div class="flex flex-wrap items-center gap-2">
                                        <span class="bg-cyan-600 text-white px-3 py-1 rounded text-sm font-semibold">${game.console}</span>
                                        <span class="text-gray-300">${game.year}</span>
                                        <span class="text-gray-400">•</span>
                                        <span class="bg-purple-600 text-white px-3 py-1 rounded text-sm">${game.multiplayer_type || 'Multiplayer'}</span>
                                        <span class="text-gray-400">•</span>
                                        <span class="text-gray-300">${playerCount}</span>
                                    </div>
                                </div>
                                <div class="mt-2 md:mt-0">
                                    <span class="bg-green-600 text-white px-3 py-1 rounded text-sm font-semibold">✅ Approved</span>
                                </div>
                            </div>
                            
                            <p class="text-gray-300 mb-4 line-clamp-2">${game.description}</p>
                            
                            <!-- Screenshot Previews -->
                            ${screenshots.length > 0 ? `
                                <div class="flex space-x-2 mb-4 overflow-x-auto pb-2">
                                    ${screenshots.slice(0, 3).map((url, index) => `
                                        <img src="${url}" 
                                             alt="Screenshot ${index + 1}"
                                             class="w-24 h-16 object-cover rounded cursor-pointer"
                                             onclick="window.openLightbox && window.openLightbox('${url}')">
                                    `).join('')}
                                    ${screenshots.length > 3 ? `<span class="text-gray-400 text-sm self-center">+${screenshots.length - 3} more</span>` : ''}
                                </div>
                            ` : ''}
                            
                            <div class="flex flex-col md:flex-row justify-between items-center">
                                <div class="text-gray-400 text-sm mb-4 md:mb-0">
                                    Submitted by: ${submittedByDisplay}
                                    ${game.views_count ? ` • Views: ${game.views_count}` : ''}
                                </div>
                                
                                <div class="flex space-x-3">
                                    ${game.file_url ? `
                                        <a href="${game.file_url}" target="_blank" 
                                           class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded inline-flex items-center transition">
                                            <span class="mr-2">⬇️</span>
                                            Download
                                        </a>
                                    ` : `
                                        <button class="bg-gray-700 text-gray-400 px-4 py-2 rounded cursor-not-allowed">
                                            No File
                                        </button>
                                    `}
                                    
                                    <button onclick="window.location.hash = '#/game/${game.id}'" 
                                            class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded inline-flex items-center transition">
                                        <span class="mr-2">🔍</span>
                                        View Details
                                    </button>
                                    
                                    <button onclick="showConnectionModal('${game.id}', window.rom?.supabase || window.supabase)" 
                                            class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded inline-flex items-center transition">
                                        <span class="mr-2">🌐</span>
                                        Connection
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        console.log('✅ Games loaded successfully');
        
    } catch (error) {
        console.error('❌ Error loading games:', error);
        gamesContainer.innerHTML = `
            <div class="bg-red-900 border border-red-700 rounded-lg p-6 text-center">
                <h3 class="text-lg font-bold text-red-300 mb-2">Error Loading Games</h3>
                <p class="text-red-200 mb-2">${error.message}</p>
                <p class="text-gray-300 text-sm mb-4">This might be a database connection issue.</p>
                <button onclick="loadGames(window.rom?.supabase || window.supabase)" 
                        class="mt-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">
                    Try Again
                </button>
                <button onclick="window.location.reload()" 
                        class="mt-2 ml-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded">
                    Reload Page
                </button>
            </div>
        `;
    }
}

function showError(message) {
    const gamesContainer = document.getElementById('games-list');
    if (gamesContainer) {
        gamesContainer.innerHTML = `
            <div class="bg-red-900/30 border border-red-500 rounded-lg p-6 text-center">
                <h3 class="text-lg font-bold text-red-300 mb-2">Error</h3>
                <p class="text-gray-300">${message}</p>
                <button onclick="window.location.reload()" 
                        class="mt-4 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded">
                    Refresh Page
                </button>
            </div>
        `;
    }
}

// Connection details modal
window.showConnectionModal = async function(gameId, supabase) {
    try {
        if (!supabase) {
            supabase = window.rom?.supabase || window.supabase;
        }
        
        if (!supabase) {
            throw new Error('Database connection not available');
        }
        
        const { data: game, error } = await supabase
            .from('games')
            .select('*')
            .eq('id', gameId)
            .single();
        
        if (error) throw error;
        
        const playerCount = game.players_min === game.players_max 
            ? `${game.players_min} player${game.players_min > 1 ? 's' : ''}` 
            : `${game.players_min}-${game.players_max} players`;
        
        const modalHTML = `
            <div id="connection-modal" class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                <div class="bg-gray-800 rounded-lg max-w-2xl w-full border border-purple-500 max-h-[90vh] overflow-y-auto">
                    <div class="p-6">
                        <div class="flex justify-between items-start mb-6">
                            <div>
                                <h3 class="text-2xl font-bold text-white mb-1">🌐 ${game.title}</h3>
                                <p class="text-gray-300">Connection Guide for Online Play</p>
                            </div>
                            <button onclick="closeConnectionModal()" 
                                    class="text-gray-400 hover:text-white text-2xl">
                                &times;
                            </button>
                        </div>
                        
                        <div class="space-y-6">
                            <!-- Basic Info -->
                            <div class="grid md:grid-cols-3 gap-4">
                                <div class="bg-gray-900 p-4 rounded">
                                    <p class="text-gray-400 text-sm">Multiplayer Type</p>
                                    <p class="text-white font-bold">${game.multiplayer_type || 'Not specified'}</p>
                                </div>
                                <div class="bg-gray-900 p-4 rounded">
                                    <p class="text-gray-400 text-sm">Player Count</p>
                                    <p class="text-white font-bold">${playerCount}</p>
                                </div>
                                <div class="bg-gray-900 p-4 rounded">
                                    <p class="text-gray-400 text-sm">Connection Method</p>
                                    <p class="text-white font-bold">${game.connection_method || 'Not specified'}</p>
                                </div>
                            </div>
                            
                            <!-- Connection Instructions -->
                            ${game.connection_details ? `
                                <div>
                                    <h4 class="text-lg font-bold text-cyan-300 mb-2">📝 Connection Instructions</h4>
                                    <div class="bg-gray-900 p-4 rounded whitespace-pre-line text-gray-300">
                                        ${game.connection_details}
                                    </div>
                                </div>
                            ` : ''}
                            
                            <!-- Server Information -->
                            ${game.server_details ? `
                                <div>
                                    <h4 class="text-lg font-bold text-green-300 mb-2">🖥️ Server Information</h4>
                                    <div class="bg-gray-900 p-4 rounded text-gray-300">
                                        ${game.server_details}
                                    </div>
                                </div>
                            ` : ''}
                            
                            <!-- Server Status -->
                            <div>
                                <h4 class="text-lg font-bold mb-2">Server Status</h4>
                                <div class="flex items-center">
                                    <div class="w-3 h-3 rounded-full mr-2 ${game.servers_available ? 'bg-green-500' : 'bg-red-500'}"></div>
                                    <span class="text-gray-300">
                                        ${game.servers_available ? '🟢 Active servers are available' : '🔴 No active servers reported'}
                                    </span>
                                </div>
                            </div>
                            
                            <!-- Community Notes -->
                            <div class="bg-blue-900/30 border border-blue-700 rounded p-4">
                                <h4 class="text-lg font-bold text-blue-300 mb-2">💡 Tips & Community Notes</h4>
                                <p class="text-gray-300 text-sm">
                                    • Check the Discord community for matchmaking<br>
                                    • Make sure your firewall allows the connection<br>
                                    • Update your game to the latest version if possible<br>
                                    • Use wired connection for better stability
                                </p>
                            </div>
                        </div>
                        
                        <div class="mt-8 flex justify-end">
                            <button onclick="closeConnectionModal()" 
                                    class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
    } catch (error) {
        console.error('Error loading connection details:', error);
        alert('Could not load connection details: ' + error.message);
    }
};

window.closeConnectionModal = function() {
    const modal = document.getElementById('connection-modal');
    if (modal) modal.remove();
};

// Make loadGames available globally
window.loadGames = function() {
    const supabase = window.rom?.supabase || window.supabase;
    if (supabase) {
        loadGames(supabase);
    } else {
        console.error('Cannot load games: No Supabase client');
    }
};
