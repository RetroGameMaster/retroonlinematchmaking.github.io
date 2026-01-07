import { supabase, getCurrentUser } from '../../lib/supabase.js';

let currentGameId = null;
let commentsSubscription = null;
let isAdmin = false;
let currentUser = null;

export function initModule() {
    console.log('🎮 Game Detail module initialized');
    checkAdminStatus();
    loadGameFromURL();
}

async function checkAdminStatus() {
    currentUser = await getCurrentUser();
    if (!currentUser) return;
    
    try {
        // Check if user is admin
        const adminEmails = [
            'retrogamemasterra@gmail.com',
            'admin@retroonlinematchmaking.com'
        ];
        
        isAdmin = adminEmails.includes(currentUser.email);
        
        // Also check via RPC function if available
        if (!isAdmin) {
            const { data: isAdminRPC, error } = await supabase.rpc('is_admin', {
                user_uuid: currentUser.id
            });
            
            if (!error && isAdminRPC) {
                isAdmin = true;
            }
        }
        
        console.log('Admin status:', isAdmin, 'for user:', currentUser.email);
    } catch (error) {
        console.error('Error checking admin status:', error);
    }
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
        // First get the game to get current view count
        const { data: game, error: fetchError } = await supabase
            .from('games')
            .select('*')
            .eq('id', gameId)
            .single();
        
        if (fetchError) throw fetchError;
        
        // Increment view count without using raw()
        const currentViews = game.views_count || 0;
        await supabase
            .from('games')
            .update({ 
                views_count: currentViews + 1,
                last_activity: new Date().toISOString()
            })
            .eq('id', gameId);
        
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
    
    // Admin edit buttons - only show if user is admin
    const adminButtons = isAdmin ? `
        <div class="flex gap-2 mb-6">
            <button onclick="openEditGameModal()" 
                    class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                </svg>
                Edit Game
            </button>
            <button onclick="showDeleteGameConfirmation()" 
                    class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
                Delete Game
            </button>
        </div>
    ` : '';
    
    container.innerHTML = `
        <!-- Admin Edit Buttons -->
        ${adminButtons}
        
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
                             class="w-full h-auto"
                             id="game-cover-image-display">
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
                            <h1 class="text-4xl font-bold text-white mb-2" id="game-title-display">${game.title}</h1>
                            <div class="flex flex-wrap items-center gap-3 mb-4">
                                <span class="bg-cyan-600 text-white px-3 py-1 rounded text-sm font-semibold" id="game-console-display">${game.console}</span>
                                <span class="text-gray-300" id="game-year-display">${game.year}</span>
                                <span class="text-gray-400">•</span>
                                <span class="bg-purple-600 text-white px-3 py-1 rounded text-sm" id="game-multiplayer-display">${game.multiplayer_type || 'Multiplayer'}</span>
                                <span class="text-gray-400">•</span>
                                <span class="text-gray-300" id="game-players-display">${playerCount}</span>
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
                        <p class="text-gray-300 whitespace-pre-line" id="game-description-display">${game.description}</p>
                    </div>
                    
                    <!-- Connection Details -->
                    ${game.connection_method || game.connection_details ? `
                    <div class="bg-gray-800 p-6 rounded-xl mb-6 border border-purple-500">
                        <h3 class="text-xl font-bold text-purple-300 mb-3 flex items-center">
                            <span class="mr-2">🌐</span> Online Play Details
                        </h3>
                        
                        <div class="grid md:grid-cols-2 gap-6">
                            ${game.connection_method ? `
                            <div>
                                <p class="text-gray-300 mb-2">
                                    <strong class="text-cyan-300">Connection Method:</strong><br>
                                    <span id="game-connection-method-display">${game.connection_method}</span>
                                </p>
                            </div>
                            ` : ''}
                            
                            ${game.connection_details ? `
                            <div>
                                <p class="text-gray-300">
                                    <strong class="text-cyan-300">Instructions:</strong><br>
                                    <span id="game-connection-details-display">${game.connection_details}</span>
                                </p>
                            </div>
                            ` : ''}
                        </div>
                        
                        ${game.servers_available ? `
                            <p class="text-green-400 mt-4">
                                <span class="mr-1">🟢</span> <span id="game-servers-display">Active servers available</span>
                            </p>
                        ` : ''}
                        
                        ${game.server_details ? `
                            <div class="mt-4 pt-4 border-t border-gray-700">
                                <p class="text-gray-300">
                                    <strong class="text-green-300">Server Information:</strong><br>
                                    <span id="game-server-details-display">${game.server_details}</span>
                                </p>
                            </div>
                        ` : ''}
                    </div>
                    ` : ''}
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
        
        <!-- Edit Game Modal (Hidden by default) -->
        ${isAdmin ? generateEditGameModal(game) : ''}
        
        <!-- Delete Confirmation Modal -->
        ${isAdmin ? generateDeleteGameModal(game) : ''}
    `;
    
    // Show content, hide loading
    loading.classList.add('hidden');
    container.classList.remove('hidden');
    
    // Setup event listeners
    setupCommentListeners();
    if (isAdmin) {
        setupEditGameForm();
    }
}

