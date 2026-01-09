// modules/chat/chat.js - COMPLETE FIXED VERSION
import { supabase, getCurrentUser } from '../../lib/supabase.js';
import { createUserProfileLink, createUserAvatarLink } from '../../lib/userLinks.js';

let currentRoom = null;
let onlineUsersSubscription = null;
let roomSubscription = null;
let isJoiningRoom = false;
let isSendingMessage = false;

export function initModule(rom) {
    console.log('💬 Chat module initialized');
    window.rom = rom;
    
    // Clear any previous subscriptions
    cleanupSubscriptions();
    
    initializeChat();
}

async function initializeChat() {
    const user = await getCurrentUser();
    
    if (!user) {
        showLoginPrompt();
        return;
    }
    
    // Get user's profile username
    const profile = await getUserProfile(user.id);
    const displayUsername = profile?.username || user.email.split('@')[0];
    
    // Load chat interface
    await loadChatInterface(user, displayUsername);
    
    // Load chat rooms
    await loadChatRooms();
    
    // Set up online users subscription
    setupOnlineUsersSubscription();
    
    // Update online status with username
    await updateOnlineStatus(user, 'online', null, displayUsername);
    
    // Set up heartbeat to keep user online
    setupOnlineHeartbeat(user, displayUsername);
    
    // Load initial stats
    updateOnlineCount();
    await updateMessageStats();
    
    console.log('✅ Chat initialized for user:', displayUsername);
}

function cleanupSubscriptions() {
    if (onlineUsersSubscription) {
        onlineUsersSubscription.unsubscribe();
        onlineUsersSubscription = null;
    }
    if (roomSubscription) {
        roomSubscription.unsubscribe();
        roomSubscription = null;
    }
}

function setupOnlineHeartbeat(user, displayUsername) {
    // Update online status every 2 minutes
    setInterval(async () => {
        if (user) {
            await updateOnlineStatus(user, 'online', currentRoom, displayUsername);
        }
    }, 2 * 60 * 1000);
    
    // Update online status on visibility change
    document.addEventListener('visibilitychange', async () => {
        if (user) {
            const status = document.hidden ? 'away' : 'online';
            await updateOnlineStatus(user, status, currentRoom, displayUsername);
        }
    });
}

async function getUserProfile(userId) {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', userId)
            .single();
        
        if (error) {
            console.log('No profile found for user, using email username');
            return null;
        }
        
        return profile;
    } catch (error) {
        console.error('Error in getUserProfile:', error);
        return null;
    }
}

function showLoginPrompt() {
    const chatContent = document.getElementById('app-content');
    chatContent.innerHTML = `
        <div class="max-w-md mx-auto mt-12">
            <div class="bg-gray-800 p-8 rounded-lg border border-cyan-500 text-center">
                <div class="text-5xl mb-6">💬</div>
                <h2 class="text-2xl font-bold text-cyan-400 mb-4">Join the Chat</h2>
                <p class="text-gray-300 mb-6">Login to join retro gaming conversations and find players.</p>
                <button onclick="window.location.hash = '#/auth'" 
                        class="bg-cyan-600 hover:bg-cyan-700 text-white px-8 py-3 rounded-lg text-lg font-semibold">
                    Login / Register
                </button>
            </div>
        </div>
    `;
}

