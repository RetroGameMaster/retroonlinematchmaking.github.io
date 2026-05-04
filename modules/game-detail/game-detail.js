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
        return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=1`;
    }
    console.warn('Could not parse YouTube ID from:', url);
    return url;
}

// ===== GLOBAL STATE FOR CHAT =====
let chatChannel = null;
let heartbeatInterval = null;
let currentRoomId = null;

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

        // 🚀 INITIALIZE LIVE SESSION PANEL
        initLiveSessionPanel(rom, game);

    } catch (err) {
        console.error('❌ Exception:', err);
        loading.classList.add('hidden');
        error.classList.remove('hidden');
    }
}

// ===== RENDER GAME FUNCTION =====
async function renderGame(game, container, rom) {
    const currentUser = rom.currentUser;

    // 0. CHECK FOR LINKED GUIDES
    let guideButtonHTML = '';
    try {
        const { data: links, error: linkError } = await rom.supabase
            .from('game_guides')
            .select('guide_id')
            .eq('game_id', game.id);

        if (!linkError && links && links.length > 0) {
            const guideIds = links.map(l => l.guide_id);
            const { data: guides, error: guideError } = await rom.supabase
                .from('guides')
                .select('id, title, slug')
                .in('id', guideIds)
                .eq('is_approved', true);

            if (!guideError && guides && guides.length > 0) {
                let buttonsHtml = '';
                guides.forEach(guide => {
                    const guideLink = `#/guide/${guide.slug || guide.id}`;
                    buttonsHtml += `
                        <a href="${guideLink}" class="flex items-center justify-between gap-3 w-full py-3 mb-3 last:mb-0 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded transition shadow-lg transform hover:-translate-y-0.5 border border-purple-400">
                            <div class="flex items-center gap-3">
                                <span class="text-xl bg-purple-800/50 p-2 rounded">📖</span>
                                <span class="text-left">${escapeHtml(guide.title)}</span>
                            </div>
                            <span class="ml-auto text-purple-200">Read Guide →</span>
                        </a>
                    `;
                });
                guideButtonHTML = `
                    <div class="mb-6 p-5 bg-purple-900/20 border border-purple-500/50 rounded-lg shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                        <h4 class="text-sm font-bold text-purple-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <span>📚</span> Official Setup Guides & Wikis
                        </h4>
                        ${buttonsHtml}
                        <p class="text-center text-xs text-purple-300 mt-4 opacity-75">Select a guide above to get started</p>
                    </div>
                `;
            }
        }
    } catch (e) {
        console.error('💥 [GUIDE CHECK] Critical error:', e);
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

    // 3. Prepare Rating Section HTML
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

    // 5. Prepare Metadata Panel
   const hasMetadata = game.developer || game.publisher || game.genre || game.release_date || (game.features && game.features.length > 0);
    
    // Helper to create hub links
    const makeHubLink = (type, value, label) => {
        if (!value) return '';
        const encodedValue = encodeURIComponent(value);
        return `
            <a href="#/games?filter=${type}&value=${encodedValue}" class="group flex items-center justify-between bg-gray-700/50 hover:bg-cyan-900/40 border border-gray-600 hover:border-cyan-500 rounded-lg p-3 transition-all duration-200">
                <div>
                    <span class="text-xs text-gray-400 uppercase tracking-wider font-bold block mb-1">${label}</span>
                    <span class="text-white font-bold text-base group-hover:text-cyan-300">${escapeHtml(value)}</span>
                </div>
                <svg class="w-5 h-5 text-gray-500 group-hover:text-cyan-400 transform group-hover:translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
            </a>
        `;
    };

    // Format Date for Month/Year Hub
    let releaseDateHub = '';
    if (game.release_date) {
        const dateObj = new Date(game.release_date);
        const monthYear = dateObj.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        const rawMonthYear = `${dateObj.getMonth() + 1}-${dateObj.getFullYear()}`; // Format for filtering logic if needed
        releaseDateHub = makeHubLink('release_month_year', monthYear, 'Released');
    }

    const metadataHTML = hasMetadata ? `
        <div class="bg-gray-800/90 backdrop-blur-md rounded-xl border border-cyan-500/30 p-6 mb-8 shadow-xl">
            <h3 class="text-xl font-bold text-cyan-400 mb-4 border-b border-gray-700 pb-2 drop-shadow-md">📋 Game Information Hubs</h3>
            <div class="space-y-3">
                ${game.developer ? makeHubLink('developer', game.developer, 'Developer') : ''}
                ${game.publisher ? makeHubLink('publisher', game.publisher, 'Publisher') : ''}
                ${game.genre ? makeHubLink('genre', game.genre, 'Genre') : ''}
                ${releaseDateHub}
                
                ${game.features && game.features.length > 0 ? `
                    <div class="pt-2">
                        <dt class="text-gray-300 font-medium block mb-2">Features</dt>
                        <dd class="flex flex-wrap gap-2">
                            ${game.features.map(f => `<span class="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs border border-gray-600">${escapeHtml(f)}</span>`).join('')}
                        </dd>
                    </div>
                ` : ''}
            </div>
        </div>
    ` : '';
    const forumButtonHTML = `
  <div class="mb-8 p-6 bg-gradient-to-r from-purple-900/80 to-indigo-900/80 backdrop-blur-md rounded-xl border border-purple-500/30 shadow-xl hover:border-purple-400 transition-colors cursor-pointer group" onclick="window.location.hash='#/game/${game.slug}/discuss'">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <div class="p-3 bg-purple-600 rounded-lg group-hover:scale-110 transition-transform shadow-lg">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"></path>
          </svg>
        </div>
        <div>
          <h3 class="text-lg font-bold text-white drop-shadow-md">Community Hub</h3>
          <p class="text-purple-200 text-xs">Discuss mods, textures, and find groups</p>
        </div>
      </div>
      <svg class="w-5 h-5 text-purple-300 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
      </svg>
    </div>
  </div>
`;
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

    // 7. Connection HTML
    const connectionHTML = (connectionDetails.length > 0 || guideButtonHTML) ? `
        <div class="bg-gray-800/90 backdrop-blur-md rounded-xl border border-purple-500/30 p-6 mb-8 shadow-xl">
            <h3 class="text-xl font-bold text-purple-400 mb-4 border-b border-gray-700 pb-2 drop-shadow-md">🔌 How to Connect</h3>
            
            ${guideButtonHTML}
            
            <div class="space-y-6">
                ${connectionDetails.length > 0 ? connectionDetails.map((method, idx) => `
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
                `).join('') : '<p class="text-gray-400 italic text-sm">No specific connection instructions yet. Check the guide above!</p>'}
            </div>
        </div>
    ` : '';

    // 8. Main Layout Construction
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
                    
                    ${forumButtonHTML}

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

                    <!-- 🚀 LIVE SESSION CONTAINER -->
                    <div id="live-session-container" class="mb-8"></div>

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

// ===== 🚀 NEW: LIVE SESSION LOGIC =====

async function initLiveSessionPanel(rom, game) {
    const container = document.getElementById('live-session-container');
    if (!container) return;

    // Cleanup previous session if any
    if (chatChannel) {
        rom.supabase.removeChannel(chatChannel);
        chatChannel = null;
    }
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    // Check for existing active room
    const { data: room } = await rom.supabase
        .from('chat_rooms')
        .select('*')
        .eq('game_id', game.id)
        .eq('is_ephemeral', true)
        .gt('last_activity', new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (room) {
        currentRoomId = room.id;
        renderActiveSession(container, room, rom, game);
        startHeartbeat(rom, room.id);
    } else {
        renderStartSessionButton(container, rom, game);
    }
}

function renderStartSessionButton(container, rom, game) {
    if (!rom.currentUser) {
        container.innerHTML = `
            <div class="bg-gray-800/90 backdrop-blur-md rounded-xl border border-green-500/30 p-6 text-center shadow-xl">
                <h3 class="text-xl font-bold text-green-400 mb-2">🟢 Start a Live Session</h3>
                <p class="text-gray-300 mb-4">Be the first to start a chat room for this game. Room stays active for 1 hour.</p>
                <button onclick="window.location.hash='#/auth'" class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded font-bold">Log In to Start</button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="bg-gray-800/90 backdrop-blur-md rounded-xl border border-green-500/30 p-6 text-center shadow-xl">
            <h3 class="text-xl font-bold text-green-400 mb-2">🟢 Start a Live Session</h3>
            <p class="text-gray-300 mb-4">No one is playing right now. Start a room to find players!</p>
            <button id="btn-start-session" class="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg transition transform hover:scale-105">
                🚀 Start Room & Look for Players
            </button>
        </div>
    `;

    document.getElementById('btn-start-session').addEventListener('click', async () => {
        await createSession(rom, game);
    });
}

async function createSession(rom, game) {
    const btn = document.getElementById('btn-start-session');
    btn.disabled = true;
    btn.textContent = 'Creating Room...';

    try {
        // 1. Create Chat Room
        const { data: room, error: roomError } = await rom.supabase
            .from('chat_rooms')
            .insert([{
                name: `${game.title} Live Lobby`,
                game_id: game.id,
                is_public: true,
                is_ephemeral: true,
                last_activity: new Date().toISOString(),
                created_by: rom.currentUser.id
            }])
            .select()
            .single();

        if (roomError) throw roomError;

        // 2. Create Initial LFG Post
        await rom.supabase.from('lfg_posts').insert([{
            user_id: rom.currentUser.id,
            posted_username: rom.currentUser.user_metadata?.username || 'Player',
            game_title: game.title,
            region: 'Global',
            status: 'open',
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            description: `Joined the live chat for ${game.title}! Come hang out.`
        }]);

        currentRoomId = room.id;
        
        // 3. Render Active State
        const container = document.getElementById('live-session-container');
        renderActiveSession(container, room, rom, game);
        
        // 4. Start Heartbeat
        startHeartbeat(rom, room.id);

    } catch (err) {
        console.error('Error creating session:', err);
        alert('Failed to start room: ' + err.message);
        btn.disabled = false;
        btn.textContent = '🚀 Start Room & Look for Players';
    }
}

function renderActiveSession(container, room, rom, game) {
    // Stop any existing heartbeat/listeners
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (chatChannel) {
        rom.supabase.removeChannel(chatChannel);
        chatChannel = null;
    }

    container.classList.remove('hidden');
    container.innerHTML = `
        <div class="bg-gray-900/95 backdrop-blur-xl rounded-xl border border-cyan-500/50 overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.15)]">
            <!-- Header -->
            <div class="bg-gradient-to-r from-cyan-900/80 to-blue-900/80 p-4 border-b border-cyan-500/30 flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <span class="relative flex h-3 w-3">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    <h3 class="text-lg font-bold text-white">Live Lobby: ${escapeHtml(game.title)}</h3>
                </div>
                <div class="text-xs text-cyan-300 font-mono">
                    Welcome to the live chat lobby. Enjoy and have fun! 
                </div>
            </div>

            <!-- Stream Area -->
            <div id="stream-area" class="hidden bg-black aspect-video relative group">
                <iframe id="stream-frame" class="w-full h-full" src="" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
                <button id="close-stream" class="absolute top-2 right-2 bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-xs font-bold opacity-0 group-hover:opacity-100 transition">Close Stream</button>
            </div>

            <!-- Chat Messages Area -->
            <div id="chat-messages" class="h-64 overflow-y-auto p-4 space-y-3 bg-gray-900/50 scroll-smooth custom-scrollbar">
                <div class="text-center text-gray-500 text-sm py-4">Loading messages...</div>
            </div>

            <!-- Controls -->
            <div class="p-4 bg-gray-800/50 border-t border-gray-700 flex flex-col gap-2">
                <!-- Stream Input -->
                <div class="flex gap-2">
                    <input type="text" id="stream-url-input" placeholder="Paste Twitch/YouTube stream link..." class="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none">
                    <button id="btn-go-live" class="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded text-sm font-bold whitespace-nowrap">Go Live</button>
                </div>
                <!-- Chat Input -->
                <form id="chat-form" class="flex gap-2">
                    <input type="text" id="chat-input" placeholder="Type a message..." class="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none" autocomplete="off">
                    <button type="submit" id="btn-send" class="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded text-sm font-bold whitespace-nowrap">Send</button>
                </form>
            </div>
        </div>
    `;

    // Load initial messages
    loadChatMessages(rom, room.id);

    // Setup Realtime listener
    chatChannel = rom.supabase.channel(`room:${room.id}`);
    
    chatChannel
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'chat_messages',
            filter: `room_id=eq.${room.id}`
        }, (payload) => {
            appendMessageToDOM(payload.new, rom.currentUser?.id);
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Joined chat channel:', room.id);
            }
        });

    // Stream Logic
    const btnGoLive = document.getElementById('btn-go-live');
    const streamArea = document.getElementById('stream-area');
    const streamFrame = document.getElementById('stream-frame');
    const closeStream = document.getElementById('close-stream');
    const input = document.getElementById('stream-url-input');

    btnGoLive.addEventListener('click', () => {
        const url = input.value.trim();
        if (!url) return;
        
        const embedUrl = getEmbedUrl(url);
        streamFrame.src = embedUrl;
        streamArea.classList.remove('hidden');
        
        rom.supabase.from('chat_rooms').update({ stream_url: url }).eq('id', room.id);
    });

    closeStream.addEventListener('click', () => {
        streamArea.classList.add('hidden');
        streamFrame.src = '';
        rom.supabase.from('chat_rooms').update({ stream_url: null }).eq('id', room.id);
    });

    if (room.stream_url) {
        input.value = room.stream_url;
        streamFrame.src = getEmbedUrl(room.stream_url);
        streamArea.classList.remove('hidden');
    }

    // Chat Form Logic
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('btn-send');

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = chatInput.value.trim();
        if (!message || !rom.currentUser) return;

        sendBtn.disabled = true;
        sendBtn.textContent = '...';

        try {
            // Fetch fresh profile data for avatar/username
            const { data: profile } = await rom.supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', rom.currentUser.id)
                .single();

            const username = profile?.username || rom.currentUser.email.split('@')[0];
            const avatarUrl = profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=06b6d4&color=fff`;

            await rom.supabase.from('chat_messages').insert([{
                room_id: room.id,
                user_id: rom.currentUser.id,
                username: username,
                avatar_url: avatarUrl,
                message: message
            }]);

            chatInput.value = '';
            const xpAmount = currentRoomId ? 2 : 1;
await supabase.rpc('award_xp', { user_uuid: rom.currentUser.id, amount: xpAmount, reason: 'chat_message' });
        } catch (err) {
            console.error('Failed to send:', err);
            alert('Failed to send message: ' + err.message);
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send';
        }
    });
}

async function loadChatMessages(rom, roomId) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    try {
        // ✅ SAFE: Only selects from chat_messages, no joins
        const { data: messages, error } = await rom.supabase
            .from('chat_messages')
            .select('*')
            .eq('room_id', roomId)
            .order('created_at', { ascending: true })
            .limit(50);

        if (error) throw error;

        container.innerHTML = '';
        if (!messages || messages.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-500 text-sm py-4">No messages yet. Say hi!</div>';
            return;
        }

        messages.forEach(msg => appendMessageToDOM(msg, rom.currentUser?.id));
        
        container.scrollTop = container.scrollHeight;

    } catch (err) {
        console.error('Error loading messages:', err);
        container.innerHTML = '<div class="text-center text-red-400 text-sm py-4">Failed to load chat.</div>';
    }
}

async function appendMessageToDOM(msg, currentUserId) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const isMe = msg.user_id === currentUserId;
    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. SAFE FETCH: Get full profile data for this specific message author
    // We do this individually to avoid breaking the main query with joins
    let profileData = null;
    try {
        const { data } = await supabase
            .from('profiles')
            .select(`
                username, 
                avatar_url, 
                motto, 
                xp_total, 
                gamercard_bg_type, 
                gamercard_bg_value,
                rank:user_ranks (name, color)
            `)
            .eq('id', msg.user_id)
            .single();
        profileData = data;
    } catch (e) {
        // Fallback if fetch fails
        profileData = null;
    }

    // 2. Prepare Data with Fallbacks
    const username = profileData?.username || msg.username || 'Unknown';
    const avatarUrl = profileData?.avatar_url || msg.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=06b6d4&color=fff`;
    const profileLink = `#/profile/${username}`;
    
    // Extract Rank & Motto from fetched profile
    const rankName = profileData?.rank?.name || null;
    const rankColor = profileData?.rank?.color || '#9ca3af';
    const motto = profileData?.motto || '';
    const xpTotal = profileData?.xp_total || 0;
    
    // Extract Gamercard BG settings
    const gcBgType = profileData?.gamercard_bg_type || 'color';
    const gcBgValue = profileData?.gamercard_bg_value || '#1f2937';

    // 3. Construct Gamercard HTML
    // We build the background style dynamically based on the fetched type
    let bgStyle = `background-color: ${gcBgValue};`;
    if (gcBgType === 'image') {
        bgStyle = `background-image: url('${gcBgValue}'); background-size: cover; background-position: center;`;
    } else if (gcBgType === 'gradient') {
        bgStyle = `background-image: ${gcBgValue};`;
    }

    let bgStyle = `background-color: ${gcBgValue};`;
    if (gcBgType === 'image') {
        bgStyle = `background-image: url('${gcBgValue}'); background-size: cover; background-position: center;`;
    } else if (gcBgType === 'gradient') {
        bgStyle = `background-image: ${gcBgValue};`;
    }

    const gamercardHtml = `
        <a href="${profileLink}" class="group block flex-shrink-0 w-[240px] hover:scale-[1.02] transition-transform duration-200 z-10">
            <div class="gamercard chat-gamercard relative overflow-hidden rounded-lg border border-gray-700 shadow-xl bg-gray-900">
                
                <!-- ✅ UPDATED: Background Layer (Increased Opacity from 0.20 to 0.60) -->
                <!-- This makes the image/gradient much more visible -->
                <div class="absolute inset-0" style="
                    ${bgStyle} 
                    opacity: 0.6; 
                    filter: brightness(0.8);
                    transition: opacity 0.3s ease;
                "></div>

                <!-- ✅ UPDATED: Gradient Overlay (Made lighter to let background show through) -->
                <!-- Changed from black/60 to black/30 for better visibility -->
                <div class="absolute inset-0 bg-gradient-to-br from-black/40 via-black/20 to-black/50"></div>
                
                <!-- Content (Z-index kept high to stay on top) -->
                <div class="relative z-10 p-2 flex items-center gap-2">
                    <img src="${avatarUrl}" alt="${username}" class="w-10 h-10 rounded-full border-2 border-cyan-500 object-cover flex-shrink-0 shadow-md">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1 mb-0.5">
                            <span class="text-xs font-bold text-white truncate drop-shadow-md">${escapeHtml(username)}</span>
                        </div>
                        ${rankName ? `
                            <span class="text-[9px] px-1 py-0.5 rounded font-bold block w-fit mb-0.5" 
                                  style="background:${rankColor}40; color:${rankColor}; border:1px solid ${rankColor}; text-shadow: 0 1px 2px black; backdrop-filter: blur(2px);">
                                ${escapeHtml(rankName)}
                            </span>
                        ` : ''}
                        ${motto ? `<p class="text-[9px] text-gray-200 italic truncate drop-shadow-md">"${escapeHtml(motto)}"</p>` : ''}
                        <!-- Mini XP Bar -->
                        <div class="h-1 w-full bg-gray-900/60 rounded-full mt-1 overflow-hidden backdrop-blur-sm">
                            <div class="h-full bg-cyan-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.8)]" style="width: ${Math.min(100, (xpTotal % 1000) / 10)}%"></div>
                        </div>
                    </div>
                </div>
            </div>
        </a>
    `;

    // 4. Construct Message Bubble
    const bubbleHtml = `
        <div class="flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'} pt-1">
            <div class="flex items-baseline gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}">
                <span class="text-[10px] text-gray-500">${time}</span>
            </div>
            <div class="bg-gray-800/95 backdrop-blur text-gray-200 text-sm px-3 py-2 rounded-lg break-words shadow-lg border border-gray-700 ${isMe ? 'bg-cyan-900/30 border-cyan-800/50 text-cyan-50 rounded-br-none' : 'rounded-bl-none'}">
                ${escapeHtml(msg.message)}
            </div>
        </div>
    `;

    // 5. Assemble
    const messageEl = document.createElement('div');
    messageEl.className = `flex gap-3 ${isMe ? 'flex-row-reverse' : ''} animate-fade-in mb-4 items-start`;
    messageEl.innerHTML = gamercardHtml + bubbleHtml;
    
    container.appendChild(messageEl);
    container.scrollTop = container.scrollHeight;
}
function startHeartbeat(rom, roomId) {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    
    heartbeatInterval = setInterval(async () => {
        console.log('❤️ Sending heartbeat for room:', roomId);
        await rom.supabase
            .from('chat_rooms')
            .update({ last_activity: new Date().toISOString() })
            .eq('id', roomId);
    }, 5 * 60 * 1000);
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
function createGamercardHTML(profile, isChat = false) {
  if (!profile) return '<div class="text-xs text-gray-500">Unknown User</div>';
  
  const name = profile.username || 'Anonymous';
  const avatar = profile.avatar_url || `https://ui-avatars.com/api/?name=${name}&background=06b6d4&color=fff`;
  const rankName = profile.rank?.name || 'Player';
  const rankColor = profile.rank?.color || '#9ca3af';
  const motto = profile.motto || '';
  
  // Calculate XP Progress (Next rank logic simplified for display)
  const xp = profile.xp_total || 0;
  const nextRankXp = 500; // Simplified: In real app, calculate distance to next rank dynamically
  const xpPercent = Math.min(100, (xp % 1000) / 10); // Visual filler for now

  let bgStyle = `background-color: ${profile.gamercard_bg_value || '#1f2937'}`;
  if (profile.gamercard_bg_type === 'image') {
    bgStyle = `background-image: url('${profile.gamercard_bg_value}'); background-size: cover; background-position: center;`;
  } else if (profile.gamercard_bg_type === 'gradient') {
    bgStyle = `background-image: ${profile.gamercard_bg_value};`;
  }

  const wrapperClass = isChat ? 'chat-gamercard-wrapper' : '';
  
  return `
    <div class="${wrapperClass}">
      <div class="gamercard">
        <div class="gc-bg" style="${bgStyle}"></div>
        <div class="gc-content">
          <img src="${avatar}" class="gc-avatar" alt="${name}">
          <div class="gc-info">
            <span class="gc-name">${escapeHtml(name)}</span>
            <span class="gc-rank" style="background-color: ${rankColor}20; color: ${rankColor}; border: 1px solid ${rankColor}">
              ${escapeHtml(rankName)}
            </span>
            ${!isChat && motto ? `<span class="gc-motto">${escapeHtml(motto)}</span>` : ''}
            <div class="gc-xp-bar-container">
              <div class="gc-xp-fill" style="width: ${xpPercent}%"></div>
            </div>
            <span class="gc-xp-text">${xp} XP</span>
          </div>
        </div>
      </div>
      ${isChat ? '<div class="chat-bubble-content">' : ''}
    </div>
  `;
}
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
