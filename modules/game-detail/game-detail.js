// modules/game-detail/game-detail.js - COMPLETE FIXED VERSION
let isInitialized = false;

async function initGameDetail(rom, identifier) {
    console.log('🎮 Initializing game detail module for identifier:', identifier);
    
    if (isInitialized) {
        console.log('⚠️ Game detail module already initialized, skipping...');
        return;
    }
    isInitialized = true;
    
    if (!rom.supabase) {
        console.error('❌ No Supabase client in rom object');
        return;
    }
    
    const gameLoading = document.getElementById('game-loading');
    const gameContent = document.getElementById('game-content');
    const gameError = document.getElementById('game-error');
    
    if (!gameLoading || !gameContent || !gameError) {
        console.error('❌ Game detail container elements not found');
        return;
    }
    
    try {
        console.log('🔍 Attempting to load game with identifier:', identifier);
        const game = await loadGameByIdentifier(rom, identifier);
        
        if (!game) {
            console.error('❌ Game not found for identifier:', identifier);
            gameLoading.classList.add('hidden');
            gameError.classList.remove('hidden');
            return;
        }
        
        console.log('✅ Game loaded successfully:', game.title);
        gameLoading.classList.add('hidden');
        gameContent.classList.remove('hidden');
        
        // Fetch all data needed for the RA layout
        console.log('📊 Fetching achievements and activity data...');
        const [achievementsRes, activityRes, topPlayersRes] = await Promise.all([
            rom.supabase.from('achievements').select('*').eq('game_id', game.id).order('points', { ascending: false }),
            rom.supabase.from('user_activity').select('*, profiles(username)').eq('game_id', game.id).order('last_seen', { ascending: false }).limit(1),
            rom.supabase.from('user_activity').select('*, profiles(username, avatar_url)').eq('game_id', game.id).order('last_seen', { ascending: false }).limit(10)
        ]);

        const achievements = achievementsRes.data || [];
        const recentActivity = activityRes.data || [];
        const topPlayers = topPlayersRes.data || [];

        console.log('📊 Achievements:', achievements.length, 'Recent Activity:', recentActivity.length);

        const totalPoints = achievements.reduce((sum, a) => sum + (a.points || 0), 0);
        const totalAchievements = achievements.length;

        renderRALayout(game, achievements, recentActivity, topPlayers, totalPoints, totalAchievements, gameContent, rom);
        
    } catch (error) {
        console.error('❌ Error loading game:', error);
        console.error('Error details:', error.message);
        gameLoading.classList.add('hidden');
        gameError.classList.remove('hidden');
    }
}

async function loadGameByIdentifier(rom, identifier) {
    console.log('🔍 loadGameByIdentifier called with:', identifier);
    
    try {
        // Check if identifier is a UUID
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
        console.log('Is UUID?', isUuid);
        
        let query;
        if (isUuid) {
            console.log('Querying by ID:', identifier);
            query = rom.supabase.from('games').select('*').eq('id', identifier);
        } else {
            console.log('Querying by slug:', identifier);
            query = rom.supabase.from('games').select('*').eq('slug', identifier);
        }
        
        console.log('Executing query...');
        const {  game, error } = await query.single();
        
        if (error) {
            console.error('❌ Supabase query error:', error);
            console.error('Error details:', error.message, error.details);
            
            // If not found by slug, try ID as fallback
            if (!isUuid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)) {
                console.log('🔄 Trying as ID fallback...');
                const {  gameById, error: idError } = await rom.supabase
                    .from('games')
                    .select('*')
                    .eq('id', identifier)
                    .single();
                
                if (idError) {
                    console.error('❌ Also not found by ID:', idError);
                    return null;
                }
                
                console.log('✅ Found by ID fallback:', gameById.title);
                return gameById;
            }
            
            return null;
        }
        
        console.log('✅ Game found:', game ? game.title : 'null');
        return game;
        
    } catch (error) {
        console.error('❌ Error in loadGameByIdentifier:', error);
        console.error('Stack trace:', error.stack);
        return null;
    }
}

