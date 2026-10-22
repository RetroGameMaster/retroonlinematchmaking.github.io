import { mountContentReactionBatch } from '../../lib/content-reactions.js';

// modules/game-detail/game-detail.js 

// ===== HELPER: Convert YouTube URLs to Embed Format =====
function getEmbedUrl(url) {
    if (!url) return '';
    url = url.trim();
    if (url.includes('youtube.com/embed/')) {
        try {
            const embed = new URL(url);
            embed.searchParams.set('autoplay', '0');
            return embed.toString();
        } catch {
            return url;
        }
    }

    let videoId = '';
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
    if (shortMatch) {
        videoId = shortMatch[1];
    } else {
        const params = new URLSearchParams(url.split('?')[1]);
        videoId = params.get('v');
    }

    if (videoId && videoId.length === 11) {
        return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=0`;
    }
    console.warn('Could not parse YouTube ID from:', url);
    return url;
}

// ===== GLOBAL STATE FOR CHAT =====
let chatChannel = null;
let lobbyStreamChannel = null;
let heartbeatInterval = null;
let streamExpiryTimeout = null;
let currentRoomId = null;
let currentStreamMuted = true;
let currentStreamMinimized = false;
let isLoadingLobbyHistory = false;
let pendingLobbyMessages = [];
let renderedLobbyMessageIds = new Set();

function getLiveStreamEmbedUrl(rawUrl, muted = true) {
    let url;
    try {
        url = new URL(rawUrl);
    } catch {
        throw new Error('Enter a valid Twitch or YouTube live link.');
    }
    if (url.protocol !== 'https:') throw new Error('Stream links must use HTTPS.');

    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'youtu.be') {
        const videoId = host === 'youtu.be'
            ? url.pathname.split('/').filter(Boolean)[0]
            : url.searchParams.get('v') || url.pathname.match(/^\/(?:live|embed|shorts)\/([^/]+)/)?.[1];
        if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
            throw new Error('Use a YouTube video or live-stream URL.');
        }
        return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&mute=${muted ? 1 : 0}&enablejsapi=1`;
    }
    if (host === 'twitch.tv') {
        const parts = url.pathname.split('/').filter(Boolean);
        const query = new URLSearchParams({
            parent: window.location.hostname,
            autoplay: 'true',
            muted: String(muted),
        });
        if (parts[0]?.toLowerCase() === 'videos' && /^\d+$/.test(parts[1] || '')) {
            query.set('video', `v${parts[1]}`);
        } else if (parts[0] && /^[a-zA-Z0-9_]{1,25}$/.test(parts[0])) {
            query.set('channel', parts[0]);
        } else {
            throw new Error('Use a Twitch channel or video URL.');
        }
        return `https://player.twitch.tv/?${query}`;
    }
    throw new Error('Only Twitch and YouTube live links are supported.');
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
        let { data: game, error: gameError } = await rom.supabase
            .from('games')
            .select('*')
            .eq('slug', identifier)
            .maybeSingle();

        if (gameError) throw gameError;
        if (!game && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)) {
            const result = await rom.supabase
                .from('games')
                .select('*')
                .eq('id', identifier)
                .maybeSingle();
            game = result.data;
            gameError = result.error;
        }

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
        await renderGame(game, content, rom, identifier);

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
async function renderGame(game, container, rom, identifier) {
    const currentUser = rom.currentUser;
    const adminEditButton = await renderAdminEditButton(game, rom);

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
        
        // Cleanup existing elements
        const existingBg = document.getElementById('dynamic-game-bg');
        if (existingBg) existingBg.remove();
        const existingOverlay = document.getElementById('bg-overlay');
        if (existingOverlay) existingOverlay.remove();

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
            
            // FIXED: Opacity 1.0 (Full Brightness), No Blur
            Object.assign(bgVideo.style, {
                position: 'fixed', 
                top: '0', 
                left: '0', 
                width: '100%', 
                height: '100%',
                objectFit: 'cover', 
                zIndex: '-2', 
                opacity: '1.0' 
            });
            document.body.insertBefore(bgVideo, document.body.firstChild);
        } else {
            const bgImg = document.createElement('div');
            bgImg.id = 'dynamic-game-bg';
            
            // FIXED: Opacity 1.0, No Blur, Cover Fit
            Object.assign(bgImg.style, {
                position: 'fixed', 
                top: '0', 
                left: '0', 
                width: '100%', 
                height: '100%',
                backgroundImage: `url(${bgUrl})`, 
                backgroundSize: 'cover',
                backgroundPosition: 'center', 
                backgroundRepeat: 'no-repeat',
                zIndex: '-2', 
                opacity: '1.0' 
            });
            document.body.insertBefore(bgImg, document.body.firstChild);
        }

        // FIXED: Lighter Overlay (0.4 instead of 0.65) so background shines through
        const overlay = document.createElement('div');
        overlay.id = 'bg-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', 
            top: '0', 
            left: '0', 
            width: '100%', 
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.4)', // Lighter dark overlay
            zIndex: '-1', 
            pointerEvents: 'none',
            backdropFilter: 'none' // Ensure no blur
        });
        document.body.insertBefore(overlay, document.body.firstChild);
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
    const videoHTML = (game.video_url || game.youtube_url) ? `
        <div class="mb-8 bg-black rounded-xl overflow-hidden border border-gray-700 shadow-2xl relative" style="aspect-ratio: 16/9;">
            <iframe src="${getEmbedUrl(game.video_url || game.youtube_url)}" title="${escapeAttribute(game.console === 'Decomps' ? 'Decomp project video' : 'Game video')}" frameborder="0" allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy" class="w-full h-full absolute top-0 left-0"></iframe>
        </div>
    ` : '';
    const projectRepositoryHTML = game.github_url ? `
      <div class="mb-8 rounded-xl border border-purple-500/40 bg-gray-900/80 p-5">
        <h3 class="text-lg font-bold text-purple-200">🧩 Decomp Project</h3>
        <p class="mt-1 text-sm text-gray-300">Explore the project source and join its development community.</p>
        <a href="${escapeAttribute(game.github_url)}" target="_blank" rel="noopener noreferrer" class="mt-4 inline-flex min-h-11 items-center rounded-lg bg-gray-800 px-4 py-2 font-bold text-cyan-300 hover:bg-gray-700 hover:underline">Open GitHub project ↗</a>
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
                    <div class="lg:sticky lg:top-4">
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
                    ${projectRepositoryHTML}
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
                    <section id="game-reviews-section" class="mb-8 rounded-xl border border-cyan-500/30 bg-gray-900/80 p-4 sm:p-6 shadow-xl"></section>
                </div>
            </div>
        </div>
    `;

    const gameTitle = container.querySelector('h1');
    if (gameTitle && adminEditButton) {
        const titleRow = document.createElement('div');
        titleRow.className = 'mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between';
        gameTitle.parentNode.insertBefore(titleRow, gameTitle);
        titleRow.append(gameTitle);
        titleRow.insertAdjacentHTML('beforeend', adminEditButton);
        document.getElementById('admin-edit-game-btn')?.addEventListener('click', () => openGameEditModal(game, rom));
    }

    // Initialize Logic
    if (currentUser) {
        checkAndRenderPlayingState(game, currentUser.id, rom);
        loadUserRating(game, currentUser.id, rom);
    }
    loadGameReviews(rom, game);
}

