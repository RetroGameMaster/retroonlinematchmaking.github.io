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
    
    submissionsContainer.innerHTML = '<div class="text-center py-4"><div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div></div>';
    
    try {
        const { data: submissions, error } = await supabase
            .from('game_submissions')
            .select(`
                *,
                users:user_id (
                    email,
                    raw_user_meta_data->username
                )
            `)
            .eq('status', 'pending')
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        if (!submissions || submissions.length === 0) {
            submissionsContainer.innerHTML = '<p class="text-gray-500 text-center py-8">No pending submissions.</p>';
            return;
        }
        
        submissionsContainer.innerHTML = submissions.map(sub => `
            <div class="bg-gray-800 p-6 rounded-lg mb-4 border border-gray-700">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-xl font-bold text-white">${sub.title}</h3>
                        <div class="flex items-center space-x-4 mt-2">
                            <span class="bg-gray-700 text-gray-300 px-3 py-1 rounded text-sm">${sub.console}</span>
                            <span class="text-gray-400">${sub.year}</span>
                            <span class="text-gray-500 text-sm">Submitted by: ${sub.users?.email || 'Unknown'}</span>
                        </div>
                    </div>
                    <span class="bg-yellow-600 text-white px-3 py-1 rounded text-sm">Pending Review</span>
                </div>
                
                <p class="text-gray-300 mb-4">${sub.description}</p>
                
                ${sub.file_url ? `
                    <div class="mb-4">
                        <a href="${sub.file_url}" target="_blank" 
                           class="inline-flex items-center text-cyan-400 hover:text-cyan-300">
                            <span class="mr-2">📎</span>
                            Download Game File
                        </a>
                    </div>
                ` : ''}
                
                <div class="flex space-x-4">
                    <button onclick="approveSubmission('${sub.id}')" 
                            class="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded font-semibold transition">
                        ✅ Approve
                    </button>
                    <button onclick="rejectSubmission('${sub.id}')" 
                            class="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded font-semibold transition">
                        ❌ Reject
                    </button>
                    <button onclick="showReviewModal('${sub.id}', '${sub.title.replace(/'/g, "\\'")}')" 
                            class="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-3 rounded font-semibold transition">
                        📝 Review with Notes
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading submissions:', error);
        submissionsContainer.innerHTML = '<p class="text-red-500 text-center py-8">Error loading submissions.</p>';
    }
}

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
        
        // Update submission status
        const { error } = await supabase
            .from('game_submissions')
            .update({
                status: 'approved',
                reviewed_at: new Date().toISOString(),
                reviewed_by: user.id
            })
            .eq('id', submissionId);
        
        if (error) throw error;
        
        // Get submission data
        const { data: submission } = await supabase
            .from('game_submissions')
            .select('*')
            .eq('id', submissionId)
            .single();
        
        if (submission) {
            // Add to games table
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
        
        showNotification('Game approved and added to library!', 'success');
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
