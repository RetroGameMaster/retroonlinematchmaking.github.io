import { supabase, updateAuthUI } from '../../lib/supabase.js';

export function initModule() {
    console.log('🔐 Auth module initialized');
    
    // Initialize all auth forms
    initAuthForms();
    
    // Show login form by default
    showAuthForm('login');
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
}

function showAuthForm(formType) {
    // Update tabs
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
    
    // Clear messages
    clearMessage();
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const submitBtn = document.getElementById('login-submit');
    const rememberMe = document.getElementById('remember-me').checked;
    
    // Validate
    if (!email || !password) {
        showMessage('Please fill in all fields', 'error');
        return;
    }
    
    // Disable button and show loading
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';
    submitBtn.classList.add('opacity-50');
    
    try {
        console.log('Attempting login for:', email);
        
        // Sign in with Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) {
            // Handle specific errors
            if (error.message.includes('Invalid login credentials')) {
                throw new Error('Invalid email or password');
            } else if (error.message.includes('Email not confirmed')) {
                throw new Error('Please confirm your email address first. Check your inbox.');
            } else {
                throw error;
            }
        }
        
        // Successful login
        console.log('Login successful:', data.user.email);
        
        // Show success message
        showMessage(`Welcome back, ${data.user.email}!`, 'success');
        
        // Update UI and redirect after a moment
        setTimeout(async () => {
            await updateAuthUI();
            window.location.hash = '#/home';
        }, 1500);
        
    } catch (error) {
        console.error('Login error:', error);
        showMessage(error.message || 'Login failed. Please try again.', 'error');
    } finally {
        // Restore button
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        submitBtn.classList.remove('opacity-50');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm').value;
    const submitBtn = document.getElementById('register-submit');
    
    // Validate
    if (!email || !password || !confirmPassword) {
        showMessage('Please fill in all fields', 'error');
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
        console.log('Attempting registration for:', email);
        
        // Register with Supabase
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    created_at: new Date().toISOString(),
                    username: email.split('@')[0]
                },
                emailRedirectTo: `${window.location.origin}#/auth?verified=true`
            }
        });
        
        if (error) {
            // Handle specific errors
            if (error.message.includes('already registered')) {
                throw new Error('Email already registered. Try logging in instead.');
            } else if (error.message.includes('weak password')) {
                throw new Error('Password is too weak. Please use a stronger password.');
            } else {
                throw error;
            }
        }
        
        // Check if email confirmation is required
        if (data.user?.identities?.length === 0) {
            // Email already exists
            showMessage('Email already registered. Try logging in instead.', 'error');
            return;
        }
        
        // Registration successful
        console.log('Registration successful:', data);
        
        if (data.user?.confirmed_at) {
            // User is already confirmed (might be from social auth)
            showMessage('Account created successfully! Redirecting...', 'success');
            setTimeout(async () => {
                await updateAuthUI();
                window.location.hash = '#/home';
            }, 2000);
        } else {
            // Email confirmation required
            showMessage(
                'Account created! Please check your email to confirm your address. Check spam folder too!',
                'success'
            );
            
            // Show a resend button
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
        showMessage(error.message || 'Registration failed. Please try again.', 'error');
    } finally {
        // Restore button
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        submitBtn.classList.remove('opacity-50');
    }
}

async function handleForgotPassword(e) {
    e.preventDefault();
    
    const email = document.getElementById('forgot-email').value;
    const submitBtn = document.getElementById('forgot-submit');
    
    // Validate
    if (!email) {
        showMessage('Please enter your email address', 'error');
        return;
    }
    
    // Disable button and show loading
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    submitBtn.classList.add('opacity-50');
    
    try {
        console.log('Sending password reset for:', email);
        
        // Send reset email
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}#/auth?reset=true`,
        });
        
        if (error) {
            // Handle specific errors
            if (error.message.includes('rate limit')) {
                throw new Error('Too many attempts. Please try again later.');
            } else {
                throw error;
            }
        }
        
        // Success
        console.log('Reset email sent:', data);
        showMessage(
            'Password reset link sent! Check your email (and spam folder).',
            'success'
        );
        
        // Clear form
        document.getElementById('forgot-email').value = '';
        
        // Auto-switch back to login after a delay
        setTimeout(() => {
            showAuthForm('login');
        }, 3000);
        
    } catch (error) {
        console.error('Password reset error:', error);
        showMessage(error.message || 'Failed to send reset email. Please try again.', 'error');
    } finally {
        // Restore button
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        submitBtn.classList.remove('opacity-50');
    }
}

// Helper function to show messages
function showMessage(text, type = 'info') {
    const messageDiv = document.getElementById('auth-message');
    if (!messageDiv) return;
    
    // Set colors based on type
    let bgColor = 'bg-gray-700';
    let textColor = 'text-white';
    
    if (type === 'error') {
        bgColor = 'bg-red-900';
        textColor = 'text-red-200';
    } else if (type === 'success') {
        bgColor = 'bg-green-900';
        textColor = 'text-green-200';
    } else if (type === 'info') {
        bgColor = 'bg-cyan-900';
        textColor = 'text-cyan-200';
    }
    
    messageDiv.innerHTML = text;
    messageDiv.className = `${bgColor} ${textColor} p-3 rounded text-center`;
    messageDiv.classList.remove('hidden');
    
    // Auto-hide non-error messages after 5 seconds
    if (type !== 'error') {
        setTimeout(() => {
            messageDiv.classList.add('hidden');
        }, 5000);
    }
}

// Helper function to clear messages
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

// Handle password reset from URL
function handleResetFromURL() {
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    
    if (urlParams.has('reset') && urlParams.get('reset') === 'true') {
        showMessage('Password reset successful! You can now login with your new password.', 'success');
    }
    
    if (urlParams.has('verified') && urlParams.get('verified') === 'true') {
        showMessage('Email verified successfully! You can now login.', 'success');
    }
}

// Initialize URL handlers
document.addEventListener('DOMContentLoaded', handleResetFromURL);
