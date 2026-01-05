console.log('🔥 DEBUG: Auth JS loaded');

// Simple test to see if this file loads
alert('Auth JS loaded - buttons should work now!');

function initAuthModule(rom) {
    console.log('🔥 DEBUG: initAuthModule called');
    console.log('🔥 DEBUG: rom.supabase exists?', !!rom.supabase);
    
    // Make rom globally available
    window.rom = rom;
    
    // SIMPLE TEST - add this to every button
    document.addEventListener('click', function(e) {
        console.log('🔥 DEBUG: Clicked:', e.target.className, e.target.id);
        
        if (e.target.className.includes('auth-btn')) {
            console.log('🔥 DEBUG: Auth button clicked!');
            e.target.style.background = 'red'; // Visual feedback
        }
        
        if (e.target.className.includes('auth-tab')) {
            console.log('🔥 DEBUG: Tab clicked');
            e.target.style.background = 'blue'; // Visual feedback
        }
    });
    
    // Force buttons to work - add direct event listeners
    setTimeout(() => {
        console.log('🔥 DEBUG: Setting up button listeners...');
        
        // Login button
        const loginBtn = document.getElementById('loginButton');
        if (loginBtn) {
            console.log('🔥 DEBUG: Found login button');
            loginBtn.addEventListener('click', function() {
                console.log('🔥 DEBUG: Login clicked!');
                alert('Login button works!');
                
                // Try to login with test credentials
                const email = document.getElementById('loginEmail')?.value || 'test@test.com';
                const password = document.getElementById('loginPassword')?.value || 'password123';
                
                console.log('🔥 DEBUG: Attempting login with:', email);
                
                rom.supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                }).then(response => {
                    console.log('🔥 DEBUG: Login response:', response);
                    if (response.error) {
                        alert('Login error: ' + response.error.message);
                    } else {
                        alert('✅ Login successful!');
                        rom.currentUser = response.data.user;
                        rom.renderApp();
                    }
                }).catch(error => {
                    console.error('🔥 DEBUG: Login catch error:', error);
                    alert('Login failed: ' + error.message);
                });
            });
        }
        
        // Register button
        const registerBtn = document.getElementById('registerButton');
        if (registerBtn) {
            registerBtn.addEventListener('click', function() {
                alert('Register button works!');
                console.log('🔥 DEBUG: Register clicked');
            });
        }
        
        // Logout button
        const logoutBtn = document.getElementById('logoutButton');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function() {
                alert('Logout button works!');
                console.log('🔥 DEBUG: Logout clicked');
                
                rom.supabase.auth.signOut().then(() => {
                    rom.currentUser = null;
                    rom.renderApp();
                    alert('✅ Logged out');
                });
            });
        }
        
        // Tabs
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                console.log('🔥 DEBUG: Tab clicked:', this.textContent);
                this.style.border = '3px solid yellow';
                
                // Switch forms
                const tabName = this.textContent.toLowerCase();
                document.getElementById('loginForm').classList.remove('active');
                document.getElementById('registerForm').classList.remove('active');
                document.getElementById(tabName + 'Form').classList.add('active');
            });
        });
        
        console.log('🔥 DEBUG: Button setup complete');
    }, 1000);
}

// Try to initialize
setTimeout(() => {
    if (window.rom) {
        console.log('🔥 DEBUG: ROM found, initializing auth');
        initAuthModule(window.rom);
    } else {
        console.error('🔥 DEBUG: ROM not found after timeout');
        alert('ROM not loaded - check console');
    }
}, 2000);
