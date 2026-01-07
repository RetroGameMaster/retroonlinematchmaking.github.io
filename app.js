// app.js - Clean version
import { supabase, initAuthListener, updateAuthUI } from './lib/supabase.js';

let currentModule = null;

const modules = {
    'home': () => import('./modules/home/home.js'),
    'games': () => import('./modules/games/games.js'),
    'auth': () => import('./modules/auth/auth.js'),
    'admin': () => import('./modules/admin/admin.js'),
    'chat': () => import('./modules/chat/chat.js'),
    'profile': () => import('./modules/profile/profile.js'),
    'game': () => import('./modules/game-detail/game-detail.js')
};

const fallbackContent = {
    'home': `<div class="text-center py-12"><h1 class="text-3xl font-bold text-cyan-400">Welcome to ROM</h1><p class="text-gray-300 mt-2">Loading...</p></div>`,
    'games': `<div class="text-center py-12"><h1 class="text-3xl font-bold text-cyan-400">🎮 Games</h1><p class="text-gray-300 mt-2">Loading games...</p></div>`,
    'auth': `<div class="text-center py-12"><h1 class="text-3xl font-bold text-cyan-400">🔐 Auth</h1><p class="text-gray-300 mt-2">Loading authentication...</p></div>`,
    'admin': `<div class="text-center py-12"><h1 class="text-3xl font-bold text-cyan-400">🛠️ Admin</h1><p class="text-gray-300 mt-2">Loading admin panel...</p></div>`,
    'chat': `<div class="text-center py-12"><h1 class="text-3xl font-bold text-cyan-400">💬 Chat</h1><p class="text-gray-300 mt-2">Loading chat...</p></div>`,
    'profile': `<div class="text-center py-12"><h1 class="text-3xl font-bold text-cyan-400">👤 Profile</h1><p class="text-gray-300 mt-2">Loading profile...</p></div>`,
    'game': `<div class="text-center py-12"><h1 class="text-3xl font-bold text-cyan-400">🎮 Game</h1><p class="text-gray-300 mt-2">Loading game details...</p></div>`
};

async function initializeApp() {
    console.log('🚀 ROM app initializing...');
    
    try {
        initAuthListener((event, session) => {
            console.log('Auth:', event);
            updateAuthUI();
        });
        
        await updateAuthUI();
        window.addEventListener('hashchange', handleHashChange);
        await handleHashChange();
        
        console.log('✅ ROM app ready');
    } catch (error) {
        console.error('❌ App init failed:', error);
        showError('Startup Error', error.message);
    }
}

async function handleHashChange() {
    const hash = window.location.hash.slice(2) || 'home';
    await loadModule(hash);
}

async function loadModule(moduleName) {
    try {
        console.log(`Loading: ${moduleName}`);
        
        if (moduleName.startsWith('game/')) {
            const gameId = moduleName.split('/')[1];
            await loadGameDetail(gameId);
            return;
        }
        
        if (moduleName === 'admin') {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                alert('Login required');
                window.location.hash = '#/auth';
                return;
            }
            
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
        
        if (modules[moduleName]) {
            const module = await modules[moduleName]();
            const appContent = document.getElementById('app-content');
            
            if (appContent) {
                appContent.innerHTML = '';
                
                let html = fallbackContent[moduleName];
                try {
                    const response = await fetch(`./modules/${moduleName}/${moduleName}.html`);
                    if (response.ok) html = await response.text();
                } catch (e) {
                    console.log(`Using fallback for ${moduleName}`);
                }
                
                appContent.innerHTML = html;
                
                if (module.initModule) {
                    await module.initModule();
                } else if (module.default?.initModule) {
                    await module.default.initModule();
                } else if (module.init) {
                    await module.init();
                }
                
                currentModule = module;
            }
            
            console.log(`✅ Loaded: ${moduleName}`);
        } else {
            window.location.hash = '#/home';
        }
    } catch (error) {
        console.error(`Error loading ${moduleName}:`, error);
        showError('Load Error', error.message);
    }
}

async function loadGameDetail(gameId) {
    const appContent = document.getElementById('app-content');
    if (!appContent) return;
    
    try {
        const response = await fetch('./modules/game-detail/game-detail.html');
        const html = await response.text();
        appContent.innerHTML = html;
        
        const module = await import('./modules/game-detail/game-detail.js');
        if (module.initModule) await module.initModule();
        
        console.log(`✅ Game detail: ${gameId}`);
    } catch (error) {
        console.error('Game detail error:', error);
        showError('Game Error', error.message);
    }
}

function showError(title, message) {
    const appContent = document.getElementById('app-content');
    if (appContent) {
        appContent.innerHTML = `
            <div class="p-8 text-center">
                <h2 class="text-2xl font-bold text-red-500">${title}</h2>
                <p class="text-gray-300 mt-2">${message}</p>
                <button onclick="window.location.hash = '#/home'" 
                        class="mt-4 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded">
                    Go Home
                </button>
            </div>
        `;
    }
}

window.loadModule = loadModule;
window.supabase = supabase;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
