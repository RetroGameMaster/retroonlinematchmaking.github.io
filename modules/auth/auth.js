import { supabase, updateAuthUI } from '../../lib/supabase.js';

export function initAuthModule() {
    console.log('Auth module initialized');
    
    // Show login form
    document.getElementById('show-login')?.addEventListener('click', () => {
        showAuthForm('login');
    });
    
    // Show register form
    document.getElementById('show-register')?.addEventListener('click', () => {
        showAuthForm('register');
    });
    
    // Handle form submission
    document.getElementById('auth-form')?.addEventListener('submit', handleAuthSubmit);
    
    // Update UI initially
    updateAuthUI();
}

function showAuthForm(type) {
    const form = document.getElementById('auth-form');
    const submitBtn = document.getElementById('auth-submit-btn');
    const formTitle = document.getElementById('auth-form-title');
    
    form.setAttribute('data-type', type);
    
    if (type === 'login') {
        formTitle.textContent = 'Login';
        submitBtn.textContent = 'Login';
        submitBtn.className = 'w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded';
    } else {
        formTitle.textContent = 'Register';
        submitBtn.textContent = 'Register';
        submitBtn.className = 'w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded';
    }
    
    form.classList.remove('hidden');
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const type = form.getAttribute('data-type');
    const email = form.email.value;
    const password = form.password.value;
    const submitBtn = document.getElementById('auth-submit-btn');
    const errorDiv = document.getElementById('auth-error');
    
    // Clear previous errors
    errorDiv.classList.add('hidden');
    errorDiv.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
    
    try {
        let result;
        
        if (type === 'login') {
            result = await supabase.auth.signInWithPassword({
                email,
                password
            });
        } else {
            result = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        created_at: new Date().toISOString()
                    }
                }
            });
        }
        
        if (result.error) {
            throw result.error;
        }
        
        if (type === 'register' && result.data?.user) {
            alert('Registration successful! Please check your email to confirm your account.');
        }
        
        // Close form and refresh UI
        form.classList.add('hidden');
        form.reset();
        updateAuthUI();
        
    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = type === 'login' ? 'Login' : 'Register';
    }
}
