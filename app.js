import { supabase, initAuthListener, updateAuthUI } from './lib/supabase.js';
import { initNotifications } from './lib/notifications.js';
import { getRandomQuote } from './lib/quote-machine.js';

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
    'search-users': () => import('./modules/search-users/search-users.js'),
    'live-lobbies': () => import('./modules/live-lobbies/live-lobbies.js'),
    'lfg-scheduler': () => import('./modules/lfg-scheduler/lfg-scheduler.js'),
    'guides': () => import('./modules/guides/guides.js'),
    'lfg': () => import('./modules/lfg/lfg.js'),
    'tournaments': () => import('./modules/tournaments/tournaments.js'),
};

// Fallback content
const fallbackContent = {
    'home': `<div class="text-center py-12 px-4"><h1 class="text-4xl font-bold mb-6 text-cyan-400">🎮 Retro Online Matchmaking</h1><p class="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">Connect with retro gaming communities.</p></div>`,
    'games': `<div class="max-w-6xl mx-auto p-4"><h1 class="text-3xl font-bold mb-6 text-cyan-400">🎮 Game Library</h1><div class="text-center"><div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div><p class="mt-2 text-gray-300">Loading games...</p></div></div>`,
    'auth': `<div class="max-w-md mx-auto p-4"><h1 class="text-3xl font-bold mb-6 text-cyan-400 text-center">🔐 Authentication</h1><div class="text-center"><div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div><p class="mt-2 text-gray-300">Loading auth module...</p></div></div>`,
    'admin': `<div class="max-w-6xl mx-auto p-4"><h1 class="text-3xl font-bold mb-6 text-cyan-400">🛠️ Admin Panel</h1><div class="text-center"><div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div><p class="mt-2 text-gray-300">Loading admin panel...</p></div></div>`,
    'chat': `<div class="max-w-4xl mx-auto p-4"><h1 class="text-3xl font-bold mb-6 text-cyan-400">💬 Live Chat</h1><div class="bg-gray-800 p-6 rounded-lg"><p class="text-gray-300">Chat module coming soon!</p></div></div>`,
    'profile': `<div class="max-w-4xl mx-auto p-4"><h1 class="text-3xl font-bold mb-6 text-cyan-400">👤 Your Profile</h1><div class="text-center"><div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div><p class="mt-2 text-gray-300">Loading profile...</p></div></div>`,
    'submit-game': `<div class="max-w-4xl mx-auto p-4"><h1 class="text-3xl font-bold mb-6 text-cyan-400">➕ Submit Game</h1><div class="text-center"><div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div><p class="mt-2 text-gray-300">Loading submission form...</p></div></div>`,
    'search-users': `<div class="max-w-4xl mx-auto p-4"><h1 class="text-3xl font-bold mb-6 text-cyan-400">🔍 Find Users</h1><div class="text-center"><div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div><p class="mt-2 text-gray-300">Loading user search...</p></div></div>`,
    'lfg': `<div class="max-w-6xl mx-auto p-4"><h1 class="text-3xl font-bold mb-6 text-cyan-400">📅 Looking For Group</h1><div class="text-center"><div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div><p class="mt-2 text-gray-300">Loading LFG board...</p></div></div>`,
    'tournaments': `<div class="max-w-6xl mx-auto p-4"><h1 class="text-3xl font-bold mb-6 text-cyan-400">🏆 Community Tournaments</h1><div class="text-center"><div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div><p class="mt-2 text-gray-300">Loading tournament list...</p></div></div>`
};

// ============================================================================
// GLOBAL QUOTE RENDERER
// ============================================================================
const renderRandomQuote = () => {
    const quoteBar = document.getElementById('retro-quote-bar');
    if (!quoteBar) return;

    const quote = getRandomQuote();
    const isEmoji = quote.sprite.length <= 4; 
    const spriteContainer = document.getElementById('quote-sprite-container');
    const spriteImg = document.getElementById('quote-sprite');
    const textEl = document.getElementById('quote-text');
    const charEl = document.getElementById('quote-character');
    const gameEl = document.getElementById('quote-game');

    if (!spriteContainer || !spriteImg || !textEl || !charEl || !gameEl) return;

    if (isEmoji) {
        spriteImg.style.display = 'none';
        spriteContainer.innerHTML = `<span class="text-2xl">${quote.sprite}</span>`;
    } else {
        spriteImg.style.display = 'block';
        spriteImg.src = quote.sprite;
        spriteImg.alt = quote.character;
    }

    textEl.textContent = `"${quote.text}"`;
    charEl.textContent = quote.character;
    gameEl.textContent = quote.game;

    quoteBar.classList.remove('hidden');
    void quoteBar.offsetWidth; 
    quoteBar.style.opacity = '1';
    quoteBar.style.transform = 'translateY(0)';
};

