// app.js - UPDATED FOR SEO-FRIENDLY URLS
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
    'game-detail': () => import('./modules/game-detail/game-detail.js'),
    'submit-game': () => import('./modules/submit-game/submit-game.js'),
    'search-users': () => import('./modules/search-users/search-users.js')
};

// Fallback content
const fallbackContent = {
    'home': `
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
    `,
    'games': `
        <div class="max-w-6xl mx-auto p-4">
            <h1 class="text-3xl font-bold mb-6 text-cyan-400">🎮 Game Library</h1>
            <div class="text-center">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
                <p class="mt-2 text-gray-300">Loading games...</p>
            </div>
        </div>
    `,
    'auth': `
        <div class="max-w-md mx-auto p-4">
            <h1 class="text-3xl font-bold mb-6 text-cyan-400 text-center">🔐 Authentication</h1>
            <div class="text-center">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
                <p class="mt-2 text-gray-300">Loading auth module...</p>
            </div>
        </div>
    `,
    'admin': `
        <div class="max-w-6xl mx-auto p-4">
            <h1 class="text-3xl font-bold mb-6 text-cyan-400">🛠️ Admin Panel</h1>
            <div class="text-center">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
                <p class="mt-2 text-gray-300">Loading admin panel...</p>
            </div>
        </div>
    `,
    'chat': `
        <div class="max-w-4xl mx-auto p-4">
            <h1 class="text-3xl font-bold mb-6 text-cyan-400">💬 Live Chat</h1>
            <div class="bg-gray-800 p-6 rounded-lg">
                <p class="text-gray-300">Chat module coming soon!</p>
            </div>
        </div>
    `,
    'profile': `
        <div class="max-w-4xl mx-auto p-4">
            <h1 class="text-3xl font-bold mb-6 text-cyan-400">👤 Your Profile</h1>
            <div class="text-center">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
                <p class="mt-2 text-gray-300">Loading profile...</p>
            </div>
        </div>
    `,
    'submit-game': `
        <div class="max-w-4xl mx-auto p-4">
            <h1 class="text-3xl font-bold mb-6 text-cyan-400">➕ Submit Game</h1>
            <div class="text-center">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
                <p class="mt-2 text-gray-300">Loading submission form...</p>
            </div>
        </div>
    `,
    'search-users': `
        <div class="max-w-4xl mx-auto p-4">
            <h1 class="text-3xl font-bold mb-6 text-cyan-400">🔍 Find Users</h1>
            <div class="text-center">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
                <p class="mt-2 text-gray-300">Loading user search...</p>
            </div>
        </div>
    `
};

// Initialize the app
async function initializeApp() {
    console.log('🚀 Initializing ROM app...');
    
    try {
        // Initialize auth listener
        const { data: { subscription } } = initAuthListener(async (event, session) => {
            console.log('Auth state changed:', event, session);
            
            // Update rom.currentUser when auth state changes
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
        
        // Store the subscription for cleanup if needed
        window.rom.authSubscription = subscription;
        
    } catch (error) {
        console.error('❌ App initialization failed:', error);
        showError('App Initialization Error', error.message);
    }
}

// Handle hash changes with slug support
async function handleHashChange() {
    const hash = window.location.hash.slice(2) || 'home';
    await loadModule(hash);
}

// Load module function with slug support
async function loadModule(moduleName) {
    try {
        console.log(`📦 Loading module: ${moduleName}`);
        
        // Check for game detail page with ID (backward compatibility)
        if (moduleName.startsWith('game/')) {
            const identifier = moduleName.split('/')[1];
            await loadGameDetail(identifier);
            return;
        }
        
        // Check for game detail page with slug (new SEO-friendly URLs)
        if (moduleName.startsWith('game-detail/')) {
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
        
        // Show loading content
        if (appContent) {
            const loadingHTML = fallbackContent[moduleName] || fallbackContent['home'];
            appContent.innerHTML = loadingHTML;
        }
        
        // Try to load module HTML
        try {
            const response = await fetch(`./modules/${moduleName}/${moduleName}.html`);
            if (response.ok) {
                const html = await response.text();
                if (appContent) {
                    appContent.innerHTML = html;
                }
            }
        } catch (fetchError) {
            console.log(`Using fallback for ${moduleName}`);
        }
        
        // Try to load and initialize module JS
        try {
            if (modules[moduleName]) {
                const module = await modules[moduleName]();
                
                // Get the rom object with current state
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
            console.log(`Module JS not loaded for ${moduleName}:`, moduleError);
        }
        
    } catch (error) {
        console.error(`❌ Error loading module ${moduleName}:`, error);
        showError('Error loading module', error.message);
    }
}

// Function for game detail pages with slug or ID support
async function loadGameDetail(identifier) {
    const appContent = document.getElementById('app-content');
    if (!appContent) return;
    
    // Show loading
    appContent.innerHTML = `<div class="text-center p-8"><div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div><p class="mt-2 text-gray-300">Loading game details...</p></div>`;
    
    try {
        // Load game detail HTML
        const response = await fetch('./modules/game-detail/game-detail.html');
        if (!response.ok) throw new Error('Failed to load game detail module');
        
        const html = await response.text();
        appContent.innerHTML = html;
        
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
        
        if (module.initModule) {
            await module.initModule(rom, identifier);
        } else if (module.default && module.default.initModule) {
            await module.default.initModule(rom, identifier);
        } else if (module.default) {
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
    
    // Show loading
    appContent.innerHTML = `<div class="text-center p-8"><div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div><p class="mt-2 text-gray-300">Loading profile...</p></div>`;
    
    try {
        // Load profile HTML
        const response = await fetch('./modules/profile/profile.html');
        if (!response.ok) throw new Error('Failed to load profile module');
        
        const html = await response.text();
        appContent.innerHTML = html;
        
        // Load and initialize profile module with specific profile ID
        const module = await import('./modules/profile/profile.js');
        const rom = {
            supabase: window.supabase,
            currentUser: window.rom?.currentUser || null,
            loadModule: loadModule,
            navigateTo: function(module) {
                window.location.hash = `#/${module}`;
            }
        };
        
        if (module.initModule) {
            await module.initModule(rom, profileId);
        } else if (module.default && module.default.initModule) {
            await module.default.initModule(rom, profileId);
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