function generateEditGameModal(game) {
    return `
        <div id="edit-game-modal" class="hidden fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
            <div class="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div class="p-6">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-2xl font-bold text-white">Edit Game: ${game.title}</h2>
                        <button onclick="closeEditGameModal()" class="text-gray-400 hover:text-white">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    
                    <form id="edit-game-form" class="space-y-4">
                        <input type="hidden" id="edit-game-id" value="${game.id}">
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-gray-300 mb-2">Game Title *</label>
                                <input type="text" id="edit-game-title" value="${game.title}" required 
                                       class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500">
                            </div>
                            
                            <div>
                                <label class="block text-gray-300 mb-2">Console *</label>
                                <select id="edit-game-console" required 
                                        class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500">
                                    ${generateConsoleOptions(game.console)}
                                </select>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-gray-300 mb-2">Release Year</label>
                                <input type="number" id="edit-game-year" value="${game.year || ''}" min="1970" max="2024" 
                                       class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500">
                            </div>
                            
                            <div>
                                <label class="block text-gray-300 mb-2">Multiplayer Type</label>
                                <select id="edit-game-multiplayer-type" 
                                        class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500">
                                    <option value="">Select type</option>
                                    <option value="Local" ${game.multiplayer_type === 'Local' ? 'selected' : ''}>Local Multiplayer</option>
                                    <option value="Online" ${game.multiplayer_type === 'Online' ? 'selected' : ''}>Online Multiplayer</option>
                                    <option value="Both" ${game.multiplayer_type === 'Both' ? 'selected' : ''}>Local & Online</option>
                                    <option value="Single" ${game.multiplayer_type === 'Single' ? 'selected' : ''}>Single Player Only</option>
                                </select>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-gray-300 mb-2">Description *</label>
                            <textarea id="edit-game-description" rows="4" required 
                                      class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500">${game.description || ''}</textarea>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-gray-300 mb-2">Cover Image URL</label>
                                <input type="url" id="edit-game-cover-image" value="${game.cover_image_url || ''}" 
                                       class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500" 
                                       placeholder="https://example.com/image.jpg">
                            </div>
                            
                            <div>
                                <label class="block text-gray-300 mb-2">Game File URL</label>
                                <input type="url" id="edit-game-file-url" value="${game.file_url || ''}" 
                                       class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500" 
                                       placeholder="https://example.com/game.zip">
                            </div>
                        </div>
                        
                        <!-- Multiplayer Connection Details -->
                        <div class="bg-gray-900 p-4 rounded-lg border border-purple-500">
                            <h3 class="text-lg font-bold text-purple-300 mb-3">🌐 Multiplayer Connection Details</h3>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label class="block text-gray-300 mb-2">Connection Method</label>
                                    <input type="text" id="edit-game-connection-method" value="${game.connection_method || ''}" 
                                           class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500" 
                                           placeholder="e.g., Kaillera, Parsec, RetroArch">
                                </div>
                                
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="block text-gray-300 mb-2">Min Players</label>
                                        <input type="number" id="edit-game-players-min" value="${game.players_min || 1}" min="1" max="8"
                                               class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500">
                                    </div>
                                    <div>
                                        <label class="block text-gray-300 mb-2">Max Players</label>
                                        <input type="number" id="edit-game-players-max" value="${game.players_max || 1}" min="1" max="8"
                                               class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500">
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <label class="block text-gray-300 mb-2">Connection Instructions</label>
                                <textarea id="edit-game-connection-details" rows="3" 
                                          class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500">${game.connection_details || ''}</textarea>
                            </div>
                            
                            <div class="mt-4 flex items-center gap-2">
                                <input type="checkbox" id="edit-game-servers-available" ${game.servers_available ? 'checked' : ''}
                                       class="w-4 h-4 text-purple-500 bg-gray-700 border-gray-600 rounded focus:ring-purple-500">
                                <label class="text-gray-300">Active servers available</label>
                            </div>
                            
                            ${game.server_details ? `
                            <div class="mt-4">
                                <label class="block text-gray-300 mb-2">Server Details</label>
                                <textarea id="edit-game-server-details" rows="2" 
                                          class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500">${game.server_details || ''}</textarea>
                            </div>
                            ` : ''}
                        </div>
                        
                        <div class="flex justify-end gap-3 pt-4">
                            <button type="button" onclick="closeEditGameModal()" 
                                    class="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition">
                                Cancel
                            </button>
                            <button type="submit" 
                                    class="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition">
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
}

function generateDeleteGameModal(game) {
    return `
        <div id="delete-game-modal" class="hidden fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
            <div class="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
                <div class="p-6">
                    <h2 class="text-2xl font-bold text-white mb-4">Delete Game</h2>
                    <p class="text-gray-300 mb-6">Are you sure you want to delete "${game.title}"? This action cannot be undone. All comments and data will be permanently removed.</p>
                    <div class="flex justify-end gap-3">
                        <button onclick="closeDeleteGameModal()" 
                                class="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition">
                            Cancel
                        </button>
                        <button onclick="deleteGame()" 
                                class="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition">
                            Delete Game
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function generateConsoleOptions(selectedConsole) {
    const consoles = [
        "3D0", "Arcade", "AES", "Dreamcast", "Gameboy", "Gameboy Color", 
        "GameCube", "Gamegear", "GBA", "Genesis/Megadrive", "N64", "NDS", 
        "Neo Geo CD", "NES", "Nintendo Switch", "Other", "PC", "PS1", "PS2", 
        "PS3", "PS4", "PS5", "PSP", "PSVita", "Saturn", "Sega 32X", "Sega CD", 
        "Sega Mark III", "SG-1000", "SNES", "T-16/CD", "VB", "Wii", "Wii U", 
        "XBOX", "XBOX 360", "3DS"
    ];
    
    let options = '<option value="">Select a system</option>';
    options += consoles.map(console => 
        `<option value="${console}" ${console === selectedConsole ? 'selected' : ''}>${console}</option>`
    ).join('');
    
    return options;
}

function setupEditGameForm() {
    const form = document.getElementById('edit-game-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveGameChanges();
        });
    }
}

