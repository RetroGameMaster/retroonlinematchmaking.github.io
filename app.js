// app.js - FIXED HTML LOADING
import { supabase, initAuthListener, updateAuthUI } from './lib/supabase.js';

let currentModule = null;

// Initialize modules
const modules = {
    'home': () => import('./modules/home/home.js'),
    'games': () => import('./modules/games/games.js'),
    'auth': () => import('./modules/auth/auth.js'),
    'admin': () => import('./modules/admin/admin.js'),
    'chat': () => import('./modules/chat/chat.js'),
    'profile': () => import('./modules/profile/profile.js'),
    'game': () => import('./modules/game-detail/game-detail.js'),
    'submit-game': () => import('./modules/submit-game/submit-game.js'),
    'search-users': () => import('./modules/search-users/search-users.js')
};

// Initialize the app
async function initializeApp() {
    console.log('🚀 Initializing ROM app...');
    
    try {
        // Initialize auth listener
        const { data: { subscription } } = initAuthListener(async (event, session) => {
            console.log('Auth state changed:', event, session);
            
            if (session?.user) {
                window.rom.currentUser = session.user;
                console.log('✅ Updated rom.currentUser:', session.user.email);
            } else {
                window.rom.currentUser = null;
                console.log('❌ No user logged in');
            }
            
            await updateAuthUI();
        });
        
        // Update UI initially
        await updateAuthUI();
        
        // Handle hash changes
        window.addEventListener('hashchange', handleHashChange);
        
        // Load initial module
        await handleHashChange();
        
        console.log('✅ App initialized successfully');
        
        window.rom.authSubscription = subscription;
        
    } catch (error) {
        console.error('❌ App initialization failed:', error);
        showError('App Initialization Error', error.message);
    }
}

// Handle hash changes
async function handleHashChange() {
    const hash = window.location.hash.slice(2) || 'home';
    console.log(`🔗 Hash changed to: ${hash}`);
    await loadModule(hash);
}

// Load module function - FIXED HTML LOADING
async function loadModule(moduleName) {
    try {
        console.log(`📦 Loading module: ${moduleName}`);
        
        // Check for game detail page
        if (moduleName.startsWith('game/')) {
            const identifier = moduleName.split('/')[1];
            await loadGameDetail(identifier);
            return;
        }
        
        // Check for profile detail page
        if (moduleName.startsWith('profile/')) {
            const profileId = moduleName.split('/')[1];
            await loadProfileDetail(profileId);
            return;
        }
        
        // Clear current content
        const appContent = document.getElementById('app-content');
        if (appContent) {
            appContent.innerHTML = '';
        }
        
        // Show basic loading first
        if (appContent) {
            appContent.innerHTML = `
                <div class="text-center py-12">
                    <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
                    <p class="mt-2 text-gray-300">Loading ${moduleName}...</p>
                </div>
            `;
        }
        
        // Try to load module HTML
        let htmlLoaded = false;
        try {
            const response = await fetch(`./modules/${moduleName}/${moduleName}.html`);
            if (response.ok) {
                const html = await response.text();
                if (appContent) {
                    appContent.innerHTML = html;
                    htmlLoaded = true;
                    console.log(`✅ Loaded HTML for ${moduleName}`);
                }
            }
        } catch (fetchError) {
            console.log(`❌ Failed to load HTML for ${moduleName}:`, fetchError);
        }
        
        // If HTML failed to load, show a basic template
        if (!htmlLoaded && appContent) {
            console.log(`⚠️ Using fallback for ${moduleName}`);
            appContent.innerHTML = getFallbackContent(moduleName);
        }
        
        // Try to load and initialize module JS
        try {
            if (modules[moduleName]) {
                const module = await modules[moduleName]();
                
                const rom = {
                    supabase: window.supabase,
                    currentUser: window.rom?.currentUser || null,
                    loadModule: loadModule,
                    navigateTo: function(module) {
                        window.location.hash = `#/${module}`;
                    }
                };
                
                // Initialize module with rom object
                if (module.default && typeof module.default === 'function') {
                    await module.default(rom);
                } else if (module.initModule) {
                    await module.initModule(rom);
                } else if (module.default && module.default.initModule) {
                    await module.default.initModule(rom);
                } else if (module.initAuthModule) {
                    await module.initAuthModule(rom);
                } else if (module.init) {
                    await module.init(rom);
                } else if (typeof module === 'function') {
                    await module(rom);
                }
                
                currentModule = module;
                console.log(`✅ Module ${moduleName} initialized`);
            }
        } catch (moduleError) {
            console.log(`❌ Module JS failed for ${moduleName}:`, moduleError);
        }
        
    } catch (error) {
        console.error(`❌ Error loading module ${moduleName}:`, error);
        showError('Error loading module', error.message);
    }
}

