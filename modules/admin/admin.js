import { supabase, getCurrentUser } from '../../lib/supabase.js';

export function initModule() {
    console.log('Admin module initialized');
    checkAdminAccess();
    loadPendingSubmissions();
    loadAdminUsers();
    
    // Setup admin management
    setupAdminManagement();
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
    
    // In the renderSubmissions function, add connection info:
function renderSubmissions(submissions) {
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

// Update the approveSubmission function to copy connection details
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
        await supabase.from('games').insert({
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
        });
        
        showNotification('Game approved and added to library with connection details!', 'success');
        loadPendingSubmissions();
        
    } catch (error) {
        console.error('Error approving submission:', error);
        showNotification('Error approving submission: ' + error.message, 'error');
    }
};
    
    function escapeString(str) {
        return str ? str.replace(/'/g, "\\'").replace(/"/g, '\\"') : '';
    }
}

// Add this global function for creating test data
window.createTestData = async function() {
    try {
        // Run the SQL to create tables and insert test data
        const response = await fetch('/api/create-test-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to create test data');
        }
        
        alert('Test data created successfully!');
        loadPendingSubmissions();
        
    } catch (error) {
        console.error('Error creating test data:', error);
        alert('Error: ' + error.message + '\n\nPlease run the SQL manually in Supabase.');
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

// Global functions for buttons
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
        
        // Prepare game data for insertion
        const gameData = {
            title: submission.title,
            console: submission.console,
            year: submission.year,
            description: submission.description,
            file_url: submission.file_url,
            submitted_by: submission.user_id,
            submitted_email: submission.user_email,  // Make sure we're using the right field name
            approved_at: new Date().toISOString(),
            
            // Connection details
            connection_method: submission.connection_method,
            connection_details: submission.connection_details,
            multiplayer_type: submission.multiplayer_type,
            players_min: submission.players_min || 1,
            players_max: submission.players_max || 1,
            servers_available: submission.servers_available || false,
            server_details: submission.server_details
        };
        
        console.log('Inserting game with data:', gameData);
        
        // Add to games table
        const { data: newGame, error: insertError } = await supabase
            .from('games')
            .insert(gameData)
            .select()
            .single();
        
        if (insertError) {
            console.error('Insert error details:', insertError);
            throw insertError;
        }
        
        showNotification(`✅ "${submission.title}" approved and added to library!`, 'success');
        loadPendingSubmissions();
        
    } catch (error) {
        console.error('Error approving submission:', error);
        
        let errorMessage = error.message;
        if (error.code === '23505') {
            errorMessage = 'This game might already exist in the library.';
        } else if (error.message.includes('user_email')) {
            errorMessage = 'Database column conflict. Please check the table structure.';
        }
        
        showNotification(`Error: ${errorMessage}`, 'error');
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
// Load admin games
  await loadAdminGames();
  
  // Set up event listeners
  document.getElementById('gameForm').addEventListener('submit', handleGameSubmit);
  document.getElementById('gameCoverImage').addEventListener('input', updateImagePreview);
  
  console.log('Admin module initialized');
}

