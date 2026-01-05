function initSubmitGame(rom) {
    console.log('Initializing game submission form...');
    
    let methodCount = 1;
    
    // Add new connection method
    document.getElementById('addMethodBtn').addEventListener('click', function() {
        const methodsContainer = document.getElementById('connectionMethods');
        const newMethod = document.createElement('div');
        newMethod.className = 'connection-method';
        newMethod.setAttribute('data-index', methodCount);
        
        newMethod.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h4 style="color: #00ffff; margin: 0;">Connection Method #${methodCount + 1}</h4>
                <button type="button" class="remove-method-btn" onclick="this.parentElement.parentElement.remove()">
                    ✕ Remove
                </button>
            </div>
            <div class="form-group">
                <label class="form-label">Method Name *</label>
                <input type="text" class="form-input" name="methodName" required 
                       placeholder="e.g., XLink Kai, PSONE, DNS Server">
            </div>
            
            <div class="form-group">
                <label class="form-label">Connection Type</label>
                <select class="form-select" name="connectionType">
                    <option value="dns">DNS Server</option>
                    <option value="community">Community Server</option>
                    <option value="vpn">VPN/LAN Tunnel</option>
                    <option value="emulator">Emulator Network</option>
                    <option value="official">Official Servers</option>
                    <option value="other">Other</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Instructions/Setup Guide</label>
                <textarea class="form-textarea" name="instructions" rows="3"
                          placeholder="Brief setup instructions or link to guide..."></textarea>
            </div>
            
            <div class="form-group">
                <label class="form-label">DNS/Server Address (if applicable)</label>
                <input type="text" class="form-input" name="serverAddress"
                       placeholder="e.g., 123.456.789.012">
            </div>
        `;
        
        methodsContainer.appendChild(newMethod);
        methodCount++;
    });
    
    // Handle form submission
    document.getElementById('gameSubmissionForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (!rom.currentUser) {
            alert('Please log in to submit a game');
            rom.loadModule('auth');
            return;
        }
        
        // Collect form data
        const gameData = {
            title: document.getElementById('gameTitle').value.trim(),
            releaseYear: document.getElementById('releaseYear').value || null,
            description: document.getElementById('description').value.trim(),
            maxPlayers: parseInt(document.getElementById('maxPlayers').value),
            genre: Array.from(document.getElementById('genre').selectedOptions).map(opt => opt.value),
            platforms: Array.from(document.querySelectorAll('input[name="platform"]:checked')).map(cb => cb.value),
            communityLink: document.getElementById('communityLink').value.trim() || null,
            submitterContact: document.getElementById('submitterContact').value.trim() || null,
            additionalNotes: document.getElementById('additionalNotes').value.trim() || null,
            submittedBy: rom.currentUser.email,
            submittedAt: new Date().toISOString(),
            status: 'pending', // pending, approved, rejected
            reviewedBy: null,
            reviewedAt: null,
            adminNotes: null
        };
        
        // Collect connection methods
        const methods = [];
        document.querySelectorAll('.connection-method').forEach((methodDiv, index) => {
            const methodData = {
                name: methodDiv.querySelector('[name="methodName"]').value.trim(),
                type: methodDiv.querySelector('[name="connectionType"]').value,
                instructions: methodDiv.querySelector('[name="instructions"]').value.trim() || null,
                serverAddress: methodDiv.querySelector('[name="serverAddress"]').value.trim() || null,
                order: index
            };
            
            if (methodData.name) {
                methods.push(methodData);
            }
        });
        
        gameData.connectionMethods = methods;
        
        // Validate
        if (!gameData.title || !gameData.description || !gameData.maxPlayers) {
            showResult('error', 'Please fill in all required fields (marked with *)');
            return;
        }
        
        if (gameData.platforms.length === 0) {
            showResult('error', 'Please select at least one platform');
            return;
        }
        
        if (methods.length === 0) {
            showResult('error', 'Please add at least one connection method');
            return;
        }
        
        // Show loading
        const submitBtn = document.querySelector('.submit-btn');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Submitting...';
        submitBtn.disabled = true;
        
        try {
            // Save to Supabase (or localStorage for now)
            await saveGameSubmission(gameData);
            
            showResult('success', `
                🎉 Game submitted successfully!
                
                Your submission "${gameData.title}" has been sent for admin review.
                You'll be notified when it's approved or if we need more information.
                
                Thank you for contributing to the ROM community!
            `);
            
            // Reset form
            document.getElementById('gameSubmissionForm').reset();
            document.getElementById('connectionMethods').innerHTML = `
                <div class="connection-method" data-index="0">
                    <div class="form-group">
                        <label class="form-label">Method Name *</label>
                        <input type="text" class="form-input" name="methodName" required 
                               placeholder="e.g., XLink Kai, PSONE, DNS Server">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Connection Type</label>
                        <select class="form-select" name="connectionType">
                            <option value="dns">DNS Server</option>
                            <option value="community">Community Server</option>
                            <option value="vpn">VPN/LAN Tunnel</option>
                            <option value="emulator">Emulator Network</option>
                            <option value="official">Official Servers</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Instructions/Setup Guide</label>
                        <textarea class="form-textarea" name="instructions" rows="3"
                                  placeholder="Brief setup instructions or link to guide..."></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">DNS/Server Address (if applicable)</label>
                        <input type="text" class="form-input" name="serverAddress"
                               placeholder="e.g., 123.456.789.012">
                    </div>
                </div>
            `;
            methodCount = 1;
            
        } catch (error) {
            console.error('Submission failed:', error);
            showResult('error', `Submission failed: ${error.message}`);
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
    
    // Helper function to save submission
    async function saveGameSubmission(gameData) {
        // For now, save to localStorage
        // Later: Save to Supabase table
        const submissions = JSON.parse(localStorage.getItem('rom_game_submissions') || '[]');
        gameData.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        submissions.push(gameData);
        localStorage.setItem('rom_game_submissions', JSON.stringify(submissions));
        
        console.log('Game submission saved:', gameData);
        return gameData;
    }
    
    // Show result message
    function showResult(type, message) {
        const resultDiv = document.getElementById('submitResult');
        resultDiv.className = type === 'success' ? 'success-message' : 'error-message';
        resultDiv.innerHTML = message.replace(/\n/g, '<br>');
        resultDiv.style.display = 'block';
        
        // Scroll to result
        resultDiv.scrollIntoView({ behavior: 'smooth' });
        
        // Auto-hide after 10 seconds
        if (type === 'success') {
            setTimeout(() => {
                resultDiv.style.display = 'none';
            }, 10000);
        }
    }
}

// Execute when loaded
if (typeof window.rom !== 'undefined') {
    initSubmitGame(window.rom);
}
