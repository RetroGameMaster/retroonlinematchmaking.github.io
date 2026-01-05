// Main ROM Application
import { initializeApp } from './modules/core/app-init.js';
import { loadModule } from './modules/core/module-loader.js';

class ROMApp {
    constructor() {
        this.currentModule = null;
        this.user = null;
        this.modules = {};
    }
    
    async init() {
        console.log('🚀 Initializing ROM Application...');
        
        // Initialize core systems
        await this.initializeCore();
        
        // Render the app
        this.render();
        
        // Load default module
        this.loadModule('dashboard');
        
        console.log('✅ ROM App Initialized');
    }
    
    async initializeCore() {
        // Initialize Supabase
        this.supabase = supabase.createClient(
            'https://lapyxhothazalssrbimb.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhcHl4aG90aGF6YWxzc3JiaW1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNjg0NDUsImV4cCI6MjA3Njk0NDQ0NX0.isfh75lAbJotctu6dkd_aAYK-2YNyYM4o-jqKFB5tVA'
        );
        
        // Check auth status
        const { data: { user } } = await this.supabase.auth.getUser();
        this.user = user;
    }
    
    render() {
        document.getElementById('rom-app').innerHTML = `
            <div class="rom-container">
                <header class="rom-header">
                    <div class="logo">🎮 ROM</div>
                    <nav class="rom-nav">
                        <button data-module="dashboard">🏠 Dashboard</button>
                        <button data-module="games">🎮 Games</button>
                        <button data-module="chat">💬 Chat</button>
                        <button data-module="profile">👤 Profile</button>
                        ${!this.user ? '<button data-module="auth">🔐 Login</button>' : '<button data-module="auth">🚪 Logout</button>'}
                    </nav>
                </header>
                
                <main class="rom-main">
                    <aside class="rom-sidebar">
                        <div class="user-widget" id="user-widget">
                            ${this.user ? `
                                <h3>👤 ${this.user.email}</h3>
                                <p class="status-online">● Online</p>
                            ` : `
                                <h3>👤 Guest</h3>
                                <p class="status-offline">● Offline</p>
                                <button class="login-btn">Click to Login</button>
                            `}
                        </div>
                        
                        <div class="stats-widget">
                            <h4>📊 Live Stats</h4>
                            <div id="live-stats">Loading...</div>
                        </div>
                    </aside>
                    
                    <section class="rom-content" id="module-content">
                        <div class="loading">Loading module...</div>
                    </section>
                </main>
                
                <footer class="rom-footer">
                    <p>© 2025 ROM - RetroOnlineMatchmaking | Modular Architecture v1.0</p>
                </footer>
            </div>
        `;
        
        // Add event listeners
        this.addEventListeners();
    }
    
    addEventListeners() {
        // Navigation buttons
        document.querySelectorAll('[data-module]').forEach(button => {
            button.addEventListener('click', (e) => {
                const module = e.target.getAttribute('data-module');
                this.loadModule(module);
            });
        });
        
        // Login button in sidebar
        const loginBtn = document.querySelector('.login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.loadModule('auth'));
        }
    }
    
    async loadModule(moduleName) {
        console.log(`📦 Loading module: ${moduleName}`);
        
        // Update active button
        document.querySelectorAll('[data-module]').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-module') === moduleName);
        });
        
        // Load module content
        const contentArea = document.getElementById('module-content');
        contentArea.innerHTML = `<div class="loading">Loading ${moduleName}...</div>`;
        
        try {
            // Dynamically import the module
            const module = await import(`./modules/${moduleName}/${moduleName}.js`);
            const moduleHTML = await module.default();
            contentArea.innerHTML = moduleHTML;
            
            // Initialize the module if it has an init function
            if (module.init) {
                await module.init(this);
            }
            
        } catch (error) {
            console.error(`Failed to load module ${moduleName}:`, error);
            contentArea.innerHTML = `
                <div class="error">
                    <h3>⚠️ Module Load Error</h3>
                    <p>Failed to load ${moduleName} module.</p>
                    <button onclick="romApp.loadModule('dashboard')">Return to Dashboard</button>
                </div>
            `;
        }
    }
}

// Create and export global instance
window.romApp = new ROMApp();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.romApp.init();
});
