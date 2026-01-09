// lib/userLinks.js - User Profile Link Utilities - FIXED VERSION

/**
 * Creates a clickable username link that navigates to user profile
 * @param {string} userId - User ID
 * @param {string} displayName - Username to display
 * @param {string} email - User email (fallback)
 * @returns {string} HTML string for clickable username
 */
export function createUserProfileLink(userId, displayName, email = '') {
    if (!userId || !displayName) {
        return displayName || 'User';
    }
    
    const name = displayName || email.split('@')[0] || 'User';
    return `
        <a href="#/profile/${userId}" 
           class="user-profile-link text-cyan-300 hover:text-cyan-200 hover:underline cursor-pointer font-semibold"
           data-user-id="${userId}"
           onclick="event.stopPropagation()">
            ${name}
        </a>
    `;
}

/**
 * Creates a user avatar with profile link
 * @param {string} userId - User ID
 * @param {string} displayName - Username for avatar fallback
 * @param {string} avatarUrl - Avatar image URL (optional)
 * @returns {string} HTML string for clickable avatar
 */
export function createUserAvatarLink(userId, displayName, avatarUrl = '') {
    const firstLetter = (displayName || 'U').charAt(0).toUpperCase();
    
    return `
        <a href="#/profile/${userId}" 
           class="user-avatar-link block"
           data-user-id="${userId}"
           onclick="event.stopPropagation()">
            <div class="relative inline-block">
                ${avatarUrl ? `
                    <img src="${avatarUrl}" 
                         alt="${displayName || 'User'}" 
                         class="w-8 h-8 rounded-full object-cover hover:ring-2 hover:ring-cyan-400 transition">
                ` : `
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white font-bold hover:ring-2 hover:ring-cyan-400 transition">
                        ${firstLetter}
                    </div>
                `}
            </div>
        </a>
    `;
}

/**
 * Creates a user card with profile link and info
 * @param {Object} user - User object with id, username, email, etc.
 * @returns {string} HTML string for user card
 */
export function createUserCard(user) {
    const username = user.username || user.user_email?.split('@')[0] || 'User';
    const firstLetter = username.charAt(0).toUpperCase();
    
    return `
        <div class="user-card p-3 hover:bg-gray-800 rounded-lg transition group">
            <a href="#/profile/${user.id}" 
               class="flex items-center gap-3"
               onclick="event.stopPropagation()">
                <div class="flex-shrink-0">
                    ${user.avatar_url ? `
                        <img src="${user.avatar_url}" 
                             alt="${username}" 
                             class="w-10 h-10 rounded-full object-cover group-hover:ring-2 group-hover:ring-cyan-400 transition">
                    ` : `
                        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white font-bold group-hover:ring-2 group-hover:ring-cyan-400 transition">
                            ${firstLetter}
                        </div>
                    `}
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="text-white font-semibold truncate">${username}</h4>
                    <p class="text-gray-400 text-sm truncate">${user.favorite_console ? `🎮 ${user.favorite_console}` : ''}</p>
                </div>
            </a>
        </div>
    `;
}

/**
 * Processes HTML content and replaces usernames with profile links
 * @param {string} html - HTML string to process
 * @param {Array} users - Array of user objects with id and username
 * @returns {string} Processed HTML with user links
 */
export function injectUserProfileLinks(html, users = []) {
    if (!html || !users.length) return html;
    
    let processedHtml = html;
    
    users.forEach(user => {
        const username = user.username || user.user_email?.split('@')[0];
        if (username) {
            const regex = new RegExp(`(?!<a[^>]*>)${username}(?!<\/a>)`, 'g');
            processedHtml = processedHtml.replace(
                regex, 
                createUserProfileLink(user.id, username, user.user_email)
            );
        }
    });
    
    return processedHtml;
}

// Attach to window for global access
window.createUserProfileLink = createUserProfileLink;
window.createUserAvatarLink = createUserAvatarLink;
window.createUserCard = createUserCard;
