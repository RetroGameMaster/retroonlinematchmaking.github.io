// modules/utils/user-utils.js
export function createUsernameElement(user, options = {}) {
    const {
        showAvatar = true,
        showConsole = false,
        size = 'medium', // 'small', 'medium', 'large'
        clickable = true,
        linkToProfile = true
    } = options;
    
    const avatarUrl = user.avatar_url || null;
    const username = user.username || user.email.split('@')[0];
    const email = user.email;
    const firstLetter = username.charAt(0).toUpperCase();
    
    // Size classes
    const sizeClasses = {
        small: {
            avatar: 'w-6 h-6 text-xs',
            text: 'text-sm',
            container: 'gap-2'
        },
        medium: {
            avatar: 'w-8 h-8 text-sm',
            text: 'text-base',
            container: 'gap-3'
        },
        large: {
            avatar: 'w-12 h-12 text-lg',
            text: 'text-lg font-semibold',
            container: 'gap-4'
        }
    };
    
    const sizeConfig = sizeClasses[size] || sizeClasses.medium;
    
    // Create container
    const container = document.createElement('div');
    container.className = `flex items-center ${sizeConfig.container} user-container`;
    container.setAttribute('data-user-id', user.id);
    container.setAttribute('data-user-email', email);
    
    // Avatar
    if (showAvatar) {
        const avatarDiv = document.createElement('div');
        avatarDiv.className = `relative flex-shrink-0 ${sizeConfig.avatar} rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center overflow-hidden`;
        
        if (avatarUrl) {
            const img = document.createElement('img');
            img.src = avatarUrl;
            img.alt = username;
            img.className = 'w-full h-full object-cover';
            avatarDiv.appendChild(img);
        } else {
            const letterSpan = document.createElement('span');
            letterSpan.className = 'text-white font-bold';
            letterSpan.textContent = firstLetter;
            avatarDiv.appendChild(letterSpan);
        }
        
        // Online status indicator (placeholder)
        const onlineIndicator = document.createElement('div');
        onlineIndicator.className = 'absolute -bottom-1 -right-1 w-3 h-3 bg-gray-600 rounded-full border-2 border-gray-800';
        avatarDiv.appendChild(onlineIndicator);
        
        container.appendChild(avatarDiv);
    }
    
    // Username and info
    const infoDiv = document.createElement('div');
    
    // Username element - make it clickable
    const usernameElement = document.createElement(clickable ? 'a' : 'span');
    
    if (clickable && linkToProfile) {
        usernameElement.href = `#/profile/${user.id}`;
        usernameElement.className = `${sizeConfig.text} font-medium text-white hover:text-cyan-300 transition cursor-pointer`;
        usernameElement.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.hash = `#/profile/${user.id}`;
        });
    } else {
        usernameElement.className = `${sizeConfig.text} font-medium text-white`;
    }
    
    usernameElement.textContent = username;
    usernameElement.setAttribute('data-username', username);
    
    infoDiv.appendChild(usernameElement);
    
    // Additional info
    if (showConsole && user.favorite_console) {
        const consoleSpan = document.createElement('span');
        consoleSpan.className = 'block text-gray-400 text-xs mt-1';
        consoleSpan.textContent = `🎮 ${user.favorite_console}`;
        infoDiv.appendChild(consoleSpan);
    }
    
    // Email for admin panels
    if (options.showEmail) {
        const emailSpan = document.createElement('span');
        emailSpan.className = 'block text-gray-500 text-xs';
        emailSpan.textContent = email;
        infoDiv.appendChild(emailSpan);
    }
    
    container.appendChild(infoDiv);
    
    return container;
}

// Function to make existing usernames clickable
export function makeUsernamesClickable(container = document.body) {
    // Find all username-like elements
    const usernameSelectors = [
        '[data-username]',
        '.username',
        '.user-name',
        '.profile-link',
        'div:has(> span.username)',
        'td:has(> div > span:first-child)' // For table cells
    ];
    
    usernameSelectors.forEach(selector => {
        container.querySelectorAll(selector).forEach(element => {
            const userId = element.closest('[data-user-id]')?.getAttribute('data-user-id') ||
                          element.getAttribute('data-user-id');
            
            if (userId && !element.hasAttribute('data-clickable-processed')) {
                element.style.cursor = 'pointer';
                element.classList.add('hover:text-cyan-300', 'transition');
                element.setAttribute('data-clickable-processed', 'true');
                
                element.addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.location.hash = `#/profile/${userId}`;
                });
            }
        });
    });
    
    // Also look for email addresses that might be usernames
    container.querySelectorAll('[href*="mailto:"]').forEach(element => {
        const email = element.href.replace('mailto:', '');
        if (email.includes('@')) {
            element.setAttribute('data-user-email', email);
            element.style.cursor = 'pointer';
        }
    });
}

// Function to extract user info from an element
export function getUserInfoFromElement(element) {
    const userId = element.getAttribute('data-user-id') || 
                  element.closest('[data-user-id]')?.getAttribute('data-user-id');
    const email = element.getAttribute('data-user-email') || 
                 element.closest('[data-user-email]')?.getAttribute('data-user-email');
    const username = element.getAttribute('data-username') || 
                    element.closest('[data-username]')?.getAttribute('data-username') ||
                    element.textContent.trim();
    
    return { userId, email, username };
}
