// modules/games/games.js
export function initModule(rom) {
    console.log('🎮 Games module initialized');
    console.log('rom.supabase available:', !!rom?.supabase);
    console.log('rom.currentUser:', rom?.currentUser?.email);
    
    // Store rom globally for this module
    window.rom = rom;
    
    // Get supabase from rom or window
    const supabase = rom?.supabase || window.supabase;
    
    if (!supabase) {
        console.error('❌ No Supabase client available!');
        showError('Database connection error. Please refresh the page.');
        return;
    }
    
    console.log('✅ Supabase client available');
    
    // Handle form submission with proper supabase
    const gameForm = document.getElementById('game-form');
    if (gameForm) {
        console.log('✅ Found game form, attaching submit handler');
        gameForm.addEventListener('submit', (e) => handleGameSubmit(e, supabase, rom));
    } else {
        console.log('⚠️ No game form found on this page');
    }
    
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
    
    // Load existing games with supabase
    loadGames(supabase);
    
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

async function handleGameSubmit(e, supabase, rom) {
    e.preventDefault();
    console.log('📤 Form submission started...');
    
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    
    // Check if user is logged in
    if (!rom?.currentUser) {
        alert('Please login to submit a game.');
        window.location.hash = '#/auth';
        return;
    }
    
    const user = rom.currentUser;
    console.log('✅ User authenticated:', user.email);
    
    // Get form data
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
    
    // Image files
    const coverImage = document.getElementById('cover-image')?.files[0];
    const screenshotInput = document.getElementById('screenshots');
    const screenshotFiles = Array.from(screenshotInput?.files || []);
    
    console.log('📝 Form data collected:', {
        title, console, year, description,
        connectionMethod, multiplayerType
    });
    
    // Validation
    if (!title || !console || !year || !description || !connectionMethod || !multiplayerType) {
        alert('Please fill in all required fields.');
        return;
    }
    
    if (playersMin > playersMax) {
        alert('Minimum players cannot be greater than maximum players.');
        return;
    }
    
    const agreeTos = document.getElementById('agree-tos');
    if (agreeTos && !agreeTos.checked) {
        alert('You must agree to the Terms of Service.');
        return;
    }
    
    if (!coverImage) {
        alert('Please upload a cover image for the game.');
        return;
    }
    
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    submitBtn.classList.add('opacity-50');
    
    try {
        let fileUrl = '';
        let coverImageUrl = '';
        let screenshotUrls = [];
        
        // 1. Upload cover image
        submitBtn.textContent = 'Uploading cover image...';
        console.log('📸 Uploading cover image...');
        coverImageUrl = await uploadImage(coverImage, 'game_covers', 'cover', supabase);
        console.log('✅ Cover image uploaded:', coverImageUrl);
        
        // 2. Upload screenshots
        if (screenshotFiles.length > 0) {
            submitBtn.textContent = 'Uploading screenshots...';
            console.log(`📸 Uploading ${screenshotFiles.length} screenshots...`);
            for (const screenshot of screenshotFiles) {
                const url = await uploadImage(screenshot, 'game_screenshots', 'screenshot', supabase);
                screenshotUrls.push(url);
            }
            console.log('✅ Screenshots uploaded:', screenshotUrls.length);
        }
        
        // 3. Upload game file (if any)
        if (gameFile && gameFile.size > 0) {
            submitBtn.textContent = 'Uploading game file...';
            console.log('📁 Uploading game file...');
            fileUrl = await uploadGameFile(gameFile, supabase);
            console.log('✅ Game file uploaded:', fileUrl);
        }
        
        // 4. Save submission to database
        submitBtn.textContent = 'Saving submission...';
        console.log('💾 Saving to Supabase...');
        
        const submissionData = {
            title,
            console,
            year: parseInt(year),
            description,
            notes: notes || null,
            file_url: fileUrl || null,
            user_id: user.id,
            user_email: user.email,
            
            // Connection details
            connection_method: connectionMethod,
            connection_details: connectionDetails || null,
            multiplayer_type: multiplayerType,
            players_min: playersMin,
            players_max: playersMax,
            servers_available: serversAvailable,
            server_details: serverDetails || null,
            
            // Image details
            cover_image_url: coverImageUrl,
            screenshot_urls: screenshotUrls,
            
            status: 'pending',
            created_at: new Date().toISOString()
        };
        
        console.log('📤 Inserting into Supabase:', submissionData);
        
        const { data, error } = await supabase
            .from('game_submissions')
            .insert([submissionData])
            .select()
            .single();
        
        if (error) {
            console.error('❌ Supabase insert error:', error);
            throw error;
        }
        
        console.log('✅ Game submission saved to Supabase:', data);
        
        // Show success
        showSubmissionSuccess(
            title, 
            multiplayerType, 
            connectionMethod, 
            playersMin, 
            playersMax, 
            serversAvailable,
            data.id
        );
        
    } catch (error) {
        console.error('❌ Error submitting game:', error);
        alert('Error submitting game: ' + error.message);
        
        // Also save to localStorage as backup
        try {
            const submissions = JSON.parse(localStorage.getItem('rom_game_submissions') || '[]');
            const backupData = {
                id: 'backup_' + Date.now(),
                title,
                console,
                year: parseInt(year),
                description,
                notes,
                user_id: user.id,
                user_email: user.email,
                connection_method: connectionMethod,
                connection_details: connectionDetails,
                multiplayer_type: multiplayerType,
                players_min: playersMin,
                players_max: playersMax,
                servers_available: serversAvailable,
                server_details: serverDetails,
                status: 'pending',
                created_at: new Date().toISOString(),
                error: error.message,
                backup_saved: true
            };
            
            submissions.push(backupData);
            localStorage.setItem('rom_game_submissions', JSON.stringify(submissions));
            console.log('✅ Saved backup to localStorage');
        } catch (backupError) {
            console.error('Failed to save backup:', backupError);
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        submitBtn.classList.remove('opacity-50');
    }
}

async function uploadImage(file, bucket, type, supabase) {
    console.log(`📤 Uploading ${type} image:`, file.name, file.type, file.size);
    
    // Validate file
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    if (!validTypes.includes(file.type)) {
        throw new Error(`Invalid ${type} file type. Use PNG, JPG, or WebP.`);
    }
    
    if (file.size > maxSize) {
        throw new Error(`${type} file must be less than 5MB.`);
    }
    
    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const filePath = `${fileName}`;
    
    console.log(`Uploading to ${bucket}: ${filePath}`);
    
    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);
    
    if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);
    
    console.log(`✅ Image uploaded successfully: ${urlData.publicUrl}`);
    return urlData.publicUrl;
}

