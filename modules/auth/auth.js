function initAuthModule(rom) {
    console.log('Initializing auth module...');
    
    // Check if already logged in
    if (rom.currentUser) {
        showLoggedInView();
        return;
    }
    
    // Show auth forms
    document.getElementById('authForms').style.display = 'block';
    document.getElementById('loggedInView').style.display = 'none';
    
    // Set up event handlers
    setupAuthHandlers();
    
    function showLoggedInView() {
        document.getElementById('authForms').style.display = 'none';
        document.getElementById('loggedInView').style.display = 'block';
        document.getElementById('userEmailDisplay').textContent = rom.currentUser.email;
    }
    
    function setupAuthHandlers() {
        // Tab switching
        window.switchTab = function(tab) {
            // Update active tab
            document.querySelectorAll('.auth-tab').forEach(t => {
                t.classList.remove('active');
            });
            event.target.classList.add('active');
            
            // Show active form
            document.getElementById('loginForm').classList.remove('active');
            document.getElementById('registerForm').classList.remove('active');
            document.getElementById(tab + 'Form').classList.add('active');
            
            // Clear messages
            clearMessages();
        };
        
        // Login function
        window.login = async function() {
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            
            if (!email || !password) {
                showMessage('loginMessage', 'Please enter email and password', 'error');
                return;
            }
            
            const loginBtn = event.target;
            const originalText = loginBtn.textContent;
            loginBtn.textContent = 'Logging in...';
            loginBtn.disabled = true;
            
            try {
                const { data, error } = await rom.supabase.auth.signInWithPassword({
                    email,
                    password
                });
                
                if (error) throw error;
                
                // Success
                rom.currentUser = data.user;
                showMessage('loginMessage', '✅ Login successful!', 'success');
                
                // Update app state
                setTimeout(() => {
                    rom.renderApp(); // Re-render to show admin button
                    showLoggedInView();
                }, 1000);
                
            } catch (error) {
                console.error('Login error:', error);
                showMessage('loginMessage', `❌ Login failed: ${error.message}`, 'error');
            } finally {
                loginBtn.textContent = originalText;
                loginBtn.disabled = false;
            }
        };
        
        // Register function
        window.register = async function() {
            const username = document.getElementById('registerUsername').value.trim();
            const email = document.getElementById('registerEmail').value.trim();
            const password = document.getElementById('registerPassword').value;
            
            if (!username || !email || !password) {
                showMessage('registerMessage', 'Please fill all fields', 'error');
                return;
            }
            
            if (password.length < 6) {
                showMessage('registerMessage', 'Password must be at least 6 characters', 'error');
                return;
            }
            
            const registerBtn = event.target;
            const originalText = registerBtn.textContent;
            registerBtn.textContent = 'Creating account...';
            registerBtn.disabled = true;
            
            try {
                const { data, error } = await rom.supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { username }
                    }
                });
                
                if (error) throw error;
                
                // Check if email confirmation is required
                if (data.user && data.user.identities && data.user.identities.length === 0) {
                    showMessage('registerMessage', '⚠️ This email is already registered', 'error');
                    return;
                }
                
                showMessage('registerMessage', '✅ Registration successful! Please check your email for confirmation.', 'success');
                
                // Clear form
                document.getElementById('registerUsername').value = '';
                document.getElementById('registerEmail').value = '';
                document.getElementById('registerPassword').value = '';
                
                // Switch to login tab after successful registration
                setTimeout(() => {
                    switchTab('login');
                    document.getElementById('loginEmail').value = email;
                }, 3000);
                
            } catch (error) {
                console.error('Registration error:', error);
                showMessage('registerMessage', `❌ Registration failed: ${error.message}`, 'error');
            } finally {
                registerBtn.textContent = originalText;
                registerBtn.disabled = false;
            }
        };
        
        // Logout function
        window.logout = async function() {
            try {
                await rom.supabase.auth.signOut();
                rom.currentUser = null;
                
                // Show auth forms
                document.getElementById('authForms').style.display = 'block';
                document.getElementById('loggedInView').style.display = 'none';
                
                // Clear forms
                document.getElementById('loginEmail').value = '';
                document.getElementById('loginPassword').value = '';
                
                // Update app state
                rom.renderApp();
                
                showMessage('loginMessage', '✅ Logged out successfully', 'success');
                
            } catch (error) {
                console.error('Logout error:', error);
                showMessage('loginMessage', '❌ Logout failed', 'error');
            }
        };
        
        // Reset password function
        window.resetPassword = async function() {
            const email = prompt('Enter your email to reset password:');
            if (!email) return;
            
            try {
                const { error } = await rom.supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin
                });
                
                if (error) throw error;
                
                alert('✅ Password reset email sent! Check your inbox.');
            } catch (error) {
                console.error('Password reset error:', error);
                alert('❌ Failed to send reset email: ' + error.message);
            }
        };
        
        // Helper functions
        function showMessage(elementId, text, type) {
            const element = document.getElementById(elementId);
            element.textContent = text;
            element.className = `message ${type}`;
            element.style.display = 'block';
        }
        
        function clearMessages() {
            document.querySelectorAll('.message').forEach(msg => {
                msg.style.display = 'none';
            });
        }
        
        // Add enter key support
        document.getElementById('loginEmail').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') login();
        });
        
        document.getElementById('loginPassword').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') login();
        });
        
        document.getElementById('registerPassword').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') register();
        });
    }
}

// Execute when loaded
if (typeof window.rom !== 'undefined') {
    initAuthModule(window.rom);
}