async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function checkAdminStatus() {
  try {
    // Check if user email is in admin list
    const adminEmails = [
      'retrogamemasterra@gmail.com',
      // Add more admin emails as needed
    ];
    
    return adminEmails.includes(currentUser.email);
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

async function loadAdminGames() {
  const loadingEl = document.getElementById('adminLoading');
  const gamesListEl = document.getElementById('adminGamesList');
  
  try {
    console.log('Loading games for admin...');
    
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    console.log(`Loaded ${data?.length || 0} games`);
    games = data || [];
    
    // Hide loading
    loadingEl.classList.add('hidden');
    
    // Render games
    if (games.length === 0) {
      gamesListEl.innerHTML = `
        <tr>
          <td colspan="6" class="py-8 text-center text-gray-400">
            No games found. Add your first game!
          </td>
        </tr>
      `;
    } else {
      gamesListEl.innerHTML = games.map(game => `
        <tr class="hover:bg-gray-800">
          <td class="py-3 px-4 text-gray-400 font-mono text-sm">${game.id}</td>
          <td class="py-3 px-4">
            <div class="flex items-center gap-3">
              <img src="${game.cover_image || 'https://via.placeholder.com/40x40/374151/6B7280?text=?'}" 
                   alt="${game.title}" 
                   class="w-10 h-10 rounded object-cover">
              <span class="text-white font-medium">${game.title}</span>
            </div>
          </td>
          <td class="py-3 px-4 text-gray-300">${game.system}</td>
          <td class="py-3 px-4 text-gray-300">${game.release_year || 'N/A'}</td>
          <td class="py-3 px-4">
            <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              game.status === 'active' ? 'bg-green-900 text-green-200' :
              game.status === 'pending' ? 'bg-yellow-900 text-yellow-200' :
              'bg-gray-700 text-gray-300'
            }">
              ${game.status || 'active'}
            </span>
          </td>
          <td class="py-3 px-4">
            <div class="flex gap-2">
              <button onclick="editGame(${game.id})" 
                      class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition">
                Edit
              </button>
              <button onclick="deleteGame(${game.id}, '${game.title.replace(/'/g, "\\'")}')" 
                      class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition">
                Delete
              </button>
            </div>
          </td>
        </tr>
      `).join('');
    }
    
  } catch (error) {
    console.error('Error loading admin games:', error);
    loadingEl.innerHTML = `
      <tr>
        <td colspan="6" class="py-8 text-center">
          <div class="text-red-400">Error loading games: ${error.message}</div>
          <button onclick="loadAdminGames()" class="mt-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">
            Retry
          </button>
        </td>
      </tr>
    `;
  }
}

// Modal functions (attach to window for onclick handlers)
window.openAddGameModal = function() {
  document.getElementById('modalTitle').textContent = 'Add New Game';
  document.getElementById('submitBtn').textContent = 'Add Game';
  document.getElementById('gameForm').reset();
  document.getElementById('gameId').value = '';
  document.getElementById('imagePreviewContainer').classList.add('hidden');
  document.getElementById('gameModal').classList.remove('hidden');
}

window.closeGameModal = function() {
  document.getElementById('gameModal').classList.add('hidden');
}

window.openDeleteModal = function(gameId, gameTitle) {
  window.currentDeleteId = gameId;
  document.getElementById('deleteMessage').textContent = `Are you sure you want to delete "${gameTitle}"? This action cannot be undone.`;
  document.getElementById('deleteModal').classList.remove('hidden');
}

window.closeDeleteModal = function() {
  document.getElementById('deleteModal').classList.add('hidden');
  window.currentDeleteId = null;
}

window.editGame = function(gameId) {
  const game = games.find(g => g.id === gameId);
  if (!game) return;
  
  document.getElementById('modalTitle').textContent = 'Edit Game';
  document.getElementById('submitBtn').textContent = 'Update Game';
  document.getElementById('gameId').value = game.id;
  document.getElementById('gameTitle').value = game.title;
  document.getElementById('gameSystem').value = game.system;
  document.getElementById('gameYear').value = game.release_year || '';
  document.getElementById('gameStatus').value = game.status || 'active';
  document.getElementById('gameDescription').value = game.description || '';
  document.getElementById('gameCoverImage').value = game.cover_image || '';
  
  // Show image preview if URL exists
  if (game.cover_image) {
    document.getElementById('imagePreview').src = game.cover_image;
    document.getElementById('imagePreviewContainer').classList.remove('hidden');
  }
  
  document.getElementById('gameModal').classList.remove('hidden');
}

window.deleteGame = function(gameId, gameTitle) {
  window.openDeleteModal(gameId, gameTitle);
}

window.confirmDelete = async function() {
  const gameId = window.currentDeleteId;
  if (!gameId) return;
  
  try {
    console.log(`Deleting game ${gameId}...`);
    
    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', gameId);
    
    if (error) throw error;
    
    console.log('Game deleted successfully');
    showSuccess('Game deleted successfully!');
    
    // Close modal and refresh list
    closeDeleteModal();
    await loadAdminGames();
    
    // Also refresh the main games library if it's open
    if (window.loadGames && typeof window.loadGames === 'function') {
      setTimeout(() => window.loadGames(), 1000);
    }
    
  } catch (error) {
    console.error('Error deleting game:', error);
    showError(`Error deleting game: ${error.message}`);
  }
}

async function handleGameSubmit(event) {
  event.preventDefault();
  
  const submitBtn = document.getElementById('submitBtn');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Saving...';
  submitBtn.disabled = true;
  
  try {
    const gameId = document.getElementById('gameId').value;
    const gameData = {
      title: document.getElementById('gameTitle').value.trim(),
      system: document.getElementById('gameSystem').value,
      release_year: document.getElementById('gameYear').value || null,
      status: document.getElementById('gameStatus').value,
      description: document.getElementById('gameDescription').value.trim(),
      cover_image: document.getElementById('gameCoverImage').value.trim() || null,
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
      gameData.submitted_by = currentUser.email;
      gameData.approved = true; // Auto-approve admin submissions
      
      result = await supabase
        .from('games')
        .insert([gameData]);
    }
    
    const { error } = result;
    if (error) throw error;
    
    console.log('Game saved successfully');
    showSuccess(gameId ? 'Game updated successfully!' : 'Game added successfully!');
    
    // Close modal and refresh list
    closeGameModal();
    await loadAdminGames();
    
    // Also refresh the main games library if it's open
    if (window.loadGames && typeof window.loadGames === 'function') {
      setTimeout(() => window.loadGames(), 1000);
    }
    
  } catch (error) {
    console.error('Error saving game:', error);
    showError(`Error saving game: ${error.message}`);
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}

function updateImagePreview() {
  const url = document.getElementById('gameCoverImage').value.trim();
  const previewContainer = document.getElementById('imagePreviewContainer');
  const previewImg = document.getElementById('imagePreview');
  
  if (url) {
    previewImg.src = url;
    previewContainer.classList.remove('hidden');
  } else {
    previewContainer.classList.add('hidden');
  }
}

function redirectToLogin() {
  showError('Please log in to access admin panel');
  setTimeout(() => window.location.hash = '#/auth', 2000);
}

function showError(message) {
  alert(`Error: ${message}`);
}

function showSuccess(message) {
  alert(`Success: ${message}`);
}

// Export functions for global use
window.loadAdminGames = loadAdminGames;
