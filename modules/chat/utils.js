// modules/chat/utils.js

/**
 * Formats a timestamp into a readable relative time or short time string
 * @param {string|Date} timestamp 
 * @returns {string}
 */
export function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * Formats a timestamp for the message bubble (HH:MM AM/PM)
 * @param {string|Date} timestamp 
 * @returns {string}
 */
export function formatMessageTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Sanitizes user input to prevent XSS attacks
 * @param {string} str 
 * @returns {string}
 */
export function sanitizeInput(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Detects URLs in text and converts them to clickable links
 * @param {string} text 
 * @returns {string} HTML string
 */
export function linkifyText(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (url) => {
    // Simple YouTube embed detection
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.split(/(vi\/|v=|\/)([^#&?]*).*/)[2];
      if (videoId) {
        return `<div class="my-2 rounded overflow-hidden border border-gray-700"><iframe src="https://www.youtube.com/embed/${videoId}" class="w-full aspect-video" frameborder="0" allowfullscreen></iframe></div><a href="${url}" target="_blank" class="text-cyan-400 hover:underline text-xs break-all">${url}</a>`;
      }
    }
    // Image detection
    if (url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
      return `<div class="my-2"><img src="${url}" alt="Image" class="max-w-full h-auto rounded border border-gray-700 hover:scale-105 transition-transform cursor-pointer" onclick="window.open('${url}', '_blank')"></div><a href="${url}" target="_blank" class="text-cyan-400 hover:underline text-xs break-all">${url}</a>`;
    }
    
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-cyan-400 hover:text-cyan-300 hover:underline break-all">${url}</a>`;
  });
}

/**
 * Generates a unique ID for temporary optimistic UI updates
 * @returns {string}
 */
export function generateTempId() {
  return 'temp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

/**
 * Truncates long text with ellipsis
 * @param {string} str 
 * @param {number} maxLength 
 * @returns {string}
 */
export function truncate(str, maxLength) {
  if (!str) return '';
  return str.length > maxLength ? str.substring(0, maxLength - 3) + '...' : str;
}
