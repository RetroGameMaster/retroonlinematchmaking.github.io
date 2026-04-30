import { supabase, updateAuthUI } from '../../lib/supabase.js';

export async function initModule() {
    console.log('🔐 Auth module initialized');
    
    // 1. CRITICAL: Check for Auth Response (Verification/Reset) FIRST
    const handled = await handleAuthResponse();

    // 2. Initialize forms only after checking response
    initAuthForms();
    
    // 3. Show appropriate form
    // If handleAuthResponse didn't redirect or show a success state, show login
    if (!handled) {
        showAuthForm('login');
    }
    // If handled (e.g., recovery), the handler already switched the view
}

async function handleAuthResponse() {
    // Supabase puts tokens in the hash fragment: #/auth?access_token=...&type=email
    const hash = window.location.hash;
    
    if (!hash || !hash.includes('access_token')) {
        return false; // No auth response detected
    }

    console.log('🔍 Detected auth response in URL:', hash);

    try {
        // This tells Supabase to parse the hash and set the session
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (data.session) {
            // Determine what happened based on the 'type' param in the hash
            const urlParams = new URLSearchParams(hash.split('?')[1]);
            const type = urlParams.get('type');

            if (type === 'email') {
                showMessage('✅ Email confirmed successfully! You are now logged in.', 'success');
                // Clean URL
                window.history.replaceState(null, '', window.location.pathname + '#/auth');
                
                // Redirect to home after short delay
                setTimeout(() => {
                    window.location.hash = '#/home';
                }, 2000);
                return true;
            } 
            else if (type === 'recovery') {
                showMessage('✅ Password reset link verified. Please enter your new password below.', 'success');
                // Clean URL but stay on auth page to let them reset
                window.history.replaceState(null, '', window.location.pathname + '#/auth');
                
                // Switch to the "New Password" form
                showResetPasswordForm();
                return true;
            }
        }
    } catch (error) {
        console.error('Error processing auth response:', error);
        showMessage('❌ Verification failed: ' + error.message, 'error');
    }
    
    return false;
}

function initAuthForms() {
    // Tab buttons
    document.getElementById('show-login')?.addEventListener('click', () => showAuthForm('login'));
    document.getElementById('show-register')?.addEventListener('click', () => showAuthForm('register'));
    document.getElementById('show-forgot')?.addEventListener('click', () => showAuthForm('forgot'));
    
    // Switch buttons inside forms
    document.getElementById('switch-to-register')?.addEventListener('click', () => showAuthForm('register'));
    document.getElementById('switch-to-login')?.addEventListener('click', () => showAuthForm('login'));
    document.getElementById('switch-to-login-2')?.addEventListener('click', () => showAuthForm('login'));
    document.getElementById('show-forgot-btn')?.addEventListener('click', () => showAuthForm('forgot'));
    
    // Form submissions
    document.getElementById('login-form')?.addEventListener('submit', handleLogin);
    document.getElementById('register-form')?.addEventListener('submit', handleRegister);
    document.getElementById('forgot-form')?.addEventListener('submit', handleForgotPassword);
    
    // NEW: Reset Password Form Submission
    document.getElementById('reset-password-form')?.addEventListener('submit', handleResetPassword);
}

function showAuthForm(formType) {
    // Update tabs (Login, Register, Forgot)
    ['login', 'register', 'forgot'].forEach(type => {
        const tab = document.getElementById(`show-${type}`);
        const form = document.getElementById(`${type}-form`);
        
        if (tab) {
            if (type === formType) {
                tab.classList.add('auth-tab-active');
                tab.classList.remove('text-gray-400');
                tab.classList.add('text-white');
            } else {
                tab.classList.remove('auth-tab-active');
                tab.classList.add('text-gray-400');
                tab.classList.remove('text-white');
            }
        }
        
        if (form) {
            form.classList.toggle('hidden', type !== formType);
        }
    });

    // Handle the special Reset Form (no tab for this one)
    const resetForm = document.getElementById('reset-password-form');
    if (resetForm) {
        if (formType === 'reset') {
            resetForm.classList.remove('hidden');
            // Hide tabs when showing reset form
            ['login', 'register', 'forgot'].forEach(t => {
                const tTab = document.getElementById(`show-${t}`);
                if(tTab) tTab.classList.add('hidden');
            });
        } else {
            resetForm.classList.add('hidden');
            // Show tabs again
            ['login', 'register', 'forgot'].forEach(t => {
                const tTab = document.getElementById(`show-${t}`);
                if(tTab) tTab.classList.remove('hidden');
            });
        }
    }
    
    // Don't clear message if we just verified email or reset password
    const msgDiv = document.getElementById('auth-message');
    const safeText = msgDiv?.innerText || '';
    if (!safeText.includes('confirmed') && !safeText.includes('reset')) {
        clearMessage();
    }
}

