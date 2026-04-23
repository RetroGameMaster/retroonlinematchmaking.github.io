// modules/chat/components.js
import { createUserProfileLink, createUserAvatarLink } from '../../lib/userLinks.js';
import { formatMessageTime, linkifyText, sanitizeInput } from './utils.js';

/**
 * Renders a single chat message
 * @param {Object} msg - Message object from Supabase
 * @param {string} currentUserId - ID of the logged-in user
 * @returns {string} HTML string
 */
// Change the function signature to accept avatarUrl
export function renderMessage(msg, currentUserId, displayName, avatarUrl = '') {
  const isSystem = msg.message_type !== 'text';
  const isOwn = msg.user_id === currentUserId;
  
  if (isSystem) {
    // ... (system message logic remains same)
    let icon = '💬';
    if (msg.message_type === 'join') icon = '🔌';
    if (msg.message_type === 'leave') icon = '🔌';
    if (msg.message_type === 'game_invite') icon = '🎮';

    return `
      <div class="flex justify-center my-3 animate-fade-in">
        <span class="bg-gray-900/80 text-gray-400 text-xs px-3 py-1.5 rounded-full border border-gray-700 flex items-center gap-2 shadow-lg">
          <span>${icon}</span>
          <span>${sanitizeInput(msg.message)}</span>
        </span>
      </div>
    `;
  }

  const timeString = formatMessageTime(msg.created_at);
  const safeMessage = linkifyText(sanitizeInput(msg.message));

  return `
    <div class="message-group mb-4 hover:bg-gray-800/30 p-2 rounded-lg transition-colors group ${isOwn ? 'flex-row-reverse' : ''}" data-message-id="${msg.id}">
      <div class="flex items-start gap-3 max-w-full">
        
        <!-- Avatar -->
        <div class="flex-shrink-0 mt-1">
          ${createUserAvatarLink(msg.user_id, displayName, avatarUrl)} 
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <!-- Header: Name & Time -->
          <div class="flex items-baseline gap-2 ${isOwn ? 'justify-end' : ''}">
            ${createUserProfileLink(msg.user_id, displayName, msg.user_email)}
            <span class="text-xs text-gray-500 font-mono">${timeString}</span>
            ${isOwn ? `
              <button onclick="window.chatActions.openMenu('${msg.id}')" class="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white transition ml-1">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/></svg>
              </button>
            ` : ''}
          </div>

          <!-- Message Body -->
          <div class="text-gray-200 text-sm leading-relaxed break-words mt-1 ${isOwn ? 'text-right' : ''}">
            ${safeMessage}
          </div>
          
          ${msg.is_edited ? '<span class="text-[10px] text-gray-500 italic">(edited)</span>' : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders a room item in the sidebar
 * @param {Object} room 
 * @param {number} unreadCount 
 * @param {boolean} isActive 
 * @returns {string}
 */
export function renderRoomItem(room, unreadCount = 0, isActive = false) {
  const activeClass = isActive ? 'bg-cyan-900/20 border-l-4 border-cyan-400' : 'border-l-4 border-transparent hover:bg-gray-700/50';
  const unreadBadge = unreadCount > 0 
    ? `<span class="bg-cyan-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-2 animate-pulse">${unreadCount}</span>` 
    : '';

  return `
    <div class="room-item p-3 mb-1 rounded cursor-pointer transition-all duration-200 ${activeClass}" 
         data-room-id="${room.id}"
         onclick="window.chatModule.joinRoom('${room.id}')">
      <div class="flex justify-between items-center">
        <div class="flex items-center gap-2 overflow-hidden">
          <span class="text-lg">${room.console ? '🎮' : '#'}</span>
          <div class="truncate">
            <div class="font-bold text-gray-200 truncate">${room.name}</div>
            ${room.description ? `<div class="text-xs text-gray-500 truncate">${room.description}</div>` : ''}
          </div>
        </div>
        ${unreadBadge}
      </div>
    </div>
  `;
}

/**
 * Renders a user item in the online list or DM list
 * @param {Object} user 
 * @param {boolean} showStatus 
 * @returns {string}
 */
export function renderUserItem(user, showStatus = true) {
  const displayName = user.username || user.user_email?.split('@')[0] || 'Unknown';
  const statusColor = user.status === 'online' ? 'bg-green-500' : user.status === 'away' ? 'bg-yellow-500' : 'bg-gray-500';
  const statusGlow = user.status === 'online' ? 'shadow-[0_0_8px_rgba(34,197,94,0.6)]' : '';

  return `
    <div class="user-item p-2 hover:bg-gray-700/50 rounded-lg transition cursor-pointer flex items-center gap-3 group"
         onclick="window.chatModule.openDM('${user.user_id}')">
      <div class="relative">
        ${createUserAvatarLink(user.user_id, displayName)}
        ${showStatus ? `
          <span class="absolute bottom-0 right-0 w-2.5 h-2.5 ${statusColor} ${statusGlow} border-2 border-gray-800 rounded-full"></span>
        ` : ''}
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-semibold text-gray-200 group-hover:text-cyan-300 truncate">${displayName}</div>
        ${showStatus ? `<div class="text-[10px] text-gray-500 uppercase">${user.status || 'offline'}</div>` : ''}
      </div>
    </div>
  `;
}

/**
 * Renders the "Typing..." indicator
 * @param {Array} usernames - List of usernames currently typing
 * @returns {string}
 */
export function renderTypingIndicator(usernames) {
  if (!usernames || usernames.length === 0) return '';
  
  const text = usernames.length === 1 
    ? `${usernames[0]} is typing...` 
    : `${usernames.length} people are typing...`;

  return `
    <div class="typing-indicator flex items-center gap-2 px-4 py-2 text-xs text-cyan-400 italic animate-pulse">
      <div class="flex gap-1">
        <div class="w-1 h-1 bg-cyan-400 rounded-full animate-bounce" style="animation-delay: 0s"></div>
        <div class="w-1 h-1 bg-cyan-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
        <div class="w-1 h-1 bg-cyan-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
      </div>
      <span>${text}</span>
    </div>
  `;
}

/**
 * Creates a modal container (reusable)
 * @param {string} id 
 * @param {string} title 
 * @param {string} content 
 * @returns {string}
 */
export function createModal(id, title, content) {
  return `
    <div id="${id}" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm hidden">
      <div class="bg-gray-800 border border-cyan-500 rounded-xl shadow-[0_0_30px_rgba(6,182,212,0.3)] w-full max-w-md m-4 overflow-hidden animate-fade-in">
        <div class="bg-gray-900 p-4 border-b border-gray-700 flex justify-between items-center">
          <h3 class="text-lg font-bold text-cyan-400">${title}</h3>
          <button onclick="document.getElementById('${id}').classList.add('hidden')" class="text-gray-400 hover:text-white">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <div class="p-6">
          ${content}
        </div>
      </div>
    </div>
  `;
}
/**
 * Clears all typing indicators from a specific room or DM
 */
export function clearTypingIndicators(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const indicators = container.querySelectorAll('.typing-indicator');
  indicators.forEach(el => el.remove());
}
