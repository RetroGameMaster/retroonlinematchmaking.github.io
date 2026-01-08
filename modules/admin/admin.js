// modules/admin/admin.js - SIMPLIFIED WORKING VERSION
import { supabase, getCurrentUser, isAdmin } from '../../lib/supabase.js';

let allGames = [];
let currentDeleteGameId = null;

export function initModule() {
    console.log('Admin module initialized');
    loadAdminPanel();
}

async function loadAdminPanel() {
    const user = await getCurrentUser();
    
    if (!user) {
        alert('Please login to access admin panel');
        window.location.hash = '#/auth';
        return;
    }
    
    // Check admin status directly
    const adminStatus = await isAdmin();
    console.log('Admin status:', adminStatus);
    
    if (!adminStatus) {
        alert('Admin access required');
        window.location.hash = '#/';
        return;
    }
    
    // Load admin interface
    document.getElementById('app-content').innerHTML = `
        <div class="max-w-7xl mx-auto p-4">
            <h1 class="text-3xl font-bold text-white mb-6">👑 Admin Panel</h1>
            
            <!-- Quick Actions -->
            <div class="mb-6">
                <button id="refresh-btn" class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded mr-3">
                    🔄 Refresh
                </button>
                <button id="test-submission-btn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                    🧪 Create Test Submission
                </button>
            </div>
            
            <!-- Stats -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="bg-gray-800 p-6 rounded-lg border border-cyan-500">
                    <h3 class="text-xl font-bold text-cyan-300 mb-2">Pending Submissions</h3>
                    <p class="text-4xl font-bold text-white" id="pending-count">0</p>
                </div>
                <div class="bg-gray-800 p-6 rounded-lg border border-purple-500">
                    <h3 class="text-xl font-bold text-purple-300 mb-2">Total Games</h3>
                    <p class="text-4xl font-bold text-white" id="total-games">0</p>
                </div>
                <div class="bg-gray-800 p-6 rounded-lg border border-green-500">
                    <h3 class="text-xl font-bold text-green-300 mb-2">Admin Status</h3>
                    <p class="text-2xl font-bold text-white">✅ Active</p>
                </div>
            </div>
            
            <!-- Main Content -->
            <div id="admin-content" class="bg-gray-800 rounded-lg p-6 border border-gray-700 min-h-[400px]">
                <div class="text-center py-8">
                    <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
                    <p class="text-gray-400 mt-2">Loading admin data...</p>
                </div>
            </div>
        </div>
    `;
    
    // Setup event listeners
    document.getElementById('refresh-btn').addEventListener('click', loadPendingSubmissions);
    document.getElementById('test-submission-btn').addEventListener('click', createTestSubmission);
    
    // Load initial data
    await loadPendingSubmissions();
    await loadAdminGames();
}

