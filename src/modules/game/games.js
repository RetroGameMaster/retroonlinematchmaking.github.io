// Games Module
export default async function() {
    return `
        <div class="games-module">
            <h2>🎮 Games Library</h2>
            
            <div class="games-filter">
                <input type="text" placeholder="Search games..." id="gameSearch">
                <select id="platformFilter">
                    <option value="all">All Platforms</option>
                    <option value="ps1">PS1</option>
                    <option value="ps2">PS2</option>
                    <option value="ps3">PS3</option>
                    <option value="psp">PSP</option>
                </select>
            </div>
            
            <div class="games-grid" id="gamesGrid">
                Loading games...
            </div>
        </div>
        
        <style>
            .games-filter {
                display: flex;
                gap: 10px;
                margin: 20px 0;
            }
            
            .games-filter input,
            .games-filter select {
                flex: 1;
                padding: 10px;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid var(--primary);
                color: white;
                border-radius: 6px;
                font-family: 'Orbitron', sans-serif;
            }
            
            .games-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: 20px;
                margin-top: 20px;
            }
            
            .game-card {
                background: rgba(0, 30, 60, 0.6);
                border: 1px solid var(--primary);
                border-radius: 8px;
                padding: 20px;
                transition: all 0.3s;
            }
            
            .game-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 5px 15px rgba(0, 255, 255, 0.2);
                border-color: var(--secondary);
            }
            
            .game-card h3 {
                color: var(--secondary);
                margin-bottom: 10px;
            }
            
            .game-platform {
                display: inline-block;
                background: rgba(255, 51, 204, 0.2);
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 0.8rem;
                margin: 5px 0;
            }
            
            .join-btn {
                width: 100%;
                padding: 8px;
                background: rgba(0, 255, 255, 0.2);
                border: 1px solid var(--primary);
                color: var(--primary);
                border-radius: 4px;
                cursor: pointer;
                margin-top: 10px;
                font-family: 'Orbitron', sans-serif;
            }
        </style>
    `;
}

export async function init(app) {
    // Mock games data
    const games = [
        { id: 1, name: 'SOCOM II', platform: 'ps2', players: 42, description: 'Tactical shooter' },
        { id: 2, name: 'Twisted Metal Black', platform: 'ps2', players: 28, description: 'Vehicular combat' },
        { id: 3, name: 'Warhawk', platform: 'ps3', players: 36, description: 'Aerial combat' },
        { id: 4, name: 'Killzone', platform: 'ps2', players: 19, description: 'First-person shooter' },
        { id: 5, name: 'Ratchet: Deadlocked', platform: 'ps2', players: 24, description: 'Action platformer' },
        { id: 6, name: 'SOCOM 3', platform: 'ps2', players: 31, description: 'Tactical shooter' },
        { id: 7, name: 'SOCOM: Combined Assault', platform: 'ps2', players: 22, description: 'Tactical shooter' },
        { id: 8, name: 'Twisted Metal (2012)', platform: 'ps3', players: 15, description: 'Vehicular combat' },
    ];
    
    function renderGames(filteredGames) {
        const gamesGrid = document.getElementById('gamesGrid');
        gamesGrid.innerHTML = filteredGames.map(game => `
            <div class="game-card">
                <h3>${game.name}</h3>
                <div class="game-platform">${game.platform.toUpperCase()}</div>
                <p>${game.description}</p>
                <p>👥 ${game.players} players online</p>
                <button class="join-btn" data-game="${game.name}">Join Game</button>
            </div>
        `).join('');
        
        // Add join button listeners
        document.querySelectorAll('.join-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const game = btn.getAttribute('data-game');
                alert(`Joining ${game}... (Feature coming soon!)`);
            });
        });
    }
    
    // Initial render
    renderGames(games);
    
    // Search filter
    document.getElementById('gameSearch')?.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const platform = document.getElementById('platformFilter').value;
        
        const filtered = games.filter(game => {
            const matchesSearch = game.name.toLowerCase().includes(searchTerm);
            const matchesPlatform = platform === 'all' || game.platform === platform;
            return matchesSearch && matchesPlatform;
        });
        
        renderGames(filtered);
    });
    
    // Platform filter
    document.getElementById('platformFilter')?.addEventListener('change', (e) => {
        const searchTerm = document.getElementById('gameSearch').value.toLowerCase();
        const platform = e.target.value;
        
        const filtered = games.filter(game => {
            const matchesSearch = game.name.toLowerCase().includes(searchTerm);
            const matchesPlatform = platform === 'all' || game.platform === platform;
            return matchesSearch && matchesPlatform;
        });
        
        renderGames(filtered);
    });
}
