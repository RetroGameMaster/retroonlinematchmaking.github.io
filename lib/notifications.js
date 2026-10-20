import { supabase } from './supabase.js';

let notifChannel = null;
let currentUserId = null;
let uiListenersAttached = false;

export async function initNotifications() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Could not check the current user for notifications:', error);
    return;
  }

  const bellButton = document.getElementById('nav-notif-bell');
  const notificationContainer = document.getElementById('nav-notification-container');
  const badge = document.getElementById('notif-badge');
  if (!user) {
    if (notifChannel) {
      await supabase.removeChannel(notifChannel);
      notifChannel = null;
    }
    currentUserId = null;
    notificationContainer?.classList.add('hidden');
    badge?.classList.add('hidden');
    return;
  }

  notificationContainer?.classList.remove('hidden');
  bellButton?.classList.remove('hidden');
  if (currentUserId !== user.id) {
    if (notifChannel) await supabase.removeChannel(notifChannel);
    currentUserId = user.id;
    setupRealtimeListener();
  }

  attachUIListeners();
  await loadAlerts();
}

async function loadAlerts() {
  if (!currentUserId) return;

  const [alertsResult, unreadResult] = await Promise.all([
    supabase
      .from('alerts')
      .select('id, user_id, type, title, message, link_url, is_read, created_at')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', currentUserId)
      .eq('is_read', false),
  ]);

  if (alertsResult.error) {
    console.error('Could not load notifications:', alertsResult.error);
    const list = document.getElementById('notif-list');
    if (list) {
      list.textContent = 'Notifications could not be loaded.';
      list.className = 'max-h-96 overflow-y-auto custom-scrollbar p-4 text-center text-red-300 text-sm';
    }
  } else {
    renderAlerts(alertsResult.data || []);
    const list = document.getElementById('notif-list');
    if (list) list.className = 'max-h-96 overflow-y-auto custom-scrollbar';
  }

  if (unreadResult.error) {
    console.error('Could not load unread notification count:', unreadResult.error);
  } else {
    updateBadgeCount(unreadResult.count || 0);
  }
}

function renderAlerts(alerts) {
  const list = document.getElementById('notif-list');
  if (!list) return;

  list.replaceChildren();
  if (alerts.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'p-4 text-center text-gray-500 text-sm';
    empty.textContent = 'No new notifications';
    list.appendChild(empty);
    return;
  }

  for (const alert of alerts) {
    const link = document.createElement('a');
    link.href = safeNotificationLink(alert.link_url);
    link.dataset.alertId = alert.id;
    link.className = `block p-3 hover:bg-gray-700 transition border-b border-gray-700/50 ${
      alert.is_read
        ? 'bg-transparent border-l-4 border-l-transparent'
        : 'bg-gray-700/50 border-l-4 border-l-cyan-500'
    }`;

    const topLine = document.createElement('div');
    topLine.className = 'flex justify-between items-start mb-1';
    const type = document.createElement('span');
    type.className = 'text-xs font-bold text-cyan-400 uppercase tracking-wider';
    type.textContent = String(alert.type || 'update').replaceAll('_', ' ');
    const time = document.createElement('span');
    time.className = 'text-[10px] text-gray-500';
    time.textContent = formatTime(alert.created_at);
    topLine.append(type, time);

    const title = document.createElement('h4');
    title.className = `text-sm mb-1 ${alert.is_read ? 'text-gray-400' : 'text-white font-semibold'}`;
    title.textContent = alert.title || 'Notification';
    const message = document.createElement('p');
    message.className = 'text-xs text-gray-400 line-clamp-2';
    message.textContent = alert.message || '';
    link.append(topLine, title, message);
    list.appendChild(link);
  }
}

function safeNotificationLink(link) {
  return typeof link === 'string' && link.startsWith('#/') ? link : '#/home';
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function updateBadgeCount(unreadCount) {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;

  if (unreadCount > 0) {
    badge.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function setupRealtimeListener() {
  if (!currentUserId) return;
  notifChannel = supabase
    .channel(`alerts:${currentUserId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'alerts',
      filter: `user_id=eq.${currentUserId}`,
    }, payload => {
      void loadAlerts();
      showToastPopup(payload.new);
    })
    .subscribe(status => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('Notification realtime subscription failed:', status);
      }
    });
}

function showToastPopup(alert) {
  let container = document.getElementById('toast-notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-notification-container';
    container.className = 'fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'pointer-events-auto w-[calc(100vw-2rem)] sm:w-auto sm:min-w-[300px] max-w-md bg-gray-800 border border-cyan-500/50 text-white p-4 rounded-lg shadow-2xl flex items-start gap-3 animate-fade-in-up backdrop-blur-md';

  const icon = document.createElement('div');
  icon.className = 'text-2xl';
  icon.textContent = alert.type?.includes('friend')
    ? '👥'
    : alert.type?.includes('message')
      ? '💬'
      : alert.type?.includes('achievement')
        ? '🏆'
        : '🎮';

  const content = document.createElement('div');
  content.className = 'flex-1';
  const title = document.createElement('h4');
  title.className = 'font-bold text-cyan-400 text-sm';
  title.textContent = alert.title || 'Notification';
  const message = document.createElement('p');
  message.className = 'text-xs text-gray-300 mt-1';
  message.textContent = alert.message || '';
  content.append(title, message);

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'text-gray-400 hover:text-white ml-2';
  dismiss.setAttribute('aria-label', 'Dismiss notification');
  dismiss.textContent = '✕';
  dismiss.addEventListener('click', () => toast.remove());
  toast.append(icon, content, dismiss);
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

function attachUIListeners() {
  if (uiListenersAttached) return;
  uiListenersAttached = true;

  const bellButton = document.getElementById('nav-notif-bell');
  const dropdown = document.getElementById('notif-dropdown');
  const markReadButton = document.getElementById('mark-all-read');
  const list = document.getElementById('notif-list');

  bellButton?.addEventListener('click', event => {
    event.stopPropagation();
    dropdown?.classList.toggle('hidden');
  });

  document.addEventListener('click', event => {
    if (dropdown && !dropdown.contains(event.target) && event.target !== bellButton) {
      dropdown.classList.add('hidden');
    }
  });

  markReadButton?.addEventListener('click', event => {
    event.stopPropagation();
    void markAllAsRead();
  });

  list?.addEventListener('click', event => {
    const link = event.target.closest('a[data-alert-id]');
    if (link) void markAsRead(link.dataset.alertId);
  });
}

async function markAsRead(alertId) {
  if (!currentUserId || !alertId) return;
  const { error } = await supabase
    .from('alerts')
    .update({ is_read: true })
    .eq('id', alertId)
    .eq('user_id', currentUserId)
    .eq('is_read', false);

  if (error) {
    console.error('Could not mark notification as read:', error);
    return;
  }
  await loadAlerts();
}

async function markAllAsRead() {
  if (!currentUserId) return;
  const { error } = await supabase
    .from('alerts')
    .update({ is_read: true })
    .eq('user_id', currentUserId)
    .eq('is_read', false);

  if (error) {
    console.error('Could not mark notifications as read:', error);
    return;
  }
  await loadAlerts();
}