// NEW: Helper to show Reset Form specifically
function showResetPasswordForm() {
    showAuthForm('reset');
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const submitBtn = document.getElementById('login-submit');
    
    if (!email || !password) {
        showMessage('Please fill in all fields', 'error');
        return;
    }
    
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';
    submitBtn.classList.add('opacity-50');
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) throw error;
        
        showMessage(`Welcome back!`, 'success');
        setTimeout(async () => {
            await updateAuthUI();
            window.location.hash = '#/home';
        }, 1000);
        
    } catch (error) {
        console.error('Login error:', error);
        if (error.message.includes('Email not confirmed')) {
            showMessage('Please verify your email first. Check your inbox!', 'error');
        } else {
            showMessage(error.message || 'Login failed.', 'error');
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        submitBtn.classList.remove('opacity-50');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const email = document.getElementById('register-email').value;
    const usernameInput = document.getElementById('register-username');
    const username = usernameInput ? usernameInput.value.trim() : email.split('@')[0]; // Fallback if input missing
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm').value;
    const submitBtn = document.getElementById('register-submit');
    
    // Validate
    if (!email || !password || !confirmPassword) {
        showMessage('Please fill in all fields', 'error');
        return;
    }

    // Username Validation
    if (username.length < 3) {
        showMessage('Username must be at least 3 characters', 'error');
        return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        showMessage('Username can only contain letters, numbers, and underscores', 'error');
        return;
    }
    
    if (password.length < 6) {
        showMessage('Password must be at least 6 characters', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showMessage('Passwords do not match', 'error');
        return;
    }
    
    // Disable button and show loading
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';
    submitBtn.classList.add('opacity-50');
    
    try {
        console.log('Attempting registration for:', email, 'with username:', username);
        
        // Register with Supabase - PASSING USERNAME IN METADATA
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: username, // Send chosen username
                    created_at: new Date().toISOString()
                },
                emailRedirectTo: `${window.location.origin}#/auth?verified=true`
            }
        });
        
        if (error) {
            if (error.message.includes('already registered')) {
                throw new Error('Email already registered. Try logging in instead.');
            } else if (error.message.includes('weak password')) {
                throw new Error('Password is too weak.');
            } else {
                throw error;
            }
        }
        
        // Check if email confirmation is required
        if (data.user?.identities?.length === 0) {
            showMessage('Email already registered. Try logging in instead.', 'error');
            return;
        }
        
        console.log('Registration successful:', data);
        
        if (data.user?.confirmed_at) {
            showMessage('Account created successfully! Redirecting...', 'success');
            setTimeout(async () => {
                await updateAuthUI();
                window.location.hash = '#/home';
            }, 2000);
        } else {
            showMessage(
                'Account created! Please check your email to confirm your address.',
                'success'
            );
            
            // Show resend button logic
            setTimeout(() => {
                const messageDiv = document.getElementById('auth-message');
                if (messageDiv) {
                    messageDiv.innerHTML += `
                        <button onclick="resendConfirmation('${email}')" 
                                class="mt-2 text-sm bg-cyan-600 hover:bg-cyan-700 text-white py-1 px-3 rounded">
                            Resend confirmation email
                        </button>
                    `;
                }
            }, 500);
        }
        
    } catch (error) {
        console.error('Registration error:', error);
        // Handle Unique Username Error from DB Trigger if it bubbles up
        if (error.code === '23505' || error.message.includes('unique')) {
            showMessage('That username is already taken! Please try another.', 'error');
        } else {
            showMessage(error.message || 'Registration failed.', 'error');
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        submitBtn.classList.remove('opacity-50');
    }
}

async function handleForgotPassword(e) {
    e.preventDefault();
    
    const email = document.getElementById('forgot-email').value;
    const submitBtn = document.getElementById('forgot-submit');
    
    if (!email) {
        showMessage('Please enter your email', 'error');
        return;
    }
    
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    submitBtn.classList.add('opacity-50');
    
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/#/auth`, // Crucial: Point to auth page
        });
        
        if (error) throw error;
        
        showMessage('✅ Reset link sent! Check your email.', 'success');
        setTimeout(() => showAuthForm('login'), 3000);
        
    } catch (error) {
        console.error('Reset error:', error);
        showMessage(error.message || 'Failed to send reset link.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        submitBtn.classList.remove('opacity-50');
    }
}

// NEW: Handle Actual Password Reset
async function handleResetPassword(e) {
    e.preventDefault();
    const newPassword = document.getElementById('reset-new-password').value;
    const confirmPassword = document.getElementById('reset-confirm-password').value;
    const submitBtn = document.getElementById('reset-submit');

    if (!newPassword || !confirmPassword) {
        showMessage('Please fill in all fields', 'error');
        return;
    }
    if (newPassword.length < 6) {
        showMessage('Password must be at least 6 characters', 'error');
        return;
    }
    if (newPassword !== confirmPassword) {
        showMessage('Passwords do not match', 'error');
        return;
    }

    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Updating...';

    try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;

        showMessage('✅ Password updated! Logging you in...', 'success');
        setTimeout(async () => {
            await updateAuthUI();
            window.location.hash = '#/home';
        }, 2000);
    } catch (error) {
        console.error('Update error:', error);
        showMessage(error.message || 'Failed to update password.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

function showMessage(text, type = 'info') {
    const messageDiv = document.getElementById('auth-message');
    if (!messageDiv) return;
    
    let bgColor = 'bg-gray-700';
    let textColor = 'text-white';
    
    if (type === 'error') { bgColor = 'bg-red-900'; textColor = 'text-red-200'; }
    else if (type === 'success') { bgColor = 'bg-green-900'; textColor = 'text-green-200'; }
    
    messageDiv.innerHTML = text;
    messageDiv.className = `${bgColor} ${textColor} p-3 rounded text-center transition-all duration-300`;
    messageDiv.classList.remove('hidden');
}

function clearMessage() {
    const messageDiv = document.getElementById('auth-message');
    if (messageDiv) {
        messageDiv.classList.add('hidden');
        messageDiv.textContent = '';
    }
}

// Resend confirmation email
window.resendConfirmation = async function(email) {
    try {
        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email,
            options: {
                emailRedirectTo: `${window.location.origin}#/auth?verified=true`
            }
        });
        
        if (error) throw error;
        
        showMessage('Confirmation email resent! Check your inbox.', 'success');
    } catch (error) {
        console.error('Resend error:', error);
        showMessage('Failed to resend confirmation email.', 'error');
    }
};
