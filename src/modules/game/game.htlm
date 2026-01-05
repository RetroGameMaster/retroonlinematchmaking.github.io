<div class="games-module">
    <style>
        .games-module {
            padding: 20px;
        }
        
        .games-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            flex-wrap: wrap;
            gap: 15px;
        }
        
        .games-filter {
            display: flex;
            gap: 10px;
        }
        
        .games-filter select,
        .games-filter input {
            padding: 10px;
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid #00ffff;
            color: white;
            border-radius: 5px;
            font-family: 'Orbitron', sans-serif;
        }
        
        .games-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 25px;
        }
        
        .game-card {
            background: rgba(0, 30, 60, 0.7);
            border: 1px solid #00ffff;
            border-radius: 12px;
            padding: 20px;
            transition: all 0.3s;
        }
        
        .game-card:hover {
            transform: translateY(-8px);
            border-color: #ff33cc;
            box-shadow: 0 10px 25px rgba(255, 51, 204, 0.3);
        }
        
        .game-card h3 {
            color: #ff33cc;
            margin-bottom: 10px;
        }
        
        .game-platform {
            display: inline-block;
            background: rgba(255, 51, 204, 0.2);
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 0.9rem;
            margin: 10px 0;
        }
        
        .join-btn {
            width: 100%;
            padding: 12px;
            background: linear-gradient(180deg, #00d7ff, #00a8bf);
            border: none;
            color: #000;
            font-weight: bold;
            border-radius: 6px;
            cursor: pointer;
            margin-top: 15px;
            font-family: 'Orbitron', sans-serif;
        }
        
        .players-online {
            color: #00ff00;
            font-weight: bold;
        }
    </style>
    
    <div class="games-header">
        <h2>🎮 Game Library</h2>
        <div class="games-filter">
            <select id="platformFilter">
                <option value="all">All Platforms</option>
                <option value="ps1">PlayStation 1</option>
                <option value="ps2">PlayStation 2</option>
                <option value="ps3">PlayStation 3</option>
                <option value="psp">PSP</option>
            </select>
            <input type="text" id="searchGames" placeholder="Search games...">
        </div>
    </div>
    
    <div class="games-grid" id="gamesGrid">
        <!-- Games will be loaded here -->
    </div>
    
    <script>
        const games = [
            { id: 1, name: 'SOCOM II', platform: 'ps2', players: 42, description: 'Tactical military shooter', favorite: true },
            { id: 2, name: 'Twisted Metal Black', platform: 'ps2', players: 28, description: 'Vehicular combat arena' },
            { id: 3, name: 'Warhawk', platform: 'ps3', players: 36, description: 'Aerial and ground combat' },
            { id: 4, name: 'Killzone', platform: 'ps2', players: 19, description: 'Futuristic first-person shooter' },
            { id: 5, name: 'Ratchet: Deadlocked', platform: 'ps2', players: 24, description: 'Co-op action platformer' },
            { id: 6, name: 'SOCOM 3', platform: 'ps2', players: 31, description: 'Expanded tactical shooter' },
            { id: 7, name: 'SOCOM: Combined Assault', platform: 'ps2', players: 22, description: 'Direct sequel to SOCOM 3' },
            { id: 8, name: 'Twisted Metal (2012)', platform: 'ps3', players: 15, description: 'Modern vehicular combat' },
            { id: 9, name: 'Resistance: Fall of Man', platform: 'ps3', players: 18, description: 'Alternate history FPS' },
            { id: 10, name: 'Metal Gear Online', platform: 'ps3', players: 12, description: 'Stealth-based multiplayer' },
        ];
        
        function renderGames(gameList) {
            const gamesGrid = document.getElementById('gamesGrid');
            gamesGrid.innerHTML = gameList.map(game => `
                <div class="game-card" data-platform="${game.platform}">
                    <h3>${game.name} ${game.favorite ? '⭐' : ''}</h3>
                    <div class="game-platform">${game.platform.toUpperCase()}</div>
                    <p>${game.description}</p>
                    <p class="players-online">👥 ${game.players} players online</p>
                    <button class="join-btn" onclick="joinGame('${game.name}')">
                        JOIN GAME
                    </button>
                </div>
            `).join('');
        }
        
        // Initial render
        renderGames(games);
        
        // Filter functionality
        document.getElementById('platformFilter').addEventListener('change', filterGames);
        document.getElementById('searchGames').addEventListener('input', filterGames);
        
        function filterGames() {
            const platform = document.getElementById('platformFilter').value;
            const search = document.getElementById('searchGames').value.toLowerCase();
            
            const filtered = games.filter(game => {
                const matchesPlatform = platform === 'all' || game.platform === platform;
                const matchesSearch = game.name.toLowerCase().includes(search) || 
                                     game.description.toLowerCase().includes(search);
                return matchesPlatform && matchesSearch;
            });
            
            renderGames(filtered);
        }
        
        // Join game function
        window.joinGame = function(gameName) {
            alert(`Joining ${gameName}...\n\nMatchmaking will start shortly!`);
            // In real app, this would trigger matchmaking
        };
    </script>
</div>
