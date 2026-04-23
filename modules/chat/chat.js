// modules/chat/chat.js
import { supabase, getCurrentUser } from '../../lib/supabase.js';
import { createUserProfileLink, createUserAvatarLink } from '../../lib/userLinks.js';
import { formatTime, sanitizeText } from './utils.js';
import { 
  renderMessage, renderRoomItem, renderUserItem, 
  renderTypingIndicator, clearTypingIndicators 
} from './components.js';
import { 
  subscribeToMessages, unsubscribeFromMessages, 
  sendTypingIndicator, subscribeToPresence, cleanupAllSubscriptions 
} from './realtime.js';

let currentRoom = null;
let currentDM = null; // If chatting with a specific user
let chatType = 'room'; // 'room' or 'dm'
let typingTimeout = null;
let currentUser = null;
let userProfile = null;

export function initModule(rom) {
  console.log('💬 Chat module initialized (v2.0)');
  window.rom = rom;
  
  // Cleanup old subscriptions
  cleanupAllSubscriptions();
  
  initializeChat();
}

async function initializeChat() {
  currentUser = await getCurrentUser();
  
  if (!currentUser) {
    showLoginPrompt();
    return;
  }
  
  // Fetch profile once
  userProfile = await getUserProfile(currentUser.id);
  
  loadChatInterface();
  loadSidebarData();
  
  // Setup Presence
  subscribeToPresence(() => {
    loadOnlineUsersList(); // Refresh sidebar list
    updateRoomUserCounts();
  });

  // Global typing listener
  window.addEventListener('chat:typing', handleTypingEvent);
  
  console.log('✅ Chat ready for:', userProfile?.username || currentUser.email);
}

function showLoginPrompt() {
  document.getElementById('app-content').innerHTML = `
    <div class="flex items-center justify-center min-h-[60vh]">
      <div class="text-center p-8 bg-gray-800 rounded-xl border border-cyan-500/30 shadow-lg">
        <div class="text-6xl mb-4">🔒</div>
        <h2 class="text-2xl font-bold text-cyan-400 mb-2">Login Required</h2>
        <p class="text-gray-400 mb-6">Join the conversation by logging in.</p>
        <a href="#/auth" class="inline-block bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg font-bold transition">
          Go to Login
        </a>
      </div>
    </div>
  `;
}

