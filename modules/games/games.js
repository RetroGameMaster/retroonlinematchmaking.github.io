function initGamesModule(rom) {
    console.log('Initializing games module...');
    
    // Load and display games
    loadGames();
    
    // Set up filters
    setupFilters();
    
    // Function to load games from storage
    function loadGames() {
        const gamesList = document.getElementById('gamesList');
        
        // Get approved games from localStorage
        const allSubmissions = JSON.parse(localStorage.getItem('rom_game_submissions') || '[]');
        const approvedGames = allSubmissions.filter(game => game.status === 'approved');
        
        if (approvedGames.length === 0) {
            // Show empty state
            gamesList.innerHTML = `
                <div class="empty-state">
                    <h3 style="color: #ff33cc; margin-bottom: 20px;">No approved games yet!</h3>
                    <p style="margin-bottom: 20px;">Be the first to get a game approved by submitting one.</p>
                    <button class="submit-game-btn" onclick="window.rom.loadModule('submit-game')">
                        🎮 Submit First Game
                    </button>
                </div>
            `;
            return;
        }
        
        // Display games
        gamesList.innerHTML = approvedGames.map(game => `
            <div class="game-card" data-platform="${game.platforms.join(',')}" data-genre="${game.genre.join(',')}">
                <h3>${game.title}</h3>
                
                <div class="game-platforms">
                    ${game.platforms.map(platform => `
                        <span class="platform-tag">${getPlatformName(platform)}</span>
                    `).join('')}
                </div>
                
                <p style="color: #a8dfe8; font-size: 0.95rem; margin: 10px 0;">
                    ${game.description.substring(0, 100)}...
                </p>
                
                <div class="game-stats">
                    <span>👥 ${game.maxPlayers} players</span>
                    <span>🎮 ${game.connectionMethods?.length || 0} methods</span>
                    <span>${game.releaseYear || 'N/A'}</span>
                </div>
                
                <button class="view-game-btn" onclick="viewGame('${game.id}')">
                    View Details
                </button>
            </div>
        `).join('');
        
        // Show submission prompt
        document.getElementById('submitPrompt').style.display = 'block';
    }
    
    function getPlatformName(platformCode) {
        const platforms = {
            'ps1': 'PS1', 'ps2': 'PS2', 'ps3': 'PS3', 'psp': 'PSP',
            'xbox': 'Xbox', 'xbox360': 'Xbox 360', 'gamecube': 'GameCube',
            'wii': 'Wii', 'dreamcast': 'Dreamcast', 'pc': 'PC'
        };
        return platforms[platformCode] || platformCode;
    }
    
    function setupFilters() {
        const platformFilter = document.getElementById('platformFilter');
        const genreFilter = document.getElementById('genreFilter');
        const searchInput = document.getElementById('searchInput');
        
        function applyFilters() {
            const platform = platformFilter.value;
            const genre = genreFilter.value;
            const search = searchInput.value.toLowerCase();
            
            document.querySelectorAll('.game-card').forEach(card => {
                const cardPlatforms = card.getAttribute('data-platform').split(',');
                const cardGenres = card.getAttribute('data-genre').split(',');
                const cardTitle = card.querySelector('h3').textContent.toLowerCase();
                
                const platformMatch = platform === 'all' || cardPlatforms.includes(platform);
                const genreMatch = genre === 'all' || cardGenres.includes(genre);
                const searchMatch = search === '' || cardTitle.includes(search);
                
                card.style.display = (platformMatch && genreMatch && searchMatch) ? 'block' : 'none';
            });
        }
        
        platformFilter.addEventListener('change', applyFilters);
        genreFilter.addEventListener('change', applyFilters);
        searchInput.addEventListener('input', applyFilters);
    }
    
    // View game details (placeholder for now)
    window.viewGame = function(gameId) {
        alert(`Game details page for ${gameId} will be implemented next!`);
        // In Phase 2, this will load: rom.loadModule(`game/${gameId}`)
    };
}

// Execute when loaded
if (typeof window.rom !== 'undefined') {
    initGamesModule(window.rom);
}