async function renderAdminEditButton(game, rom) {
    const user = rom.currentUser;
    if (!user) return '';

    const { data: profile, error } = await rom.supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle();
    if (error) {
        console.error('Could not verify admin access for game editing:', error);
        return '';
    }
    if (profile?.is_admin !== true) return '';

    return `<button id="admin-edit-game-btn" type="button" class="self-start rounded-lg border border-amber-400/50 bg-amber-600 px-4 py-3 font-bold text-white hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-300" aria-label="Edit ${escapeHtml(game.title)} game page">✏️ Edit Game Page</button>`;
}

function openGameEditModal(game, rom) {
    const existing = document.getElementById('game-page-edit-modal');
    if (existing) existing.remove();

    let details = game.connection_details;
    if (typeof details === 'string') {
        try {
            details = JSON.parse(details);
        } catch {
            details = details.trim()
                ? [{ name: game.connection_method || 'General Connection', instructions: details, type: 'other' }]
                : [];
        }
    }
    if (!Array.isArray(details)) details = [];

    const modal = document.createElement('div');
    modal.id = 'game-page-edit-modal';
    modal.className = 'fixed inset-0 z-[10000] overflow-y-auto bg-black/80 p-3 sm:p-6';
    modal.innerHTML = `
      <div class="mx-auto my-2 max-w-4xl rounded-xl border border-amber-400/50 bg-gray-900 p-4 shadow-2xl sm:my-6 sm:p-6">
        <div class="mb-5 flex items-start justify-between gap-4">
          <div><h2 class="text-2xl font-bold text-amber-300">Edit Game Page</h2><p class="mt-1 text-sm text-gray-400">Changes are saved to the game catalog.</p></div>
          <button type="button" data-close-edit class="rounded-lg bg-gray-800 px-3 py-2 text-white hover:bg-gray-700" aria-label="Close editor">✕</button>
        </div>
        <form id="game-page-edit-form" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label class="text-sm text-gray-300">Title<input name="title" required maxlength="200" value="${escapeAttribute(game.title)}" class="mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 p-3 text-white"></label>
          <label class="text-sm text-gray-300">Console<input name="console" required maxlength="100" value="${escapeAttribute(game.console || '')}" class="mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 p-3 text-white"></label>
          <label class="text-sm text-gray-300">Release year<input name="year" type="number" min="1950" max="2100" value="${game.year || ''}" class="mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 p-3 text-white"></label>
          <label class="text-sm text-gray-300">Multiplayer type<input name="multiplayer_type" maxlength="100" value="${escapeAttribute(game.multiplayer_type || '')}" class="mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 p-3 text-white"></label>
          <label class="text-sm text-gray-300">Developer<input name="developer" value="${escapeAttribute(game.developer || '')}" class="mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 p-3 text-white"></label>
          <label class="text-sm text-gray-300">Publisher<input name="publisher" value="${escapeAttribute(game.publisher || '')}" class="mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 p-3 text-white"></label>
          <label class="text-sm text-gray-300">Genre<input name="genre" value="${escapeAttribute(game.genre || '')}" class="mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 p-3 text-white"></label>
          <label class="text-sm text-gray-300">Release date<input name="release_date" type="date" value="${game.release_date ? game.release_date.split('T')[0] : ''}" class="mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 p-3 text-white"></label>
          <label class="text-sm text-gray-300 sm:col-span-2">Description<textarea name="description" rows="5" class="mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 p-3 text-white">${escapeHtml(game.description || '')}</textarea></label>
          <label class="text-sm text-gray-300 sm:col-span-2">Features (comma-separated)<input name="features" value="${escapeAttribute(Array.isArray(game.features) ? game.features.join(', ') : '')}" class="mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 p-3 text-white"></label>
          <label class="text-sm text-gray-300 sm:col-span-2">Replace cover image (optional)<input name="cover_image_file" type="file" accept="image/*" class="mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 p-3 text-white"><span class="mt-1 block text-xs text-gray-500">Leave empty to keep the current cover. No cover image is required.</span></label>
          <label class="text-sm text-gray-300 sm:col-span-2">Cover image URL<input name="cover_image_url" type="url" value="${escapeAttribute(game.cover_image_url || '')}" class="mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 p-3 text-white"></label>
          <label class="text-sm text-gray-300 sm:col-span-2">Gameplay video URL<input name="video_url" type="url" value="${escapeAttribute(game.video_url || '')}" class="mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 p-3 text-white"></label>
          <label class="text-sm text-gray-300 sm:col-span-2">Background image URL<input name="background_image_url" type="url" value="${escapeAttribute(game.background_image_url || '')}" class="mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 p-3 text-white"></label>
          <label class="text-sm text-gray-300 sm:col-span-2">Background video URL<input name="background_video_url" type="url" value="${escapeAttribute(game.background_video_url || '')}" class="mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 p-3 text-white"></label>
          <label class="text-sm text-gray-300">Connection method<input name="connection_method" value="${escapeAttribute(game.connection_method || '')}" class="mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 p-3 text-white"></label>
          <label class="text-sm text-gray-300">Server details<input name="server_details" value="${escapeAttribute(game.server_details || '')}" class="mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 p-3 text-white"></label>
          <label class="text-sm text-gray-300">Minimum players<input name="players_min" type="number" min="1" value="${game.players_min || 1}" class="mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 p-3 text-white"></label>
          <label class="text-sm text-gray-300">Maximum players<input name="players_max" type="number" min="1" value="${game.players_max || 1}" class="mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 p-3 text-white"></label>
          <label class="flex items-center gap-3 text-sm text-gray-300 sm:col-span-2"><input name="servers_available" type="checkbox" ${game.servers_available ? 'checked' : ''} class="h-5 w-5 accent-cyan-500">Servers available</label>
          <label class="text-sm text-gray-300 sm:col-span-2">Connection details (JSON array)<textarea name="connection_details" rows="5" class="mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 p-3 font-mono text-sm text-white">${escapeHtml(JSON.stringify(details, null, 2))}</textarea></label>
          <div id="game-edit-error" class="hidden text-sm text-red-300 sm:col-span-2" role="alert"></div>
          <div class="flex flex-col-reverse gap-3 pt-2 sm:col-span-2 sm:flex-row sm:justify-end">
            <button type="button" data-close-edit class="rounded-lg bg-gray-700 px-5 py-3 text-white hover:bg-gray-600">Cancel</button>
            <button type="submit" class="rounded-lg bg-amber-600 px-5 py-3 font-bold text-white hover:bg-amber-500">Save Game Page</button>
          </div>
        </form>
      </div>`;
    document.body.append(modal);
    modal.querySelectorAll('[data-close-edit]').forEach(button => button.addEventListener('click', () => modal.remove()));
    modal.addEventListener('click', event => {
        if (event.target === modal) modal.remove();
    });
    modal.querySelector('#game-page-edit-form').addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const coverFile = data.get('cover_image_file');
        let coverImageUrl = String(data.get('cover_image_url')).trim() || null;
        const numberOrNull = name => String(data.get(name) || '').trim() ? Number(data.get(name)) : null;
        let connectionDetails;
        try {
            connectionDetails = JSON.parse(String(data.get('connection_details') || '[]'));
            if (!Array.isArray(connectionDetails)) throw new Error('Connection details must be a JSON array.');
        } catch (error) {
            const errorEl = modal.querySelector('#game-edit-error');
            errorEl.textContent = error.message || 'Connection details must be valid JSON.';
            errorEl.classList.remove('hidden');
            return;
        }

        const updates = {
            title: String(data.get('title')).trim(),
            console: String(data.get('console')).trim(),
            year: numberOrNull('year'),
            multiplayer_type: String(data.get('multiplayer_type')).trim() || null,
            developer: String(data.get('developer')).trim() || null,
            publisher: String(data.get('publisher')).trim() || null,
            genre: String(data.get('genre')).trim() || null,
            release_date: String(data.get('release_date')).trim() || null,
            description: String(data.get('description')).trim() || null,
            features: String(data.get('features')).split(',').map(feature => feature.trim()).filter(Boolean),
            cover_image_url: String(data.get('cover_image_url')).trim() || null,
            video_url: String(data.get('video_url')).trim() || null,
            background_image_url: String(data.get('background_image_url')).trim() || null,
            background_video_url: String(data.get('background_video_url')).trim() || null,
            connection_method: String(data.get('connection_method')).trim() || null,
            server_details: String(data.get('server_details')).trim() || null,
            players_min: numberOrNull('players_min') || 1,
            players_max: numberOrNull('players_max') || 1,
            servers_available: data.get('servers_available') === 'on',
            connection_details: connectionDetails,
        };
        if (updates.players_max < updates.players_min) {
            const errorEl = modal.querySelector('#game-edit-error');
            errorEl.textContent = 'Maximum players must be at least the minimum players.';
            errorEl.classList.remove('hidden');
            return;
        }
        const submit = form.querySelector('[type="submit"]');
        const errorEl = modal.querySelector('#game-edit-error');
        submit.disabled = true;
        submit.textContent = 'Saving...';
        errorEl.classList.add('hidden');
        try {
            if (coverFile instanceof File && coverFile.size > 0) {
                if (!coverFile.type.startsWith('image/')) throw new Error('Cover art must be an image file.');
                if (coverFile.size > 10 * 1024 * 1024) throw new Error('Cover art must be 10 MB or smaller.');
                const extension = ({
                    'image/jpeg': 'jpg',
                    'image/png': 'png',
                    'image/gif': 'gif',
                    'image/webp': 'webp',
                })[coverFile.type];
                if (!extension) throw new Error('Use a JPEG, PNG, GIF, or WebP cover image.');
                const path = `covers/${game.id}/${Date.now()}.${extension}`;
                const { error: uploadError } = await rom.supabase.storage
                    .from('game-images')
                    .upload(path, coverFile, { cacheControl: '3600', upsert: false });
                if (uploadError) throw uploadError;
                const { data: publicUrlData } = rom.supabase.storage.from('game-images').getPublicUrl(path);
                coverImageUrl = publicUrlData.publicUrl;
            }
            updates.cover_image_url = coverImageUrl;
            const { error } = await rom.supabase.rpc('admin_update_game_page', {
                p_game_id: game.id,
                p_updates: updates,
            });
            if (error) throw error;
            modal.remove();
            await initGameDetail(rom, identifier);
        } catch (error) {
            console.error('Could not save game page:', error);
            errorEl.textContent = error.message || 'Could not save game page.';
            errorEl.classList.remove('hidden');
            submit.disabled = false;
            submit.textContent = 'Save Game Page';
        }
    });
}

