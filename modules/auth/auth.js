import { supabase, updateAuthUI } from '../../lib/supabase.js';

export function initModule() {
    console.log('🔐 Auth module initialized');
    
    // Set default form
    showAuthForm('login');
    
    // Show login form
    document.getElementById('show-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        showAuthForm('login');
    });
    
    // Show register form
    document.getElementById('show-register')?.addEventListener('click', (e) => {
        e.preventDefault();
        showAuthForm('register');
    });
    
    // Handle form submission
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.addEventListener('submit', handleAuthSubmit);
    }
    
    // Add debug test buttons
    addTestButtons();
}

function showAuthForm(type) {
    const form = document.getElementById('auth-form');
    const submitBtn = document.getElementById('auth-submit-btn');
    const formTitle = document.getElementById('auth-form-title');
    const errorDiv = document.getElementById('auth-error');
    
    // Clear errors
    if (errorDiv) {
        errorDiv.classList.add('hidden');
        errorDiv.textContent = '';
    }
    
    if (form) {
        form.setAttribute('data-type', type);
    }
    
    if (formTitle) {
        formTitle.textContent = type === 'login' ? 'Login' : 'Register';
    }
    
    if (submitBtn) {
        submitBtn.textContent = type === 'login' ? 'Login' : 'Register';
        submitBtn.className = 'w-full px-4 py-2 text-white rounded ' + 
            (type === 'login' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700');
    }
    
    if (form) {
        form.classList.remove('hidden');
    }
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
    if (errorDiv) {
        errorDiv.classList.add('hidden');
        errorDiv.textContent = '';
    }
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';
    }
    
    try {
        let result;
        
        if (type === 'login') {
            console.log('Attempting login for:', email);
            result = await supabase.auth.signInWithPassword({
                email,
                password
            });
        } else {
            console.log('Attempting registration for:', email);
            result = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        created_at: new Date().toISOString()
                    },
                    emailRedirectTo: window.location.origin
                }
            });
        }
        
        console.log('Auth result:', result);
        
        if (result.error) {
            throw result.error;
        }
        
        if (type === 'register') {
            alert('Registration successful! Please check your email to confirm your account.');
        } else {
            alert('Login successful!');
        }
        
        // Update UI and redirect
        await updateAuthUI();
        window.location.hash = '#/home';
        
    } catch (error) {
        console.error('Auth error:', error);
        if (errorDiv) {
            errorDiv.textContent = error.message || 'Authentication failed';
            errorDiv.classList.remove('hidden');
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = type === 'login' ? 'Login' : 'Register';
        }
    }
}

function addTestButtons() {
    // Add test credentials buttons for easy testing
    const form = document.getElementById('auth-form');
    if (form) {
        const testDiv = document.createElement('div');
        testDiv.className = 'mt-4 p-4 bg-gray-800 rounded';
        testDiv.innerHTML = `
            <p class="text-gray-300 mb-2">Test Credentials:</p>
            <button class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded mr-2 text-sm" 
                    onclick="fillTestCredentials('test@example.com', 'testpassword123')">
                Test User
            </button>
            <button class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm" 
                    onclick="fillTestCredentials('admin@example.com', 'admin123')">
                Admin User
            </button>
        `;
        form.parentNode.insertBefore(testDiv, form.nextSibling);
        
        // Add global function
        window.fillTestCredentials = (email, password) => {
            document.getElementById('auth-email').value = email;
            document.getElementById('auth-password').value = password;
            document.getElementById('auth-form').setAttribute('data-type', 'login');
            document.getElementById('auth-form-title').textContent = 'Login';
            document.getElementById('auth-submit-btn').textContent = 'Login';
            document.getElementById('auth-submit-btn').className = 'w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded';
        };
    }
}