async function loadChatInterface(user, displayUsername) {
    const chatContent = document.getElementById('app-content');
    
    chatContent.innerHTML = `
        <div class="max-w-7xl mx-auto">
            <!-- Chat Header -->
            <div class="bg-gray-800 p-6 rounded-lg mb-6 border border-cyan-500">
                <div class="flex flex-col md:flex-row justify-between items-center">
                    <div class="mb-4 md:mb-0">
                        <h1 class="text-3xl font-bold text-cyan-400">💬 Retro Gaming Chat</h1>
                        <p class="text-gray-300">Connect with players in real-time</p>
                    </div>
                    <div class="flex items-center space-x-4">
                        <div class="flex items-center">
                            <div class="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                            <span class="text-gray-300">${displayUsername}</span>
                        </div>
                        <button id="create-room-btn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition">
                            🎮 Create Room
                        </button>
                    </div>
                </div>
                
                <!-- Online Stats -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <div class="bg-gray-900 p-4 rounded text-center">
                        <div class="text-2xl font-bold text-green-400" id="online-users-count">0</div>
                        <div class="text-gray-400 text-sm">Online Users</div>
                    </div>
                    <div class="bg-gray-900 p-4 rounded text-center">
                        <div class="text-2xl font-bold text-cyan-400" id="active-rooms-count">0</div>
                        <div class="text-gray-400 text-sm">Active Rooms</div>
                    </div>
                    <div class="bg-gray-900 p-4 rounded text-center">
                        <div class="text-2xl font-bold text-purple-400" id="total-messages-count">0</div>
                        <div class="text-gray-400 text-sm">Messages Today</div>
                    </div>
                    <div class="bg-gray-900 p-4 rounded text-center">
                        <div class="text-2xl font-bold text-yellow-400" id="your-messages-count">0</div>
                        <div class="text-gray-400 text-sm">Your Messages</div>
                    </div>
                </div>
            </div>
            
            <!-- Chat Layout -->
            <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <!-- Left Sidebar - Rooms & Users -->
                <div class="lg:col-span-1 space-y-6">
                    <!-- Chat Rooms -->
                    <div class="bg-gray-800 rounded-lg border border-gray-700">
                        <div class="p-4 border-b border-gray-700">
                            <h3 class="text-lg font-bold text-white">Chat Rooms</h3>
                        </div>
                        <div id="chat-rooms-list" class="p-2 max-h-96 overflow-y-auto">
                            <div class="text-center py-8">
                                <div class="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-cyan-500"></div>
                                <p class="text-gray-400 mt-2">Loading rooms...</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Online Users -->
                    <div class="bg-gray-800 rounded-lg border border-gray-700">
                        <div class="p-4 border-b border-gray-700">
                            <h3 class="text-lg font-bold text-white">Online Now</h3>
                        </div>
                        <div id="online-users-list" class="p-4 max-h-64 overflow-y-auto">
                            <div class="text-center py-4">
                                <div class="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-green-500"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Main Chat Area -->
                <div class="lg:col-span-3">
                    <div class="bg-gray-800 rounded-lg border border-cyan-500 overflow-hidden flex flex-col h-[600px]">
                        <!-- Chat Header -->
                        <div class="bg-gray-900 p-4 border-b border-gray-700">
                            <div class="flex justify-between items-center">
                                <div>
                                    <h3 id="current-room-name" class="text-xl font-bold text-cyan-300">Select a Room</h3>
                                    <p id="current-room-desc" class="text-gray-400 text-sm">Choose a room to start chatting</p>
                                </div>
                                <div id="room-stats" class="text-gray-300 text-sm hidden">
                                    <span id="room-user-count" class="text-green-400">0</span> users online
                                </div>
                            </div>
                        </div>
                        
                        <!-- Messages Container -->
                        <div id="chat-messages-container" class="flex-1 p-4 overflow-y-auto">
                            <div class="text-center py-12">
                                <div class="text-4xl mb-4">💬</div>
                                <h4 class="text-xl font-bold text-gray-300 mb-2">Welcome to ROM Chat!</h4>
                                <p class="text-gray-400">Select a room to join the conversation.</p>
                            </div>
                        </div>
                        
                        <!-- Message Input -->
                        <div id="message-input-area" class="p-4 border-t border-gray-700 bg-gray-900 hidden">
                            <div class="flex space-x-2">
                                <input type="text" id="message-input" 
                                       class="flex-1 p-3 bg-gray-700 border border-gray-600 rounded text-white focus:border-cyan-500 focus:outline-none"
                                       placeholder="Type your message here..." disabled>
                                <button id="send-btn" 
                                        class="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded font-semibold transition"
                                        disabled>
                                    Send
                                </button>
                            </div>
                            <div class="flex space-x-2 mt-2">
                                <button class="chat-action-btn" data-action="emoji">
                                    😀 Emoji
                                </button>
                                <button class="chat-action-btn" data-action="game-invite">
                                    🎮 Game Invite
                                </button>
                                <button class="chat-action-btn" data-action="clear">
                                    🗑️ Clear
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Set up event listeners
    setupChatListeners();
}

function setupChatListeners() {
    // Create room button
    document.getElementById('create-room-btn')?.addEventListener('click', showCreateRoomModal);
    
    // Message input
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    
    if (messageInput && sendBtn) {
        // Only attach ONE Enter key listener
        messageInput.removeEventListener('keypress', handleEnterKey);
        messageInput.addEventListener('keypress', handleEnterKey);
        
        // Only attach ONE click listener
        sendBtn.removeEventListener('click', sendMessage);
        sendBtn.addEventListener('click', sendMessage);
    }
    
    // Chat action buttons
    document.querySelectorAll('.chat-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            handleChatAction(action);
        });
    });
}

// Separate function for Enter key handling to prevent duplicates
function handleEnterKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

async function loadChatRooms() {
    const roomsList = document.getElementById('chat-rooms-list');
    if (!roomsList) return;
    
    try {
        // First, check if we need to create default rooms
        await ensureDefaultRooms();
        
        // Load all rooms
        const { data: rooms, error } = await supabase
            .from('chat_rooms')
            .select('*')
            .order('name', { ascending: true });
        
        if (error) throw error;
        
        if (!rooms || rooms.length === 0) {
            roomsList.innerHTML = '<p class="text-gray-500 text-center p-4">No rooms available</p>';
            return;
        }
        
        // Get room message counts
        const roomIds = rooms.map(room => room.id);
        const { data: messageCounts } = await supabase
            .from('chat_messages')
            .select('room_id')
            .in('room_id', roomIds)
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
        
        const counts = {};
        messageCounts?.forEach(msg => {
            counts[msg.room_id] = (counts[msg.room_id] || 0) + 1;
        });
        
        // Get online users per room
        const { data: onlineUsers } = await supabase
            .from('online_users')
            .select('room_id')
            .gte('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString());
        
        const onlineCounts = {};
        onlineUsers?.forEach(user => {
            if (user.room_id) {
                onlineCounts[user.room_id] = (onlineCounts[user.room_id] || 0) + 1;
            }
        });
        
        roomsList.innerHTML = rooms.map(room => {
            const messageCount = counts[room.id] || 0;
            const onlineCount = onlineCounts[room.id] || 0;
            
            return `
                <div class="chat-room-item p-3 hover:bg-gray-700 rounded cursor-pointer transition ${room.id === currentRoom ? 'bg-gray-700 border-l-4 border-cyan-500' : ''}"
                     data-room-id="${room.id}"
                     onclick="window.chatModule.joinRoom('${room.id}')">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <div class="font-bold text-white">${room.name}</div>
                            <div class="text-gray-400 text-sm mt-1">${room.description || 'Join the conversation'}</div>
                        </div>
                        <div class="text-right">
                            ${onlineCount > 0 ? `
                                <div class="flex items-center justify-end">
                                    <div class="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                                    <span class="text-green-400 text-sm">${onlineCount}</span>
                                </div>
                            ` : ''}
                            <div class="text-gray-500 text-xs mt-1">${messageCount} today</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Update active rooms count
        document.getElementById('active-rooms-count').textContent = rooms.length;
        
    } catch (error) {
        console.error('Error loading chat rooms:', error);
        roomsList.innerHTML = '<p class="text-red-500 text-center p-4">Error loading rooms</p>';
    }
}