async function loadGameReviews(rom, game) {
    const section = document.getElementById('game-reviews-section');
    if (!section) return;
    section.innerHTML = '<p class="py-6 text-center text-gray-400">Loading player reviews...</p>';

    const { data: reviewRows, error, count } = await rom.supabase
        .from('game_reviews')
        .select('id, user_id, rating, title, content, created_at', { count: 'exact' })
        .eq('game_id', game.id)
        .order('created_at', { ascending: false })
        .limit(100);
    if (error) {
        console.error('Could not load game reviews:', error);
        section.innerHTML = '<p class="py-6 text-center text-red-300">Reviews are temporarily unavailable.</p>';
        return;
    }

    const user = rom.currentUser;
    const latestReviews = reviewRows || [];
    const reviews = [...latestReviews];
    let ownReview = latestReviews.find(review => review.user_id === user?.id);
    if (user && !ownReview) {
        const { data: existingReview, error: ownReviewError } = await rom.supabase
            .from('game_reviews')
            .select('id, user_id, rating, title, content, created_at')
            .eq('game_id', game.id)
            .eq('user_id', user.id)
            .maybeSingle();
        if (ownReviewError) console.error('Could not load the signed-in user game review:', ownReviewError);
        if (existingReview) {
            ownReview = existingReview;
            reviews.push(existingReview);
        }
    }
    const average = latestReviews.length
        ? (latestReviews.reduce((sum, review) => sum + review.rating, 0) / latestReviews.length).toFixed(1)
        : '—';
    let authors = {};
    const authorIds = [...new Set((reviews || []).map(review => review.user_id))];
    if (authorIds.length) {
        const { data, error: authorError } = await rom.supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', authorIds);
        if (authorError) console.error('Could not load game review authors:', authorError);
        authors = Object.fromEntries((data || []).map(profile => [profile.id, profile]));
    }

    section.innerHTML = `
      <div class="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 class="text-2xl font-bold text-cyan-300">Player Reviews</h2><p class="text-sm text-gray-400">Share your experience with ${escapeHtml(game.title)}.</p></div>
        <div class="rounded-lg border border-yellow-500/30 bg-gray-800 px-4 py-2 text-sm text-gray-300"><strong class="text-xl text-yellow-300">${average}</strong> / 5 latest · ${count ?? reviews.length} ${(count ?? reviews.length) === 1 ? 'review' : 'reviews'}</div>
      </div>
      ${user ? `
        <form id="game-review-form" class="mb-6 space-y-3 rounded-lg border border-gray-700 bg-gray-800/70 p-4">
          <h3 class="font-bold text-white">${ownReview ? 'Update your review' : 'Write a review'}</h3>
          <label class="block text-sm text-gray-300">Your rating
            <select name="rating" required class="mt-1 min-h-11 w-full rounded-lg border border-gray-600 bg-gray-900 p-3 text-white sm:w-48">
              ${[5,4,3,2,1].map(rating => `<option value="${rating}" ${ownReview?.rating === rating ? 'selected' : ''}>${'★'.repeat(rating)} (${rating}/5)</option>`).join('')}
            </select>
          </label>
          <label class="block text-sm text-gray-300">Title (optional)<input name="title" maxlength="120" value="${escapeAttribute(ownReview?.title || '')}" class="mt-1 min-h-11 w-full rounded-lg border border-gray-600 bg-gray-900 p-3 text-white"></label>
          <label class="block text-sm text-gray-300">Review<textarea name="content" required maxlength="4000" rows="4" class="mt-1 w-full rounded-lg border border-gray-600 bg-gray-900 p-3 text-white">${escapeHtml(ownReview?.content || '')}</textarea></label>
          <p id="game-review-status" class="min-h-5 text-sm text-gray-400" role="status"></p>
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button type="submit" class="min-h-11 rounded-lg bg-cyan-700 px-5 py-2 font-bold text-white hover:bg-cyan-600">${ownReview ? 'Save Review' : 'Post Review'}</button>
            ${ownReview ? '<button type="button" id="delete-game-review" class="min-h-11 rounded-lg border border-red-500/40 px-5 py-2 text-red-300 hover:bg-red-900/30">Delete My Review</button>' : ''}
          </div>
        </form>
      ` : '<div class="mb-6 rounded-lg border border-gray-700 bg-gray-800/70 p-4"><p class="text-gray-300">Sign in to leave a review.</p><a href="#/auth" class="mt-3 inline-block rounded-lg bg-cyan-700 px-4 py-3 font-bold text-white">Sign In</a></div>'}
      <div class="space-y-3" id="game-review-list">
        ${reviews?.length ? reviews.map(review => {
            const author = authors[review.user_id];
            return `<article class="rounded-lg border border-gray-700 bg-gray-800/60 p-4">
              <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div><div class="font-bold text-white">${escapeHtml(review.title || 'Player review')}</div><div class="text-xs text-gray-400">By ${escapeHtml(author?.username || 'ROM member')} · ${new Date(review.created_at).toLocaleDateString()}</div></div>
                <span class="text-lg text-yellow-300" aria-label="${review.rating} out of 5 stars">${'★'.repeat(review.rating)}<span class="text-gray-600">${'☆'.repeat(5 - review.rating)}</span></span>
              </div>
              <p class="whitespace-pre-line break-words text-sm leading-relaxed text-gray-200">${escapeHtml(review.content)}</p>
              <div id="sticker-reactions-${review.id}"></div>
            </article>`;
        }).join('') : '<p class="rounded-lg border border-dashed border-gray-700 p-6 text-center text-gray-400">No reviews yet. Be the first to share your thoughts.</p>'}
      </div>`;

    void mountContentReactionBatch(reviews.map(review => ({
        container: document.getElementById(`sticker-reactions-${review.id}`),
        targetId: review.id,
    })), rom.supabase, 'game_review', user?.id);

    const form = section.querySelector('#game-review-form');
    form?.addEventListener('submit', async event => {
        event.preventDefault();
        const data = new FormData(form);
        const payload = {
            game_id: game.id,
            user_id: user.id,
            rating: Number(data.get('rating')),
            title: String(data.get('title') || '').trim(),
            content: String(data.get('content') || '').trim(),
        };
        const status = section.querySelector('#game-review-status');
        const submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        status.textContent = 'Saving review...';
        try {
            const result = ownReview
                ? await rom.supabase.from('game_reviews').update({
                    rating: payload.rating,
                    title: payload.title,
                    content: payload.content,
                }).eq('id', ownReview.id).eq('user_id', user.id)
                : await rom.supabase.from('game_reviews').insert(payload);
            if (result.error) throw result.error;
            await loadGameReviews(rom, game);
        } catch (error) {
            console.error('Could not save game review:', error);
            status.textContent = error.message || 'Could not save your review.';
            submit.disabled = false;
        }
    });

    section.querySelector('#delete-game-review')?.addEventListener('click', async event => {
        if (!confirm('Delete your review for this game?')) return;
        const button = event.currentTarget;
        button.disabled = true;
        try {
            const { error: deleteError } = await rom.supabase
                .from('game_reviews')
                .delete()
                .eq('id', ownReview.id)
                .eq('user_id', user.id);
            if (deleteError) throw deleteError;
            await loadGameReviews(rom, game);
        } catch (error) {
            console.error('Could not delete game review:', error);
            button.disabled = false;
            section.querySelector('#game-review-status').textContent = error.message || 'Could not delete your review.';
        }
    });
}

