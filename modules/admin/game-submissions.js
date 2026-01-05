function initGameSubmissions(rom) {
    console.log('Initializing game submissions review...');
    
    let currentFilter = 'pending';
    let currentRejectId = null;
    
    // Check admin access
    if (!rom.currentUser) {
        window.location.href = '#';
        rom.loadModule('home');
        return;
    }
    
    // Load submissions
    loadSubmissions();
    
    // Set up event handlers
    setupEventHandlers();
    
    function loadSubmissions() {
        const submissions = JSON.parse(localStorage.getItem('rom_game_submissions') || '[]');
        
        // Update counts
        document.getElementById('pendingCount').textContent = 
            submissions.filter(s => s.status === 'pending').length;
        document.getElementById('approvedCount').textContent = 
            submissions.filter(s => s.status === 'approved').length;
        document.getElementById('rejectedCount').textContent = 
            submissions.filter(s => s.status === 'rejected').length;
        document.getElementById('totalCount').textContent = submissions.length;
        
        // Filter submissions
        let filteredSubmissions = submissions;
        if (currentFilter !== 'all') {
            filteredSubmissions = submissions.filter(s => s.status === currentFilter);
        }
        
        // Sort by submission date (newest first)
        filteredSubmissions.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
        
        // Display submissions
        displaySubmissions(filteredSubmissions);
    }
    
    function displaySubmissions(submissions) {
        const container = document.getElementById('submissionsContainer');
        
        if (submissions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3 style="color: #ff33cc;">No ${currentFilter} submissions found</h3>
                    <p>${getEmptyStateMessage()}</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = submissions.map(sub => `
            <div class="submission-card ${sub.status}" id="submission-${sub.id}">
                <div class="submission-header">
                    <div style="flex: 1;">
                        <h3 class="submission-title">${sub.title}</h3>
                        <div class="submission-meta">
                            Submitted by: <strong>${sub.submittedBy}</strong> • 
                            ${formatDate(sub.submittedAt)} • 
                            ${sub.connectionMethods?.length || 0} connection methods
                        </div>
                    </div>
                    <div class="status-badge status-${sub.status}">
                        ${getStatusText(sub.status)}
                    </div>
                </div>
                
                <div class="submission-details">
                    <!-- Description -->
                    <div class="detail-section">
                        <h4>📝 Description</h4>
                        <p>${sub.description}</p>
                    </div>
                    
                    <!-- Platforms & Info -->
                    <div class="detail-section">
                        <h4>🎮 Platform & Players</h4>
                        <div class="platform-tags">
                            ${sub.platforms.map(p => `<span class="platform-tag">${getPlatformName(p)}</span>`).join('')}
                        </div>
                        <p>Max Players: <strong>${sub.maxPlayers}</strong></p>
                        ${sub.releaseYear ? `<p>Release Year: <strong>${sub.releaseYear}</strong></p>` : ''}
                        ${sub.genre ? `<p>Genres: <strong>${sub.genre.join(', ')}</strong></p>` : ''}
                    </div>
                    
                    <!-- Connection Methods -->
                    <div class="detail-section">
                        <h4>🔗 Connection Methods</h4>
                        ${(sub.connectionMethods || []).map(method => `
                            <div class="connection-method">
                                <h5>${method.name} (${method.type})</h5>
                                ${method.serverAddress ? `<p>Server: <code>${method.serverAddress}</code></p>` : ''}
                                ${method.instructions ? `<p>Instructions: ${method.instructions}</p>` : ''}
                            </div>
                        `).join('')}
                    </div>
                    
                    <!-- Additional Info -->
                    ${sub.communityLink || sub.submitterContact || sub.additionalNotes ? `
                        <div class="detail-section">
                            <h4>ℹ️ Additional Information</h4>
                            ${sub.communityLink ? `<p>Community: <a href="${sub.communityLink}" target="_blank">${sub.communityLink}</a></p>` : ''}
                            ${sub.submitterContact ? `<p>Contact: ${sub.submitterContact}</p>` : ''}
                            ${sub.additionalNotes ? `<p>Notes: ${sub.additionalNotes}</p>` : ''}
                        </div>
                    ` : ''}
                    
                    <!-- Review Info (if reviewed) -->
                    ${sub.reviewedBy ? `
                        <div class="review-info">
                            <strong>${sub.status === 'approved' ? '✅ Approved' : '❌ Rejected'}</strong> by ${sub.reviewedBy} on ${formatDate(sub.reviewedAt)}
                            ${sub.adminNotes ? `<br>Notes: ${sub.adminNotes}` : ''}
                        </div>
                    ` : ''}
                </div>
                
                <!-- Admin Notes Input -->
                <div class="admin-notes">
                    <label>Admin Notes (optional):</label>
                    <textarea id="notes-${sub.id}" placeholder="Add notes for this submission...">${sub.adminNotes || ''}</textarea>
                </div>
                
                <!-- Action Buttons -->
                <div class="admin-actions">
                    ${sub.status === 'pending' ? `
                        <button class="action-btn approve" onclick="approveSubmission('${sub.id}')">
                            ✅ Approve
                        </button>
                        <button class="action-btn reject" onclick="showRejectModal('${sub.id}')">
                            ❌ Reject
                        </button>
                    ` : ''}
                    
                    <button class="action-btn edit" onclick="editSubmission('${sub.id}')">
                        ✏️ Edit
                    </button>
                    
                    ${sub.status !== 'pending' ? `
                        <button class="action-btn ${sub.status === 'approved' ? 'reject' : 'approve'}" 
                                onclick="${sub.status === 'approved' ? 'rejectSubmission' : 'approveSubmission'}('${sub.id}')">
                            ${sub.status === 'approved' ? '❌ Unapprove' : '✅ Re-approve'}
                        </button>
                    ` : ''}
                    
                    <button class="action-btn reject" onclick="deleteSubmission('${sub.id}')" 
                            style="background: rgba(255,0,0,0.1); color: #ff3333; border: 1px solid #ff3333;">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    function getEmptyStateMessage() {
        switch(currentFilter) {
            case 'pending': return 'All submissions have been reviewed!';
            case 'approved': return 'No games have been approved yet.';
            case 'rejected': return 'No submissions have been rejected.';
            default: return 'No submissions found in the database.';
        }
    }
    
    function getStatusText(status) {
        switch(status) {
            case 'pending': return '⏳ Pending Review';
            case 'approved': return '✅ Approved';
            case 'rejected': return '❌ Rejected';
            default: return status;
        }
    }
    
    function getPlatformName(code) {
        const platforms = {
            'ps1': 'PS1', 'ps2': 'PS2', 'ps3': 'PS3', 'psp': 'PSP',
            'xbox': 'Xbox', 'xbox360': 'Xbox 360', 'gamecube': 'GameCube',
            'wii': 'Wii', 'dreamcast': 'Dreamcast', 'pc': 'PC'
        };
        return platforms[code] || code;
    }
    
    function formatDate(dateString) {
        if (!dateString) return 'Unknown date';
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    function setupEventHandlers() {
        // Tab switching
        window.showSubmissions = function(filter) {
            currentFilter = filter;
            
            // Update active tab
            document.querySelectorAll('.submissions-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            event.target.classList.add('active');
            
            // Reload submissions
            loadSubmissions();
        };
        
        // Approve submission
        window.approveSubmission = function(submissionId) {
            if (!confirm('Approve this game submission?')) return;
            
            const submissions = JSON.parse(localStorage.getItem('rom_game_submissions') || '[]');
            const updated = submissions.map(sub => {
                if (sub.id === submissionId) {
                    const notes = document.getElementById(`notes-${submissionId}`)?.value || '';
                    return {
                        ...sub,
                        status: 'approved',
                        reviewedBy: rom.currentUser.email,
                        reviewedAt: new Date().toISOString(),
                        adminNotes: notes
                    };
                }
                return sub;
            });
            
            localStorage.setItem('rom_game_submissions', JSON.stringify(updated));
            
            // Show success message
            alert('✅ Game approved! It will now appear in the public games list.');
            
            // Reload
            loadSubmissions();
        };
        
        // Show reject modal
        window.showRejectModal = function(submissionId) {
            currentRejectId = submissionId;
            document.getElementById('rejectModal').style.display = 'flex';
            document.getElementById('rejectReason').focus();
        };
        
        // Confirm reject
        window.confirmReject = function() {
            if (!currentRejectId) return;
            
            const reason = document.getElementById('rejectReason').value.trim();
            if (!reason && !confirm('Reject without providing a reason?')) return;
            
            const submissions = JSON.parse(localStorage.getItem('rom_game_submissions') || '[]');
            const updated = submissions.map(sub => {
                if (sub.id === currentRejectId) {
                    const notes = document.getElementById(`notes-${currentRejectId}`)?.value || '';
                    return {
                        ...sub,
                        status: 'rejected',
                        reviewedBy: rom.currentUser.email,
                        reviewedAt: new Date().toISOString(),
                        adminNotes: notes + (reason ? `\nRejection Reason: ${reason}` : '')
                    };
                }
                return sub;
            });
            
            localStorage.setItem('rom_game_submissions', JSON.stringify(updated));
            
            // Hide modal and reset
            document.getElementById('rejectModal').style.display = 'none';
            document.getElementById('rejectReason').value = '';
            currentRejectId = null;
            
            alert('❌ Submission rejected.');
            loadSubmissions();
        };
        
        // Cancel reject
        window.cancelReject = function() {
            document.getElementById('rejectModal').style.display = 'none';
            document.getElementById('rejectReason').value = '';
            currentRejectId = null;
        };
        
        // Edit submission
        window.editSubmission = function(submissionId) {
            alert('Edit functionality coming in Phase 3! For now, you can:\n1. Reject and ask user to resubmit\n2. Approve and edit later');
        };
        
        // Delete submission
        window.deleteSubmission = function(submissionId) {
            if (!confirm('⚠️ Permanently delete this submission? This cannot be undone.')) return;
            
            const submissions = JSON.parse(localStorage.getItem('rom_game_submissions') || '[]');
            const filtered = submissions.filter(sub => sub.id !== submissionId);
            localStorage.setItem('rom_game_submissions', JSON.stringify(filtered));
            
            alert('🗑️ Submission deleted.');
            loadSubmissions();
        };
    }
}

// Execute when loaded
if (typeof window.rom !== 'undefined') {
    initGameSubmissions(window.rom);
}