async function ensureDefaultRooms() {
    const defaultRooms = [
        // Core rooms (keep these)
        { name: 'General', description: 'General retro gaming discussion', is_public: true, console: null },
        { name: 'Tech Support', description: 'Help with setup and technical issues', is_public: true, console: null },
        { name: 'Emulator Netplay', description: 'Emulator setup and multiplayer', is_public: true, console: null },
        { name: 'LAN Play', description: 'Local network gaming and events', is_public: true, console: null },
        
        // Broad genre rooms
        { name: 'FPS', description: 'First-Person Shooters', is_public: true, console: null },
        { name: 'Racing', description: 'Racing and driving games', is_public: true, console: null },
        { name: 'Fighting', description: 'Fighting games and tournaments', is_public: true, console: null },
        { name: 'Sports', description: 'Sports games', is_public: true, console: null },
        { name: 'RPG', description: 'Role-Playing Games', is_public: true, console: null },
        { name: 'Strategy', description: 'Strategy and tactics games', is_public: true, console: null },
        { name: 'Action', description: 'Action and adventure games', is_public: true, console: null },
        { name: 'Platformer', description: 'Platform and jumping games', is_public: true, console: null },
        { name: 'Simulation', description: 'Simulation games', is_public: true, console: null },
        { name: 'Puzzle', description: 'Puzzle and brain teasers', is_public: true, console: null },
        { name: 'Horror', description: 'Horror and survival games', is_public: true, console: null },
        { name: 'MMO', description: 'Massively Multiplayer Online', is_public: true, console: null },
        { name: 'Arcade', description: 'Arcade and classic games', is_public: true, console: null },
    ];
    
    try {
        for (const room of defaultRooms) {
            // Check if room exists
            const { data: existingRoom } = await supabase
                .from('chat_rooms')
                .select('id')
                .eq('name', room.name)
                .single();
            
            // Create if doesn't exist
            if (!existingRoom) {
                await supabase
                    .from('chat_rooms')
                    .insert([room]);
            }
        }
    } catch (error) {
        console.error('Error ensuring default rooms:', error);
    }
}

