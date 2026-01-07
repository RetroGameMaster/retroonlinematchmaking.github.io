// modules/profile/profile.js
import { supabase, getCurrentUser, isAdmin } from '../../lib/supabase.js';

let currentProfile = null;
let isOwnProfile = false;
let currentUser = null;

export function initModule() {
    console.log('👤 Profile module initialized with customization');
    loadUserProfile();
}

async function loadUserProfile() {
    currentUser = await getCurrentUser();
    
    if (!currentUser) {
        window.location.hash = '#/auth';
        return;
    }
    
    // Get profile ID from URL or use current user
    const hash = window.location.hash;
    let profileId = currentUser.id;
    
    // Check if viewing another profile (#/profile/user-id)
    if (hash.includes('/profile/')) {
        const parts = hash.split('/');
        if (parts.length > 2) {
            profileId = parts[2];
        }
    }
    
    isOwnProfile = currentUser.id === profileId;
    
    await loadProfileData(profileId);
    setupEventListeners();
}

async function loadProfileData(profileId) {
    try {
        // Get profile with all data
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', profileId)
            .single();
        
        if (error) {
            // Try to create profile if it doesn't exist
            if (error.code === 'PGRST116') {
                await createProfile(profileId);
                return;
            }
            throw error;
        }
        
        currentProfile = profile;
        console.log('Profile loaded:', profile);
        
        // Update profile display
        updateProfileDisplay(profile);
        
        // Load user stats
        await loadUserStats(profileId);
        
        // Load activity
        await loadUserActivity(profileId);
        
        // Apply custom background if set
        if (profile.custom_background) {
            applyCustomBackground(profile.custom_background);
        }
        
    } catch (error) {
        console.error('Error loading profile:', error);
        showErrorState();
    }
}

async function createProfile(userId) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
            .from('profiles')
            .insert({
                id: userId,
                email: user.email,
                username: user.email.split('@')[0],
                created_at: new Date().toISOString(),
                bio: '',
                avatar_url: '',
                social_links: { discord: '', twitter: '', twitch: '' },
                custom_background: {
                    type: 'color',
                    value: '#1f2937',
                    image_url: '',
                    position: 'center',
                    size: 'cover',
                    blur: '0',
                    opacity: '1'
                },
                favorite_console: '',
                preferences: { show_email: false, show_activity: true },
                stats: { games_submitted: 0, games_approved: 0, comments_made: 0, playtime_hours: 0 }
            });
        
        if (error) throw error;
        
        // Reload profile
        await loadProfileData(userId);
        
    } catch (error) {
        console.error('Error creating profile:', error);
    }
}

