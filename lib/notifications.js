import { supabase } from './supabase.js';

let notifChannel = null;
let currentUserId = null;

/**
 * Initialize the Notification System
 * Call this in your main app.js after auth is ready
 */
export async function initNotifications() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  currentUserId = user.id;
  
  // 1. Initial Load
  await loadAlerts();

  // 2. Setup Realtime Listener
  setupRealtimeListener();

  // 3. Attach UI Event Listeners
  attachUIListeners();
}

/**
 * Fetch alerts from DB and render them
 */
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

/**
 * Render the list of alerts in the dropdown
 */
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
    
    // Format time
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

/**
 * Update the red badge count
 */
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

/**
 * Listen for new alerts via Supabase Realtime
 */
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
      // New alert received!
      console.log('🔔 New Alert:', payload.new);
      
      // Reload list to include new one
      loadAlerts();
      
      // Optional: Play a sound or show a toast here
      // playNotificationSound(); 
    })
    .subscribe();
}

/**
 * Handle Click Events (Toggle Dropdown, Mark Read)
 */
function attachUIListeners() {
  const bellBtn = document.getElementById('nav-notif-bell');
  const dropdown = document.getElementById('notif-dropdown');
  const markReadBtn = document.getElementById('mark-all-read');

  // Toggle Dropdown
  if (bellBtn) {
    bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
      // If opening, maybe mark as seen? (Optional)
    });
  }

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (dropdown && !dropdown.contains(e.target) && e.target !== bellBtn) {
      dropdown.classList.add('hidden');
    }
  });

  // Mark All Read
  if (markReadBtn) {
    markReadBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await markAllAsRead();
    });
  }
}

/**
 * Mark all alerts as read in DB
 */
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

  // Refresh UI
  await loadAlerts();
}

// Optional: Simple beep sound
function playNotificationSound() {
  const audio = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU...'); // Short beep base64
  audio.volume = 0.2;
  audio.play().catch(() => {});
}
