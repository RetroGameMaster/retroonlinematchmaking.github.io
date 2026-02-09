// modules/admin/admin.js - COMPLETE FIXED VERSION (FULL LENGTH)
import { supabase, getCurrentUser, isAdmin, getGameById, canEditGame } from '../../lib/supabase.js';

let allGames = [];
let currentDeleteGameId = null;
let currentUser = null;

export function initModule() {
    console.log('Admin module initialized');
    loadAdminPanel();
}

// NEW FUNCTION: Handle game edit from direct link
export async function editGame(rom, gameId) {
    console.log('Edit game called for:', gameId);
    currentUser = await getCurrentUser();
    
    if (!currentUser) {
        alert('Please login to edit games');
        rom.loadModule('auth');
        return;
    }
    
    // Check admin status
    const adminStatus = await isAdmin();
    if (!adminStatus) {
        alert('Admin access required');
        rom.loadModule('home');
        return;
    }
    
    // Load and show edit form
    await showGameEditForm(gameId);
}

async function loadAdminPanel() {
    currentUser = await getCurrentUser();

    if (!currentUser) {
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

    // Load admin interface with tabs
    document.getElementById('app-content').innerHTML = `
        <div class="max-w-7xl mx-auto p-4">
            <h1 class="text-3xl font-bold text-white mb-6">👑 Admin Panel</h1>
            
            <!-- Navigation Tabs -->
            <div class="mb-6 border-b border-gray-700">
                <nav class="flex flex-wrap -mb-px">
                    <button id="tab-submissions" class="admin-tab active py-3 px-4 font-medium text-sm border-b-2 border-cyan-500 text-cyan-500">
                        📥 Submissions (0)
                    </button>
                    <button id="tab-games" class="admin-tab py-3 px-4 font-medium text-sm border-b-2 border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300">
                        🎮 Games (0)
                    </button>
                    <button id="tab-admins" class="admin-tab py-3 px-4 font-medium text-sm border-b-2 border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300">
                        👑 Admins
                    </button>
                    <button id="tab-users" class="admin-tab py-3 px-4 font-medium text-sm border-b-2 border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300">
                        👥 Users
                    </button>
                </nav>
            </div>
            
            <!-- Quick Actions -->
            <div class="mb-6" id="admin-actions">
                <button id="refresh-btn" class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded mr-3">
                    🔄 Refresh
                </button>
                <button id="test-submission-btn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                    🧪 Create Test Submission
                </button>
            </div>
            
            <!-- Stats -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div class="bg-gray-800 p-6 rounded-lg border border-cyan-500">
                    <h3 class="text-xl font-bold text-cyan-300 mb-2">Pending</h3>
                    <p class="text-4xl font-bold text-white" id="pending-count">0</p>
                </div>
                <div class="bg-gray-800 p-6 rounded-lg border border-purple-500">
                    <h3 class="text-xl font-bold text-purple-300 mb-2">Total Games</h3>
                    <p class="text-4xl font-bold text-white" id="total-games">0</p>
                </div>
                <div class="bg-gray-800 p-6 rounded-lg border border-yellow-500">
                    <h3 class="text-xl font-bold text-yellow-300 mb-2">Total Users</h3>
                    <p class="text-4xl font-bold text-white" id="total-users">0</p>
                </div>
                <div class="bg-gray-800 p-6 rounded-lg border border-green-500">
                    <h3 class="text-xl font-bold text-green-300 mb-2">Admins</h3>
                    <p class="text-4xl font-bold text-white" id="admin-count">0</p>
                </div>
            </div>
            
            <!-- Main Content Area -->
            <div id="admin-content" class="bg-gray-800 rounded-lg p-6 border border-gray-700 min-h-[400px]">
                <div class="text-center py-8">
                    <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
                    <p class="text-gray-400 mt-2">Loading admin data...</p>
                </div>
            </div>
        </div>
    `;

    // Setup tab listeners
    setupTabListeners();
    
    // Setup event listeners
    document.getElementById('refresh-btn').addEventListener('click', () => {
        const activeTab = document.querySelector('.admin-tab.active').id;
        switch(activeTab) {
            case 'tab-submissions':
                loadPendingSubmissions();
                break;
            case 'tab-games':
                loadAdminGames();
                break;
            case 'tab-admins':
                loadAdminList();
                break;
            case 'tab-users':
                loadAllUsers();
                break;
        }
    });
    
    document.getElementById('test-submission-btn').addEventListener('click', createTestSubmission);

    // Load initial data
    await loadInitialStats();
    await loadPendingSubmissions();
}

function setupTabListeners() {
    const tabs = document.querySelectorAll('.admin-tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab
            tabs.forEach(t => {
                t.classList.remove('active', 'border-cyan-500', 'text-cyan-500');
                t.classList.add('border-transparent', 'text-gray-400');
            });
            
            tab.classList.add('active', 'border-cyan-500', 'text-cyan-500');
            tab.classList.remove('border-transparent', 'text-gray-400');
            
            // Load content based on tab
            switch(tab.id) {
                case 'tab-submissions':
                    loadPendingSubmissions();
                    break;
                case 'tab-games':
                    loadAdminGames();
                    break;
                case 'tab-admins':
                    loadAdminList();
                    break;
                case 'tab-users':
                    loadAllUsers();
                    break;
            }
        });
    });
}