// Fallback content generator
function getFallbackContent(moduleName) {
    switch(moduleName) {
        case 'games':
            return `
                <div class="max-w-6xl mx-auto p-4">
                    <h1 class="text-3xl font-bold mb-6 text-cyan-400">🎮 Game Library</h1>
                    
                    <!-- Search and Filters -->
                    <div class="mb-8">
                        <div class="flex gap-4 mb-4">
                            <div class="flex-1">
                                <input type="text" id="gameSearch" placeholder="Search games..." 
                                       class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white">
                            </div>
                            <button id="searchBtn" class="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-lg">
                                Search
                            </button>
                            <button id="filterBtn" class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg">
                                Filters
                            </button>
                        </div>
                        
                        <!-- Filter Panel -->
                        <div id="filterPanel" class="hidden bg-gray-800 p-4 rounded-lg mb-4">
                            <div class="grid md:grid-cols-3 gap-4">
                                <!-- Platform Filter -->
                                <div>
                                    <h3 class="font-bold text-gray-300 mb-2">Platform</h3>
                                    <div class="space-y-2">
                                        <label class="flex items-center">
                                            <input type="radio" name="platformFilter" value="all" checked class="mr-2">
                                            <span class="text-gray-300">All Platforms</span>
                                        </label>
                                        <label class="flex items-center">
                                            <input type="radio" name="platformFilter" value="ps2" class="mr-2">
                                            <span class="text-gray-300">PlayStation 2</span>
                                        </label>
                                        <label class="flex items-center">
                                            <input type="radio" name="platformFilter" value="ps3" class="mr-2">
                                            <span class="text-gray-300">PlayStation 3</span>
                                        </label>
                                        <label class="flex items-center">
                                            <input type="radio" name="platformFilter" value="xbox" class="mr-2">
                                            <span class="text-gray-300">Xbox</span>
                                        </label>
                                    </div>
                                </div>
                                
                                <!-- Year Filter -->
                                <div>
                                    <h3 class="font-bold text-gray-300 mb-2">Release Year</h3>
                                    <div class="space-y-2">
                                        <label class="flex items-center">
                                            <input type="radio" name="yearFilter" value="all" checked class="mr-2">
                                            <span class="text-gray-300">All Years</span>
                                        </label>
                                        <label class="flex items-center">
                                            <input type="radio" name="yearFilter" value="retro" class="mr-2">
                                            <span class="text-gray-300">Retro (1990s)</span>
                                        </label>
                                        <label class="flex items-center">
                                            <input type="radio" name="yearFilter" value="2000s" class="mr-2">
                                            <span class="text-gray-300">2000s</span>
                                        </label>
                                    </div>
                                </div>
                                
                                <!-- Sort Order -->
                                <div>
                                    <h3 class="font-bold text-gray-300 mb-2">Sort By</h3>
                                    <select id="sortOrder" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white">
                                        <option value="newest">Newest First</option>
                                        <option value="oldest">Oldest First</option>
                                        <option value="title_asc">Title A-Z</option>
                                        <option value="title_desc">Title Z-A</option>
                                        <option value="most_players">Most Players</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="flex justify-end gap-4 mt-4">
                                <button id="clearFilters" class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded">
                                    Clear Filters
                                </button>
                                <button id="applyFilters" class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded">
                                    Apply Filters
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Loading State -->
                    <div id="gamesLoading" class="text-center py-8">
                        <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
                        <p class="mt-2 text-gray-300">Loading games...</p>
                    </div>
                    
                    <!-- Games Grid -->
                    <div id="gamesGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>
                    
                    <!-- Empty State -->
                    <div id="emptyState" class="hidden text-center py-12">
                        <div class="text-6xl mb-4">🎮</div>
                        <h3 class="text-xl font-bold text-gray-300 mb-2">No Games Found</h3>
                        <p class="text-gray-500 mb-6">Try adjusting your search or filters.</p>
                        <button id="resetViewBtn" class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg">
                            Reset View
                        </button>
                    </div>
                    
                    <!-- Results Count -->
                    <div id="resultsCount" class="hidden text-gray-400 text-center mt-4"></div>
                </div>
            `;
            
        default:
            return `
                <div class="text-center py-12 px-4">
                    <h1 class="text-4xl font-bold mb-6 text-cyan-400">🎮 Retro Online Matchmaking</h1>
                    <p class="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
                        Connect with retro gaming communities. Play SOCOM II, Twisted Metal, Warhawk, and more with modern matchmaking.
                    </p>
                    <div class="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
                        <div class="bg-gray-800 p-6 rounded-lg border border-cyan-500">
                            <h3 class="text-xl font-bold mb-3 text-cyan-300">🎯 Browse Games</h3>
                            <p class="text-gray-300 mb-4">Discover retro games with online multiplayer support</p>
                            <a href="#/games" class="inline-block bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded">
                                View Games
                            </a>
                        </div>
                        <div class="bg-gray-800 p-6 rounded-lg border border-purple-500">
                            <h3 class="text-xl font-bold mb-3 text-purple-300">👤 Get Started</h3>
                            <p class="text-gray-300 mb-4">Create an account to submit games and join matchmaking</p>
                            <a href="#/auth" class="inline-block bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded">
                                Login/Register
                            </a>
                        </div>
                        <div class="bg-gray-800 p-6 rounded-lg border border-green-500">
                            <h3 class="text-xl font-bold mb-3 text-green-300">➕ Submit Game</h3>
                            <p class="text-gray-300 mb-4">Help grow our database by submitting retro games</p>
                            <a href="#/submit-game" class="inline-block bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                                Submit Game
                            </a>
                        </div>
                    </div>
                </div>
            `;
    }
}