async function uploadGameFile(file, supabase) {
    console.log('📁 Uploading game file:', file.name, file.size);
    
    const maxSize = 100 * 1024 * 1024; // 100MB
    
    if (file.size > maxSize) {
        throw new Error('Game file must be less than 100MB.');
    }
    
    const fileExt = file.name.split('.').pop();
    const fileName = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const filePath = `game_files/${fileName}`;
    
    console.log(`Uploading game file: ${filePath}`);
    
    const { error: uploadError } = await supabase.storage
        .from('game_files')
        .upload(filePath, file);
    
    if (uploadError) {
        console.error('Game file upload error:', uploadError);
        throw uploadError;
    }
    
    const { data: urlData } = supabase.storage
        .from('game_files')
        .getPublicUrl(filePath);
    
    console.log(`✅ Game file uploaded: ${urlData.publicUrl}`);
    return urlData.publicUrl;
}

function showSubmissionSuccess(title, multiplayerType, connectionMethod, playersMin, playersMax, serversAvailable, submissionId) {
    const playerCount = playersMin === playersMax 
        ? `${playersMin} player${playersMin > 1 ? 's' : ''}` 
        : `${playersMin}-${playersMax} players`;
    
    const successHTML = `
        <div class="bg-green-900 border border-green-700 rounded-lg p-8 text-center">
            <div class="text-5xl mb-4">🎮✅</div>
            <h3 class="text-2xl font-bold text-green-300 mb-2">Game Submitted Successfully!</h3>
            <p class="text-green-200 mb-6">"${title}" has been submitted for admin review.</p>
            
            <div class="bg-gray-800 p-6 rounded-lg mb-6 text-left max-w-2xl mx-auto">
                <h4 class="font-bold text-cyan-300 mb-3 text-lg">📋 Submission Details:</h4>
                <div class="grid md:grid-cols-2 gap-4">
                    <div>
                        <p class="text-gray-300"><strong>🎮 Type:</strong> ${multiplayerType}</p>
                        <p class="text-gray-300"><strong>👥 Players:</strong> ${playerCount}</p>
                        <p class="text-gray-300"><strong>🆔 Submission ID:</strong> ${submissionId.substring(0, 8)}...</p>
                    </div>
                    <div>
                        <p class="text-gray-300"><strong>🌐 Connection:</strong> ${connectionMethod}</p>
                        ${serversAvailable ? 
                            '<p class="text-green-400">🟢 Active servers reported</p>' : 
                            '<p class="text-yellow-400">🟡 No server info</p>'
                        }
                    </div>
                </div>
                <div class="mt-4 pt-4 border-t border-gray-700">
                    <p class="text-gray-300"><strong>📸 Images:</strong> Cover art uploaded</p>
                    <p class="text-gray-400 text-sm mt-1">Your game will be visible once approved by admin.</p>
                </div>
            </div>
            
            <p class="text-gray-300 mb-6 max-w-2xl mx-auto">
                Your game is now in the approval queue. You'll be notified when it's approved and appears in the game library.
            </p>
            
            <div class="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-6">
                <button onclick="window.location.hash = '#/games'" 
                        class="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-semibold">
                    Back to Games
                </button>
                <button onclick="window.location.hash = '#/home'" 
                        class="bg-gray-700 hover:bg-gray-600 text-white px-8 py-3 rounded-lg font-semibold">
                    Go Home
                </button>
                <button onclick="window.location.reload()" 
                        class="bg-cyan-600 hover:bg-cyan-700 text-white px-8 py-3 rounded-lg font-semibold">
                    Submit Another
                </button>
            </div>
        </div>
    `;
    
    // Replace the form with success message
    const formContainer = document.querySelector('.bg-gray-800.p-8');
    if (formContainer) {
        formContainer.innerHTML = successHTML;
    } else {
        // If form container not found, show alert and redirect
        alert(`Game "${title}" submitted successfully! Submission ID: ${submissionId}`);
        window.location.hash = '#/games';
    }
}

