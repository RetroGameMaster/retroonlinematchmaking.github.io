// modules/messages/messages.js - PRIVATE MESSAGING SYSTEM
import { supabase, getCurrentUser } from '../../lib/supabase.js';
import { createUserAvatarLink, createUserProfileLink } from '../../lib/userLinks.js';

let currentUser = null;
let conversations = [];
let unreadCount = 0;

export function initModule() {
    console.log('💬 Messages module initialized');
    loadMessagesInterface();
}

async function loadMessagesInterface() {
    currentUser = await getCurrentUser();
    
    if (!currentUser) {
        window.location.hash = '#/auth';
        return;
    }
    
    const appContent = document.getElementById('app-content');
    
    appContent.innerHTML = `
        <div class="max-w-6xl mx-auto">
            <!-- Messages Header -->
            <div class="mb-8">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="text-3xl font-bold text-white mb-2">💬 Messages</h1>
                        <p class="text-gray-400">Private conversations with your friends</p>
                    </div>
                    <button id="new-message-btn" 
                            class="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2">
                        <span>✉️</span>
                        New Message
                    </button>
                </div>
            </div>
            
            <!-- Messages Container -->
            <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <!-- Conversations List -->
                <div class="lg:col-span-1">
                    <div class="bg-gray-800 rounded-lg border border-cyan-500 overflow-hidden">
                        <!-- Search Bar -->
                        <div class="p-4 border-b border-gray-700">
                            <div class="relative">
                                <input type="text" 
                                       id="message-search" 
                                       class="w-full p-3 pl-10 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                                       placeholder="Search conversations...">
                                <div class="absolute left-3 top-3 text-gray-400">
                                    🔍
                                </div>
                            </div>
                        </div>
                        
                        <!-- Conversations List -->
                        <div id="conversations-list" class="max-h-[600px] overflow-y-auto">
                            <div class="text-center py-12">
                                <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
                                <p class="text-gray-400 mt-2">Loading conversations...</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Messages Panel -->
                <div class="lg:col-span-3">
                    <div class="bg-gray-800 rounded-lg border border-cyan-500 h-[600px] overflow-hidden flex flex-col">
                        <!-- Empty State -->
                        <div id="empty-message-state" class="flex-1 flex flex-col items-center justify-center p-8">
                            <div class="text-6xl mb-6">💬</div>
                            <h3 class="text-2xl font-bold text-white mb-3">Your Messages</h3>
                            <p class="text-gray-400 text-center mb-6">Select a conversation or start a new one to begin messaging</p>
                            <button id="start-conversation-btn" 
                                    class="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg font-semibold">
                                Start New Conversation
                            </button>
                        </div>
                        
                        <!-- Active Conversation -->
                        <div id="active-conversation" class="hidden flex-1 flex flex-col">
                            <!-- Conversation Header -->
                            <div class="p-4 border-b border-gray-700 bg-gray-900 flex items-center justify-between">
                                <div class="flex items-center gap-3" id="conversation-header">
                                    <!-- Will be populated dynamically -->
                                </div>
                                <div class="flex gap-2">
                                    <button id="conversation-info-btn" 
                                            class="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded">
                                        ⓘ
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Messages Container -->
                            <div id="messages-container" class="flex-1 overflow-y-auto p-4 space-y-4">
                                <!-- Messages will be loaded here -->
                            </div>
                            
                            <!-- Message Input -->
                            <div class="p-4 border-t border-gray-700 bg-gray-900">
                                <form id="message-form" class="flex gap-3">
                                    <input type="text" 
                                           id="message-input" 
                                           class="flex-1 p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                                           placeholder="Type your message..." 
                                           autocomplete="off"
                                           required>
                                    <button type="submit" 
                                            class="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg font-semibold">
                                        Send
                                    </button>
                                </form>
                                <p class="text-gray-500 text-xs mt-2">
                                    Press Enter to send • Shift+Enter for new line
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- New Message Modal -->
            <div id="new-message-modal" class="hidden fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                <div class="bg-gray-800 rounded-lg max-w-md w-full border border-cyan-500 max-h-[80vh] overflow-hidden">
                    <div class="p-6">
                        <div class="flex items-center justify-between mb-6">
                            <h3 class="text-xl font-bold text-white">New Message</h3>
                            <button onclick="closeNewMessageModal()" 
                                    class="text-gray-400 hover:text-white">
                                ✕
                            </button>
                        </div>
                        
                        <div class="mb-6">
                            <label class="block text-gray-300 mb-2">To:</label>
                            <input type="text" 
                                   id="recipient-search" 
                                   class="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                                   placeholder="Search for a friend..."
                                   autocomplete="off">
                        </div>
                        
                        <div id="recipient-results" class="mb-6 max-h-[300px] overflow-y-auto space-y-2">
                            <!-- Friend list will be populated here -->
                        </div>
                        
                        <div class="mb-6">
                            <label class="block text-gray-300 mb-2">Message:</label>
                            <textarea id="new-message-content" 
                                      rows="4"
                                      class="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                                      placeholder="Type your message here..."
                                      required></textarea>
                        </div>
                        
                        <div class="flex gap-3">
                            <button id="send-message-btn" 
                                    class="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-3 rounded-lg font-semibold">
                                Send Message
                            </button>
                            <button type="button" onclick="closeNewMessageModal()" 
                                    class="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Conversation Info Modal -->
            <div id="conversation-info-modal" class="hidden fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                <div class="bg-gray-800 rounded-lg max-w-md w-full border border-purple-500">
                    <div class="p-6">
                        <div class="flex items-center justify-between mb-6">
                            <h3 class="text-xl font-bold text-white">Conversation Info</h3>
                            <button onclick="closeConversationInfoModal()" 
                                    class="text-gray-400 hover:text-white">
                                ✕
                            </button>
                        </div>
                        
                        <div id="conversation-info-content">
                            <!-- Will be populated dynamically -->
                        </div>
                        
                        <div class="mt-6 pt-4 border-t border-gray-700">
                            <button id="clear-conversation-btn" 
                                    class="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold mb-3">
                                🗑️ Clear Conversation
                            </button>
                            <button onclick="closeConversationInfoModal()" 
                                    class="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    setupEventListeners();
    loadConversations();
    setupRealtimeSubscription();
}

function setupEventListeners() {
    // New message button
    document.getElementById('new-message-btn')?.addEventListener('click', openNewMessageModal);
    document.getElementById('start-conversation-btn')?.addEventListener('click', openNewMessageModal);
    
    // Message form
    const messageForm = document.getElementById('message-form');
    if (messageForm) {
        messageForm.addEventListener('submit', sendMessage);
        
        // Handle Enter/Shift+Enter
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    messageForm.dispatchEvent(new Event('submit'));
                }
            });
        }
    }
    
    // Message search
    const messageSearch = document.getElementById('message-search');
    if (messageSearch) {
        messageSearch.addEventListener('input', (e) => {
            searchConversations(e.target.value);
        });
    }
    
    // Recipient search
    const recipientSearch = document.getElementById('recipient-search');
    if (recipientSearch) {
        recipientSearch.addEventListener('input', (e) => {
            searchFriends(e.target.value);
        });
    }
    
    // Send message button in modal
    document.getElementById('send-message-btn')?.addEventListener('click', sendNewMessage);
    
    // Conversation info button
    document.getElementById('conversation-info-btn')?.addEventListener('click', openConversationInfoModal);
    
    // Clear conversation button
    document.getElementById('clear-conversation-btn')?.addEventListener('click', clearConversation);
}

async function loadConversations() {
    try {
        // Get all conversations (grouped by other user)
        const { data: messages, error } = await supabase
            .from('private_messages')
            .select(`
                *,
                sender:profiles!private_messages_sender_id_fkey(id, username, avatar_url),
                recipient:profiles!private_messages_recipient_id_fkey(id, username, avatar_url)
            `)
            .or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Group messages by conversation (other user)
        const conversationsMap = new Map();
        
        if (messages) {
            messages.forEach(message => {
                const otherUserId = message.sender_id === currentUser.id 
                    ? message.recipient_id 
                    : message.sender_id;
                
                const otherUser = message.sender_id === currentUser.id 
                    ? message.recipient 
                    : message.sender;
                
                if (!conversationsMap.has(otherUserId)) {
                    conversationsMap.set(otherUserId, {
                        user: otherUser,
                        lastMessage: message,
                        unreadCount: 0,
                        messages: []
                    });
                }
                
                const conversation = conversationsMap.get(otherUserId);
                conversation.messages.push(message);
                
                // Update unread count
                if (!message.is_read && message.recipient_id === currentUser.id) {
                    conversation.unreadCount++;
                }
                
                // Keep only the most recent message as lastMessage
                if (!conversation.lastMessage || 
                    new Date(message.created_at) > new Date(conversation.lastMessage.created_at)) {
                    conversation.lastMessage = message;
                }
            });
        }
        
        // Convert to array and sort by last message date
        conversations = Array.from(conversationsMap.values()).sort((a, b) => 
            new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at)
        );
        
        // Calculate total unread count
        unreadCount = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);
        
        // Update notifications badge globally
        updateNotificationBadge();
        
        // Display conversations
        displayConversations(conversations);
        
    } catch (error) {
        console.error('Error loading conversations:', error);
        showError('Failed to load conversations');
    }
}

function displayConversations(conversationsList) {
    const container = document.getElementById('conversations-list');
    if (!container) return;
    
    if (conversationsList.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="text-4xl mb-4">📭</div>
                <p class="text-gray-400">No conversations yet</p>
                <p class="text-gray-500 text-sm mt-2">Start a conversation with a friend!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = conversationsList.map(conv => {
        const otherUser = conv.user;
        const lastMessage = conv.lastMessage;
        const isSender = lastMessage.sender_id === currentUser.id;
        const isUnread = conv.unreadCount > 0;
        
        // Format last message preview
        let messagePreview = lastMessage.content;
        if (messagePreview.length > 30) {
            messagePreview = messagePreview.substring(0, 30) + '...';
        }
        
        // Format time
        const messageTime = formatMessageTime(lastMessage.created_at);
        
        return `
            <div class="conversation-item p-4 border-b border-gray-700 hover:bg-gray-700/50 cursor-pointer transition ${isUnread ? 'bg-gray-900/30' : ''}"
                 data-user-id="${otherUser.id}">
                <div class="flex items-center gap-3">
                    <div class="relative">
                        <div class="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                            ${otherUser.avatar_url ? `
                                <img src="${otherUser.avatar_url}" 
                                     alt="${otherUser.username}" 
                                     class="w-full h-full rounded-full object-cover">
                            ` : `
                                <span class="text-white font-bold">
                                    ${otherUser.username?.charAt(0) || 'U'}
                                </span>
                            `}
                        </div>
                        ${isUnread ? `
                            <div class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-gray-800"></div>
                        ` : ''}
                    </div>
                    
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-start mb-1">
                            <h4 class="text-white font-semibold truncate ${isUnread ? 'font-bold' : ''}">
                                ${otherUser.username}
                            </h4>
                            <span class="text-gray-500 text-xs whitespace-nowrap">${messageTime}</span>
                        </div>
                        <p class="text-gray-400 text-sm truncate">
                            ${isSender ? 'You: ' : ''}${messagePreview}
                        </p>
                        ${conv.unreadCount > 0 ? `
                            <div class="mt-1">
                                <span class="inline-block bg-red-600 text-white text-xs px-2 py-1 rounded-full">
                                    ${conv.unreadCount} new
                                </span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Add click listeners to conversation items
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.addEventListener('click', () => {
            const userId = item.getAttribute('data-user-id');
            openConversation(userId);
        });
    });
}