function escapeAttribute(value) {
    return escapeHtml(String(value)).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
    if (lobbyStreamChannel) {
        rom.supabase.removeChannel(lobbyStreamChannel);
        lobbyStreamChannel = null;
    }
    if (streamExpiryTimeout) clearTimeout(streamExpiryTimeout);

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
    if (!btn) return;
    
    btn.disabled = true;
    btn.textContent = 'Creating Room...';

    try {
        // 1. SAFE CLEANUP: Delete only OLD inactive rooms (>1 hour) for this specific game
        // This prevents "duplicate key" errors from zombie rooms while keeping active ones alive.
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        
        await rom.supabase
            .from('chat_rooms')
            .delete()
            .eq('game_id', game.id)
            .eq('is_ephemeral', true)
            .lt('last_activity', oneHourAgo);

        // 2. CHECK FOR EXISTING ACTIVE ROOM
        // If a room exists (even if created 5 mins ago), reuse it instead of creating a duplicate.
        const { data: existingRoom } = await rom.supabase
            .from('chat_rooms')
            .select('*')
            .eq('game_id', game.id)
            .eq('is_ephemeral', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (existingRoom) {
            console.log('♻️ Reusing existing room:', existingRoom.id);
            
            // Reactivate it (update timestamp so it doesn't get deleted next time)
            const { data: reactivatedRoom } = await rom.supabase
                .from('chat_rooms')
                .update({ 
                    last_activity: new Date().toISOString(),
                    status: 'active'
                })
                .eq('id', existingRoom.id)
                .select()
                .single();

            currentRoomId = reactivatedRoom.id;
            const container = document.getElementById('live-session-container');
            
            // Render the existing room
            renderActiveSession(container, reactivatedRoom, rom, game);
            
            // Restart heartbeat to keep it alive
            startHeartbeat(rom, reactivatedRoom.id);
            
            // Reset button
            btn.disabled = false;
            btn.textContent = '🚀 Start Room & Look for Players';
            return;
        }

        // 3. CREATE NEW ROOM (Only if none existed)
        // Use a timestamp in the name to guarantee uniqueness if cleanup fails
        const uniqueRoomName = `${game.title} Live Lobby-${Date.now()}`;
        
        const { data: room, error: roomError } = await rom.supabase
            .from('chat_rooms')
            .insert([{
                name: uniqueRoomName,
                game_id: game.id,
                is_public: true,
                is_ephemeral: true,
                last_activity: new Date().toISOString(),
                created_by: rom.currentUser.id,
                status: 'active'
            }])
            .select()
            .single();

        if (roomError) throw roomError;
        void recordLobbyActivity(rom, room.id, 'host');

        // 4. Create Initial LFG Post linked to this room
        await rom.supabase.from('lfg_posts').insert([{
            user_id: rom.currentUser.id,
            posted_username: rom.currentUser.user_metadata?.username || 'Player',
            game_title: game.title,
            region: 'Global',
            status: 'open',
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            description: `Joined the live chat for ${game.title}! Come hang out.`,
            chat_room_id: room.id
        }]);

        currentRoomId = room.id;
        const container = document.getElementById('live-session-container');
        
        // Render new room
        renderActiveSession(container, room, rom, game);
        
        // Start Heartbeat (Crucial: This keeps updating last_activity every 5 mins)
        startHeartbeat(rom, room.id);

    } catch (err) {
        console.error('Error creating session:', err);
        
        // Handle Duplicate Key Error gracefully
        if (err.code === '23505' || err.message.includes('duplicate key')) {
            alert('A room already exists! Refreshing to join it...');
            setTimeout(() => window.location.reload(), 1500);
            return;
        }
        
        alert('Failed to start room: ' + err.message);
        btn.disabled = false;
        btn.textContent = '🚀 Start Room & Look for Players';
    }
}

async function renderActiveSession(container, room, rom, game) {
    // Stop any existing heartbeat/listeners
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (chatChannel) {
        rom.supabase.removeChannel(chatChannel);
        chatChannel = null;
    }
    if (lobbyStreamChannel) {
        rom.supabase.removeChannel(lobbyStreamChannel);
        lobbyStreamChannel = null;
    }
    if (streamExpiryTimeout) clearTimeout(streamExpiryTimeout);

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

            <section id="lobby-stream-panel" class="border-b border-gray-700"></section>

            <!-- Chat Messages Area -->
            <div id="chat-messages" class="h-64 overflow-y-auto p-4 space-y-3 bg-gray-900/50 scroll-smooth custom-scrollbar relative">
                <div class="text-center text-gray-500 text-sm py-4">Loading messages...</div>
                
                <!-- 🆕 SPRITE CANVAS CONTAINER (Absolute Bottom of Chat) -->
                <div id="sprite-canvas-container" class="absolute bottom-0 left-0 w-full h-40 pointer-events-none z-50" style="border: 1px dashed rgba(0,255,0,0.3);">
    <canvas id="sprite-canvas" width="800" height="160" style="width: 100%; height: 100%;"></canvas>
</div>
            </div>

            <!-- Controls -->
            <div class="p-4 bg-gray-800/50 border-t border-gray-700 flex flex-col gap-2">
                <!-- Chat Input -->
                <form id="chat-form" class="flex gap-2">
                    <input type="text" id="chat-input" placeholder="Type a message..." class="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none" autocomplete="off">
                    <button type="submit" id="btn-send" class="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded text-sm font-bold whitespace-nowrap">Send</button>
                </form>
            </div>
        </div>
    `;
    await setupLobbyStreamPanel(rom, game, room);
 // ==========================================
    // 🚀 SPRITE ENGINE INITIALIZATION
    // ==========================================
    if (rom.currentUser) {
        try {
            // 1. Dynamic Import of the Sprite Engine
            const { default: SpriteEngine } = await import('../chat/sprite-engine.js');
            
            // 2. Initialize Engine
            // We pass the container ID, current User ID, and Supabase client
            window.spriteEngine = new SpriteEngine('sprite-canvas-container', rom.currentUser.id, rom.supabase);
            await window.spriteEngine.init();

            // 3. Global Hook for Chat Messages
            // This allows appendMessageToDOM to trigger sprite speech
            window.spriteSpeak = (userId, text) => {
                if (window.spriteEngine) {
                    window.spriteEngine.speak(userId, text);
                }
            };

            console.log('✅ Sprite Engine Loaded & Ready');
        } catch (err) {
            console.warn('⚠️ Sprite Engine failed to load:', err);
            // Optional: Remove the canvas container if engine fails so it doesn't look broken
            const canvasContainer = document.getElementById('sprite-canvas-container');
            if (canvasContainer) canvasContainer.style.display = 'none';
        }
    }

    // Setup Realtime listener
    chatChannel = rom.supabase.channel(`room:${room.id}`);
    
    chatChannel
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'chat_messages',
            filter: `room_id=eq.${room.id}`
        }, (payload) => {
            if (isLoadingLobbyHistory && payload.new?.room_id === room.id) {
                pendingLobbyMessages.push(payload.new);
                return;
            }
            appendMessageToDOM(payload.new, rom.currentUser?.id, rom);
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Joined chat channel:', room.id);
            }
        });

    await loadChatMessages(rom, room.id);

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
            await recordLobbyActivity(rom, room.id, 'participant');
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
            // FIX: Use rom.supabase here
            await rom.supabase.rpc('award_xp', { user_uuid: rom.currentUser.id, amount: xpAmount, reason: 'chat_message' });
        } catch (err) {
            console.error('Failed to send:', err);
            alert('Failed to send message: ' + err.message);
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send';
        }
    });
}

async function setupLobbyStreamPanel(rom, game, room) {
    currentStreamMuted = true;
    currentStreamMinimized = false;
    await refreshLobbyStream(rom, game, room);

    lobbyStreamChannel = rom.supabase
        .channel(`game-lobby-stream:${game.id}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'game_lobby_streams',
            filter: `game_id=eq.${game.id}`,
        }, () => void refreshLobbyStream(rom, game, room))
        .subscribe(status => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error('Game lobby stream realtime subscription failed:', status);
            }
        });
}

