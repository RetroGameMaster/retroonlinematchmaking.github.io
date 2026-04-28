// modules/game-detail/game-detail.js 

// ===== HELPER: Convert YouTube URLs to Embed Format =====
function getEmbedUrl(url) {
    if (!url) return '';
    url = url.trim();
    if (url.includes('youtube.com/embed/')) return url;

    let videoId = '';
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
    if (shortMatch) {
        videoId = shortMatch[1];
    } else {
        const params = new URLSearchParams(url.split('?')[1]);
        videoId = params.get('v');
    }

    if (videoId && videoId.length === 11) {
        return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
    }
    console.warn('Could not parse YouTube ID from:', url);
    return url;
}

// ===== MAIN INIT FUNCTION =====
export default async function initGameDetail(rom, identifier) {
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
        const result = await rom.supabase
            .from('games')
            .select('*')
            .eq('slug', identifier)
            .single();

        const game = result.data;
        const gameError = result.error;

        if (gameError || !game) {
            console.error('❌ Game not found:', gameError || 'No data');
            loading.classList.add('hidden');
            error.classList.remove('hidden');
            return;
        }

        console.log('✅ SUCCESS: Game loaded:', game.title);
        loading.classList.add('hidden');
        content.classList.remove('hidden');

        // Render Game Info + SEO + Ratings + Guides
        await renderGame(game, content, rom);

        // Load Achievements
        loadAchievements(rom, game.id);

    } catch (err) {
        console.error('❌ Exception:', err);
        loading.classList.add('hidden');
        error.classList.remove('hidden');
    }
}

