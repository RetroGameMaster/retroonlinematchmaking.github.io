import { supabase, getCurrentUser } from '../../lib/supabase.js';

export function initAdminModule() {
    console.log('Admin module initialized');
    checkAdminAccess();
    loadPendingSubmissions();
    
    // Handle form submission
    document.getElementById('admin-form')?.addEventListener('submit', handleAdminAction);
}

async function checkAdminAccess() {
    const user = await getCurrentUser();
    
    if (!user) {
        window.location.hash = '#/';
        return;
    }
    
    // Check if user is admin
    const { data: adminData } = await supabase
        .from('admins')
        .select('*')
        .eq('user_id', user.id)
        .single();
    
    if (!adminData) {
        alert('Access denied. Admin privileges required.');
        window.location.hash = '#/';
        return;
    }
}

async function loadPendingSubmissions() {
    const submissionsContainer = document.getElementById('pending-submissions');
    if (!submissionsContainer) return;
    
    submissionsContainer.innerHTML = '<p>Loading submissions...</p>';
    
    try {
        // Get pending game submissions
        const { data: submissions, error } = await supabase
            .from('game_submissions')
            .select(`
                *,
                users:user_id (
                    email
                )
            `)
            .eq('status', 'pending')
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        if (!submissions || submissions.length === 0) {
            submissionsContainer.innerHTML = '<p class="text-gray-500">No pending submissions.</p>';
            return;
        }
        
        submissionsContainer.innerHTML = submissions.map(sub => `
            <div class="bg-gray-800 p-4 rounded-lg mb-4">
                <h3 class="text-xl font-bold text-white">${sub.title}</h3>
                <p class="text-gray-300">Submitted by: ${sub.users?.email || 'Unknown'}</p>
                <p class="text-gray-300">Console: ${sub.console}</p>
                <p class="text-gray-300">Year: ${sub.year}</p>
                <p class="text-gray-300">Description: ${sub.description}</p>
                <p class="text-gray-300">File: <a href="${sub.file_url}" target="_blank" class="text-blue-400 hover:underline">Download</a></p>
                <div class="mt-4 flex space-x-4">
                    <button onclick="handleSubmissionAction('${sub.id}', 'approved')" 
                            class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                        Approve
                    </button>
                    <button onclick="handleSubmissionAction('${sub.id}', 'rejected')" 
                            class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">
                        Reject
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading submissions:', error);
        submissionsContainer.innerHTML = '<p class="text-red-500">Error loading submissions.</p>';
    }
}

async function handleAdminAction(e) {
    e.preventDefault();
    
    const form = e.target;
    const gameId = form.game_id.value;
    const action = form.action.value;
    const notes = form.notes.value;
    
    try {
        // Update submission status
        const { error } = await supabase
            .from('game_submissions')
            .update({
                status: action,
                reviewed_at: new Date().toISOString(),
                reviewed_by: (await getCurrentUser()).id,
                review_notes: notes
            })
            .eq('id', gameId);
        
        if (error) throw error;
        
        // If approved, add to games table
        if (action === 'approved') {
            const { data: submission } = await supabase
                .from('game_submissions')
                .select('*')
                .eq('id', gameId)
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
        
        alert(`Submission ${action} successfully!`);
        form.reset();
        loadPendingSubmissions();
        
    } catch (error) {
        console.error('Error processing submission:', error);
        alert('Error processing submission.');
    }
}

// Global function for inline buttons
window.handleSubmissionAction = async (submissionId, action) => {
    if (!confirm(`Are you sure you want to ${action} this submission?`)) return;
    
    try {
        const user = await getCurrentUser();
        
        const { error } = await supabase
            .from('game_submissions')
            .update({
                status: action,
                reviewed_at: new Date().toISOString(),
                reviewed_by: user.id
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
        
        loadPendingSubmissions();
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error processing action.');
    }
};
