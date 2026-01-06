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
        
        // Add emergency debug button if not logged in
        addEmergencyDebug();
        
    } catch (error) {
        console.error('❌ App initialization failed:', error);
        document.getElementById('app-content').innerHTML = `
            <div class="p-8">
                <h2 class="text-2xl font-bold text-red-500">App Initialization Error</h2>
                <p class="text-gray-300">${error.message}</p>
                <button onclick="window.location.reload()" 
                        class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
                    Reload App
                </button>
            </div>
        `;
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
        
        // Don't load admin module for non-admin users
        if (moduleName === 'admin') {
            const { data: { user }, error } = await supabase.auth.getUser();
            
            if (error || !user) {
                alert('Please login first');
                window.location.hash = '#/auth';
                return;
            }
            
            // Check admin status
            const { data: adminData, error: adminError } = await supabase
                .from('admins')
                .select('*')
                .eq('user_id', user.id)
                .single();
            
            if (adminError || !adminData) {
                alert('Admin access required');
                window.location.hash = '#/';
                return;
            }
        }
        
        // Load the module
        if (modules[moduleName]) {
            const module = await modules[moduleName]();
            
            // Clear current content
            const appContent = document.getElementById('app-content');
            if (appContent) {
                appContent.innerHTML = '';
            }
            
            // Load module HTML
            const response = await fetch(`./modules/${moduleName}/${moduleName}.html`);
            if (!response.ok) {
                throw new Error(`Failed to load ${moduleName} module HTML`);
            }
            
            const html = await response.text();
            if (appContent) {
                appContent.innerHTML = html;
            }
            
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
            console.log(`✅ Module ${moduleName} loaded successfully`);
        } else {
            console.error(`Module ${moduleName} not found`);
            window.location.hash = '#/home';
        }
    } catch (error) {
        console.error(`❌ Error loading module ${moduleName}:`, error);
        const appContent = document.getElementById('app-content');
        if (appContent) {
            appContent.innerHTML = `
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
}

// Add emergency debug functionality
function addEmergencyDebug() {
    setTimeout(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            // Add debug button to nav
            const nav = document.querySelector('nav');
            if (nav) {
                const debugBtn = document.createElement('button');
                debugBtn.className = 'bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded ml-4';
                debugBtn.textContent = '🔥 DEBUG Login';
                debugBtn.onclick = async () => {
                    console.log('🔥 DEBUG: Attempting emergency login...');
                    try {
                        // Try to sign in with a test user or create one
                        const { data, error } = await supabase.auth.signInWithPassword({
                            email: 'test@example.com',
                            password: 'testpassword123'
                        });
                        
                        if (error) {
                            // Try to sign up if user doesn't exist
                            const { data: signupData, error: signupError } = await supabase.auth.signUp({
                                email: 'test@example.com',
                                password: 'testpassword123'
                            });
                            
                            if (signupError) throw signupError;
                            alert('Debug user created! Please check email to confirm.');
                        } else {
                            alert('Debug login successful!');
                            window.location.reload();
                        }
                    } catch (error) {
                        console.error('Debug login failed:', error);
                        alert('Debug login failed: ' + error.message);
                    }
                };
                nav.appendChild(debugBtn);
            }
        }
    }, 2000);
}

// Make loadModule available globally for debugging
window.loadModule = loadModule;

// Initialize the app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
