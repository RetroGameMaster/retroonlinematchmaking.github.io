// ROM Main Application
import { initSupabase } from './lib/supabase.js';

class ROMApp {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this.currentModule = 'home';
    }
    
    async init() {
        console.log('🚀 ROM App Initializing...');
        
        // Initialize Supabase
        this.supabase = initSupabase();
        if (!this.supabase) {
            this.showError('Supabase failed to initialize. Check console.');
            return;
        }
        
        // Check auth
        await this.checkAuth();
        
        // Render the app
        this.renderApp();
        
        // Load initial module
        await this.loadModule('home');
        
        console.log('✅ ROM App Ready');
    }
    
    async checkAuth() {
        try {
            const { data: { user } } = await this.supabase.auth.getUser();
            this.currentUser = user;
            console.log('Auth status:', user ? 'Logged in' : 'Guest');
        } catch (error) {
            console.error('Auth check failed:', error);
        }
    }
    
    renderApp() {
        document.getElementById('rom-app').innerHTML = `
            <div class="rom-container">
                <!-- Header -->
                <header class="rom-header">
                    <div class="logo" onclick="rom.loadModule('home')" style="cursor: pointer;">
                        🎮 ROM
                    </div>
                    <nav class="rom-nav" id="rom-nav">
                        <!-- Navigation will be populated by modules -->
                    </nav>
                    <div class="user-info" id="user-info">
                        ${this.currentUser ? `
                            <span class="user-email">${this.currentUser.email}</span>
                            <button class="logout-btn" onclick="rom.logout()">Logout</button>
                        ` : `
                            <button class="login-btn" onclick="rom.loadModule('auth')">Login</button>
                        `}
                    </div>
                </header>
                
                <!-- Main Content -->
                <main class="rom-main">
                    <div id="module-content">
                        <!-- Module content loads here -->
                    </div>
                </main>
                
                <!-- Footer -->
                <footer class="rom-footer">
                    <p>© 2025 ROM - Modular Architecture</p>
                </footer>
            </div>
            
            <style>
                .rom-container {
                    max-width: 1200px;
                    margin: 0 auto;
                }
                
                .rom-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px;
                    background: rgba(0, 30, 60, 0.9);
                    border-bottom: 2px solid #00ffff;
                    border-radius: 0 0 15px 15px;
                    margin-bottom: 30px;
                }
                
                .logo {
                    font-size: 2.5rem;
                    font-weight: bold;
                    color: #00ffff;
                    text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
                }
                
                .rom-nav {
                    display: flex;
                    gap: 15px;
                }
                
                .nav-btn {
                    background: rgba(0, 255, 255, 0.1);
                    border: 1px solid #00ffff;
                    color: #00ffff;
                    padding: 10px 20px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-family: 'Orbitron', sans-serif;
                    transition: all 0.3s;
                }
                
                .nav-btn:hover,
                .nav-btn.active {
                    background: rgba(0, 255, 255, 0.3);
                    transform: translateY(-2px);
                }
                
                .user-info {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }
                
                .user-email {
                    color: #a8dfe8;
                    font-size: 0.9rem;
                }
                
                .login-btn,
                .logout-btn {
                    padding: 8px 16px;
                    background: rgba(255, 51, 204, 0.2);
                    border: 1px solid #ff33cc;
                    color: #ff33cc;
                    border-radius: 6px;
                    cursor: pointer;
                    font-family: 'Orbitron', sans-serif;
                }
                
                .rom-main {
                    min-height: 500px;
                    padding: 20px;
                }
                
                .rom-footer {
                    text-align: center;
                    padding: 20px;
                    margin-top: 40px;
                    color: #a8dfe8;
                    border-top: 1px solid rgba(0, 255, 255, 0.2);
                }
            </style>
        `;
    }
    
    async loadModule(moduleName) {
        console.log(`📦 Loading module: ${moduleName}`);
        this.currentModule = moduleName;
        
        // Update active nav button
        this.updateNavigation();
        
        // Show loading state
        document.getElementById('module-content').innerHTML = `
            <div class="loading-module">
                <div style="text-align: center; padding: 50px;">
                    <div style="font-size: 3rem; margin-bottom: 20px;">⌛</div>
                    Loading ${moduleName}...
                </div>
            </div>
        `;
        
        try {
            // Load module HTML
            const htmlResponse = await fetch(`modules/${moduleName}/${moduleName}.html`);
            if (!htmlResponse.ok) {
                // If module doesn't exist, show fallback
                this.showModuleFallback(moduleName);
                return;
            }
            
            const html = await htmlResponse.text();
            
            // Display module
            document.getElementById('module-content').innerHTML = html;
            
            // Try to load module JS (remove export default)
            await this.loadModuleJS(moduleName);
            
        } catch (error) {
            console.error(`Failed to load module ${moduleName}:`, error);
            this.showModuleFallback(moduleName);
        }
    }
    
    async loadModuleJS(moduleName) {
        try {
            const scriptResponse = await fetch(`modules/${moduleName}/${moduleName}.js`);
            if (!scriptResponse.ok) return;
            
            const scriptText = await scriptResponse.text();
            
            // Remove "export default" if present and wrap in function
            let cleanScript = scriptText
                .replace(/^export default function/, 'function')
                .replace(/^export default/, '');
            
            // Create and execute the module function
            const moduleFunc = eval(`(${cleanScript})`);
            if (typeof moduleFunc === 'function') {
                await moduleFunc(this);
            }
            
        } catch (error) {
            console.log(`No JS or JS error for ${moduleName}:`, error);
        }
    }
    
    showModuleFallback(moduleName) {
        const fallbacks = {
            home: `Welcome to ROM! Home module is working.`,
            games: `🎮 Games module coming soon!`,
            chat: `💬 Chat module coming soon!`,
            profile: `👤 Profile module coming soon!`,
            auth: `🔐 Auth module coming soon!`
        };
        
        document.getElementById('module-content').innerHTML = `
            <div style="padding: 50px; text-align: center;">
                <h2>${moduleName.toUpperCase()} Module</h2>
                <p>${fallbacks[moduleName] || 'Module under development'}</p>
                <button class="nav-btn" onclick="rom.loadModule('home')" style="margin-top: 20px;">
                    Return to Home
                </button>
            </div>
        `;
    }
    
    showError(message) {
        document.getElementById('rom-app').innerHTML = `
            <div style="padding: 50px; text-align: center; color: #ff3333;">
                <h2>⚠️ Application Error</h2>
                <p>${message}</p>
                <button onclick="location.reload()" style="padding: 10px 20px; background: #ff3333; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Reload App
                </button>
            </div>
        `;
    }
    
    updateNavigation() {
    const nav = document.getElementById('rom-nav');
    const modules = [
        { id: 'home', name: '🏠 Home' },
        { id: 'games', name: '🎮 Games' },
        { id: 'chat', name: '💬 Chat' },
        { id: 'profile', name: '👤 Profile' }
    ];
    
    nav.innerHTML = modules.map(module => `
        <button class="nav-btn ${this.currentModule === module.id ? 'active' : ''}"
                onclick="rom.loadModule('${module.id}')">
            ${module.name}
        </button>
    `).join('');
    
    // Add admin button if user is admin
    if (this.currentUser && this.currentUser.email === 'YOUR_EMAIL_HERE@gmail.com') { // Change this to your email
        const adminBtn = document.createElement('button');
        adminBtn.className = 'nav-btn';
        adminBtn.style.background = 'rgba(255, 51, 204, 0.2)';
        adminBtn.style.borderColor = '#ff33cc';
        adminBtn.style.color = '#ff33cc';
        adminBtn.innerHTML = '🛠️ Admin';
        adminBtn.onclick = () => this.loadModule('admin');
        nav.appendChild(adminBtn);
    }
    
    // Add submit game button if on games page
    if (this.currentModule === 'games') {
        const submitBtn = document.createElement('button');
        submitBtn.className = 'nav-btn';
        submitBtn.style.background = 'rgba(255, 51, 204, 0.2)';
        submitBtn.style.borderColor = '#ff33cc';
        submitBtn.style.color = '#ff33cc';
        submitBtn.innerHTML = '＋ Submit Game';
        submitBtn.onclick = () => this.loadModule('submit-game');
        nav.appendChild(submitBtn);
    }
}
    
    async logout() {
        try {
            await this.supabase.auth.signOut();
            this.currentUser = null;
            this.loadModule('home');
            this.renderApp(); // Re-render to update auth state
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }
}

// Create global instance
window.rom = new ROMApp();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.rom.init();
});