function updateProfileDisplay(profile) {
    const appContent = document.getElementById('app-content');
    
    // Get first letter for avatar fallback
    const firstLetter = (profile.username || profile.email).charAt(0).toUpperCase();
    
    // Format member since date
    const memberSince = profile.created_at 
        ? new Date(profile.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
        : 'Recent';
    
    // Check if user is admin
    const adminCheck = isAdmin() || profile.role === 'admin';
    
    appContent.innerHTML = `
        <div class="max-w-6xl mx-auto">
            <!-- Custom Background Notice -->
            ${isOwnProfile && currentProfile?.custom_background?.type === 'image' ? `
                <div class="mb-4 p-3 bg-gray-800 border border-cyan-500 rounded-lg">
                    <p class="text-cyan-300 text-sm">✨ Your custom Myspace-style background is active!</p>
                </div>
            ` : ''}
            
            <!-- Profile Header with Background -->
            <div class="relative overflow-hidden rounded-lg mb-8 border-2 border-cyan-500">
                <!-- Custom Background Area -->
                <div id="profile-background" class="absolute inset-0 -z-10"></div>
                
                <!-- Overlay for readability -->
                <div class="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/70 to-transparent -z-10"></div>
                
                <!-- Profile Content -->
                <div class="relative p-8">
                    <div class="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
                        <!-- Avatar -->
                        <div class="relative">
                            ${profile.avatar_url ? `
                                <img src="${profile.avatar_url}" 
                                     alt="${profile.username || 'User'} avatar"
                                     class="w-32 h-32 rounded-full border-4 border-white/50 object-cover shadow-2xl">
                            ` : `
                                <div class="w-32 h-32 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-full flex items-center justify-center text-5xl font-bold shadow-2xl border-4 border-white/50">
                                    <span>${firstLetter}</span>
                                </div>
                            `}
                            
                            ${isOwnProfile ? `
                                <button id="edit-avatar-btn" 
                                        class="absolute bottom-0 right-0 bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-full border border-cyan-500 shadow-lg">
                                    ✏️
                                </button>
                            ` : ''}
                        </div>

                        <!-- User Info -->
                        <div class="flex-1 text-center md:text-left">
                            <h1 id="profile-username" class="text-4xl font-bold text-white mb-2">
                                ${profile.username || profile.email.split('@')[0]}
                                ${isOwnProfile ? `
                                    <button id="edit-username-btn" 
                                            class="ml-2 text-sm bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded">
                                        ✏️ Change
                                    </button>
                                ` : ''}
                            </h1>
                            <p id="profile-email" class="text-gray-300 mb-4">
                                ${profile.email}
                            </p>
                            <p id="profile-member-since" class="text-gray-400 text-sm mb-6">
                                Member since: ${memberSince}
                            </p>

                            ${profile.bio ? `
                                <div class="mb-6 max-w-2xl">
                                    <p class="text-gray-200 text-lg">${profile.bio}</p>
                                </div>
                            ` : ''}

                            <div class="flex flex-wrap gap-2 mb-4">
                                <span class="bg-cyan-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                                    🔥 Active User
                                </span>
                                ${adminCheck ? `
                                    <span class="bg-purple-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                                        👑 Admin
                                    </span>
                                ` : ''}
                                <span class="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                                    ✓ Verified
                                </span>
                                ${profile.favorite_console ? `
                                    <span class="bg-yellow-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                                        🎮 ${profile.favorite_console}
                                    </span>
                                ` : ''}
                            </div>
                            
                            <!-- Social Links -->
                            ${profile.social_links && (profile.social_links.discord || profile.social_links.twitter || profile.social_links.twitch) ? `
                                <div class="flex flex-wrap gap-2 mt-3">
                                    ${profile.social_links.discord ? `
                                        <span class="bg-indigo-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1">
                                            <i class="fab fa-discord"></i> ${profile.social_links.discord}
                                        </span>
                                    ` : ''}
                                    ${profile.social_links.twitter ? `
                                        <a href="https://twitter.com/${profile.social_links.twitter}" 
                                           target="_blank"
                                           class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1">
                                            <i class="fab fa-twitter"></i> @${profile.social_links.twitter}
                                        </a>
                                    ` : ''}
                                    ${profile.social_links.twitch ? `
                                        <a href="https://twitch.tv/${profile.social_links.twitch}" 
                                           target="_blank"
                                           class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1">
                                            <i class="fab fa-twitch"></i> ${profile.social_links.twitch}
                                        </a>
                                    ` : ''}
                                </div>
                            ` : ''}
                        </div>

                        <!-- Actions -->
                        <div class="flex flex-col space-y-3">
                            ${isOwnProfile ? `
                                <button id="edit-profile-btn" 
                                        class="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2">
                                    ✏️ Edit Profile
                                </button>
                                <button id="customize-background-btn"
                                        class="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2">
                                    🎨 Custom Background
                                </button>
                                <button id="view-friends-btn"
                                        class="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2">
                                    👥 View Friends
                                </button>
                            ` : `
                                <button id="add-friend-btn" 
                                        class="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2">
                                    👥 Add Friend
                                </button>
                                <button id="message-btn" 
                                        class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2">
                                    💬 Message
                                </button>
                            `}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Stats Grid -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                <div class="bg-gray-800 p-6 rounded-lg text-center border border-green-500 shadow-lg">
                    <div class="text-3xl font-bold text-green-400 mb-2" id="games-submitted">0</div>
                    <div class="text-gray-300">Games Submitted</div>
                </div>
                <div class="bg-gray-800 p-6 rounded-lg text-center border border-cyan-500 shadow-lg">
                    <div class="text-3xl font-bold text-cyan-400 mb-2" id="games-approved">0</div>
                    <div class="text-gray-300">Games Approved</div>
                </div>
                <div class="bg-gray-800 p-6 rounded-lg text-center border border-purple-500 shadow-lg">
                    <div class="text-3xl font-bold text-purple-400 mb-2" id="comments-made">0</div>
                    <div class="text-gray-300">Comments Made</div>
                </div>
                <div class="bg-gray-800 p-6 rounded-lg text-center border border-yellow-500 shadow-lg">
                    <div class="text-3xl font-bold text-yellow-400 mb-2" id="playtime-hours">0</div>
                    <div class="text-gray-300">Playtime Hours</div>
                </div>
            </div>

            <!-- Main Content Tabs -->
            <div class="mb-6">
                <div class="flex flex-wrap border-b border-gray-700">
                    <button class="profile-tab active px-6 py-3 text-cyan-300 font-semibold border-b-2 border-cyan-500" data-tab="activity">
                        📊 Activity
                    </button>
                    <button class="profile-tab px-6 py-3 text-gray-400 font-semibold" data-tab="games">
                        🎮 My Games
                    </button>
                    <button class="profile-tab px-6 py-3 text-gray-400 font-semibold" data-tab="friends">
                        👥 Friends
                    </button>
                    ${isOwnProfile ? `
                        <button class="profile-tab px-6 py-3 text-gray-400 font-semibold" data-tab="backgrounds">
                            🎨 Backgrounds
                        </button>
                        <button class="profile-tab px-6 py-3 text-gray-400 font-semibold" data-tab="settings">
                            ⚙️ Settings
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- Tab Content Container -->
            <div id="tab-content-container" class="min-h-[400px]">
                <!-- Activity Feed (Default) -->
                <div id="activity-feed" class="space-y-4">
                    <div class="text-center py-8">
                        <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
                        <p class="text-gray-400 mt-2">Loading your activity...</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Edit Profile Modal -->
        <div id="edit-profile-modal" class="hidden fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div class="bg-gray-800 rounded-lg max-w-2xl w-full border border-cyan-500 max-h-[90vh] overflow-y-auto">
                <div class="p-6">
                    <h3 class="text-2xl font-bold text-white mb-4">✏️ Edit Profile</h3>
                    <form id="profile-edit-form" class="space-y-4">
                        <!-- Form will be loaded dynamically -->
                    </form>
                </div>
            </div>
        </div>

        <!-- Username Change Modal -->
        <div id="username-modal" class="hidden fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div class="bg-gray-800 rounded-lg max-w-md w-full border border-purple-500">
                <div class="p-6">
                    <h3 class="text-xl font-bold text-white mb-4">🆔 Change Username</h3>
                    <form id="username-change-form" class="space-y-4">
                        <div>
                            <label class="block text-gray-300 mb-2">New Username</label>
                            <input type="text" 
                                   id="new-username" 
                                   class="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                                   placeholder="Enter new username"
                                   maxlength="30">
                            <p class="text-sm text-gray-400 mt-1">3-30 characters. Letters, numbers, and underscores only.</p>
                            <p id="username-availability" class="text-sm mt-1 hidden"></p>
                        </div>
                        
                        <div class="flex space-x-3 pt-4">
                            <button type="submit" 
                                    class="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded font-semibold">
                                Change Username
                            </button>
                            <button type="button" onclick="closeUsernameModal()" 
                                    class="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <!-- Customize Background Modal -->
        <div id="background-modal" class="hidden fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div class="bg-gray-800 rounded-lg max-w-4xl w-full border border-purple-500 max-h-[90vh] overflow-y-auto">
                <div class="p-6">
                    <h3 class="text-2xl font-bold text-white mb-4">🎨 Customize Your Profile Background</h3>
                    <div id="background-customizer">
                        <!-- Background customizer will be loaded here -->
                    </div>
                </div>
            </div>
        </div>
    `;

    // Setup tab switching
    setupTabs();
    // Apply background if exists
    if (currentProfile?.custom_background) {
        applyCustomBackground(currentProfile.custom_background);
    }
}

// In your profile.js, replace the applyCustomBackground function with this:

function applyCustomBackground(background) {
    const bgElement = document.getElementById('profile-background');
    if (!bgElement || !background) return;

    console.log('Applying background:', background);

    try {
        // Clear previous background
        bgElement.style.background = '';
        bgElement.style.backgroundImage = '';
        bgElement.style.filter = '';
        bgElement.style.opacity = '';
        
        // Set default positioning
        bgElement.style.backgroundPosition = 'center';
        bgElement.style.backgroundSize = 'cover';
        bgElement.style.backgroundRepeat = 'no-repeat';
        
        if (background.type === 'image' && background.image_url) {
            // Check if it's a blob URL (starts with blob:)
            if (background.image_url.startsWith('blob:')) {
                console.log('Blob URL detected - this will not persist on refresh');
                // For blob URLs, we need to check if they're still valid
                // They won't persist on refresh, so we should fall back
                fetch(background.image_url)
                    .then(response => {
                        if (!response.ok) throw new Error('Blob URL invalid');
                        // Blob URL is still valid
                        bgElement.style.backgroundImage = `url('${background.image_url}')`;
                        if (background.position) {
                            bgElement.style.backgroundPosition = background.position;
                        }
                        if (background.size) {
                            bgElement.style.backgroundSize = background.size;
                        }
                    })
                    .catch(error => {
                        console.log('Blob URL no longer valid, using fallback');
                        // Use a solid color fallback
                        bgElement.style.background = background.value || '#1f2937';
                    });
            } else {
                // Regular URL - should persist
                bgElement.style.backgroundImage = `url('${background.image_url}')`;
                if (background.position) {
                    bgElement.style.backgroundPosition = background.position;
                }
                if (background.size) {
                    bgElement.style.backgroundSize = background.size;
                }
            }
        } else if (background.type === 'color' && background.value) {
            bgElement.style.background = background.value;
        } else if (background.type === 'gradient' && background.value) {
            bgElement.style.background = background.value;
        } else {
            // Default fallback
            bgElement.style.background = '#1f2937';
        }
        
        // Apply effects
        if (background.blur && background.blur !== '0') {
            bgElement.style.filter = `blur(${background.blur}px)`;
        }
        
        if (background.opacity && background.opacity !== '1') {
            bgElement.style.opacity = background.opacity;
        }
    } catch (error) {
        console.error('Error applying background:', error);
        // Fallback to default
        bgElement.style.background = '#1f2937';
    }
}

async function loadUserStats(userId) {
    try {
        // Get user's game submissions
        const { count: submittedCount } = await supabase
            .from('game_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        // Get approved games count
        const { count: approvedCount } = await supabase
            .from('games')
            .select('*', { count: 'exact', head: true })
            .eq('submitted_by', userId);

        // Get comments count
        const { count: commentsCount } = await supabase
            .from('game_comments')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        // Update stats display
        if (document.getElementById('games-submitted')) {
            document.getElementById('games-submitted').textContent = submittedCount || 0;
        }
        if (document.getElementById('games-approved')) {
            document.getElementById('games-approved').textContent = approvedCount || 0;
        }
        if (document.getElementById('comments-made')) {
            document.getElementById('comments-made').textContent = commentsCount || 0;
        }

        // Update stats in database
        await updateProfileStats(userId, {
            games_submitted: submittedCount || 0,
            games_approved: approvedCount || 0,
            comments_made: commentsCount || 0,
            playtime_hours: currentProfile?.stats?.playtime_hours || 0
        });

    } catch (error) {
        console.error('Error loading user stats:', error);
    }
}

async function updateProfileStats(userId, stats) {
    try {
        await supabase
            .from('profiles')
            .update({ stats })
            .eq('id', userId);
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

async function loadUserActivity(userId) {
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
            .limit(5);

        // Get recent game submissions
        const { data: submissions } = await supabase
            .from('game_submissions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        // Get approved games
        const { data: approvedGames } = await supabase
            .from('games')
            .select('*')
            .eq('submitted_by', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        // Combine and sort activity
        let activities = [];

        if (comments) {
            activities = activities.concat(comments.map(comment => ({
                type: 'comment',
                content: comment.content,
                game: comment.game,
                date: comment.created_at,
                icon: '💬'
            })));
        }

        if (submissions) {
            activities = activities.concat(submissions.map(sub => ({
                type: 'submission',
                title: sub.title,
                status: sub.status,
                date: sub.created_at,
                icon: '🎮'
            })));
        }

        if (approvedGames) {
            activities = activities.concat(approvedGames.map(game => ({
                type: 'approved_game',
                title: game.title,
                date: game.created_at,
                icon: '✅'
            })));
        }

        // Sort by date and limit
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        activities = activities.slice(0, 15);

        // Display activities
        const activityFeed = document.getElementById('activity-feed');
        if (activityFeed) {
            if (activities.length > 0) {
                activityFeed.innerHTML = activities.map(activity => `
                    <div class="bg-gray-800/50 hover:bg-gray-800 p-4 rounded-lg border border-gray-700 transition">
                        <div class="flex items-center gap-3">
                            <div class="text-2xl">${activity.icon}</div>
                            <div class="flex-1">
                                ${activity.type === 'comment' ? `
                                    <p class="text-gray-200">
                                        Commented on 
                                        <a href="#game/${activity.game.id}" class="text-cyan-400 hover:text-cyan-300">
                                            ${activity.game.title}
                                        </a>
                                    </p>
                                    <p class="text-gray-400 text-sm mt-1">${activity.content.substring(0, 100)}...</p>
                                ` : ''}
                                
                                ${activity.type === 'submission' ? `
                                    <p class="text-gray-200">
                                        Submitted <span class="font-semibold">${activity.title}</span>
                                        <span class="ml-2 px-2 py-1 text-xs rounded ${
                                            activity.status === 'approved' ? 'bg-green-600' : 
                                            activity.status === 'pending' ? 'bg-yellow-600' : 'bg-red-600'
                                        }">
                                            ${activity.status}
                                        </span>
                                    </p>
                                ` : ''}
                                
                                ${activity.type === 'approved_game' ? `
                                    <p class="text-gray-200">
                                        Game <span class="font-semibold">${activity.title}</span> was approved!
                                    </p>
                                ` : ''}
                                
                                <p class="text-gray-500 text-xs mt-2">
                                    ${new Date(activity.date).toLocaleDateString()} at 
                                    ${new Date(activity.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    </div>
                `).join('');
            } else {
                activityFeed.innerHTML = `
                    <div class="text-center py-12">
                        <div class="text-4xl mb-4">📊</div>
                        <p class="text-gray-400">No activity yet</p>
                        <p class="text-gray-500 text-sm mt-2">Start by submitting a game or commenting!</p>
                    </div>
                `;
            }
        }

    } catch (error) {
        console.error('Error loading activity:', error);
    }
}

function setupTabs() {
    const tabs = document.querySelectorAll('.profile-tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            // Update active tab
            tabs.forEach(t => {
                t.classList.remove('active', 'text-cyan-300', 'border-b-2', 'border-cyan-500');
                t.classList.add('text-gray-400');
            });
            
            tab.classList.add('active', 'text-cyan-300', 'border-b-2', 'border-cyan-500');
            tab.classList.remove('text-gray-400');

            // Load tab content
            const tabName = tab.getAttribute('data-tab');
            const container = document.getElementById('tab-content-container');
            
            switch (tabName) {
                case 'activity':
                    await loadUserActivity(currentProfile.id);
                    break;
                    
                case 'games':
                    await loadUserGames();
                    break;
                    
                case 'friends':
                    await loadFriends();
                    break;
                    
                case 'backgrounds':
                    if (isOwnProfile) {
                        await loadBackgroundCustomizer();
                    }
                    break;
                    
                case 'settings':
                    if (isOwnProfile) {
                        await loadSettings();
                    }
                    break;
            }
        });
    });
}

async function loadUserGames() {
    const container = document.getElementById('tab-content-container');
    
    try {
        const { data: games } = await supabase
            .from('games')
            .select('*')
            .eq('submitted_by', currentProfile.id)
            .order('created_at', { ascending: false });

        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${games && games.length > 0 ? games.map(game => `
                    <div class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden hover:border-cyan-500 transition">
                        ${game.cover_image_url ? `
                            <img src="${game.cover_image_url}" 
                                 alt="${game.title}" 
                                 class="w-full h-48 object-cover">
                        ` : `
                            <div class="w-full h-48 bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                                <span class="text-4xl">🎮</span>
                            </div>
                        `}
                        <div class="p-4">
                            <h4 class="text-lg font-bold text-white mb-2">${game.title}</h4>
                            <p class="text-gray-400 text-sm mb-4">${game.console} • ${game.year}</p>
                            <a href="#game/${game.id}" 
                               class="block text-center bg-gray-700 hover:bg-gray-600 text-white py-2 rounded">
                               View Game
                            </a>
                        </div>
                    </div>
                `).join('') : `
                    <div class="col-span-3 text-center py-12">
                        <div class="text-4xl mb-4">🎮</div>
                        <p class="text-gray-400">No games submitted yet</p>
                        <p class="text-gray-500 text-sm mt-2">
                            <a href="#submit-game" class="text-cyan-400 hover:text-cyan-300">
                                Submit your first game!
                            </a>
                        </p>
                    </div>
                `}
            </div>
        `;

    } catch (error) {
        console.error('Error loading games:', error);
        container.innerHTML = `
            <div class="text-center py-12">
                <p class="text-red-400">Error loading games</p>
            </div>
        `;
    }
}

async function loadFriends() {
    const container = document.getElementById('tab-content-container');
    
    try {
        const { data: friends } = await supabase
            .from('friends')
            .select(`
                *,
                friend:profiles!friends_friend_id_fkey(username, email, avatar_url)
            `)
            .eq('user_id', currentProfile.id)
            .eq('status', 'accepted')
            .order('created_at', { ascending: false });

        container.innerHTML = `
            <div class="space-y-4">
                ${friends && friends.length > 0 ? friends.map(friend => `
                    <div class="bg-gray-800 rounded-lg p-4 border border-gray-700 flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                                ${friend.friend.avatar_url ? `
                                    <img src="${friend.friend.avatar_url}" 
                                         alt="${friend.friend.username}" 
                                         class="w-full h-full rounded-full object-cover">
                                ` : `
                                    <span class="text-white font-bold">
                                        ${friend.friend.username?.charAt(0) || friend.friend.email.charAt(0).toUpperCase()}
                                    </span>
                                `}
                            </div>
                            <div>
                                <h4 class="text-white font-semibold">${friend.friend.username || friend.friend.email.split('@')[0]}</h4>
                                <p class="text-gray-400 text-sm">${friend.friend.email}</p>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="window.location.hash='#profile/${friend.friend_id}'" 
                                    class="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-sm">
                                View Profile
                            </button>
                            ${isOwnProfile ? `
                                <button onclick="removeFriend('${friend.id}')" 
                                        class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm">
                                    Remove
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `).join('') : `
                    <div class="text-center py-12">
                        <div class="text-4xl mb-4">👥</div>
                        <p class="text-gray-400">No friends yet</p>
                        ${isOwnProfile ? `
                            <p class="text-gray-500 text-sm mt-2">
                                Browse profiles to add friends!
                            </p>
                        ` : ''}
                    </div>
                `}
            </div>
        `;

    } catch (error) {
        console.error('Error loading friends:', error);
        container.innerHTML = `
            <div class="text-center py-12">
                <p class="text-red-400">Error loading friends</p>
            </div>
        `;
    }
}

async function loadBackgroundCustomizer() {
    const container = document.getElementById('tab-content-container');
    
    container.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- Background Preview -->
            <div>
                <h3 class="text-xl font-bold text-white mb-4">Preview</h3>
                <div id="background-preview" 
                     class="h-64 rounded-lg border-2 border-cyan-500 overflow-hidden relative">
                    <div class="absolute inset-0 flex items-center justify-center">
                        <p class="text-white text-lg font-semibold bg-black/50 px-4 py-2 rounded">
                            Your Profile Preview
                        </p>
                    </div>
                </div>
                
                <!-- Background Controls -->
                <div class="mt-6 space-y-4">
                    <div>
                        <label class="block text-gray-300 mb-2">Background Position</label>
                        <select id="bg-position" class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white">
                            <option value="center">Center</option>
                            <option value="top">Top</option>
                            <option value="bottom">Bottom</option>
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-gray-300 mb-2">Background Size</label>
                        <select id="bg-size" class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white">
                            <option value="cover">Cover</option>
                            <option value="contain">Contain</option>
                            <option value="auto">Auto</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-gray-300 mb-2">Blur Effect</label>
                        <input type="range" id="bg-blur" min="0" max="10" value="0" 
                               class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer">
                        <div class="flex justify-between text-sm text-gray-400">
                            <span>None</span>
                            <span id="blur-value">0px</span>
                            <span>Max</span>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-gray-300 mb-2">Opacity</label>
                        <input type="range" id="bg-opacity" min="0.1" max="1" step="0.1" value="1" 
                               class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer">
                        <div class="flex justify-between text-sm text-gray-400">
                            <span>10%</span>
                            <span id="opacity-value">100%</span>
                            <span>100%</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Background Selection -->
            <div>
                <h3 class="text-xl font-bold text-white mb-4">Choose Background</h3>
                
                <!-- Upload Custom Image -->
                <div class="mb-6 p-4 bg-gray-900 rounded-lg border border-purple-500">
                    <h4 class="text-lg font-semibold text-white mb-3">Upload Your Own</h4>
                    <input type="file" 
                           id="bg-upload" 
                           accept="image/*" 
                           class="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white mb-3">
                    <div id="upload-progress" class="hidden">
                        <div class="w-full bg-gray-700 rounded-full h-2">
                            <div class="bg-green-500 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                        </div>
                        <p class="text-sm text-gray-400 mt-1" id="upload-status">Uploading...</p>
                    </div>
                    <p class="text-sm text-gray-400">Max 5MB. JPG, PNG, GIF, WEBP</p>
                </div>
                
                <!-- Default Colors -->
                <div class="mb-6">
                    <h4 class="text-lg font-semibold text-white mb-3">Solid Colors</h4>
                    <div class="grid grid-cols-5 gap-2">
                        <button class="h-12 bg-gray-900 rounded border-2 border-gray-700 hover:border-cyan-500"
                                onclick="applyColor('#0f172a')"></button>
                        <button class="h-12 bg-gray-800 rounded border-2 border-gray-700 hover:border-cyan-500"
                                onclick="applyColor('#1f2937')"></button>
                        <button class="h-12 bg-cyan-900 rounded border-2 border-gray-700 hover:border-cyan-500"
                                onclick="applyColor('#164e63')"></button>
                        <button class="h-12 bg-purple-900 rounded border-2 border-gray-700 hover:border-cyan-500"
                                onclick="applyColor('#581c87')"></button>
                        <button class="h-12 bg-green-900 rounded border-2 border-gray-700 hover:border-cyan-500"
                                onclick="applyColor('#14532d')"></button>
                    </div>
                </div>
                
                <!-- Preset Gradients -->
                <div class="mb-6">
                    <h4 class="text-lg font-semibold text-white mb-3">Gradients</h4>
                    <div class="grid grid-cols-2 gap-3">
                        <button class="h-16 bg-gradient-to-r from-cyan-500 to-blue-500 rounded border-2 border-gray-700 hover:border-cyan-500"
                                onclick="applyGradient('linear-gradient(to right, #06b6d4, #3b82f6)')">
                            <span class="text-white text-sm font-semibold">Cyber</span>
                        </button>
                        <button class="h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded border-2 border-gray-700 hover:border-cyan-500"
                                onclick="applyGradient('linear-gradient(to right, #8b5cf6, #ec4899)')">
                            <span class="text-white text-sm font-semibold">Neon</span>
                        </button>
                        <button class="h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded border-2 border-gray-700 hover:border-cyan-500"
                                onclick="applyGradient('linear-gradient(to right, #10b981, #059669)')">
                            <span class="text-white text-sm font-semibold">Matrix</span>
                        </button>
                        <button class="h-16 bg-gradient-to-r from-yellow-500 to-orange-500 rounded border-2 border-gray-700 hover:border-cyan-500"
                                onclick="applyGradient('linear-gradient(to right, #eab308, #f97316)')">
                            <span class="text-white text-sm font-semibold">Sunset</span>
                        </button>
                    </div>
                </div>
                
                <!-- Save Button -->
                <div class="mt-6 pt-4 border-t border-gray-700">
                    <button id="save-background-btn" 
                            class="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold rounded-lg hover:opacity-90 transition">
                        💾 Save Background
                    </button>
                    <button onclick="resetBackground()" 
                            class="w-full py-3 bg-gray-700 text-white font-bold rounded-lg hover:bg-gray-600 transition mt-3">
                        🔄 Reset to Default
                    </button>
                </div>
            </div>
        </div>
    `;

    // Setup event listeners for background controls
    setupBackgroundControls();
}

function setupBackgroundControls() {
    let currentBackground = currentProfile?.custom_background || {
        type: 'color',
        value: '#1f2937',
        image_url: '',
        position: 'center',
        size: 'cover',
        blur: '0',
        opacity: '1'
    };
    
    // Initialize controls
    const positionSelect = document.getElementById('bg-position');
    const sizeSelect = document.getElementById('bg-size');
    const blurSlider = document.getElementById('bg-blur');
    const opacitySlider = document.getElementById('bg-opacity');
    
    if (positionSelect) positionSelect.value = currentBackground.position || 'center';
    if (sizeSelect) sizeSelect.value = currentBackground.size || 'cover';
    if (blurSlider) blurSlider.value = currentBackground.blur || '0';
    if (opacitySlider) opacitySlider.value = currentBackground.opacity || '1';
    
    // Update preview
    updateBackgroundPreview();
    
    // Event listeners
    positionSelect?.addEventListener('change', (e) => {
        currentBackground.position = e.target.value;
        updateBackgroundPreview();
    });
    
    sizeSelect?.addEventListener('change', (e) => {
        currentBackground.size = e.target.value;
        updateBackgroundPreview();
    });
    
    blurSlider?.addEventListener('input', (e) => {
        currentBackground.blur = e.target.value;
        document.getElementById('blur-value').textContent = `${e.target.value}px`;
        updateBackgroundPreview();
    });
    
    opacitySlider?.addEventListener('input', (e) => {
        currentBackground.opacity = e.target.value;
        document.getElementById('opacity-value').textContent = `${Math.round(e.target.value * 100)}%`;
        updateBackgroundPreview();
    });
    
    // Upload functionality
    const uploadInput = document.getElementById('bg-upload');
    uploadInput?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            alert('Image must be less than 5MB');
            return;
        }
        
        // Show progress
        const progressDiv = document.getElementById('upload-progress');
        const progressBar = progressDiv.querySelector('div > div');
        const statusText = document.getElementById('upload-status');
        
        progressDiv.classList.remove('hidden');
        progressBar.style.width = '30%';
        statusText.textContent = 'Uploading...';
        
        try {
            // Simulate upload (in real app, upload to Supabase)
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Create blob URL for preview
            const imageUrl = URL.createObjectURL(file);
            
            currentBackground.type = 'image';
            currentBackground.image_url = imageUrl;
            currentBackground.value = '';
            
            updateBackgroundPreview();
            
            progressBar.style.width = '100%';
            statusText.textContent = 'Upload complete!';
            
            setTimeout(() => {
                progressDiv.classList.add('hidden');
            }, 2000);
            
        } catch (error) {
            console.error('Error uploading background:', error);
            statusText.textContent = 'Upload failed';
            statusText.classList.add('text-red-400');
        }
    });
    
    // Save button
    const saveButton = document.getElementById('save-background-btn');
    saveButton?.addEventListener('click', async () => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ custom_background: currentBackground })
                .eq('id', currentProfile.id);
            
            if (error) throw error;
            
            // Update current profile
            currentProfile.custom_background = currentBackground;
            
            // Apply to profile
            applyCustomBackground(currentBackground);
            
            // Show success
            alert('Background saved successfully!');
            
        } catch (error) {
            console.error('Error saving background:', error);
            alert('Failed to save background');
        }
    });
    
    // Global functions for buttons
    window.applyColor = function(color) {
        currentBackground.type = 'color';
        currentBackground.value = color;
        currentBackground.image_url = '';
        updateBackgroundPreview();
    };
    
    window.applyGradient = function(gradient) {
        currentBackground.type = 'gradient';
        currentBackground.value = gradient;
        currentBackground.image_url = '';
        updateBackgroundPreview();
    };
    
    window.resetBackground = function() {
        currentBackground = {
            type: 'color',
            value: '#1f2937',
            image_url: '',
            position: 'center',
            size: 'cover',
            blur: '0',
            opacity: '1'
        };
        
        if (positionSelect) positionSelect.value = 'center';
        if (sizeSelect) sizeSelect.value = 'cover';
        if (blurSlider) blurSlider.value = '0';
        if (opacitySlider) opacitySlider.value = '1';
        if (document.getElementById('blur-value')) {
            document.getElementById('blur-value').textContent = '0px';
        }
        if (document.getElementById('opacity-value')) {
            document.getElementById('opacity-value').textContent = '100%';
        }
        
        updateBackgroundPreview();
    };
    
    function updateBackgroundPreview() {
        const preview = document.getElementById('background-preview');
        if (!preview) return;
        
        // Clear previous background
        preview.style.background = '';
        preview.style.backgroundImage = '';
        preview.style.filter = '';
        preview.style.opacity = '';
        preview.style.backgroundPosition = currentBackground.position || 'center';
        preview.style.backgroundSize = currentBackground.size || 'cover';
        preview.style.backgroundRepeat = currentBackground.repeat || 'no-repeat';
        
        switch (currentBackground.type) {
            case 'color':
                preview.style.background = currentBackground.value || '#1f2937';
                break;
                
            case 'gradient':
                preview.style.background = currentBackground.value;
                break;
                
            case 'image':
                if (currentBackground.image_url) {
                    preview.style.backgroundImage = `url('${currentBackground.image_url}')`;
                }
                break;
        }
        
        // Apply effects
        if (currentBackground.blur && currentBackground.blur !== '0') {
            preview.style.filter = `blur(${currentBackground.blur}px)`;
        }
        
        if (currentBackground.opacity && currentBackground.opacity !== '1') {
            preview.style.opacity = currentBackground.opacity;
        }
    }
}

async function loadSettings() {
    const container = document.getElementById('tab-content-container');
    
    container.innerHTML = `
        <div class="bg-gray-800 rounded-lg p-6 border border-cyan-500">
            <h3 class="text-xl font-bold text-white mb-6">⚙️ Account Settings</h3>
            
            <div class="space-y-6">
                <!-- Privacy Settings -->
                <div class="p-4 bg-gray-900 rounded-lg">
                    <h4 class="text-lg font-semibold text-white mb-4">🔒 Privacy</h4>
                    <div class="space-y-3">
                        <label class="flex items-center justify-between cursor-pointer">
                            <span class="text-gray-300">Show email on profile</span>
                            <input type="checkbox" 
                                   id="setting-show-email" 
                                   class="w-5 h-5 rounded"
                                   ${currentProfile.preferences?.show_email ? 'checked' : ''}>
                        </label>
                        <label class="flex items-center justify-between cursor-pointer">
                            <span class="text-gray-300">Show my activity to others</span>
                            <input type="checkbox" 
                                   id="setting-show-activity" 
                                   class="w-5 h-5 rounded"
                                   ${currentProfile.preferences?.show_activity !== false ? 'checked' : ''}>
                        </label>
                    </div>
                </div>
                
                <!-- Account Management -->
                <div class="p-4 bg-gray-900 rounded-lg">
                    <h4 class="text-lg font-semibold text-white mb-4">👤 Account</h4>
                    <div class="space-y-4">
                        <div>
                            <button onclick="openUsernameModal()" 
                                    class="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold">
                                ✏️ Change Username
                            </button>
                        </div>
                        <div>
                            <button onclick="exportData()" 
                                    class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold">
                                📥 Export My Data
                            </button>
                        </div>
                        <div>
                            <button onclick="deleteAccount()" 
                                    class="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold">
                                🗑️ Delete Account
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Save Button -->
                <div class="pt-4">
                    <button id="save-settings-btn" 
                            class="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold">
                        💾 Save Settings
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Setup settings save button
    document.getElementById('save-settings-btn')?.addEventListener('click', saveSettings);
}

function setupEventListeners() {
    // Edit profile button
    document.getElementById('edit-profile-btn')?.addEventListener('click', openEditModal);
    
    // Edit username button
    document.getElementById('edit-username-btn')?.addEventListener('click', openUsernameModal);
    
    // Customize background button
    document.getElementById('customize-background-btn')?.addEventListener('click', openBackgroundModal);
    
    // View friends button
    document.getElementById('view-friends-btn')?.addEventListener('click', () => {
        document.querySelector('[data-tab="friends"]')?.click();
    });
    
    // Add friend button
    document.getElementById('add-friend-btn')?.addEventListener('click', sendFriendRequest);
    
    // Message button
    document.getElementById('message-btn')?.addEventListener('click', () => {
        alert('Messaging system coming soon!');
    });
}

function openEditModal() {
    const modal = document.getElementById('edit-profile-modal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    
    // Load edit form
    const form = document.getElementById('profile-edit-form');
    form.innerHTML = `
        <div class="space-y-6">
            <!-- Avatar Section -->
            <div class="p-4 bg-gray-900 rounded-lg border border-cyan-500">
                <h4 class="text-lg font-semibold text-white mb-3">Avatar</h4>
                <div class="flex items-center gap-4 mb-4">
                    <div id="avatar-preview" class="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-2xl">
                        ${currentProfile.username?.charAt(0) || currentProfile.email.charAt(0).toUpperCase()}
                    </div>
                    <div class="flex-1">
                        <input type="file" 
                               id="avatar-upload" 
                               accept="image/*" 
                               class="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white mb-2">
                        <input type="text" 
                               id="avatar-url" 
                               placeholder="Or enter image URL" 
                               class="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white"
                               value="${currentProfile.avatar_url || ''}">
                    </div>
                </div>
                <p class="text-sm text-gray-400">Max 2MB. JPG, PNG, GIF</p>
            </div>
            
            <!-- Basic Info -->
            <div>
                <label class="block text-gray-300 mb-2">Display Name (Username)</label>
                <input type="text" 
                       id="edit-username" 
                       value="${currentProfile.username || ''}"
                       class="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                       placeholder="Choose a unique username">
                <p class="text-sm text-gray-400 mt-1">This will be displayed on your profile and comments</p>
            </div>
            
            <div>
                <label class="block text-gray-300 mb-2">Bio</label>
                <textarea id="edit-bio" 
                          rows="3" 
                          class="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                          placeholder="Tell us about yourself...">${currentProfile.bio || ''}</textarea>
            </div>
            
            <div>
                <label class="block text-gray-300 mb-2">Favorite Console</label>
                <select id="edit-favorite-console" 
                        class="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white">
                    <option value="">Select a console</option>
                    <option value="PS2" ${currentProfile.favorite_console === 'PS2' ? 'selected' : ''}>PlayStation 2</option>
                    <option value="PS3" ${currentProfile.favorite_console === 'PS3' ? 'selected' : ''}>PlayStation 3</option>
                    <option value="XBOX" ${currentProfile.favorite_console === 'XBOX' ? 'selected' : ''}>Xbox</option>
                    <option value="GC" ${currentProfile.favorite_console === 'GC' ? 'selected' : ''}>GameCube</option>
                    <option value="PC" ${currentProfile.favorite_console === 'PC' ? 'selected' : ''}>PC</option>
                    <option value="WII" ${currentProfile.favorite_console === 'WII' ? 'selected' : ''}>Wii</option>
                    <option value="DC" ${currentProfile.favorite_console === 'DC' ? 'selected' : ''}>Dreamcast</option>
                </select>
            </div>
            
            <!-- Social Links -->
            <div class="p-4 bg-gray-900 rounded-lg border border-cyan-500">
                <h4 class="text-lg font-semibold text-white mb-3">Social Links</h4>
                <div class="space-y-3">
                    <div>
                        <label class="block text-gray-300 mb-2">Discord Username</label>
                        <input type="text" 
                               id="edit-discord" 
                               value="${currentProfile.social_links?.discord || ''}"
                               placeholder="username#1234"
                               class="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white">
                    </div>
                    <div>
                        <label class="block text-gray-300 mb-2">Twitter Handle</label>
                        <input type="text" 
                               id="edit-twitter" 
                               value="${currentProfile.social_links?.twitter || ''}"
                               placeholder="@username"
                               class="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white">
                    </div>
                    <div>
                        <label class="block text-gray-300 mb-2">Twitch Username</label>
                        <input type="text" 
                               id="edit-twitch" 
                               value="${currentProfile.social_links?.twitch || ''}"
                               placeholder="username"
                               class="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white">
                    </div>
                </div>
            </div>
            
            <!-- Action Buttons -->
            <div class="flex space-x-3 pt-4">
                <button type="submit" 
                        class="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-3 rounded font-semibold">
                    Save Changes
                </button>
                <button type="button" onclick="closeEditModal()" 
                        class="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded">
                    Cancel
                </button>
            </div>
        </div>
    `;
    
    // Setup avatar upload preview
    const avatarUpload = document.getElementById('avatar-upload');
    const avatarUrl = document.getElementById('avatar-url');
    const avatarPreview = document.getElementById('avatar-preview');
    
    avatarUpload?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }
        
        if (file.size > 2 * 1024 * 1024) {
            alert('Image must be less than 2MB');
            return;
        }
        
        // Preview image
        const reader = new FileReader();
        reader.onload = (e) => {
            avatarPreview.innerHTML = `<img src="${e.target.result}" class="w-full h-full rounded-full object-cover">`;
            avatarUrl.value = e.target.result;
        };
        reader.readAsDataURL(file);
    });
    
    avatarUrl?.addEventListener('input', (e) => {
        if (e.target.value) {
            avatarPreview.innerHTML = `<img src="${e.target.value}" class="w-full h-full rounded-full object-cover" onerror="this.parentElement.innerHTML='${currentProfile.username?.charAt(0) || currentProfile.email.charAt(0).toUpperCase()}'">`;
        } else {
            avatarPreview.textContent = currentProfile.username?.charAt(0) || currentProfile.email.charAt(0).toUpperCase();
        }
    });
    
    // Handle form submission
    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('edit-username').value.trim();
        const bio = document.getElementById('edit-bio').value.trim();
        const favoriteConsole = document.getElementById('edit-favorite-console').value;
        const discord = document.getElementById('edit-discord').value.trim();
        const twitter = document.getElementById('edit-twitter').value.trim().replace('@', '');
        const twitch = document.getElementById('edit-twitch').value.trim();
        const avatarUrl = document.getElementById('avatar-url').value.trim();
        
        try {
            // Check if username already exists (if changed)
            if (username && username !== currentProfile.username) {
                const { data: existingUser } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('username', username)
                    .neq('id', currentProfile.id)
                    .single();
                
                if (existingUser) {
                    alert('Username already taken. Please choose another.');
                    return;
                }
            }
            
            const updates = {
                username: username || null,
                bio: bio || null,
                favorite_console: favoriteConsole || null,
                avatar_url: avatarUrl || null,
                social_links: {
                    discord: discord,
                    twitter: twitter,
                    twitch: twitch
                }
            };
            
            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', currentProfile.id);
            
            if (error) throw error;
            
            // Update local profile
            currentProfile = { ...currentProfile, ...updates };
            
            // Close modal and refresh
            closeEditModal();
            window.location.reload();
            
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Failed to update profile');
        }
    };
}

