// modules/game-detail/game-detail.js - FINAL CORRECT VERSION
let isInitialized = false;

export default async function initGameDetail(rom, identifier) {
    if (isInitialized) return;
    isInitialized = true;

    console.log('🎮 Loading game for:', identifier);

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
        // QUERY BY SLUG ONLY (your URLs use slugs)
        console.log('🔍 Querying games table by slug:', identifier);
        
        const {  game, error: gameError } = await rom.supabase
            .from('games')
            .select('*')
            .eq('slug', identifier)  // ← CORRECT: query by 'slug' column
            .single();
        
        console.log('📊 Query result:', { 
            found: !!game, 
            error: gameError?.message || gameError?.details || 'none' 
        });

        if (gameError) {
            console.error('❌ Supabase error:', gameError);
        }
        
        if (!game) {
            // DEBUG: Show what slugs actually exist
            const {  allGames } = await rom.supabase
                .from('games')
                .select('slug, title')
                .limit(20);
            
            console.log('📋 Available slugs in DB:', allGames?.map(g => g.slug));
            console.log('❌ Game not found. URL slug:', identifier);
            
            loading.classList.add('hidden');
            error.classList.remove('hidden');
            return;
        }

        console.log('✅ Game found:', game.title, '(slug:', game.slug, ')');
        loading.classList.add('hidden');
        content.classList.remove('hidden');

        // Render simple layout
        content.innerHTML = `
            <div class="max-w-7xl mx-auto p-4">
                <a href="#/games" class="text-cyan-400 hover:underline mb-4 inline-block">← Back to Games</a>
                
                <div class="flex flex-col md:flex-row gap-8">
                    <div class="md:w-1/3">
                        ${game.cover_image_url 
                            ? `<img src="${game.cover_image_url}" class="w-full rounded-lg shadow-lg" alt="${escapeHtml(game.title)}">` 
                            : '<div class="w-full h-64 bg-gray-700 rounded-lg flex items-center justify-center text-4xl">🎮</div>'}
                    </div>
                    
                    <div class="md:w-2/3">
                        <h1 class="text-3xl font-bold text-white mb-2">${escapeHtml(game.title)}</h1>
                        
                        <div class="flex gap-2 mb-4">
                            <span class="bg-gray-700 text-cyan-300 px-3 py-1 rounded text-sm">${escapeHtml(game.console)}</span>
                            ${game.year ? `<span class="bg-gray-700 text-gray-300 px-3 py-1 rounded text-sm">${game.year}</span>` : ''}
                        </div>
                        
                        <p class="text-gray-300 mb-6 whitespace-pre-line">${escapeHtml(game.description || 'No description available.')}</p>
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