async function saveGameChanges() {
    const gameId = document.getElementById('edit-game-id').value;
    const submitBtn = document.querySelector('#edit-game-form button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    submitBtn.textContent = 'Saving...';
    submitBtn.disabled = true;
    
    try {
        const gameData = {
            title: document.getElementById('edit-game-title').value.trim(),
            console: document.getElementById('edit-game-console').value,
            year: document.getElementById('edit-game-year').value || null,
            description: document.getElementById('edit-game-description').value.trim(),
            cover_image_url: document.getElementById('edit-game-cover-image').value.trim() || null,
            file_url: document.getElementById('edit-game-file-url').value.trim() || null,
            multiplayer_type: document.getElementById('edit-game-multiplayer-type').value || null,
            connection_method: document.getElementById('edit-game-connection-method').value.trim() || null,
            connection_details: document.getElementById('edit-game-connection-details').value.trim() || null,
            players_min: parseInt(document.getElementById('edit-game-players-min').value) || 1,
            players_max: parseInt(document.getElementById('edit-game-players-max').value) || 1,
            servers_available: document.getElementById('edit-game-servers-available').checked,
            server_details: document.getElementById('edit-game-server-details')?.value.trim() || null,
            updated_at: new Date().toISOString()
        };
        
        console.log('Updating game:', gameData);
        
        const { error } = await supabase
            .from('games')
            .update(gameData)
            .eq('id', gameId);
        
        if (error) throw error;
        
        // Update displayed values without reloading page
        updateDisplayedGame(gameData);
        
        // Close modal
        closeEditGameModal();
        
        // Show success notification
        showNotification('Game updated successfully!', 'success');
        
    } catch (error) {
        console.error('Error updating game:', error);
        showNotification('Error updating game: ' + error.message, 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

function updateDisplayedGame(gameData) {
    // Update all displayed fields
    document.getElementById('game-title-display').textContent = gameData.title;
    document.getElementById('game-console-display').textContent = gameData.console;
    document.getElementById('game-year-display').textContent = gameData.year || '';
    document.getElementById('game-description-display').textContent = gameData.description || '';
    document.getElementById('game-multiplayer-display').textContent = gameData.multiplayer_type || 'Multiplayer';
    
    // Update player count display
    const playerCount = gameData.players_min === gameData.players_max 
        ? `${gameData.players_min} player${gameData.players_min > 1 ? 's' : ''}` 
        : `${gameData.players_min}-${gameData.players_max} players`;
    document.getElementById('game-players-display').textContent = playerCount;
    
    // Update connection details if they exist
    if (gameData.connection_method) {
        const methodElement = document.getElementById('game-connection-method-display');
        if (methodElement) methodElement.textContent = gameData.connection_method;
    }
    if (gameData.connection_details) {
        const detailsElement = document.getElementById('game-connection-details-display');
        if (detailsElement) detailsElement.textContent = gameData.connection_details;
    }
    if (gameData.server_details) {
        const serverElement = document.getElementById('game-server-details-display');
        if (serverElement) serverElement.textContent = gameData.server_details;
    }
    
    // Update servers available display
    const serversElement = document.getElementById('game-servers-display');
    if (serversElement) {
        serversElement.textContent = gameData.servers_available ? 'Active servers available' : '';
    }
    
    // Update cover image if URL changed
    const coverImg = document.getElementById('game-cover-image-display');
    if (coverImg && gameData.cover_image_url) {
        coverImg.src = gameData.cover_image_url;
    }
}

// Global functions for edit game modal
window.openEditGameModal = function() {
    const modal = document.getElementById('edit-game-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
};

window.closeEditGameModal = function() {
    const modal = document.getElementById('edit-game-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
};

window.showDeleteGameConfirmation = function() {
    const modal = document.getElementById('delete-game-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
};

window.closeDeleteGameModal = function() {
    const modal = document.getElementById('delete-game-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
};

window.deleteGame = async function() {
    if (!confirm('Are you absolutely sure? This will permanently delete the game and all associated comments.')) {
        return;
    }
    
    try {
        const gameId = currentGameId;
        
        // First delete all comments for this game
        await supabase
            .from('game_comments')
            .delete()
            .eq('game_id', gameId);
        
        // Then delete the game
        const { error } = await supabase
            .from('games')
            .delete()
            .eq('id', gameId);
        
        if (error) throw error;
        
        showNotification('Game deleted successfully!', 'success');
        
        // Redirect back to games library after a delay
        setTimeout(() => {
            window.location.hash = '#/games';
        }, 1500);
        
    } catch (error) {
        console.error('Error deleting game:', error);
        showNotification('Error deleting game: ' + error.message, 'error');
    }
};

function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transition transform duration-300 ${
        type === 'success' ? 'bg-green-600 text-white' :
        type === 'error' ? 'bg-red-600 text-white' :
        'bg-cyan-600 text-white'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.classList.add('opacity-0', 'translate-x-full');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// -----------------------------------------------------------------
// YOUR EXISTING FUNCTIONS BELOW (KEEP ALL OF THESE)
// -----------------------------------------------------------------

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
