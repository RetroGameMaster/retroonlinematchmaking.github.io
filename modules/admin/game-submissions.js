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
                                onclick="${sub.status === 'approved' ? 'rejectSubmission' : 'approveSubmission