// Initialize the app
async function initializeApp() {
    console.log('🚀 Initializing ROM app...');
    try {
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
            await initNotifications();
            renderRandomQuote();
        });
        
        await updateAuthUI();
        window.addEventListener('hashchange', handleHashChange);
        await handleHashChange();
        console.log('✅ App initialized successfully');
        window.rom.authSubscription = subscription;
    } catch (error) {
        console.error('❌ App initialization failed:', error);
        showError('App Initialization Error', error.message);
    }
}
async function updateNotificationUI() {
    const container = document.getElementById('nav-notification-container');
    const badge = document.getElementById('notif-badge');
    const dropdown = document.getElementById('notif-dropdown');
    const list = document.getElementById('notif-list');
    const user = window.rom?.currentUser;

    if (!user || !container) {
        if(container) container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');

    // 1. Load Count
    const { fetchUnreadCount } = await import('./lib/notifications.js');
    const count = await fetchUnreadCount(user.id);
    
    if (count > 0) {
        badge.textContent = count > 9 ? '9+' : count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }

    // 2. Handle Dropdown Toggle
    const btn = document.getElementById('btn-notifications');
    btn.onclick = async (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
        if (!dropdown.classList.contains('hidden')) {
            // Load recent items when opened
            const { fetchRecentAlerts, renderNotificationItem } = await import('./lib/notifications.js');
            const alerts = await fetchRecentAlerts(user.id);
            list.innerHTML = alerts.length ? alerts.map(renderNotificationItem).join('') : '<div class="p-4 text-center text-gray-500 text-sm">No notifications</div>';
        }
    };

    // 3. Mark All Read
    const markBtn = document.getElementById('mark-read-btn');
    markBtn.onclick = async (e) => {
        e.preventDefault();
        const { markAllAsRead } = await import('./lib/notifications.js');
        await markAllAsRead(user.id);
        dropdown.classList.add('hidden');
        updateNotificationUI(); // Refresh badge
    };

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) dropdown.classList.add('hidden');
    });
}
// Handle hash changes
async function handleHashChange() {
    const hash = window.location.hash.slice(2) || 'home';
    console.log('Hash changed to:', hash);

    // Check for game detail page
    if (hash.startsWith('game/')) {
        const identifier = hash.split('/')[1];
        console.log('Loading game detail for:', identifier);
        await loadGameDetail(identifier);
        return;
    }

    // Check for guide detail page
    if (hash.startsWith('guide/')) {
        const slug = hash.split('/')[1];
        console.log('Loading guide detail for:', slug);
        await loadGuideDetail(slug);
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
    if (hash === 'profile' || hash.startsWith('profile/')) {
        const parts = hash.split('/');
        const providedSlug = parts[1];
        if (!providedSlug) {
            const user = window.rom?.currentUser;
            if (!user) {
                window.location.hash = '#/auth';
                return;
            }
            try {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('username')
                    .eq('id', user.id)
                    .single();
                if (profileData && profileData.username) {
                    window.location.hash = `#/profile/${profileData.username}`;
                    return;
                } else {
                    window.location.hash = '#/home';
                    return;
                }
            } catch (err) {
                console.error('Error fetching profile for redirect:', err);
                window.location.hash = '#/home';
                return;
            }
        }
        await loadProfileDetail(providedSlug);
        return;
    }

    // Heartbeat Logic
    let heartbeatInterval;
    async function startHeartbeat() {
        if (!rom.currentUser) return;
        const updatePresence = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                await supabase.from('profiles').update({ last_seen: new Date().toISOString(), is_online: true }).eq('id', user.id);
            } catch (err) { console.error('Heartbeat failed:', err); }
        };
        await updatePresence();
        heartbeatInterval = setInterval(updatePresence, 30000);
    }
    function stopHeartbeat() { if (heartbeatInterval) clearInterval(heartbeatInterval); }
    
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') { rom.currentUser = session.user; startHeartbeat(); } 
        else if (event === 'SIGNED_OUT') { rom.currentUser = null; stopHeartbeat(); }
    });

    cleanupGameBackgrounds();
    await loadModule(hash);
    renderRandomQuote(); 
}

