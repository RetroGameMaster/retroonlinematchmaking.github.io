import { supabase, getCurrentUser } from '../../lib/supabase.js';

let allGames = [];
let currentDeleteGameId = null;

export function initModule() {
    console.log('Admin module initialized');
    checkAdminAccess();
    loadPendingSubmissions();
    loadAdminUsers();
    loadAdminGames(); // Load games library
    
    // Setup admin management
    setupAdminManagement();
    
    // Setup game form listeners
    setupGameFormListeners();
}

async function checkAdminAccess() {
    const user = await getCurrentUser();
    
    if (!user) {
        alert('Please login to access admin panel');
        window.location.hash = '#/auth';
        return;
    }
    
    // Check if user is admin using our is_admin function
    const { data: isAdmin, error } = await supabase.rpc('is_admin', {
        user_uuid: user.id
    });
    
    if (error || !isAdmin) {
        alert('Admin access required');
        window.location.hash = '#/';
        return;
    }
}

async function loadPendingSubmissions() {
    const submissionsContainer = document.getElementById('pending-submissions');
    if (!submissionsContainer) return;
    
    submissionsContainer.innerHTML = '<div class="text-center py-8"><div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div><p class="text-gray-400 mt-2">Loading submissions...</p></div>';
    
    try {
        // Try to use the view first
        const { data: submissions, error } = await supabase
            .from('game_submissions_with_users')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: true });
        
        if (error) {
            console.log('View not available, trying direct table:', error);
            
            // Fallback to direct table query
            const { data: simpleSubmissions, error: simpleError } = await supabase
                .from('game_submissions')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: true });
            
            if (simpleError) throw simpleError;
            
            renderSubmissions(simpleSubmissions);
            return;
        }
        
        if (!submissions || submissions.length === 0) {
            submissionsContainer.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-4xl mb-4">📭</div>
                    <h3 class="text-xl font-bold text-white mb-2">No Pending Submissions</h3>
                    <p class="text-gray-300">All game submissions have been reviewed.</p>
                    <p class="text-gray-400 text-sm mt-2">New submissions will appear here when users submit games.</p>
                </div>
            `;
            return;
        }
        
        renderSubmissions(submissions);
        
    } catch (error) {
        console.error('Error loading submissions:', error);
        submissionsContainer.innerHTML = `
            <div class="bg-red-900 border border-red-700 rounded-lg p-6 text-center">
                <h3 class="text-lg font-bold text-red-300 mb-2">Error Loading Submissions</h3>
                <p class="text-red-200 mb-2">${error.message}</p>
                <p class="text-gray-300 text-sm mb-4">This might be a database setup issue.</p>
                <button onclick="window.location.reload()" 
                        class="mt-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">
                    Refresh Page
                </button>
            </div>
        `;
    }
}

function renderSubmissions(submissions) {
    const submissionsContainer = document.getElementById('pending-submissions');
    if (!submissionsContainer) return;
    
    submissionsContainer.innerHTML = submissions.map(sub => {
        const userEmail = sub.user_email || sub.email || 'Unknown User';
        const username = sub.username || userEmail.split('@')[0];
        const playerCount = sub.players_min === sub.players_max 
            ? `${sub.players_min} player${sub.players_min > 1 ? 's' : ''}` 
            : `${sub.players_min}-${sub.players_max} players`;
        
        return `
            <div class="bg-gray-800 p-6 rounded-lg mb-4 border border-gray-700 hover:border-yellow-500 transition">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-2xl font-bold text-white mb-2">${sub.title}</h3>
                        <div class="flex flex-wrap items-center gap-2 mt-2">
                            <span class="bg-gray-700 text-gray-300 px-3 py-1 rounded text-sm">${sub.console}</span>
                            <span class="text-gray-400">${sub.year}</span>
                            <span class="text-gray-500 text-sm">
                                Submitted by: <span class="text-cyan-300">${username}</span>
                            </span>
                            <span class="text-gray-500 text-sm">
                                ${new Date(sub.created_at).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                    <span class="bg-yellow-600 text-white px-3 py-1 rounded text-sm font-semibold">
                        ⏳ Pending Review
                    </span>
                </div>
                
                <p class="text-gray-300 mb-4">${sub.description || 'No description provided.'}</p>
                
                <!-- Connection Info -->
                <div class="bg-gray-900 p-4 rounded-lg mb-4 border border-purple-500">
                    <h4 class="font-bold text-purple-300 mb-2">🌐 Connection Details</h4>
                    <div class="grid md:grid-cols-2 gap-4">
                        <div>
                            <p class="text-gray-300">
                                <strong>Type:</strong> ${sub.multiplayer_type || 'Not specified'}
                            </p>
                            <p class="text-gray-300">
                                <strong>Players:</strong> ${playerCount}
                            </p>
                        </div>
                        <div>
                            <p class="text-gray-300">
                                <strong>Method:</strong> ${sub.connection_method || 'Not specified'}
                            </p>
                            ${sub.servers_available ? 
                                '<p class="text-green-400">🟢 Active servers reported</p>' : 
                                '<p class="text-yellow-400">🟡 No server info</p>'
                            }
                        </div>
                    </div>
                    
                    ${sub.connection_details ? `
                        <div class="mt-3 pt-3 border-t border-gray-700">
                            <p class="text-gray-300 text-sm">
                                <strong>Instructions:</strong> ${sub.connection_details}
                            </p>
                        </div>
                    ` : ''}
                </div>
                
                ${sub.notes ? `
                    <div class="bg-gray-900 p-3 rounded mb-4">
                        <p class="text-gray-400 text-sm"><strong>Notes:</strong> ${sub.notes}</p>
                    </div>
                ` : ''}
                
                ${sub.file_url ? `
                    <div class="mb-4">
                        <a href="${sub.file_url}" target="_blank" 
                           class="inline-flex items-center bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded">
                            <span class="mr-2">📎</span>
                            Download Game File
                        </a>
                    </div>
                ` : ''}
                
                <div class="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                    <button onclick="approveSubmission('${sub.id}')" 
                            class="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded font-semibold transition flex items-center justify-center">
                        <span class="mr-2">✅</span>
                        Approve
                    </button>
                    <button onclick="rejectSubmission('${sub.id}')" 
                            class="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded font-semibold transition flex items-center justify-center">
                        <span class="mr-2">❌</span>
                        Reject
                    </button>
                    <button onclick="showReviewModal('${sub.id}', '${escapeString(sub.title)}')" 
                            class="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-3 rounded font-semibold transition flex items-center justify-center">
                        <span class="mr-2">📝</span>
                        Review with Notes
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Global function for approving submissions
window.approveSubmission = async (submissionId) => {
    if (!confirm('Approve this game submission?')) return;
    
    try {
        const user = await getCurrentUser();
        
        // Get the submission first
        const { data: submission, error: fetchError } = await supabase
            .from('game_submissions')
            .select('*')
            .eq('id', submissionId)
            .single();
        
        if (fetchError) throw fetchError;
        
        // Update submission status
        const { error: updateError } = await supabase
            .from('game_submissions')
            .update({
                status: 'approved',
                reviewed_at: new Date().toISOString(),
                reviewed_by: user.id
            })
            .eq('id', submissionId);
        
        if (updateError) throw updateError;
        
        // Add to games table WITH CONNECTION DETAILS
        const gameData = {
            title: submission.title,
            console: submission.console,
            year: submission.year,
            description: submission.description,
            file_url: submission.file_url,
            submitted_by: submission.user_id,
            submitted_email: submission.user_email,
            approved_at: new Date().toISOString(),
            
            // Copy connection details
            connection_method: submission.connection_method,
            connection_details: submission.connection_details,
            multiplayer_type: submission.multiplayer_type,
            players_min: submission.players_min,
            players_max: submission.players_max,
            servers_available: submission.servers_available,
            server_details: submission.server_details
        };
        
        console.log('Inserting game with data:', gameData);
        
        await supabase.from('games').insert(gameData);
        
        showNotification('Game approved and added to library with connection details!', 'success');
        loadPendingSubmissions();
        
    } catch (error) {
        console.error('Error approving submission:', error);
        showNotification('Error approving submission: ' + error.message, 'error');
    }
};

window.rejectSubmission = async (submissionId) => {
    const reason = prompt('Reason for rejection (optional):');
    
    try {
        const user = await getCurrentUser();
        
        const { error } = await supabase
            .from('game_submissions')
            .update({
                status: 'rejected',
                reviewed_at: new Date().toISOString(),
                reviewed_by: user.id,
                review_notes: reason || 'No reason provided'
            })
            .eq('id', submissionId);
        
        if (error) throw error;
        
        showNotification('Game submission rejected', 'success');
        loadPendingSubmissions();
        
    } catch (error) {
        console.error('Error rejecting submission:', error);
        showNotification('Error rejecting submission: ' + error.message, 'error');
    }
};

async function loadAdminUsers() {
    const adminList = document.getElementById('admin-list');
    if (!adminList) return;
    
    adminList.innerHTML = '<div class="text-center py-4"><div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div></div>';
    
    try {
        // Use the admin_users view we created
        const { data: admins, error } = await supabase
            .from('admin_users')
            .select('*')
            .order('admin_since', { ascending: false });
        
        if (error) throw error;
        
        if (!admins || admins.length === 0) {
            adminList.innerHTML = '<p class="text-gray-500 text-center py-8">No admin users found.</p>';
            return;
        }
        
        const currentUser = await getCurrentUser();
        
        adminList.innerHTML = `
            <div class="overflow-x-auto">
                <table class="min-w-full bg-gray-800 rounded-lg overflow-hidden">
                    <thead class="bg-gray-900">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Role</th>
                            <th class="px6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Admin Since</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-700">
                        ${admins.map(admin => `
                            <tr class="hover:bg-gray-750">
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div class="flex items-center">
                                        <div class="ml-4">
                                            <div class="text-sm font-medium text-white">${admin.email}</div>
                                            <div class="text-sm text-gray-400">User since: ${new Date(admin.user_created).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-600 text-white">
                                        ${admin.role}
                                    </span>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                    ${new Date(admin.admin_since).toLocaleDateString()}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    ${admin.user_id !== currentUser?.id ? `
                                        <button onclick="removeAdmin('${admin.user_id}', '${admin.email.replace(/'/g, "\\'")}')" 
                                                class="text-red-600 hover:text-red-900">
                                            Remove Admin
                                        </button>
                                    ` : '<span class="text-gray-500">Current User</span>'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading admins:', error);
        adminList.innerHTML = '<p class="text-red-500 text-center py-8">Error loading admin users.</p>';
    }
}

function setupAdminManagement() {
    const addAdminForm = document.getElementById('add-admin-form');
    if (addAdminForm) {
        addAdminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const emailInput = document.getElementById('admin-email');
            const email = emailInput.value.trim();
            const submitBtn = addAdminForm.querySelector('button[type="submit"]');
            
            if (!email) {
                showNotification('Please enter an email address', 'error');
                return;
            }
            
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Adding...';
            
            try {
                // Use our RPC function to add admin
                const { data, error } = await supabase.rpc('add_admin_by_email', {
                    user_email: email
                });
                
                if (error) throw error;
                
                if (data.success) {
                    showNotification(`Added ${email} as admin`, 'success');
                    emailInput.value = '';
                    loadAdminUsers();
                } else {
                    showNotification(data.message || 'Failed to add admin', 'error');
                }
                
            } catch (error) {
                console.error('Error adding admin:', error);
                showNotification('Error adding admin: ' + error.message, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }
}

window.removeAdmin = async (userId, userEmail) => {
    if (!confirm(`Remove admin privileges from ${userEmail}?`)) return;
    
    try {
        const { data, error } = await supabase.rpc('remove_admin_by_email', {
            user_email: userEmail
        });
        
        if (error) throw error;
        
        if (data.success) {
            showNotification(`Removed admin privileges from ${userEmail}`, 'success');
            loadAdminUsers();
        } else {
            showNotification(data.message || 'Failed to remove admin', 'error');
        }
        
    } catch (error) {
        console.error('Error removing admin:', error);
        showNotification('Error removing admin: ' + error.message, 'error');
    }
};

window.showReviewModal = (submissionId, gameTitle) => {
    const modalHTML = `
        <div id="review-modal" class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div class="bg-gray-800 rounded-lg max-w-md w-full border border-cyan-500">
                <div class="p-6">
                    <h3 class="text-xl font-bold text-white mb-2">Review: ${gameTitle}</h3>
                    <p class="text-gray-300 mb-4">Add notes and choose action:</p>
                    
                    <div class="mb-4">
                        <label class="block text-gray-300 mb-2">Review Notes</label>
                        <textarea id="review-notes" rows="4" 
                                  class="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                                  placeholder="Optional notes about your decision..."></textarea>
                    </div>
                    
                    <div class="flex space-x-3">
                        <button onclick="submitReview('${submissionId}', 'approved')" 
                                class="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                            Approve
                        </button>
                        <button onclick="submitReview('${submissionId}', 'rejected')" 
                                class="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">
                            Reject
                        </button>
                        <button onclick="closeReviewModal()" 
                                class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.closeReviewModal = () => {
    const modal = document.getElementById('review-modal');
    if (modal) modal.remove();
};

window.submitReview = async (submissionId, action) => {
    const notes = document.getElementById('review-notes')?.value || '';
    
    try {
        const user = await getCurrentUser();
        
        // Update submission
        const { error } = await supabase
            .from('game_submissions')
            .update({
                status: action,
                reviewed_at: new Date().toISOString(),
                reviewed_by: user.id,
                review_notes: notes
            })
            .eq('id', submissionId);
        
        if (error) throw error;
        
        // If approved, add to games table
        if (action === 'approved') {
            const { data: submission } = await supabase
                .from('game_submissions')
                .select('*')
                .eq('id', submissionId)
                .single();
            
            if (submission) {
                await supabase.from('games').insert({
                    title: submission.title,
                    console: submission.console,
                    year: submission.year,
                    description: submission.description,
                    file_url: submission.file_url,
                    submitted_by: submission.user_id,
                    approved_at: new Date().toISOString()
                });
            }
        }
        
        closeReviewModal();
        showNotification(`Game ${action} successfully!`, 'success');
        loadPendingSubmissions();
        
    } catch (error) {
        console.error('Error submitting review:', error);
        showNotification('Error: ' + error.message, 'error');
    }
};

// ============================================
// GAME LIBRARY MANAGEMENT FUNCTIONS
// ============================================

async function loadAdminGames() {
    const loadingEl = document.getElementById('gamesLoading');
    const gamesListEl = document.getElementById('gamesList');
    
    if (!loadingEl || !gamesListEl) return;
    
    try {
        console.log('Loading games library for admin...');
        
        const { data, error } = await supabase
            .from('games')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }
        
        console.log(`Loaded ${data?.length || 0} games`);
        allGames = data || [];
        
        // Hide loading
        loadingEl.classList.add('hidden');
        
        // Render games
        renderGamesTable(allGames);
        
    } catch (error) {
        console.error('Error loading admin games:', error);
        gamesListEl.innerHTML = `
            <tr>
                <td colspan="5" class="py-8 text-center">
                    <div class="text-red-400">Error loading games: ${error.message}</div>
                    <button onclick="loadAdminGames()" class="mt-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">
                        Retry
                    </button>
                </td>
            </tr>
        `;
    }
}

function renderGamesTable(games) {
    const gamesListEl = document.getElementById('gamesList');
    if (!gamesListEl) return;
    
    if (!games || games.length === 0) {
        gamesListEl.innerHTML = `
            <tr>
                <td colspan="5" class="py-8 text-center text-gray-400">
                    No games found in the library.
                </td>
            </tr>
        `;
        return;
    }
    
    gamesListEl.innerHTML = games.map(game => `
        <tr class="hover:bg-gray-800">
            <td class="py-3 px-4">
                <div class="flex items-center gap-3">
                    <img src="${game.cover_image_url || 'https://via.placeholder.com/40x40/374151/6B7280?text=?'}" 
                         alt="${game.title}" 
                         class="w-10 h-10 rounded object-cover">
                    <div>
                        <div class="text-white font-medium">${game.title}</div>
                        <div class="text-gray-400 text-sm">${game.description ? game.description.substring(0, 50) + '...' : 'No description'}</div>
                    </div>
                </div>
            </td>
            <td class="py-3 px-4 text-gray-300">${game.console || 'N/A'}</td>
            <td class="py-3 px-4 text-gray-300">${game.year || 'N/A'}</td>
            <td class="py-3 px-4">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    game.approved_at ? 'bg-green-900 text-green-200' : 'bg-yellow-900 text-yellow-200'
                }">
                    ${game.approved_at ? 'Approved' : 'Pending'}
                </span>
            </td>
            <td class="py-3 px-4">
                <div class="flex flex-wrap gap-2">
                    <button onclick="adminEditGame('${game.id}')" 
                            class="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white text-sm rounded-lg transition">
                        Edit
                    </button>
                    <button onclick="adminDeleteGame('${game.id}', '${escapeString(game.title)}')" 
                            class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition">
                        Delete
                    </button>
                    ${!game.approved_at ? `
                        <button onclick="adminApproveGame('${game.id}')" 
                                class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition">
                            Approve
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

// Filter games based on search input
window.filterGames = function() {
    const searchInput = document.getElementById('gameSearch');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase();
    
    if (!searchTerm) {
        renderGamesTable(allGames);
        return;
    }
    
    const filteredGames = allGames.filter(game => 
        game.title.toLowerCase().includes(searchTerm) ||
        (game.description && game.description.toLowerCase().includes(searchTerm)) ||
        (game.console && game.console.toLowerCase().includes(searchTerm))
    );
    
    renderGamesTable(filteredGames);
}

// Open modal to add new game
window.openAddGameModal = function() {
    const modal = document.getElementById('gameModal');
    if (!modal) {
        console.error('Game modal not found!');
        return;
    }
    
    document.getElementById('modalTitle').textContent = 'Add New Game';
    document.getElementById('submitBtn').textContent = 'Add Game';
    document.getElementById('gameForm').reset();
    document.getElementById('gameId').value = '';
    document.getElementById('imagePreviewContainer').classList.add('hidden');
    modal.classList.remove('hidden');
    
    // Set default player values
    const playersMin = document.getElementById('gamePlayersMin');
    const playersMax = document.getElementById('gamePlayersMax');
    if (playersMin) playersMin.value = '1';
    if (playersMax) playersMax.value = '1';
}

// Close game modal
window.closeGameModal = function() {
    const modal = document.getElementById('gameModal');
    if (modal) modal.classList.add('hidden');
}

// Edit existing game
window.adminEditGame = async function(gameId) {
    try {
        const { data: game, error } = await supabase
            .from('games')
            .select('*')
            .eq('id', gameId)
            .single();
        
        if (error) throw error;
        
        const modal = document.getElementById('gameModal');
        if (!modal) {
            console.error('Game modal not found!');
            return;
        }
        
        document.getElementById('modalTitle').textContent = 'Edit Game';
        document.getElementById('submitBtn').textContent = 'Update Game';
        document.getElementById('gameId').value = game.id;
        document.getElementById('gameTitle').value = game.title || '';
        document.getElementById('gameConsole').value = game.console || '';
        document.getElementById('gameYear').value = game.year || '';
        document.getElementById('gameMultiplayerType').value = game.multiplayer_type || '';
        document.getElementById('gameDescription').value = game.description || '';
        document.getElementById('gameCoverImage').value = game.cover_image_url || '';
        document.getElementById('gameFileUrl').value = game.file_url || '';
        document.getElementById('gameConnectionMethod').value = game.connection_method || '';
        document.getElementById('gameConnectionDetails').value = game.connection_details || '';
        document.getElementById('gamePlayersMin').value = game.players_min || 1;
        document.getElementById('gamePlayersMax').value = game.players_max || 1;
        document.getElementById('gameServersAvailable').checked = game.servers_available || false;
        
        // Show image preview if URL exists
        if (game.cover_image_url) {
            const previewImg = document.getElementById('imagePreview');
            const previewContainer = document.getElementById('imagePreviewContainer');
            if (previewImg && previewContainer) {
                previewImg.src = game.cover_image_url;
                previewContainer.classList.remove('hidden');
            }
        }
        
        modal.classList.remove('hidden');
        
    } catch (error) {
        console.error('Error loading game for edit:', error);
        showNotification('Error loading game: ' + error.message, 'error');
    }
}

// Delete game functions
window.adminDeleteGame = function(gameId, gameTitle) {
    currentDeleteGameId = gameId;
    const messageEl = document.getElementById('deleteGameMessage');
    const modal = document.getElementById('deleteGameModal');
    
    if (messageEl && modal) {
        messageEl.textContent = `Are you sure you want to delete "${gameTitle}"? This action cannot be undone.`;
        modal.classList.remove('hidden');
    }
}

window.closeDeleteGameModal = function() {
    const modal = document.getElementById('deleteGameModal');
    if (modal) modal.classList.add('hidden');
    currentDeleteGameId = null;
}

window.confirmDeleteGame = async function() {
    if (!currentDeleteGameId) return;
    
    try {
        console.log(`Deleting game ${currentDeleteGameId}...`);
        
        const { error } = await supabase
            .from('games')
            .delete()
            .eq('id', currentDeleteGameId);
        
        if (error) throw error;
        
        showNotification('Game deleted successfully!', 'success');
        
        // Close modal and refresh list
        closeDeleteGameModal();
        await loadAdminGames();
        
        // Also refresh the main games library if it's open
        if (window.loadGames && typeof window.loadGames === 'function') {
            setTimeout(() => window.loadGames(), 1000);
        }
        
    } catch (error) {
        console.error('Error deleting game:', error);
        showNotification('Error deleting game: ' + error.message, 'error');
    }
}

// Approve pending game
window.adminApproveGame = async function(gameId) {
    if (!confirm('Approve this game and make it public?')) return;
    
    try {
        const { error } = await supabase
            .from('games')
            .update({
                approved_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', gameId);
        
        if (error) throw error;
        
        showNotification('Game approved successfully!', 'success');
        await loadAdminGames();
        
        // Also refresh the main games library if it's open
        if (window.loadGames && typeof window.loadGames === 'function') {
            setTimeout(() => window.loadGames(), 1000);
        }
        
    } catch (error) {
        console.error('Error approving game:', error);
        showNotification('Error approving game: ' + error.message, 'error');
    }
}

function setupGameFormListeners() {
    const gameForm = document.getElementById('gameForm');
    const gameCoverImage = document.getElementById('gameCoverImage');
    
    if (gameForm) {
        gameForm.addEventListener('submit', handleGameFormSubmit);
    }
    
    if (gameCoverImage) {
        gameCoverImage.addEventListener('input', function() {
            const url = this.value.trim();
            const previewContainer = document.getElementById('imagePreviewContainer');
            const previewImg = document.getElementById('imagePreview');
            
            if (url && previewImg && previewContainer) {
                previewImg.src = url;
                previewContainer.classList.remove('hidden');
            } else if (previewContainer) {
                previewContainer.classList.add('hidden');
            }
        });
    }
}

async function handleGameFormSubmit(event) {
    event.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    if (!submitBtn) return;
    
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Saving...';
    submitBtn.disabled = true;
    
    try {
        const user = await getCurrentUser();
        const gameId = document.getElementById('gameId')?.value;
        
        const gameData = {
            title: document.getElementById('gameTitle').value.trim(),
            console: document.getElementById('gameConsole').value,
            year: document.getElementById('gameYear').value || null,
            description: document.getElementById('gameDescription').value.trim(),
            cover_image_url: document.getElementById('gameCoverImage').value.trim() || null,
            file_url: document.getElementById('gameFileUrl').value.trim() || null,
            multiplayer_type: document.getElementById('gameMultiplayerType').value || null,
            connection_method: document.getElementById('gameConnectionMethod').value.trim() || null,
            connection_details: document.getElementById('gameConnectionDetails').value.trim() || null,
            players_min: parseInt(document.getElementById('gamePlayersMin').value) || 1,
            players_max: parseInt(document.getElementById('gamePlayersMax').value) || 1,
            servers_available: document.getElementById('gameServersAvailable').checked,
            updated_at: new Date().toISOString()
        };
        
        console.log('Saving game:', gameData);
        
        let result;
        if (gameId) {
            // Update existing game
            result = await supabase
                .from('games')
                .update(gameData)
                .eq('id', gameId);
        } else {
            // Insert new game
            gameData.created_at = new Date().toISOString();
            gameData.submitted_by = user.id;
            gameData.submitted_email = user.email;
            gameData.approved_at = new Date().toISOString();
            
            result = await supabase
                .from('games')
                .insert([gameData]);
        }
        
        const { error } = result;
        if (error) throw error;
        
        showNotification(gameId ? 'Game updated successfully!' : 'Game added successfully!', 'success');
        
        // Close modal and refresh list
        closeGameModal();
        await loadAdminGames();
        
        // Also refresh the main games library if it's open
        if (window.loadGames && typeof window.loadGames === 'function') {
            setTimeout(() => window.loadGames(), 1000);
        }
        
    } catch (error) {
        console.error('Error saving game:', error);
        showNotification('Error saving game: ' + error.message, 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Helper functions
function escapeString(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function showNotification(message, type = 'info') {
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

// Make loadAdminGames globally accessible
window.loadAdminGames = loadAdminGames;