// ===== NEW: MEMORY LOGIC PAGE FUNCTION =====
export async function showMemoryPage(rom, gameId, gameTitle) {
    console.log('🧠 Loading memory page for game:', gameId, gameTitle);
    
    const appContent = document.getElementById('app-content');
    if (!appContent) {
        console.error('❌ app-content element not found');
        return;
    }
    
    appContent.innerHTML = `
        <div class="text-center p-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
            <p class="mt-2 text-gray-300">Loading memory logic...</p>
        </div>
    `;
    
    try {
        const {  achievements, error } = await rom.supabase
            .from('achievements')
            .select('*')
            .eq('game_id', gameId)
            .order('points', { ascending: false });
        
        if (error) throw error;
        
        console.log('📊 Found', achievements.length, 'achievements');
        const memoryAchievements = achievements.filter(a => a.memory_logic);
        console.log('🧠 Found', memoryAchievements.length, 'achievements with memory logic');
        
        renderMemoryPage(gameId, gameTitle, memoryAchievements, achievements.length);
        
    } catch (error) {
        console.error('❌ Error loading memory logic:', error);
        appContent.innerHTML = `
            <div class="max-w-4xl mx-auto p-4">
                <div class="mb-6">
                    <a href="#/game/${gameId}" class="inline-flex items-center text-cyan-400 hover:text-cyan-300">
                        ← Back to Game
                    </a>
                </div>
                <div class="bg-red-900/30 border border-red-500 rounded-lg p-6">
                    <h2 class="text-2xl font-bold text-red-400 mb-2">Error Loading Memory Logic</h2>
                    <p class="text-gray-300">${error.message}</p>
                </div>
            </div>
        `;
    }
}