// Load module function
async function loadModule(moduleName) {
    try {
        console.log(`📦 Loading module: ${moduleName}`);
        const appContent = document.getElementById('app-content');
        if (appContent) {
            appContent.innerHTML = '';
            const loadingHTML = fallbackContent[moduleName] || fallbackContent['home'];
            appContent.innerHTML = loadingHTML;
        }

        try {
            const response = await fetch(`./modules/${moduleName}/${moduleName}.html`);
            if (response.ok) {
                const html = await response.text();
                if (appContent) appContent.innerHTML = html;
            }
        } catch (fetchError) { console.log(`Using fallback for ${moduleName}`); }

        try {
            if (modules[moduleName]) {
                const module = await modules[moduleName]();
                const rom = {
                    supabase: window.supabase,
                    currentUser: window.rom?.currentUser || null,
                    loadModule: loadModule,
                    navigateTo: function(module) { window.location.hash = `#/${module}`; }
                };

                if (module.default && typeof module.default === 'function') await module.default(rom);
                else if (module.initModule) await module.initModule(rom);
                else if (module.default && module.default.initModule) await module.default.initModule(rom);
                else if (module.initAuthModule) await module.initAuthModule(rom);
                else if (module.init) await module.init(rom);
                else if (typeof module === 'function') await module(rom);

                currentModule = module;
                console.log(`✅ Module ${moduleName} initialized`);
            }
        } catch (moduleError) { console.log(`Module JS not loaded for ${moduleName}:`, moduleError); }
    } catch (error) {
        console.error(`❌ Error loading module ${moduleName}:`, error);
        showError('Error loading module', error.message);
    }
}

async function loadGameDetail(identifier) {
    const appContent = document.getElementById('app-content');
    if (!appContent) return;
    cleanupGameBackgrounds();
    appContent.innerHTML = `
        <div id="game-loading" class="text-center py-16">
            <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
            <p class="text-gray-400 mt-4">Loading game details...</p>
        </div>
        <div id="game-content" class="hidden"></div>
        <div id="game-error" class="hidden text-center py-16">
            <div class="text-5xl mb-4">❌</div>
            <h3 class="text-2xl font-bold text-red-400 mb-2">Game Not Found</h3>
            <p class="text-gray-300 mb-6">The game you're looking for doesn't exist or has been removed.</p>
            <button onclick="window.location.hash = '#/games'" class="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg">Browse Games</button>
        </div>
    `;

    try {
        const module = await import('./modules/game-detail/game-detail.js');
        const rom = {
            supabase: window.supabase,
            currentUser: window.rom?.currentUser || null,
            loadModule: loadModule,
            navigateTo: (m) => window.location.hash = `#/${m}`
        };
        if (typeof module.default === 'function') await module.default(rom, identifier);
        else throw new Error('Module default export is not a function');
    } catch (error) {
        console.error('Failed to load game detail module:', error);
        const loadEl = document.getElementById('game-loading');
        const errEl = document.getElementById('game-error');
        if (loadEl) loadEl.classList.add('hidden');
        if (errEl) {
            errEl.classList.remove('hidden');
            errEl.innerHTML = `
                <div class="text-5xl mb-4">⚠️</div>
                <h3 class="text-2xl font-bold text-red-400 mb-2">Module Load Error</h3>
                <p class="text-gray-300 mb-4">${error.message}</p>
                <button onclick="window.location.hash='#/games'" class="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg">Browse Games</button>
            `;
        }
    }
}