function searchConversations(query) {
    if (!query.trim()) {
        displayConversations(conversations);
        return;
    }
    
    const filtered = conversations.filter(conv => 
        conv.user.username.toLowerCase().includes(query.toLowerCase())
    );
    
    displayConversations(filtered);
}

async function searchFriends(query) {
    const container = document.getElementById('recipient-results');
    if (!container) return;
    
    if (!query.trim()) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                Start typing to search for friends
            </div>
        `;
        return;
    }
    
    try {
        // Get user's friends
        const { data: friends } = await supabase
            .from('friends')
            .select(`
                *,
                friend:profiles!friends_friend_id_fkey(id, username, avatar_url, favorite_console),
                user:profiles!friends_user_id_fkey(id, username, avatar_url, favorite_console)
            `)
            .or(`user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id}`)
            .eq('status', 'accepted');
        
        if (!friends || friends.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    No friends found. Add friends to start messaging!
                </div>
            `;
            return;
        }
        
        // Extract all friend users
        let friendUsers = [];
        friends.forEach(f => {
            if (f.user_id === currentUser.id && f.friend) {
                friendUsers.push(f.friend);
            } else if (f.friend_id === currentUser.id && f.user) {
                friendUsers.push(f.user);
            }
        });
        
        // Filter by search query
        const filtered = friendUsers.filter(user => 
            user.username.toLowerCase().includes(query.toLowerCase())
        );
        
        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    No friends match your search
                </div>
            `;
            return;
        }
        
        // Display results
        container.innerHTML = filtered.map(user => `
            <div class="friend-result p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 cursor-pointer transition"
                 data-user-id="${user.id}">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                        ${user.avatar_url ? `
                            <img src="${user.avatar_url}" 
                                 alt="${user.username}" 
                                 class="w-full h-full rounded-full object-cover">
                        ` : `
                            <span class="text-white font-bold">
                                ${user.username?.charAt(0) || 'U'}
                            </span>
                        `}
                    </div>
                    <div>
                        <h4 class="text-white font-semibold">${user.username}</h4>
                        ${user.favorite_console ? `
                            <p class="text-gray-400 text-xs">🎮 ${user.favorite_console}</p>
                        ` : ''}
                    </div>
                </div>
            </div>
        `).join('');
        
        // Add click listeners
        document.querySelectorAll('.friend-result').forEach(item => {
            item.addEventListener('click', () => {
                const userId = item.getAttribute('data-user-id');
                selectRecipient(userId);
            });
        });
        
    } catch (error) {
        console.error('Error searching friends:', error);
        container.innerHTML = `
            <div class="text-center py-8 text-red-400">
                Error searching friends
            </div>
        `;
    }
}

function selectRecipient(userId) {
    // Find the user
    const friendResult = document.querySelector(`.friend-result[data-user-id="${userId}"]`);
    if (!friendResult) return;
    
    // Get user info
    const username = friendResult.querySelector('h4').textContent;
    
    // Update search input
    const searchInput = document.getElementById('recipient-search');
    if (searchInput) {
        searchInput.value = username;
        searchInput.dataset.selectedUserId = userId;
    }
    
    // Clear results
    const resultsContainer = document.getElementById('recipient-results');
    if (resultsContainer) {
        resultsContainer.innerHTML = `
            <div class="text-center py-4 text-green-400">
                Selected: <span class="font-semibold">${username}</span>
            </div>
        `;
    }
}

async function openConversation(otherUserId) {
    try {
        // Find the conversation
        const conversation = conversations.find(c => c.user.id === otherUserId);
        if (!conversation) {
            showError('Conversation not found');
            return;
        }
        
        // Mark messages as read
        await markMessagesAsRead(otherUserId);
        
        // Update UI
        showActiveConversation(conversation);
        
        // Load messages
        await loadConversationMessages(otherUserId);
        
        // Update unread count for this conversation
        updateConversationUnreadCount(otherUserId, 0);
        
    } catch (error) {
        console.error('Error opening conversation:', error);
        showError('Failed to open conversation');
    }
}

function showActiveConversation(conversation) {
    // Hide empty state
    document.getElementById('empty-message-state').classList.add('hidden');
    
    // Show active conversation
    const activeConv = document.getElementById('active-conversation');
    activeConv.classList.remove('hidden');
    
    // Update header
    const header = document.getElementById('conversation-header');
    const otherUser = conversation.user;
    
    header.innerHTML = `
        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
            ${otherUser.avatar_url ? `
                <img src="${otherUser.avatar_url}" 
                     alt="${otherUser.username}" 
                     class="w-full h-full rounded-full object-cover">
            ` : `
                <span class="text-white font-bold">
                    ${otherUser.username?.charAt(0) || 'U'}
                </span>
            `}
        </div>
        <div>
            <h3 class="text-white font-semibold">${otherUser.username}</h3>
            <p class="text-gray-400 text-sm">${otherUser.favorite_console ? `🎮 ${otherUser.favorite_console}` : 'Friend'}</p>
        </div>
    `;
    
    // Store current conversation ID
    activeConv.dataset.currentUserId = otherUser.id;
    
    // Clear and focus message input
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.value = '';
        messageInput.focus();
    }
}

async function loadConversationMessages(otherUserId) {
    const container = document.getElementById('messages-container');
    if (!container) return;
    
    try {
        // Get messages for this conversation
        const { data: messages, error } = await supabase
            .from('private_messages')
            .select(`
                *,
                sender:profiles!private_messages_sender_id_fkey(id, username, avatar_url)
            `)
            .or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        displayMessages(messages || []);
        
    } catch (error) {
        console.error('Error loading messages:', error);
        container.innerHTML = `
            <div class="text-center py-12">
                <p class="text-red-400">Error loading messages</p>
            </div>
        `;
    }
}

function displayMessages(messages) {
    const container = document.getElementById('messages-container');
    if (!container) return;
    
    if (messages.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="text-4xl mb-4">💬</div>
                <p class="text-gray-400">No messages yet</p>
                <p class="text-gray-500 text-sm mt-2">Send a message to start the conversation!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = messages.map(message => {
        const isOwnMessage = message.sender_id === currentUser.id;
        const messageTime = formatMessageTime(message.created_at, true);
        
        return `
            <div class="message ${isOwnMessage ? 'own-message' : 'other-message'}">
                <div class="flex ${isOwnMessage ? 'justify-end' : 'justify-start'}">
                    <div class="max-w-[70%]">
                        <div class="${isOwnMessage ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-200'} rounded-lg p-4 ${isOwnMessage ? 'rounded-br-none' : 'rounded-bl-none'}">
                            <p class="whitespace-pre-wrap">${escapeHtml(message.content)}</p>
                            <div class="flex items-center justify-end gap-2 mt-2">
                                <span class="text-xs ${isOwnMessage ? 'text-cyan-200' : 'text-gray-400'}">
                                    ${messageTime}
                                </span>
                                ${isOwnMessage ? `
                                    <span class="text-xs ${message.is_read ? 'text-green-300' : 'text-gray-400'}">
                                        ${message.is_read ? '✓✓' : '✓'}
                                    </span>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

async function sendMessage(e) {
    e.preventDefault();
    
    const input = document.getElementById('message-input');
    const content = input?.value.trim();
    const activeConv = document.getElementById('active-conversation');
    const otherUserId = activeConv?.dataset.currentUserId;
    
    if (!content || !otherUserId) {
        showError('Cannot send message');
        return;
    }
    
    try {
        // Send message
        const { data: message, error } = await supabase
            .from('private_messages')
            .insert({
                sender_id: currentUser.id,
                recipient_id: otherUserId,
                content: content,
                is_read: false
            })
            .select(`
                *,
                sender:profiles!private_messages_sender_id_fkey(id, username, avatar_url)
            `)
            .single();
        
        if (error) throw error;
        
        // Clear input
        input.value = '';
        input.focus();
        
        // Add message to UI
        addMessageToUI(message);
        
        // Update conversation list
        await updateConversationAfterMessage(otherUserId, message);
        
        // Create notification for recipient
        await createMessageNotification(otherUserId, message.id);
        
    } catch (error) {
        console.error('Error sending message:', error);
        showError('Failed to send message');
    }
}

function addMessageToUI(message) {
    const container = document.getElementById('messages-container');
    if (!container) return;
    
    const isOwnMessage = message.sender_id === currentUser.id;
    const messageTime = formatMessageTime(message.created_at, true);
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isOwnMessage ? 'own-message' : 'other-message'}`;
    messageElement.innerHTML = `
        <div class="flex ${isOwnMessage ? 'justify-end' : 'justify-start'}">
            <div class="max-w-[70%]">
                <div class="${isOwnMessage ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-200'} rounded-lg p-4 ${isOwnMessage ? 'rounded-br-none' : 'rounded-bl-none'}">
                    <p class="whitespace-pre-wrap">${escapeHtml(message.content)}</p>
                    <div class="flex items-center justify-end gap-2 mt-2">
                        <span class="text-xs ${isOwnMessage ? 'text-cyan-200' : 'text-gray-400'}">
                            ${messageTime}
                        </span>
                        ${isOwnMessage ? `
                            <span class="text-xs text-gray-400">
                                ✓
                            </span>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.appendChild(messageElement);
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

async function updateConversationAfterMessage(otherUserId, newMessage) {
    // Find conversation in local array
    const convIndex = conversations.findIndex(c => c.user.id === otherUserId);
    
    if (convIndex !== -1) {
        // Update existing conversation
        conversations[convIndex].lastMessage = newMessage;
        conversations[convIndex].messages.push(newMessage);
        
        // Move to top
        const conversation = conversations.splice(convIndex, 1)[0];
        conversations.unshift(conversation);
    } else {
        // Create new conversation (need to fetch user info)
        try {
            const { data: user } = await supabase
                .from('profiles')
                .select('id, username, avatar_url')
                .eq('id', otherUserId)
                .single();
            
            if (user) {
                conversations.unshift({
                    user: user,
                    lastMessage: newMessage,
                    unreadCount: 0,
                    messages: [newMessage]
                });
            }
        } catch (error) {
            console.error('Error fetching user for new conversation:', error);
        }
    }
    
    // Update UI
    displayConversations(conversations);
}

async function sendNewMessage() {
    const searchInput = document.getElementById('recipient-search');
    const recipientId = searchInput?.dataset.selectedUserId;
    const contentInput = document.getElementById('new-message-content');
    const content = contentInput?.value.trim();
    
    if (!recipientId || !content) {
        showError('Please select a recipient and enter a message');
        return;
    }
    
    try {
        // Send message
        const { data: message, error } = await supabase
            .from('private_messages')
            .insert({
                sender_id: currentUser.id,
                recipient_id: recipientId,
                content: content,
                is_read: false
            })
            .select(`
                *,
                sender:profiles!private_messages_sender_id_fkey(id, username, avatar_url)
            `)
            .single();
        
        if (error) throw error;
        
        // Create notification
        await createMessageNotification(recipientId, message.id);
        
        // Close modal
        closeNewMessageModal();
        
        // Open the new conversation
        await openConversation(recipientId);
        
        // Show success
        showNotification('Message sent!', 'success');
        
    } catch (error) {
        console.error('Error sending new message:', error);
        showError('Failed to send message');
    }
}

async function createMessageNotification(recipientId, messageId) {
    try {
        await supabase
            .from('message_notifications')
            .insert({
                user_id: recipientId,
                message_id: messageId,
                is_read: false
            });
    } catch (error) {
        console.error('Error creating notification:', error);
        // Non-critical error, continue
    }
}

async function markMessagesAsRead(otherUserId) {
    try {
        await supabase
            .from('private_messages')
            .update({ is_read: true })
            .eq('recipient_id', currentUser.id)
            .eq('sender_id', otherUserId)
            .eq('is_read', false);
    } catch (error) {
        console.error('Error marking messages as read:', error);
    }
}

function updateConversationUnreadCount(otherUserId, count) {
    const convIndex = conversations.findIndex(c => c.user.id === otherUserId);
    if (convIndex !== -1) {
        conversations[convIndex].unreadCount = count;
        
        // Recalculate total unread count
        unreadCount = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);
        updateNotificationBadge();
        
        // Update UI
        displayConversations(conversations);
    }
}