async function loadGames(supabase) {
    const gamesContainer = document.getElementById('games-list');
    if (!gamesContainer) {
        console.error('Games container not found');
        return;
    }
    
    console.log('🔄 Loading games...');
    gamesContainer.innerHTML = `
        <div class="text-center py-12">
            <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
            <p class="text-gray-400 mt-4">Loading game library...</p>
        </div>
    `;
    
    try {
        console.log('📡 Querying games from Supabase...');
        const { data: games, error, count } = await supabase
            .from('games')
            .select('*', { count: 'exact' })
            .order('title', { ascending: true });
        
        if (error) {
            console.error('Database error:', error);
            throw error;
        }
        
        console.log(`✅ Found ${games?.length || 0} games`);
        
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
        console.log('📧 Mapping user emails from submitted_email field...');
        const userEmailMap = {};
        games.forEach(game => {
            if (game.submitted_by && game.submitted_email) {
                userEmailMap[game.submitted_by] = game.submitted_email;
            }
        });
        console.log('User email map created:', userEmailMap);
        
        console.log('🎨 Rendering game cards...');
        gamesContainer.innerHTML = games.map(game => {
            const playerCount = game.players_min === game.players_max 
                ? `${game.players_min} player${game.players_min > 1 ? 's' : ''}` 
                : `${game.players_min}-${game.players_max} players`;
            
            const coverImage = game.cover_image_url || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&h=600&fit=crop';
            const screenshots = game.screenshot_urls || [];
            
            return `
                <div class="bg-gray-800 p-6 rounded-lg mb-6 border border-gray-700 hover:border-cyan-500 transition group">
                    <div class="flex flex-col md:flex-row gap-6">
                        <!-- Cover Image -->
                        <div class="md:w-1/4">
                            <img src="${coverImage}" 
                                 alt="${game.title} cover"
                                 class="w-full h-48 md:h-64 object-cover rounded-lg cursor-pointer"
                                 onclick="window.location.hash = '#/game/${game.id}'">
                        </div>
                        
                        <!-- Game Info -->
                        <div class="md:w-3/4">
                            <div class="flex flex-col md:flex-row justify-between items-start mb-4">
                                <div class="flex-1">
                                    <h3 class="text-2xl font-bold text-white mb-2 group-hover:text-cyan-300 transition cursor-pointer" 
                                        onclick="window.location.hash = '#/game/${game.id}'">
                                        ${game.title}
                                    </h3>
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
                            
                            <p class="text-gray-300 mb-4 line-clamp-2">${game.description}</p>
                            
                            <!-- Screenshot Previews -->
                            ${screenshots.length > 0 ? `
                                <div class="flex space-x-2 mb-4 overflow-x-auto pb-2">
                                    ${screenshots.slice(0, 3).map((url, index) => `
                                        <img src="${url}" 
                                             alt="Screenshot ${index + 1}"
                                             class="w-24 h-16 object-cover rounded cursor-pointer"
                                             onclick="window.openLightbox && window.openLightbox('${url}')">
                                    `).join('')}
                                    ${screenshots.length > 3 ? `<span class="text-gray-400 text-sm self-center">+${screenshots.length - 3} more</span>` : ''}
                                </div>
                            ` : ''}
                            
                            <div class="flex flex-col md:flex-row justify-between items-center">
                                <div class="text-gray-400 text-sm mb-4 md:mb-0">
                                    Submitted by: ${userEmailMap[game.submitted_by] || game.submitted_email || 'Unknown'}
                                    ${game.views_count ? ` • Views: ${game.views_count}` : ''}
                                </div>
                                
                                <div class="flex space-x-3">
                                    ${game.file_url ? `
                                        <a href="${game.file_url}" target="_blank" 
                                           class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded inline-flex items-center transition">
                                            <span class="mr-2">⬇️</span>
                                            Download
                                        </a>
                                    ` : `
                                        <button class="bg-gray-700 text-gray-400 px-4 py-2 rounded cursor-not-allowed">
                                            No File
                                        </button>
                                    `}
                                    
                                    <button onclick="window.location.hash = '#/game/${game.id}'" 
                                            class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded inline-flex items-center transition">
                                        <span class="mr-2">🔍</span>
                                        View Details
                                    </button>
                                    
                                    <button onclick="showConnectionModal('${game.id}', window.rom?.supabase || window.supabase)" 
                                            class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded inline-flex items-center transition">
                                        <span class="mr-2">🌐</span>
                                        Connection
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        console.log('✅ Games loaded successfully');
        
    } catch (error) {
        console.error('❌ Error loading games:', error);
        gamesContainer.innerHTML = `
            <div class="bg-red-900 border border-red-700 rounded-lg p-6 text-center">
                <h3 class="text-lg font-bold text-red-300 mb-2">Error Loading Games</h3>
                <p class="text-red-200 mb-2">${error.message}</p>
                <p class="text-gray-300 text-sm mb-4">This might be a database connection issue.</p>
                <button onclick="loadGames(window.rom?.supabase || window.supabase)" 
                        class="mt-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">
                    Try Again
                </button>
                <button onclick="window.location.reload()" 
                        class="mt-2 ml-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded">
                    Reload Page
                </button>
            </div>
        `;
    }
}

function showError(message) {
    const gamesContainer = document.getElementById('games-list');
    if (gamesContainer) {
        gamesContainer.innerHTML = `
            <div class="bg-red-900/30 border border-red-500 rounded-lg p-6 text-center">
                <h3 class="text-lg font-bold text-red-300 mb-2">Error</h3>
                <p class="text-gray-300">${message}</p>
                <button onclick="window.location.reload()" 
                        class="mt-4 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded">
                    Refresh Page
                </button>
            </div>
        `;
    }
}

// Connection details modal - UPDATED to accept supabase parameter
window.showConnectionModal = async function(gameId, supabase) {
    try {
        if (!supabase) {
            supabase = window.rom?.supabase || window.supabase;
        }
        
        if (!supabase) {
            throw new Error('Database connection not available');
        }
        
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
window.loadGames = function() {
    const supabase = window.rom?.supabase || window.supabase;
    if (supabase) {
        loadGames(supabase);
    } else {
        console.error('Cannot load games: No Supabase client');
    }
};
