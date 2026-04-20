// modules/game-detail/game-detail.js - FULL WORKING VERSION
let isInitialized = false;

// ===== MAIN INIT FUNCTION =====
export default async function initGameDetail(rom, identifier) {
    if (isInitialized) return;
    isInitialized = true;

    console.log('🎮 Loading game for slug:', identifier);

    if (!rom.supabase) {
        console.error('❌ No Supabase client');
        return;
    }

    const loading = document.getElementById('game-loading');
    const content = document.getElementById('game-content');
    const error = document.getElementById('game-error');

    if (!loading || !content || !error) {
        console.error('❌ Missing DOM elements');
        return;
    }

    try {
        // QUERY BY SLUG ONLY
        console.log('🔍 Querying games.slug =', identifier);
        
        const result = await rom.supabase
            .from('games')
            .select('*')
            .eq('slug', identifier)
            .single();
        
        console.log('✅ Supabase response:', {
            hasData: !!result.data,
            hasError: !!result.error
        });

        const game = result.data;
        const gameError = result.error;

        if (gameError) {
            console.error('❌ Query failed:', gameError);
        }
        
        if (!game) {
            console.error('❌ No game returned for slug:', identifier);
            loading.classList.add('hidden');
            error.classList.remove('hidden');
            return;
        }

        console.log('✅ SUCCESS: Game loaded:', game.title);
        loading.classList.add('hidden');
        content.classList.remove('hidden');

        // Render Game Info + Screenshots + Achievements + Memory Containers
        renderGame(game, content);

        // Load Achievements with Real Calculations
        loadAchievements(rom, game.id);

        // Load Memory Logic Codes
        loadMemoryLogic(rom, game.id);

    } catch (err) {
        console.error('❌ Exception:', err);
        loading.classList.add('hidden');
        error.classList.remove('hidden');
    }
}

// ===== RENDER GAME FUNCTION (Info + Screenshots + Achievements + Memory) =====
function renderGame(game, container) {
    container.innerHTML = `
        <div class="max-w-7xl mx-auto p-4">
            <a href="#/games" class="text-cyan-400 hover:underline mb-4 inline-block">← Back to Games</a>
            
            <div class="flex flex-col md:flex-row gap-8">
                <!-- Left: Cover + Info -->
                <div class="md:w-1/3">
                    ${game.cover_image_url 
                        ? `<img src="${game.cover_image_url}" class="w-full rounded-lg shadow-lg" alt="${escapeHtml(game.title)}">` 
                        : '<div class="w-full h-64 bg-gray-700 rounded-lg flex items-center justify-center text-4xl">🎮</div>'}
                </div>
                
                <!-- Right: Details -->
                <div class="md:w-2/3">
                    <h1 class="text-3xl font-bold text-white mb-2">${escapeHtml(game.title)}</h1>
                    
                    <div class="flex gap-2 mb-4">
                        <span class="bg-gray-700 text-cyan-300 px-3 py-1 rounded text-sm">${escapeHtml(game.console)}</span>
                        ${game.year ? `<span class="bg-gray-700 text-gray-300 px-3 py-1 rounded text-sm">${game.year}</span>` : ''}
                    </div>
                    
                    <p class="text-gray-300 mb-6 whitespace-pre-line">${escapeHtml(game.description || 'No description available.')}</p>
                    
                    <!-- 🖼️ SCREENSHOTS SECTION -->
                    ${game.screenshot_urls && game.screenshot_urls.length > 0 ? `
                        <div class="mb-8">
                            <h2 class="text-xl font-bold text-white mb-3">🖼️ Screenshots</h2>
                            <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                                ${game.screenshot_urls.map(url => `
                                    <img src="${url}" 
                                         alt="Screenshot" 
                                         class="w-full h-40 object-cover rounded-lg border border-gray-700 hover:border-cyan-500 transition cursor-pointer"
                                         onclick="this.classList.toggle('h-96')">
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <!-- 🏆 ACHIEVEMENTS SECTION (Container for JS injection) -->
                    <div id="achievements-container" class="mb-8">
                        <h2 class="text-xl font-bold text-white mb-3">🏆 Achievements</h2>
                        <div class="text-center py-8 text-gray-400">
                            <div class="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-cyan-500"></div>
                            <p class="mt-2">Loading achievements...</p>
                        </div>
                    </div>

                    <!-- 🧠 MEMORY LOGIC SECTION (Container for JS injection) -->
                    <div id="memory-container" class="mb-8 border-t border-gray-700 pt-8">
                        <h2 class="text-xl font-bold text-white mb-3">🧠 Memory Logic</h2>
                        <div class="text-center py-4 text-gray-400">
                            <div class="inline-block animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-cyan-500"></div>
                            <p class="mt-2 text-sm">Loading memory codes...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ===== LOAD ACHIEVEMENTS WITH REAL CALCULATIONS =====
async function loadAchievements(rom, gameId) {
    const container = document.getElementById('achievements-container');
    if (!container) return;

    try {
        // 1. Fetch all achievements for this game
        const {  achievements, error: aError } = await rom.supabase
            .from('achievements')
            .select('*')
            .eq('game_id', gameId)
            .order('points', { ascending: false });

        if (aError || !achievements || achievements.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-sm">No achievements available for this game.</p>`;
            return;
        }

        // 2. Fetch user_achievements to calculate real rates
        const achievementIds = achievements.map(a => a.id);
        
        const {  unlocks } = await rom.supabase
            .from('user_achievements')
            .select('user_id, achievement_id')
            .in('achievement_id', achievementIds);

        // 3. Calculate Stats
        const totalPlayers = new Set(unlocks?.map(u => u.user_id)).size;
        
        // Count unlocks per achievement
        const unlockCounts = {};
        if (unlocks) {
            unlocks.forEach(u => {
                unlockCounts[u.achievement_id] = (unlockCounts[u.achievement_id] || 0) + 1;
            });
        }

        // 4. Render Grid
        container.innerHTML = `
            <h2 class="text-xl font-bold text-white mb-3">🏆 Achievements (${achievements.length})</h2>
            <p class="text-gray-400 text-sm mb-4">${totalPlayers > 0 ? totalPlayers + ' players have unlocked achievements' : 'Be the first to unlock!'}</p>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${achievements.map(a => {
                    const count = unlockCounts[a.id] || 0;
                    const rate = totalPlayers > 0 ? Math.round((count / totalPlayers) * 100) : 0;
                    
                    return `
                    <div class="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-cyan-500 transition">
                        <div class="flex gap-3">
                            <!-- Badge -->
                            <div class="flex-shrink-0">
                                <img src="${a.badge_url || 'https://via.placeholder.com/48/1f2937/6b7280?text=🏆'}" 
                                     alt="${escapeHtml(a.title)}" class="w-12 h-12 rounded object-cover">
                            </div>
                            
                            <!-- Info -->
                            <div class="flex-1">
                                <div class="flex justify-between items-start">
                                    <h3 class="text-sm font-bold text-white leading-tight">${escapeHtml(a.title)}</h3>
                                    <span class="text-yellow-400 text-xs font-bold bg-yellow-900/30 px-1.5 py-0.5 rounded ml-2">${a.points} pts</span>
                                </div>
                                <p class="text-gray-400 text-xs mt-1 mb-2 line-clamp-2">${escapeHtml(a.description || '')}</p>
                                
                                <!-- Progress Bar -->
                                <div class="w-full bg-gray-700 rounded-full h-1.5 mt-1 relative overflow-hidden">
                                    <div class="bg-cyan-500 h-1.5 rounded-full absolute top-0 left-0 transition-all duration-500" 
                                         style="width: ${rate}%"></div>
                                </div>
                                <div class="flex justify-between items-center mt-1">
                                    <span class="text-[10px] text-gray-500">${count} unlocks</span>
                                    <span class="text-[10px] text-cyan-400 font-bold">${rate > 0 ? rate + '%' : '0%'}</span>
                                </div>
                            </div>
                        </div>
                    </div>`}).join('')}
            </div>
        `;

    } catch (err) {
        console.error('❌ Error loading achievements:', err);
        container.innerHTML = `<p class="text-red-400 text-sm">Failed to load achievements.</p>`;
    }
}

