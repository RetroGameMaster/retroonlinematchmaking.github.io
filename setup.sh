#!/bin/bash

# ROM Refactoring - Phase 0 Setup Script
echo "🚀 Setting up ROM Modular Architecture..."

# Create directory structure
echo "📁 Creating directories..."
mkdir -p public/assets/styles
mkdir -p public/assets/icons
mkdir -p src/lib
mkdir -p src/core
mkdir -p src/services
mkdir -p src/hooks
mkdir -p src/components/common
mkdir -p src/components/layout
mkdir -p src/components/auth
mkdir -p src/components/social
mkdir -p src/components/profile
mkdir -p src/components/matchmaking
mkdir -p src/modules/matchmaking/components
mkdir -p src/modules/profiles/components
mkdir -p src/modules/social/components
mkdir -p src/modules/games/components
mkdir -p src/pages

# Create initial files
echo "📄 Creating initial files..."

# Create lib/supabase.js
cat > src/lib/supabase.js << 'EOF'
// Supabase Configuration - Centralized
const SUPABASE_URL = 'https://lapyxhothazalssrbimb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhcHl4aG90aGF6YWxzc3JiaW1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNjg0NDUsImV4cCI6MjA3Njk0NDQ0NX0.isfh75lAbJotctu6dkd_aAYK-2YNyYM4o-jqKFB5tVA';

// Initialize Supabase client
export function initSupabase() {
    if (window.supabase) {
        return window.supabase;
    }
    
    try {
        window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase client initialized successfully');
        return window.supabase;
    } catch (error) {
        console.error('❌ Supabase client creation failed:', error);
        // Fallback mock client to prevent crashes
        return {
            auth: {
                getUser: () => Promise.resolve({ data: { user: null } }),
                getSession: () => Promise.resolve({ data: { session: null } }),
                onAuthStateChange: () => ({ data: null }),
                signInWithPassword: () => Promise.reject(new Error('Supabase not available')),
                signUp: () => Promise.reject(new Error('Supabase not available')),
                signOut: () => Promise.reject(new Error('Supabase not available'))
            },
            from: () => ({
                select: () => Promise.resolve({ data: [], error: 'Supabase not available' }),
                insert: () => Promise.resolve({ data: null, error: 'Supabase not available' }),
                update: () => Promise.resolve({ data: null, error: 'Supabase not available' }),
                delete: () => Promise.resolve({ data: null, error: 'Supabase not available' }),
                eq: () => ({ single: () => Promise.resolve({ data: null, error: 'Supabase not available' }) })
            })
        };
    }
}

// Export singleton instance
export const supabase = initSupabase();

// Helper functions
export const auth = {
    async getCurrentUser() {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    },
    
    async getCurrentSession() {
        const { data: { session } } = await supabase.auth.getSession();
        return session;
    },
    
    async login(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        return { data, error };
    },
    
    async register(email, password, username) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { username }
            }
        });
        return { data, error };
    },
    
    async logout() {
        const { error } = await supabase.auth.signOut();
        return { error };
    },
    
    async resetPassword(email) {
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin
        });
        return { data, error };
    }
};
EOF

# Create core/types.js
cat > src/core/types.js << 'EOF'
// TypeScript-like type definitions for ROM
// These provide documentation and can be converted to actual TypeScript later

/**
 * User Profile Data Structure
 * @typedef {Object} UserProfile
 * @property {string} username
 * @property {string} email
 * @property {string} status - Online status
 * @property {string|null} profilePic - Base64 or URL
 * @property {string} signature - User signature
 * @property {string} signature_html - HTML formatted signature
 * @property {string} bio - User biography
 * @property {string} background - Profile background
 * @property {MusicData|null} music - Profile music
 * @property {Object} stats - User statistics
 * @property {number} stats.favorites - Favorite count
 * @property {number} stats.posts - Wall post count
 * @property {number} stats.messages - Chat message count
 * @property {string} joinDate - ISO date string
 * @property {string} lastActive - ISO date string
 */

/**
 * Game/Platform Connection Method
 * @typedef {Object} ConnectionMethod
 * @property {string} platform - PS1, PS2, PSP, etc.
 * @property {string} game - Game name
 * @property {string} method - Connection method name
 * @property {string} description
 * @property {string} dns - DNS address if applicable
 * @property {string[]} links - Array of resource links
 * @property {boolean} isFavorite - User favorite status
 */

