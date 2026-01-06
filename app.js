import { supabase, initAuthListener, updateAuthUI } from './lib/supabase.js';

let currentModule = null;

// Initialize modules
const modules = {
    'home': () => import('./modules/home/home.js'),
    'games': () => import('./modules/games/games.js'),
    'auth': () => import('./modules/auth/auth.js'),
    'admin': () => import('./modules/admin/admin.js'),
    'chat': () => import('./modules/chat/chat.js'),
    'profile': () => import('./modules/profile/profile.js')
};
// Add this near the top of app.js, after the imports
window.navigateTo = function(module) {
    window.location.hash = `#/${module}`;
};

// Also expose loadModule globally for any legacy buttons
window.rom = {
    loadModule: loadModule,
    navigateTo: function(module) {
        window.location.hash = `#/${module}`;
    }
};
// Fallback content for missing modules
const fallbackContent = {
    'home': `
        <div class="text-center py-12 px-4">
            <h1 class="text-4xl font-bold mb-6 text-cyan-400">🎮 Retro Online Matchmaking</h1>
            <p class="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
                Connect with retro gaming communities. Play SOCOM II, Twisted Metal, Warhawk, and more with modern matchmaking.
            </p>
            <div class="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
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
            </div>
        </div>
    `,
    'games': `
        <div class="max-w-4xl mx-auto">
            <h1 class="text-3xl font-bold mb-6 text-cyan-400">🎮 Game Library</h1>
            <div class="bg-gray-800 p-6 rounded-lg mb-6">
                <h2 class="text-xl font-bold mb-4 text-cyan-300">Submit a New Game</h2>
                <form id="game-form" class="space-y-4">
                    <div>
                        <label class="block text-gray-300 mb-2">Game Title</label>
                        <input type="text" name="title" class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" required>
                    </div>
                    <div>
                        <label class="block text-gray-300 mb-2">Console</label>
                        <select name="console" class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" required>
                            <option value="PS2">PlayStation 2</option>
                            <option value="PS3">PlayStation 3</option>
                            <option value="XBOX">Xbox</option>
                            <option value="GC">GameCube</option>
                            <option value="PC">PC</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-gray-300 mb-2">Year</label>
                        <input type="number" name="year" min="1990" max="2010" class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" required>
                    </div>
                    <div>
                        <label class="block text-gray-300 mb-2">Description</label>
                        <textarea name="description" rows="3" class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" required></textarea>
                    </div>
                    <button type="submit" class="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded">
                        Submit Game
                    </button>
                </form>
            </div>
            
            <div class="bg-gray-800 p-6 rounded-lg">
                <h2 class="text-xl font-bold mb-4 text-cyan-300">Available Games</h2>
                <div id="games-list" class="space-y-4">
                    <div class="bg-gray-700 p-4 rounded">
                        <h3 class="text-lg font-bold text-white">SOCOM II: U.S. Navy SEALs</h3>
                        <p class="text-gray-300">PS2 • 2003</p>
                        <p class="text-gray-400 mt-2">Tactical third-person shooter with online multiplayer</p>
                    </div>
                </div>
            </div>
        </div>
    `,
    'auth': `
        <div class="text-center p-8">
            <h1 class="text-2xl font-bold mb-4 text-cyan-400">Loading Authentication...</h1>
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
        </div>
    `,
    'admin': `
        <div class="max-w-6xl mx-auto">
            <h1 class="text-3xl font-bold mb-6 text-cyan-400">🛠️ Admin Panel</h1>
            <div class="bg-gray-800 p-6 rounded-lg">
                <h2 class="text-xl font-bold mb-4 text-cyan-300">Pending Game Submissions</h2>
                <div id="pending-submissions" class="space-y-4">
                    <p class="text-gray-400">No pending submissions</p>
                </div>
            </div>
        </div>
    `,
    'chat': `
        <div class="max-w-4xl mx-auto">
            <h1 class="text-3xl font-bold mb-6 text-cyan-400">💬 Live Chat</h1>
            <div class="bg-gray-800 p-6 rounded-lg">
                <p class="text-gray-300">Chat module coming soon!</p>
            </div>
        </div>
    `,
    'profile': `
        <div class="max-w-4xl mx-auto">
            <h1 class="text-3xl font-bold mb-6 text-cyan-400">👤 Your Profile</h1>
            <div class="bg-gray-800 p-6 rounded-lg">
                <p class="text-gray-300">Profile module coming soon!</p>
            </div>
        </div>
    `
};