// ===== LOAD MEMORY LOGIC =====
async function loadMemoryLogic(rom, gameId) {
    const container = document.getElementById('memory-container');
    if (!container) return;

    try {
        // Fetch achievements that have memory_logic defined
        const {  achievements, error } = await rom.supabase
            .from('achievements')
            .select('id, title, description, points, badge_url, memory_logic, is_multiplayer')
            .eq('game_id', gameId)
            .not('memory_logic', 'is', null)
            .order('points', { ascending: false });

        if (error) throw error;

        if (!achievements || achievements.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-sm">No memory logic codes defined for this game's achievements.</p>`;
            return;
        }

        // Render memory codes list
        container.innerHTML = `
            <p class="text-gray-400 text-sm mb-4">${achievements.length} achievement${achievements.length > 1 ? 's' : ''} with memory logic</p>
            <div class="space-y-3">
                ${achievements.map(a => `
                    <div class="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                        <div class="flex items-start gap-3">
                            <img src="${a.badge_url || 'https://via.placeholder.com/32/1f2937/6b7280?text=🏆'}" 
                                 alt="${escapeHtml(a.title)}" 
                                 class="w-8 h-8 rounded object-cover flex-shrink-0">
                            <div class="flex-1 min-w-0">
                                <div class="flex justify-between items-start mb-1">
                                    <h3 class="text-sm font-bold text-cyan-300 truncate">${escapeHtml(a.title)}</h3>
                                    <span class="text-yellow-400 text-xs font-bold bg-yellow-900/30 px-1.5 py-0.5 rounded ml-2">${a.points} pts</span>
                                </div>
                                ${a.description ? `<p class="text-gray-400 text-xs mb-2">${escapeHtml(a.description)}</p>` : ''}
                                
                                <div class="mt-2">
                                    <div class="flex items-center justify-between mb-1">
                                        <span class="text-xs font-bold text-gray-400 uppercase">Memory Code:</span>
                                        <button onclick="copyMemoryCode('${escapeHtml(a.memory_logic)}')" 
                                                class="text-xs bg-cyan-600 hover:bg-cyan-700 text-white px-2 py-0.5 rounded transition">
                                            📋 Copy
                                        </button>
                                    </div>
                                    <code class="block bg-black/50 p-2 rounded text-green-400 text-xs font-mono overflow-x-auto border border-gray-700">
                                        ${escapeHtml(a.memory_logic)}
                                    </code>
                                </div>
                                
                                ${a.is_multiplayer ? `<span class="inline-block mt-2 bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded text-xs">🌐 Multiplayer</span>` : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

    } catch (err) {
        console.error('Error loading memory logic:', err);
        container.innerHTML = `<p class="text-red-400 text-sm">Failed to load memory codes.</p>`;
    }
}

// ===== COPY MEMORY CODE TO CLIPBOARD =====
window.copyMemoryCode = function(code) {
    navigator.clipboard.writeText(code).then(() => {
        // Show brief success feedback
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✅ Copied!';
        btn.classList.add('bg-green-600');
        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('bg-green-600');
        }, 1500);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
};

// ===== HELPER: Escape HTML =====
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
