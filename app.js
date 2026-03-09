// app.js - COMPLETE FIXED VERSION
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

// Handle hash changes
async function handleHashChange() {
    const hash = window.location.hash.slice(2) || 'home';
    
    console.log('Hash changed to:', hash);
    
    // Check for game detail page - accept both ID and slug
    if (hash.startsWith('game/')) {
        const identifier = hash.split('/')[1];
        console.log('Loading game detail for:', identifier);
        await loadGameDetail(identifier);
        return;
    }
    
    // Check for game edit page
    if (hash.startsWith('edit-game/')) {
        const gameId = hash.split('/')[1];
        console.log('Loading game edit for:', gameId);
        await loadGameEdit(gameId);
        return;
    }
    
    // Check for profile detail page
    if (hash.startsWith('profile/')) {
        const profileId = hash.split('/')[1];
        await loadProfileDetail(profileId);
        return;
    }
    
    // For all other modules
    await loadModule(hash);
}

// Load module function
async function loadModule(moduleName) {
    try {
        console.log(`📦 Loading module: ${moduleName}`);
        
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

// Function for game detail pages - FIXED VERSION
async function loadGameDetail(identifier) {
    const appContent = document.getElementById('app-content');
    if (!appContent) return;
    
    // Show loading
    appContent.innerHTML = `<div class="text-center p-8"><div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div><p class="mt-2 text-gray-300">Loading game details...</p></div>`;
    
    try {
        // Load game detail HTML
        let response;
        try {
            response = await fetch('./modules/game-detail/game-detail.html');
            if (!response.ok) {
                response = await fetch('./modules/games/game-detail.html');
            }
        } catch (e) {
            // If HTML doesn't exist, show basic layout
            appContent.innerHTML = `
                <div class="max-w-7xl mx-auto p-4">
                    <div class="mb-6">
                        <a href="#/games" class="inline-flex items-center text-cyan-400 hover:text-cyan-300">
                            ← Back to Games
                        </a>
                    </div>
                    <div id="game-detail-content"></div>
                </div>
            `;
        }
        
        if (response && response.ok) {
            const html = await response.text();
            appContent.innerHTML = html;
        }
        
        // Load and initialize game detail module
        let module;
        try {
            module = await import('./modules/game-detail/game-detail.js');
        } catch (e) {
            try {
                module = await import('./modules/games/game-detail.js');
            } catch (e2) {
                console.error('Game detail module not found');
                showError('Game Detail Error', 'Game detail module not found');
                return;
            }
        }
        
        const rom = {
            supabase: window.supabase,
            currentUser: window.rom?.currentUser || null,
            loadModule: loadModule,
            navigateTo: function(module) {
                window.location.hash = `#/${module}`;
            }
        };
        
        // Call the initGameDetail function directly
        if (module.default && typeof module.default === 'function') {
            await module.default(rom, identifier);
        } else if (module.initGameDetail) {
            await module.initGameDetail(rom, identifier);
        } else if (module.default && module.default.initGameDetail) {
            await module.default.initGameDetail(rom, identifier);
        } else if (typeof module === 'function') {
            await module(rom, identifier);
        } else {
            // If none of the above, try calling initGameDetail directly from window
            if (window.initGameDetail) {
                await window.initGameDetail(rom, identifier);
            }
        }
    } catch (error) {
        console.error('Error loading game detail:', error);
        showError('Error loading game', error.message);
    }
}

// Function for game edit pages - NEW FUNCTION
async function loadGameEdit(gameId) {
  const appContent = document.getElementById('app-content');
  if (!appContent) return;

  appContent.innerHTML = `
    <div class="text-center p-8">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
      <p class="mt-2 text-gray-300">Loading editor...</p>
    </div>
  `;

  try {
    // Load game data
    const { data: game, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();
    
    if (error || !game) throw new Error('Game not found');

    // Check permissions
    const user = window.rom?.currentUser;
    if (!user) {
      window.location.hash = '#/auth';
      return;
    }

    const adminEmails = ['retrogamemasterra@gmail.com', 'admin@retroonlinematchmaking.com'];
    const canEdit = adminEmails.includes(user.email) || game.submitted_email === user.email;
    if (!canEdit) {
      appContent.innerHTML = `<div class="max-w-md mx-auto mt-12 text-center"><div class="text-5xl mb-4">🚫</div><h2 class="text-xl font-bold text-white">Access Denied</h2><p class="text-gray-400">You don’t have permission to edit this game.</p><button onclick="window.location.hash='#/games'" class="mt-4 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded">Back to Games</button></div>`;
      return;
    }

    // Load admin module and render edit form
    const { default: adminModule } = await import('./modules/admin/admin.js');
    
    // Force-load admin HTML into app-content
    const response = await fetch('./modules/admin/admin.html');
    const html = await response.text();
    appContent.innerHTML = html;

    // Now call the global edit function (must exist in admin.js)
    setTimeout(() => {
      if (typeof window.adminEditGame === 'function') {
        window.adminEditGame(gameId);
      } else {
        appContent.innerHTML = `<div class="text-center py-12"><p class="text-red-400">Edit interface failed to load.</p></div>`;
      }
    }, 300);

  } catch (error) {
    console.error('Error loading game edit:', error);
    appContent.innerHTML = `<div class="max-w-md mx-auto mt-12 text-center"><div class="text-5xl mb-4">⚠️</div><h2 class="text-xl font-bold text-white">Error</h2><p class="text-red-400">${error.message}</p><button onclick="window.location.hash='#/games'" class="mt-4 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded">Back to Games</button></div>`;
  }
}
// Helper function to create basic edit form
function createBasicEditForm() {
    return `
        <div class="max-w-4xl mx-auto p-4">
            <div class="mb-6">
                <a href="#/games" class="inline-flex items-center text-cyan-400 hover:text-cyan-300">
                    ← Back to Games
                </a>
            </div>
            <h1 class="text-3xl font-bold text-cyan-400 mb-6">✏️ Edit Game</h1>
            <div id="edit-game-content">
                <div class="text-center py-8">
                    <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
                    <p class="text-gray-400 mt-2">Loading game data...</p>
                </div>
            </div>
        </div>
    `;
}

// Helper function to initialize game edit
async function initializeGameEdit(gameId) {
    const editContent = document.getElementById('edit-game-content');
    if (!editContent) return;
    
    try {
        // Load game data
        const { data: game, error } = await supabase
            .from('games')
            .select('*')
            .eq('id', gameId)
            .single();
        
        if (error || !game) {
            editContent.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-4xl mb-4">❌</div>
                    <h3 class="text-xl font-bold text-white mb-2">Game Not Found</h3>
                    <p class="text-gray-300">The game you're trying to edit doesn't exist.</p>
                </div>
            `;
            return;
        }
        
        // Check if user can edit
        const user = window.rom?.currentUser;
        if (!user) {
            editContent.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-4xl mb-4">🔒</div>
                    <h3 class="text-xl font-bold text-white mb-2">Login Required</h3>
                    <p class="text-gray-300">Please log in to edit games.</p>
                    <button onclick="window.location.hash = '#/auth'" 
                            class="mt-4 bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded">
                        Go to Login
                    </button>
                </div>
            `;
            return;
        }
        
        // Check admin status
        const adminEmails = ['retrogamemasterra@gmail.com', 'admin@retroonlinematchmaking.com'];
        const isAdmin = adminEmails.includes(user.email?.toLowerCase());
        const canEdit = isAdmin || game.submitted_email === user.email;
        
        if (!canEdit) {
            editContent.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-4xl mb-4">🚫</div>
                    <h3 class="text-xl font-bold text-white mb-2">Permission Denied</h3>
                    <p class="text-gray-300">You don't have permission to edit this game.</p>
                </div>
            `;
            return;
        }
        
        // Show edit form
        editContent.innerHTML = createGameEditForm(game, isAdmin);
        
        // Initialize form
        initializeEditForm(game, isAdmin);
        
    } catch (error) {
        console.error('Error initializing game edit:', error);
        editContent.innerHTML = `
            <div class="text-center py-8">
                <div class="text-4xl mb-4">⚠️</div>
                <h3 class="text-xl font-bold text-white mb-2">Error</h3>
                <p class="text-gray-300">${error.message}</p>
            </div>
        `;
    }
}

function createGameEditForm(game, isAdmin) {
    return `
        <form id="gameEditForm" class="space-y-6">
            <input type="hidden" id="gameId" value="${game.id}">
            
            <!-- Image Management Section -->
            <div class="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                <h2 class="text-2xl font-bold text-white mb-4">🖼️ Game Images</h2>
                
                <!-- Cover Art -->
                <div class="mb-6">
                    <h3 class="text-lg font-bold text-cyan-300 mb-3">Cover Art</h3>
                    <div class="flex flex-col md:flex-row gap-6">
                        <div class="md:w-1/3">
                            <div class="current-image mb-4">
                                <p class="text-gray-300 mb-2">Current:</p>
                                ${game.cover_image_url ? 
                                    `<img src="${game.cover_image_url}" alt="Cover" 
                                         class="w-full h-64 object-cover rounded-lg border border-gray-600"
                                         id="currentCoverImage">` :
                                    `<div class="w-full h-64 bg-gray-700 rounded-lg flex items-center justify-center">
                                        <span class="text-gray-500 text-2xl">🎮</span>
                                    </div>`
                                }
                            </div>
                        </div>
                        
                        <div class="md:w-2/3">
                            <div class="mb-4">
                                <label class="block text-gray-300 mb-2">Update Cover Image</label>
                                <input type="file" id="newCoverImage" accept="image/*" 
                                       class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white">
                            </div>
                            <div id="coverPreview" class="hidden">
                                <p class="text-gray-300 mb-2">Preview:</p>
                                <img id="coverPreviewImage" class="w-32 h-32 object-cover rounded-lg border border-cyan-500">
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Screenshots (Admin Only) -->
                ${isAdmin ? `
                    <div>
                        <h3 class="text-lg font-bold text-purple-300 mb-3">Screenshots</h3>
                        <div class="mb-4">
                            <div class="mb-3">
                                <label class="block text-gray-300 mb-2">Add Screenshots</label>
                                <input type="file" id="newScreenshots" accept="image/*" multiple 
                                       class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white">
                            </div>
                            
                            <div id="screenshotsContainer" class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                ${game.screenshot_urls && game.screenshot_urls.length > 0 ? 
                                    game.screenshot_urls.map((url, index) => `
                                        <div class="screenshot-item relative" data-index="${index}">
                                            <img src="${url}" alt="Screenshot ${index + 1}" 
                                                 class="w-full h-32 object-cover rounded-lg border border-gray-600">
                                            <button type="button" onclick="removeScreenshot('${game.id}', ${index})" 
                                                    class="absolute top-0 right-0 bg-red-600 text-white w-6 h-6 rounded-full text-xs">
                                                ✕
                                            </button>
                                        </div>
                                    `).join('') : 
                                    '<p class="text-gray-500 col-span-4 text-center py-4">No screenshots yet</p>'
                                }
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <!-- Game Details -->
            <div class="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                <h2 class="text-2xl font-bold text-white mb-4">📝 Game Details</h2>
                
                <div class="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-gray-300 mb-2">Title *</label>
                        <input type="text" id="editTitle" value="${escapeHtml(game.title)}" required
                               class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">
                    </div>
                    
                    <div>
                        <label class="block text-gray-300 mb-2">Console *</label>
                        <input type="text" id="editConsole" value="${escapeHtml(game.console)}" required
                               class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">
                    </div>
                </div>
                
                <div class="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-gray-300 mb-2">Release Year</label>
                        <input type="number" id="editYear" value="${game.year || ''}"
                               class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">
                    </div>
                    
                    <div>
                        <label class="block text-gray-300 mb-2">Multiplayer Type</label>
                        <select id="editMultiplayerType" 
                                class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">
                            <option value="Online" ${game.multiplayer_type === 'Online' ? 'selected' : ''}>Online</option>
                            <option value="LAN" ${game.multiplayer_type === 'LAN' ? 'selected' : ''}>LAN</option>
                            <option value="Split-screen" ${game.multiplayer_type === 'Split-screen' ? 'selected' : ''}>Split-screen</option>
                            <option value="Hotseat" ${game.multiplayer_type === 'Hotseat' ? 'selected' : ''}>Hotseat</option>
                            <option value="Mixed" ${game.multiplayer_type === 'Mixed' ? 'selected' : ''}>Mixed</option>
                            <option value="Other" ${game.multiplayer_type === 'Other' ? 'selected' : ''}>Other</option>
                        </select>
                    </div>
                </div>
                
                <div class="mb-4">
                    <label class="block text-gray-300 mb-2">Description *</label>
                    <textarea id="editDescription" rows="6" required
                              class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">${escapeHtml(game.description || '')}</textarea>
                </div>
                
                <div class="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-gray-300 mb-2">Connection Method</label>
                        <input type="text" id="editConnectionMethod" value="${escapeHtml(game.connection_method || '')}"
                               class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">
                    </div>
                    
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-gray-300 mb-2">Min Players</label>
                            <input type="number" id="editPlayersMin" value="${game.players_min || 1}" min="1" max="99"
                                   class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-gray-300 mb-2">Max Players</label>
                            <input type="number" id="editPlayersMax" value="${game.players_max || 1}" min="1" max="99"
                                   class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">
                        </div>
                    </div>
                </div>
                
                <div class="mb-4">
                    <label class="block text-gray-300 mb-2">Connection Details</label>
                    <textarea id="editConnectionDetails" rows="3"
                              class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">${escapeHtml(game.connection_details || '')}</textarea>
                </div>
                
                <div class="mb-4">
                    <label class="block text-gray-300 mb-2">Server Details</label>
                    <textarea id="editServerDetails" rows="3"
                              class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">${escapeHtml(game.server_details || '')}</textarea>
                </div>
                
                <div class="flex items-center mb-4">
                    <input type="checkbox" id="editServersAvailable" ${game.servers_available ? 'checked' : ''}
                           class="w-4 h-4 text-cyan-500 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500">
                    <label class="ml-2 text-gray-300">Active servers available</label>
                </div>
            </div>
            
            <!-- Form Actions -->
            <div class="flex justify-end gap-3">
                <button type="button" onclick="window.location.hash = '#/game/${game.slug || game.id}'"
                        class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors">
                    Cancel
                </button>
                <button type="submit" id="saveBtn"
                        class="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg transition-colors">
                    Save Changes
                </button>
            </div>
        </form>
    `;
}

function initializeEditForm(game, isAdmin) {
    const form = document.getElementById('gameEditForm');
    if (!form) return;
    
    // Cover image preview
    const coverInput = document.getElementById('newCoverImage');
    if (coverInput) {
        coverInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const preview = document.getElementById('coverPreview');
                    const img = document.getElementById('coverPreviewImage');
                    img.src = e.target.result;
                    preview.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveGameEdit(game);
    });
    
    // Make removeScreenshot available
    window.removeScreenshot = async function(gameId, index) {
        if (!confirm('Remove this screenshot?')) return;
        
        try {
            const { data: gameData } = await supabase
                .from('games')
                .select('screenshot_urls')
                .eq('id', gameId)
                .single();
            
            if (gameData && gameData.screenshot_urls) {
                const newScreenshots = [...gameData.screenshot_urls];
                newScreenshots.splice(index, 1);
                
                await supabase
                    .from('games')
                    .update({ screenshot_urls: newScreenshots })
                    .eq('id', gameId);
                
                showNotification('✅ Screenshot removed!');
                // Remove from UI
                const screenshotItem = document.querySelector(`.screenshot-item[data-index="${index}"]`);
                if (screenshotItem) {
                    screenshotItem.remove();
                }
                // Update indices
                updateScreenshotIndices();
            }
        } catch (error) {
            console.error('Error removing screenshot:', error);
            showNotification('❌ Error: ' + error.message, 'error');
        }
    };
}

async function saveGameEdit(game) {
    const saveBtn = document.getElementById('saveBtn');
    const originalText = saveBtn.textContent;
    
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    
    try {
        const gameId = document.getElementById('gameId').value;
        
        // Handle cover image upload if new one selected
        const coverInput = document.getElementById('newCoverImage');
        let coverImageUrl = game.cover_image_url;
        
        if (coverInput.files.length > 0) {
            const coverFile = coverInput.files[0];
            const coverResult = await uploadGameImage(coverFile, gameId, 'cover');
            if (coverResult.success) {
                coverImageUrl = coverResult.url;
            }
        }
        
        // Handle screenshot uploads if admin
        const screenshotsInput = document.getElementById('newScreenshots');
        let screenshotUrls = game.screenshot_urls || [];
        
        if (screenshotsInput && screenshotsInput.files.length > 0) {
            const files = Array.from(screenshotsInput.files);
            for (const file of files) {
                const screenshotResult = await uploadGameImage(file, gameId, 'screenshots');
                if (screenshotResult.success) {
                    screenshotUrls.push(screenshotResult.url);
                }
            }
        }
        
        // Prepare updates
        const updates = {
            title: document.getElementById('editTitle').value.trim(),
            console: document.getElementById('editConsole').value.trim(),
            year: document.getElementById('editYear').value ? parseInt(document.getElementById('editYear').value) : null,
            description: document.getElementById('editDescription').value.trim(),
            multiplayer_type: document.getElementById('editMultiplayerType').value,
            connection_method: document.getElementById('editConnectionMethod').value.trim() || null,
            connection_details: document.getElementById('editConnectionDetails').value.trim() || null,
            server_details: document.getElementById('editServerDetails').value.trim() || null,
            players_min: parseInt(document.getElementById('editPlayersMin').value) || 1,
            players_max: parseInt(document.getElementById('editPlayersMax').value) || 1,
            servers_available: document.getElementById('editServersAvailable').checked,
            cover_image_url: coverImageUrl,
            screenshot_urls: screenshotUrls,
            updated_at: new Date().toISOString()
        };
        
        // Save to database
        const { error } = await supabase
            .from('games')
            .update(updates)
            .eq('id', gameId);
        
        if (error) throw error;
        
        showNotification('✅ Game updated successfully!', 'success');
        
        // Redirect to game page
        setTimeout(() => {
            window.location.hash = `#/game/${game.slug || gameId}`;
        }, 1500);
        
    } catch (error) {
        console.error('Error saving game edit:', error);
        showNotification('❌ Error: ' + error.message, 'error');
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
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
        
        // Pass the profile ID to the module
        if (module.default && typeof module.default === 'function') {
            await module.default(rom, profileId);
        } else if (module.initModule) {
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

// Image upload helper
async function uploadGameImage(file, gameId, type = 'cover') {
    try {
        if (!file.type.startsWith('image/')) {
            return { success: false, error: 'File must be an image' };
        }
        
        if (file.size > 2 * 1024 * 1024) {
            return { success: false, error: 'Image must be less than 2MB' };
        }
        
        const fileExt = file.name.split('.').pop();
        const fileName = `${type === 'cover' ? 'covers' : 'screenshots'}/${gameId}/${Date.now()}.${fileExt}`;
        
        const { data, error } = await supabase.storage
            .from('game-media')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: true
            });
        
        if (error) throw error;
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('game-media')
            .getPublicUrl(fileName);
        
        return { success: true, url: publicUrl };
        
    } catch (error) {
        console.error('Error uploading game image:', error);
        return { success: false, error: error.message };
    }
}

// Helper functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transition-all duration-300 ${
        type === 'success' ? 'bg-green-600' :
        type === 'error' ? 'bg-red-600' :
        'bg-cyan-600'
    } text-white`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function updateScreenshotIndices() {
    const items = document.querySelectorAll('.screenshot-item');
    items.forEach((item, index) => {
        item.setAttribute('data-index', index);
        const button = item.querySelector('button');
        if (button) {
            const gameId = button.onclick.toString().match(/'([^']+)'/)[1];
            button.setAttribute('onclick', `removeScreenshot('${gameId}', ${index})`);
        }
    });
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