async function joinRoom(roomId) {
    if (isJoiningRoom) {
        console.log('Already joining a room, please wait...');
        return;
    }
    
    isJoiningRoom = true;
    
    try {
        const user = await getCurrentUser();
        if (!user) return;
        
        // Get user's profile username
        const profile = await getUserProfile(user.id);
        const displayUsername = profile?.username || user.email.split('@')[0];
        
        console.log(`Joining room ${roomId} as ${displayUsername}`);
        
        // Leave current room if any (different room)
        if (currentRoom && currentRoom !== roomId) {
            await leaveRoom(currentRoom, user, displayUsername);
        }
        
        // If already in this room, just refresh
        if (currentRoom === roomId) {
            await loadRoomMessages(roomId);
            await loadOnlineUsers(roomId);
            isJoiningRoom = false;
            return;
        }
        
        // Join new room
        currentRoom = roomId;
        
        // Update UI
        document.querySelectorAll('.chat-room-item').forEach(item => {
            item.classList.remove('bg-gray-700', 'border-l-4', 'border-cyan-500');
            if (item.dataset.roomId === roomId) {
                item.classList.add('bg-gray-700', 'border-l-4', 'border-cyan-500');
            }
        });
        
        // Get room info
        const { data: room } = await supabase
            .from('chat_rooms')
            .select('*')
            .eq('id', roomId)
            .single();
        
        if (room) {
            document.getElementById('current-room-name').textContent = room.name;
            document.getElementById('current-room-desc').textContent = room.description || '';
            document.getElementById('room-stats').classList.remove('hidden');
        }
        
        // Show message input
        document.getElementById('message-input-area').classList.remove('hidden');
        const messageInput = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-btn');
        if (messageInput) {
            messageInput.disabled = false;
            messageInput.focus();
        }
        if (sendBtn) sendBtn.disabled = false;
        
        // Load room messages FIRST (this is critical)
        await loadRoomMessages(roomId);
        
        // Update online status with username
        await updateOnlineStatus(user, 'online', roomId, displayUsername);
        
        // Send join message (but check if we already have one recently)
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        
        // Check for recent join messages from this user
        const { data: recentJoins } = await supabase
            .from('chat_messages')
            .select('created_at')
            .eq('room_id', roomId)
            .eq('user_id', user.id)
            .eq('message_type', 'join')
            .gte('created_at', fiveMinutesAgo.toISOString())
            .order('created_at', { ascending: false })
            .limit(1);
        
        // Only send join message if not recently joined
        if (!recentJoins || recentJoins.length === 0) {
            await sendSystemMessage(`${displayUsername} joined the room`, 'join', roomId, user, displayUsername);
        }
        
        // Load online users for this room
        await loadOnlineUsers(roomId);
        
        // Subscribe to room messages (clean up old subscription first)
        subscribeToRoomMessages(roomId);
        
        console.log(`✅ Successfully joined room: ${roomId}`);
        
    } catch (error) {
        console.error('Error joining room:', error);
        alert('Failed to join room. Please try again.');
    } finally {
        isJoiningRoom = false;
    }
}

