// Authentication Module
export default async function() {
    return `
        <div class="auth-module">
            <h2>🔐 Authentication</h2>
            
            <div class="auth-tabs">
                <button class="tab-btn active" data-tab="login">Login</button>
                <button class="tab-btn" data-tab="register">Register</button>
            </div>
            
            <div class="tab-content">
                <div id="login-form" class="tab-pane active">
                    <form id="loginForm">
                        <input type="email" placeholder="Email" required>
                        <input type="password" placeholder="Password" required>
                        <button type="submit" class="auth-btn">Login</button>
                    </form>
                </div>
                
                <div id="register-form" class="tab-pane">
                    <form id="registerForm">
                        <input type="text" placeholder="Username" required>
                        <input type="email" placeholder="Email" required>
                        <input type="password" placeholder="Password (min 6 chars)" required>
                        <button type="submit" class="auth-btn">Register</button>
                    </form>
                </div>
            </div>
        </div>
        
        <style>
            .auth-tabs {
                display: flex;
                gap: 10px;
                margin: 20px 0;
            }
            
            .tab-btn {
                flex: 1;
                padding: 10px;
                background: rgba(0, 255, 255, 0.1);
                border: 1px solid var(--primary);
                color: var(--primary);
                border-radius: 4px;
                cursor: pointer;
            }
            
            .tab-btn.active {
                background: rgba(0, 255, 255, 0.3);
            }
            
            .tab-pane {
                display: none;
                padding: 20px 0;
            }
            
            .tab-pane.active {
                display: block;
            }
            
            .auth-module input {
                width: 100%;
                padding: 12px;
                margin: 10px 0;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid var(--primary);
                color: white;
                border-radius: 6px;
                font-family: 'Orbitron', sans-serif;
            }
            
            .auth-btn {
                width: 100%;
                padding: 12px;
                background: linear-gradient(180deg, #00d7ff, #00a8bf);
                border: none;
                color: #000;
                font-weight: bold;
                border-radius: 6px;
                cursor: pointer;
                margin-top: 10px;
                font-family: 'Orbitron', sans-serif;
            }
        </style>
    `;
}

export async function init(app) {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab');
            
            // Update active tab button
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Show selected tab content
            document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
            document.getElementById(`${tab}-form`).classList.add('active');
        });
    });
    
    // Login form
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target[0].value;
        const password = e.target[1].value;
        
        try {
            const { data, error } = await app.supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
            alert('Login successful!');
            app.user = data.user;
            app.loadModule('dashboard');
            
        } catch (error) {
            alert(`Login failed: ${error.message}`);
        }
    });
    
    // Register form
    document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target[0].value;
        const email = e.target[1].value;
        const password = e.target[2].value;
        
        if (password.length < 6) {
            alert('Password must be at least 6 characters');
            return;
        }
        
        try {
            const { data, error } = await app.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { username }
                }
            });
            
            if (error) throw error;
            
            alert('Registration successful! Check your email for confirmation.');
            
        } catch (error) {
            alert(`Registration failed: ${error.message}`);
        }
    });
}