function renderMemoryPage(gameId, gameTitle, memoryAchievements, totalAchievements) {
    const appContent = document.getElementById('app-content');
    
    const html = `
        <div class="max-w-6xl mx-auto p-4 md:p-6">
            <!-- Header -->
            <div class="mb-6">
                <a href="#/game/${gameId}" class="inline-flex items-center text-cyan-400 hover:text-cyan-300 mb-4">
                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                    </svg>
                    Back to ${escapeHtml(gameTitle)}
                </a>
                <h1 class="text-3xl font-bold text-white mb-2">🧠 Memory Logic - ${escapeHtml(gameTitle)}</h1>
                <p class="text-gray-400">Achievement memory addresses and conditions</p>
            </div>
            
            <!-- Stats -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div class="bg-gray-800 rounded-lg p-4 border border-cyan-500">
                    <div class="text-2xl font-bold text-cyan-400">${memoryAchievements.length}</div>
                    <div class="text-gray-400 text-sm">Achievements with Memory</div>
                </div>
                <div class="bg-gray-800 rounded-lg p-4 border border-purple-500">
                    <div class="text-2xl font-bold text-purple-400">${totalAchievements}</div>
                    <div class="text-gray-400 text-sm">Total Achievements</div>
                </div>
                <div class="bg-gray-800 rounded-lg p-4 border border-green-500">
                    <div class="text-2xl font-bold text-green-400">${totalAchievements > 0 ? Math.round((memoryAchievements.length / totalAchievements) * 100) : 0}%</div>
                    <div class="text-gray-400 text-sm">With Memory Logic</div>
                </div>
            </div>
            
            <!-- Memory Logic List -->
            <div class="space-y-4">
                ${memoryAchievements.length > 0 ? memoryAchievements.map((a, index) => `
                    <div class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                        <div class="p-4 border-b border-gray-700">
                            <div class="flex items-start justify-between gap-4">
                                <div class="flex-1">
                                    <div class="flex items-center gap-3 mb-2">
                                        <img src="${a.badge_url || 'https://via.placeholder.com/32/1f2937/6b7280?text=🏆'}" 
                                             alt="${escapeHtml(a.title)}" 
                                             class="w-8 h-8 rounded object-cover">
                                        <h3 class="text-lg font-bold text-cyan-400">${escapeHtml(a.title)}</h3>
                                        <span class="bg-yellow-900 text-yellow-300 px-2 py-0.5 rounded text-xs font-bold">${a.points} pts</span>
                                    </div>
                                    <p class="text-gray-300 text-sm">${escapeHtml(a.description || '')}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div class="p-4 bg-gray-900">
                            <div class="flex items-center justify-between mb-2">
                                <label class="text-xs font-bold text-gray-400 uppercase">Memory Logic Code:</label>
                                <button onclick="copyMemoryCode('${escapeHtml(a.memory_logic || '')}')" 
                                        class="text-xs bg-cyan-600 hover:bg-cyan-700 text-white px-2 py-1 rounded">
                                    📋 Copy
                                </button>
                            </div>
                            <code class="block bg-black p-3 rounded text-green-400 text-sm font-mono overflow-x-auto border border-gray-700">
                                ${escapeHtml(a.memory_logic || 'No memory logic defined')}
                            </code>
                            
                            ${a.is_multiplayer ? `
                                <div class="mt-3">
                                    <span class="inline-block bg-purple-900 text-purple-300 px-2 py-1 rounded text-xs">🌐 Multiplayer Achievement</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('') : `
                    <div class="text-center py-12 bg-gray-800 rounded-lg border border-gray-700">
                        <div class="text-6xl mb-4">📭</div>
                        <h3 class="text-xl font-bold text-white mb-2">No Memory Logic Found</h3>
                        <p class="text-gray-400">This game doesn't have any achievements with memory logic defined yet.</p>
                    </div>
                `}
            </div>
            
            <!-- Info Box -->
            <div class="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 class="text-lg font-bold text-white mb-3">📖 About Memory Logic</h3>
                <p class="text-gray-300 text-sm mb-4">
                    Memory logic codes are used by RetroAchievements-compatible emulators to track achievement progress. 
                    These codes monitor specific memory addresses in the game's RAM to detect when conditions are met.
                </p>
                <div class="bg-gray-900 rounded p-4 border border-gray-700">
                    <h4 class="text-sm font-bold text-cyan-400 mb-2">Example Code Format:</h4>
                    <code class="text-green-400 text-xs font-mono block">
                        0x1234=5 AND 0x5678!=0<br>
                        <!-- Example: "Level equals 5 AND Lives not equal to 0" -->
                    </code>
                </div>
            </div>
        </div>
    `;
    
    appContent.innerHTML = html;
}

// Global function for copying memory code
window.copyMemoryCode = function(code) {
    navigator.clipboard.writeText(code).then(() => {
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        notification.textContent = '✅ Memory code copied!';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
};

// ===== RARETRO ACHIEVEMENTS LAYOUT RENDERER =====
function renderRALayout(game, achievements, recentActivity, topPlayers, totalPoints, totalAchievements, container, rom) {
    const unlockRate = achievements.length > 0 ? Math.floor(Math.random() * 40) + 10 : 0;
    const achievementsWithMemory = achievements.filter(a => a.memory_logic).length;

    const html = `
        <div class="max-w-7xl mx-auto p-4 md:p-6">
            
            <!-- 1. GAME HEADER (RA Style) -->
            <div class="mb-8 border-b border-gray-700 pb-4">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 class="text-3xl font-bold text-white mb-2">${escapeHtml(game.title)}</h1>
                        <div class="flex items-center gap-3">
                            <span class="bg-gray-700 text-cyan-400 px-3 py-1 rounded text-sm font-semibold">${escapeHtml(game.console)}</span>
                            <span class="text-gray-400 text-sm">${game.year || 'N/A'}</span>
                        </div>
                    </div>
                    <div class="flex gap-2">
                         <button class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm font-medium">
                            🎮 Play
                         </button>
                         <button class="bg-gray-800 hover:bg-gray-700 text-cyan-400 border border-cyan-500/30 px-4 py-2 rounded text-sm font-medium">
                            + Want to Play
                         </button>
                    </div>
                </div>
            </div>

            <div class="flex flex-col lg:flex-row gap-8">
                
                <!-- LEFT COLUMN: ACHIEVEMENTS -->
                <div class="lg:w-2/3">
                    
                    <!-- Base Set Summary -->
                    <div class="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
                        <h3 class="text-gray-400 text-sm font-bold mb-2">Base Set</h3>
                        <div class="flex items-end gap-2">
                            <span class="text-2xl font-bold text-white">${totalAchievements} achievements</span>
                            <span class="text-gray-500 mb-1">worth</span>
                            <span class="text-2xl font-bold text-cyan-400">${totalPoints} points</span>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">39% Beaten</p>
                    </div>

                    <!-- Achievements List -->
                    <div class="space-y-2" id="achievements-list">
                        ${achievements.length > 0 ? achievements.map((a, index) => `
                            <div class="bg-gray-900 hover:bg-gray-800 rounded p-3 border border-gray-800 transition flex flex-col md:flex-row gap-4">
                                
                                <!-- Achievement Icon -->
                                <div class="flex-shrink-0">
                                    <img src="${a.badge_url || 'https://via.placeholder.com/48/1f2937/6b7280?text=🏆'}" 
                                         alt="${escapeHtml(a.title)}" 
                                         class="w-12 h-12 rounded-lg object-cover border border-gray-600">
                                </div>
                                
                                <!-- Info -->
                                <div class="flex-1 min-w-0">
                                    <div class="flex justify-between items-start mb-1">
                                        <h4 class="text-cyan-400 font-bold hover:underline truncate">${escapeHtml(a.title)}</h4>
                                        <div class="text-right">
                                            <span class="text-yellow-500 font-bold">${a.points}</span>
                                            <span class="text-gray-500 text-xs"> (${index + 1})</span>
                                        </div>
                                    </div>
                                    <p class="text-gray-300 text-sm mb-2">${escapeHtml(a.description || '')}</p>
                                    
                                    <!-- Unlock Bar (Mocked for now) -->
                                    <div class="w-full bg-gray-700 rounded-full h-1.5 mt-1">
                                        <div class="bg-cyan-500 h-1.5 rounded-full" style="width: ${Math.max(5, Math.random() * 80)}%"></div>
                                    </div>
                                </div>
                            </div>
                        `).join('') : '<p class="text-gray-500 p-4">No achievements added yet.</p>'}
                    </div>
                </div>

                <!-- RIGHT SIDEBAR: INFO & STATS -->
                <div class="lg:w-1/3 space-y-6">
                    
                    <!-- Game Info Box -->
                    <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div class="space-y-3 text-sm">
                            <div>
                                <span class="text-gray-500 block text-xs">Developer</span>
                                <span class="text-cyan-400">${escapeHtml(game.connection_method || 'Unknown')}</span>
                            </div>
                            <div>
                                <span class="text-gray-500 block text-xs">Publisher</span>
                                <span class="text-cyan-400">${escapeHtml(game.console || 'N/A')}</span>
                            </div>
                            <div>
                                <span class="text-gray-500 block text-xs">Genre</span>
                                <span class="text-cyan-400">${escapeHtml(game.multiplayer_type || 'Multiplayer')}</span>
                            </div>
                            <div>
                                <span class="text-gray-500 block text-xs">Released</span>
                                <span class="text-cyan-400">${game.year || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Hash / ID Section -->
                    <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <h3 class="text-gray-500 text-xs font-bold mb-2 uppercase">Supported Game Hashes</h3>
                        <div class="bg-black rounded p-2 font-mono text-xs text-green-400 break-all">
                            ID: ${game.id}
                        </div>
                        <div class="mt-2 flex gap-2 flex-wrap">
                             <a href="#/game/${game.id}/memory" 
                                class="text-cyan-400 hover:text-cyan-300 text-xs underline flex items-center">
                                🧠 Memory Logic
                             </a>
                             <span class="text-gray-600">•</span>
                             <a href="#" class="text-cyan-400 hover:text-cyan-300 text-xs underline">
                                📄 Official Forum Topic
                             </a>
                        </div>
                    </div>

                    <!-- Most Points Earned (Leaderboard) -->
                    <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <h3 class="text-gray-500 text-xs font-bold mb-3 uppercase">Most Points Earned</h3>
                        <div class="space-y-2">
                            ${topPlayers.length > 0 ? topPlayers.map((p, i) => `
                                <div class="flex justify-between items-center text-sm">
                                    <div class="flex items-center gap-2">
                                        <span class="text-gray-500 w-4">#${i + 1}</span>
                                        <span class="text-white font-medium truncate w-24">${escapeHtml(p.profiles?.username || 'User')}</span>
                                    </div>
                                    <span class="text-yellow-500 font-bold">● ${totalPoints}</span>
                                </div>
                            `).join('') : '<p class="text-gray-500 text-xs">No points earned yet</p>'}
                        </div>
                    </div>

                    <!-- Playtime Stats -->
                    <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <h3 class="text-gray-500 text-xs font-bold mb-3 uppercase">Playtime Stats</h3>
                        <div class="flex items-center gap-3 mb-2">
                            <div class="text-cyan-400 text-2xl">✓</div>
                            <div>
                                <p class="text-white text-sm font-bold">Unlocked an achievement</p>
                                <p class="text-gray-500 text-xs">${recentActivity.length} players</p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// ===== HELPER: Escape HTML =====
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Export functions
export default initGameDetail;
export { showMemoryPage };
window.initGameDetail = initGameDetail;
window.showMemoryPage = showMemoryPage;