async function loadPendingSubmissions() {
    try {
        console.log('Loading pending submissions...');
        
        // Clear and show loading
        const content = document.getElementById('admin-content');
        content.innerHTML = `
            <div class="text-center py-8">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
                <p class="text-gray-400 mt-2">Loading submissions...</p>
            </div>
        `;
        
        // Query game_submissions table - SIMPLE DIRECT QUERY
        const { data: submissions, error } = await supabase
            .from('game_submissions')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        
        console.log('Submission query result:', { submissions, error });
        
        if (error) {
            console.error('Error loading submissions:', error);
            content.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-4xl mb-4">❌</div>
                    <h3 class="text-xl font-bold text-white mb-2">Error Loading Submissions</h3>
                    <p class="text-red-400 mb-4">${error.message}</p>
                    <button onclick="loadPendingSubmissions()" class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded">
                        Try Again
                    </button>
                </div>
            `;
            return;
        }
        
        // Update count
        document.getElementById('pending-count').textContent = submissions?.length || 0;
        
        // Update total games count
        const { count: totalGames } = await supabase
            .from('games')
            .select('*', { count: 'exact', head: true });
        document.getElementById('total-games').textContent = totalGames || 0;
        
        if (!submissions || submissions.length === 0) {
            content.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-6xl mb-4">✅</div>
                    <h3 class="text-xl font-bold text-white mb-2">No Pending Submissions</h3>
                    <p class="text-gray-400">All caught up! No games need review.</p>
                    <div class="mt-6">
                        <button onclick="createTestSubmission()" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                            🧪 Create Test Submission
                        </button>
                    </div>
                </div>
            `;
            return;
        }
        
        // Display submissions
        let html = `<div class="space-y-6">`;
        
        submissions.forEach(submission => {
            html += `
                <div class="bg-gray-900 rounded-lg p-6 border border-gray-700">
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex-1">
                            <h3 class="text-xl font-bold text-white mb-2">${submission.title}</h3>
                            <div class="flex flex-wrap gap-2 mb-2">
                                <span class="bg-gray-700 text-white px-3 py-1 rounded text-sm">${submission.console}</span>
                                <span class="bg-gray-700 text-white px-3 py-1 rounded text-sm">${submission.year || 'N/A'}</span>
                                <span class="bg-gray-700 text-white px-3 py-1 rounded text-sm">${submission.multiplayer_type}</span>
                            </div>
                            <p class="text-gray-300 mb-4">${submission.description || 'No description provided.'}</p>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <p class="text-sm text-gray-400">Submitted by:</p>
                                    <p class="text-white">${submission.user_email}</p>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-400">Submitted on:</p>
                                    <p class="text-white">${new Date(submission.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>
                        <span class="bg-yellow-600 text-white px-3 py-1 rounded text-sm font-semibold">
                            ⏳ Pending
                        </span>
                    </div>
                    
                    <div class="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                        <button onclick="approveSubmission('${submission.id}')" 
                                class="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded font-semibold transition flex items-center justify-center">
                            <span class="mr-2">✅</span>
                            Approve
                        </button>
                        <button onclick="rejectSubmission('${submission.id}')" 
                                class="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded font-semibold transition flex items-center justify-center">
                            <span class="mr-2">❌</span>
                            Reject
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        content.innerHTML = html;
        
    } catch (error) {
        console.error('Error in loadPendingSubmissions:', error);
        document.getElementById('admin-content').innerHTML = `
            <div class="text-center py-8">
                <div class="text-4xl mb-4">⚠️</div>
                <h3 class="text-xl font-bold text-white mb-2">Error</h3>
                <p class="text-red-400">${error.message}</p>
            </div>
        `;
    }
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
        
        // Insert into games table
        const gameData = {
            title: submission.title,
            console: submission.console,
            year: submission.year,
            description: submission.description,
            file_url: submission.file_url,
            submitted_by: submission.user_id,
            submitted_email: submission.user_email,
            approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            
            // Copy connection details
            connection_method: submission.connection_method,
            connection_details: submission.connection_details,
            multiplayer_type: submission.multiplayer_type,
            players_min: submission.players_min,
            players_max: submission.players_max,
            servers_available: submission.servers_available,
            server_details: submission.server_details
        };
        
        console.log('Inserting game:', gameData);
        
        // Add to games table
        const { error: insertError } = await supabase
            .from('games')
            .insert([gameData]);
        
        if (insertError) throw insertError;
        
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
        
        showNotification('✅ Game approved and added to library!');
        
        // Reload data
        await loadPendingSubmissions();
        await loadAdminGames();
        
    } catch (error) {
        console.error('Error approving submission:', error);
        showNotification('❌ Error: ' + error.message, 'error');
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
                review_notes: reason || 'Rejected by admin'
            })
            .eq('id', submissionId);
        
        if (error) throw error;
        
        showNotification('✅ Game submission rejected');
        await loadPendingSubmissions();
        
    } catch (error) {
        console.error('Error rejecting submission:', error);
        showNotification('❌ Error: ' + error.message, 'error');
    }
};

// Create a test submission
async function createTestSubmission() {
    try {
        const user = await getCurrentUser();
        
        const testSubmission = {
            title: 'Test Game - ' + new Date().toLocaleTimeString(),
            console: 'PS2',
            year: 2005,
            description: 'Test game submission to verify admin panel is working.',
            user_id: user.id,
            user_email: user.email,
            connection_method: 'LAN',
            multiplayer_type: 'LAN',
            players_min: 2,
            players_max: 4,
            status: 'pending',
            created_at: new Date().toISOString()
        };
        
        const { data, error } = await supabase
            .from('game_submissions')
            .insert([testSubmission])
            .select();
        
        if (error) throw error;
        
        showNotification('🧪 Test submission created!');
        await loadPendingSubmissions();
        
    } catch (error) {
        console.error('Error creating test submission:', error);
        showNotification('❌ Error: ' + error.message, 'error');
    }
}

// Game management functions
async function loadAdminGames() {
    try {
        const { data: games, error } = await supabase
            .from('games')
            .select('*')
            .order('updated_at', { ascending: false });
        
        if (error) throw error;
        
        allGames = games || [];
        
        // If we have a games list element, update it
        const gamesListEl = document.getElementById('gamesList');
        if (gamesListEl) {
            renderGamesTable(allGames);
        }
        
    } catch (error) {
        console.error('Error loading admin games:', error);
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
                    <div>
                        <div class="text-white font-medium">${game.title}</div>
                        <div class="text-gray-400 text-sm">${game.console} • ${game.year || 'N/A'}</div>
                    </div>
                </div>
            </td>
            <td class="py-3 px-4 text-gray-300">${game.submitted_email || 'N/A'}</td>
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
                </div>
            </td>
        </tr>
    `).join('');
}

// Helper functions
function escapeString(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

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

// Make functions globally accessible
window.loadPendingSubmissions = loadPendingSubmissions;
window.createTestSubmission = createTestSubmission;

// Delete game function (simplified)
window.adminDeleteGame = async function(gameId, gameTitle) {
    if (!confirm(`Are you sure you want to delete "${gameTitle}"? This action cannot be undone.`)) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('games')
            .delete()
            .eq('id', gameId);
        
        if (error) throw error;
        
        showNotification('✅ Game deleted successfully!');
        await loadAdminGames();
        
    } catch (error) {
        console.error('Error deleting game:', error);
        showNotification('❌ Error: ' + error.message, 'error');
    }
};

// Edit game function (simplified)
window.adminEditGame = async function(gameId) {
    try {
        const { data: game, error } = await supabase
            .from('games')
            .select('*')
            .eq('id', gameId)
            .single();
        
        if (error) throw error;
        
        // Simple edit modal
        const newTitle = prompt('Enter new game title:', game.title);
        if (!newTitle) return;
        
        const { error: updateError } = await supabase
            .from('games')
            .update({ 
                title: newTitle,
                updated_at: new Date().toISOString()
            })
            .eq('id', gameId);
        
        if (updateError) throw updateError;
        
        showNotification('✅ Game updated successfully!');
        await loadAdminGames();
        
    } catch (error) {
        console.error('Error editing game:', error);
        showNotification('❌ Error: ' + error.message, 'error');
    }
};
