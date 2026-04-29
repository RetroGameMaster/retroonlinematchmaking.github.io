// modules/lib/notifications.js
import { supabase } from './supabase.js';

export async function fetchUnreadCount(userId) {
    if (!userId) return 0;
    const { count } = await supabase
        .from('alerts')
        .select('*', { head: true, count: 'exact' })
        .eq('user_id', userId)
        .eq('is_read', false);
    return count || 0;
}

export async function fetchRecentAlerts(userId, limit = 5) {
    if (!userId) return [];
    const { data } = await supabase
        .from('alerts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
    return data || [];
}

export async function markAllAsRead(userId) {
    if (!userId) return;
    await supabase
        .from('alerts')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
}

export function renderNotificationItem(alert) {
    const date = new Date(alert.created_at).toLocaleDateString();
    const bgClass = alert.is_read ? 'bg-gray-800' : 'bg-gray-700/50 border-l-4 border-cyan-500';
    
    return `
        <a href="${alert.link_url || '#'}" class="block p-3 hover:bg-gray-700 transition ${bgClass}">
            <div class="flex justify-between items-start">
                <h4 class="text-sm font-bold text-white">${escapeHtml(alert.title)}</h4>
                <span class="text-[10px] text-gray-500">${date}</span>
            </div>
            <p class="text-xs text-gray-400 mt-1 line-clamp-2">${escapeHtml(alert.message)}</p>
        </a>
    `;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
