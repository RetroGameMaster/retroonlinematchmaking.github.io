// Dashboard Module
export default async function() {
    return `
        <div class="dashboard">
            <h1>🏠 ROM Dashboard</h1>
            <p>Welcome to the new modular ROM platform!</p>
            
            <div class="dashboard-grid">
                <div class="dashboard-card">
                    <h3>🎮 Quick Play</h3>
                    <p>Jump into a game quickly</p>
                    <button class="action-btn">Find Game</button>
                </div>
                
                <div class="dashboard-card">
                    <h3>👥 Friends Online</h3>
                    <p>Connect with friends</p>
                    <button class="action-btn">View Friends</button>
                </div>
                
                <div class="dashboard-card">
                    <h3>📢 Announcements</h3>
                    <p>Latest community news</p>
                    <button class="action-btn">Read More</button>
                </div>
            </div>
            
            <div class="recent-games">
                <h3>Recently Active Games</h3>
                <div id="recent-games-list">
                    Loading games...
                </div>
            </div>
        </div>
    `;
}

export async function init(app) {
    // Load recent games
    const games = [
        { name: 'SOCOM II', players: 42, platform: 'PS2' },
        { name: 'Twisted Metal Black', players: 28, platform: 'PS2' },
        { name: 'Warhawk', players: 36, platform: 'PS3' },
    ];
    
    const gamesList = document.getElementById('recent-games-list');
    if (gamesList) {
        gamesList.innerHTML = games.map(game => `
            <div class="game-item">
                <strong>${game.name}</strong>
                <span>${game.players} players online</span>
                <small>${game.platform}</small>
            </div>
        `).join('');
    }
}
