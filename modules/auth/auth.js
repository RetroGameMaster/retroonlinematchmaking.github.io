function initAuthModule(rom) {
    console.log('✅ Auth module loading...');
    
    // Check if already logged in
    if (rom.currentUser) {
        showLoggedIn();
        return;
    }
    
    // Show auth forms
    document.getElementById('authForms').style.display = 'block';
    document.getElementById('loggedInView').style.display = 'none';
    
    // Set up tabs
    const tabs = document.querySelectorAll('.auth-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            // Update tabs
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Show correct form
            document.getElementById('loginForm').classList.remove('active');
            document.getElementById('registerForm').classList.remove('active');
            document.getElementById(tabName + 'Form').classList.add('active');
        });
    });
    
    // Login button
    document.getElementById('loginButton').addEventListener('click', async function() {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        
        if (!email || !password) {
            alert('Please enter email and password');
            return;
        }
        
        this.textContent = 'Logging in...';
        this.disabled = true;
        
        try {
            const { data, error } = await rom.supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
            rom.currentUser = data.user;
            alert('✅ Login successful!');
            
            // Update UI
            rom.renderApp();
            showLoggedIn();
            
        } catch (error) {
            console.error('Login error:', error);
            alert('❌ Login failed: ' + error.message);
        } finally {
            this.textContent = 'Login';
            this.disabled = false;
        }
    });
    
    // Register button
    document.getElementById('registerButton').addEventListener('click', async function() {
        const username = document.getElementById('registerUsername').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        
        if (!username || !email || !password) {
            alert('Please fill all fields');
            return;
        }
        
        if (password.length < 6) {
            alert('Password must be at least 6 characters');
            return;
        }
        
        this.textContent = 'Creating account...';
        this.disabled = true;
        
        try {
            const { data, error } = await rom.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { username }
                }
            });
            
            if (error) throw error;
            
            alert('✅ Registration successful! Check your email.');
            
            // Clear form
            document.getElementById('registerUsername').value = '';
            document.getElementById('registerEmail').value = '';
            document.getElementById('registerPassword').value = '';
            
            // Switch to login tab
            tabs[0].click();
            document.getElementById('loginEmail').value = email;
            
        } catch (error) {
            console.error('Registration error:', error);
            alert('❌ Registration failed: ' + error.message);
        } finally {
            this.textContent = 'Create Account';
            this.disabled = false;
        }
    });
    
    // Logout button
    document.getElementById('logoutButton').addEventListener('click', async function() {
        try {
            await rom.supabase.auth.signOut();
            rom.currentUser = null;
            rom.renderApp();
            
            // Show auth forms
            document.getElementById('authForms').style.display = 'block';
            document.getElementById('loggedInView').style.display = 'none';
            
            alert('✅ Logged out');
            
        } catch (error) {
            console.error('Logout error:', error);
            alert('❌ Logout failed');
        }
    });
    
    // Reset password link
    document.getElementById('resetPasswordLink').addEventListener('click', function() {
        const email = prompt('Enter your email to reset password:');
        if (!email) return;
        
        rom.supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin
        }).then(() => {
            alert('✅ Password reset email sent! Check your inbox.');
        }).catch(error => {
            alert('❌ Failed to send reset email: ' + error.message);
        });
    });
    
    // Helper function
    function showLoggedIn() {
        document.getElementById('authForms').style.display = 'none';
        document.getElementById('loggedInView').style.display = 'block';
        if (rom.currentUser) {
            document.getElementById('userEmailDisplay').textContent = rom.currentUser.email;
        }
    }
}

// Run when loaded
if (typeof window.rom !== 'undefined') {
    initAuthModule(window.rom);
}
