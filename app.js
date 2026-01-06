// Remove the import for initSupabase and use the new initialization
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

// Initialize Supabase and auth listener
async function initializeApp() {
    console.log('Initializing ROM app...');
    
    // Initialize auth listener
    initAuthListener((event, session) => {
        console.log('Auth state changed:', event, session);
        updateAuthUI();
        
        // Refresh current module when auth state changes
        if (currentModule && currentModule.reload) {
            currentModule.reload();
        }
    });
    
    // Update UI initially
    await updateAuthUI();
    
    // Handle hash changes
    window.addEventListener('hashchange', handleHashChange);
    
    // Load initial module
    await handleHashChange();
    
    console.log('App initialized successfully');
}

// Handle hash changes
async function handleHashChange() {
    const hash = window.location.hash.slice(2) || 'home';
    await loadModule(hash);
}

// Load module function
async function loadModule(moduleName) {
    try {
        // Don't load admin module for non-admin users
        if (moduleName === 'admin') {
            const user = await supabase.auth.getUser();
            
            if (!user.data.user) {
                window.location.hash = '#/auth';
                return;
            }
            
            // Check admin status
            const { data: adminData, error } = await supabase
                .from('admins')
                .select('*')
                .eq('user_id', user.data.user.id)
                .single();
            
            if (error || !adminData) {
                alert('Admin access required');
                window.location.hash = '#/';
                return;
            }
        }
        
        // Load the module
        if (modules[moduleName]) {
            const module = await modules[moduleName]();
            
            // Clear current content
            document.getElementById('app-content').innerHTML = '';
            
            // Load module HTML
            const response = await fetch(`./modules/${moduleName}/${moduleName}.html`);
            if (!response.ok) {
                throw new Error(`Failed to load ${moduleName} module`);
            }
            
            const html = await response.text();
            document.getElementById('app-content').innerHTML = html;
            
            // Initialize module
            if (module.initModule) {
                await module.initModule();
            } else if (module.default && module.default.initModule) {
                await module.default.initModule();
            } else if (module.initAuthModule) {
                await module.initAuthModule();
            }
            
            currentModule = module;
        } else {
            console.error(`Module ${moduleName} not found`);
            window.location.hash = '#/home';
        }
    } catch (error) {
        console.error(`Error loading module ${moduleName}:`, error);
        document.getElementById('app-content').innerHTML = `
            <div class="p-8">
                <h2 class="text-2xl font-bold text-red-500">Error loading module</h2>
                <p class="text-gray-300">${error.message}</p>
                <button onclick="window.location.hash = '#/home'" 
                        class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
                    Go Home
                </button>
            </div>
        `;
    }
}

// Add emergency debug function
window.debugLogin = async () => {
    console.log('Debug login triggered');
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: 'test@example.com',
            password: 'password123'
        });
        
        if (error) throw error;
        console.log('Debug login successful:', data);
        alert('Debug login successful!');
    } catch (error) {
        console.error('Debug login failed:', error);
        alert('Debug login failed: ' + error.message);
    }
};

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);
