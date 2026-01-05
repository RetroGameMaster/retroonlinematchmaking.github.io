import { supabase, getCurrentUser } from '../../lib/supabase.js';

export function initGamesModule() {
    console.log('Games module initialized');
    
    // Handle form submission
    document.getElementById('game-form')?.addEventListener('submit', handleGameSubmit);
    
    // Load existing games
    loadGames();
}

async function handleGameSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const user = await getCurrentUser();
    
    if (!user) {
        alert('Please login to submit a game.');
        window.location.hash = '#/auth';
        return;
    }
    
    const formData = new FormData(form);
    const title = formData.get('title');
    const console = formData.get('console');
    const year = formData.get('year');
    const description = formData.get('description');
    const fileInput = form.querySelector('input[type="file"]');
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';
    
    try {
        // Upload file to Supabase Storage
        let fileUrl = '';
        if (fileInput.files[0]) {
            const file = fileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
            const filePath = `game_files/${fileName}`;
            
            const { error: uploadError } = await supabase.storage
                .from('game_files')
                .upload(filePath, file);
            
            if (uploadError) throw uploadError;
            
            // Get public URL
            const { data: urlData } = supabase.storage
                .from('game_files')
                .getPublicUrl(filePath);
            
            fileUrl = urlData.publicUrl;
        }
        
        // Save submission to database
        const { error: dbError } = await supabase
            .from('game_submissions')
            .insert({
                title,
                console,
                year,
                description,
                file_url: fileUrl,
                user_id: user.id,
                status: 'pending',
                created_at: new Date().toISOString()
            });
        
        if (dbError) throw dbError;
        
        alert('Game submitted for review! Thank you.');
        form.reset();
        
    } catch (error) {
        console.error('Error submitting game:', error);
        alert('Error submitting game. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Game';
    }
}

async function loadGames() {
    const gamesContainer = document.getElementById('games-list');
    if (!gamesContainer) return;
    
    gamesContainer.innerHTML = '<p>Loading games...</p>';
    
    try {
        // Get approved games
        const { data: games, error } = await supabase
            .from('games')
            .select(`
                *,
                users:submitted_by (
                    email
                )
            `)
            .order('title', { ascending: true });
        
        if (error) throw error;
        
        if (!games || games.length === 0) {
            gamesContainer.innerHTML = '<p class="text-gray-500">No games available yet.</p>';
            return;
        }
        
        gamesContainer.innerHTML = games.map(game => `
            <div class="bg-gray-800 p-4 rounded-lg mb-4">
                <h3 class="text-xl font-bold text-white">${game.title}</h3>
                <p class="text-gray-300">Console: ${game.console} | Year: ${game.year}</p>
                <p class="text-gray-300">${game.description}</p>
                <p class="text-gray-400 text-sm">Submitted by: ${game.users?.email || 'Unknown'}</p>
                ${game.file_url ? `
                    <a href="${game.file_url}" target="_blank" 
                       class="inline-block mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
                        Download
                    </a>
                ` : ''}
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading games:', error);
        gamesContainer.innerHTML = '<p class="text-red-500">Error loading games.</p>';
    }
}