// Function for game detail pages
async function loadGameDetail(identifier) {
    const appContent = document.getElementById('app-content');
    if (!appContent) return;
    
    appContent.innerHTML = `<div class="text-center p-8"><div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div><p class="mt-2 text-gray-300">Loading game details...</p></div>`;
    
    try {
        // Try to load HTML
        const response = await fetch('./modules/game-detail/game-detail.html');
        if (response.ok) {
            const html = await response.text();
            appContent.innerHTML = html;
        } else {
            throw new Error('Failed to load game detail HTML');
        }
        
        // Load and initialize game detail module
        const module = await import('./modules/game-detail/game-detail.js');
        const rom = {
            supabase: window.supabase,
            currentUser: window.rom?.currentUser || null,
            loadModule: loadModule,
            navigateTo: function(module) {
                window.location.hash = `#/${module}`;
            }
        };
        
        if (module.default && typeof module.default === 'function') {
            await module.default(rom, identifier);
        }
    } catch (error) {
        console.error('Error loading game detail:', error);
        showError('Error loading game', error.message);
    }
}

// Function for profile detail page
async function loadProfileDetail(profileId) {
    const appContent = document.getElementById('app-content');
    if (!appContent) return;
    
    appContent.innerHTML = `<div class="text-center p-8"><div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div><p class="mt-2 text-gray-300">Loading profile...</p></div>`;
    
    try {
        const response = await fetch('./modules/profile/profile.html');
        if (response.ok) {
            const html = await response.text();
            appContent.innerHTML = html;
        }
        
        const module = await import('./modules/profile/profile.js');
        const rom = {
            supabase: window.supabase,
            currentUser: window.rom?.currentUser || null,
            loadModule: loadModule,
            navigateTo: function(module) {
                window.location.hash = `#/${module}`;
            }
        };
        
        if (module.default && typeof module.default === 'function') {
            await module.default(rom, profileId);
        }
    } catch (error) {
        console.error('Error loading profile detail:', error);
        showError('Error loading profile', error.message);
    }
}

// Show error
function showError(title, message) {
    const appContent = document.getElementById('app-content');
    if (appContent) {
        appContent.innerHTML = `
            <div class="max-w-md mx-auto p-8">
                <div class="bg-red-900/30 border border-red-500 rounded-lg p-6">
                    <h2 class="text-2xl font-bold text-red-400 mb-4">${title}</h2>
                    <p class="text-gray-300 mb-4">${message}</p>
                    <div class="flex gap-4">
                        <button onclick="window.location.hash = '#/home'" 
                                class="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded">
                            Go Home
                        </button>
                        <button onclick="window.location.reload()" 
                                class="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded">
                            Refresh Page
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}

// Make loadModule available globally
window.loadModule = loadModule;
window.supabase = supabase;

// Initialize the global rom object
window.rom = {
    supabase: supabase,
    currentUser: null,
    loadModule: loadModule,
    navigateTo: function(module) {
        window.location.hash = `#/${module}`;
    }
};

// Initialize the app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