// Function for guide detail page
async function loadGuideDetail(slug) {
    const appContent = document.getElementById('app-content');
    if (!appContent) return;

    appContent.innerHTML = `
        <div class="max-w-4xl mx-auto p-4">
            <div class="text-center py-16">
                <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
                <p class="text-gray-400 mt-4">Loading guide...</p>
            </div>
        </div>
    `;

    try {
        let guide = null;

        // Try fetching by Slug first
        if (slug.includes('-')) {
            const { data, error } = await supabase
                .from('guides')
                .select('*')
                .eq('slug', slug)
                .single();
            if (!error && data) guide = data;
        }

        // If not found, try fetching by ID
        if (!guide) {
            const { data, error } = await supabase
                .from('guides')
                .select('*')
                .eq('id', slug)
                .single();
            if (!error && data) guide = data;
        }

        // Final Check: Ensure it's approved
        if (!guide || !guide.is_approved) {
            appContent.innerHTML = `
                <div class="max-w-2xl mx-auto text-center py-12">
                    <div class="text-6xl mb-4">📚</div>
                    <h1 class="text-3xl font-bold text-white mb-2">Guide Not Found</h1>
                    <p class="text-gray-400 mb-6">This guide doesn't exist or hasn't been approved yet.</p>
                    <a href="#/guides" class="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg">Back to Guides</a>
                </div>
            `;
            return;
        }

        // Render the guide HTML structure
        appContent.innerHTML = `
            <div class="max-w-4xl mx-auto p-4">
                <div class="mb-6">
                    <a href="#/guides" class="text-cyan-400 hover:text-cyan-300 flex items-center gap-2">
                        ← Back to Guides
                    </a>
                </div>
                
                <article class="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-2xl">
                    <div class="bg-gradient-to-r from-cyan-900/50 to-purple-900/50 p-8 border-b border-gray-700">
                        <div class="flex justify-between items-start mb-4">
                            <span class="px-3 py-1 rounded-full text-xs font-bold ${getDifficultyColor(guide.difficulty)}">
                                ${guide.difficulty}
                            </span>
                            <span class="text-gray-400 text-sm">${new Date(guide.created_at).toLocaleDateString()}</span>
                        </div>
                        <h1 class="text-3xl md:text-4xl font-bold text-white mb-4">${escapeHtml(guide.title)}</h1>
                        
                        ${guide.video_url ? `
                            <div class="mt-6 aspect-video bg-black rounded-lg overflow-hidden border border-gray-600">
                                <iframe class="w-full h-full" src="https://www.youtube.com/embed/${extractVideoId(guide.video_url)}" frameborder="0" allowfullscreen></iframe>
                            </div>
                        ` : ''}
                    </div>

                    <div id="guide-content-body" class="p-8 prose prose-invert max-w-none text-gray-300">
                        <!-- Markdown will be rendered here by JS -->
                    </div>

                    <div class="bg-gray-900/50 p-6 border-t border-gray-700 flex justify-between items-center">
                        <div class="text-sm text-gray-400">
                            Written by <span class="text-white font-bold">Admin</span>
                        </div>
                        <button onclick="window.location.hash='#/guides'" class="text-cyan-400 hover:text-cyan-300 text-sm font-bold">
                            View All Guides →
                        </button>
                    </div>
                </article>
            </div>
        `;

        // Markdown parsing logic
        if (typeof marked !== 'undefined' && guide.content_html) {
            marked.setOptions({ breaks: true, gfm: true });
            const contentBody = document.getElementById('guide-content-body');
            if (contentBody) {
                contentBody.innerHTML = marked.parse(guide.content_html);
                
                // Apply styles to parsed elements
                const links = contentBody.querySelectorAll('a');
                links.forEach(link => {
                    link.classList.add('text-cyan-400', 'hover:text-cyan-300', 'underline', 'break-all');
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                });

                const headers = contentBody.querySelectorAll('h1, h2, h3, h4, h5, h6');
                headers.forEach(h => h.classList.add('text-white', 'font-bold', 'mt-6', 'mb-3'));
                
                const lists = contentBody.querySelectorAll('ul, ol');
                lists.forEach(l => l.classList.add('list-disc', 'list-inside', 'space-y-2', 'mb-4'));
                
                const boldText = contentBody.querySelectorAll('strong');
                boldText.forEach(b => b.classList.add('text-white', 'font-bold'));
                
                const blockquotes = contentBody.querySelectorAll('blockquote');
                blockquotes.forEach(bq => bq.classList.add('border-l-4', 'border-cyan-500', 'pl-4', 'italic', 'text-gray-400', 'my-4'));
            }
        } else {
            // Fallback if marked isn't loaded yet
            const contentBody = document.getElementById('guide-content-body');
            if (contentBody && guide.content_html) {
                contentBody.innerText = guide.content_html;
            }
        }

    } catch (err) {
        console.error('Error loading guide:', err);
        appContent.innerHTML = `<div class="text-center text-red-400 py-12">Error loading guide: ${err.message}</div>`;
    }
}

