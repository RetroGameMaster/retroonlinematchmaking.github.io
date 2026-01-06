import { supabase, getCurrentUser } from '../../lib/supabase.js';

export function initModule() {
    console.log('🎮 Games module initialized');
    
    // Handle form submission
    document.getElementById('game-form')?.addEventListener('submit', handleGameSubmit);
    
    // Load existing games
    loadGames();
}

// Update the handleGameSubmit function
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
    const notes = formData.get('notes');
    const gameFile = formData.get('game_file');
    
    // Basic validation
    if (!title || !console || !year || !description) {
        alert('Please fill in all required fields (title, console, year, description).');
        return;
    }
    
    if (!form.querySelector('#agree-tos').checked) {
        alert('You must agree to the Terms of Service to submit a game.');
        return;
    }
    
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    submitBtn.classList.add('opacity-50');
    
    try {
        let fileUrl = '';
        
        // Handle file upload if present
        if (gameFile && gameFile.size > 0) {
            if (gameFile.size > 100 * 1024 * 1024) { // 100MB limit
                throw new Error('File size exceeds 100MB limit');
            }
            
            submitBtn.textContent = 'Uploading file...';
            
            // Upload to Supabase Storage
            const fileExt = gameFile.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
            const filePath = `game_files/${fileName}`;
            
            const { error: uploadError } = await supabase.storage
                .from('game_files')
                .upload(filePath, gameFile);
            
            if (uploadError) throw uploadError;
            
            // Get public URL
            const { data: urlData } = supabase.storage
                .from('game_files')
                .getPublicUrl(filePath);
            
            fileUrl = urlData.publicUrl;
        }
        
        submitBtn.textContent = 'Saving submission...';
        
        // Save submission to database
        const { data, error } = await supabase
            .from('game_submissions')
            .insert({
                title,
                console,
                year: parseInt(year),
                description,
                notes,
                file_url: fileUrl,
                user_id: user.id,
                user_email: user.email,
                status: 'pending',
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) throw error;
        
        console.log('Game submission successful:', data);
        
        // Show success message
        const successHTML = `
            <div class="bg-green-900 border border-green-700 rounded-lg p-6 text-center">
                <div class="text-4xl mb-4">✅</div>
                <h3 class="text-xl font-bold text-green-300 mb-2">Game Submitted Successfully!</h3>
                <p class="text-green-200 mb-4">"${title}" has been submitted for admin review.</p>
                <p class="text-gray-300 text-sm">
                    You will be notified when your game is approved. 
                    It will then appear in the public game library.
                </p>
                <div class="mt-6 space-x-4">
                    <button onclick="window.location.hash = '#/games'" 
                            class="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded">
                        Back to Games
                    </button>
                    <button onclick="window.location.hash = '#/home'" 
                            class="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded">
                        Go Home
                    </button>
                </div>
            </div>
        `;
        
        // Replace the form with success message
        const formContainer = document.querySelector('.bg-gray-800.p-8');
        if (formContainer) {
            formContainer.innerHTML = successHTML;
        } else {
            alert('🎮 Game submitted successfully! It will be reviewed by an admin soon.');
            form.reset();
        }
        
    } catch (error) {
        console.error('Error submitting game:', error);
        
        let errorMessage = error.message;
        if (error.message.includes('storage')) {
            errorMessage = 'File upload failed. Please try a smaller file or different format.';
        } else if (error.message.includes('game_submissions')) {
            errorMessage = 'Database error. Please try again or contact support.';
        }
        
        alert('Error submitting game: ' + errorMessage);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        submitBtn.classList.remove('opacity-50');
    }
}

async function loadGames() {
    const gamesContainer = document.getElementById('games-list');
    if (!gamesContainer) return;
    
    gamesContainer.innerHTML = '<div class="text-center py-8"><div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div><p class="text-gray-400 mt-2">Loading games...</p></div>';
    
    try {
        // First try to get approved games
        const { data: games, error } = await supabase
            .from('games')
            .select('*')
            .order('title', { ascending: true });
        
        if (error) {
            // If games table doesn't exist, show message
            if (error.code === '42P01') {
                gamesContainer.innerHTML = `
                    <div class="text-center py-8">
                        <div class="text-4xl mb-4">📂</div>
                        <h3 class="text-xl font-bold text-white mb-2">No Games Yet</h3>
                        <p class="text-gray-300 mb-4">The games library hasn't been set up yet.</p>
                        <p class="text-gray-400 text-sm">Submit a game to get started!</p>
                    </div>
                `;
                return;
            }
            throw error;
        }
        
        if (!games || games.length === 0) {
            gamesContainer.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-4xl mb-4">🎮</div>
                    <h3 class="text-xl font-bold text-white mb-2">No Games Available</h3>
                    <p class="text-gray-300">No games have been approved yet.</p>
                    <p class="text-gray-400 text-sm mt-2">Be the first to submit a game!</p>
                </div>
            `;
            return;
        }
        
        // Get user emails for submitted_by
        const userIds = [...new Set(games.map(g => g.submitted_by))];
        const userEmails = {};
        
        for (const userId of userIds) {
            try {
                const { data: user } = await supabase.auth.admin.getUserById(userId);
                if (user?.user?.email) {
                    userEmails[userId] = user.user.email;
                }
            } catch (err) {
                console.log('Could not fetch user:', userId, err);
            }
        }
        
        gamesContainer.innerHTML = games.map(game => `
            <div class="bg-gray-800 p-6 rounded-lg mb-4 border border-gray-700 hover:border-cyan-500 transition">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-2xl font-bold text-white mb-2">${game.title}</h3>
                        <div class="flex items-center space-x-4">
                            <span class="bg-cyan-600 text-white px-3 py-1 rounded text-sm">${game.console}</span>
                            <span class="text-gray-300">${game.year}</span>
                            <span class="text-gray-500 text-sm">
                                Submitted by: ${userEmails[game.submitted_by] || 'Unknown'}
                            </span>
                        </div>
                    </div>
                    <span class="bg-green-600 text-white px-3 py-1 rounded text-sm">✅ Approved</span>
                </div>
                
                <p class="text-gray-300 mb-4">${game.description}</p>
                
                <div class="flex items-center justify-between mt-4">
                    <div class="text-gray-400 text-sm">
                        Approved: ${new Date(game.approved_at).toLocaleDateString()}
                        ${game.downloads ? ` • Downloads: ${game.downloads}` : ''}
                        ${game.rating ? ` • Rating: ${game.rating}/5` : ''}
                    </div>
                    
                    ${game.file_url ? `
                        <a href="${game.file_url}" target="_blank" 
                           class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded inline-flex items-center">
                            <span class="mr-2">⬇️</span>
                            Download
                        </a>
                    ` : `
                        <button class="bg-gray-700 text-gray-400 px-4 py-2 rounded cursor-not-allowed">
                            No File Available
                        </button>
                    `}
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading games:', error);
        gamesContainer.innerHTML = `
            <div class="bg-red-900 border border-red-700 rounded-lg p-6 text-center">
                <h3 class="text-lg font-bold text-red-300 mb-2">Error Loading Games</h3>
                <p class="text-red-200 mb-2">${error.message}</p>
                <button onclick="loadGames()" 
                        class="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">
                    Try Again
                </button>
            </div>
        `;
    }
}

// Make loadGames available globally
window.loadGames = loadGames;