function loadChatInterface() {
  const app = document.getElementById('app-content');
  app.innerHTML = `
    <div class="flex flex-col h-[calc(100vh-100px)] gap-4">
      <!-- Header -->
      <div class="bg-gray-800 p-4 rounded-xl border border-cyan-500/30 flex justify-between items-center shadow-lg">
        <h1 class="text-2xl font-bold text-cyan-400 flex items-center gap-2">
          <span>💬</span> ROM Chat
        </h1>
        <div class="flex items-center gap-4">
          <div class="text-sm text-gray-400">
            Logged in as <span class="text-cyan-300 font-bold">${userProfile?.username || 'User'}</span>
          </div>
          <button onclick="window.location.hash='#/home'" class="text-gray-400 hover:text-white">
            ✕ Close
          </button>
        </div>
      </div>

      <!-- Main Grid -->
      <div class="flex flex-1 gap-4 overflow-hidden">
        
        <!-- Sidebar -->
        <div class="w-72 flex flex-col gap-4 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <!-- Tabs -->
          <div class="flex border-b border-gray-700">
            <button id="tab-rooms" class="flex-1 p-3 text-sm font-bold text-cyan-400 border-b-2 border-cyan-400 bg-gray-900/50">Rooms</button>
            <button id="tab-dms" class="flex-1 p-3 text-sm font-bold text-gray-400 hover:text-white">Direct Messages</button>
          </div>
          
          <!-- Content Area -->
          <div class="flex-1 overflow-y-auto p-2 space-y-2" id="sidebar-list">
            <!-- Loaded dynamically -->
            <div class="text-center text-gray-500 mt-4">Loading...</div>
          </div>
          
          <!-- Online Users Mini List -->
          <div class="p-3 border-t border-gray-700 bg-gray-900/50">
            <h3 class="text-xs font-bold text-gray-400 uppercase mb-2">Online Now</h3>
            <div id="mini-online-list" class="space-y-1 max-h-32 overflow-y-auto"></div>
          </div>
        </div>

        <!-- Chat Area -->
        <div class="flex-1 flex flex-col bg-gray-800 rounded-xl border border-cyan-500/30 overflow-hidden shadow-lg">
          <!-- Chat Header -->
          <div class="p-4 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
            <div>
              <h2 id="chat-header-title" class="text-xl font-bold text-white">Select a Room</h2>
              <p id="chat-header-subtitle" class="text-sm text-gray-400">Join a conversation to start chatting</p>
            </div>
            <div id="chat-actions" class="hidden"></div>
          </div>

          <!-- Messages -->
          <div id="messages-container" class="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
            <div class="text-center text-gray-500 mt-10">
              <p>Select a room or user to begin.</p>
            </div>
          </div>

          <!-- Typing Indicator -->
          <div id="typing-indicator" class="px-4 h-6 text-xs text-gray-400 italic"></div>

          <!-- Input -->
          <div class="p-4 border-t border-gray-700 bg-gray-900/50">
            <div class="flex gap-2">
              <input 
                id="message-input" 
                type="text" 
                placeholder="Type a message..." 
                class="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                disabled
              />
              <button 
                id="send-btn" 
                class="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-bold transition"
                disabled
              >
                Send
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  setupTabs();
  setupInputListeners();
}

function setupTabs() {
  const roomsTab = document.getElementById('tab-rooms');
  const dmsTab = document.getElementById('tab-dms');
  
  roomsTab.addEventListener('click', () => {
    roomsTab.classList.add('text-cyan-400', 'border-b-2', 'border-cyan-400', 'bg-gray-900/50');
    roomsTab.classList.remove('text-gray-400');
    dmsTab.classList.remove('text-cyan-400', 'border-b-2', 'border-cyan-400', 'bg-gray-900/50');
    dmsTab.classList.add('text-gray-400');
    loadRoomsList();
  });

  dmsTab.addEventListener('click', () => {
    dmsTab.classList.add('text-cyan-400', 'border-b-2', 'border-cyan-400', 'bg-gray-900/50');
    dmsTab.classList.remove('text-gray-400');
    roomsTab.classList.remove('text-cyan-400', 'border-b-2', 'border-cyan-400', 'bg-gray-900/50');
    roomsTab.classList.add('text-gray-400');
    loadDMsList();
  });

  // Initial Load
  loadRoomsList();
}

async function loadSidebarData() {
  loadRoomsList();
  loadOnlineUsersList();
}

async function loadRoomsList() {
  const listEl = document.getElementById('sidebar-list');
  if (!listEl) return;
  
  listEl.innerHTML = '<div class="text-center text-gray-500 mt-4">Loading rooms...</div>';

  try {
    const { data: rooms, error } = await supabase
      .from('chat_rooms')
      .select('*')
      .order('name');
    
    if (error) throw error;

    listEl.innerHTML = '';
    rooms.forEach(room => {
      const isActive = currentRoom === room.id && chatType === 'room';
      listEl.innerHTML += renderRoomItem(room, isActive, () => joinRoom(room.id));
    });

  } catch (err) {
    console.error(err);
    listEl.innerHTML = '<div class="text-red-400 text-center p-4">Failed to load rooms</div>';
  }
}

async function loadDMsList() {
  const listEl = document.getElementById('sidebar-list');
  if (!listEl) return;

  listEl.innerHTML = '<div class="text-center text-gray-500 mt-4">Loading messages...</div>';

  try {
    // Get unique users we've exchanged messages with
    const { data: messages, error } = await supabase
      .from('private_messages')
      .select('sender_id, recipient_id')
      .or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Extract unique user IDs (excluding self)
    const uniqueIds = new Set();
    const partners = [];
    
    if (messages) {
      messages.forEach(m => {
        const partnerId = m.sender_id === currentUser.id ? m.recipient_id : m.sender_id;
        if (partnerId !== currentUser.id && !uniqueIds.has(partnerId)) {
          uniqueIds.add(partnerId);
          partners.push(partnerId);
        }
      });
    }

    if (partners.length === 0) {
      listEl.innerHTML = '<div class="text-center text-gray-500 mt-4">No conversations yet.</div>';
      return;
    }

    // Fetch profiles for these users
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', partners);

    listEl.innerHTML = '';
    profiles.forEach(profile => {
      const isActive = currentDM === profile.id && chatType === 'dm';
      const dmObj = { id: profile.id, username: profile.username, avatar_url: profile.avatar_url };
      listEl.innerHTML += renderUserItem(dmObj, isActive, () => joinDM(profile.id, profile.username));
    });

  } catch (err) {
    console.error(err);
    listEl.innerHTML = '<div class="text-red-400 text-center p-4">Failed to load DMs</div>';
  }
}

async function loadOnlineUsersList() {
  const listEl = document.getElementById('mini-online-list');
  if (!listEl) return;

  try {
    const { data: users } = await supabase
      .from('online_users')
      .select('username, user_id, status')
      .gte('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .limit(10);

    if (!users || users.length === 0) {
      listEl.innerHTML = '<div class="text-xs text-gray-500">No one else online</div>';
      return;
    }

    listEl.innerHTML = users.map(u => `
      <div class="flex items-center gap-2 text-sm text-gray-300">
        <div class="w-2 h-2 rounded-full ${u.status === 'online' ? 'bg-green-500' : 'bg-yellow-500'}"></div>
        <span class="truncate">${u.username || 'Anonymous'}</span>
      </div>
    `).join('');

  } catch (e) { console.error(e); }
}

function setupInputListeners() {
  const input = document.getElementById('message-input');
  const btn = document.getElementById('send-btn');

  if (!input || !btn) return;

  const handleSend = () => {
    const text = input.value.trim();
    if (text && (currentRoom || currentDM)) {
      sendMessage(text);
      input.value = '';
      input.focus();
    }
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSend();
    
    // Typing indicator logic
    if (typingTimeout) clearTimeout(typingTimeout);
    const targetId = chatType === 'room' ? currentRoom : currentDM;
    if (targetId) {
      sendTypingIndicator(targetId, chatType, currentUser.id, userProfile?.username);
    }
    
    typingTimeout = setTimeout(() => {
      // Stop typing event handled by backend or timeout
    }, 2000);
  });

  btn.addEventListener('click', handleSend);
}

async function joinRoom(roomId) {
  currentRoom = roomId;
  currentDM = null;
  chatType = 'room';
  
  // Update UI Header
  const { data: room } = await supabase.from('chat_rooms').select().eq('id', roomId).single();
  document.getElementById('chat-header-title').textContent = room?.name || 'Room';
  document.getElementById('chat-header-subtitle').textContent = room?.description || '';
  
  // Enable Input
  const input = document.getElementById('message-input');
  const btn = document.getElementById('send-btn');
  if(input) input.disabled = false;
  if(btn) btn.disabled = false;

  // Load Messages
  loadMessages();
  
  // Subscribe
  subscribeToMessages(roomId, 'room', handleRealtimeMessage);
  
  // Refresh Sidebar Highlight
  loadRoomsList();
}

async function joinDM(userId, username) {
  currentDM = userId;
  currentRoom = null;
  chatType = 'dm';

  document.getElementById('chat-header-title').textContent = `@${username}`;
  document.getElementById('chat-header-subtitle').textContent = 'Direct Message';

  const input = document.getElementById('message-input');
  const btn = document.getElementById('send-btn');
  if(input) input.disabled = false;
  if(btn) btn.disabled = false;

  loadMessages();
  subscribeToMessages(userId, 'dm', handleRealtimeMessage);
  
  loadDMsList();
}

async function loadMessages() {
  const container = document.getElementById('messages-container');
  if (!container) return;
  container.innerHTML = '<div class="text-center text-gray-500 mt-4">Loading history...</div>';

  let query;
  if (chatType === 'room') {
    query = supabase.from('chat_messages').select('*').eq('room_id', currentRoom).order('created_at', { ascending: true }).limit(50);
  } else {
    query = supabase.from('private_messages').select('*').or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${currentDM}),and(sender_id.eq.${currentDM},recipient_id.eq.${currentUser.id})`).order('created_at', { ascending: true }).limit(50);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-500 mt-10">No messages yet. Say hi!</div>';
    return;
  }

  container.innerHTML = '';
  data.forEach(msg => {
    container.appendChild(renderMessage(msg, currentUser.id, userProfile?.username));
  });

  container.scrollTop = container.scrollHeight;
}

