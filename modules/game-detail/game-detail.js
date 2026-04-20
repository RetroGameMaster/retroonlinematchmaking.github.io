// modules/game-detail/game-detail.js - FINAL MINIMAL VERSION
let isInitialized = false;

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
        // QUERY BY SLUG ONLY - NO FALLBACKS, NO COMPLEXITY
        console.log('🔍 Querying games.slug =', identifier);
        
        const result = await rom.supabase
            .from('games')
            .select('*')
            .eq('slug', identifier)
            .single();
        
        console.log('✅ Supabase response:', {
            hasData: !!result.data,
            hasError: !!result.error,
            error: result.error?.message
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
                    
                    <!-- 🖼️ SCREENSHOTS SECTION (RA STYLE) -->
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
                </div>
            </div>
        </div>
    `;

    } catch (err) {
        console.error('❌ Exception:', err);
        loading.classList.add('hidden');
        error.classList.remove('hidden');
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