// ===== RENDER GAME FUNCTION (NOW ASYNC) =====
async function renderGame(game, container, rom) {
    const currentUser = rom.currentUser;

    // 0. CHECK FOR GUIDES (New Step)
    let guideButtonHTML = '';
    try {
        const { data: guides } = await rom.supabase
            .from('guides')
            .select('id, title, slug')
            .eq('game_id', game.id)
            .eq('is_approved', true)
            .limit(1);

        if (guides && guides.length > 0) {
            const guide = guides[0];
            const guideLink = `#/guide/${guide.slug || guide.id}`;
            guideButtonHTML = `
                <a href="${guideLink}" class="block w-full text-center py-3 mt-4 bg-purple-900/50 hover:bg-purple-800 border border-purple-500 text-purple-200 font-bold rounded-lg transition shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                    📖 Read Setup Guide & Wiki
                </a>
            `;
        }
    } catch (e) {
        console.error('Error checking for guides', e);
    }

    // 1. SEO: Update Meta Tags & Schema
    updateMetaTags(game);
    injectSchemaMarkup(game);

    // 2. Handle Dynamic Background
    if (game.background_video_url || game.background_image_url) {
        document.body.style.background = 'transparent';
        const existingBg = document.getElementById('dynamic-game-bg');
        if (existingBg) existingBg.remove();

        const bgUrl = game.background_image_url || game.background_video_url;
        const isVideo = !game.background_image_url && bgUrl.toLowerCase().endsWith('.mp4');

        if (isVideo) {
            const bgVideo = document.createElement('video');
            bgVideo.id = 'dynamic-game-bg';
            bgVideo.src = bgUrl;
            bgVideo.autoplay = true;
            bgVideo.loop = true;
            bgVideo.muted = true;
            bgVideo.playsInline = true;
            Object.assign(bgVideo.style, {
                position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                objectFit: 'cover', zIndex: '-2', opacity: '0.45'
            });
            document.body.insertBefore(bgVideo, document.body.firstChild);
        } else {
            const bgImg = document.createElement('div');
            bgImg.id = 'dynamic-game-bg';
            Object.assign(bgImg.style, {
                position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                backgroundImage: `url(${bgUrl})`, backgroundSize: 'cover',
                backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                zIndex: '-2', opacity: '0.45'
            });
            document.body.insertBefore(bgImg, document.body.firstChild);
        }

        const existingOverlay = document.getElementById('bg-overlay');
        if (!existingOverlay) {
            const overlay = document.createElement('div');
            overlay.id = 'bg-overlay';
            Object.assign(overlay.style, {
                position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.65)', zIndex: '-1', pointerEvents: 'none'
            });
            document.body.insertBefore(overlay, document.body.firstChild);
        }
    }

    // 3. Prepare Rating Section HTML (Includes Guide Button)
    const ratingHTML = `
        <div class="mb-8 p-6 bg-gray-800/90 backdrop-blur-md rounded-xl border border-yellow-500/30 shadow-xl">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-bold text-white drop-shadow-md">User Rating</h3>
                <div class="flex items-center gap-2">
                    <span id="rating-average-display" class="text-3xl font-bold text-yellow-400 drop-shadow-md">${game.rating ? game.rating.toFixed(1) : '0.0'}</span>
                    <span class="text-gray-400 text-sm">/ 5.0</span>
                </div>
            </div>
            
            ${!currentUser ? `
                <p class="text-gray-300 text-sm mb-3">Log in to rate this game.</p>
                <button onclick="window.location.hash='#/auth'" class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm font-bold transition">
                    🔒 Log In to Rate
                </button>
            ` : `
                <div id="user-rating-container">
                    <p class="text-gray-300 text-xs mb-2">Your Rating:</p>
                    <div class="flex gap-1" id="star-input-container">
                        <!-- Stars injected by JS -->
                    </div>
                    <p id="rating-status-text" class="text-xs text-gray-400 mt-2 h-4"></p>
                </div>
            `}
            
            ${guideButtonHTML}
        </div>
    `;

    // 4. Prepare Button HTML (Playing List)
    const buttonContainerHTML = `
        <div class="mb-8 p-4 bg-gray-800/90 backdrop-blur-md rounded-lg border border-gray-700 shadow-xl">
            ${!currentUser ? `
                <p class="text-gray-300 text-sm mb-2 font-medium">Want to track this game?</p>
                <button onclick="window.location.hash='#/auth'" class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors text-sm font-bold shadow-lg">
                    🔒 Log In to Add to List
                </button>
            ` : `
                <div id="playing-action-container">
                    <div class="text-center text-gray-300 py-2 font-medium">
                        <span class="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-cyan-500 mr-2"></span>
                        Checking status...
                    </div>
                </div>
            `}
        </div>
    `;

    // 5. Prepare Metadata Panel (Semantic DL for SEO)
    const hasMetadata = game.developer || game.publisher || game.genre || game.release_date || (game.features && game.features.length > 0);
    const metadataHTML = hasMetadata ? `
        <div class="bg-gray-800/90 backdrop-blur-md rounded-xl border border-cyan-500/30 p-6 mb-8 shadow-xl">
            <h3 class="text-xl font-bold text-cyan-400 mb-4 border-b border-gray-700 pb-2 drop-shadow-md">📋 Game Information</h3>
            <dl class="grid grid-cols-1 gap-4 text-sm">
                ${game.developer ? `
                    <div class="flex justify-between border-b border-gray-700/50 pb-2">
                        <dt class="text-gray-300 font-medium">Developer</dt>
                        <dd class="text-white font-bold drop-shadow-md">${escapeHtml(game.developer)}</dd>
                    </div>
                ` : ''}
                ${game.publisher ? `
                    <div class="flex justify-between border-b border-gray-700/50 pb-2">
                        <dt class="text-gray-300 font-medium">Publisher</dt>
                        <dd class="text-white font-bold drop-shadow-md">${escapeHtml(game.publisher)}</dd>
                    </div>
                ` : ''}
                ${game.genre ? `
                    <div class="flex justify-between border-b border-gray-700/50 pb-2">
                        <dt class="text-gray-300 font-medium">Genre</dt>
                        <dd class="text-white font-bold drop-shadow-md">${escapeHtml(game.genre)}</dd>
                    </div>
                ` : ''}
                ${game.release_date ? `
                    <div class="flex justify-between border-b border-gray-700/50 pb-2">
                        <dt class="text-gray-300 font-medium">Released</dt>
                        <dd class="text-white font-bold drop-shadow-md">${new Date(game.release_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</dd>
                    </div>
                ` : ''}
                ${game.features && game.features.length > 0 ? `
                    <div class="pt-2">
                        <dt class="text-gray-300 font-medium block mb-2">Features</dt>
                        <dd class="flex flex-wrap gap-2">
                            ${game.features.map(f => `<span class="bg-cyan-900/60 text-cyan-200 px-2 py-1 rounded text-xs border border-cyan-700 font-bold drop-shadow-md">${escapeHtml(f)}</span>`).join('')}
                        </dd>
                    </div>
                ` : ''}
            </dl>
        </div>
    ` : '';

    // 6. Video & Connection Details
    const videoHTML = game.video_url ? `
        <div class="mb-8 bg-black rounded-xl overflow-hidden border border-gray-700 shadow-2xl relative" style="aspect-ratio: 16/9;">
            <iframe src="${getEmbedUrl(game.video_url)}" title="Game Trailer" frameborder="0" allowfullscreen class="w-full h-full absolute top-0 left-0"></iframe>
        </div>
    ` : '';

    let connectionDetails = [];
    if (game.connection_details) {
        try {
            const parsed = typeof game.connection_details === 'string' ? JSON.parse(game.connection_details) : game.connection_details;
            if (Array.isArray(parsed)) connectionDetails = parsed;
        } catch (e) { /* ignore */ }
    }
    if (connectionDetails.length === 0 && (game.connection_method || game.server_details)) {
        connectionDetails.push({ name: game.connection_method || 'General Connection', instructions: game.server_details || 'See description.', type: 'other' });
    }

    const connectionHTML = connectionDetails.length > 0 ? `
        <div class="bg-gray-800/90 backdrop-blur-md rounded-xl border border-purple-500/30 p-6 mb-8 shadow-xl">
            <h3 class="text-xl font-bold text-purple-400 mb-4 border-b border-gray-700 pb-2 drop-shadow-md">🔌 How to Connect</h3>
            <div class="space-y-6">
                ${connectionDetails.map((method, idx) => `
                    <div class="bg-gray-900/60 rounded-lg p-4 border border-gray-700 shadow-lg">
                        <div class="flex items-center gap-3 mb-3">
                            <span class="flex items-center justify-center w-8 h-8 rounded-full bg-purple-900/60 text-purple-300 font-bold border border-purple-600 shadow-md">${idx + 1}</span>
                            <h4 class="text-lg font-bold text-white drop-shadow-md">${escapeHtml(method.name)}</h4>
                        </div>
                        ${method.instructions ? `<p class="text-gray-300 text-sm whitespace-pre-line ml-11 font-medium">${escapeHtml(method.instructions)}</p>` : ''}
                        ${method.serverAddress ? `
                            <div class="mt-3 ml-11 flex items-center gap-2 bg-black/50 p-2 rounded border border-gray-600">
                                <code class="text-cyan-300 font-mono text-sm select-all font-bold">${method.serverAddress}</code>
                                <button onclick="navigator.clipboard.writeText('${method.serverAddress}'); alert('Copied!')" class="ml-auto text-gray-400 hover:text-white">📋</button>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    ` : '';

    // 7. Main Layout Construction
    container.innerHTML = `
        <div class="max-w-7xl mx-auto p-4 relative z-10">
            <a href="#/games" class="text-cyan-400 hover:text-cyan-300 hover:underline mb-4 inline-block flex items-center gap-2 font-bold drop-shadow-md transition">
                <span>←</span> Back to Games
            </a>
            
            <div class="flex flex-col lg:flex-row gap-8">
                <!-- Left Column -->
                <div class="lg:w-1/3 space-y-6">
                    <div class="sticky top-4">
                        ${game.cover_image_url 
                            ? `<img src="${game.cover_image_url}" class="w-full rounded-lg shadow-2xl border-2 border-gray-600" alt="${escapeHtml(game.title)} cover art">` 
                            : '<div class="w-full h-64 bg-gray-700 rounded-lg flex items-center justify-center text-4xl border-2 border-gray-600 shadow-xl">🎮</div>'}
                        
                        ${ratingHTML}
                        ${buttonContainerHTML}
                    </div>
                    ${metadataHTML}
                </div>
                
                <!-- Right Column -->
                <div class="lg:w-2/3">
                    <h1 class="text-4xl md:text-5xl font-bold text-white mb-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">${escapeHtml(game.title)}</h1>
                    
                    <div class="flex gap-2 mb-6 flex-wrap">
                        <span class="bg-cyan-900/60 text-cyan-200 border border-cyan-600 px-3 py-1 rounded text-sm font-bold shadow-md">${escapeHtml(game.console)}</span>
                        ${game.year ? `<span class="bg-gray-800/80 text-gray-200 border border-gray-600 px-3 py-1 rounded text-sm font-bold shadow-md">${game.year}</span>` : ''}
                    </div>
                    
                    <div class="prose prose-invert max-w-none mb-8 bg-gray-900/40 p-6 rounded-xl border border-gray-700/50 backdrop-blur-sm">
                        <p class="text-gray-200 text-lg leading-relaxed whitespace-pre-line font-medium drop-shadow-md">${escapeHtml(game.description || 'No description available.')}</p>
                    </div>

                    ${videoHTML}
                    ${connectionHTML}
                    
                    ${game.screenshot_urls && game.screenshot_urls.length > 0 ? `
                        <div class="mb-8">
                            <h2 class="text-2xl font-bold text-white mb-4 border-b border-gray-700 pb-2 drop-shadow-md">🖼️ Screenshots</h2>
                            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                                ${game.screenshot_urls.map(url => `
                                    <img src="${url}" alt="Screenshot of ${escapeHtml(game.title)}" 
                                         class="w-full h-40 object-cover rounded-lg border border-gray-600 hover:border-cyan-400 hover:scale-105 transition-all duration-300 cursor-pointer shadow-lg"
                                         onclick="this.classList.toggle('h-96'); this.classList.toggle('col-span-2'); this.classList.toggle('md:col-span-3');">
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <div id="achievements-container" class="mb-8">
                        <h2 class="text-2xl font-bold text-white mb-4 border-b border-gray-700 pb-2 drop-shadow-md">🏆 Achievements</h2>
                        <div class="text-center py-8 text-gray-300 font-medium">
                            <div class="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-cyan-500"></div>
                            <p class="mt-2">Loading achievements...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Initialize Logic
    if (currentUser) {
        checkAndRenderPlayingState(game, currentUser.id, rom);
        loadUserRating(game, currentUser.id, rom);
    }
}

// ===== SEO: UPDATE META TAGS =====
function updateMetaTags(game) {
    const title = `${game.title} (${game.console}) - Online Multiplayer Guide & Servers`;
    const description = `Play ${game.title} on ${game.console} online. Server details, connection guides, and community ratings. Released in ${game.year || 'N/A'}.`;
    
    document.title = title;
    
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = "description";
        document.head.appendChild(metaDesc);
    }
    metaDesc.content = description;

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = "canonical";
        document.head.appendChild(canonical);
    }
    canonical.href = window.location.href;
}

// ===== SEO: INJECT SCHEMA MARKUP (JSON-LD) =====
function injectSchemaMarkup(game) {
    const schema = {
        "@context": "https://schema.org",
        "@type": "VideoGame",
        "name": game.title,
        "description": game.description,
        "genre": game.genre || "Retro",
        "platform": game.console,
        "applicationCategory": "Game",
        "operatingSystem": game.console,
        "datePublished": game.release_date || (game.year ? `${game.year}-01-01` : null),
        "author": {
            "@type": "Organization",
            "name": game.developer || "Unknown"
        },
        "publisher": {
            "@type": "Organization",
            "name": game.publisher || "Unknown"
        },
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": game.rating ? game.rating.toFixed(1) : "0",
            "bestRating": "5",
            "worstRating": "1",
            "ratingCount": "1"
        },
        "image": game.cover_image_url || ""
    };

    const script = document.createElement('script');
    script.type = "application/ld+json";
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);
}

// ===== RATING SYSTEM LOGIC =====
async function loadUserRating(game, userId, rom) {
    const container = document.getElementById('star-input-container');
    const statusText = document.getElementById('rating-status-text');
    if (!container) return;

    try {
        const { data, error } = await rom.supabase
            .from('game_ratings')
            .select('rating')
            .eq('game_id', game.id)
            .eq('user_id', userId)
            .single();

        const userRating = data ? data.rating : 0;
        renderStars(container, userRating, game, userId, rom, statusText);

    } catch (err) {
        console.error("Error loading rating:", err);
        if(container) container.innerHTML = `<span class="text-xs text-red-400">Error loading rating</span>`;
    }
}

function renderStars(container, currentRating, game, userId, rom, statusText) {
    container.innerHTML = '';
    
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('button');
        star.type = 'button';
        star.className = `text-2xl transition-transform hover:scale-110 focus:outline-none ${i <= currentRating ? 'text-yellow-400' : 'text-gray-600'}`;
        star.innerHTML = '★';
        star.setAttribute('aria-label', `Rate ${i} stars`);
        
        star.addEventListener('click', async () => {
            renderStars(container, i, game, userId, rom, statusText);
            statusText.textContent = "Saving rating...";
            
            try {
                const { error } = await rom.supabase
                    .from('game_ratings')
                    .upsert({ 
                        game_id: game.id, 
                        user_id: userId, 
                        rating: i 
                    }, { onConflict: 'user_id,game_id' });

                if (error) throw error;

                statusText.textContent = "Rating saved!";
                setTimeout(() => { statusText.textContent = ""; }, 2000);

            } catch (err) {
                console.error("Failed to save rating:", err);
                statusText.textContent = "Failed to save.";
                renderStars(container, currentRating, game, userId, rom, statusText);
            }
        });
        
        container.appendChild(star);
    }
}

// ===== EXISTING FUNCTIONS (Playing State, Achievements, etc.) =====
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
                currentGames = typeof raw === 'string' ? JSON.parse(raw) : raw;
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

function renderPlayingButton(container, game, userId, rom, isPlaying) {
    if (isPlaying) {
        container.innerHTML = `
            <button id="btn-toggle-playing" class="w-full bg-red-900/40 hover:bg-red-900/60 border border-red-600 text-red-300 px-4 py-3 rounded-lg transition-colors text-sm font-bold flex items-center justify-center gap-2 shadow-lg">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                Remove from My List
            </button>
            <p class="text-green-400 text-xs mt-2 text-center font-bold">✓ Added to your profile</p>
        `;
        document.getElementById('btn-toggle-playing').addEventListener('click', () => handleTogglePlaying(game, userId, rom, true));
    } else {
        container.innerHTML = `
            <button id="btn-toggle-playing" class="w-full bg-cyan-700 hover:bg-cyan-600 text-white px-4 py-3 rounded-lg transition-colors text-sm font-bold flex items-center justify-center gap-2 shadow-lg">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                Add to My List
            </button>
            <p class="text-gray-400 text-xs mt-2 text-center font-bold">Show this game on your profile</p>
        `;
        document.getElementById('btn-toggle-playing').addEventListener('click', () => handleTogglePlaying(game, userId, rom, false));
    }
}

async function handleTogglePlaying(game, userId, rom, isCurrentlyPlaying) {
    const btn = document.getElementById('btn-toggle-playing');
    const container = document.getElementById('playing-action-container');
    if (!btn) return;
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin mr-2">⟳</span> Updating...`;
    try {
        const { data: profile } = await rom.supabase.from('profiles').select('currently_playing').eq('id', userId).single();
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
            const gameObj = { id: game.id, title: game.title, slug: game.slug, cover_image_url: game.cover_image_url };
            newGamesList = [...cleanList, gameObj];
        }
        const { error } = await rom.supabase.from('profiles').update({ currently_playing: newGamesList }).eq('id', userId);
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
        if (btn) { btn.disabled = false; btn.innerHTML = originalContent; }
    }
}

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
            container.innerHTML = `<p class="text-gray-400 text-sm font-medium">No achievements available for this game.</p>`;
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
            unlocks.forEach(u => { unlockCounts[u.achievement_id] = (unlockCounts[u.achievement_id] || 0) + 1; });
        }
        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${achievements.map(a => {
                    const count = unlockCounts[a.id] || 0;
                    const rate = totalPlayers > 0 ? Math.round((count / totalPlayers) * 100) : 0;
                    return `
                    <div class="bg-gray-800/90 backdrop-blur rounded-lg p-4 border border-gray-700 hover:border-cyan-500 transition shadow-xl">
                        <div class="flex gap-3">
                            <div class="flex-shrink-0">
                                <img src="${a.badge_url || 'https://via.placeholder.com/48/1f2937/6b7280?text=🏆'}" 
                                     alt="${escapeHtml(a.title)}" class="w-12 h-12 rounded object-cover border border-gray-600 shadow-md">
                            </div>
                            <div class="flex-1">
                                <div class="flex justify-between items-start">
                                    <h3 class="text-sm font-bold text-white leading-tight drop-shadow-md">${escapeHtml(a.title)}</h3>
                                    <span class="text-yellow-400 text-xs font-bold bg-yellow-900/40 px-1.5 py-0.5 rounded ml-2 border border-yellow-700/50 shadow-sm">${a.points} pts</span>
                                </div>
                                <p class="text-gray-300 text-xs mt-1 mb-2 line-clamp-2 font-medium">${escapeHtml(a.description || '')}</p>
                                <div class="w-full bg-gray-700 rounded-full h-1.5 mt-1 relative overflow-hidden">
                                    <div class="bg-cyan-500 h-1.5 rounded-full absolute top-0 left-0 transition-all duration-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]" style="width: ${rate}%"></div>
                                </div>
                                <div class="flex justify-between items-center mt-1">
                                    <span class="text-[10px] text-gray-400 font-bold">${count} unlocks</span>
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
