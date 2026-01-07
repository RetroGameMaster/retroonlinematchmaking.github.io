import { supabase, getCurrentUser } from '../../lib/supabase.js';

let currentGameId = null;
let commentsSubscription = null;

export function initModule() {
    console.log('🎮 Game Detail module initialized');
    loadGameFromURL();
}

function loadGameFromURL() {
    // Get game ID from URL hash (format: #/game/:id)
    const hash = window.location.hash;
    const match = hash.match(/\/game\/([^\/]+)/);
    
    if (match && match[1]) {
        currentGameId = match[1];
        loadGame(currentGameId);
    } else {
        showError('Invalid game URL');
    }
}

async function loadGame(gameId) {
    try {
        // Increment view count
        await supabase
            .from('games')
            .update({ 
                views_count: supabase.raw('views_count + 1'),
                last_activity: new Date().toISOString()
            })
            .eq('id', gameId);
        
        // Get game data
        const { data: game, error } = await supabase
            .from('games')
            .select('*')
            .eq('id', gameId)
            .single();
        
        if (error) throw error;
        
        // Get comments
        const { data: comments } = await supabase
            .from('game_comments')
            .select('*')
            .eq('game_id', gameId)
            .eq('is_removed', false)
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false });
        
        // Render game
        renderGame(game, comments || []);
        
        // Setup comments subscription
        setupCommentsSubscription(gameId);
        
        // Update page title
        document.title = `${game.title} - ROM`;
        
    } catch (error) {
        console.error('Error loading game:', error);
        showError('Game not found or error loading');
    }
}