function openUsernameModal() {
    const modal = document.getElementById('username-modal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    
    const form = document.getElementById('username-change-form');
    const input = document.getElementById('new-username');
    const availability = document.getElementById('username-availability');
    
    // Set current username as placeholder
    input.value = currentProfile.username || '';
    input.placeholder = currentProfile.username || 'Enter new username';
    availability.classList.add('hidden');
    
    // Check username availability on input
    input.addEventListener('input', async () => {
        const username = input.value.trim();
        
        if (username.length < 3) {
            availability.classList.add('hidden');
            return;
        }
        
        if (username === currentProfile.username) {
            availability.textContent = 'This is your current username';
            availability.className = 'text-sm text-yellow-400';
            availability.classList.remove('hidden');
            return;
        }
        
        // Validate username format
        const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
        if (!usernameRegex.test(username)) {
            availability.textContent = 'Use 3-30 letters, numbers, or underscores';
            availability.className = 'text-sm text-red-400';
            availability.classList.remove('hidden');
            return;
        }
        
        // Check availability
        const { data: existingUser } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', username)
            .single();
        
        if (existingUser) {
            availability.textContent = 'Username already taken';
            availability.className = 'text-sm text-red-400';
        } else {
            availability.textContent = 'Username available ✓';
            availability.className = 'text-sm text-green-400';
        }
        
        availability.classList.remove('hidden');
    });
    
    // Handle form submission
    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const username = input.value.trim();
        
        if (!username) {
            alert('Please enter a username');
            return;
        }
        
        // Validate username format
        const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
        if (!usernameRegex.test(username)) {
            alert('Username must be 3-30 characters and can only contain letters, numbers, and underscores');
            return;
        }
        
        if (username === currentProfile.username) {
            alert('This is already your username');
            return;
        }
        
        try {
            // Check availability one more time
            const { data: existingUser } = await supabase
                .from('profiles')
                .select('id')
                .eq('username', username)
                .single();
            
            if (existingUser) {
                alert('Username already taken. Please choose another.');
                return;
            }
            
            // Update username
            const { error } = await supabase
                .from('profiles')
                .update({ username })
                .eq('id', currentProfile.id);
            
            if (error) throw error;
            
            // Update local profile
            currentProfile.username = username;
            
            // Close modal and refresh
            closeUsernameModal();
            window.location.reload();
            
        } catch (error) {
            console.error('Error changing username:', error);
            alert('Failed to change username');
        }
    };
}

