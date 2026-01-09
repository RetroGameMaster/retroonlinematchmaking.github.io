// modules/search-users/search-users.js - FIXED VERSION WITH NO EMAIL DISPLAY
import { supabase, getCurrentUser } from '../../lib/supabase.js';

let currentUser = null;
let searchTimeout = null;

export function initModule() {
    console.log('🔍 Search Users module initialized');
    loadSearchInterface();
}

async function loadSearchInterface() {
    // Get current user
    currentUser = await getCurrentUser();
    
    if (!currentUser) {
        window.location.hash = '#/auth';
        return;
    }
    
    const appContent = document.getElementById('app-content');
    
    appContent.innerHTML = `
        <div class="max-w-4xl mx-auto">
            <!-- Search Header -->
            <div class="mb-8">
                <h1 class="text-3xl font-bold text-white mb-2">👥 Find Users</h1>
                <p class="text-gray-400">Search for users by username or gaming interests</p>
            </div>
            
            <!-- Search Bar -->
            <div class="mb-8">
                <div class="relative">
                    <input type="text" 
                           id="user-search-input" 
                           class="w-full p-4 pl-12 bg-gray-800 border-2 border-cyan-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                           placeholder="Search by username or console..."
                           autocomplete="off">
                    <div class="absolute left-4 top-4 text-gray-400">
                        🔍
                    </div>
                    <div id="clear-search" class="absolute right-4 top-4 text-gray-400 cursor-pointer hidden">
                        ✕
                    </div>
                </div>
                
                <!-- Search Filters -->
                <div class="flex flex-wrap gap-3 mt-4">
                    <button class="filter-btn active px-4 py-2 bg-cyan-600 text-white rounded-full" data-filter="all">
                        All Users
                    </button>
                    <button class="filter-btn px-4 py-2 bg-gray-700 text-gray-300 rounded-full" data-filter="online">
                        Online Now
                    </button>
                    <button class="filter-btn px-4 py-2 bg-gray-700 text-gray-300 rounded-full" data-filter="same-game">
                        Same Games
                    </button>
                    <button class="filter-btn px-4 py-2 bg-gray-700 text-gray-300 rounded-full" data-filter="same-console">
                        Same Console
                    </button>
                </div>
            </div>
            
            <!-- Search Results Container -->
            <div id="search-results-container" class="space-y-4">
                <div class="text-center py-12">
                    <div class="text-4xl mb-4">🔍</div>
                    <p class="text-gray-400">Search for users to connect with</p>
                    <p class="text-gray-500 text-sm mt-2">Try searching by username or favorite console</p>
                </div>
            </div>
            
            <!-- Loading Indicator -->
            <div id="search-loading" class="hidden text-center py-8">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
                <p class="text-gray-400 mt-2">Searching...</p>
            </div>
            
            <!-- No Results -->
            <div id="search-no-results" class="hidden text-center py-12">
                <div class="text-4xl mb-4">😕</div>
                <p class="text-gray-400">No users found</p>
                <p class="text-gray-500 text-sm mt-2">Try different search terms</p>
            </div>
        </div>
    `;
    
    setupEventListeners();
}

function setupEventListeners() {
    const searchInput = document.getElementById('user-search-input');
    const clearSearch = document.getElementById('clear-search');
    
    if (!searchInput) return;
    
    // Real-time search with debounce
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        if (clearSearch) {
            clearSearch.classList.toggle('hidden', !query);
        }
        
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        if (query.length >= 2) {
            document.getElementById('search-loading').classList.remove('hidden');
            document.getElementById('search-no-results').classList.add('hidden');
            
            searchTimeout = setTimeout(() => {
                searchUsers(query);
            }, 500);
        } else if (query.length === 0) {
            clearSearchResults();
        }
    });
    
    // Clear search button
    if (clearSearch) {
        clearSearch.addEventListener('click', () => {
            searchInput.value = '';
            clearSearch.classList.add('hidden');
            clearSearchResults();
        });
    }
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.remove('active', 'bg-cyan-600', 'text-white');
                b.classList.add('bg-gray-700', 'text-gray-300');
            });
            
            btn.classList.add('active', 'bg-cyan-600', 'text-white');
            btn.classList.remove('bg-gray-700', 'text-gray-300');
            
            const query = searchInput.value.trim();
            if (query.length >= 2) {
                searchUsers(query, btn.dataset.filter);
            }
        });
    });
}

