// modules/game-detail/game-detail.js - COMPLETE WITH NEW FEATURES & YOUTUBE FIX
let isInitialized = false;

// ===== HELPER: Convert YouTube URLs to Embed Format (Robust) =====
function getEmbedUrl(url) {
    if (!url) return '';
    
    // Trim whitespace
    url = url.trim();

    // If it's already an embed URL, return as is
    if (url.includes('youtube.com/embed/')) {
        return url;
    }

    let videoId = '';

    // 1. Handle youtu.be short links (e.g., https://youtu.be/VIDEO_ID)
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
    if (shortMatch) {
        videoId = shortMatch[1];
    } 
    // 2. Handle standard watch URLs (e.g., https://www.youtube.com/watch?v=VIDEO_ID&t=...)
    else {
        const params = new URLSearchParams(url.split('?')[1]);
        videoId = params.get('v');
    }

    // If we found a valid ID (11 chars), construct embed URL
    if (videoId && videoId.length === 11) {
        return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
    }

    // Fallback: Return original if no ID found (might be direct .mp4)
    console.warn('Could not parse YouTube ID from:', url);
    return url;
}
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

        // Render Game Info + Screenshots + Playing Button + New Features
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
    
   // 1. Handle Dynamic Background (Video, GIF, or Image)
if (game.background_video_url || game.background_image_url) {
    document.body.style.background = 'transparent';
    document.body.style.overflow = 'hidden';
    
    const existingBg = document.getElementById('dynamic-game-bg');
    if (existingBg) existingBg.remove();

    // Priority: Image/GIF overrides Video if both exist
    const bgUrl = game.background_image_url || game.background_video_url;
    
    // Detect if it's a video file (.mp4) or an image/gif
    const isVideo = !game.background_image_url && bgUrl.toLowerCase().endsWith('.mp4');

    if (isVideo) {
        // Render Video Background
        const bgVideo = document.createElement('video');
        bgVideo.id = 'dynamic-game-bg';
        bgVideo.src = bgUrl;
        bgVideo.autoplay = true;
        bgVideo.loop = true;
        bgVideo.muted = true;
        bgVideo.playsInline = true;
        Object.assign(bgVideo.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            objectFit: 'cover', zIndex: '-1', opacity: '0.4'
        });
        document.body.insertBefore(bgVideo, document.body.firstChild);
    } else {
        // Render Image/GIF Background
        const bgImg = document.createElement('div');
        bgImg.id = 'dynamic-game-bg';
        bgImg.style.backgroundImage = `url(${bgUrl})`;
        bgImg.style.backgroundSize = 'cover';
        bgImg.style.backgroundPosition = 'center';
        bgImg.style.position = 'fixed';
        bgImg.style.top = '0';
        bgImg.style.left = '0';
        bgImg.style.width = '100%';
        bgImg.style.height = '100%';
        bgImg.style.zIndex = '-1';
        bgImg.style.opacity = '0.4';
        document.body.insertBefore(bgImg, document.body.firstChild);
    }
}
    // 2. Prepare Button HTML
    const buttonContainerHTML = `
        <div class="mb-8 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            ${!currentUser ? `
                <p class="text-gray-400 text-sm mb-2">Want to track this game?</p>
                <button onclick="window.location.hash='#/auth'" class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors text-sm">
                    🔒 Log In to Add to List
                </button>
            ` : `
                <div id="playing-action-container">
                    <div class="text-center text-gray-400 py-2">
                        <span class="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-cyan-500 mr-2"></span>
                        Checking status...
                    </div>
                </div>
            `}
        </div>
    `;

    // 3. Prepare Metadata Panel (New)
    const hasMetadata = game.developer || game.publisher || game.genre || game.release_date || (game.features && game.features.length > 0);
    const metadataHTML = hasMetadata ? `
        <div class="bg-gray-800/80 backdrop-blur-md rounded-xl border border-cyan-500/30 p-6 mb-8 shadow-lg">
            <h3 class="text-xl font-bold text-cyan-400 mb-4 border-b border-gray-700 pb-2">📋 Game Information</h3>
            <div class="grid grid-cols-1 gap-4 text-sm">
                ${game.developer ? `
                    <div class="flex justify-between border-b border-gray-700/50 pb-2">
                        <span class="text-gray-400">Developer</span>
                        <span class="text-white font-medium">${escapeHtml(game.developer)}</span>
                    </div>
                ` : ''}
                ${game.publisher ? `
                    <div class="flex justify-between border-b border-gray-700/50 pb-2">
                        <span class="text-gray-400">Publisher</span>
                        <span class="text-white font-medium">${escapeHtml(game.publisher)}</span>
                    </div>
                ` : ''}
                ${game.genre ? `
                    <div class="flex justify-between border-b border-gray-700/50 pb-2">
                        <span class="text-gray-400">Genre</span>
                        <span class="text-white font-medium">${escapeHtml(game.genre)}</span>
                    </div>
                ` : ''}
                ${game.release_date ? `
                    <div class="flex justify-between border-b border-gray-700/50 pb-2">
                        <span class="text-gray-400">Released</span>
                        <span class="text-white font-medium">${new Date(game.release_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    </div>
                ` : ''}
                ${game.features && game.features.length > 0 ? `
                    <div class="pt-2">
                        <span class="text-gray-400 block mb-2">Features</span>
                        <div class="flex flex-wrap gap-2">
                            ${game.features.map(f => `<span class="bg-cyan-900/40 text-cyan-300 px-2 py-1 rounded text-xs border border-cyan-800">${escapeHtml(f)}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    ` : '';

    // 4. Prepare Video Section (New) - FIXED WITH getEmbedUrl
    const videoHTML = game.video_url ? `
        <div class="mb-8 bg-black rounded-xl overflow-hidden border border-gray-700 shadow-lg relative" style="aspect-ratio: 16/9;">
            <iframe 
                src="${getEmbedUrl(game.video_url)}" 
                title="Game Trailer" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen
                class="w-full h-full absolute top-0 left-0">
            </iframe>
        </div>
    ` : '';

    // 5. Prepare Connection Details (New)
    // Try to parse JSON details first, fallback to old text fields
    let connectionDetails = [];
    if (game.connection_details) {
        try {
            const parsed = typeof game.connection_details === 'string' ? JSON.parse(game.connection_details) : game.connection_details;
            if (Array.isArray(parsed)) connectionDetails = parsed;
        } catch (e) { /* ignore */ }
    }
    
    // If no structured details, create one from old fields
    if (connectionDetails.length === 0 && (game.connection_method || game.server_details)) {
        connectionDetails.push({
            name: game.connection_method || 'General Connection',
            instructions: game.server_details || 'See description for details.',
            type: 'other'
        });
    }

    const connectionHTML = connectionDetails.length > 0 ? `
        <div class="bg-gray-800/80 backdrop-blur-md rounded-xl border border-purple-500/30 p-6 mb-8 shadow-lg">
            <h3 class="text-xl font-bold text-purple-400 mb-4 border-b border-gray-700 pb-2">🔌 How to Connect</h3>
            <div class="space-y-6">
                ${connectionDetails.map((method, idx) => `
                    <div class="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                        <div class="flex items-center gap-3 mb-3">
                            <span class="flex items-center justify-center w-8 h-8 rounded-full bg-purple-900/50 text-purple-400 font-bold border border-purple-700">${idx + 1}</span>
                            <h4 class="text-lg font-bold text-white">${escapeHtml(method.name)}</h4>
                            ${method.type ? `<span class="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded uppercase">${method.type}</span>` : ''}
                        </div>
                        ${method.instructions ? `<p class="text-gray-300 text-sm whitespace-pre-line ml-11">${escapeHtml(method.instructions)}</p>` : ''}
                        ${method.serverAddress ? `
                            <div class="mt-3 ml-11 flex items-center gap-2 bg-black/40 p-2 rounded border border-gray-700">
                                <span class="text-xs text-gray-500 uppercase font-bold">Server/DNS:</span>
                                <code class="text-cyan-400 font-mono text-sm select-all">${method.serverAddress}</code>
                                <button onclick="navigator.clipboard.writeText('${method.serverAddress}'); alert('Copied!')" class="ml-auto text-gray-500 hover:text-white" title="Copy">
                                    📋
                                </button>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    ` : '';

    // 6. Main Layout Construction
    container.innerHTML = `
        <div class="max-w-7xl mx-auto p-4 relative z-10">
            <a href="#/games" class="text-cyan-400 hover:underline mb-4 inline-block flex items-center gap-2">
                <span>←</span> Back to Games
            </a>
            
            <div class="flex flex-col lg:flex-row gap-8">
                <!-- Left Column: Cover + Metadata + Connection -->
                <div class="lg:w-1/3 space-y-6">
                    <!-- Cover Image -->
                    <div class="sticky top-4">
                        ${game.cover_image_url 
                            ? `<img src="${game.cover_image_url}" class="w-full rounded-lg shadow-2xl border-2 border-gray-700" alt="${escapeHtml(game.title)}">` 
                            : '<div class="w-full h-64 bg-gray-700 rounded-lg flex items-center justify-center text-4xl border-2 border-gray-600">🎮</div>'}
                        
                        <!-- Playing Button (Moved to sidebar for better layout) -->
                        ${buttonContainerHTML}
                    </div>

                    <!-- Metadata Side Panel -->
                    ${metadataHTML}
                </div>
                
                <!-- Right Column: Title, Desc, Video, Connections, Screenshots, Achievements -->
                <div class="lg:w-2/3">
                    <h1 class="text-4xl md:text-5xl font-bold text-white mb-2 drop-shadow-lg">${escapeHtml(game.title)}</h1>
                    
                    <div class="flex gap-2 mb-6 flex-wrap">
                        <span class="bg-cyan-900/40 text-cyan-300 border border-cyan-700 px-3 py-1 rounded text-sm font-bold shadow-sm">${escapeHtml(game.console)}</span>
                        ${game.year ? `<span class="bg-gray-800 text-gray-300 border border-gray-600 px-3 py-1 rounded text-sm shadow-sm">${game.year}</span>` : ''}
                    </div>
                    
                    <div class="prose prose-invert max-w-none mb-8">
                        <p class="text-gray-300 text-lg leading-relaxed whitespace-pre-line">${escapeHtml(game.description || 'No description available.')}</p>
                    </div>

                    <!-- Video Showcase -->
                    ${videoHTML}

                    <!-- Connection Details -->
                    ${connectionHTML}
                    
                    <!-- Screenshots Section -->
                    ${game.screenshot_urls && game.screenshot_urls.length > 0 ? `
                        <div class="mb-8">
                            <h2 class="text-2xl font-bold text-white mb-4 border-b border-gray-700 pb-2">🖼️ Screenshots</h2>
                            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                                ${game.screenshot_urls.map(url => `
                                    <img src="${url}" 
                                         alt="Screenshot" 
                                         class="w-full h-40 object-cover rounded-lg border border-gray-700 hover:border-cyan-500 hover:scale-105 transition-all duration-300 cursor-pointer shadow-lg"
                                         onclick="this.classList.toggle('h-96'); this.classList.toggle('col-span-2'); this.classList.toggle('md:col-span-3');">
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Achievements Section -->
                    <div id="achievements-container" class="mb-8">
                        <h2 class="text-2xl font-bold text-white mb-4 border-b border-gray-700 pb-2">🏆 Achievements</h2>
                        <div class="text-center py-8 text-gray-400">
                            <div class="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-cyan-500"></div>
                            <p class="mt-2">Loading achievements...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Initialize Button Logic
    if (currentUser) {
        checkAndRenderPlayingState(game, currentUser.id, rom);
    }
}

// ===== CHECK PLAYING STATE (Preserved Original Logic) =====
async function checkAndRenderPlayingState(game, userId, rom) {
    const container = document.getElementById('playing-action-container');
    if (!container) return;

    try {
        const { data: profile, error } = await rom.supabase
            .from('profiles')
            .select('currently_playing')
            .eq('id', userId)
            .single();

        if (error) throw error;

        let currentGames = [];
        if (profile?.currently_playing) {
            try {
                const raw = profile.currently_playing;
                if (typeof raw === 'string') {
                    currentGames = JSON.parse(raw);
                } else {
                    currentGames = raw;
                }
            } catch (e) { currentGames = []; }
        }

        const isPlaying = currentGames.some(g => {
            if (typeof g === 'string') return g.toLowerCase() === game.title.toLowerCase();
            if (typeof g === 'object') return (g.id === game.id) || (g.title && g.title.toLowerCase() === game.title.toLowerCase());
            return false;
        });

        renderPlayingButton(container, game, userId, rom, isPlaying);

    } catch (err) {
        console.error("Error checking playing state:", err);
        container.innerHTML = `<p class="text-red-400 text-xs">Error loading status.</p>`;
    }
}

// ===== RENDER BUTTON (Preserved Original Logic) =====
function renderPlayingButton(container, game, userId, rom, isPlaying) {
    if (isPlaying) {
        container.innerHTML = `
            <button id="btn-toggle-playing" class="w-full bg-red-900/30 hover:bg-red-900/50 border border-red-700 text-red-400 px-4 py-3 rounded-lg transition-colors text-sm font-bold flex items-center justify-center gap-2 shadow-lg">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                Remove from My List
            </button>
            <p class="text-green-400 text-xs mt-2 text-center font-medium">✓ Added to your profile</p>
        `;
        document.getElementById('btn-toggle-playing').addEventListener('click', () => handleTogglePlaying(game, userId, rom, true));
    } else {
        container.innerHTML = `
            <button id="btn-toggle-playing" class="w-full bg-cyan-700 hover:bg-cyan-600 text-white px-4 py-3 rounded-lg transition-colors text-sm font-bold flex items-center justify-center gap-2 shadow-lg">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                Add to My List
            </button>
            <p class="text-gray-500 text-xs mt-2 text-center font-medium">Show this game on your profile</p>
        `;
        document.getElementById('btn-toggle-playing').addEventListener('click', () => handleTogglePlaying(game, userId, rom, false));
    }
}

// ===== HANDLE TOGGLE PLAYING (Preserved Original Logic) =====
async function handleTogglePlaying(game, userId, rom, isCurrentlyPlaying) {
    const btn = document.getElementById('btn-toggle-playing');
    const container = document.getElementById('playing-action-container');
    
    if (!btn) return;

    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin mr-2">⟳</span> Updating...`;

    try {
        const { data: profile } = await rom.supabase
            .from('profiles')
            .select('currently_playing')
            .eq('id', userId)
            .single();

        let currentGames = [];
        if (profile?.currently_playing) {
            try {
                const raw = profile.currently_playing;
                currentGames = typeof raw === 'string' ? JSON.parse(raw) : raw;
            } catch (e) { currentGames = []; }
        }

        const cleanList = currentGames.filter(g => {
            if (typeof g === 'string') return g.toLowerCase() !== game.title.toLowerCase();
            if (typeof g === 'object') return g.id !== game.id;
            return true;
        });

        let newGamesList;
        if (isCurrentlyPlaying) {
            newGamesList = cleanList;
        } else {
            const gameObj = {
                id: game.id,
                title: game.title,
                slug: game.slug,
                cover_image_url: game.cover_image_url
            };
            newGamesList = [...cleanList, gameObj];
        }

        const { error } = await rom.supabase
            .from('profiles')
            .update({ currently_playing: newGamesList })
            .eq('id', userId);

        if (error) throw error;

        if (rom.currentUser) {
            rom.currentUser.user_metadata = rom.currentUser.user_metadata || {};
            rom.currentUser.user_metadata.currently_playing = newGamesList;
            rom.currentUser.currently_playing = newGamesList;
        }

        renderPlayingButton(container, game, userId, rom, !isCurrentlyPlaying);

    } catch (err) {
        console.error('Error updating playing list:', err);
        alert('Failed to update list: ' + err.message);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    }
}

// ===== LOAD ACHIEVEMENTS (Preserved Original Logic) =====
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
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${achievements.map(a => {
                    const count = unlockCounts[a.id] || 0;
                    const rate = totalPlayers > 0 ? Math.round((count / totalPlayers) * 100) : 0;
                    
                    return `
                    <div class="bg-gray-800/80 backdrop-blur rounded-lg p-4 border border-gray-700 hover:border-cyan-500 transition shadow-lg">
                        <div class="flex gap-3">
                            <div class="flex-shrink-0">
                                <img src="${a.badge_url || 'https://via.placeholder.com/48/1f2937/6b7280?text=🏆'}" 
                                     alt="${escapeHtml(a.title)}" class="w-12 h-12 rounded object-cover border border-gray-600">
                            </div>
                            <div class="flex-1">
                                <div class="flex justify-between items-start">
                                    <h3 class="text-sm font-bold text-white leading-tight">${escapeHtml(a.title)}</h3>
                                    <span class="text-yellow-400 text-xs font-bold bg-yellow-900/30 px-1.5 py-0.5 rounded ml-2 border border-yellow-700/50">${a.points} pts</span>
                                </div>
                                <p class="text-gray-400 text-xs mt-1 mb-2 line-clamp-2">${escapeHtml(a.description || '')}</p>
                                <div class="w-full bg-gray-700 rounded-full h-1.5 mt-1 relative overflow-hidden">
                                    <div class="bg-cyan-500 h-1.5 rounded-full absolute top-0 left-0 transition-all duration-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]" 
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