function subscribeToRoomMessages(roomId) {
    // Unsubscribe from previous room if any
    if (roomSubscription) {
        roomSubscription.unsubscribe();
        roomSubscription = null;
    }
    
    // Subscribe to new messages in this specific room
    roomSubscription = supabase
        .channel(`room-${roomId}-messages`)
        .on('postgres_changes', 
            { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'chat_messages',
                filter: `room_id=eq.${roomId}`
            },
            (payload) => {
                // Only append if it's not our own message (prevents duplicates)
                if (payload.new.room_id === currentRoom) {
                    appendMessage(payload.new);
                }
            }
        )
        .subscribe((status) => {
            console.log(`Room subscription status: ${status}`);
        });
}

async function leaveRoom(roomId, user, displayUsername) {
    if (!roomId || !user) return;
    
    try {
        // Send leave message
        await sendSystemMessage(`${displayUsername} left the room`, 'leave', roomId, user, displayUsername);
        
        // Update online status
        await updateOnlineStatus(user, 'offline', roomId, displayUsername);
        
        // Unsubscribe from room messages
        if (roomSubscription) {
            roomSubscription.unsubscribe();
            roomSubscription = null;
        }
        
        console.log(`Left room: ${roomId}`);
        
    } catch (error) {
        console.error('Error leaving room:', error);
    }
}

