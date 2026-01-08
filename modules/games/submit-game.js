// ADD THESE IMPORTS AT THE VERY TOP OF THE FILE
import { supabase, getCurrentUser } from '../../lib/supabase.js';

function initSubmitGame(rom) {
    console.log('Initializing game submission form...');
    
    let methodCount = 1;
    
    // Check if user is logged in
    if (!rom.currentUser) {
        document.getElementById('loginPrompt').style.display = 'block';
        document.getElementById('submissionForm').style.display = 'none';
        return;
    } else {
        document.getElementById('loginPrompt').style.display = 'none';
        document.getElementById('submissionForm').style.display = 'block';
    }
    
    // Add new connection method
    document.getElementById('addMethodBtn').addEventListener('click', function() {
        const methodsContainer = document.getElementById('connectionMethods');
        const newMethod = document.createElement('div');
        newMethod.className = 'connection-method fade-in';
        newMethod.setAttribute('data-index', methodCount);
        
        newMethod.innerHTML = `
            <div class="method-header">
                <span class="method-number">Connection Method #${methodCount + 1}</span>
                <button type="button" class="remove-method-btn" onclick="removeConnectionMethod(this)">
                    ✕ Remove
                </button>
            </div>
            <div class="form-group">
                <label class="form-label required">Method Name</label>
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
        
        // Show remove button on first method if it's not visible
        const firstMethod = document.querySelector('.connection-method[data-index="0"] .remove-method-btn');
        if (firstMethod && firstMethod.style.display === 'none') {
            firstMethod.style.display = 'block';
        }
    });
    
    // Handle form submission
    document.getElementById('gameSubmissionForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (!rom.currentUser) {
            showResult('error', 'Please log in to submit a game');
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
            submittedByUserId: rom.currentUser.id,
            submittedAt: new Date().toISOString(),
            status: 'pending', // pending, approved, rejected
            reviewedBy: null,
            reviewedAt: null,
            adminNotes: null,
            slug: generateSlug(document.getElementById('gameTitle').value.trim())
        };
        
        // Collect connection methods
        const methods = [];
        document.querySelectorAll('.connection-method').forEach((methodDiv, index) => {
            const methodName = methodDiv.querySelector('[name="methodName"]').value.trim();
            if (!methodName) return; // Skip empty methods
            
            const methodData = {
                name: methodName,
                type: methodDiv.querySelector('[name="connectionType"]').value,
                instructions: methodDiv.querySelector('[name="instructions"]').value.trim() || null,
                serverAddress: methodDiv.querySelector('[name="serverAddress"]').value.trim() || null,
                order: index
            };
            
            methods.push(methodData);
        });
        
        gameData.connectionMethods = methods;
        
        // Validate
        const validation = validateSubmission(gameData, methods);
        if (!validation.valid) {
            showResult('error', validation.message);
            return;
        }
        
        // Show loading
        const submitBtn = document.getElementById('submitButton');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Submitting...';
        submitBtn.disabled = true;
        
        try {
            // Save to localStorage (temporary storage)
            await saveGameSubmission(gameData);
            
            showResult('success', `
                🎉 Game submitted successfully!
                
                <strong>"${gameData.title}"</strong> has been sent for admin review.
                You'll be notified when it's approved or if we need more information.
                
                Thank you for contributing to the ROM community!
            `);
            
            // Reset form after success
            setTimeout(() => {
                resetForm();
                methodCount = 1;
            }, 3000);
            
        } catch (error) {
            console.error('Submission failed:', error);
            showResult('error', `Submission failed: ${error.message}`);
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
    
    // Helper functions
    function generateSlug(title) {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 50);
    }
    
    function validateSubmission(gameData, methods) {
        if (!gameData.title || gameData.title.length < 2) {
            return { valid: false, message: 'Please enter a valid game title (at least 2 characters)' };
        }
        
        if (!gameData.description || gameData.description.length < 20) {
            return { valid: false, message: 'Please provide a detailed description (at least 20 characters)' };
        }
        
        if (!gameData.maxPlayers || gameData.maxPlayers < 2 || gameData.maxPlayers > 256) {
            return { valid: false, message: 'Please enter a valid number of maximum players (2-256)' };
        }
        
        if (gameData.genre.length === 0) {
            return { valid: false, message: 'Please select at least one genre' };
        }
        
        if (gameData.platforms.length === 0) {
            return { valid: false, message: 'Please select at least one platform' };
        }
        
        if (methods.length === 0) {
            return { valid: false, message: 'Please add at least one connection method' };
        }
        
        // Check each method has a name
        for (const method of methods) {
            if (!method.name || method.name.trim().length === 0) {
                return { valid: false, message: 'All connection methods must have a name' };
            }
        }
        
        return { valid: true, message: 'Validation passed' };
    }
    
  async function saveGameSubmission(gameData) {
    console.log('Starting saveGameSubmission with data:', gameData);
    console.log('Supabase client available:', !!rom.supabase);
    
    // Format the data for Supabase schema - match your table columns exactly
    const submissionData = {
        title: gameData.title,
        console: gameData.platforms.join(', '), // Convert array to string
        year: gameData.releaseYear ? parseInt(gameData.releaseYear) : null,
        description: gameData.description,
        notes: gameData.additionalNotes || null,
        file_url: null,
        user_id: gameData.submittedByUserId,
        user_email: gameData.submittedBy,
        connection_method: gameData.connectionMethods.map(m => m.name).join(', '),
        connection_details: JSON.stringify(gameData.connectionMethods),
        multiplayer_type: 'Online', // Fixed value or make this dynamic if you have a field for it
        players_min: 1,
        players_max: parseInt(gameData.maxPlayers),
        servers_available: gameData.connectionMethods.some(m => m.serverAddress) ? true : false,
        server_details: gameData.connectionMethods.filter(m => m.serverAddress).map(m => m.serverAddress).join(', '),
        status: 'pending',
        review_notes: null,
        reviewed_by: null,
        created_at: new Date().toISOString(),
        reviewed_at: null
    };
    
    // Validate that console is not empty (required field)
    if (!submissionData.console || submissionData.console.trim() === '') {
        submissionData.console = 'Unknown'; // Default value to avoid NOT NULL constraint
    }
    
    console.log('Prepared submission data:', submissionData);
    
    try {
        // Save to Supabase
        const { data, error } = await rom.supabase
            .from('game_submissions')
            .insert([submissionData])
            .select();
        
        if (error) {
            console.error('Supabase error details:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            throw new Error(`Database error: ${error.message}`);
        }
        
        console.log('✅ Game submission saved to Supabase:', data);
        
        // Also save to localStorage for backup/local reference
        const submissions = JSON.parse(localStorage.getItem('rom_game_submissions') || '[]');
        submissions.push({
            ...gameData,
            supabase_id: data[0]?.id
        });
        localStorage.setItem('rom_game_submissions', JSON.stringify(submissions));
        
        return data[0];
        
    } catch (error) {
        console.error('Failed to save to Supabase:', error);
        
        // Fallback to localStorage
        console.log('⚠️ Falling back to localStorage...');
        gameData.id = 'sub_' + Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
        const submissions = JSON.parse(localStorage.getItem('rom_game_submissions') || '[]');
        
        const duplicate = submissions.find(sub => 
            sub.title.toLowerCase() === gameData.title.toLowerCase() && 
            sub.submittedByUserId === gameData.submittedByUserId
        );
        
        if (duplicate) {
            throw new Error('You have already submitted this game. Please wait for admin review.');
        }
        
        submissions.push(gameData);
        localStorage.setItem('rom_game_submissions', JSON.stringify(submissions));
        
        console.log('✅ Game submission saved to localStorage (fallback):', gameData);
        return gameData;
    }
}
    
    function showResult(type, message) {
        const resultDiv = document.getElementById('submitResult');
        resultDiv.className = type === 'success' ? 'success-message' : 'error-message';
        resultDiv.innerHTML = message.replace(/\n/g, '<br>');
        resultDiv.style.display = 'block';
        
        // Scroll to result
        resultDiv.scrollIntoView({ behavior: 'smooth' });
        
        // Auto-hide after 10 seconds (error) or 15 seconds (success)
        setTimeout(() => {
            if (resultDiv.style.display === 'block') {
                resultDiv.style.display = 'none';
            }
        }, type === 'success' ? 15000 : 10000);
    }
    
    function resetForm() {
        document.getElementById('gameSubmissionForm').reset();
        
        // Reset connection methods to just one
        document.getElementById('connectionMethods').innerHTML = `
            <div class="connection-method" data-index="0">
                <div class="method-header">
                    <span class="method-number">Connection Method #1</span>
                    <button type="button" class="remove-method-btn" onclick="removeConnectionMethod(this)" style="display: none;">
                        ✕ Remove
                    </button>
                </div>
                <div class="form-group">
                    <label class="form-label required">Method Name</label>
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
        
        // Hide the result message
        document.getElementById('submitResult').style.display = 'none';
    }
    
    // Expose remove method function globally
    window.removeConnectionMethod = function(button) {
        const methodDiv = button.closest('.connection-method');
        if (methodDiv) {
            methodDiv.remove();
            
            // Update method numbers
            updateMethodNumbers();
            
            // Hide remove button on first method if it's the only one left
            const remainingMethods = document.querySelectorAll('.connection-method');
            if (remainingMethods.length === 1) {
                const firstMethodBtn = remainingMethods[0].querySelector('.remove-method-btn');
                if (firstMethodBtn) {
                    firstMethodBtn.style.display = 'none';
                }
            }
        }
    };
    
    function updateMethodNumbers() {
        const methods = document.querySelectorAll('.connection-method');
        methods.forEach((method, index) => {
            const numberSpan = method.querySelector('.method-number');
            if (numberSpan) {
                numberSpan.textContent = `Connection Method #${index + 1}`;
            }
            method.setAttribute('data-index', index);
        });
        methodCount = methods.length;
    }
}

// Execute when loaded
if (typeof window.rom !== 'undefined') {
    initSubmitGame(window.rom);
}
