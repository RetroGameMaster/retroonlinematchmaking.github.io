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

// NEW FUNCTION: Enhanced admin check with more robust error handling
async function isAdmin() {
    try {
        const user = await getCurrentUser();
        if (!user) return false;
        
        // Check admins table first
        const { data: admin, error } = await supabase
            .from('admins')
            .select('user_id')
            .eq('user_id', user.id)
            .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Error checking admin status in isAdmin():', error);
            return false;
        }
        
        // Also check admin emails as fallback
        const adminEmails = ['retrogamemasterra@gmail.com', 'admin@retroonlinematchmaking.com'];
        if (adminEmails.includes(user.email?.toLowerCase())) {
            return true;
        }
        
        return !!admin;
    } catch (error) {
        console.error('Error in isAdmin function:', error);
        return false;
    }
}

// Get current user
async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
            console.log('No user found in getCurrentUser:', error);
            return null;
        }
        return user;
    } catch (error) {
        console.error('Error getting current user:', error);
        return null;
    }
}

// NEW FUNCTION: Get profile by ID
async function getProfileById(userId) {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) {
            // Check if it's a "no rows returned" error
            if (error.code === 'PGRST116') {
                console.log(`Profile ${userId} not found`);
                return null;
            }
            console.error('Error getting profile:', error);
            return null;
        }
        
        return profile;
    } catch (error) {
        console.error('Error getting profile:', error);
        return null;
    }
}

// NEW FUNCTION: Update profile
async function updateProfile(userId, updates) {
    try {
        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId);
        
        return { success: !error, error };
    } catch (error) {
        console.error('Error updating profile:', error);
        return { success: false, error };
    }
}

// NEW FUNCTION: Upload avatar image
async function uploadAvatar(file, userId) {
    try {
        // Validate file
        if (!file.type.startsWith('image/')) {
            return { success: false, error: 'File must be an image' };
        }
        
        if (file.size > 2 * 1024 * 1024) { // 2MB limit
            return { success: false, error: 'Image must be less than 2MB' };
        }
        
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/avatar-${Date.now()}.${fileExt}`;
        
        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('user-avatars')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: true
            });
        
        if (error) throw error;
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('user-avatars')
            .getPublicUrl(fileName);
        
        return { success: true, url: publicUrl };
        
    } catch (error) {
        console.error('Error uploading avatar:', error);
        return { success: false, error: error.message };
    }
}

// NEW FUNCTION: Upload background image
async function uploadBackground(file, userId) {
    try {
        // Validate file
        if (!file.type.startsWith('image/')) {
            return { success: false, error: 'File must be an image' };
        }
        
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            return { success: false, error: 'Image must be less than 5MB' };
        }
        
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/background-${Date.now()}.${fileExt}`;
        
        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('profile-backgrounds')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: true
            });
        
        if (error) throw error;
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('profile-backgrounds')
            .getPublicUrl(fileName);
        
        return { success: true, url: publicUrl };
        
    } catch (error) {
        console.error('Error uploading background:', error);
        return { success: false, error: error.message };
    }
}

// NEW FUNCTION: Check username availability
async function checkUsernameAvailability(username, currentUserId = null) {
    try {
        // Validate username format
        const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
        if (!usernameRegex.test(username)) {
            return { 
                available: false, 
                error: 'Username must be 3-30 characters and can only contain letters, numbers, and underscores' 
            };
        }
        
        let query = supabase
            .from('profiles')
            .select('id, username')
            .eq('username', username);
        
        // If checking for a specific user (e.g., during edit), exclude their own username
        if (currentUserId) {
            query = query.neq('id', currentUserId);
        }
        
        const { data: existingUser, error } = await query.single();
        
        if (error && error.code !== 'PGRST116') {
            console.error('Error checking username:', error);
            return { available: false, error: 'Error checking username availability' };
        }
        
        return { 
            available: !existingUser, 
            error: existingUser ? 'Username already taken' : null 
        };
        
    } catch (error) {
        console.error('Error checking username availability:', error);
        return { available: false, error: error.message };
    }
}

// NEW FUNCTION: Get user activity
async function getUserActivity(userId, limit = 20) {
    try {
        // Get recent comments
        const { data: comments } = await supabase
            .from('game_comments')
            .select(`
                *,
                game:games(title, id)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        // Get recent submissions
        const { data: submissions } = await supabase
            .from('game_submissions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        // Get approved games
        const { data: approvedGames } = await supabase
            .from('games')
            .select('*')
            .eq('submitted_by', userId)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        // Combine and format activity
        const activities = [];
        
        if (comments) {
            comments.forEach(comment => {
                activities.push({
                    type: 'comment',
                    content: comment.content,
                    game: comment.game,
                    date: comment.created_at,
                    icon: '💬'
                });
            });
        }
        
        if (submissions) {
            submissions.forEach(submission => {
                activities.push({
                    type: 'submission',
                    title: submission.title,
                    status: submission.status,
                    date: submission.created_at,
                    icon: '🎮'
                });
            });
        }
        
        if (approvedGames) {
            approvedGames.forEach(game => {
                activities.push({
                    type: 'approved_game',
                    title: game.title,
                    date: game.created_at,
                    icon: '✅'
                });
            });
        }
        
        // Sort by date (newest first)
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        return activities.slice(0, limit);
        
    } catch (error) {
        console.error('Error getting user activity:', error);
        return [];
    }
}

// NEW FUNCTION: Get user stats
async function getUserStats(userId) {
    try {
        // Get counts from different tables
        const [submissions, approvedGames, comments] = await Promise.all([
            supabase
                .from('game_submissions')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId),
            supabase
                .from('games')
                .select('*', { count: 'exact', head: true })
                .eq('submitted_by', userId),
            supabase
                .from('game_comments')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
        ]);
        
        return {
            games_submitted: submissions.count || 0,
            games_approved: approvedGames.count || 0,
            comments_made: comments.count || 0,
            playtime_hours: 0 // Could be calculated from other tables if you add gameplay tracking
        };
        
    } catch (error) {
        console.error('Error getting user stats:', error);
        return {
            games_submitted: 0,
            games_approved: 0,
            comments_made: 0,
            playtime_hours: 0
        };
    }
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
    setSessionPersistence,
    // New exports for profile system
    isAdmin,
    getProfileById,
    updateProfile,
    uploadAvatar,
    uploadBackground,
    checkUsernameAvailability,
    getUserActivity,
    getUserStats
};

// Also export default
export default supabase;