async function loadRoomMessages(roomId) {
    const messagesContainer = document.getElementById('chat-messages-container');
    if (!messagesContainer) return;
    
    // Show loading
    messagesContainer.innerHTML = '<div class="text-center py-8"><div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div><p class="text-gray-400 mt-2">Loading messages...</p></div>';
    
    try {
        // Load messages with username from profile if available
        const { data: messages, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('room_id', roomId)
            .order('created_at', { ascending: true }) // Changed to ascending for proper display
            .limit(100);
        
        if (error) throw error;
        
        if (!messages || messages.length === 0) {
            messagesContainer.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-4xl mb-4">💬</div>
                    <h4 class="text-xl font-bold text-gray-300 mb-2">No messages yet</h4>
                    <p class="text-gray-400">Be the first to say something!</p>
                </div>
            `;
            return;
        }
        
        // Render all messages (they're already in order)
        messagesContainer.innerHTML = messages.map(msg => renderMessage(msg)).join('');
        
        // Scroll to bottom
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
        
        console.log(`Loaded ${messages.length} messages for room ${roomId}`);
        
    } catch (error) {
        console.error('Error loading messages:', error);
        messagesContainer.innerHTML = '<p class="text-red-500 text-center p-8">Error loading messages</p>';
    }
}

function renderMessage(msg) {
    const isSystem = msg.message_type !== 'text';
    const timestamp = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (isSystem) {
        return `
            <div class="text-center my-2">
                <span class="bg-gray-900 text-gray-400 text-sm px-3 py-1 rounded-full">
                    ${msg.message}
                </span>
            </div>
        `;
    }
    
    // Use clickable username link
    const displayName = msg.username || msg.user_email?.split('@')[0] || 'User';
    const usernameLink = createUserProfileLink(msg.user_id, displayName, msg.user_email);
    
    // Use clickable avatar link
    const avatarLink = createUserAvatarLink(msg.user_id, displayName);
    
    return `
        <div class="message mb-4" data-message-id="${msg.id}" data-user-id="${msg.user_id}">
            <div class="flex items-start">
                <div class="flex-shrink-0">
                    ${avatarLink}
                </div>
                <div class="ml-3 flex-1">
                    <div class="flex items-baseline">
                        ${usernameLink}
                        <span class="text-gray-500 text-sm ml-2">${timestamp}</span>
                    </div>
                    <p class="text-gray-100 mt-1 whitespace-pre-wrap break-words">${msg.message}</p>
                </div>
            </div>
        </div>
    `;
}

async function sendMessage() {
    if (isSendingMessage) {
        console.log('Already sending a message, please wait...');
        return;
    }
    
    isSendingMessage = true;
    
    const input = document.getElementById('message-input');
    const message = input?.value.trim();
    
    if (!message || !currentRoom) {
        isSendingMessage = false;
        return;
    }
    
    const user = await getCurrentUser();
    if (!user) {
        isSendingMessage = false;
        return;
    }
    
    try {
        // Get user's profile username
        const profile = await getUserProfile(user.id);
        const displayUsername = profile?.username || user.email.split('@')[0];
        
        // Send the message
        const { data: sentMessage, error } = await supabase
            .from('chat_messages')
            .insert({
                room_id: currentRoom,
                user_id: user.id,
                user_email: user.email,
                username: displayUsername,
                message: message,
                message_type: 'text'
            })
            .select()
            .single();
        
        if (error) throw error;
        
        console.log('Message sent:', sentMessage.id);
        
        // Clear input
        input.value = '';
        input.focus();
        
        // Update stats
        updateMessageStats();
        
        // The subscription will automatically add the message to the UI
        // We don't need to manually append it
        
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    } finally {
        isSendingMessage = false;
    }
}

async function sendSystemMessage(text, type, roomId, user, displayUsername) {
    try {
        await supabase
            .from('chat_messages')
            .insert({
                room_id: roomId,
                user_id: user.id,
                user_email: user.email,
                username: 'System',
                message: text,
                message_type: type
            });
    } catch (error) {
        console.error('Error sending system message:', error);
    }
}

function setupOnlineUsersSubscription() {
    // Subscribe to online users
    onlineUsersSubscription = supabase
        .channel('online-users')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'online_users' },
            () => {
                if (currentRoom) {
                    loadOnlineUsers(currentRoom);
                }
                updateOnlineCount();
            }
        )
        .subscribe((status) => {
            console.log(`Online users subscription status: ${status}`);
        });
}

function appendMessage(msg) {
    const messagesContainer = document.getElementById('chat-messages-container');
    if (!messagesContainer) return;
    
    // Check if this message already exists (prevents duplicates)
    const existingMessage = messagesContainer.querySelector(`[data-message-id="${msg.id}"]`);
    if (existingMessage) {
        console.log('Message already exists, skipping duplicate');
        return;
    }
    
    // Remove "no messages" placeholder if present
    if (messagesContainer.querySelector('.text-center')) {
        messagesContainer.innerHTML = '';
    }
    
    const messageElement = document.createElement('div');
    messageElement.innerHTML = renderMessage(msg);
    messagesContainer.appendChild(messageElement);
    
    // Scroll to bottom
    setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 50);
}

async function updateOnlineStatus(user, status, roomId = null, displayUsername = null) {
    try {
        if (!displayUsername) {
            const profile = await getUserProfile(user.id);
            displayUsername = profile?.username || user.email.split('@')[0];
        }
        
        const { error } = await supabase
            .from('online_users')
            .upsert({
                user_id: user.id,
                user_email: user.email,
                username: displayUsername,
                room_id: roomId,
                status: status,
                last_seen: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            });
        
        if (error) throw error;
        
        // Clean up old entries (older than 10 minutes)
        await supabase
            .from('online_users')
            .delete()
            .lt('last_seen', new Date(Date.now() - 10 * 60 * 1000).toISOString());
            
    } catch (error) {
        console.error('Error updating online status:', error);
    }
}

async function loadOnlineUsers(roomId) {
    const onlineList = document.getElementById('online-users-list');
    if (!onlineList) return;
    
    try {
        const { data: users, error } = await supabase
            .from('online_users')
            .select('*')
            .eq('room_id', roomId)
            .gte('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString())
            .order('username', { ascending: true });
        
        if (error) throw error;
        
        if (!users || users.length === 0) {
            onlineList.innerHTML = '<p class="text-gray-500 text-center p-4">No users online</p>';
            document.getElementById('room-user-count').textContent = '0';
            return;
        }
        
        // Use clickable user cards for online users
        onlineList.innerHTML = users.map(user => `
            <div class="user-card py-2 border-b border-gray-700 last:border-0">
                <a href="#/profile/${user.user_id}" 
                   class="flex items-center gap-3 hover:bg-gray-800/50 p-2 rounded transition"
                   onclick="event.stopPropagation()">
                    <div class="w-2 h-2 rounded-full ${user.status === 'online' ? 'bg-green-500' : 'bg-yellow-500'}"></div>
                    <div class="flex-1">
                        <div class="text-white font-semibold user-profile-link hover:text-cyan-300 cursor-pointer">
                            ${user.username || user.user_email?.split('@')[0] || 'User'}
                        </div>
                        <div class="text-gray-500 text-xs">${user.status === 'online' ? 'Online' : 'Away'}</div>
                    </div>
                </a>
            </div>
        `).join('');
        
        document.getElementById('room-user-count').textContent = users.length;
        
    } catch (error) {
        console.error('Error loading online users:', error);
        onlineList.innerHTML = '<p class="text-red-500 text-center p-4">Error loading users</p>';
    }
}

async function updateOnlineCount() {
    try {
        const { count } = await supabase
            .from('online_users')
            .select('*', { count: 'exact', head: true })
            .gte('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString())
            .eq('status', 'online');
        
        document.getElementById('online-users-count').textContent = count || 0;
        
    } catch (error) {
        console.error('Error updating online count:', error);
    }
}

async function updateMessageStats() {
    try {
        const user = await getCurrentUser();
        if (!user) return;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Get today's total messages
        const { count: totalCount } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', today.toISOString())
            .eq('message_type', 'text');
        
        // Get user's messages today
        const { count: userCount } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', today.toISOString())
            .eq('user_id', user.id)
            .eq('message_type', 'text');
        
        document.getElementById('total-messages-count').textContent = totalCount || 0;
        document.getElementById('your-messages-count').textContent = userCount || 0;
        
    } catch (error) {
        console.error('Error updating message stats:', error);
    }
}

function showCreateRoomModal() {
    alert('Room creation feature coming soon!');
}

function handleChatAction(action) {
    switch(action) {
        case 'emoji':
            alert('Emoji picker coming soon!');
            break;
        case 'game-invite':
            showGameInviteModal();
            break;
        case 'clear':
            document.getElementById('message-input').value = '';
            break;
    }
}

function showGameInviteModal() {
    alert('Game invite feature coming soon!');
}

// Make functions available globally
window.chatModule = {
    joinRoom,
    leaveRoom: async () => {
        const user = await getCurrentUser();
        if (!user) return;
        
        const profile = await getUserProfile(user.id);
        const displayUsername = profile?.username || user.email.split('@')[0];
        
        if (currentRoom) {
            await leaveRoom(currentRoom, user, displayUsername);
            currentRoom = null;
            
            // Reset UI
            document.getElementById('current-room-name').textContent = 'Select a Room';
            document.getElementById('current-room-desc').textContent = 'Choose a room to start chatting';
            document.getElementById('room-stats').classList.add('hidden');
            document.getElementById('message-input-area').classList.add('hidden');
            document.getElementById('chat-messages-container').innerHTML = `
                <div class="text-center py-12">
                    <div class="text-4xl mb-4">💬</div>
                    <h4 class="text-xl font-bold text-gray-300 mb-2">Welcome to ROM Chat!</h4>
                    <p class="text-gray-400">Select a room to join the conversation.</p>
                </div>
            `;
            
            // Update online status to no room
            await updateOnlineStatus(user, 'online', null, displayUsername);
        }
    }
};
