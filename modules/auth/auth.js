import { supabase, updateAuthUI } from '../../lib/supabase.js';

export async function initModule(rom) {
    console.log('🔐 Auth module initialized');
    
    // 1. Check for Email Verification or Password Reset Links FIRST
    // This runs before rendering forms to catch redirects from email
    await handleEmailLinks(rom);

    // 2. Initialize forms only if we aren't in the middle of a redirect flow
    initAuthForms();
    
    // 3. Show login form by default (unless handleEmailLinks changed the view)
    if (!document.getElementById('auth-message')?.classList.contains('hidden')) {
        // If we showed a success message, keep forms hidden or show login after delay
        setTimeout(() => showAuthForm('login'), 2000);
    } else {
        showAuthForm('login');
    }
}

// --- NEW: Handle Email Verification & Recovery Links ---
async function handleEmailLinks(rom) {
    const hash = window.location.hash;
    const queryParams = new URLSearchParams(hash.split('?')[1]);

    // Check for Supabase Auth Tokens (type=signup, type=recovery, etc.)
    const type = queryParams.get('type');
    const token = queryParams.get('token');

    if (type && token) {
        console.log(`🔗 Detected auth link: ${type}`);
        
        try {
            // Exchange the token for a session
            const { data, error } = await supabase.auth.getSession();
            
            // If session isn't active yet, Supabase usually handles the exchange automatically 
            // upon page load if the URL contains the params, but we force a check here.
            // Actually, the best way is to call getUser which validates the token in the URL
            const { data: userData, error: userError } = await supabase.auth.getUser();

            if (userError) throw userError;

            if (type === 'signup' || type === 'email') {
                showMessage('✅ Email verified successfully! Logging you in...', 'success');
                await updateAuthUI();
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname + '#/auth');
                setTimeout(() => {
                    window.location.hash = '#/home';
                }, 2000);
            } else if (type === 'recovery') {
                showMessage('🔑 Reset link verified! Please enter your new password below.', 'success');
                // Switch to a "New Password" form logic if you had one, 
                // but for now we just let them know they are logged in and can reset in profile
                // OR redirect to a specific reset view if you have one.
                // For now, we'll just log them in so they can change it in settings.
                await updateAuthUI();
                window.history.replaceState({}, document.title, window.location.pathname + '#/auth');
                setTimeout(() => {
                    window.location.hash = '#/profile'; // Send to profile to update pass
                }, 2000);
            }
        } catch (error) {
            console.error('Error processing auth link:', error);
            showMessage('❌ Link expired or invalid. Please try signing up again.', 'error');
        }
    }
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
    
    // Don't clear message if we are in a success state from URL handling
    const msgDiv = document.getElementById('auth-message');
    if (!msgDiv?.textContent.includes('✅') && !msgDiv?.textContent.includes('🔑')) {
        clearMessage();
    }
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
        
        if (error) {
            if (error.message.includes('Email not confirmed')) {
                throw new Error('Please verify your email first. Check your inbox!');
            }
            throw error;
        }
        
        showMessage(`Welcome back!`, 'success');
        setTimeout(async () => {
            await updateAuthUI();
            window.location.hash = '#/home';
        }, 1000);
        
    } catch (error) {
        showMessage(error.message || 'Login failed.', 'error');
    } finally {
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
    
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';
    submitBtn.classList.add('opacity-50');
    
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { username: email.split('@')[0] },
                // Ensure this matches your Site URL in Supabase Dashboard
                emailRedirectTo: `${window.location.origin}/#/auth` 
            }
        });
        
        if (error) throw error;
        
        if (data.user?.identities?.length === 0) {
            throw new Error('Email already registered. Try logging in.');
        }
        
        showMessage('✅ Account created! Please check your email to verify.', 'success');
        
        // Optional: Show resend button logic here if needed
        
    } catch (error) {
        showMessage(error.message || 'Registration failed.', 'error');
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
            redirectTo: `${window.location.origin}/#/auth`, // Crucial: Must point back to auth module
        });
        
        if (error) throw error;
        
        showMessage('📧 Reset link sent! Check your email.', 'success');
        setTimeout(() => showAuthForm('login'), 3000);
        
    } catch (error) {
        showMessage(error.message || 'Failed to send reset email.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        submitBtn.classList.remove('opacity-50');
    }
}

function showMessage(text, type = 'info') {
    const messageDiv = document.getElementById('auth-message');
    if (!messageDiv) return;
    
    let bgColor = 'bg-gray-700';
    let textColor = 'text-white';
    
    if (type === 'error') { bgColor = 'bg-red-900'; textColor = 'text-red-200'; }
    else if (type === 'success') { bgColor = 'bg-green-900'; textColor = 'text-green-200'; }
    else if (type === 'info') { bgColor = 'bg-cyan-900'; textColor = 'text-cyan-200'; }
    
    messageDiv.innerHTML = text;
    messageDiv.className = `${bgColor} ${textColor} p-3 rounded text-center`;
    messageDiv.classList.remove('hidden');
}

function clearMessage() {
    const messageDiv = document.getElementById('auth-message');
    if (messageDiv) {
        messageDiv.classList.add('hidden');
        messageDiv.textContent = '';
    }
}

// Helper for template if needed
window.resendConfirmation = async function(email) {
    // Implementation similar to before
};