async function searchUsers(query, filter = 'all') {
    try {
        console.log(`Searching for: "${query}" with filter: ${filter}`);
        
        // Verify currentUser exists with valid id
        if (!currentUser || !currentUser.id) {
            console.error('Current user not available or missing id:', currentUser);
            showSearchError('Please log in to search users');
            return;
        }
        
        // Start with base query that excludes current user
        let supabaseQuery = supabase
            .from('profiles')
            .select('*')
            .neq('id', currentUser.id)
            .or(`username.ilike.%${query}%,email.ilike.%${query}%,favorite_console.ilike.%${query}%,bio.ilike.%${query}%`);
        
        // Apply additional filters
        switch (filter) {
            case 'same-console':
                try {
                    const { data: userProfile } = await supabase
                        .from('profiles')
                        .select('favorite_console')
                        .eq('id', currentUser.id)
                        .single();
                    
                    if (userProfile?.favorite_console) {
                        supabaseQuery = supabaseQuery
                            .eq('favorite_console', userProfile.favorite_console);
                    }
                } catch (error) {
                    console.log('Error getting user console preference:', error);
                }
                break;
        }
        
        // Add limit and execute
        supabaseQuery = supabaseQuery.limit(20);
        
        const { data: users, error } = await supabaseQuery;
        
        if (error) {
            console.error('Supabase query error:', error);
            
            // Fallback: Try without the neq filter if it fails
            if (error.message.includes('undefined') || error.code === '400') {
                console.log('Trying fallback query without neq filter');
                const { data: fallbackUsers, error: fallbackError } = await supabase
                    .from('profiles')
                    .select('*')
                    .or(`username.ilike.%${query}%,email.ilike.%${query}%,favorite_console.ilike.%${query}%,bio.ilike.%${query}%`)
                    .limit(20);
                
                if (fallbackError) {
                    throw fallbackError;
                }
                
                // Filter out current user manually
                const filteredUsers = fallbackUsers?.filter(user => user.id !== currentUser.id) || [];
                displaySearchResults(filteredUsers, {});
                return;
            }
            
            throw error;
        }
        
        console.log(`Found ${users?.length || 0} users`);
        
        // Get friend relationships
        let friendMap = {};
        try {
            const { data: friendships } = await supabase
                .from('friends')
                .select('friend_id, status')
                .eq('user_id', currentUser.id);
            
            if (friendships) {
                friendships.forEach(f => {
                    friendMap[f.friend_id] = f.status;
                });
            }
        } catch (friendError) {
            console.error('Error loading friendships:', friendError);
        }
        
        displaySearchResults(users || [], friendMap);
        
    } catch (error) {
        console.error('Error searching users:', error);
        showSearchError('Error searching users. Please try again.');
    } finally {
        const loadingEl = document.getElementById('search-loading');
        if (loadingEl) loadingEl.classList.add('hidden');
    }
}