// Function for game edit pages
async function loadGameEdit(gameId) {
  const appContent = document.getElementById('app-content');
  if (!appContent) return;
  cleanupGameBackgrounds();
  appContent.innerHTML = `
    <div class="text-center p-8">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
      <p class="mt-2 text-gray-300">Loading editor...</p>
    </div>
  `;

  try {
    const { data: game, error } = await supabase.from('games').select('*').eq('id', gameId).single();
    if (error || !game) throw new Error('Game not found');

    const user = window.rom?.currentUser;
    if (!user) { window.location.hash = '#/auth'; return; }

    const adminEmails = ['retrogamemasterra@gmail.com', 'admin@retroonlinematchmaking.com'];
    const canEdit = adminEmails.includes(user.email) || game.submitted_email === user.email;
    if (!canEdit) {
      appContent.innerHTML = `<div class="max-w-md mx-auto mt-12 text-center"><div class="text-5xl mb-4">🚫</div><h2 class="text-xl font-bold text-white">Access Denied</h2><p class="text-gray-400">You don't have permission to edit this game.</p><button onclick="window.location.hash='#/games'" class="mt-4 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded">Back to Games</button></div>`;
      return;
    }

    const { default: adminModule } = await import('./modules/admin/admin.js');
    const response = await fetch('./modules/admin/admin.html');
    const html = await response.text();
    appContent.innerHTML = html;

    setTimeout(() => {
      if (typeof window.adminEditGame === 'function') window.adminEditGame(gameId);
      else appContent.innerHTML = `<div class="text-center py-12"><p class="text-red-400">Edit interface failed to load.</p></div>`;
    }, 300);

  } catch (error) {
    console.error('Error loading game edit:', error);
    appContent.innerHTML = `<div class="max-w-md mx-auto mt-12 text-center"><div class="text-5xl mb-4">⚠️</div><h2 class="text-xl font-bold text-white">Error</h2><p class="text-red-400">${error.message}</p><button onclick="window.location.hash='#/games'" class="mt-4 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded">Back to Games</button></div>`;
  }
}

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

async function initializeGameEdit(gameId) {
    const editContent = document.getElementById('edit-game-content');
    if (!editContent) return;

    try {
        const { data: game, error } = await supabase.from('games').select('*').eq('id', gameId).single();
        if (error || !game) {
            editContent.innerHTML = `<div class="text-center py-8"><div class="text-4xl mb-4">❌</div><h3 class="text-xl font-bold text-white mb-2">Game Not Found</h3><p class="text-gray-300">The game you're trying to edit doesn't exist.</p></div>`;
            return;
        }

        const user = window.rom?.currentUser;
        if (!user) {
            editContent.innerHTML = `<div class="text-center py-8"><div class="text-4xl mb-4">🔒</div><h3 class="text-xl font-bold text-white mb-2">Login Required</h3><p class="text-gray-300">Please log in to edit games.</p><button onclick="window.location.hash = '#/auth'" class="mt-4 bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded">Go to Login</button></div>`;
            return;
        }

        const adminEmails = ['retrogamemasterra@gmail.com', 'admin@retroonlinematchmaking.com'];
        const isAdmin = adminEmails.includes(user.email?.toLowerCase());
        const canEdit = isAdmin || game.submitted_email === user.email;

        if (!canEdit) {
            editContent.innerHTML = `<div class="text-center py-8"><div class="text-4xl mb-4">🚫</div><h3 class="text-xl font-bold text-white mb-2">Permission Denied</h3><p class="text-gray-300">You don't have permission to edit this game.</p></div>`;
            return;
        }

        editContent.innerHTML = createGameEditForm(game, isAdmin);
        initializeEditForm(game, isAdmin);

    } catch (error) {
        console.error('Error initializing game edit:', error);
        editContent.innerHTML = `<div class="text-center py-8"><div class="text-4xl mb-4">⚠️</div><h3 class="text-xl font-bold text-white mb-2">Error</h3><p class="text-gray-300">${error.message}</p></div>`;
    }
}

