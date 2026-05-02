import { supabase } from './supabase.js';

let notifChannel = null;
let currentUserId = null;

/**
 * Initialize the Notification System
 */
export async function initNotifications() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  currentUserId = user.id;
  
  // 1. Initial Load
  await loadAlerts();

  // 2. Setup Realtime Listener (Now triggers popups)
  setupRealtimeListener();

  // 3. Attach UI Event Listeners
  attachUIListeners();
}

async function loadAlerts() {
  if (!currentUserId) return;

  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', currentUserId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error loading alerts:', error);
    return;
  }

  renderAlerts(data || []);
  updateBadgeCount(data || []);
}

function renderAlerts(alerts) {
  const listEl = document.getElementById('notif-list');
  if (!listEl) return;

  if (alerts.length === 0) {
    listEl.innerHTML = `
      <div class="p-4 text-center text-gray-500 text-sm">
        <div class="text-2xl mb-2">🔕</div>
        No new notifications
      </div>`;
    return;
  }

  listEl.innerHTML = alerts.map(alert => {
    const isUnread = !alert.is_read;
    const bgClass = isUnread ? 'bg-gray-700/50 border-l-4 border-l-cyan-500' : 'bg-transparent border-l-4 border-l-transparent';
    const textClass = isUnread ? 'text-white font-semibold' : 'text-gray-400';
    const date = new Date(alert.created_at);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `
      <a href="${alert.link_url || '#'}" class="block p-3 hover:bg-gray-700 transition border-b border-gray-700/50 ${bgClass}">
        <div class="flex justify-between items-start mb-1">
          <span class="text-xs font-bold text-cyan-400 uppercase tracking-wider">${alert.type.replace('_', ' ')}</span>
          <span class="text-[10px] text-gray-500">${timeStr}</span>
        </div>
        <h4 class="text-sm ${textClass} mb-1">${alert.title}</h4>
        <p class="text-xs text-gray-400 line-clamp-2">${alert.message}</p>
      </a>
    `;
  }).join('');
}

function updateBadgeCount(alerts) {
  const badgeEl = document.getElementById('notif-badge');
  if (!badgeEl) return;

  const unreadCount = alerts.filter(a => !a.is_read).length;

  if (unreadCount > 0) {
    badgeEl.textContent = unreadCount > 9 ? '9+' : unreadCount;
    badgeEl.classList.remove('hidden');
  } else {
    badgeEl.classList.add('hidden');
  }
}

function setupRealtimeListener() {
  if (notifChannel) supabase.removeChannel(notifChannel);

  notifChannel = supabase.channel(`alerts:${currentUserId}`);

  notifChannel
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'alerts',
      filter: `user_id=eq.${currentUserId}`
    }, (payload) => {
      const newAlert = payload.new;
      console.log('🔔 New Alert Received:', newAlert);
      
      // 1. Reload list & badge
      loadAlerts();
      
      // 2. SHOW POPUP TOAST
      showToastPopup(newAlert);
      
      // 3. Optional: Play sound
      // playNotificationSound(); 
    })
    .subscribe();
}

// ============================================================================
// NEW: Toast Popup Function
// ============================================================================
function showToastPopup(alert) {
  // Create container if it doesn't exist
  let container = document.getElementById('toast-notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-notification-container';
    container.className = 'fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none';
    document.body.appendChild(container);
  }

  // Determine Icon based on type
  let icon = '🔔';
  if (alert.type.includes('friend')) icon = '👥';
  if (alert.type.includes('message')) icon = '💬';
  if (alert.type.includes('game')) icon = '🎮';

  // Create Toast Element
  const toast = document.createElement('div');
  toast.className = 'pointer-events-auto bg-gray-800 border border-cyan-500/50 text-white p-4 rounded-lg shadow-2xl flex items-start gap-3 min-w-[300px] max-w-md animate-fade-in-up backdrop-blur-md';
  toast.innerHTML = `
    <div class="text-2xl">${icon}</div>
    <div class="flex-1">
      <h4 class="font-bold text-cyan-400 text-sm">${alert.title}</h4>
      <p class="text-xs text-gray-300 mt-1">${alert.message}</p>
      ${alert.link_url ? `
        <a href="${alert.link_url}" class="inline-block mt-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 px-3 py-1 rounded transition">
          View
        </a>
      ` : ''}
    </div>
    <button onclick="this.parentElement.remove()" class="text-gray-400 hover:text-white ml-2">✕</button>
  `;

  container.appendChild(toast);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

function attachUIListeners() {
  const bellBtn = document.getElementById('nav-notif-bell');
  const dropdown = document.getElementById('notif-dropdown');
  const markReadBtn = document.getElementById('mark-all-read');

  if (bellBtn) {
    bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
    });
  }

  document.addEventListener('click', (e) => {
    if (dropdown && !dropdown.contains(e.target) && e.target !== bellBtn) {
      dropdown.classList.add('hidden');
    }
  });

  if (markReadBtn) {
    markReadBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await markAllAsRead();
    });
  }
}

async function markAllAsRead() {
  if (!currentUserId) return;

  const { error } = await supabase
    .from('alerts')
    .update({ is_read: true })
    .eq('user_id', currentUserId)
    .eq('is_read', false);

  if (error) {
    console.error('Error marking read:', error);
    return;
  }

  await loadAlerts();
}

function playNotificationSound() {
  // Optional: Add a short beep sound here
  const audio = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU...'); 
  audio.volume = 0.2;
  audio.play().catch(() => {});
}
