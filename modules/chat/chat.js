export function initModule() {
    console.log('💬 Chat module initialized');
    
    // Simple chat interface
    const chatContent = document.getElementById('app-content');
    if (chatContent.innerHTML.includes('coming soon')) {
        chatContent.innerHTML = `
            <div class="max-w-4xl mx-auto">
                <div class="bg-gray-800 rounded-lg border border-cyan-500 overflow-hidden">
                    <!-- Chat Header -->
                    <div class="bg-gray-900 p-4 border-b border-gray-700">
                        <h1 class="text-2xl font-bold text-cyan-400">💬 Live Chat</h1>
                        <p class="text-gray-300">Connect with retro gaming communities</p>
                    </div>
                    
                    <!-- Chat Container -->
                    <div class="flex flex-col md:flex-row h-[500px]">
                        <!-- Online Users -->
                        <div class="w-full md:w-1/4 bg-gray-900 p-4 border-r border-gray-700">
                            <h3 class="font-bold text-white mb-4">Online Users</h3>
                            <div id="online-users" class="space-y-2">
                                <div class="flex items-center">
                                    <div class="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                                    <span class="text-gray-300">You</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Chat Messages -->
                        <div class="flex-1 flex flex-col">
                            <div id="chat-messages" class="flex-1 p-4 overflow-y-auto">
                                <div class="text-center text-gray-500 py-8">
                                    <p>No messages yet. Start the conversation!</p>
                                </div>
                            </div>
                            
                            <!-- Message Input -->
                            <div class="p-4 border-t border-gray-700">
                                <div class="flex space-x-2">
                                    <input type="text" id="message-input" 
                                           class="flex-1 p-3 bg-gray-700 border border-gray-600 rounded text-white"
                                           placeholder="Type your message...">
                                    <button id="send-btn" 
                                            class="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded">
                                        Send
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add chat functionality
        initChat();
    }
}

function initChat() {
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const chatMessages = document.getElementById('chat-messages');
    
    if (sendBtn && messageInput) {
        sendBtn.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }
    
    function sendMessage() {
        const message = messageInput.value.trim();
        if (!message) return;
        
        // Add message to chat
        const messageDiv = document.createElement('div');
        messageDiv.className = 'mb-4';
        messageDiv.innerHTML = `
            <div class="bg-gray-700 rounded-lg p-3 max-w-md">
                <div class="flex justify-between mb-1">
                    <span class="font-bold text-cyan-300">You</span>
                    <span class="text-gray-400 text-sm">Just now</span>
                </div>
                <p class="text-gray-100">${message}</p>
            </div>
        `;
        
        if (chatMessages) {
            // Remove "no messages" placeholder
            if (chatMessages.querySelector('.text-center')) {
                chatMessages.innerHTML = '';
            }
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        
        // Clear input
        messageInput.value = '';
        messageInput.focus();
    }
}