function updateNotificationBadge() {
    // Update global notification badge
    const badge = document.getElementById('notification-badge');
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
    
    // Update browser tab title
    if (unreadCount > 0) {
        document.title = `(${unreadCount}) ROM - Retro Online Matchmaking`;
    } else {
        document.title = 'ROM - Retro Online Matchmaking';
    }
}

function setupRealtimeSubscription() {
    // Subscribe to new messages
    supabase
        .channel('private_messages')
        .on('postgres_changes', 
            { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'private_messages',
                filter: `recipient_id=eq.${currentUser.id}`
            }, 
            async (payload) => {
                console.log('New message received:', payload);
                
                // Update conversations
                await loadConversations();
                
                // If the conversation is currently open, add the message
                const activeConv = document.getElementById('active-conversation');
                const currentUserId = activeConv?.dataset.currentUserId;
                
                if (currentUserId && payload.new.sender_id === currentUserId) {
                    addMessageToUI(payload.new);
                    
                    // Mark as read
                    await supabase
                        .from('private_messages')
                        .update({ is_read: true })
                        .eq('id', payload.new.id);
                }
                
                // Show desktop notification
                if (Notification.permission === 'granted' && !document.hasFocus()) {
                    showDesktopNotification(payload.new);
                }
            }
        )
        .subscribe();
}

