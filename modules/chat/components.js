// modules/chat/components.js
import { formatMessageTime, linkifyText, sanitizeInput } from './utils.js';

/**
 * Renders a single chat message
 * @param {Object} msg - Message object from Supabase
 * @param {string} currentUserId - ID of the logged-in user
 * @param {string} displayName - The resolved username
 * @param {string} avatarUrl - The resolved avatar URL
 * @returns {string} HTML string
 */
export function renderMessage(msg, currentUserId, displayName, avatarUrl = '', profile = {}) {
  const isSystem = ['join', 'leave', 'game_invite'].includes(msg.message_type);
  const isOwn = msg.user_id === currentUserId;
  
  if (isSystem) {
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
  const profileCard = renderChatProfileCard(msg.user_id || msg.sender_id, displayName, avatarUrl, profile);

  return `
    <div class="message-group group mb-4 rounded-lg p-2 transition-colors hover:bg-gray-800/30" data-message-id="${escapeAttribute(msg.id)}">
      <div class="flex w-full flex-col ${isOwn ? 'items-end' : 'items-start'}">
        <div class="mb-1.5 flex max-w-full items-center gap-2">
            ${profileCard}
            <time class="text-xs text-gray-400 font-mono" datetime="${escapeAttribute(msg.created_at)}" title="${escapeAttribute(new Date(msg.created_at).toLocaleString())}">${timeString}</time>
            ${isOwn ? `<button onclick="window.chatActions.openMenu('${escapeAttribute(msg.id)}')" aria-label="Message options" class="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white transition ml-1"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/></svg></button>` : ''}
        </div>
        <div class="max-w-[95%] break-words rounded-lg border border-gray-700 px-3 py-2 text-sm leading-relaxed text-gray-200 sm:max-w-[85%] ${isOwn ? 'rounded-tl-none bg-cyan-900/40 text-cyan-50' : 'rounded-tr-none bg-gray-800'}">
          ${safeMessage}
        </div>
        ${msg.room_id && msg.id ? `<div id="sticker-reactions-${escapeAttribute(msg.id)}" data-content-reaction-target="chat_message" data-content-reaction-id="${escapeAttribute(msg.id)}"></div>` : ''}
        ${msg.is_edited ? '<span class="mt-1 text-[10px] italic text-gray-500">(edited)</span>' : ''}
      </div>
    </div>
  `;
}

function renderChatProfileCard(userId, displayName, avatarUrl, profile) {
  const username = escapeHtml(displayName || 'Anonymous');
  const href = userId ? `#/profile/${encodeURIComponent(userId)}` : '#';
  const rank = Array.isArray(profile.rank) ? profile.rank[0] : profile.rank;
  const rankText = rank?.name ? ` · ${escapeHtml(rank.name)}` : '';
  const motto = profile.motto ? `<span class="block truncate text-[10px] text-gray-200">${escapeHtml(profile.motto)}</span>` : '';
  const xp = Number.isFinite(Number(profile.xp_total)) ? `${Number(profile.xp_total).toLocaleString()} XP` : '';
  const bgValue = String(profile.gamercard_bg_value || '#1f2937');
  let backgroundStyle = 'background-color: #1f2937;';
  if (profile.gamercard_bg_type === 'image') {
    try {
      const imageUrl = new URL(bgValue, window.location.href);
      if (imageUrl.protocol === 'https:' || imageUrl.protocol === 'http:') {
        backgroundStyle = `background-image: url("${escapeAttribute(imageUrl.href)}"); background-size: cover; background-position: center;`;
      }
    } catch {
      backgroundStyle = 'background-color: #1f2937;';
    }
  } else if (profile.gamercard_bg_type === 'gradient' && /^[#(),.%\w\s-]+$/.test(bgValue)) {
    backgroundStyle = `background-image: ${bgValue};`;
  } else if (profile.gamercard_bg_type === 'color' && /^#[0-9a-f]{3,8}$/i.test(bgValue)) {
    backgroundStyle = `background-color: ${bgValue};`;
  }
  const safeAvatar = safeImageUrl(avatarUrl);

  return `
    <a href="${escapeAttribute(href)}" class="gamercard chat-gamercard relative block w-[min(100%,260px)] overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-md transition hover:border-cyan-400" aria-label="View ${username}'s profile">
      <span class="absolute inset-0" style="${backgroundStyle}; opacity: .72; filter: brightness(.82);"></span>
      <span class="absolute inset-0 bg-gradient-to-br from-black/40 to-black/20"></span>
      <span class="relative z-10 flex min-h-[76px] items-center gap-2 p-2">
        ${safeAvatar ? `<img src="${escapeAttribute(safeAvatar)}" alt="" class="h-10 w-10 shrink-0 rounded-full border border-cyan-500 object-cover">` : '<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-500 bg-cyan-800 font-bold text-white">?</span>'}
        <span class="min-w-0 flex-1 text-left">
          <span class="flex flex-wrap items-center gap-1"><span class="max-w-full truncate text-xs font-bold text-white">${username}</span>${rankText ? `<span class="truncate text-[9px] font-bold text-cyan-100">${rankText}</span>` : ''}</span>
          ${motto}
          ${xp ? `<span class="mt-1 block text-[10px] font-bold text-cyan-200">${xp}</span>` : ''}
        </span>
      </span>
    </a>
  `;
}

function escapeHtml(value) {
  const element = document.createElement('span');
  element.textContent = String(value ?? '');
  return element.innerHTML;
}

function safeImageUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value, window.location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function escapeAttribute(value) {
  return String(value ?? '').replace(/[&"'<>]/g, character => ({
    '&': '&amp;',
    '"': '&quot;',
    "'": '&#39;',
    '<': '&lt;',
    '>': '&gt;',
  })[character]);
}

/**
 * Renders a room item in the sidebar
 */
export function renderRoomItem(room, unreadCount = 0, isActive = false) {
  const activeClass = isActive ? 'bg-cyan-900/20 border-l-4 border-cyan-400' : 'border-l-4 border-transparent hover:bg-gray-700/50';
  const unreadBadge = unreadCount > 0 
    ? `<span class="bg-cyan-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-2 animate-pulse">${unreadCount}</span>` 
    : '';

  return `
    <div class="room-item p-3 mb-1 rounded cursor-pointer transition-all duration-200 ${activeClass}" 
         data-room-id="${room.id}">
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
 */
export function renderUserItem(user, showStatus = true) {
  const displayName = user.username || user.user_email?.split('@')[0] || 'Unknown';
  const statusColor = user.status === 'online' ? 'bg-green-500' : user.status === 'away' ? 'bg-yellow-500' : 'bg-gray-500';
  const statusGlow = user.status === 'online' ? 'shadow-[0_0_8px_rgba(34,197,94,0.6)]' : '';

  return `
    <div class="user-item p-2 hover:bg-gray-700/50 rounded-lg transition cursor-pointer flex items-center gap-3 group"
         onclick="window.chatModule.openDM('${user.user_id}')">
      <div class="relative">
        ${createUserAvatarLink(user.user_id, displayName, user.avatar_url || '')}
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
 * Creates a modal container
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
 * Clears all typing indicators
 */
export function clearTypingIndicators(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const indicators = container.querySelectorAll('.typing-indicator');
  indicators.forEach(el => el.remove());
}
