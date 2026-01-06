// Supabase configuration - USING YOUR ACTUAL CREDENTIALS
const supabaseUrl = 'https://lapyxhothazalssrbimb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhcHl4aG90aGF6YWxzc3JiaW1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNjg0NDUsImV4cCI6MjA3Njk0NDQ0NX0.isfh75lAbJotctu6dkd_aAYK-2YNyYM4o-jqKFB5tVA';

console.log('🔥 Supabase configured with:', supabaseUrl);

// Initialize Supabase client
const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

// Auth state listener
function initAuthListener(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth event:', event, session);
        if (callback) callback(event, session);
        updateAuthUI();
    });
}

// Update UI based on auth state
async function updateAuthUI() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
            console.error('Error getting user:', error);
        }
        
        const authButtons = document.getElementById('auth-buttons');
        
        if (!authButtons) {
            console.warn('Auth buttons container not found');
            return;
        }
        
        if (user) {
            authButtons.innerHTML = `
                <span class="text-gray-300 mr-4">${user.email || 'User'}</span>
                <button id="logout-btn" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">
                    Logout
                </button>
            `;
            
            // Add logout event listener
            setTimeout(() => {
                const logoutBtn = document.getElementById('logout-btn');
                if (logoutBtn) {
                    logoutBtn.addEventListener('click', async () => {
                        await supabase.auth.signOut();
                        window.location.reload();
                    });
                }
            }, 100);
            
            // Show admin link if user is admin
            await showAdminLinkIfAdmin(user);
        } else {
            authButtons.innerHTML = `
                <button id="login-btn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mr-2">
                    Login
                </button>
                <button id="register-btn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                    Register
                </button>
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
        const { data: adminData, error } = await supabase
            .from('admins')
            .select('*')
            .eq('user_id', user.id)
            .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Error checking admin status:', error);
            return;
        }
        
        if (adminData) {
            const adminLink = document.getElementById('admin-link');
            if (adminLink) {
                adminLink.classList.remove('hidden');
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
    showAdminLinkIfAdmin
};

// Also export default
export default supabase;