function displaySearchResults(users, friendMap) {
    const container = document.getElementById('search-results-container');
    
    if (!container) return;
    
    if (users.length === 0) {
        document.getElementById('search-no-results').classList.remove('hidden');
        container.innerHTML = '';
        return;
    }
    
    document.getElementById('search-no-results').classList.add('hidden');
    
    container.innerHTML = users.map(user => {
        const firstLetter = (user.username || user.email).charAt(0).toUpperCase();
        const friendStatus = friendMap[user.id];
        
        // Check if this is the current user's own profile
        const isOwnProfile = currentUser && user.id === currentUser.id;
        
        // Determine button text based on friend status
        let buttonHtml = '';
        if (friendStatus === 'accepted') {
            buttonHtml = `
                <button class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold" disabled>
                    ✓ Friends
                </button>
                <button onclick="removeFriendFromSearch('${user.id}', this)" 
                        class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">
                    Remove
                </button>
            `;
        } else if (friendStatus === 'pending') {
            buttonHtml = `
                <button class="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-semibold" disabled>
                    ⏳ Request Sent
                </button>
                <button onclick="cancelFriendRequestFromSearch('${user.id}', this)" 
                        class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">
                    Cancel
                </button>
            `;
        } else if (friendStatus === 'blocked') {
            buttonHtml = `
                <button class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold" disabled>
                    ⛔ Blocked
                </button>
                <button onclick="unblockUserFromSearch('${user.id}', this)" 
                        class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">
                    Unblock
                </button>
            `;
        } else {
            buttonHtml = `
                <button onclick="sendFriendRequestFromSearch('${user.id}', this)" 
                        class="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold">
                    👥 Add Friend
                </button>
                <button onclick="viewProfileFromSearch('${user.id}')" 
                        class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">
                    View Profile
                </button>
            `;
        }
        
        return `
            <div class="bg-gray-800 rounded-lg p-4 border border-gray-700 flex items-center justify-between hover:border-cyan-500 transition search-result-card">
                <a href="#/profile/${user.id}" 
                   class="flex items-center gap-4 flex-1"
                   onclick="event.stopPropagation()">
                    <div class="relative">
                        <div class="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                            ${user.avatar_url ? `
                                <img src="${user.avatar_url}" 
                                     alt="${user.username}" 
                                     class="w-full h-full rounded-full object-cover">
                            ` : `
                                <span class="text-white font-bold text-lg">
                                    ${firstLetter}
                                </span>
                            `}
                        </div>
                        <div class="absolute -bottom-1 -right-1 w-3 h-3 ${user.status === 'online' ? 'bg-green-500' : 'bg-gray-600'} rounded-full border-2 border-gray-800"></div>
                    </div>
                    
                    <div class="flex-1">
                        <h4 class="text-white font-semibold">${user.username || user.email.split('@')[0]}</h4>
                        
                        ${user.bio ? `
                            <p class="text-gray-400 text-sm mt-1 truncate">${user.bio}</p>
                        ` : ''}
                        
                        <div class="flex flex-wrap gap-2 mt-2">
                            ${user.favorite_console ? `
                                <span class="bg-yellow-600 text-white px-2 py-1 rounded text-xs">
                                    🎮 ${user.favorite_console}
                                </span>
                            ` : ''}
                            
                            <span class="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs">
                                ${user.stats?.games_submitted || 0} games
                            </span>
                        </div>
                    </div>
                </a>
                
                <div class="flex gap-2">
                    ${buttonHtml}
                </div>
            </div>
        `;
    }).join('');
}

