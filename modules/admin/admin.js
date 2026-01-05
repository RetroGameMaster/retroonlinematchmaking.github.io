function initAdminModule(rom) {
    console.log('Initializing admin module...');
    
    // Check if user is admin (for now, check if logged in - later add role check)
    if (!rom.currentUser) {
        document.getElementById('adminCheck').style.display = 'block';
        document.getElementById('adminDashboard').style.display = 'none';
        return;
    }
    
    const adminEmails = ['RetroGameMasterRA@gmail.com']; // Add your email here
    if (!adminEmails.includes(rom.currentUser.email)) {
        document.getElementById('adminCheck').style.display = 'block';
        document.getElementById('adminDashboard').style.display = 'none';
        return;
    }
    
    // User is admin - show dashboard
    document.getElementById('adminCheck').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';
    
    // Load stats
    loadAdminStats();
    loadRecentActivity();
    
    // Set up button handlers
    setupAdminButtons();
    
    // Functions
    function loadAdminStats() {
        const submissions = JSON.parse(localStorage.getItem('rom_game_submissions') || '[]');
        
        const pending = submissions.filter(s => s.status === 'pending').length;
        const approved = submissions.filter(s => s.status === 'approved').length;
        const rejected = submissions.filter(s => s.status === 'rejected').length;
        const total = submissions.length;
        
        document.getElementById('pendingCount').textContent = pending;
        document.getElementById('approvedCount').textContent = approved;
        document.getElementById('rejectedCount').textContent = rejected;
        document.getElementById('totalSubmissions').textContent = total;
    }
    
    function loadRecentActivity() {
        const submissions = JSON.parse(localStorage.getItem('rom_game_submissions') || '[]');
        const activity = document.getElementById('recentActivity');
        
        // Get recent submissions (last 5)
        const recent = submissions
            .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
            .slice(0, 5);
        
        if (recent.length === 0) {
            activity.innerHTML = `
                <div class="activity-item">
                    <div>No recent activity</div>
                    <div class="activity-time">--:--</div>
                </div>
            `;
            return;
        }
        
        activity.innerHTML = recent.map(sub => {
            const time = new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const date = new Date(sub.submittedAt).toLocaleDateString();
            let statusBadge = '';
            
            if (sub.status === 'pending') {
                statusBadge = '<span style="color: #ffff00;">⏳ Pending</span>';
            } else if (sub.status === 'approved') {
                statusBadge = '<span style="color: #00ff00;">✅ Approved</span>';
            } else if (sub.status === 'rejected') {
                statusBadge = '<span style="color: #ff3333;">❌ Rejected</span>';
            }
            
            return `
                <div class="activity-item">
                    <div><strong>${sub.title}</strong> - ${statusBadge}</div>
                    <div style="color: #a8dfe8; font-size: 0.9rem;">Submitted by: ${sub.submittedBy}</div>
                    <div class="activity-time">${date} at ${time}</div>
                </div>
            `;
        }).join('');
    }
    
    function setupAdminButtons() {
        // Game Management
        window.manageApprovedGames = function() {
            alert('Approved games management coming soon!');
        };
        
        window.viewRejectedSubmissions = function() {
            // Show rejected submissions
            const submissions = JSON.parse(localStorage.getItem('rom_game_submissions') || '[]');
            const rejected = submissions.filter(s => s.status === 'rejected');
            
            if (rejected.length === 0) {
                alert('No rejected submissions found.');
                return;
            }
            
            let message = `Rejected Submissions (${rejected.length}):\n\n`;
            rejected.forEach((sub, index) => {
                message += `${index + 1}. ${sub.title} (${sub.submittedBy})\n`;
                if (sub.adminNotes) {
                    message += `   Notes: ${sub.adminNotes}\n`;
                }
                message += '\n';
            });
            
            alert(message);
        };
        
        window.addGameManually = function() {
            alert('Manual game addition coming soon!');
        };
        
        // User Management (placeholders)
        window.manageUsers = function() {
            alert('User management coming soon!');
        };
        
        window.viewUserReports = function() {
            alert('User reports coming soon!');
        };
        
        window.manageUserRoles = function() {
            alert('User role management coming soon!');
        };
        
        window.banUsers = function() {
            alert('User banning system coming soon!');
        };
        
        // System Settings (placeholders)
        window.systemSettings = function() {
            alert('System settings coming soon!');
        };
        
        window.backupData = function() {
            // Export all submissions as JSON
            const submissions = JSON.parse(localStorage.getItem('rom_game_submissions') || '[]');
            const dataStr = JSON.stringify(submissions, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            
            const exportFileDefaultName = `rom-backup-${new Date().toISOString().split('T')[0]}.json`;
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
            
            alert(`Backup exported: ${submissions.length} submissions`);
        };
        
        window.viewLogs = function() {
            alert('System logs coming soon!');
        };
        
        window.purgeData = function() {
            if (confirm('⚠️ Are you sure you want to purge all rejected submissions? This cannot be undone.')) {
                const submissions = JSON.parse(localStorage.getItem('rom_game_submissions') || '[]');
                const filtered = submissions.filter(s => s.status !== 'rejected');
                localStorage.setItem('rom_game_submissions', JSON.stringify(filtered));
                alert(`Purged ${submissions.length - filtered.length} rejected submissions.`);
                loadAdminStats();
                loadRecentActivity();
            }
        };
        
        // Quick Actions
        window.approveAllPending = function() {
            const submissions = JSON.parse(localStorage.getItem('rom_game_submissions') || '[]');
            const pending = submissions.filter(s => s.status === 'pending');
            
            if (pending.length === 0) {
                alert('No pending submissions to approve.');
                return;
            }
            
            if (confirm(`Approve all ${pending.length} pending submissions?`)) {
                const updated = submissions.map(sub => {
                    if (sub.status === 'pending') {
                        return {
                            ...sub,
                            status: 'approved',
                            reviewedBy: rom.currentUser.email,
                            reviewedAt: new Date().toISOString(),
                            adminNotes: 'Bulk approved by admin'
                        };
                    }
                    return sub;
                });
                
                localStorage.setItem('rom_game_submissions', JSON.stringify(updated));
                alert(`Approved ${pending.length} submissions.`);
                loadAdminStats();
                loadRecentActivity();
            }
        };
        
        window.exportGameData = function() {
            const submissions = JSON.parse(localStorage.getItem('rom_game_submissions') || '[]');
            const approved = submissions.filter(s => s.status === 'approved');
            
            if (approved.length === 0) {
                alert('No approved games to export.');
                return;
            }
            
            // Format for export
            const exportData = approved.map(game => ({
                title: game.title,
                platforms: game.platforms,
                maxPlayers: game.maxPlayers,
                description: game.description,
                connectionMethods: game.connectionMethods,
                submittedBy: game.submittedBy,
                releaseYear: game.releaseYear,
                genre: game.genre
            }));
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            
            const exportFileDefaultName = `rom-games-export-${new Date().toISOString().split('T')[0]}.json`;
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
            
            alert(`Exported ${approved.length} approved games.`);
        };
        
        window.clearLocalStorage = function() {
            if (confirm('⚠️ Clear all test data from localStorage? This will delete all submissions.')) {
                localStorage.removeItem('rom_game_submissions');
                alert('All test data cleared.');
                loadAdminStats();
                loadRecentActivity();
            }
        };
    }
}

// Execute when loaded
if (typeof window.rom !== 'undefined') {
    initAdminModule(window.rom);
}