function openBackgroundModal() {
    const modal = document.getElementById('background-modal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    loadBackgroundCustomizer();
}

async function saveSettings() {
    try {
        const showEmail = document.getElementById('setting-show-email')?.checked || false;
        const showActivity = document.getElementById('setting-show-activity')?.checked !== false;
        
        const { error } = await supabase
            .from('profiles')
            .update({
                preferences: {
                    show_email: showEmail,
                    show_activity: showActivity
                }
            })
            .eq('id', currentProfile.id);
        
        if (error) throw error;
        
        // Update local profile
        currentProfile.preferences = { show_email: showEmail, show_activity: showActivity };
        
        alert('Settings saved successfully!');
        
    } catch (error) {
        console.error('Error saving settings:', error);
        alert('Failed to save settings');
    }
}

// Global modal functions
window.closeEditModal = function() {
    const modal = document.getElementById('edit-profile-modal');
    if (modal) modal.classList.add('hidden');
};

window.closeUsernameModal = function() {
    const modal = document.getElementById('username-modal');
    if (modal) modal.classList.add('hidden');
};

window.closeBackgroundModal = function() {
    const modal = document.getElementById('background-modal');
    if (modal) modal.classList.add('hidden');
};

// Global helper functions
async function sendFriendRequest() {
    if (!currentProfile || isOwnProfile) return;
    
    try {
        const { error } = await supabase
            .from('friends')
            .insert({
                user_id: currentUser.id,
                friend_id: currentProfile.id,
                status: 'pending'
            });
        
        if (error) throw error;
        
        alert('Friend request sent!');
        
    } catch (error) {
        console.error('Error sending friend request:', error);
        alert('Failed to send friend request');
    }
}

async function removeFriend(friendId) {
    if (!confirm('Remove this friend?')) return;
    
    try {
        const { error } = await supabase
            .from('friends')
            .delete()
            .eq('id', friendId);
        
        if (error) throw error;
        
        // Refresh friends list
        await loadFriends();
        
    } catch (error) {
        console.error('Error removing friend:', error);
        alert('Failed to remove friend');
    }
}

function exportData() {
    alert('Data export feature coming soon!');
}

function deleteAccount() {
    if (confirm('⚠️ Are you sure? This will permanently delete your account and all your data!')) {
        alert('Account deletion feature coming soon!');
    }
}

function showErrorState() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <div class="max-w-4xl mx-auto text-center py-12">
            <div class="text-6xl mb-4">😔</div>
            <h2 class="text-2xl font-bold text-white mb-4">Profile Not Found</h2>
            <p class="text-gray-400 mb-6">This user doesn't exist or their profile is private.</p>
            <button onclick="window.history.back()" 
                    class="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg font-semibold">
                Go Back
            </button>
        </div>
    `;
}
