// modules/game-detail/game-detail.js - WITH COMMENTS (MINIMAL ADDITION)
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

        // Render Game Info + Screenshots + Comments UI
        renderGame(game, content, rom);

        // Load Achievements with Real Calculations
        loadAchievements(rom, game.id);

        // Load Comments after DOM is ready
        setTimeout(() => {
            loadComments(rom, game.id);
            setupCommentForm(rom, game.id);
        }, 100);

    } catch (err) {
        console.error('❌ Exception:', err);
        loading.classList.add('hidden');
        error.classList.remove('hidden');
    }
}

// ===== RENDER GAME FUNCTION (Info + Screenshots + Comments UI) =====
function renderGame(game, container, rom) {
    // Safe user check for comments
    const isLoggedIn = rom?.currentUser;

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

                    <!-- 💬 COMMENTS SECTION -->
                    <div class="mt-12 border-t border-gray-700 pt-8">
                        <h2 class="text-2xl font-bold text-white mb-6">💬 Comments</h2>
                        
                        <!-- Login prompt -->
                        <div id="login-to-comment" class="${isLoggedIn ? 'hidden' : ''} mb-6">
                            <p class="text-gray-400">Please <a href="#/auth" class="text-cyan-400 hover:underline">log in</a> to join the discussion.</p>
                        </div>
                        
                        <!-- Comment Form -->
                        <form id="comment-form" class="${isLoggedIn ? '' : 'hidden'} mb-8">
                            <textarea id="comment-input" rows="3" 
                                      class="w-full bg-gray-800 border border-gray-700 rounded-lg p-4 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none transition" 
                                      placeholder="Share your thoughts about this game..."></textarea>
                            <div class="flex justify-end mt-3">
                                <button type="submit" id="submit-comment-btn" 
                                        class="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-lg font-medium transition">
                                    Post Comment
                                </button>
                            </div>
                        </form>
                        
                        <!-- Comments List -->
                        <div id="comments-list" class="space-y-4">
                            <div class="text-center py-4 text-gray-400">Loading comments...</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ===== LOAD ACHIEVEMENTS WITH REAL CALCULATIONS (UNCHANGED) =====
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

        // 4. Render Grid (EXACT SAME AS YOUR WORKING CODE)
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
                                    <div class="bg-cyan-500 h-1.5 rounded-full absolute top-0 left-0 transition-all duration-500" style="width: ${rate}%"></div>
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

// ===== LOAD COMMENTS =====
async function loadComments(rom, gameId) {
    const container = document.getElementById('comments-list');
    if (!container) return;

    try {
        const {  data, error } = await rom.supabase
            .from('game_comments')
            .select('*')
            .eq('game_id', gameId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
            container.innerHTML = data.map(c => createCommentHTML(c)).join('');
        } else {
            container.innerHTML = `<p class="text-gray-500 text-sm">No comments yet. Be the first!</p>`;
        }
    } catch (err) {
        console.error('Error loading comments:', err);
        container.innerHTML = `<p class="text-red-400 text-sm">Failed to load comments.</p>`;
    }
}

// ===== RENDER SINGLE COMMENT =====
function createCommentHTML(comment) {
    const date = new Date(comment.created_at).toLocaleDateString('en-US', { 
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
    const username = comment.username || comment.user_email?.split('@')[0] || 'Anonymous';
    const initials = username.substring(0, 2).toUpperCase();

    return `
        <div class="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <div class="flex items-start gap-3">
                <div class="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                    ${initials}
                </div>
                <div class="flex-1">
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-cyan-300 text-sm">${escapeHtml(username)}</span>
                        <span class="text-xs text-gray-500">${date}</span>
                    </div>
                    <p class="text-gray-300 text-sm whitespace-pre-line">${escapeHtml(comment.comment)}</p>
                </div>
            </div>
        </div>
    `;
}

// ===== SETUP COMMENT FORM =====
function setupCommentForm(rom, gameId) {
    const form = document.getElementById('comment-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('comment-input');
        const btn = document.getElementById('submit-comment-btn');
        const content = input.value.trim();

        if (!content || !rom?.currentUser) return;

        btn.disabled = true;
        btn.textContent = 'Posting...';

        try {
            const { error } = await rom.supabase.from('game_comments').insert({
                game_id: gameId,
                user_id: rom.currentUser.id,
                user_email: rom.currentUser.email,
                username: rom.currentUser.email.split('@')[0],
                comment: content
            });

            if (error) throw error;

            input.value = '';
            loadComments(rom, gameId);
            showNotification('✅ Comment posted!', 'success');

        } catch (err) {
            console.error('Error posting comment:', err);
            showNotification('❌ Failed to post comment.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Post Comment';
        }
    });
}

// ===== HELPERS =====
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transition-all duration-300 ${
        type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-cyan-600'
    } text-white`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
