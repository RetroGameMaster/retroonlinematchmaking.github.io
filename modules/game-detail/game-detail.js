// modules/game-detail/game-detail.js - FIXED SYNC ISSUE
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

        // Render Game Info + Screenshots + Playing Button
        renderGame(game, content, rom);

        // Load Achievements with Real Calculations
        loadAchievements(rom, game.id);

    } catch (err) {
        console.error('❌ Exception:', err);
        loading.classList.add('hidden');
        error.classList.remove('hidden');
    }
}

// ===== RENDER GAME FUNCTION =====
function renderGame(game, container, rom) {
    const currentUser = rom.currentUser;
    
    // Check if current user is already playing this game
    let isPlaying = false;
    if (currentUser) {
        // We check the profiles table data attached to the user object if available, 
        // otherwise fallback to metadata (though metadata is often stale)
        let currentGames = [];
        
        // Try to get from profile object first (if your auth listener attaches it)
        if (currentUser.currently_playing) {
             currentGames = currentUser.currently_playing;
        } 
        // Fallback to metadata
        else if (currentUser.user_metadata?.currently_playing) {
            try {
                currentGames = typeof currentUser.user_metadata.currently_playing === 'string' 
                    ? JSON.parse(currentUser.user_metadata.currently_playing) 
                    : currentUser.user_metadata.currently_playing;
            } catch (e) { currentGames = []; }
        }

        // Handle both ID objects (new) and Strings (old)
        if (Array.isArray(currentGames)) {
            isPlaying = currentGames.some(g => {
                if (typeof g === 'object') return g.id === game.id;
                return g.toLowerCase() === game.title.toLowerCase();
            });
        }
    }

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

                    <!-- 🎮 I'M PLAYING THIS BUTTON -->
                    <div class="mb-8 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                        ${!currentUser ? `
                            <p class="text-gray-400 text-sm mb-2">Want to track this game?</p>
                            <button onclick="window.location.hash='#/auth'" class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors text-sm">
                                🔒 Log In to Add to List
                            </button>
                        ` : `
                            <div id="playing-action-container">
                                ${isPlaying ? `
                                    <button id="btn-toggle-playing" class="w-full md:w-auto bg-red-900/30 hover:bg-red-900/50 border border-red-700 text-red-400 px-4 py-2 rounded transition-colors text-sm flex items-center justify-center gap-2">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        Remove from My List
                                    </button>
                                    <p class="text-green-400 text-xs mt-2">✓ Added to your profile</p>
                                ` : `
                                    <button id="btn-toggle-playing" class="w-full md:w-auto bg-cyan-700 hover:bg-cyan-600 text-white px-4 py-2 rounded transition-colors text-sm flex items-center justify-center gap-2">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                                        Add to My List
                                    </button>
                                    <p class="text-gray-500 text-xs mt-2">Show this game on your profile</p>
                                `}
                            </div>
                        `}
                    </div>
                    
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

                    <!-- 🏆 ACHIEVEMENTS SECTION -->
                    <div id="achievements-container" class="mb-8">
                        <h2 class="text-xl font-bold text-white mb-3">🏆 Achievements</h2>
                        <div class="text-center py-8 text-gray-400">
                            <div class="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-cyan-500"></div>
                            <p class="mt-2">Loading achievements...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Attach Event Listener for the Toggle Button
    const toggleBtn = document.getElementById('btn-toggle-playing');
    if (toggleBtn && currentUser) {
        toggleBtn.addEventListener('click', () => handleTogglePlaying(game, currentUser, rom, isPlaying));
    }
}

// ===== HANDLE TOGGLE PLAYING LOGIC (FIXED) =====
async function handleTogglePlaying(game, user, rom, isCurrentlyPlaying) {
    const btn = document.getElementById('btn-toggle-playing');
    const container = document.getElementById('playing-action-container');
    
    if (!btn) return;

    // Optimistic UI Update
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin mr-2">⟳</span> Updating...`;

    try {
        // 1. Fetch FRESH profile data directly from DB (don't trust cache/metadata)
        const { data: profile, error: fetchError } = await rom.supabase
            .from('profiles')
            .select('currently_playing')
            .eq('id', user.id)
            .single();

        if (fetchError) throw fetchError;

        let currentGames = [];
        if (profile?.currently_playing) {
            try {
                currentGames = typeof profile.currently_playing === 'string' 
                    ? JSON.parse(profile.currently_playing) 
                    : profile.currently_playing;
            } catch (e) { currentGames = []; }
        }

        // Ensure we are working with the new Object format { id, title, slug, cover }
        // Filter out any old string entries for this game just in case
        currentGames = currentGames.filter(g => {
            if (typeof g === 'object') return g.id !== game.id;
            return g.toLowerCase() !== game.title.toLowerCase();
        });

        let newGamesList;
        if (!isCurrentlyPlaying) {
            // ADD: Push the full game object
            newGamesList = [...currentGames, {
                id: game.id,
                title: game.title,
                slug: game.slug,
                cover_image_url: game.cover_image_url
            }];
        } else {
            // REMOVE: List is already filtered above
            newGamesList = currentGames;
        }

        // 2. Update Database
        const { error } = await rom.supabase
            .from('profiles')
            .update({ currently_playing: newGamesList })
            .eq('id', user.id);

        if (error) throw error;

        // 3. CRITICAL FIX: Update the local rom.currentUser object so the UI stays in sync
        // This prevents the "Add" button from reappearing immediately
        if (!rom.currentUser) rom.currentUser = {};
        rom.currentUser.currently_playing = newGamesList;
        
        // Also update metadata just in case other parts of the app use it
        rom.currentUser.user_metadata = rom.currentUser.user_metadata || {};
        rom.currentUser.user_metadata.currently_playing = newGamesList;

        // 4. Refresh UI locally
        if (container) {
            if (isCurrentlyPlaying) {
                // Was playing, now removed -> Show Add Button
                container.innerHTML = `
                    <button id="btn-toggle-playing" class="w-full md:w-auto bg-cyan-700 hover:bg-cyan-600 text-white px-4 py-2 rounded transition-colors text-sm flex items-center justify-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                        Add to My List
                    </button>
                    <p class="text-gray-500 text-xs mt-2">Show this game on your profile</p>
                `;
                document.getElementById('btn-toggle-playing').addEventListener('click', () => handleTogglePlaying(game, user, rom, false));
            } else {
                // Was not playing, now added -> Show Remove Button
                container.innerHTML = `
                    <button id="btn-toggle-playing" class="w-full md:w-auto bg-red-900/30 hover:bg-red-900/50 border border-red-700 text-red-400 px-4 py-2 rounded transition-colors text-sm flex items-center justify-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        Remove from My List
                    </button>
                    <p class="text-green-400 text-xs mt-2">✓ Added to your profile</p>
                `;
                document.getElementById('btn-toggle-playing').addEventListener('click', () => handleTogglePlaying(game, user, rom, true));
            }
        }

    } catch (err) {
        console.error('Error updating playing list:', err);
        alert('Failed to update list: ' + err.message);
        // Revert button on error
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    }
}