function showDesktopNotification(message) {
    // This would need the sender info, which we don't have in the payload
    // In a real implementation, you'd fetch the sender info or include it in the payload
    if (Notification.permission === 'granted') {
        new Notification('New Message', {
            body: 'You have a new message',
            icon: '/favicon.ico'
        });
    }
}

async function clearConversation() {
    const activeConv = document.getElementById('active-conversation');
    const otherUserId = activeConv?.dataset.currentUserId;
    
    if (!otherUserId || !confirm('Clear all messages in this conversation? This cannot be undone.')) {
        return;
    }
    
    try {
        // Delete all messages in this conversation
        const { error } = await supabase
            .from('private_messages')
            .delete()
            .or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${currentUser.id})`);
        
        if (error) throw error;
        
        // Remove conversation from local array
        conversations = conversations.filter(c => c.user.id !== otherUserId);
        
        // Update UI
        displayConversations(conversations);
        
        // Show empty state
        document.getElementById('empty-message-state').classList.remove('hidden');
        activeConv.classList.add('hidden');
        
        // Close modal
        closeConversationInfoModal();
        
        showNotification('Conversation cleared', 'success');
        
    } catch (error) {
        console.error('Error clearing conversation:', error);
        showError('Failed to clear conversation');
    }
}

// Modal functions
function openNewMessageModal() {
    const modal = document.getElementById('new-message-modal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    
    // Clear inputs
    const searchInput = document.getElementById('recipient-search');
    const contentInput = document.getElementById('new-message-content');
    
    if (searchInput) {
        searchInput.value = '';
        delete searchInput.dataset.selectedUserId;
    }
    
    if (contentInput) {
        contentInput.value = '';
    }
    
    // Show empty results
    const resultsContainer = document.getElementById('recipient-results');
    if (resultsContainer) {
        resultsContainer.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                Start typing to search for friends
            </div>
        `;
    }
    
    // Focus search input
    if (searchInput) {
        searchInput.focus();
    }
}

