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

  // 1. Render Layout (HTML is already in DOM from app.js fetch)
  // We just need to ensure it's visible
  const container = document.getElementById('app-content');
  if(container && container.innerHTML.trim() === '') {
      // Fallback if HTML failed to load
      container.innerHTML = '<div class="text-center text-red-400">Error loading interface. Refresh page.</div>';
      return;
  }

  // 2. Attach ALL Event Listeners (New Chat, Send, Close Modal, etc.)
  attachEventListeners();

  // 3. Load Contact List
  await loadContactList();
  
  // 4. Open specific chat if URL param exists
  if (targetUserId) {
    // Small delay to ensure list is rendered
    setTimeout(() => openChat(targetUserId), 300);
  }
}

function attachEventListeners() {
  // --- A. "New Conversation" Button Logic ---
  const btnNew = document.getElementById('btn-new-conversation');
  const modal = document.getElementById('new-dm-modal');
  const btnCancel = document.getElementById('cancel-new-dm');
  const formNew = document.getElementById('new-dm-form');

  if (btnNew && modal) {
    btnNew.addEventListener('click', () => {
      console.log('Opening New DM Modal');
      modal.classList.remove('hidden');
      // Focus input
      const input = document.getElementById('new-dm-username');
      if(input) setTimeout(() => input.focus(), 100);
    });
  }

  if (btnCancel && modal) {
    btnCancel.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  if (formNew && modal) {
    formNew.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById('new-dm-username');
      const username = usernameInput.value.trim();
      
      if (!username) return alert('Please enter a username');

      // Find user by username
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', username)
        .single();

      if (error || !profile) {
        alert('User not found. Please check the spelling.');
        return;
      }

      if (profile.id === currentUserId) {
        alert('You cannot message yourself!');
        return;
      }

      // Close modal and open chat
      modal.classList.add('hidden');
      usernameInput.value = ''; // Reset
      await openChat(profile.id);
    });
  }

  // --- B. Chat Input Send Logic ---
  // We use delegation or direct selection after DOM is ready
  const formSend = document.getElementById('dm-send-form');
  if (formSend) {
    // Remove old listeners by cloning (safety measure)
    const newForm = formSend.cloneNode(true);
    formSend.parentNode.replaceChild(newForm, formSend);

    newForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('dm-message-input');
      const content = input.value.trim();
      
      if (!content || !activeChatUserId) return;

      const btn = document.getElementById('btn-send-msg');
      if(btn) {
          btn.disabled = true;
          btn.textContent = '...';
      }

      try {
        const { error } = await supabase.from('direct_messages').insert([{
          sender_id: currentUserId,
          receiver_id: activeChatUserId,
          content: content
        }]);

        if (error) throw error;

        input.value = '';
        // Realtime will handle the display, but we force a reload just in case
        loadMessages(activeChatUserId); 
      } catch (err) {
        alert('Failed to send: ' + err.message);
      } finally {
        if(btn) {
            btn.disabled = false;
            btn.textContent = 'Send';
        }
      }
    });
  }
}

async function loadContactList() {
  const listEl = document.getElementById('dm-contact-list');
  if (!listEl) return;

  // Fetch unique users who have exchanged messages with current user
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
    listEl.innerHTML = `
      <div class="text-center py-8">
        <div class="text-4xl mb-2">💬</div>
        <p class="text-gray-400 text-sm">No conversations yet.</p>
        <button id="empty-state-new-btn" class="mt-4 text-cyan-400 hover:text-cyan-300 text-xs font-bold underline">Start one now</button>
      </div>`;
    
    // Attach listener to the empty state button too
    const emptyBtn = document.getElementById('empty-state-new-btn');
    if(emptyBtn) {
        emptyBtn.addEventListener('click', () => {
            const modal = document.getElementById('new-dm-modal');
            if(modal) modal.classList.remove('hidden');
        });
    }
    return;
  }

  const userIds = Array.from(contactsMap.keys());
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', userIds);

  if (!profiles) {
    listEl.innerHTML = '<div class="p-4 text-center text-red-400 text-sm">Error loading contacts.</div>';
    return;
  }

  listEl.innerHTML = profiles.map(profile => `
    <div onclick="window.openDM('${profile.id}')" 
         class="p-3 hover:bg-gray-700 cursor-pointer flex items-center gap-3 border-b border-gray-700/50 transition group">
      <img src="${profile.avatar_url || 'https://ui-avatars.com/api/?name=' + profile.username}" 
           class="w-10 h-10 rounded-full object-cover border border-gray-600 group-hover:border-cyan-400">
      <div class="flex-1 min-w-0">
        <h4 class="text-white font-bold truncate group-hover:text-cyan-400 transition">${profile.username}</h4>
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
  const emptyState = document.getElementById('dm-empty-state');
  const header = document.getElementById('dm-chat-header');
  const msgContainer = document.getElementById('dm-messages-container');
  const inputArea = document.getElementById('dm-input-area');

  if(emptyState) emptyState.classList.add('hidden');
  if(header) header.classList.remove('hidden');
  if(msgContainer) msgContainer.classList.remove('hidden');
  if(inputArea) inputArea.classList.remove('hidden');

  // Load Partner Info
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, avatar_url')
    .eq('id', userId)
    .single();
  
  if (profile) {
    const nameEl = document.getElementById('dm-header-name');
    const imgEl = document.getElementById('dm-header-avatar');
    if(nameEl) nameEl.textContent = profile.username;
    if(imgEl) imgEl.src = profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.username}`;
  }

  // Load Messages
  await loadMessages(userId);

  // Setup Realtime Listener
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

  if (messages.length === 0) {
      container.innerHTML = '<div class="text-center text-gray-500 text-sm py-4 italic">No messages yet. Say hi!</div>';
      return;
  }

  container.innerHTML = messages.map(msg => {
    const isMe = msg.sender_id === currentUserId;
    const alignClass = isMe ? 'justify-end' : 'justify-start';
    const bgClass = isMe ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-200';
    
    return `
      <div class="flex ${alignClass} animate-fade-in">
        <div class="max-w-[70%] rounded-lg p-3 ${bgClass} shadow-md break-words">
          <p class="text-sm">${escapeHtml(msg.content)}</p>
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
      loadMessages(partnerId);
    })
    .subscribe();
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