function createGameEditForm(game, isAdmin) {
    return `
        <form id="gameEditForm" class="space-y-6">
            <input type="hidden" id="gameId" value="${game.id}">
            
            <div class="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                <h2 class="text-2xl font-bold text-white mb-4">🖼️ Game Images</h2>
                <div class="mb-6">
                    <h3 class="text-lg font-bold text-cyan-300 mb-3">Cover Art</h3>
                    <div class="flex flex-col md:flex-row gap-6">
                        <div class="md:w-1/3">
                            <div class="current-image mb-4">
                                <p class="text-gray-300 mb-2">Current:</p>
                                ${game.cover_image_url ? 
                                    `<img src="${game.cover_image_url}" alt="Cover" class="w-full h-64 object-cover rounded-lg border border-gray-600" id="currentCoverImage">` :
                                    `<div class="w-full h-64 bg-gray-700 rounded-lg flex items-center justify-center"><span class="text-gray-500 text-2xl">🎮</span></div>`
                                }
                            </div>
                        </div>
                        <div class="md:w-2/3">
                            <div class="mb-4">
                                <label class="block text-gray-300 mb-2">Update Cover Image</label>
                                <input type="file" id="newCoverImage" accept="image/*" class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white">
                            </div>
                            <div id="coverPreview" class="hidden">
                                <p class="text-gray-300 mb-2">Preview:</p>
                                <img id="coverPreviewImage" class="w-32 h-32 object-cover rounded-lg border border-cyan-500">
                            </div>
                        </div>
                    </div>
                </div>
                ${isAdmin ? `
                    <div>
                        <h3 class="text-lg font-bold text-purple-300 mb-3">Screenshots</h3>
                        <div class="mb-4">
                            <div class="mb-3">
                                <label class="block text-gray-300 mb-2">Add Screenshots</label>
                                <input type="file" id="newScreenshots" accept="image/*" multiple class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white">
                            </div>
                            <div id="screenshotsContainer" class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                ${game.screenshot_urls && game.screenshot_urls.length > 0 ? 
                                    game.screenshot_urls.map((url, index) => `
                                        <div class="screenshot-item relative" data-index="${index}">
                                            <img src="${url}" alt="Screenshot ${index + 1}" class="w-full h-32 object-cover rounded-lg border border-gray-600">
                                            <button type="button" onclick="removeScreenshot('${game.id}', ${index})" class="absolute top-0 right-0 bg-red-600 text-white w-6 h-6 rounded-full text-xs">✕</button>
                                        </div>
                                    `).join('') : 
                                    '<p class="text-gray-500 col-span-4 text-center py-4">No screenshots yet</p>'
                                }
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <div class="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                <h2 class="text-2xl font-bold text-white mb-4">📝 Game Details</h2>
                <div class="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-gray-300 mb-2">Title *</label>
                        <input type="text" id="editTitle" value="${escapeHtml(game.title)}" required class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">
                    </div>
                    <div>
                        <label class="block text-gray-300 mb-2">Console *</label>
                        <input type="text" id="editConsole" value="${escapeHtml(game.console)}" required class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">
                    </div>
                </div>
                <div class="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-gray-300 mb-2">Release Year</label>
                        <input type="number" id="editYear" value="${game.year || ''}" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">
                    </div>
                    <div>
                        <label class="block text-gray-300 mb-2">Multiplayer Type</label>
                        <select id="editMultiplayerType" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">
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
                    <textarea id="editDescription" rows="6" required class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">${escapeHtml(game.description || '')}</textarea>
                </div>
                <div class="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-gray-300 mb-2">Connection Method</label>
                        <input type="text" id="editConnectionMethod" value="${escapeHtml(game.connection_method || '')}" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-gray-300 mb-2">Min Players</label>
                            <input type="number" id="editPlayersMin" value="${game.players_min || 1}" min="1" max="99" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-gray-300 mb-2">Max Players</label>
                            <input type="number" id="editPlayersMax" value="${game.players_max || 1}" min="1" max="99" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">
                        </div>
                    </div>
                </div>
                <div class="mb-4">
                    <label class="block text-gray-300 mb-2">Connection Details</label>
                    <textarea id="editConnectionDetails" rows="3" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">${escapeHtml(game.connection_details || '')}</textarea>
                </div>
                <div class="mb-4">
                    <label class="block text-gray-300 mb-2">Server Details</label>
                    <textarea id="editServerDetails" rows="3" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">${escapeHtml(game.server_details || '')}</textarea>
                </div>
                
                <!-- LINKED GUIDES SECTION (ADMIN ONLY) -->
                ${isAdmin ? `
                <div class="mt-6 pt-6 border-t border-gray-600">
                    <h3 class="text-lg font-bold text-blue-300 mb-3">📚 Linked Universal Guides</h3>
                    <div id="linked-guides-container" class="bg-gray-900 p-4 rounded border border-gray-700">
                        <p class="text-gray-400 text-sm">Loading available guides...</p>
                    </div>
                    <p class="text-xs text-gray-500 mt-2">Check boxes to link guides to this game. Changes save automatically.</p>
                </div>
                ` : ''}

                <div class="flex items-center mb-4">
                    <input type="checkbox" id="editServersAvailable" ${game.servers_available ? 'checked' : ''} class="w-4 h-4 text-cyan-500 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500">
                    <label class="ml-2 text-gray-300">Active servers available</label>
                </div>
            </div>
            
            <div class="flex justify-end gap-3">
                <button type="button" onclick="window.location.hash = '#/game/${game.slug || game.id}'" class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors">Cancel</button>
                <button type="submit" id="saveBtn" class="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg transition-colors">Save Changes</button>
            </div>
        </form>
    `;
}

// ============================================================================
// GLOBAL BACKGROUND CLEANUP
// ============================================================================
window.cleanupGameBackgrounds = function() {
    const bgElement = document.getElementById('dynamic-game-bg');
    if (bgElement) bgElement.remove();
    const overlay = document.getElementById('bg-overlay');
    if (overlay) overlay.remove();
    document.body.style.background = '';
    document.body.style.overflow = '';
    console.log('🧹 Game backgrounds cleaned up');
};

function initializeEditForm(game, isAdmin) {
    const form = document.getElementById('gameEditForm');
    if (!form) return;

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

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveGameEdit(game);
    });

    // Initialize Guide Linker if Admin
    if (isAdmin) {
        setupGameGuidesLinker(game.id);
    }

    window.removeScreenshot = async function(gameId, index) {
        if (!confirm('Remove this screenshot?')) return;
        try {
            const { data: gameData } = await supabase.from('games').select('screenshot_urls').eq('id', gameId).single();
            if (gameData && gameData.screenshot_urls) {
                const newScreenshots = [...gameData.screenshot_urls];
                newScreenshots.splice(index, 1);
                await supabase.from('games').update({ screenshot_urls: newScreenshots }).eq('id', gameId);
                showNotification('✅ Screenshot removed!');
                const screenshotItem = document.querySelector(`.screenshot-item[data-index="${index}"]`);
                if (screenshotItem) screenshotItem.remove();
                updateScreenshotIndices();
            }
        } catch (error) {
            console.error('Error removing screenshot:', error);
            showNotification('❌ Error: ' + error.message, 'error');
        }
    };
}

// NEW: Setup Guide Linker for Admin
async function setupGameGuidesLinker(gameId) {
    const container = document.getElementById('linked-guides-container');
    if (!container) return;

    try {
        // 1. Fetch all approved guides
        const { data: guides, error: guidesError } = await supabase
            .from('guides')
            .select('id, title')
            .eq('is_approved', true)
            .order('title');

        if (guidesError) throw guidesError;

        // 2. Fetch currently linked guides for this game
        const { data: links, error: linksError } = await supabase
            .from('game_guides')
            .select('guide_id')
            .eq('game_id', gameId);

        if (linksError) throw linksError;

        const linkedGuideIds = new Set(links.map(l => l.guide_id));

        // 3. Render Checkboxes
        if (!guides || guides.length === 0) {
            container.innerHTML = `<p class="text-gray-500 italic">No approved guides available to link.</p>`;
            return;
        }

        container.innerHTML = guides.map(guide => `
            <div class="flex items-center gap-3 mb-2 p-2 hover:bg-gray-800 rounded transition">
                <input type="checkbox" 
                       id="link-guide-${guide.id}" 
                       data-guide-id="${guide.id}"
                       ${linkedGuideIds.has(guide.id) ? 'checked' : ''}
                       class="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 cursor-pointer">
                <label for="link-guide-${guide.id}" class="text-gray-300 cursor-pointer flex-1">${escapeHtml(guide.title)}</label>
                <span class="text-xs text-gray-500">${linkedGuideIds.has(guide.id) ? 'Linked' : ''}</span>
            </div>
        `).join('');

        // 4. Add Event Listeners for Auto-Save
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', async (e) => {
                const guideId = e.target.dataset.guideId;
                const isChecked = e.target.checked;
                const statusSpan = e.target.nextElementSibling.nextElementSibling;

                try {
                    if (isChecked) {
                        // Create Link
                        const { error } = await supabase.from('game_guides').insert({
                            game_id: gameId,
                            guide_id: guideId
                        });
                        if (error) throw error;
                        if (statusSpan) statusSpan.textContent = 'Linked';
                        showNotification('✅ Guide linked!');
                    } else {
                        // Remove Link
                        const { error } = await supabase.from('game_guides')
                            .delete()
                            .eq('game_id', gameId)
                            .eq('guide_id', guideId);
                        if (error) throw error;
                        if (statusSpan) statusSpan.textContent = '';
                        showNotification('🔗 Guide unlinked.');
                    }
                } catch (err) {
                    console.error('Error toggling guide link:', err);
                    showNotification('❌ Error updating link: ' + err.message, 'error');
                    // Revert checkbox on error
                    e.target.checked = !isChecked;
                }
            });
        });

    } catch (error) {
        console.error('Error loading guides for linker:', error);
        container.innerHTML = `<p class="text-red-400 text-sm">Error loading guides: ${error.message}</p>`;
    }
}

async function saveGameEdit(game) {
    const saveBtn = document.getElementById('saveBtn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    try {
        const gameId = document.getElementById('gameId').value;
        const coverInput = document.getElementById('newCoverImage');
        let coverImageUrl = game.cover_image_url;

        if (coverInput.files.length > 0) {
            const coverFile = coverInput.files[0];
            const coverResult = await uploadGameImage(coverFile, gameId, 'cover');
            if (coverResult.success) coverImageUrl = coverResult.url;
        }

        const screenshotsInput = document.getElementById('newScreenshots');
        let screenshotUrls = game.screenshot_urls || [];

        if (screenshotsInput && screenshotsInput.files.length > 0) {
            const files = Array.from(screenshotsInput.files);
            for (const file of files) {
                const screenshotResult = await uploadGameImage(file, gameId, 'screenshots');
                if (screenshotResult.success) screenshotUrls.push(screenshotResult.url);
            }
        }

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

        const { error } = await supabase.from('games').update(updates).eq('id', gameId);
        if (error) throw error;

        showNotification('✅ Game updated successfully!', 'success');
        setTimeout(() => { window.location.hash = `#/game/${game.slug || gameId}`; }, 1500);

    } catch (error) {
        console.error('Error saving game edit:', error);
        showNotification('❌ Error: ' + error.message, 'error');
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}

