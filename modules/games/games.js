import { supabase, getCurrentUser } from '../../lib/supabase.js';

export function initModule() {
    console.log('🎮 Games module initialized');
    
    // Handle form submission
    document.getElementById('game-form')?.addEventListener('submit', handleGameSubmit);
    
    // Handle server details toggle
    const serversCheckbox = document.querySelector('input[name="servers_available"]');
    if (serversCheckbox) {
        serversCheckbox.addEventListener('change', function(e) {
            const serverDetails = document.getElementById('server-details-container');
            if (serverDetails) {
                serverDetails.classList.toggle('hidden', !e.target.checked);
            }
        });
    }
    
    // Auto-update player max if min is higher
    const playersMinInput = document.querySelector('input[name="players_min"]');
    if (playersMinInput) {
        playersMinInput.addEventListener('change', function(e) {
            const min = parseInt(e.target.value) || 1;
            const maxInput = document.querySelector('input[name="players_max"]');
            if (maxInput) {
                const max = parseInt(maxInput.value) || 1;
                if (min > max) {
                    maxInput.value = min;
                }
            }
        });
    }
    
    // Load existing games
    loadGames();
    
    // Setup search and filter
    setupSearchAndFilter();
}

function setupSearchAndFilter() {
    const searchInput = document.getElementById('game-search');
    const consoleFilter = document.getElementById('console-filter');
    
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
    
    if (consoleFilter) {
        consoleFilter.addEventListener('change', handleFilter);
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function handleSearch() {
    const searchTerm = document.getElementById('game-search').value.toLowerCase();
    const gameCards = document.querySelectorAll('#games-list > div');
    
    gameCards.forEach(card => {
        const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
        const description = card.querySelector('p.text-gray-300')?.textContent.toLowerCase() || '';
        const console = card.querySelector('span.bg-cyan-600')?.textContent.toLowerCase() || '';
        
        if (title.includes(searchTerm) || description.includes(searchTerm) || console.includes(searchTerm)) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    });
}

function handleFilter() {
    const selectedConsole = document.getElementById('console-filter').value;
    const gameCards = document.querySelectorAll('#games-list > div');
    
    gameCards.forEach(card => {
        const console = card.querySelector('span.bg-cyan-600')?.textContent || '';
        
        if (!selectedConsole || console === selectedConsole) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    });
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
    const notes = formData.get('notes');
    const gameFile = formData.get('game_file');
    
    // Connection fields
    const connectionMethod = formData.get('connection_method');
    const connectionDetails = formData.get('connection_details');
    const multiplayerType = formData.get('multiplayer_type');
    const playersMin = parseInt(formData.get('players_min')) || 1;
    const playersMax = parseInt(formData.get('players_max')) || 1;
    const serversAvailable = formData.get('servers_available') === 'on';
    const serverDetails = formData.get('server_details');
    
    // Basic validation
    if (!title || !console || !year || !description || !connectionMethod || !multiplayerType) {
        alert('Please fill in all required fields (title, console, year, description, multiplayer type, connection method).');
        return;
    }
    
    if (playersMin > playersMax) {
        alert('Minimum players cannot be greater than maximum players.');
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
        
        // Save submission to database with connection details
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
                
                // Connection details
                connection_method: connectionMethod,
                connection_details: connectionDetails,
                multiplayer_type: multiplayerType,
                players_min: playersMin,
                players_max: playersMax,
                servers_available: serversAvailable,
                server_details: serverDetails,
                
                status: 'pending',
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) throw error;
        
        console.log('Game submission successful:', data);
        
        // Show success message with connection info
        const playerCount = playersMin === playersMax 
            ? `${playersMin} player${playersMin > 1 ? 's' : ''}` 
            : `${playersMin}-${playersMax} players`;
        
        const successHTML = `
            <div class="bg-green-900 border border-green-700 rounded-lg p-6 text-center">
                <div class="text-4xl mb-4">✅</div>
                <h3 class="text-xl font-bold text-green-300 mb-2">Game Submitted Successfully!</h3>
                <p class="text-green-200 mb-4">"${title}" has been submitted for admin review.</p>
                
                <div class="bg-gray-800 p-4 rounded-lg mb-4 text-left">
                    <h4 class="font-bold text-cyan-300 mb-2">Connection Details Submitted:</h4>
                    <ul class="text-gray-300 space-y-1">
                        <li>🎮 <strong>Type:</strong> ${multiplayerType}</li>
                        <li>👥 <strong>Players:</strong> ${playerCount}</li>
                        <li>🌐 <strong>Connection:</strong> ${connectionMethod}</li>
                        ${serversAvailable ? '<li>🟢 <strong>Active Servers:</strong> Available</li>' : ''}
                    </ul>
                </div>
                
                <p class="text-gray-300 text-sm mb-6">
                    You will be notified when your game is approved. 
                    It will then appear in the public game library with connection instructions.
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
    
    gamesContainer.innerHTML = '<div class="text-center py-12"><div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div><p class="text-gray-400 mt-4">Loading game library...</p></div>';
    
    try {
        const { data: games, error } = await supabase
            .from('games')
            .select('*')
            .order('title', { ascending: true });
        
        if (error) throw error;
        
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
        
        gamesContainer.innerHTML = games.map(game => {
            const playerCount = game.players_min === game.players_max 
                ? `${game.players_min} player${game.players_min > 1 ? 's' : ''}` 
                : `${game.players_min}-${game.players_max} players`;
            
            return `
                <div class="bg-gray-800 p-6 rounded-lg mb-6 border border-gray-700 hover:border-cyan-500 transition group">
                    <div class="flex flex-col md:flex-row justify-between items-start mb-4">
                        <div class="flex-1">
                            <h3 class="text-2xl font-bold text-white mb-2 group-hover:text-cyan-300 transition">${game.title}</h3>
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="bg-cyan-600 text-white px-3 py-1 rounded text-sm font-semibold">${game.console}</span>
                                <span class="text-gray-300">${game.year}</span>
                                <span class="text-gray-400">•</span>
                                <span class="bg-purple-600 text-white px-3 py-1 rounded text-sm">${game.multiplayer_type || 'Multiplayer'}</span>
                                <span class="text-gray-400">•</span>
                                <span class="text-gray-300">${playerCount}</span>
                            </div>
                        </div>
                        <div class="mt-2 md:mt-0">
                            <span class="bg-green-600 text-white px-3 py-1 rounded text-sm font-semibold">✅ Approved</span>
                        </div>
                    </div>
                    
                    <p class="text-gray-300 mb-4">${game.description}</p>
                    
                    <!-- Connection Details Section -->
                    <div class="bg-gray-900 p-4 rounded-lg mb-4 border border-purple-500">
                        <h4 class="font-bold text-purple-300 mb-2 flex items-center">
                            <span class="mr-2">🌐</span> How to Play Online
                        </h4>
                        
                        <div class="grid md:grid-cols-2 gap-4">
                            <div>
                                <p class="text-gray-300">
                                    <strong class="text-cyan-300">Connection:</strong> ${game.connection_method || 'Not specified'}
                                </p>
                                ${game.servers_available ? `
                                    <p class="text-green-400 mt-1">
                                        <span class="mr-1">🟢</span> Active servers available
                                    </p>
                                ` : ''}
                            </div>
                            
                            ${game.connection_details ? `
                                <div>
                                    <p class="text-gray-300">
                                        <strong class="text-cyan-300">Instructions:</strong> ${game.connection_details}
                                    </p>
                                </div>
                            ` : ''}
                        </div>
                        
                        ${game.server_details ? `
                            <div class="mt-3 pt-3 border-t border-gray-700">
                                <p class="text-gray-300">
                                    <strong class="text-green-300">Server Info:</strong> ${game.server_details}
                                </p>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="flex flex-col md:flex-row justify-between items-center">
                        <div class="text-gray-400 text-sm mb-4 md:mb-0">
                            Approved: ${new Date(game.approved_at).toLocaleDateString()}
                            ${game.downloads ? ` • Downloads: ${game.downloads}` : ''}
                            ${game.rating ? ` • Rating: ${game.rating}/5` : ''}
                        </div>
                        
                        <div class="flex space-x-3">
                            ${game.file_url ? `
                                <a href="${game.file_url}" target="_blank" 
                                   class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded inline-flex items-center transition">
                                    <span class="mr-2">⬇️</span>
                                    Download Game
                                </a>
                            ` : `
                                <button class="bg-gray-700 text-gray-400 px-4 py-2 rounded cursor-not-allowed">
                                    No File Available
                                </button>
                            `}
                            
                            <button onclick="showConnectionDetails('${game.id}')" 
                                    class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded inline-flex items-center transition">
                                <span class="mr-2">🔗</span>
                                Connection Guide
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
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

// Connection details modal
window.showConnectionDetails = async function(gameId) {
    try {
        const { data: game, error } = await supabase
            .from('games')
            .select('*')
            .eq('id', gameId)
            .single();
        
        if (error) throw error;
        
        const playerCount = game.players_min === game.players_max 
            ? `${game.players_min} player${game.players_min > 1 ? 's' : ''}` 
            : `${game.players_min}-${game.players_max} players`;
        
        const modalHTML = `
            <div id="connection-modal" class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                <div class="bg-gray-800 rounded-lg max-w-2xl w-full border border-purple-500 max-h-[90vh] overflow-y-auto">
                    <div class="p-6">
                        <div class="flex justify-between items-start mb-6">
                            <div>
                                <h3 class="text-2xl font-bold text-white mb-1">🌐 ${game.title}</h3>
                                <p class="text-gray-300">Connection Guide for Online Play</p>
                            </div>
                            <button onclick="closeConnectionModal()" 
                                    class="text-gray-400 hover:text-white text-2xl">
                                &times;
                            </button>
                        </div>
                        
                        <div class="space-y-6">
                            <!-- Basic Info -->
                            <div class="grid md:grid-cols-3 gap-4">
                                <div class="bg-gray-900 p-4 rounded">
                                    <p class="text-gray-400 text-sm">Multiplayer Type</p>
                                    <p class="text-white font-bold">${game.multiplayer_type || 'Not specified'}</p>
                                </div>
                                <div class="bg-gray-900 p-4 rounded">
                                    <p class="text-gray-400 text-sm">Player Count</p>
                                    <p class="text-white font-bold">${playerCount}</p>
                                </div>
                                <div class="bg-gray-900 p-4 rounded">
                                    <p class="text-gray-400 text-sm">Connection Method</p>
                                    <p class="text-white font-bold">${game.connection_method || 'Not specified'}</p>
                                </div>
                            </div>
                            
                            <!-- Connection Instructions -->
                            ${game.connection_details ? `
                                <div>
                                    <h4 class="text-lg font-bold text-cyan-300 mb-2">📝 Connection Instructions</h4>
                                    <div class="bg-gray-900 p-4 rounded whitespace-pre-line text-gray-300">
                                        ${game.connection_details}
                                    </div>
                                </div>
                            ` : ''}
                            
                            <!-- Server Information -->
                            ${game.server_details ? `
                                <div>
                                    <h4 class="text-lg font-bold text-green-300 mb-2">🖥️ Server Information</h4>
                                    <div class="bg-gray-900 p-4 rounded text-gray-300">
                                        ${game.server_details}
                                    </div>
                                </div>
                            ` : ''}
                            
                            <!-- Server Status -->
                            <div>
                                <h4 class="text-lg font-bold mb-2">Server Status</h4>
                                <div class="flex items-center">
                                    <div class="w-3 h-3 rounded-full mr-2 ${game.servers_available ? 'bg-green-500' : 'bg-red-500'}"></div>
                                    <span class="text-gray-300">
                                        ${game.servers_available ? '🟢 Active servers are available' : '🔴 No active servers reported'}
                                    </span>
                                </div>
                            </div>
                            
                            <!-- Community Notes -->
                            <div class="bg-blue-900/30 border border-blue-700 rounded p-4">
                                <h4 class="text-lg font-bold text-blue-300 mb-2">💡 Tips & Community Notes</h4>
                                <p class="text-gray-300 text-sm">
                                    • Check the Discord community for matchmaking<br>
                                    • Make sure your firewall allows the connection<br>
                                    • Update your game to the latest version if possible<br>
                                    • Use wired connection for better stability
                                </p>
                            </div>
                        </div>
                        
                        <div class="mt-8 flex justify-end">
                            <button onclick="closeConnectionModal()" 
                                    class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
    } catch (error) {
        console.error('Error loading connection details:', error);
        alert('Could not load connection details: ' + error.message);
    }
};

window.closeConnectionModal = function() {
    const modal = document.getElementById('connection-modal');
    if (modal) modal.remove();
};

// Make loadGames available globally
window.loadGames = loadGames;
