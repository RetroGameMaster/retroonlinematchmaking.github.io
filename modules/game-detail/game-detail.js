// modules/game-detail/game-detail.js - BULLETPROOF VERSION
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
        // DEBUG: Log all games to see what slugs actually exist
        const { data: allGames, error: listError } = await rom.supabase
            .from('games')
            .select('id, title, slug')
            .limit(20);
        
        console.log('📋 Available games in DB:', allGames?.map(g => ({slug: g.slug, title: g.title})));

        // Try query by slug first
        const {  game: slugGame, error: slugError } = await rom.supabase
            .from('games')
            .select('*')
            .eq('slug', identifier)
            .single();
        
        console.log('🔍 Slug query result:', { 
            identifier, 
            found: !!slugGame, 
            error: slugError?.message 
        });

        let game = slugGame;
        
        // If slug didn't work, try query by ID
        if (!game) {
            const {  game: idGame, error: idError } = await rom.supabase
                .from('games')
                .select('*')
                .eq('id', identifier)
                .single();
            
            console.log('🔍 ID query result:', { 
                identifier, 
                found: !!idGame, 
                error: idError?.message 
            });
            game = idGame;
        }

        if (!game) {
            console.error('❌ Game not found. Available slugs:', allGames?.map(g => g.slug));
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