async function loadProfileDetail(profileId) {
    const appContent = document.getElementById('app-content');
    if (!appContent) return;
    console.log('👤 Loading profile for ID/Slug:', profileId); 
    appContent.innerHTML = `<div class="text-center p-8"><div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div><p class="mt-2 text-gray-300">Loading profile...</p></div>`;

    try {
        const response = await fetch('./modules/profile/profile.html');
        if (!response.ok) throw new Error('Failed to load profile module');
        const html = await response.text();
        appContent.innerHTML = html;

        const module = await import('./modules/profile/profile.js');
        const rom = {
            supabase: window.supabase,
            currentUser: window.rom?.currentUser || null,
            loadModule: loadModule,
            navigateTo: function(module) { window.location.hash = `#/${module}`; }
        };
        const params = { slug: profileId };

        if (module.default && typeof module.default === 'function') await module.default(rom, params);
        else if (module.initModule) await module.initModule(rom, params);
        else if (module.default && module.default.initModule) await module.default.initModule(rom, params);
        else throw new Error('Profile module export structure not recognized');
    } catch (error) {
        console.error('Error loading profile detail:', error);
        showError('Error loading profile', error.message);
    }
}

async function uploadGameImage(file, gameId, type = 'cover') {
    try {
        if (!file.type.startsWith('image/')) return { success: false, error: 'File must be an image' };
        if (file.size > 2 * 1024 * 1024) return { success: false, error: 'Image must be less than 2MB' };

        const fileExt = file.name.split('.').pop();
        const fileName = `${type === 'cover' ? 'covers' : 'screenshots'}/${gameId}/${Date.now()}.${fileExt}`;

        const { data, error } = await supabase.storage.from('game-media').upload(fileName, file, { cacheControl: '3600', upsert: true });
        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage.from('game-media').getPublicUrl(fileName);
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

// Helpers for the guide view
function getDifficultyColor(diff) {
    if (diff === 'Easy') return 'bg-green-900 text-green-300';
    if (diff === 'Hard') return 'bg-red-900 text-red-300';
    if (diff === 'Expert') return 'bg-purple-900 text-purple-300';
    return 'bg-yellow-900 text-yellow-300';
}

function extractVideoId(url) {
    if (!url) return '';
    const match = url.match(/(?:youtu\.be\/|watch\?v=|embed\/)([^&?]+)/);
    return match ? match[1] : url;
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