function renderGame(game, comments) {
    const container = document.getElementById('game-content');
    const loading = document.getElementById('game-loading');
    
    if (!container || !loading) return;
    
    const playerCount = game.players_min === game.players_max 
        ? `${game.players_min} player${game.players_min > 1 ? 's' : ''}` 
        : `${game.players_min}-${game.players_max} players`;
    
    // Format date
    const approvedDate = new Date(game.approved_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Build screenshots HTML
    const screenshotsHTML = game.screenshot_urls && game.screenshot_urls.length > 0 
        ? game.screenshot_urls.map((url, index) => `
            <div class="game-screenshot">
                <img src="${url}" 
                     alt="${game.title} screenshot ${index + 1}"
                     class="w-full h-48 object-cover rounded-lg cursor-pointer"
                     onclick="openLightbox('${url}')">
            </div>
        `).join('')
        : '<p class="text-gray-500 text-center col-span-full py-8">No screenshots available</p>';
    
    container.innerHTML = `
        <!-- Game Header -->
        <div class="mb-8">
            <div class="flex items-center space-x-2 text-sm text-gray-400 mb-4">
                <a href="#/games" class="hover:text-cyan-400">Games</a>
                <span>›</span>
                <span>${game.console}</span>
                <span>›</span>
                <span class="text-cyan-300">${game.title}</span>
            </div>
            
            <div class="flex flex-col lg:flex-row gap-8">
                <!-- Cover Image -->
                <div class="lg:w-1/3">
                    <div class="bg-gray-800 rounded-xl overflow-hidden shadow-2xl">
                        <img src="${game.cover_image_url || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&h=600&fit=crop'}" 
                             alt="${game.title} cover"
                             class="w-full h-auto">
                    </div>
                    
                    <!-- Quick Actions -->
                    <div class="mt-6 space-y-3">
                        ${game.file_url ? `
                            <a href="${game.file_url}" target="_blank" 
                               class="block w-full bg-cyan-600 hover:bg-cyan-700 text-white text-center py-3 rounded-lg font-semibold transition">
                                ⬇️ Download Game
                            </a>
                        ` : ''}
                        
                        <button onclick="showConnectionGuide()" 
                                class="block w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold transition">
                            🌐 Connection Guide
                        </button>
                        
                        <button onclick="shareGame()" 
                                class="block w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg font-semibold transition">
                            🔗 Share Game
                        </button>
                    </div>
                </div>
                
                <!-- Game Info -->
                <div class="lg:w-2/3">
                    <div class="flex justify-between items-start mb-6">
                        <div>
                            <h1 class="text-4xl font-bold text-white mb-2">${game.title}</h1>
                            <div class="flex flex-wrap items-center gap-3 mb-4">
                                <span class="bg-cyan-600 text-white px-3 py-1 rounded text-sm font-semibold">${game.console}</span>
                                <span class="text-gray-300">${game.year}</span>
                                <span class="text-gray-400">•</span>
                                <span class="bg-purple-600 text-white px-3 py-1 rounded text-sm">${game.multiplayer_type || 'Multiplayer'}</span>
                                <span class="text-gray-400">•</span>
                                <span class="text-gray-300">${playerCount}</span>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-sm text-gray-400">Approved</div>
                            <div class="text-lg font-bold text-green-400">${approvedDate}</div>
                        </div>
                    </div>
                    
                    <!-- Description -->
                    <div class="bg-gray-800 p-6 rounded-xl mb-6">
                        <h3 class="text-xl font-bold text-cyan-300 mb-3">📖 Description</h3>
                        <p class="text-gray-300 whitespace-pre-line">${game.description}</p>
                    </div>
                    
                    <!-- Connection Details -->
                    <div class="bg-gray-800 p-6 rounded-xl mb-6 border border-purple-500">
                        <h3 class="text-xl font-bold text-purple-300 mb-3 flex items-center">
                            <span class="mr-2">🌐</span> Online Play Details
                        </h3>
                        
                        <div class="grid md:grid-cols-2 gap-6">
                            <div>
                                <p class="text-gray-300 mb-2">
                                    <strong class="text-cyan-300">Connection Method:</strong><br>
                                    ${game.connection_method || 'Not specified'}
                                </p>
                                
                                ${game.servers_available ? `
                                    <p class="text-green-400 mt-3">
                                        <span class="mr-1">🟢</span> Active servers available
                                    </p>
                                ` : ''}
                            </div>
                            
                            ${game.connection_details ? `
                                <div>
                                    <p class="text-gray-300">
                                        <strong class="text-cyan-300">Instructions:</strong><br>
                                        ${game.connection_details}
                                    </p>
                                </div>
                            ` : ''}
                        </div>
                        
                        ${game.server_details ? `
                            <div class="mt-4 pt-4 border-t border-gray-700">
                                <p class="text-gray-300">
                                    <strong class="text-green-300">Server Information:</strong><br>
                                    ${game.server_details}
                                </p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Screenshots Section -->
        <div class="mb-8">
            <h2 class="text-2xl font-bold text-white mb-4">📸 Screenshots</h2>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                ${screenshotsHTML}
            </div>
        </div>
        
        <!-- Comments Section -->
        <div class="mb-8">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-white">💬 Comments (${comments.length})</h2>
                <button id="new-comment-btn" 
                        class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded">
                    Add Comment
                </button>
            </div>
            
            <!-- New Comment Form (hidden initially) -->
            <div id="comment-form-container" class="hidden mb-6">
                <div class="bg-gray-800 p-4 rounded-xl">
                    <textarea id="comment-input" 
                              class="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white mb-3"
                              rows="3"
                              placeholder="Share your thoughts about this game..."></textarea>
                    <div class="flex justify-end space-x-3">
                        <button onclick="cancelComment()" 
                                class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded">
                            Cancel
                        </button>
                        <button onclick="submitComment()" 
                                class="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded">
                            Post Comment
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Comments List -->
            <div id="comments-list" class="space-y-4">
                ${comments.length > 0 
                    ? comments.map(comment => renderComment(comment)).join('') 
                    : '<p class="text-gray-500 text-center py-8">No comments yet. Be the first!</p>'
                }
            </div>
        </div>
    `;
    
    // Show content, hide loading
    loading.classList.add('hidden');
    container.classList.remove('hidden');
    
    // Setup event listeners
    setupCommentListeners();
}

function renderComment(comment) {
    const timeAgo = getTimeAgo(comment.created_at);
    const isEdited = comment.is_edited ? '<span class="text-gray-500 text-sm ml-2">(edited)</span>' : '';
    const isPinned = comment.is_pinned ? '<span class="bg-yellow-600 text-white text-xs px-2 py-1 rounded ml-2">📌 Pinned</span>' : '';
    
    return `
        <div class="comment-box bg-gray-800 p-4 rounded-xl" data-comment-id="${comment.id}">
            <div class="flex">
                <!-- User Avatar -->
                <div class="comment-avatar rounded-full flex-shrink-0 flex items-center justify-center mr-3">
                    <span class="text-white font-bold">${comment.username?.charAt(0)?.toUpperCase() || 'U'}</span>
                </div>
                
                <!-- Comment Content -->
                <div class="flex-1">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <span class="font-bold text-cyan-300">${comment.username || comment.user_email || 'User'}</span>
                            <span class="text-gray-500 text-sm ml-2">${timeAgo}</span>
                            ${isEdited}
                            ${isPinned}
                        </div>
                        <div class="flex space-x-2">
                            <button onclick="likeComment('${comment.id}')" 
                                    class="text-gray-400 hover:text-red-400">
                                ❤️ ${comment.likes || 0}
                            </button>
                            ${window.currentUser && window.currentUser.id === comment.user_id ? `
                                <button onclick="editComment('${comment.id}')" 
                                        class="text-gray-400 hover:text-cyan-400">
                                    ✏️
                                </button>
                                <button onclick="deleteComment('${comment.id}')" 
                                        class="text-gray-400 hover:text-red-400">
                                    🗑️
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    <p class="text-gray-100 whitespace-pre-line">${comment.comment}</p>
                </div>
            </div>
        </div>
    `;
}

function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
    return date.toLocaleDateString();
}

function setupCommentListeners() {
    document.getElementById('new-comment-btn')?.addEventListener('click', showCommentForm);
}

function showCommentForm() {
    const formContainer = document.getElementById('comment-form-container');
    const newCommentBtn = document.getElementById('new-comment-btn');
    
    if (formContainer && newCommentBtn) {
        formContainer.classList.remove('hidden');
        newCommentBtn.classList.add('hidden');
        document.getElementById('comment-input')?.focus();
    }
}

async function submitComment() {
    const user = await getCurrentUser();
    if (!user) {
        alert('Please login to comment');
        window.location.hash = '#/auth';
        return;
    }
    
    const input = document.getElementById('comment-input');
    const comment = input?.value.trim();
    
    if (!comment) {
        alert('Please enter a comment');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('game_comments')
            .insert({
                game_id: currentGameId,
                user_id: user.id,
                user_email: user.email,
                username: user.email.split('@')[0],
                comment: comment
            });
        
        if (error) throw error;
        
        // Clear and hide form
        input.value = '';
        cancelComment();
        
        // Update game activity
        await supabase
            .from('games')
            .update({ last_activity: new Date().toISOString() })
            .eq('id', currentGameId);
        
    } catch (error) {
        console.error('Error posting comment:', error);
        alert('Failed to post comment');
    }
}

function cancelComment() {
    const formContainer = document.getElementById('comment-form-container');
    const newCommentBtn = document.getElementById('new-comment-btn');
    
    if (formContainer && newCommentBtn) {
        formContainer.classList.add('hidden');
        newCommentBtn.classList.remove('hidden');
    }
}

function setupCommentsSubscription(gameId) {
    if (commentsSubscription) {
        commentsSubscription.unsubscribe();
    }
    
    commentsSubscription = supabase
        .channel(`game-comments-${gameId}`)
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'game_comments', filter: `game_id=eq.${gameId}` },
            (payload) => {
                // Add new comment to top
                const commentsList = document.getElementById('comments-list');
                if (commentsList) {
                    const newComment = renderComment(payload.new);
                    
                    // Remove "no comments" message if present
                    if (commentsList.querySelector('.text-center')) {
                        commentsList.innerHTML = newComment + commentsList.innerHTML;
                    } else {
                        commentsList.insertAdjacentHTML('afterbegin', newComment);
                    }
                }
            }
        )
        .subscribe();
}

function showError(message) {
    const loading = document.getElementById('game-loading');
    const error = document.getElementById('game-error');
    
    if (loading && error) {
        loading.classList.add('hidden');
        error.classList.remove('hidden');
        
        if (message) {
            error.querySelector('p').textContent = message;
        }
    }
}

// Global functions for buttons
window.showConnectionGuide = function() {
    alert('Connection guide modal would open here');
};

window.shareGame = function() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
        alert('Game link copied to clipboard!');
    });
};

window.openLightbox = function(imageUrl) {
    // Simple lightbox implementation
    const lightbox = document.createElement('div');
    lightbox.className = 'fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center';
    lightbox.innerHTML = `
        <div class="relative max-w-4xl max-h-full">
            <img src="${imageUrl}" class="max-w-full max-h-screen">
            <button onclick="this.parentElement.parentElement.remove()" 
                    class="absolute top-4 right-4 text-white text-3xl">
                &times;
            </button>
        </div>
    `;
    lightbox.onclick = (e) => {
        if (e.target === lightbox) lightbox.remove();
    };
    document.body.appendChild(lightbox);
};

// Clean up on module unload
window.addEventListener('beforeunload', () => {
    if (commentsSubscription) {
        commentsSubscription.unsubscribe();
    }
});
