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

  const targetUserId = params?.user || null;

  // Ensure HTML is loaded before running logic
  setTimeout(() => {
    loadContactList();
    attachGlobalListeners(); // Attach listeners here instead of DOMContentLoaded
    
    if (targetUserId) {
      openChat(targetUserId);
    }
  }, 100);
}

// NEW: Function to handle "Start New Conversation"
window.openNewConversationModal = function() {
  const modal = document.getElementById('new-dm-modal');
  if (!modal) {
    alert('Error: Modal not found in HTML.');
    return;
  }
  modal.classList.remove('hidden');
  const input = document.getElementById('new-dm-username');
  if(input) input.focus();
};

// NEW: Function to actually start the chat
window.startNewConversation = async function() {
  const usernameInput = document.getElementById('new-dm-username');
  const username = usernameInput ? usernameInput.value.trim() : '';
  
  if (!username) {
    alert('Please enter a username.');
    return;
  }

  // 1. Find User by Username
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', username)
    .single();

  if (fetchError || !profile) {
    alert('User not found. Please check the spelling.');
    return;
  }

  if (profile.id === currentUserId) {
    alert('You cannot message yourself.');
    return;
  }

  // 2. Close Modal
  const modal = document.getElementById('new-dm-modal');
  if(modal) modal.classList.add('hidden');
  if(usernameInput) usernameInput.value = '';

  // 3. Open Chat
  console.log('Starting chat with:', profile.id);
  await openChat(profile.id);
  
  // 4. Refresh list to show new contact
  await loadContactList();
};

function attachGlobalListeners() {
  console.log('🔌 Attaching DM Listeners...');

  // 1. "New Message" / "Start New Conversation" Buttons
  const btns = [
    document.getElementById('btn-new-message'),
    document.getElementById('btn-new-conversation'),
    document.getElementById('btn-start-new') 
  ];

  btns.forEach(btn => {
    if (btn) {
      // Remove old listeners by cloning
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Clicked New Conversation Button');
        if (!currentUserId) return alert('Please log in.');
        window.openNewConversationModal();
      });
    }
  });

  // 2. Modal Cancel Button
  const btnCancel = document.getElementById('cancel-new-dm');
  if (btnCancel) {
    const newCancel = btnCancel.cloneNode(true);
    btnCancel.parentNode.replaceChild(newCancel, btnCancel);
    newCancel.addEventListener('click', () => {
      const modal = document.getElementById('new-dm-modal');
      if(modal) modal.classList.add('hidden');
    });
  }

  // 3. Chat Input Form (Only if chat is open)
  const form = document.getElementById('dm-send-form');
  if (form) {
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    
    newForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('dm-message-input');
      const content = input ? input.value.trim() : '';
      
      if (!content || !activeChatUserId) return;

      const { error } = await supabase.from('direct_messages').insert([{
        sender_id: currentUserId,
        receiver_id: activeChatUserId,
        content: content
      }]);

      if (error) {
        alert('Failed to send: ' + error.message);
      } else {
        if(input) input.value = '';
        loadMessages(activeChatUserId); 
      }
    });
  }
}

async function loadContactList() {
  const listEl = document.getElementById('dm-contact-list');
  if (!listEl) return;

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
        <p class="text-gray-500 mb-4">No conversations yet.</p>
        <button onclick="window.openNewConversationModal()" class="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-bold">
          Start New Conversation
        </button>
      </div>`;
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

window.openDM = async function(userId) {
  await openChat(userId);
};

async function openChat(userId) {
  activeChatUserId = userId;
  
  const emptyState = document.getElementById('dm-empty-state');
  const header = document.getElementById('dm-chat-header');
  const container = document.getElementById('dm-messages-container');
  const inputArea = document.getElementById('dm-input-area');

  if(emptyState) emptyState.classList.add('hidden');
  if(header) header.classList.remove('hidden');
  if(container) container.classList.remove('hidden');
  if(inputArea) inputArea.classList.remove('hidden');

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, avatar_url')
    .eq('id', userId)
    .single();
  
  if (profile) {
    const nameEl = document.getElementById('dm-header-name');
    const avatarEl = document.getElementById('dm-header-avatar');
    if(nameEl) nameEl.textContent = profile.username;
    if(avatarEl) avatarEl.src = profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.username}`;
  }

  await loadMessages(userId);
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