async function loadInitialStats() {
    try {
        // Get pending submissions count
        const { count: pendingCount } = await supabase
            .from('game_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');
        
        document.getElementById('pending-count').textContent = pendingCount || 0;
        
        // Get total games count
        const { count: totalGames } = await supabase
            .from('games')
            .select('*', { count: 'exact', head: true });
        document.getElementById('total-games').textContent = totalGames || 0;
        
        // Get total users count
        const { count: totalUsers } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });
        document.getElementById('total-users').textContent = totalUsers || 0;
        
        // Try to get admin count - handle missing column gracefully
        try {
            const { count: adminCount } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('is_admin', true);
            document.getElementById('admin-count').textContent = adminCount || 0;
        } catch (adminError) {
            console.log('Admin column not available yet:', adminError.message);
            document.getElementById('admin-count').textContent = '1'; // Assuming you're the only admin
        }
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadPendingSubmissions() {
    try {
        console.log('Loading pending submissions...');

        const content = document.getElementById('admin-content');
        content.innerHTML = `
            <div class="text-center py-8">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
                <p class="text-gray-400 mt-2">Loading submissions...</p>
            </div>
        `;

        const { data: submissions, error } = await supabase
            .from('game_submissions')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Update count
        document.getElementById('pending-count').textContent = submissions?.length || 0;
        document.querySelector('#tab-submissions').textContent = `📥 Submissions (${submissions?.length || 0})`;

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
                            
                            <!-- Show images if available -->
                            ${submission.cover_image_url ? `
                                <div class="mb-4">
                                    <p class="text-gray-300 mb-2">Cover Image:</p>
                                    <img src="${submission.cover_image_url}" alt="Cover" class="w-32 h-48 object-cover rounded border border-gray-600">
                                </div>
                            ` : ''}
                            
                            ${submission.screenshot_urls && submission.screenshot_urls.length > 0 ? `
                                <div class="mb-4">
                                    <p class="text-gray-300 mb-2">Screenshots (${submission.screenshot_urls.length}):</p>
                                    <div class="grid grid-cols-3 gap-2">
                                        ${submission.screenshot_urls.map(url => `
                                            <img src="${url}" alt="Screenshot" class="w-full h-24 object-cover rounded border border-gray-600">
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                            
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
        const content = document.getElementById('admin-content');
        if (content) {
            content.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-4xl mb-4">⚠️</div>
                    <h3 class="text-xl font-bold text-white mb-2">Error</h3>
                    <p class="text-red-400">${error.message}</p>
                </div>
            `;
        }
    }
}

// ADMIN MANAGEMENT FUNCTIONS
async function loadAdminList() {
    const content = document.getElementById('admin-content');
    
    try {
        content.innerHTML = `
            <div class="text-center py-8">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
                <p class="text-gray-400 mt-2">Loading admin list...</p>
            </div>
        `;

        // Check if current user is the main admin (retrogamemasterra@gmail.com)
        if (currentUser.email !== 'retrogamemasterra@gmail.com') {
            content.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-5xl mb-4">🔒</div>
                    <h3 class="text-xl font-bold text-white mb-2">Restricted Access</h3>
                    <p class="text-gray-400">Only the main administrator (retrogamemasterra@gmail.com) can manage admin users.</p>
                    <div class="mt-6">
                        <button onclick="loadPendingSubmissions()" class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded">
                            Go to Submissions
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        // Try to get all admin users - handle missing column gracefully
        let admins = [];
        try {
            const { data: adminData, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('is_admin', true)
                .order('created_at', { ascending: false });
            
            if (error) {
                // If column doesn't exist, show setup instructions
                if (error.message.includes('column profiles.is_admin does not exist')) {
                    throw new Error('Admin column not set up. Please run the SQL to add is_admin column.');
                }
                throw error;
            }
            
            admins = adminData || [];
            
        } catch (dbError) {
            console.error('Database error:', dbError);
            
            // Show setup instructions instead of error
            content.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-5xl mb-4">🔧</div>
                    <h3 class="text-xl font-bold text-white mb-4">Database Setup Required</h3>
                    <p class="text-gray-300 mb-6">To manage admins, you need to add the <code class="bg-gray-900 px-2 py-1 rounded">is_admin</code> column to your profiles table.</p>
                    
                    <div class="bg-gray-900 p-6 rounded-lg border border-cyan-500 mb-6">
                        <h4 class="text-lg font-bold text-cyan-300 mb-3">SQL to Run in Supabase:</h4>
                        <pre class="bg-black p-4 rounded text-sm text-gray-200 overflow-x-auto">
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Make yourself admin
UPDATE profiles 
SET is_admin = TRUE 
WHERE email = 'retrogamemasterra@gmail.com';</pre>
                        
                        <div class="mt-4 flex justify-center space-x-4">
                            <button onclick="loadAdminList()" class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded">
                                🔄 Retry After Setup
                            </button>
                            <button onclick="loadPendingSubmissions()" class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded">
                                Go to Submissions
                            </button>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        // Get current user's profile to check admin status
        const { data: currentUserProfile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', currentUser.id)
            .single();

        let html = `
            <div>
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-white">Admin Users (${admins.length})</h2>
                    <button id="add-admin-btn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center">
                        <span class="mr-2">➕</span>
                        Add Admin
                    </button>
                </div>
                
                ${admins.length === 0 ? `
                    <div class="text-center py-12 bg-gray-900 rounded-lg border border-gray-700">
                        <div class="text-6xl mb-4">👑</div>
                        <h3 class="text-xl font-bold text-white mb-2">No Admins Found</h3>
                        <p class="text-gray-400">You are currently the only admin.</p>
                    </div>
                ` : `
                    <div class="bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                        <table class="min-w-full divide-y divide-gray-700">
                            <thead class="bg-gray-800">
                                <tr>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                        User
                                    </th>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                        Email
                                    </th>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                        Admin Since
                                    </th>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody id="adminsList" class="bg-gray-900 divide-y divide-gray-800">
                                ${admins.map(admin => `
                                    <tr class="hover:bg-gray-800">
                                        <td class="px-6 py-4 whitespace-nowrap">
                                            <div class="flex items-center">
                                                <div class="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                                                    <span class="text-white font-bold">
                                                        ${(admin.username || admin.email).charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div class="ml-4">
                                                    <div class="text-sm font-medium text-white">
                                                        ${admin.username || 'No username'}
                                                        ${admin.email === 'retrogamemasterra@gmail.com' ? 
                                                            '<span class="ml-2 bg-yellow-600 text-white px-2 py-1 rounded text-xs">Main Admin</span>' : ''}
                                                    </div>
                                                    <div class="text-sm text-gray-300">
                                                        ${admin.favorite_console || 'No console set'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap">
                                            <div class="text-sm text-gray-300">${admin.email}</div>
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                            ${new Date(admin.updated_at || admin.created_at).toLocaleDateString()}
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            ${admin.email === 'retrogamemasterra@gmail.com' ? 
                                                `<span class="text-gray-400">Cannot remove main admin</span>` :
                                                `<button onclick="removeAdminFromList('${admin.id}', '${escapeString(admin.email)}')" 
                                                         class="text-red-400 hover:text-red-300 bg-red-600 hover:bg-red-700 px-3 py-1 rounded">
                                                    Remove Admin
                                                </button>`
                                            }
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
                
                <div class="mt-6 bg-gray-900 p-6 rounded-lg border border-yellow-600">
                    <h3 class="text-lg font-bold text-yellow-400 mb-2">⚠️ Important Notes</h3>
                    <ul class="text-gray-300 space-y-1">
                        <li>• Only the main admin (retrogamemasterra@gmail.com) can manage admin users</li>
                        <li>• Admin users can approve/reject game submissions and manage games</li>
                        <li>• Removing admin access does not delete the user account</li>
                        <li>• Main admin cannot be removed for security reasons</li>
                    </ul>
                </div>
            </div>
        `;

        content.innerHTML = html;

        // Add event listener for add admin button
        document.getElementById('add-admin-btn')?.addEventListener('click', showAddAdminModal);

    } catch (error) {
        console.error('Error loading admin list:', error);
        
        // FIX: Ensure content is defined before using it
        if (content) {
            content.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-4xl mb-4">⚠️</div>
                    <h3 class="text-xl font-bold text-white mb-2">Error</h3>
                    <p class="text-red-400">${error.message}</p>
                </div>
            `;
        }
    }
}

async function showAddAdminModal() {
    try {
        // Get all non-admin users - handle missing column
        let nonAdmins = [];
        try {
            const { data: usersData, error } = await supabase
                .from('profiles')
                .select('id, email, username, is_admin')
                .order('created_at', { ascending: false })
                .limit(50);
            
            if (error) {
                // If column doesn't exist, treat all users as non-admins
                if (error.message.includes('column profiles.is_admin does not exist')) {
                    const { data: allUsers } = await supabase
                        .from('profiles')
                        .select('id, email, username')
                        .order('created_at', { ascending: false })
                        .limit(50);
                    nonAdmins = allUsers || [];
                } else {
                    throw error;
                }
            } else {
                // Filter out admins
                nonAdmins = usersData.filter(user => !user.is_admin);
            }
            
        } catch (dbError) {
            console.error('Error loading users for admin modal:', dbError);
            
            // Fallback: Get all users
            const { data: allUsers } = await supabase
                .from('profiles')
                .select('id, email, username')
                .order('created_at', { ascending: false })
                .limit(50);
            nonAdmins = allUsers || [];
        }

        if (!nonAdmins || nonAdmins.length === 0) {
            showNotification('No non-admin users found', 'info');
            return;
        }

        const modalHtml = `
            <div id="add-admin-modal" class="fixed inset-0 z-50 overflow-y-auto">
                <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                    <!-- Background overlay -->
                    <div class="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity"></div>
                    
                    <!-- Modal panel -->
                    <div class="inline-block align-bottom bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                        <div class="sm:flex sm:items-start">
                            <div class="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                <h3 class="text-lg leading-6 font-bold text-white mb-4">
                                    ➕ Add New Admin
                                </h3>
                                
                                <div class="mb-4">
                                    <label class="block text-sm font-medium text-gray-300 mb-2">
                                        Select User to Promote to Admin
                                    </label>
                                    <select id="admin-user-select" 
                                            class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
                                        <option value="">-- Select a user --</option>
                                        ${nonAdmins.map(user => `
                                            <option value="${user.id}">
                                                ${user.email} (${user.username || 'no username'})
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                
                                <div class="bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded-lg p-3 mb-4">
                                    <p class="text-sm text-yellow-200">
                                        ⚠️ This user will be able to approve/reject game submissions and manage games.
                                    </p>
                                </div>
                                
                                <div class="flex justify-end space-x-3 mt-6">
                                    <button type="button" 
                                            onclick="closeAddAdminModal()"
                                            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">
                                        Cancel
                                    </button>
                                    <button type="button" 
                                            onclick="promoteToAdmin()"
                                            class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold">
                                        Promote to Admin
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to body
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer);

        // Make functions available globally
        window.closeAddAdminModal = function() {
            const modal = document.getElementById('add-admin-modal');
            if (modal) modal.remove();
        };

        window.promoteToAdmin = async function() {
            const select = document.getElementById('admin-user-select');
            const userId = select.value;
            
            if (!userId) {
                showNotification('Please select a user', 'error');
                return;
            }
            
            try {
                // Update user to admin
                const { error } = await supabase
                    .from('profiles')
                    .update({ is_admin: true, updated_at: new Date().toISOString() })
                    .eq('id', userId);
                
                if (error) {
                    // If column doesn't exist, show error with instructions
                    if (error.message.includes('column "is_admin" of relation "profiles" does not exist')) {
                        showNotification('❌ Error: Admin column not set up. Please run the SQL first.', 'error');
                        return;
                    }
                    throw error;
                }
                
                showNotification('✅ User promoted to admin successfully!');
                
                // Close modal and refresh admin list
                window.closeAddAdminModal();
                await loadAdminList();
                await loadInitialStats(); // Refresh stats
                
            } catch (error) {
                console.error('Error promoting to admin:', error);
                showNotification('❌ Error: ' + error.message, 'error');
            }
        };

    } catch (error) {
        console.error('Error showing add admin modal:', error);
        showNotification('Error loading users: ' + error.message, 'error');
    }
}

// Remove admin function
window.removeAdminFromList = async function(userId, userEmail) {
    // Extra confirmation for admin removal
    if (!confirm(`Are you sure you want to remove admin privileges from ${userEmail}?\n\nThey will no longer be able to access the admin panel.`)) {
        return;
    }
    
    try {
        // Check if current user is main admin
        if (currentUser.email !== 'retrogamemasterra@gmail.com') {
            showNotification('Only the main admin can remove admin privileges', 'error');
            return;
        }
        
        // Update user to remove admin status
        const { error } = await supabase
            .from('profiles')
            .update({ 
                is_admin: false, 
                updated_at: new Date().toISOString(),
                admin_removed_at: new Date().toISOString(),
                admin_removed_by: currentUser.id
            })
            .eq('id', userId);
        
        if (error) {
            if (error.message.includes('column "is_admin" of relation "profiles" does not exist')) {
                showNotification('❌ Error: Admin column not set up.', 'error');
                return;
            }
            throw error;
        }
        
        showNotification('✅ Admin privileges removed successfully!');
        await loadAdminList();
        await loadInitialStats(); // Refresh stats
        
    } catch (error) {
        console.error('Error removing admin:', error);
        showNotification('❌ Error: ' + error.message, 'error');
    }
};

// USER MANAGEMENT FUNCTION
async function loadAllUsers() {
    const content = document.getElementById('admin-content');
    
    try {
        content.innerHTML = `
            <div class="text-center py-8">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
                <p class="text-gray-400 mt-2">Loading users...</p>
            </div>
        `;

        const { data: users, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        let html = `
            <div>
                <h2 class="text-2xl font-bold text-white mb-6">All Users (${users?.length || 0})</h2>
                
                <div class="bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                    <table class="min-w-full divide-y divide-gray-700">
                        <thead class="bg-gray-800">
                            <tr>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    User
                                </th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Email
                                </th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Status
                                </th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Joined
                                </th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody id="usersList" class="bg-gray-900 divide-y divide-gray-800">
                            ${users?.map(user => {
                                // Check if user is admin - handle missing column
                                const isUserAdmin = user.is_admin === true;
                                return `
                                <tr class="hover:bg-gray-800">
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <div class="flex items-center">
                                            <div class="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                                                <span class="text-white font-bold">
                                                    ${(user.username || user.email).charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div class="ml-4">
                                                <div class="text-sm font-medium text-white">
                                                    ${user.username || 'No username'}
                                                    ${user.email === 'retrogamemasterra@gmail.com' ? 
                                                        '<span class="ml-2 bg-yellow-600 text-white px-2 py-1 rounded text-xs">Main Admin</span>' : ''}
                                                    ${isUserAdmin && user.email !== 'retrogamemasterra@gmail.com' ? 
                                                        '<span class="ml-2 bg-yellow-600 text-white px-2 py-1 rounded text-xs">Admin</span>' : ''}
                                                </div>
                                                <div class="text-sm text-gray-300">
                                                    ${user.favorite_console || 'No console'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                        ${user.email}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                            isUserAdmin ? 'bg-yellow-900 text-yellow-200' : 'bg-green-900 text-green-200'
                                        }">
                                            ${isUserAdmin ? 'Admin' : 'User'}
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                        ${new Date(user.created_at).toLocaleDateString()}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div class="flex space-x-2">
                                            ${user.email === 'retrogamemasterra@gmail.com' ? 
                                                '<span class="text-gray-400">Main Admin</span>' :
                                                isUserAdmin ? 
                                                    `<button onclick="removeAdminFromList('${user.id}', '${escapeString(user.email)}')" 
                                                             class="text-red-400 hover:text-red-300 bg-red-600 hover:bg-red-700 px-3 py-1 rounded">
                                                        Remove Admin
                                                    </button>` :
                                                    currentUser.email === 'retrogamemasterra@gmail.com' ?
                                                        `<button onclick="promoteUserToAdmin('${user.id}', '${escapeString(user.email)}')" 
                                                                 class="text-green-400 hover:text-green-300 bg-green-600 hover:bg-green-700 px-3 py-1 rounded">
                                                            Make Admin
                                                        </button>` :
                                                        '<span class="text-gray-400">Main admin only</span>'
                                            }
                                        </div>
                                    </td>
                                </tr>
                            `}).join('') || `
                                <tr>
                                    <td colspan="5" class="px-6 py-8 text-center text-gray-400">
                                        No users found.
                                    </td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        content.innerHTML = html;

    } catch (error) {
        console.error('Error loading users:', error);
        if (content) {
            content.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-4xl mb-4">⚠️</div>
                    <h3 class="text-xl font-bold text-white mb-2">Error</h3>
                    <p class="text-red-400">${error.message}</p>
                </div>
            `;
        }
    }
}

// Promote user to admin from users list
window.promoteUserToAdmin = async function(userId, userEmail) {
    if (currentUser.email !== 'retrogamemasterra@gmail.com') {
        showNotification('Only the main admin can promote users to admin', 'error');
        return;
    }
    
    if (!confirm(`Promote ${userEmail} to admin?\n\nThey will be able to approve/reject game submissions and manage games.`)) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('profiles')
            .update({ 
                is_admin: true, 
                updated_at: new Date().toISOString(),
                admin_promoted_at: new Date().toISOString(),
                admin_promoted_by: currentUser.id
            })
            .eq('id', userId);
        
        if (error) {
            if (error.message.includes('column "is_admin" of relation "profiles" does not exist')) {
                showNotification('❌ Error: Admin column not set up. Please run the SQL first.', 'error');
                return;
            }
            throw error;
        }
        
        showNotification('✅ User promoted to admin successfully!');
        await loadAllUsers();
        await loadInitialStats();
        
    } catch (error) {
        console.error('Error promoting user:', error);
        showNotification('❌ Error: ' + error.message, 'error');
    }
};

// Game management functions
async function loadAdminGames() {
    const content = document.getElementById('admin-content');
    
    try {
        content.innerHTML = `
            <div class="text-center py-8">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
                <p class="text-gray-400 mt-2">Loading games...</p>
            </div>
        `;

        const { data: games, error } = await supabase
            .from('games')
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) throw error;

        allGames = games || [];
        
        // Update tab count
        document.querySelector('#tab-games').textContent = `🎮 Games (${allGames.length})`;

        let html = `
            <div>
                <h2 class="text-2xl font-bold text-white mb-6">Game Library (${allGames.length})</h2>
                
                <div class="mb-4">
                    <input type="text" 
                           id="game-search" 
                           placeholder="Search games..." 
                           class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500">
                </div>
                
                <div class="bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                    <table class="min-w-full divide-y divide-gray-700">
                        <thead class="bg-gray-800">
                            <tr>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Game
                                </th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Submitted By
                                </th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Status
                                </th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody id="gamesList" class="bg-gray-900 divide-y divide-gray-800">
                            ${allGames.map(game => `
                                <tr class="hover:bg-gray-800">
                                    <td class="px-6 py-4">
                                        <div class="flex items-center">
                                            <div>
                                                <div class="text-white font-medium">${game.title}</div>
                                                <div class="text-gray-400 text-sm">${game.console} • ${game.year || 'N/A'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 text-gray-300">${game.submitted_email || 'N/A'}</td>
                                    <td class="px-6 py-4">
                                        <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-900 text-green-200">
                                            Approved
                                        </span>
                                    </td>
                                    <td class="px-6 py-4">
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
                            `).join('') || `
                                <tr>
                                    <td colspan="5" class="px-6 py-8 text-center text-gray-400">
                                        No games found in the library.
                                    </td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        content.innerHTML = html;

        // Add search functionality
        document.getElementById('game-search')?.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredGames = allGames.filter(game => 
                game.title.toLowerCase().includes(searchTerm) ||
                game.console.toLowerCase().includes(searchTerm) ||
                (game.submitted_email && game.submitted_email.toLowerCase().includes(searchTerm))
            );
            renderGamesTable(filteredGames);
        });

    } catch (error) {
        console.error('Error loading admin games:', error);
        if (content) {
            content.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-4xl mb-4">⚠️</div>
                    <h3 class="text-xl font-bold text-white mb-2">Error</h3>
                    <p class="text-red-400">${error.message}</p>
                </div>
            `;
        }
    }
}

function renderGamesTable(games) {
    const gamesListEl = document.getElementById('gamesList');
    if (!gamesListEl) return;

    if (!games || games.length === 0) {
        gamesListEl.innerHTML = `
            <tr>
                <td colspan="4" class="px-6 py-8 text-center text-gray-400">
                    No games found matching your search.
                </td>
            </tr>
        `;
        return;
    }

    gamesListEl.innerHTML = games.map(game => `
        <tr class="hover:bg-gray-800">
            <td class="px-6 py-4">
                <div class="flex items-center">
                    <div>
                        <div class="text-white font-medium">${game.title}</div>
                        <div class="text-gray-400 text-sm">${game.console} • ${game.year || 'N/A'}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 text-gray-300">${game.submitted_email || 'N/A'}</td>
            <td class="px-6 py-4">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-900 text-green-200">
                    Approved
                </span>
            </td>
            <td class="px-6 py-4">
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

// SHOW GAME EDIT FORM FUNCTION - FIXED
async function showGameEditForm(gameId) {
    try {
        console.log('Showing game edit form for:', gameId);
        
        // Load game data using the imported function
        const game = await getGameById(gameId);
        
        if (!game) {
            console.error('Game not found:', gameId);
            showNotification('❌ Error loading game', 'error');
            return;
        }

        console.log('Game data loaded:', game);

        // Create edit form in admin content area
        const content = document.getElementById('admin-content');
        if (!content) {
            // If we're in standalone edit mode, create the container
            const appContent = document.getElementById('app-content');
            if (appContent) {
                appContent.innerHTML = `
                    <div class="max-w-7xl mx-auto p-4">
                        <div class="mb-6">
                            <a href="#/games" class="inline-flex items-center text-cyan-400 hover:text-cyan-300">
                                ← Back to Games
                            </a>
                        </div>
                        <div id="edit-game-container"></div>
                    </div>
                `;
                content = document.getElementById('edit-game-container');
            }
        }

        if (content) {
            console.log('Creating edit form HTML...');
            content.innerHTML = createGameEditForm(game);
            setTimeout(() => {
                setupGameEditForm(game);
            }, 100);
        }

    } catch (error) {
        console.error('Error showing game edit form:', error);
        showNotification('❌ Error: ' + error.message, 'error');
    }
}

function createGameEditForm(game) {
    const adminEmails = ['retrogamemasterra@gmail.com', 'admin@retroonlinematchmaking.com'];
    const isAdmin = currentUser && adminEmails.includes(currentUser.email?.toLowerCase());
    
    // Helper function to escape HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    return `
        <div class="bg-gray-800 rounded-lg p-6">
            <h2 class="text-2xl font-bold text-white mb-6">✏️ Edit Game: ${escapeHtml(game.title)}</h2>
            
            <!-- Image Management Section -->
            <div class="bg-gray-900 rounded-lg p-6 mb-6 border border-gray-700">
                <h3 class="text-lg font-bold text-white mb-4">🖼️ Game Images</h3>
                
                <!-- Cover Art -->
                <div class="mb-6">
                    <h4 class="text-md font-bold text-cyan-300 mb-3">Cover Art</h4>
                    <div class="flex flex-col md:flex-row gap-6">
                        <div class="md:w-1/3">
                            <div class="current-image mb-4">
                                <p class="text-gray-300 mb-2">Current:</p>
                                ${game.cover_image_url ? 
                                    `<img src="${game.cover_image_url}" alt="Cover" 
                                         class="w-full h-64 object-cover rounded-lg border border-gray-600"
                                         id="currentCoverImage">` :
                                    `<div class="w-full h-64 bg-gray-700 rounded-lg flex items-center justify-center">
                                        <span class="text-gray-500 text-2xl">🎮</span>
                                    </div>`
                                }
                            </div>
                        </div>
                        
                        <div class="md:w-2/3">
                            <div class="mb-4">
                                <label class="block text-gray-300 mb-2">Update Cover Image</label>
                                <input type="file" id="newCoverImage" accept="image/*" 
                                       class="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white">
                            </div>
                            <div id="coverPreview" class="hidden mb-4">
                                <p class="text-gray-300 mb-2">Preview:</p>
                                <img id="coverPreviewImage" class="w-32 h-32 object-cover rounded-lg border border-cyan-500">
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Screenshots (Admin Only) -->
                ${isAdmin ? `
                    <div>
                        <h4 class="text-md font-bold text-purple-300 mb-3">Screenshots</h4>
                        <div class="mb-4">
                            <div class="mb-3">
                                <label class="block text-gray-300 mb-2">Add Screenshots</label>
                                <input type="file" id="newScreenshots" accept="image/*" multiple 
                                       class="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white">
                            </div>
                            
                            <div id="screenshotsContainer" class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                ${game.screenshot_urls && game.screenshot_urls.length > 0 ? 
                                    game.screenshot_urls.map((url, index) => `
                                        <div class="screenshot-item relative" data-index="${index}">
                                            <img src="${url}" alt="Screenshot ${index + 1}" 
                                                 class="w-full h-32 object-cover rounded-lg border border-gray-600">
                                            <button type="button" onclick="removeGameScreenshot('${game.id}', ${index})" 
                                                    class="absolute top-0 right-0 bg-red-600 text-white w-6 h-6 rounded-full text-xs">
                                                ✕
                                            </button>
                                        </div>
                                    `).join('') : 
                                    '<p class="text-gray-500 col-span-4 text-center py-4">No screenshots yet</p>'
                                }
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <!-- Game Details Form -->
            <form id="gameEditForm" class="space-y-4">
                <input type="hidden" id="editGameId" value="${game.id}">
                
                <div class="grid md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-gray-300 mb-2">Title *</label>
                        <input type="text" id="editTitle" value="${escapeHtml(game.title)}" required 
                               class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">
                    </div>
                    
                    <div>
                        <label class="block text-gray-300 mb-2">Console *</label>
                        <input type="text" id="editConsole" value="${escapeHtml(game.console)}" required 
                               class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">
                    </div>
                </div>
                
                <div class="grid md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-gray-300 mb-2">Year</label>
                        <input type="number" id="editYear" value="${game.year || ''}" 
                               class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">
                    </div>
                    
                    <div>
                        <label class="block text-gray-300 mb-2">Multiplayer Type</label>
                        <select id="editMultiplayerType" 
                                class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">
                            <option value="Online" ${game.multiplayer_type === 'Online' ? 'selected' : ''}>Online</option>
                            <option value="LAN" ${game.multiplayer_type === 'LAN' ? 'selected' : ''}>LAN</option>
                            <option value="Split-screen" ${game.multiplayer_type === 'Split-screen' ? 'selected' : ''}>Split-screen</option>
                            <option value="Hotseat" ${game.multiplayer_type === 'Hotseat' ? 'selected' : ''}>Hotseat</option>
                            <option value="Mixed" ${game.multiplayer_type === 'Mixed' ? 'selected' : ''}>Mixed</option>
                            <option value="Other" ${game.multiplayer_type === 'Other' ? 'selected' : ''}>Other</option>
                        </select>
                    </div>
                </div>
                
                <div>
                    <label class="block text-gray-300 mb-2">Description *</label>
                    <textarea id="editDescription" rows="6" required 
                              class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">${escapeHtml(game.description || '')}</textarea>
                </div>
                
                <div class="grid md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-gray-300 mb-2">Connection Method</label>
                        <input type="text" id="editConnectionMethod" value="${escapeHtml(game.connection_method || '')}" 
                               class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">
                    </div>
                    
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-gray-300 mb-2">Min Players</label>
                            <input type="number" id="editPlayersMin" value="${game.players_min || 1}" min="1" max="99"
                                   class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">
                        </div>
                        <div>
                            <label class="block text-gray-300 mb-2">Max Players</label>
                            <input type="number" id="editPlayersMax" value="${game.players_max || 1}" min="1" max="99"
                                   class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">
                        </div>
                    </div>
                </div>
                
                <div>
                    <label class="block text-gray-300 mb-2">Connection Details</label>
                    <textarea id="editConnectionDetails" rows="3"
                              class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">${escapeHtml(game.connection_details || '')}</textarea>
                </div>
                
                <div>
                    <label class="block text-gray-300 mb-2">Server Details</label>
                    <textarea id="editServerDetails" rows="3"
                              class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">${escapeHtml(game.server_details || '')}</textarea>
                </div>
                
                <div class="flex items-center">
                    <input type="checkbox" id="editServersAvailable" ${game.servers_available ? 'checked' : ''}
                           class="w-4 h-4 text-cyan-500 bg-gray-700 border-gray-600 rounded">
                    <label class="ml-2 text-gray-300">Active servers available</label>
                </div>
                
                <div class="flex justify-end gap-3 pt-6">
                    <button type="button" onclick="window.location.hash = '#/game/${game.slug || game.id}'" 
                            class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg">
                        Cancel
                    </button>
                    <button type="submit" id="saveGameBtn" 
                            class="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg">
                        Save Changes
                    </button>
                </div>
            </form>
            
            <!-- Delete Game (Admin Only) -->
            ${isAdmin ? `
                <div class="mt-8 pt-6 border-t border-gray-700">
                    <h3 class="text-lg font-bold text-red-400 mb-3">⚠️ Admin Actions</h3>
                    <button onclick="adminDeleteGame('${game.id}', '${escapeString(game.title)}')"
                            class="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg">
                        🗑️ Delete Game
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

function setupGameEditForm(game) {
    const form = document.getElementById('gameEditForm');
    if (!form) {
        console.error('Game edit form not found!');
        return;
    }
    
    console.log('Setting up game edit form for:', game.id);
    
    // Cover image preview
    const coverInput = document.getElementById('newCoverImage');
    if (coverInput) {
        coverInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const preview = document.getElementById('coverPreview');
                    const img = document.getElementById('coverPreviewImage');
                    if (img) {
                        img.src = e.target.result;
                        preview.classList.remove('hidden');
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Screenshots preview
    const screenshotsInput = document.getElementById('newScreenshots');
    if (screenshotsInput) {
        screenshotsInput.addEventListener('change', function(e) {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                // Show loading indicator
                const container = document.getElementById('screenshotsContainer');
                if (!container) return;
                
                const loadingMsg = document.createElement('p');
                loadingMsg.className = 'text-gray-500 col-span-4 text-center py-4';
                loadingMsg.textContent = 'Uploading...';
                container.appendChild(loadingMsg);
                
                // Upload files
                setTimeout(async () => {
                    await uploadScreenshots(game.id, files);
                    loadingMsg.remove();
                }, 100);
            }
        });
    }
    
    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveGameEditForm(game);
    });
    
    // Make remove function available globally
    window.removeGameScreenshot = async function(gameId, index) {
        if (!confirm('Remove this screenshot?')) return;
        
        try {
            const { data: gameData } = await supabase
                .from('games')
                .select('screenshot_urls')
                .eq('id', gameId)
                .single();
            
            if (gameData && gameData.screenshot_urls) {
                const newScreenshots = [...gameData.screenshot_urls];
                newScreenshots.splice(index, 1);
                
                await supabase
                    .from('games')
                    .update({ screenshot_urls: newScreenshots })
                    .eq('id', gameId);
                
                showNotification('✅ Screenshot removed!');
                // Remove from UI
                const screenshotItem = document.querySelector(`.screenshot-item[data-index="${index}"]`);
                if (screenshotItem) {
                    screenshotItem.remove();
                }
                // Update indices
                updateScreenshotIndices(gameId);
            }
        } catch (error) {
            console.error('Error removing screenshot:', error);
            showNotification('❌ Error: ' + error.message, 'error');
        }
    };
}

async function saveGameEditForm(game) {
    const saveBtn = document.getElementById('saveGameBtn');
    if (!saveBtn) {
        console.error('Save button not found!');
        return;
    }
    
    const originalText = saveBtn.textContent;
    
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    
    try {
        const gameId = document.getElementById('editGameId').value;
        
        // Handle cover image upload if new one selected
        const coverInput = document.getElementById('newCoverImage');
        let coverImageUrl = game.cover_image_url;
        
        if (coverInput && coverInput.files.length > 0) {
            const coverFile = coverInput.files[0];
            if (coverFile && coverFile.type.startsWith('image/')) {
                const fileExt = coverFile.name.split('.').pop();
                const fileName = `covers/${gameId}/${Date.now()}.${fileExt}`;
                
                const { data, error } = await supabase.storage
                    .from('game-media')
                    .upload(fileName, coverFile, {
                        cacheControl: '3600',
                        upsert: true
                    });
                
                if (!error) {
                    const { data: { publicUrl } } = supabase.storage
                        .from('game-media')
                        .getPublicUrl(fileName);
                    coverImageUrl = publicUrl;
                }
            }
        }
        
        // Prepare updates
        const updates = {
            title: document.getElementById('editTitle').value.trim(),
            console: document.getElementById('editConsole').value.trim(),
            year: document.getElementById('editYear').value ? parseInt(document.getElementById('editYear').value) : null,
            description: document.getElementById('editDescription').value.trim(),
            multiplayer_type: document.getElementById('editMultiplayerType').value,
            connection_method: document.getElementById('editConnectionMethod').value.trim() || null,
            connection_details: document.getElementById('editConnectionDetails').value.trim() || null,
            server_details: document.getElementById('editServerDetails').value.trim() || null,
            players_min: parseInt(document.getElementById('editPlayersMin').value) || 1,
            players_max: parseInt(document.getElementById('editPlayersMax').value) || 1,
            servers_available: document.getElementById('editServersAvailable').checked,
            cover_image_url: coverImageUrl,
            updated_at: new Date().toISOString()
        };
        
        console.log('Updating game with:', updates);
        
        // Save to database
        const { error } = await supabase
            .from('games')
            .update(updates)
            .eq('id', gameId);
        
        if (error) throw error;
        
        showNotification('✅ Game updated successfully!', 'success');
        
        // Redirect to game page
        setTimeout(() => {
            window.location.hash = `#/game/${game.slug || gameId}`;
        }, 1500);
        
    } catch (error) {
        console.error('Error saving game edit:', error);
        showNotification('❌ Error: ' + error.message, 'error');
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}

async function uploadScreenshots(gameId, files) {
    try {
        // Get current screenshots
        const { data: game } = await supabase
            .from('games')
            .select('screenshot_urls')
            .eq('id', gameId)
            .single();
        
        const currentScreenshots = game?.screenshot_urls || [];
        const newScreenshots = [...currentScreenshots];
        
        // Upload each file
        for (let i = 0; i < files.length && i < 10; i++) {
            const file = files[i];
            if (file.type.startsWith('image/')) {
                const fileExt = file.name.split('.').pop();
                const fileName = `screenshots/${gameId}/${Date.now()}_${i}.${fileExt}`;
                
                const { data, error } = await supabase.storage
                    .from('game-media')
                    .upload(fileName, file, {
                        cacheControl: '3600',
                        upsert: true
                    });
                
                if (!error) {
                    const { data: { publicUrl } } = supabase.storage
                        .from('game-media')
                        .getPublicUrl(fileName);
                    newScreenshots.push(publicUrl);
                }
            }
        }
        
        // Update game record
        await supabase
            .from('games')
            .update({ screenshot_urls: newScreenshots })
            .eq('id', gameId);
        
        showNotification(`✅ Added ${files.length} screenshot(s)!`);
        
        // Update UI
        updateScreenshotsUI(gameId, newScreenshots);
        
    } catch (error) {
        console.error('Error uploading screenshots:', error);
        showNotification('❌ Error uploading images: ' + error.message, 'error');
    }
}

function updateScreenshotsUI(gameId, screenshotUrls) {
    const container = document.getElementById('screenshotsContainer');
    if (!container) return;
    
    if (!screenshotUrls || screenshotUrls.length === 0) {
        container.innerHTML = '<p class="text-gray-500 col-span-4 text-center py-4">No screenshots yet</p>';
        return;
    }
    
    container.innerHTML = screenshotUrls.map((url, index) => `
        <div class="screenshot-item relative" data-index="${index}">
            <img src="${url}" alt="Screenshot ${index + 1}" 
                 class="w-full h-32 object-cover rounded-lg border border-gray-600">
            <button type="button" onclick="removeGameScreenshot('${gameId}', ${index})" 
                    class="absolute top-0 right-0 bg-red-600 text-white w-6 h-6 rounded-full text-xs">
                ✕
            </button>
        </div>
    `).join('');
}

function updateScreenshotIndices(gameId) {
    const items = document.querySelectorAll('.screenshot-item');
    items.forEach((item, index) => {
        item.setAttribute('data-index', index);
        const button = item.querySelector('button');
        if (button) {
            button.setAttribute('onclick', `removeGameScreenshot('${gameId}', ${index})`);
        }
    });
}

// Existing functions
window.approveSubmission = async (submissionId) => {
    if (!confirm('Approve this game submission?')) return;

    try {
        const user = await getCurrentUser();

        const { data: submission, error: fetchError } = await supabase
            .from('game_submissions')
            .select('*')
            .eq('id', submissionId)
            .single();

        if (fetchError) throw fetchError;

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
            connection_method: submission.connection_method,
            connection_details: submission.connection_details,
            multiplayer_type: submission.multiplayer_type,
            players_min: submission.players_min,
            players_max: submission.players_max,
            servers_available: submission.servers_available,
            server_details: submission.server_details,
            cover_image_url: submission.cover_image_url,
            screenshot_urls: submission.screenshot_urls || []
            slug: submission.slug 
        };

        const { error: insertError } = await supabase
            .from('games')
            .insert([gameData]);

        if (insertError) throw insertError;

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
        
        // Redirect to games list
        setTimeout(() => {
            window.location.hash = '#/games';
        }, 1500);

    } catch (error) {
        console.error('Error deleting game:', error);
        showNotification('❌ Error: ' + error.message, 'error');
    }
};

// UPDATED adminEditGame function
window.adminEditGame = async function(gameId) {
    try {
        console.log('Admin edit game called for:', gameId);
        
        // Check if we're in admin panel or standalone
        const inAdminPanel = document.getElementById('admin-content');
        
        if (inAdminPanel) {
            // We're in admin panel, show modal
            const game = await getGameById(gameId);
            
            if (!game) {
                showNotification('❌ Error loading game', 'error');
                return;
            }
            
            // Create modal
            const modalHtml = `
                <div id="edit-game-modal" class="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
                    <div class="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div class="p-6">
                            <div class="flex justify-between items-center mb-6">
                                <h2 class="text-2xl font-bold text-white">✏️ Edit Game: ${escapeString(game.title)}</h2>
                                <button onclick="document.getElementById('edit-game-modal').remove()" class="text-gray-400 hover:text-white">
                                    ✕
                                </button>
                            </div>
                            <div id="modal-edit-content"></div>
                        </div>
                    </div>
                </div>
            `;
            
            const modalContainer = document.createElement('div');
            modalContainer.innerHTML = modalHtml;
            document.body.appendChild(modalContainer);
            
            // Load edit form into modal
            const modalContent = document.getElementById('modal-edit-content');
            modalContent.innerHTML = createGameEditForm(game);
            setTimeout(() => {
                setupGameEditForm(game);
            }, 100);
            
        } else {
            // We're not in admin panel, redirect to edit page
            window.location.hash = `#/edit-game/${gameId}`;
        }

    } catch (error) {
        console.error('Error in adminEditGame:', error);
        showNotification('❌ Error: ' + error.message, 'error');
    }
};

// Helper functions
function escapeString(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transition transform duration-300 ${
        type === 'success' ? 'bg-green-600 text-white' :
        type === 'error' ? 'bg-red-600 text-white' :
        'bg-cyan-600 text-white'
    }`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('opacity-0', 'translate-x-full');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Make functions globally accessible
window.loadPendingSubmissions = loadPendingSubmissions;
window.createTestSubmission = createTestSubmission;
window.adminEditGame = async function(gameId) {
// Export for module system
export default initModule;