async function refreshLobbyStream(rom, game, room) {
    if (streamExpiryTimeout) clearTimeout(streamExpiryTimeout);

    const { data: stream, error } = await rom.supabase
        .from('game_lobby_streams')
        .select('game_id, room_id, user_id, stream_url, claimed_at, expires_at')
        .eq('game_id', game.id)
        .maybeSingle();
    if (error) {
        console.error('Could not load the game lobby stream:', error);
        renderLobbyStreamPanel(rom, game, room, null, null, 'The stream panel could not load.');
        return;
    }

    let owner = null;
    if (stream?.user_id) {
        const { data, error: ownerError } = await rom.supabase
            .from('profiles')
            .select('username')
            .eq('id', stream.user_id)
            .maybeSingle();
        if (ownerError) console.error('Could not load the current streamer profile:', ownerError);
        owner = data;

        const timeUntilExpiry = new Date(stream.expires_at).getTime() - Date.now();
        if (timeUntilExpiry > 0) {
            streamExpiryTimeout = setTimeout(
                () => void refreshLobbyStream(rom, game, room),
                Math.min(timeUntilExpiry + 500, 2147483647)
            );
        }
    }
    renderLobbyStreamPanel(rom, game, room, stream, owner);
}

function renderLobbyStreamPanel(rom, game, room, stream, owner, loadError = '') {
    const panel = document.getElementById('lobby-stream-panel');
    if (!panel) return;

    if (stream) {
        let embedUrl = '';
        let embedError = '';
        try {
            embedUrl = getLiveStreamEmbedUrl(stream.stream_url, currentStreamMuted);
        } catch (error) {
            embedError = error.message;
        }
        const ownerName = escapeHtml(owner?.username || 'ROM member');
        const expiresAt = new Date(stream.expires_at);
        panel.innerHTML = `
          <div class="p-4">
            <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 class="font-bold text-purple-200">📺 Live Game Stream</h4>
                <p class="text-xs text-gray-400">Streaming by ${ownerName} · slot expires ${expiresAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <button id="toggle-stream-mute" type="button" class="min-h-10 rounded-lg bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600">${currentStreamMuted ? 'Unmute' : 'Mute'}</button>
                <button id="toggle-stream-minimize" type="button" class="min-h-10 rounded-lg bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600">${currentStreamMinimized ? 'Show Stream' : 'Minimize'}</button>
                ${rom.currentUser?.id === stream.user_id ? '<button id="stop-game-stream" type="button" class="min-h-10 rounded-lg bg-red-800 px-3 py-2 text-sm font-bold text-white hover:bg-red-700">End Stream</button>' : ''}
              </div>
            </div>
            <div id="lobby-stream-video" class="${currentStreamMinimized ? 'hidden' : ''} aspect-video overflow-hidden rounded-lg border border-gray-700 bg-black">
              ${embedUrl ? `<iframe id="lobby-stream-iframe" src="${escapeAttribute(embedUrl)}" title="${escapeAttribute(game.title)} live stream" class="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>` : `<p class="p-4 text-sm text-red-300">${escapeHtml(embedError || 'This stream link cannot be embedded.')}</p>`}
            </div>
            <p id="stream-action-status" class="mt-2 min-h-5 text-xs text-red-300" role="status">${escapeHtml(loadError)}</p>
          </div>`;

        panel.querySelector('#toggle-stream-mute')?.addEventListener('click', () => {
            currentStreamMuted = !currentStreamMuted;
            renderLobbyStreamPanel(rom, game, room, stream, owner);
        });
        panel.querySelector('#toggle-stream-minimize')?.addEventListener('click', () => {
            currentStreamMinimized = !currentStreamMinimized;
            const video = panel.querySelector('#lobby-stream-video');
            const button = panel.querySelector('#toggle-stream-minimize');
            video?.classList.toggle('hidden', currentStreamMinimized);
            if (button) button.textContent = currentStreamMinimized ? 'Show Stream' : 'Minimize';
        });
        panel.querySelector('#stop-game-stream')?.addEventListener('click', async event => {
            const button = event.currentTarget;
            button.disabled = true;
            try {
                const { error: releaseError } = await rom.supabase.rpc('release_game_lobby_stream', {
                    p_game_id: game.id,
                });
                if (releaseError) throw releaseError;
                await refreshLobbyStream(rom, game, room);
            } catch (error) {
                console.error('Could not stop the game lobby stream:', error);
                panel.querySelector('#stream-action-status').textContent = error.message || 'Could not stop the stream.';
                button.disabled = false;
            }
        });
        return;
    }

    panel.innerHTML = `
      <div class="p-4">
        <div class="mb-3">
          <h4 class="font-bold text-purple-200">📺 Live Game Stream</h4>
          <p class="text-xs text-gray-400">One streamer at a time for this live lobby. The slot automatically opens after one hour.</p>
        </div>
        ${rom.currentUser ? `
          <form id="claim-game-stream-form" class="flex flex-col gap-2 sm:flex-row">
            <input name="stream_url" type="url" required maxlength="2048" placeholder="Paste a public Twitch or YouTube live link" class="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white">
            <button type="submit" class="min-h-11 rounded-lg bg-purple-700 px-4 py-2 font-bold text-white hover:bg-purple-600">Claim 1-Hour Stream Slot</button>
          </form>
        ` : '<p class="text-sm text-gray-300"><a href="#/auth" class="font-bold text-cyan-300 hover:underline">Sign in</a> to claim the streamer slot.</p>'}
        <p id="stream-action-status" class="mt-2 min-h-5 text-xs text-red-300" role="status">${escapeHtml(loadError)}</p>
      </div>`;

    panel.querySelector('#claim-game-stream-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const url = String(data.get('stream_url') || '').trim();
        try {
            getLiveStreamEmbedUrl(url, true);
        } catch (error) {
            panel.querySelector('#stream-action-status').textContent = error.message;
            return;
        }

        const button = form.querySelector('[type="submit"]');
        button.disabled = true;
        panel.querySelector('#stream-action-status').textContent = 'Claiming the stream slot...';
        try {
            const { error: claimError } = await rom.supabase.rpc('claim_game_lobby_stream', {
                p_game_id: game.id,
                p_room_id: room.id,
                p_stream_url: url,
            });
            if (claimError) throw claimError;
            await refreshLobbyStream(rom, game, room);
        } catch (error) {
            console.error('Could not claim the game lobby stream:', error);
            panel.querySelector('#stream-action-status').textContent = error.message || 'Could not claim the stream slot.';
            button.disabled = false;
        }
    });
}

async function recordLobbyActivity(rom, roomId, activityType) {
    if (!rom.currentUser) return;
    try {
        const { error } = await rom.supabase.rpc('record_game_lobby_activity', {
            p_room_id: roomId,
        });
        if (error) console.error(`Could not record ${activityType} lobby activity:`, error);
    } catch (error) {
        console.error(`Could not record ${activityType} lobby activity:`, error);
    }
}

async function loadChatMessages(rom, roomId) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    isLoadingLobbyHistory = true;
    pendingLobbyMessages = [];
    renderedLobbyMessageIds = new Set();
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
        container.innerHTML = '';
        for (const msg of messages || []) {
            await appendMessageToDOM(msg, rom.currentUser?.id, rom);
        }

        const queuedMessages = pendingLobbyMessages;
        pendingLobbyMessages = [];
        isLoadingLobbyHistory = false;
        for (const msg of queuedMessages) {
            await appendMessageToDOM(msg, rom.currentUser?.id, rom);
        }
        if (!container.querySelector('[data-message-id]')) {
            container.innerHTML = '<div class="text-center text-gray-500 text-sm py-4">No messages yet. Say hi!</div>';
        }
        container.scrollTop = container.scrollHeight;

    } catch (err) {
        isLoadingLobbyHistory = false;
        console.error('Error loading messages:', err);
        container.innerHTML = '<div class="text-center text-red-400 text-sm py-4">Failed to load chat.</div>';
        const queuedMessages = pendingLobbyMessages;
        pendingLobbyMessages = [];
        for (const msg of queuedMessages) {
            await appendMessageToDOM(msg, rom.currentUser?.id, rom);
        }
    }
}

// ✅ FIX: Added 'rom' argument and fixed layout CSS to prevent overlap
// ✅ FIX: Stacked Layout (Card on top, Message below) - Guarantees no overlap
async function appendMessageToDOM(msg, currentUserId, rom) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    if (renderedLobbyMessageIds.has(msg.id) || container.querySelector(`[data-message-id="${msg.id}"]`)) return;
    renderedLobbyMessageIds.add(msg.id);

    const isMe = msg.user_id === currentUserId;
    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. SAFE FETCH
    let profileData = null;
    try {
        const { data } = await rom.supabase
            .from('profiles')
            .select(`username, avatar_url, motto, xp_total, gamercard_bg_type, gamercard_bg_value, stats, rank:user_ranks (name, color)`)
            .eq('id', msg.user_id)
            .single();
        profileData = data;
    } catch (e) { profileData = null; }

    // 2. Prepare Data
    const username = profileData?.username || msg.username || 'Unknown';
    const avatarUrl = profileData?.avatar_url || msg.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=06b6d4&color=fff`;
    const profileLink = `#/profile/${username}`;
    
    const rankName = profileData?.rank?.name || null;
    const rankColor = profileData?.rank?.color || '#9ca3af';
    const motto = profileData?.motto || '';
    const gcBgType = profileData?.gamercard_bg_type || 'color';
    const gcBgValue = profileData?.gamercard_bg_value || '#1f2937';
    const articleCount = profileData?.stats?.articles_published || 0;
    const isWriter = articleCount > 0;

    // 3. Construct Gamercard Background
    let bgStyle = `background-color: ${gcBgValue};`;
    if (gcBgType === 'image') bgStyle = `background-image: url('${gcBgValue}'); background-size: cover; background-position: center;`;
    else if (gcBgType === 'gradient') bgStyle = `background-image: ${gcBgValue};`;

    const writerBadgeHtml = isWriter ? `<span class="text-[9px] px-1 py-0.5 rounded font-bold block w-fit mb-0.5" style="background:#ec489940; color:#ec4899; border:1px solid #ec4899;">✒️ Writer</span>` : '';

    // 4. Construct HTML (STACKED LAYOUT)
    // Structure: [Container -> [Gamercard Header] + [Message Bubble]]
    const messageEl = document.createElement('div');
    messageEl.dataset.messageId = msg.id;
    messageEl.dataset.createdAt = msg.created_at;
    
    // Container: Flex Column (Stacks items vertically)
    // Items-start ensures left alignment for others, flex-row-reverse handles "Me" alignment
    messageEl.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-fade-in mb-4 w-full`;

    messageEl.innerHTML = `
        <!-- TOP: Gamercard / User Info -->
        <div class="mb-1.5 flex items-center gap-2">
            <a href="${profileLink}" class="group block hover:scale-105 transition-transform">
                <div class="gamercard chat-gamercard relative overflow-hidden rounded border border-gray-700 shadow-md bg-gray-900" style="width: 160px;">
                    <div class="absolute inset-0" style="${bgStyle} opacity: 0.6; filter: brightness(0.8);"></div>
                    <div class="absolute inset-0 bg-gradient-to-br from-black/40 to-black/20"></div>
                    <div class="relative z-10 p-1.5 flex items-center gap-2">
                        <img src="${avatarUrl}" class="w-6 h-6 rounded-full border border-cyan-500 object-cover">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-1">
                                <span class="text-[10px] font-bold text-white truncate">${escapeHtml(username)}</span>
                            </div>
                            ${rankName ? `<span class="text-[8px] px-1 rounded font-bold block w-fit" style="background:${rankColor}40; color:${rankColor}; border:1px solid ${rankColor};">${escapeHtml(rankName)}</span>` : ''}
                            ${writerBadgeHtml}
                        </div>
                    </div>
                </div>
            </a>
            <span class="text-[9px] text-gray-500 mt-2">${time}</span>
        </div>

        <!-- BOTTOM: Message Bubble -->
        <!-- Max-width ensures it doesn't stretch too wide on large screens -->
        <div class="text-sm px-3 py-2 rounded-lg break-words shadow-md border border-gray-700 max-w-[90%] md:max-w-[80%] ${
            isMe 
            ? 'bg-cyan-900/40 text-cyan-50 rounded-tl-none border-cyan-800/50' 
            : 'bg-gray-800 text-gray-200 rounded-tr-none'
        }">
            ${escapeHtml(msg.message)}
        </div>
    `;

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
        "@context": " https://schema.org ",
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
        star.className = `flex min-h-11 min-w-11 items-center justify-center text-3xl transition-transform hover:scale-110 focus:outline-none ${i <= currentRating ? 'text-yellow-400' : 'text-gray-600'}`;
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
                    <div class="bg-gray-800/90 backdrop-blur rounded-lg p-4 border border-gray-700 hover:border-cyan-500 transition shadow-xl flex flex-col h-full">
                        <div class="flex gap-3 w-full">
                            <div class="flex-shrink-0">
                                <img src="${a.badge_url || 'https://via.placeholder.com/48/1f2937/6b7280?text=🏆'}" 
                                     alt="${escapeHtml(a.title)}" class="w-12 h-12 rounded object-cover border border-gray-600 shadow-md">
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex justify-between items-start mb-1">
                                    <h3 class="text-sm font-bold text-white leading-tight drop-shadow-md break-words">${escapeHtml(a.title)}</h3>
                                    <span class="text-yellow-400 text-xs font-bold bg-yellow-900/40 px-1.5 py-0.5 rounded ml-2 border border-yellow-700/50 shadow-sm flex-shrink-0">${a.points} pts</span>
                                </div>
                                <!-- FIXED: Removed line-clamp, added break-words and normal whitespace -->
                                <p class="text-gray-300 text-xs mt-1 mb-2 font-medium break-words whitespace-normal leading-relaxed">${escapeHtml(a.description || '')}</p>
                                
                                <div class="mt-auto">
                                    <div class="w-full bg-gray-700 rounded-full h-1.5 relative overflow-hidden">
                                        <div class="bg-cyan-500 h-1.5 rounded-full absolute top-0 left-0 transition-all duration-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]" style="width: ${rate}%"></div>
                                    </div>
                                    <div class="flex justify-between items-center mt-1">
                                        <span class="text-[10px] text-gray-400 font-bold">${count} unlocks</span>
                                        <span class="text-[10px] text-cyan-400 font-bold">${rate > 0 ? rate + '%' : '0%'}</span>
                                    </div>
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
  const avatar = profile.avatar_url || ` https://ui-avatars.com/api/?name=${name}&background=06b6d4&color=fff`;
  const rankName = profile.rank?.name || 'Player';
  const rankColor = profile.rank?.color || '#9ca3af';
  const motto = profile.motto || '';
  
  const xp = profile.xp_total || 0;
  const xpPercent = Math.min(100, (xp % 1000) / 10); 

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