/**
 * Friend Request/Relationship
 * @typedef {Object} FriendRelationship
 * @property {string} id
 * @property {string} from_user
 * @property {string} to_user
 * @property {'pending'|'accepted'|'declined'} status
 * @property {string} created_at - ISO date string
 */

/**
 * Chat Message
 * @typedef {Object} ChatMessage
 * @property {string} id
 * @property {string} username
 * @property {string} message
 * @property {string} timestamp - ISO date string
 * @property {'global'|'lobby'|'private'} type
 * @property {boolean} isOwn - Whether message is from current user
 */

/**
 * Game Lobby
 * @typedef {Object} GameLobby
 * @property {string} id
 * @property {string} game
 * @property {string} host
 * @property {number} maxPlayers
 * @property {string[]} players
 * @property {string} connectionMethod
 * @property {'waiting'|'active'|'full'|'closed'} status
 * @property {string} created - ISO date string
 */

/**
 * Matchmaking Data from Discord API
 * @typedef {Object} MatchmakingData
 * @property {number} active_games
 * @property {number} active_users
 * @property {number} recent_wins
 * @property {number} total_users
 * @property {Array<Object>} popular_games
 */

/**
 * Profile Music Data
 * @typedef {Object} MusicData
 * @property {string} id - YouTube video ID
 * @property {string} url - YouTube URL
 * @property {string} title
 * @property {string} artist
 * @property {'youtube'} type
 */

/**
 * Badge Data
 * @typedef {Object} Badge
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} icon_url
 * @property {'common'|'rare'|'epic'|'legendary'} rarity
 * @property {string} created_at - ISO date string
 */

// Export types as a global object for IDE assistance
if (typeof window !== 'undefined') {
    window.ROM_TYPES = {
        UserProfile: {},
        ConnectionMethod: {},
        FriendRelationship: {},
        ChatMessage: {},
        GameLobby: {},
        MatchmakingData: {},
        MusicData: {},
        Badge: {}
    };
}

console.log('✅ Type definitions loaded');
EOF

# Create core/utils.js
cat > src/core/utils.js << 'EOF'
// Utility Functions - Centralized

/**
 * Show a quick status notification
 * @param {string} message - Message to display
 * @param {'success'|'error'|'info'|'warning'} type - Notification type
 * @param {number} duration - Duration in milliseconds (default: 3000)
 */
