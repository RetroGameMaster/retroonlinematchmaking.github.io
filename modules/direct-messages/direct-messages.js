import { supabase } from '../../lib/supabase.js';

let currentUserId = null;
let activeChatUserId = null;
let dmChannel = null;

export default async function initModule(rom, params) {
  console.log('💬 Direct Messages module initialized');
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    document.getElementById('app-content').innerHTML = '<div class="text-center text-red-400 mt-10">Please log in to view messages.</div>';
    return;
  }
  currentUserId = user.id;

  // Check if a specific user was selected via URL (?user=UUID)
  const targetUserId = params?.user || null;

  renderLayout();
  await loadContactList();
  
  if (targetUserId) {
    await openChat(targetUserId);
  }
}

function renderLayout() {
  // Content is injected from HTML file usually, but ensuring structure exists
  // If your app.js loads HTML automatically, this function might be empty or just setup logic.
  // Assuming app.js loads the HTML file above automatically based on route.
}

async function loadContactList() {
  const listEl = document.getElementById('dm-contact-list');
  if (!listEl) return;

  // Fetch unique users who have exchanged messages with current user
  // We combine sent and received messages to find all contacts
  const { data: sentMsgs } = await supabase
    .from('direct_messages')
    .select('receiver_id, created_at')
    .eq('sender_id', currentUserId)
    .order('created_at', { ascending: false });

  const { data: recvMsgs } = await supabase
    .from('direct_messages')
    .select('sender_id, created_at')
    .eq('receiver_id', currentUserId)
    .order('created_at', { ascending: false });

  // Merge and get unique user IDs
  const contactsMap = new Map();
  
  if (sentMsgs) sentMsgs.forEach(m => {
    if (!contactsMap.has(m.receiver_id) || new Date(m.created_at) > new Date(contactsMap.get(m.receiver_id))) {
      contactsMap.set(m.receiver_id, m.created_at);
    }
  });
  
  if (recvMsgs) recvMsgs.forEach(m => {
    if (!contactsMap.has(m.sender_id) || new Date(m.created_at) > new Date(contactsMap.get(m.sender_id))) {
      contactsMap.set(m.sender_id, m.created_at);
    }
  });

  if (contactsMap.size === 0) {
    listEl.innerHTML = '<div class="p-4 text-center text-gray-500 text-sm">No conversations yet.</div>';
    return;
  }

  // Fetch profile details for these users
  const userIds = Array.from(contactsMap.keys());
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', userIds);

  if (!profiles) {
    listEl.innerHTML = '<div class="p-4 text-center text-red-400 text-sm">Error loading contacts.</div>';
    return;
  }

  // Sort by latest message time (approximate using map values) and render
  // Note: A more robust way is to fetch the last message content too, but this works for list
  listEl.innerHTML = profiles.map(profile => `
    <div onclick="window.openDM('${profile.id}')" 
         class="p-3 hover:bg-gray-700 cursor-pointer flex items-center gap-3 border-b border-gray-700/50 transition">
      <img src="${profile.avatar_url || 'https://ui-avatars.com/api/?name=' + profile.username}" 
           class="w-10 h-10 rounded-full object-cover border border-gray-600">
      <div class="flex-1 min-w-0">
        <h4 class="text-white font-bold truncate">${profile.username}</h4>
        <p class="text-xs text-gray-400 truncate">Click to chat</p>
      </div>
    </div>
  `).join('');
}

// Expose function to window for HTML onclick
window.openDM = async function(userId) {
  await openChat(userId);
};

async function openChat(userId) {
  activeChatUserId = userId;
  
  // UI Updates
  document.getElementById('dm-empty-state').classList.add('hidden');
  document.getElementById('dm-chat-header').classList.remove('hidden');
  document.getElementById('dm-messages-container').classList.remove('hidden');
  document.getElementById('dm-input-area').classList.remove('hidden');

  // Load Partner Info
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, avatar_url')
    .eq('id', userId)
    .single();
  
  if (profile) {
    document.getElementById('dm-header-name').textContent = profile.username;
    document.getElementById('dm-header-avatar').src = profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.username}`;
  }

  // Load Messages
  await loadMessages(userId);

  // Setup Realtime Listener for this conversation
  setupDMListener(userId);
}

async function loadMessages(partnerId) {
  const container = document.getElementById('dm-messages-container');
  if (!container) return;

  const { data, error } = await supabase
    .from('direct_messages')
    .select('*')
    .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${currentUserId})`)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error loading messages:', error);
    return;
  }

  renderMessages(data || []);
}

function renderMessages(messages) {
  const container = document.getElementById('dm-messages-container');
  if (!container) return;

  container.innerHTML = messages.map(msg => {
    const isMe = msg.sender_id === currentUserId;
    const alignClass = isMe ? 'justify-end' : 'justify-start';
    const bgClass = isMe ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-200';
    
    return `
      <div class="flex ${alignClass}">
        <div class="max-w-[70%] rounded-lg p-3 ${bgClass} shadow-md">
          <p class="text-sm break-words">${escapeHtml(msg.content)}</p>
          <span class="text-[10px] opacity-70 block text-right mt-1">
            ${new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </span>
        </div>
      </div>
    `;
  }).join('');

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function setupDMListener(partnerId) {
  if (dmChannel) supabase.removeChannel(dmChannel);

  dmChannel = supabase.channel(`dm:${currentUserId}:${partnerId}`);

  dmChannel
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'direct_messages',
      filter: `or(and(sender_id.eq.${currentUserId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${currentUserId}))`
    }, (payload) => {
      // New message received in this chat
      const container = document.getElementById('dm-messages-container');
      // Simple append logic (re-rendering all is safer for ordering, but append is faster)
      // For simplicity, let's just reload messages to ensure order
      loadMessages(partnerId);
      
      // If message is from other person, mark their alerts as read? (Optional advanced step)
    })
    .subscribe();
}

// Handle Sending
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('dm-send-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('dm-message-input');
      const content = input.value.trim();
      
      if (!content || !activeChatUserId) return;

      const { error } = await supabase.from('direct_messages').insert([{
        sender_id: currentUserId,
        receiver_id: activeChatUserId,
        content: content
      }]);

      if (error) {
        alert('Failed to send: ' + error.message);
      } else {
        input.value = '';
        // Message will appear via Realtime listener
        loadMessages(activeChatUserId); 
      }
    });
  }
});

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