function closeNewMessageModal() {
    const modal = document.getElementById('new-message-modal');
    if (modal) modal.classList.add('hidden');
}

function openConversationInfoModal() {
    const modal = document.getElementById('conversation-info-modal');
    if (!modal) return;
    
    const activeConv = document.getElementById('active-conversation');
    const otherUserId = activeConv?.dataset.currentUserId;
    
    if (!otherUserId) return;
    
    // Find conversation
    const conversation = conversations.find(c => c.user.id === otherUserId);
    if (!conversation) return;
    
    const otherUser = conversation.user;
    
    // Populate modal content
    const content = document.getElementById('conversation-info-content');
    if (content) {
        content.innerHTML = `
            <div class="flex flex-col items-center mb-6">
                <div class="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center mb-4">
                    ${otherUser.avatar_url ? `
                        <img src="${otherUser.avatar_url}" 
                             alt="${otherUser.username}" 
                             class="w-full h-full rounded-full object-cover">
                    ` : `
                        <span class="text-white font-bold text-2xl">
                            ${otherUser.username?.charAt(0) || 'U'}
                        </span>
                    `}
                </div>
                <h4 class="text-white font-bold text-xl">${otherUser.username}</h4>
                ${otherUser.favorite_console ? `
                    <p class="text-gray-400 mt-1">🎮 ${otherUser.favorite_console}</p>
                ` : ''}
            </div>
            
            <div class="space-y-4">
                <div class="flex justify-between">
                    <span class="text-gray-400">Messages:</span>
                    <span class="text-white font-semibold">${conversation.messages.length}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-400">Last message:</span>
                    <span class="text-white">${formatMessageTime(conversation.lastMessage.created_at)}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-400">Conversation started:</span>
                    <span class="text-white">${conversation.messages.length > 0 ? formatMessageTime(conversation.messages[0].created_at) : 'N/A'}</span>
                </div>
            </div>
        `;
    }
    
    modal.classList.remove('hidden');
}

function closeConversationInfoModal() {
    const modal = document.getElementById('conversation-info-modal');
    if (modal) modal.classList.add('hidden');
}

// Helper functions
function formatMessageTime(dateString, showTime = false) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) {
        return 'Just now';
    } else if (diffMins < 60) {
        return `${diffMins}m ago`;
    } else if (diffHours < 24) {
        return `${diffHours}h ago`;
    } else if (diffDays < 7) {
        return `${diffDays}d ago`;
    } else if (showTime) {
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        return date.toLocaleDateString();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transform transition-transform duration-300 ${
        type === 'success' ? 'bg-green-600 text-white' :
        type === 'error' ? 'bg-red-600 text-white' :
        'bg-cyan-600 text-white'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Request notification permission on page load
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// Global modal functions
window.closeNewMessageModal = closeNewMessageModal;
window.closeConversationInfoModal = closeConversationInfoModal;
