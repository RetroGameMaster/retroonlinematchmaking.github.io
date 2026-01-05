<div class="dashboard-module">
    <style>
        .dashboard-module {
            padding: 20px;
        }
        
        .welcome-banner {
            background: linear-gradient(90deg, #00ffff, #ff33cc);
            padding: 30px;
            border-radius: 15px;
            margin-bottom: 30px;
            text-align: center;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        
        .stat-card {
            background: rgba(0, 30, 60, 0.7);
            border: 1px solid #00ffff;
            border-radius: 10px;
            padding: 20px;
            text-align: center;
        }
        
        .stat-card h3 {
            color: #ff33cc;
            margin-bottom: 10px;
        }
        
        .stat-card .number {
            font-size: 2.5rem;
            font-weight: bold;
            color: #00ffff;
        }
        
        .quick-actions {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            margin-top: 30px;
        }
        
        .action-btn {
            flex: 1;
            min-width: 150px;
            padding: 15px;
            background: rgba(0, 255, 255, 0.1);
            border: 1px solid #00ffff;
            color: #00ffff;
            border-radius: 8px;
            cursor: pointer;
            font-family: 'Orbitron', sans-serif;
            transition: all 0.3s;
        }
        
        .action-btn:hover {
            background: rgba(0, 255, 255, 0.3);
            transform: translateY(-3px);
        }
    </style>
    
    <div class="welcome-banner">
        <h1>Welcome to ROM Dashboard 🎮</h1>
        <p>Your central hub for retro gaming matchmaking</p>
    </div>
    
    <div class="stats-grid">
        <div class="stat-card">
            <h3>Active Players</h3>
            <div class="number" id="playerCount">128</div>
            <p>Online now</p>
        </div>
        
        <div class="stat-card">
            <h3>Active Games</h3>
            <div class="number" id="gameCount">24</div>
            <p>Being played</p>
        </div>
        
        <div class="stat-card">
            <h3>Your Friends</h3>
            <div class="number" id="friendCount">12</div>
            <p>Online: 8</p>
        </div>
        
        <div class="stat-card">
            <h3>Matchmaking</h3>
            <div class="number" id="matchCount">6</div>
            <p>Active lobbies</p>
        </div>
    </div>
    
    <h2>Quick Actions</h2>
    <div class="quick-actions">
        <button class="action-btn" onclick="loadModule('games')">🎮 Find Game</button>
        <button class="action-btn" onclick="loadModule('chat')">💬 Join Chat</button>
        <button class="action-btn" onclick="loadModule('profile')">👤 View Profile</button>
        <button class="action-btn" onclick="alert('Coming soon!')">📢 Announcements</button>
        <button class="action-btn" onclick="alert('Coming soon!')">🏆 Leaderboards</button>
        <button class="action-btn" onclick="alert('Coming soon!')">⚙️ Settings</button>
    </div>
    
    <script>
        // Update stats with random numbers
        setInterval(() => {
            document.getElementById('playerCount').textContent = 
                100 + Math.floor(Math.random() * 50);
            document.getElementById('gameCount').textContent = 
                20 + Math.floor(Math.random() * 10);
        }, 5000);
    </script>
</div>