// ===== LOAD ACHIEVEMENTS =====
async function loadAchievements(rom, gameId) {
    const container = document.getElementById('achievements-container');
    if (!container) return;

    try {
        const { data: achievements, error: aError } = await rom.supabase
            .from('achievements')
            .select('*')
            .eq('game_id', gameId)
            .order('points', { ascending: false });

        if (aError || !achievements || achievements.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-sm">No achievements available for this game.</p>`;
            return;
        }

        const achievementIds = achievements.map(a => a.id);
        
        const { data: unlocks } = await rom.supabase
            .from('user_achievements')
            .select('user_id, achievement_id')
            .in('achievement_id', achievementIds);

        const totalPlayers = new Set(unlocks?.map(u => u.user_id)).size;
        
        const unlockCounts = {};
        if (unlocks) {
            unlocks.forEach(u => {
                unlockCounts[u.achievement_id] = (unlockCounts[u.achievement_id] || 0) + 1;
            });
        }

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
                            <div class="flex-shrink-0">
                                <img src="${a.badge_url || 'https://via.placeholder.com/48/1f2937/6b7280?text=🏆'}" 
                                     alt="${escapeHtml(a.title)}" class="w-12 h-12 rounded object-cover">
                            </div>
                            <div class="flex-1">
                                <div class="flex justify-between items-start">
                                    <h3 class="text-sm font-bold text-white leading-tight">${escapeHtml(a.title)}</h3>
                                    <span class="text-yellow-400 text-xs font-bold bg-yellow-900/30 px-1.5 py-0.5 rounded ml-2">${a.points} pts</span>
                                </div>
                                <p class="text-gray-400 text-xs mt-1 mb-2 line-clamp-2">${escapeHtml(a.description || '')}</p>
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
                    </div>
                `}).join('')}
            </div>
        `;

    } catch (err) {
        console.error('❌ Error loading achievements:', err);
        container.innerHTML = `<p class="text-red-400 text-sm">Failed to load achievements.</p>`;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