function handleRealtimeMessage(payload) {
  const { eventType, new: newRow, old: oldRow } = payload;
  const container = document.getElementById('messages-container');
  
  if (eventType === 'INSERT') {
    // Check if we already have this message (prevent dupes)
    if (document.querySelector(`[data-msg-id="${newRow.id}"]`)) return;

    const msgEl = renderMessage(newRow, currentUser.id, userProfile?.username);
    container.appendChild(msgEl);
    container.scrollTop = container.scrollHeight;
    
    // Play subtle sound? (Optional)
  } else if (eventType === 'UPDATE') {
    const el = document.querySelector(`[data-msg-id="${newRow.id}"]`);
    if (el) {
      // Re-render updated content
      const newEl = renderMessage(newRow, currentUser.id, userProfile?.username);
      el.replaceWith(newEl);
    }
  } else if (eventType === 'DELETE') {
    const el = document.querySelector(`[data-msg-id="${oldRow.id}"]`);
    if (el) el.remove();
  }
}

async function sendMessage(text) {
  if (!text) return;

  const payload = {
    user_id: currentUser.id,
    user_email: currentUser.email,
    username: userProfile?.username || 'Anonymous',
    message: sanitizeText(text),
    created_at: new Date().toISOString()
  };

  let error;
  if (chatType === 'room') {
    payload.room_id = currentRoom;
    const { error: e } = await supabase.from('chat_messages').insert([payload]);
    error = e;
  } else {
    payload.recipient_id = currentDM;
    payload.sender_id = currentUser.id;
    const { error: e } = await supabase.from('private_messages').insert([payload]);
    error = e;
  }

  if (error) {
    console.error('Send failed:', error);
    alert('Failed to send message.');
  }
}

function handleTypingEvent(e) {
  const { target_id, type, username, user_id } = e.detail;
  
  // Only show if relevant to current view
  const currentTarget = chatType === 'room' ? currentRoom : currentDM;
  if (target_id !== currentTarget || user_id === currentUser.id) return;

  const indicatorEl = document.getElementById('typing-indicator');
  if (!indicatorEl) return;

  indicatorEl.textContent = `${username} is typing...`;
  
  // Clear after 2s
  setTimeout(() => {
    if (indicatorEl.textContent.includes(username)) {
      indicatorEl.textContent = '';
    }
  }, 2000);
}

function updateRoomUserCounts() {
  // Optional: Refresh room list to update online counts
  if (chatType === 'room') loadRoomsList();
}

async function getUserProfile(uid) {
  const { data } = await supabase.from('profiles').select('username, avatar_url').eq('id', uid).single();
  return data;
}

// Cleanup on leave
window.addEventListener('beforeunload', () => {
  cleanupAllSubscriptions();
});