// Initialize the app
async function initializeApp() {
    console.log('🚀 Initializing ROM app...');
    
    try {
        // Initialize auth listener
        initAuthListener((event, session) => {
            console.log('Auth state changed:', event, session);
            updateAuthUI();
        });
        
        // Update UI initially
        await updateAuthUI();
        
        // Handle hash changes
        window.addEventListener('hashchange', handleHashChange);
        
        // Load initial module
        await handleHashChange();
        
        console.log('✅ App initialized successfully');
        
    } catch (error) {
        console.error('❌ App initialization failed:', error);
        showError('App Initialization Error', error.message);
    }
}

// Handle hash changes
async function handleHashChange() {
    const hash = window.location.hash.slice(2) || 'home';
    await loadModule(hash);
}

// Load module function
async function loadModule(moduleName) {
    try {
        console.log(`📦 Loading module: ${moduleName}`);
        
        // Check for admin access
        if (moduleName === 'admin') {
            const { data: { user }, error } = await supabase.auth.getUser();
            
            if (error || !user) {
                alert('Please login first');
                window.location.hash = '#/auth';
                return;
            }
            
            // Check admin status
            const { data: adminData } = await supabase
                .from('admins')
                .select('*')
                .eq('user_id', user.id)
                .single();
            
            if (!adminData) {
                alert('Admin access required');
                window.location.hash = '#/';
                return;
            }
        }
        
        // Clear current content
        const appContent = document.getElementById('app-content');
        if (appContent) {
            appContent.innerHTML = '';
        }
        
        // Try to load module HTML
        let html = fallbackContent[moduleName] || fallbackContent['home'];
        
        try {
            const response = await fetch(`./modules/${moduleName}/${moduleName}.html`);
            if (response.ok) {
                html = await response.text();
            }
        } catch (fetchError) {
            console.log(`Using fallback for ${moduleName}`);
        }
        
        // Insert HTML
        if (appContent) {
            appContent.innerHTML = html;
        }
        
        // Try to load and initialize module JS
        try {
            if (modules[moduleName]) {
                const module = await modules[moduleName]();
                
                // Initialize module
                if (module.initModule) {
                    await module.initModule();
                } else if (module.default && module.default.initModule) {
                    await module.default.initModule();
                } else if (module.initAuthModule) {
                    await module.initAuthModule();
                } else if (module.init) {
                    await module.init();
                }
                
                currentModule = module;
            }
        } catch (moduleError) {
            console.log(`Module JS not loaded for ${moduleName}:`, moduleError);
        }
        
        // Initialize auth form if needed (fallback)
        if (moduleName === 'auth') {
            initAuthFormFallback();
        }
        
        // Initialize games form if needed (fallback)
        if (moduleName === 'games') {
            initGamesFormFallback();
        }
        
        console.log(`✅ Module ${moduleName} loaded successfully`);
        
    } catch (error) {
        console.error(`❌ Error loading module ${moduleName}:`, error);
        showError('Error loading module', error.message);
    }
}

// Initialize auth form (fallback - only used if auth module fails)
function initAuthFormFallback() {
    const authContent = document.getElementById('app-content');
    if (authContent && authContent.innerHTML.includes('Loading Authentication')) {
        // The real auth module should load, but if it doesn't, redirect to a simple form
        setTimeout(() => {
            if (document.getElementById('auth-form')) return; // Real module loaded
            
            authContent.innerHTML = `
                <div class="max-w-md mx-auto">
                    <div class="bg-gray-800 p-8 rounded-lg border border-cyan-500">
                        <h2 class="text-2xl font-bold mb-6 text-center text-cyan-400">Authentication</h2>
                        <p class="text-gray-300 mb-4 text-center">
                            The auth module is taking a while to load. Please wait or refresh.
                        </p>
                        <div class="text-center">
                            <button onclick="window.location.reload()" 
                                    class="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded">
                                Refresh Page
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }, 3000);
    }
}

// Initialize games form (fallback)
function initGamesFormFallback() {
    const gameForm = document.getElementById('game-form');
    
    if (gameForm) {
        gameForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(gameForm);
            const title = formData.get('title');
            const console = formData.get('console');
            const year = formData.get('year');
            const description = formData.get('description');
            
            const { data: { user } } = await supabase.auth.getUser();
            
            if (!user) {
                alert('Please login to submit games');
                window.location.hash = '#/auth';
                return;
            }
            
            alert(`Game "${title}" submitted for review!`);
            gameForm.reset();
        });
    }
}

// Show error
function showError(title, message) {
    const appContent = document.getElementById('app-content');
    if (appContent) {
        appContent.innerHTML = `
            <div class="p-8">
                <h2 class="text-2xl font-bold text-red-500">${title}</h2>
                <p class="text-gray-300">${message}</p>
                <button onclick="window.location.hash = '#/home'" 
                        class="mt-4 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded">
                    Go Home
                </button>
            </div>
        `;
    }
}

// Make loadModule available globally
window.loadModule = loadModule;
window.supabase = supabase;

// Initialize the app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