export function showQuickStatus(message, type = 'info', duration = 3000) {
    // Remove any existing status
    const existing = document.querySelector('.quick-status');
    if (existing) existing.remove();
    
    const status = document.createElement('div');
    status.className = \`quick-status \${type}\`;
    status.textContent = message;
    
    // Style based on type
    const styles = {
        success: {
            background: 'rgba(0, 255, 0, 0.9)',
            borderColor: '#00ff00',
            color: '#000'
        },
        error: {
            background: 'rgba(255, 0, 0, 0.9)',
            borderColor: '#ff3333',
            color: '#fff'
        },
        info: {
            background: 'rgba(0, 255, 255, 0.9)',
            borderColor: '#00ffff',
            color: '#000'
        },
        warning: {
            background: 'rgba(255, 255, 0, 0.9)',
            borderColor: '#ffff00',
            color: '#000'
        }
    };
    
    const style = styles[type] || styles.info;
    
    status.style.cssText = \`
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: \${style.background};
        color: \${style.color};
        padding: 12px 24px;
        border-radius: 20px;
        z-index: 10000;
        font-weight: bold;
        animation: slideUp 0.3s ease;
        backdrop-filter: blur(10px);
        border: 1px solid \${style.borderColor};
        max-width: 80%;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    \`;
    
    // Add animation styles if not already present
    if (!document.querySelector('#status-animations')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'status-animations';
        styleSheet.textContent = \`
            @keyframes slideUp {
                from { transform: translateX(-50%) translateY(20px); opacity: 0; }
                to { transform: translateX(-50%) translateY(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(-50%) translateY(0); opacity: 1; }
                to { transform: translateX(-50%) translateY(20px); opacity: 0; }
            }
        \`;
        document.head.appendChild(styleSheet);
    }
    
    document.body.appendChild(status);
    
    // Auto-remove after duration
    setTimeout(() => {
        status.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (status.parentNode) {
                status.parentNode.removeChild(status);
            }
        }, 300);
    }, duration);
    
    return status;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} unsafe - Unsafe HTML string
 * @returns {string} Escaped string
 */
export function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Format relative time (e.g., "2 hours ago")
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted relative time
 */
export function formatRelativeTime(date) {
    if (!date) return 'Never';
    
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now - d;
    
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffSeconds < 60) return 'Just now';
    if (diffMinutes < 60) return \`\${diffMinutes}m ago\`;
    if (diffHours < 24) return \`\${diffHours}h ago\`;
    if (diffDays < 7) return \`\${diffDays}d ago\`;
    return d.toLocaleDateString();
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @param {string} successMessage - Success message (optional)
 * @returns {Promise<boolean>} Success status
 */
export async function copyToClipboard(text, successMessage = 'Copied to clipboard!') {
    try {
        await navigator.clipboard.writeText(text);
        if (successMessage) {
            showQuickStatus(successMessage, 'success');
        }
        return true;
    } catch (err) {
        console.error('Failed to copy:', err);
        // Fallback method
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            if (successMessage) {
                showQuickStatus(successMessage, 'success');
            }
            return true;
        } catch (fallbackErr) {
            console.error('Fallback copy failed:', fallbackErr);
            showQuickStatus('Failed to copy', 'error');
            return false;
        }
    }
}

/**
 * Debounce function to limit how often a function can be called
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function to limit function execution rate
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Get YouTube video ID from URL
 * @param {string} url - YouTube URL
 * @returns {string|null} Video ID or null
 */
export function extractYouTubeId(url) {
    if (!url) return null;
    
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/,
        /youtube\.com\/.*[?&]v=([^"&?\/\s]{11})/,
        /youtu\.be\/([^"&?\/\s]{11})/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    
    return null;
}

/**
 * Generate avatar text from username
 * @param {string} username - Username
 * @returns {string} First letter capitalized
 */
export function getAvatarText(username) {
    return username ? username.charAt(0).toUpperCase() : 'U';
}

/**
 * Check if user is on mobile
 * @returns {boolean} True if mobile device
 */
export function isMobile() {
    return window.innerWidth <= 768;
}

/**
 * Generate a unique ID
 * @returns {string} Unique ID
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Make utilities available globally for backward compatibility
if (typeof window !== 'undefined') {
    window.ROM_UTILS = {
        showQuickStatus,
        escapeHtml,
        formatRelativeTime,
        copyToClipboard,
        extractYouTubeId,
        getAvatarText,
        isMobile,
        generateId
    };
}
EOF

# Create services/authService.js
cat > src/services/authService.js << 'EOF'
// Authentication Service - Centralized auth logic
import { supabase } from '../lib/supabase.js';
import { showQuickStatus } from '../core/utils.js';

class AuthService {
    constructor() {
        this.currentUser = null;
        this.session = null;
        this.listeners = [];
        
        // Initialize auth state
        this.init();
    }
    
    async init() {
        try {
            // Get current session
            const { data: { session } } = await supabase.auth.getSession();
            this.session = session;
            this.currentUser = session?.user || null;
            
            // Set up auth state change listener
            supabase.auth.onAuthStateChange((event, session) => {
                console.log('Auth state changed:', event, session?.user?.email);
                this.session = session;
                this.currentUser = session?.user || null;
                this.notifyListeners(event, this.currentUser);
                
                // Show appropriate notifications
                switch(event) {
                    case 'SIGNED_IN':
                        showQuickStatus(\`Welcome back, \${this.getUsername()}!\`, 'success');
                        break;
                    case 'SIGNED_OUT':
                        showQuickStatus('Logged out successfully', 'info');
                        break;
                    case 'USER_UPDATED':
                        showQuickStatus('Profile updated', 'success');
                        break;
                }
            });
            
            console.log('✅ Auth service initialized');
        } catch (error) {
            console.error('❌ Auth service init failed:', error);
        }
    }
    
    /**
     * Get current user
     * @returns {Object|null} Current user object
     */
    getCurrentUser() {
        return this.currentUser;
    }
    
    /**
     * Get current session
     * @returns {Object|null} Current session
     */
    getCurrentSession() {
        return this.session;
    }
    
    /**
     * Get username from user metadata or email
     * @returns {string} Username
     */
    getUsername() {
        if (!this.currentUser) return 'Guest';
        return this.currentUser.user_metadata?.username || 
               this.currentUser.email?.split('@')[0] || 
               'User';
    }
    
    /**
     * Get user email
     * @returns {string|null} User email
     */
    getEmail() {
        return this.currentUser?.email || null;
    }
    
    /**
     * Check if user is logged in
     * @returns {boolean} True if user is authenticated
     */
    isAuthenticated() {
        return !!this.currentUser;
    }
    
    /**
     * Login with email and password
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} Login result
     */
    async login(email, password) {
        if (!email || !password) {
            throw new Error('Email and password are required');
        }
        
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) {
                console.error('Login failed:', error.message);
                throw new Error(error.message || 'Login failed');
            }
            
            console.log('Login successful:', data.user?.email);
            return { success: true, user: data.user };
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }
    
    /**
     * Register new user
     * @param {string} email - User email
     * @param {string} password - User password
     * @param {string} username - Desired username
     * @returns {Promise<Object>} Registration result
     */
    async register(email, password, username) {
        if (!email || !password) {
            throw new Error('Email and password are required');
        }
        
        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }
        
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { username }
                }
            });
            
            if (error) {
                console.error('Registration failed:', error.message);
                throw new Error(error.message || 'Registration failed');
            }
            
            console.log('Registration successful:', data.user?.email);
            
            // Check if user needs email confirmation
            if (data.user && data.user.identities && data.user.identities.length === 0) {
                throw new Error('User already registered with this email');
            }
            
            return { 
                success: true, 
                user: data.user,
                needsConfirmation: true
            };
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    }
    
    /**
     * Logout current user
     * @returns {Promise<Object>} Logout result
     */
    async logout() {
        try {
            const { error } = await supabase.auth.signOut();
            
            if (error) {
                console.error('Logout failed:', error.message);
                throw new Error(error.message || 'Logout failed');
            }
            
            console.log('Logout successful');
            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    }
    
    /**
     * Reset password
     * @param {string} email - User email
     * @returns {Promise<Object>} Reset result
     */
    async resetPassword(email) {
        if (!email) {
            throw new Error('Email is required');
        }
        
        try {
            const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin
            });
            
            if (error) {
                throw new Error(error.message || 'Password reset failed');
            }
            
            return { success: true, data };
        } catch (error) {
            console.error('Password reset error:', error);
            throw error;
        }
    }
    
    /**
     * Update user profile
     * @param {Object} updates - Profile updates
     * @returns {Promise<Object>} Update result
     */
    async updateProfile(updates) {
        if (!this.currentUser) {
            throw new Error('User must be logged in to update profile');
        }
        
        try {
            const { data, error } = await supabase.auth.updateUser({
                data: updates
            });
            
            if (error) throw error;
            
            return { success: true, user: data.user };
        } catch (error) {
            console.error('Profile update error:', error);
            throw error;
        }
    }
    
    /**
     * Add auth state change listener
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    onAuthStateChange(callback) {
        this.listeners.push(callback);
        
        // Return unsubscribe function
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }
    
    /**
     * Notify all listeners
     * @param {string} event - Auth event
     * @param {Object|null} user - Current user
     */
    notifyListeners(event, user) {
        this.listeners.forEach(callback => {
            try {
                callback(event, user);
            } catch (error) {
                console.error('Auth listener error:', error);
            }
        });
    }
}

// Create and export singleton instance
export const authService = new AuthService();

// Export for global access (backward compatibility)
if (typeof window !== 'undefined') {
    window.authService = authService;
}
EOF

# Create services/profileService.js
cat > src/services/profileService.js << 'EOF'
// Profile Service - Centralized profile management
import { supabase } from '../lib/supabase.js';
import { showQuickStatus } from '../core/utils.js';

class ProfileService {
    constructor() {
        this.currentProfile = null;
    }
    
    /**
     * Load user profile
     * @param {string} username - Username to load (optional, defaults to current user)
     * @returns {Promise<Object>} Profile data
     */
    async loadProfile(username = null) {
        try {
            let targetUsername = username;
            
            // If no username provided, try to get current user's profile
            if (!targetUsername) {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    throw new Error('User not authenticated');
                }
                targetUsername = user.user_metadata?.username || user.email?.split('@')[0];
            }
            
            // In a real app, this would fetch from Supabase
            // For now, return mock data
            const mockProfile = {
                username: targetUsername,
                email: 'user@example.com',
                status: 'online',
                profilePic: null,
                signature: 'Retro gamer since \'99 🎮',
                signature_html: '<span style="color: #00ffff;">Retro gamer since \'99 🎮</span>',
                bio: 'Passionate about retro gaming and online matchmaking. Currently playing: SOCOM II, SOCOM 3, SOCOM CA, Twisted Metal Black Online, Ratchet Deadlocked, Killzone 1, and Warhawk!',
                background: '#1a1a2e',
                music: {
                    id: 'dQw4w9WgXcQ',
                    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                    title: 'Never Gonna Give You Up',
                    artist: 'Rick Astley',
                    type: 'youtube'
                },
                stats: {
                    favorites: 42,
                    posts: 128,
                    messages: 567
                },
                joinDate: '2023-01-15T10:30:00Z',
                lastActive: new Date().toISOString()
            };
            
            this.currentProfile = mockProfile;
            return { success: true, profile: mockProfile };
            
        } catch (error) {
            console.error('Failed to load profile:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Update user profile
     * @param {Object} updates - Profile updates
     * @returns {Promise<Object>} Update result
     */
    async updateProfile(updates) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error('User not authenticated');
            }
            
            // Update auth metadata
            const { error: authError } = await supabase.auth.updateUser({
                data: updates
            });
            
            if (authError) throw authError;
            
            // In a real app, update profile in a separate table
            if (this.currentProfile) {
                this.currentProfile = { ...this.currentProfile, ...updates };
            }
            
            showQuickStatus('Profile updated successfully!', 'success');
            return { success: true, profile: this.currentProfile };
            
        } catch (error) {
            console.error('Failed to update profile:', error);
            showQuickStatus('Failed to update profile', 'error');
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Upload profile picture
     * @param {File} file - Image file
     * @returns {Promise<Object>} Upload result
     */
    async uploadProfilePicture(file) {
        try {
            if (!file || !file.type.startsWith('image/')) {
                throw new Error('Please select a valid image file');
            }
            
            // In a real app, upload to Supabase Storage
            // For now, create a data URL
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const dataUrl = e.target.result;
                    if (this.currentProfile) {
                        this.currentProfile.profilePic = dataUrl;
                    }
                    showQuickStatus('Profile picture uploaded!', 'success');
                    resolve({ success: true, url: dataUrl });
                };
                reader.readAsDataURL(file);
            });
            
        } catch (error) {
            console.error('Failed to upload profile picture:', error);
            showQuickStatus('Failed to upload image', 'error');
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Set profile music
     * @param {string} youtubeUrl - YouTube URL
     * @returns {Promise<Object>} Set music result
     */
    async setProfileMusic(youtubeUrl) {
        try {
            // Extract YouTube ID
            const videoId = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)?.[1];
            
            if (!videoId) {
                throw new Error('Invalid YouTube URL');
            }
            
            // In a real app, fetch video metadata from YouTube API
            const musicData = {
                id: videoId,
                url: youtubeUrl,
                title: 'Custom Music',
                artist: 'YouTube',
                type: 'youtube'
            };
            
            if (this.currentProfile) {
                this.currentProfile.music = musicData;
            }
            
            showQuickStatus('Profile music updated!', 'success');
            return { success: true, music: musicData };
            
        } catch (error) {
            console.error('Failed to set profile music:', error);
            showQuickStatus('Failed to set music', 'error');
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get current profile
     * @returns {Object|null} Current profile
     */
    getCurrentProfile() {
        return this.currentProfile;
    }
}

// Create and export singleton instance
export const profileService = new ProfileService();

// Export for global access
if (typeof window !== 'undefined') {
    window.profileService = profileService;
}
EOF

# Create components/common/Button.js
cat > src/components/common/Button.js << 'EOF'
// Reusable Button Component
export class ROMButton extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        // Default attributes
        this.text = this.getAttribute('text') || 'Button';
        this.type = this.getAttribute('type') || 'primary';
        this.size = this.getAttribute('size') || 'medium';
        this.icon = this.getAttribute('icon') || '';
        this.loading = this.hasAttribute('loading');
        
        // Styles
        this.shadowRoot.innerHTML = \`
            <style>
                :host {
                    display: inline-block;
                }
                
                .button {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: var(--button-padding, 10px 20px);
                    border: none;
                    border-radius: 8px;
                    font-family: 'Orbitron', sans-serif;
                    font-weight: bold;
                    font-size: var(--button-font-size, 16px);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    position: relative;
                    overflow: hidden;
                    text-decoration: none;
                    user-select: none;
                }
                
                /* Button Types */
                .primary {
                    background: linear-gradient(180deg, #00d7ff, #00a8bf);
                    color: #000;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }
                
                .secondary {
                    background: linear-gradient(180deg, #6c757d, #495057);
                    color: white;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                
                .success {
                    background: linear-gradient(180deg, #28a745, #1e7e34);
                    color: white;
                }
                
                .danger {
                    background: linear-gradient(180deg, #dc3545, #c82333);
                    color: white;
                }
                
                .warning {
                    background: linear-gradient(180deg, #ffc107, #e0a800);
                    color: #000;
                }
                
                .retro {
                    background: linear-gradient(180deg, #ff33cc, #cc0099);
                    color: white;
                }
                
                /* Button Sizes */
                .small {
                    padding: 6px 12px;
                    font-size: 14px;
                }
                
                .medium {
                    padding: 10px 20px;
                    font-size: 16px;
                }
                
                .large {
                    padding: 14px 28px;
                    font-size: 18px;
                }
                
                /* Hover Effects */
                .button:hover:not(.loading):not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 224, 255, 0.3);
                }
                
                .primary:hover:not(.loading):not(:disabled) {
                    box-shadow: 0 4px 12px rgba(0, 224, 255, 0.3);
                }
                
                .retro:hover:not(.loading):not(:disabled) {
                    box-shadow: 0 4px 12px rgba(255, 51, 204, 0.3);
                }
                
                /* Active State */
                .button:active:not(.loading):not(:disabled) {
                    transform: translateY(0);
                }
                
                /* Disabled State */
                .button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                
                /* Loading State */
                .loading {
                    opacity: 0.8;
                    cursor: wait;
                }
                
                .loading::after {
                    content: '';
                    position: absolute;
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                
                /* Icon */
                .icon {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2em;
                }
            </style>
            
            <button class="button \${this.type} \${this.size} \${this.loading ? 'loading' : ''}">
                \${this.icon ? \`<span class="icon">\${this.icon}</span>\` : ''}
                <span class="text">\${this.text}</span>
            </button>
        \`;
        
        this.button = this.shadowRoot.querySelector('button');
    }
    
    connectedCallback() {
        // Add click event listener
        this.button.addEventListener('click', (e) => {
            if (this.loading || this.button.disabled) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            
            // Dispatch custom event
            this.dispatchEvent(new CustomEvent('rom-click', {
                detail: { 
                    text: this.text,
                    type: this.type 
                },
                bubbles: true,
                composed: true
            }));
        });
    }
    
    // Getters and setters for dynamic updates
    setLoading(loading) {
        this.loading = loading;
        if (loading) {
            this.button.classList.add('loading');
        } else {
            this.button.classList.remove('loading');
        }
    }
    
    setDisabled(disabled) {
        this.button.disabled = disabled;
    }
    
    setText(text) {
        this.text = text;
        const textSpan = this.shadowRoot.querySelector('.text');
        if (textSpan) {
            textSpan.textContent = text;
        }
    }
    
    setType(type) {
        this.type = type;
        const classList = this.button.classList;
        // Remove old type classes
        ['primary', 'secondary', 'success', 'danger', 'warning', 'retro'].forEach(cls => {
            classList.remove(cls);
        });
        // Add new type
        classList.add(type);
    }
}

// Register the custom element
customElements.define('rom-button', ROMButton);
EOF

# Create README.md
cat > README.md << 'EOF'
# ROM - RetroOnlineMatchmaking

## 🚀 Modular Refactoring Project

### Current Status: Phase 0 - Foundation Setup Complete

**Directory Structure:**
