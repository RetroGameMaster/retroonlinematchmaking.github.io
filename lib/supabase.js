// Supabase configuration - USING YOUR ACTUAL CREDENTIALS
const supabaseUrl = 'https://lapyxhothazalssrbimb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhcHl4aG90aGF6YWxzc3JiaW1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNjg0NDUsImV4cCI6MjA3Njk0NDQ0NX0.isfh75lAbJotctu6dkd_aAYK-2YNyYM4o-jqKFB5tVA';

console.log('🔥 Supabase configured with:', supabaseUrl);

// Initialize Supabase client
const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

// Track initialization state
let isInitializing = true;

// Auth state listener
function initAuthListener(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth event:', event, session);
        if (callback) callback(event, session);
        
        // Only update UI after initial session check
        if (event !== 'INITIAL_SESSION') {
            updateAuthUI();
        }
        
        // Store tokens for persistence if session exists
        if (session) {
            localStorage.setItem('supabase.access_token', session.access_token);
            localStorage.setItem('supabase.refresh_token', session.refresh_token);
        }
    });
}

// Set session persistence
function setSessionPersistence(persist) {
    if (persist) {
        // Use local storage for persistent sessions
        supabase.auth.setSession({
            refresh_token: localStorage.getItem('supabase.refresh_token'),
            access_token: localStorage.getItem('supabase.access_token')
        });
    }
}

// Update UI based on auth state
async function updateAuthUI() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        // Ignore initial session errors
        if (isInitializing) {
            isInitializing = false;
            if (error) {
                console.log('Initial session check (no user logged in)');
            }
        }
        
        const authButtons = document.getElementById('auth-buttons');
        
        if (!authButtons) {
            console.log('Waiting for auth buttons container...');
            return;
        }
        
        if (user) {
            console.log('User logged in:', user.email);
            authButtons.innerHTML = `
                <div class="flex items-center space-x-4">
                    <span class="text-gray-300">${user.email}</span>
                    <button id="logout-btn" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition">
                        Logout
                    </button>
                </div>
            `;
            
            // Add logout event listener
            setTimeout(() => {
                const logoutBtn = document.getElementById('logout-btn');
                if (logoutBtn) {
                    logoutBtn.addEventListener('click', async () => {
                        await supabase.auth.signOut();
                        localStorage.removeItem('supabase.refresh_token');
                        localStorage.removeItem('supabase.access_token');
                        window.location.reload();
                    });
                }
            }, 100);
            
            // Show admin link if user is admin
            await showAdminLinkIfAdmin(user);
            
        } else {
            console.log('No user logged in - showing auth buttons');
            authButtons.innerHTML = `
                <div class="flex items-center space-x-2">
                    <button id="login-btn" class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded transition">
                        Login
                    </button>
                    <button id="register-btn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition">
                        Register
                    </button>
                </div>
            `;
            
            // Add auth button listeners
            setTimeout(() => {
                const loginBtn = document.getElementById('login-btn');
                const registerBtn = document.getElementById('register-btn');
                
                if (loginBtn) {
                    loginBtn.addEventListener('click', () => {
                        window.location.hash = '#/auth';
                    });
                }
                
                if (registerBtn) {
                    registerBtn.addEventListener('click', () => {
                        window.location.hash = '#/auth';
                    });
                }
            }, 100);
        }
    } catch (error) {
        console.error('Error in updateAuthUI:', error);
    }
}

// Check if user is admin
async function showAdminLinkIfAdmin(user) {
    try {
        // Simple query - just check if user exists in admins table
        const { data: adminData, error } = await supabase
            .from('admins')
            .select('user_id')
            .eq('user_id', user.id)
            .limit(1);
        
        if (error) {
            // If we get a recursion error, disable the check temporarily
            if (error.message.includes('recursion') || error.code === '42P17') {
                console.log('RLS recursion error - checking admin status manually');
                // We'll handle this differently - maybe check a local storage flag
                // For now, just return
                return;
            }
            console.error('Error checking admin status:', error);
            return;
        }
        
        if (adminData && adminData.length > 0) {
            const adminLink = document.getElementById('admin-link');
            if (adminLink) {
                adminLink.classList.remove('hidden');
                console.log('Admin link shown for user:', user.email);
            }
        }
    } catch (error) {
        console.error('Error in showAdminLinkIfAdmin:', error);
    }
}

// Get current user
async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

// Export all functions
export {
    supabase,
    supabaseUrl,
    supabaseAnonKey,
    initAuthListener,
    updateAuthUI,
    getCurrentUser,
    showAdminLinkIfAdmin,
    setSessionPersistence
};

// Also export default
export default supabase;
