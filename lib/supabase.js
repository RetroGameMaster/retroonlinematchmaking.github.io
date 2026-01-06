export const supabaseUrl = 'https://lapyxhothazalssrbimb.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhcHl4aG90aGF6YWxzc3JiaW1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNjg0NDUsImV4cCI6MjA3Njk0NDQ0NX0.isfh75lAbJotctu6dkd_aAYK-2YNyYM4o-jqKFB5tVA';

// Initialize Supabase client
export const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

// Auth state listener
export function initAuthListener(callback) {
    supabase.auth.onAuthStateChange((event, session) => {
        if (callback) callback(event, session);
        updateAuthUI();
    });
}

// Update UI based on auth state
export async function updateAuthUI() {
    const { data: { user } } = await supabase.auth.getUser();
    const authButtons = document.getElementById('auth-buttons');
    
    if (!authButtons) return;
    
    if (user) {
        authButtons.innerHTML = `
            <span class="text-gray-300 mr-4">${user.email}</span>
            <button id="logout-btn" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">
                Logout
            </button>
        `;
        
        // Add logout event listener
        document.getElementById('logout-btn').addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.reload();
        });
        
        // Show admin link if user is admin
        showAdminLinkIfAdmin(user);
    } else {
        authButtons.innerHTML = `
            <button id="login-btn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mr-2">
                Login
            </button>
            <button id="register-btn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                Register
            </button>
        `;
    }
}

// Check if user is admin
async function showAdminLinkIfAdmin(user) {
    // Check user metadata or a separate admins table
    const { data: adminData } = await supabase
        .from('admins')
        .select('*')
        .eq('user_id', user.id)
        .single();
    
    if (adminData) {
        const adminLink = document.getElementById('admin-link');
        if (adminLink) {
            adminLink.classList.remove('hidden');
        }
    }
}

// Get current user
export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}