function clearSearchResults() {
    const container = document.getElementById('search-results-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="text-center py-12">
            <div class="text-4xl mb-4">🔍</div>
            <p class="text-gray-400">Search for users to connect with</p>
            <p class="text-gray-500 text-sm mt-2">Try searching by username or favorite console</p>
        </div>
    `;
    
    const noResults = document.getElementById('search-no-results');
    if (noResults) noResults.classList.add('hidden');
}

function showSearchError(message = 'Error searching users') {
    const container = document.getElementById('search-results-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="text-center py-12">
            <div class="text-4xl mb-4">⚠️</div>
            <p class="text-red-400">${message}</p>
            <p class="text-gray-500 text-sm mt-2">Please try again later</p>
        </div>
    `;
    
    const loadingEl = document.getElementById('search-loading');
    if (loadingEl) loadingEl.classList.add('hidden');
    
    const noResults = document.getElementById('search-no-results');
    if (noResults) noResults.classList.add('hidden');
}

// Global functions for search result buttons
window.sendFriendRequestFromSearch = async function(userId, buttonElement) {
    try {
        if (!currentUser || !currentUser.id) {
            alert('Please log in to send friend requests');
            return;
        }
        
        const { error } = await supabase
            .from('friends')
            .insert({
                user_id: currentUser.id,
                friend_id: userId,
                status: 'pending'
            });
        
        if (error) {
            if (error.code === '23505') {
                alert('Friend request already sent!');
                return;
            }
            throw error;
        }
        
        // Update button state
        const parentDiv = buttonElement.closest('.search-result-card');
        const buttonsDiv = parentDiv.querySelector('div:last-child');
        buttonsDiv.innerHTML = `
            <button class="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-semibold" disabled>
                ⏳ Request Sent
            </button>
            <button onclick="cancelFriendRequestFromSearch('${userId}', this)" 
                    class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm">
                Cancel
            </button>
        `;
        
        showNotification('Friend request sent!', 'success');
        
    } catch (error) {
        console.error('Error sending friend request:', error);
        showNotification('Failed to send friend request', 'error');
    }
};

window.cancelFriendRequestFromSearch = async function(userId, buttonElement) {
    try {
        const { error } = await supabase
            .from('friends')
            .delete()
            .eq('user_id', currentUser.id)
            .eq('friend_id', userId);
        
        if (error) throw error;
        
        // Update UI
        const parentDiv = buttonElement.closest('.search-result-card');
        const buttonsDiv = parentDiv.querySelector('div:last-child');
        buttonsDiv.innerHTML = `
            <button onclick="sendFriendRequestFromSearch('${userId}', this)" 
                    class="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold">
                👥 Add Friend
            </button>
            <button onclick="viewProfileFromSearch('${userId}')" 
                    class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">
                View Profile
            </button>
        `;
        
        showNotification('Friend request cancelled', 'info');
        
    } catch (error) {
        console.error('Error cancelling friend request:', error);
        showNotification('Failed to cancel request', 'error');
    }
};

window.removeFriendFromSearch = async function(userId, buttonElement) {
    if (!confirm('Remove this friend?')) return;
    
    try {
        const { error } = await supabase
            .from('friends')
            .delete()
            .eq('user_id', currentUser.id)
            .eq('friend_id', userId);
        
        if (error) throw error;
        
        // Update UI
        const parentDiv = buttonElement.closest('.search-result-card');
        const buttonsDiv = parentDiv.querySelector('div:last-child');
        buttonsDiv.innerHTML = `
            <button onclick="sendFriendRequestFromSearch('${userId}', this)" 
                    class="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold">
                👥 Add Friend
            </button>
            <button onclick="viewProfileFromSearch('${userId}')" 
                    class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">
                View Profile
            </button>
        `;
        
        showNotification('Friend removed', 'info');
        
    } catch (error) {
        console.error('Error removing friend:', error);
        showNotification('Failed to remove friend', 'error');
    }
};

window.viewProfileFromSearch = function(userId) {
    window.location.hash = `#/profile/${userId}`;
};

window.unblockUserFromSearch = async function(userId, buttonElement) {
    try {
        const { error } = await supabase
            .from('friends')
            .delete()
            .eq('user_id', currentUser.id)
            .eq('friend_id', userId);
        
        if (error) throw error;
        
        // Update UI
        const parentDiv = buttonElement.closest('.search-result-card');
        const buttonsDiv = parentDiv.querySelector('div:last-child');
        buttonsDiv.innerHTML = `
            <button onclick="sendFriendRequestFromSearch('${userId}', this)" 
                    class="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold">
                👥 Add Friend
            </button>
            <button onclick="viewProfileFromSearch('${userId}')" 
                    class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">
                View Profile
            </button>
        `;
        
        showNotification('User unblocked', 'success');
        
    } catch (error) {
        console.error('Error unblocking user:', error);
        showNotification('Failed to unblock user', 'error');
    }
};

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transform transition-transform duration-300 ${
        type === 'success' ? 'bg-green-600 text-white' :
        type === 'error' ? 'bg-red-600 text-white' :
        'bg-cyan-600 text-white'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
