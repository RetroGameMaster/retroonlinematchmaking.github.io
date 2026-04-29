// modules/lfg/lfg.js

export default async function initLFG(rom) {
    console.log('📅 Initializing LFG Module...');
    
    const content = document.getElementById('app-content');
    if (!content) return;

    // 1. Render the HTML Layout
    content.innerHTML = `
        <div class="max-w-6xl mx-auto p-4">
            <div class="flex justify-between items-center mb-8">
                <h1 class="text-3xl font-bold text-cyan-400">📅 Looking For Group</h1>
                ${!rom.currentUser ? 
                    '<button onclick="window.location.hash=\'#/auth\'" class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded font-bold">Log In to Post</button>' : 
                    '<button onclick="openPostModal()" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-bold flex items-center gap-2"><span>➕</span> Post LFG</button>'
                }
            </div>

            <!-- Filters -->
            <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-6 flex flex-wrap gap-4 items-end">
                <div class="flex-1 min-w-[200px]">
                    <label class="block text-gray-400 text-xs mb-1">Game</label>
                    <input type="text" id="lfg-filter-game" placeholder="Filter by game..." class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm">
                </div>
                <div class="flex-1 min-w-[150px]">
                    <label class="block text-gray-400 text-xs mb-1">Platform</label>
                    <select id="lfg-filter-platform" class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm">
                        <option value="">All Platforms</option>
                        <option value="PC">PC</option>
                        <option value="PlayStation">PlayStation</option>
                        <option value="Xbox">Xbox</option>
                        <option value="Nintendo">Nintendo</option>
                        <option value="Dreamcast">Dreamcast</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <button onclick="renderLFGList()" class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded text-sm font-bold">Apply Filters</button>
            </div>

            <!-- List -->
            <div id="lfg-list" class="space-y-4">
                <div class="text-center py-12 text-gray-400">Loading posts...</div>
            </div>
        </div>

        <!-- Modal -->
        <div id="lfg-modal" class="hidden fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-75">
            <div class="flex items-center justify-center min-h-screen px-4">
                <div class="bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg p-6 border border-gray-700 relative">
                    <button onclick="closePostModal()" class="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">&times;</button>
                    <h2 class="text-2xl font-bold text-white mb-4">📅 Create LFG Post</h2>
                    
                    <form id="lfg-form" class="space-y-4">
                        <div>
                            <label class="block text-gray-300 text-sm mb-1">Game Title *</label>
                            <input type="text" id="post-game" required class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white">
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-gray-300 text-sm mb-1">Platform *</label>
                                <select id="post-platform" required class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white">
                                    <option value="">Select...</option>
                                    <option value="PC">PC (Dolphin/Poké64/etc)</option>
                                    <option value="PlayStation">PlayStation</option>
                                    <option value="Xbox">Xbox</option>
                                    <option value="Nintendo">Nintendo</option>
                                    <option value="Dreamcast">Dreamcast</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-gray-300 text-sm mb-1">Region</label>
                                <select id="post-region" class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white">
                                    <option value="NA">North America</option>
                                    <option value="EU">Europe</option>
                                    <option value="SA">South America</option>
                                    <option value="ASIA">Asia</option>
                                    <option value="OCE">Oceania</option>
                                    <option value="Global">Global</option>
                                </select>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-gray-300 text-sm mb-1">Scheduled Time *</label>
                                <input type="datetime-local" id="post-time" required class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white">
                            </div>
                            <div>
                                <label class="block text-gray-300 text-sm mb-1">Time Zone *</label>
                                <select id="post-timezone" required class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white">
                                    <option value="UTC">UTC</option>
                                    <option value="America/New_York">Eastern (ET)</option>
                                    <option value="America/Chicago">Central (CT)</option>
                                    <option value="America/Denver">Mountain (MT)</option>
                                    <option value="America/Los_Angeles">Pacific (PT)</option>
                                    <option value="Europe/London">London (GMT)</option>
                                    <option value="Europe/Paris">Paris (CET)</option>
                                    <option value="Asia/Tokyo">Tokyo (JST)</option>
                                    <option value="Australia/Sydney">Sydney (AEST)</option>
                                </select>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-gray-300 text-sm mb-1">Description / Rules</label>
                            <textarea id="post-desc" rows="3" placeholder="e.g. Must have mic, ranked matches only..." class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"></textarea>
                        </div>

                        <div class="pt-4 flex justify-end gap-3">
                            <button type="button" onclick="closePostModal()" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded">Cancel</button>
                            <button type="submit" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold">Post Request</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    // 2. Attach Event Listeners
    if (rom.currentUser) {
        const form = document.getElementById('lfg-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await handlePostLFG(rom);
            });
        }
    }

    // 3. Initial Load
    await renderLFGList(rom);
}

// --- Global Functions for HTML onclick handlers ---

window.openPostModal = function() {
    const modal = document.getElementById('lfg-modal');
    if (modal) modal.classList.remove('hidden');
};

window.closePostModal = function() {
    const modal = document.getElementById('lfg-modal');
    if (modal) modal.classList.add('hidden');
    // Reset form
    const form = document.getElementById('lfg-form');
    if (form) form.reset();
};

window.handlePostLFG = async function(rom) {
    const game = document.getElementById('post-game').value.trim();
    const platform = document.getElementById('post-platform').value;
    const region = document.getElementById('post-region').value;
    const scheduledTime = document.getElementById('post-time').value;
    const timezone = document.getElementById('post-timezone').value;
    const description = document.getElementById('post-desc').value.trim();

    if (!game || !platform || !scheduledTime || !timezone) {
        alert('Please fill in all required fields (Game, Platform, Time, Timezone).');
        return;
    }

    const btn = document.querySelector('#lfg-form button[type="submit"]');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Posting...';

    try {
        const { error } = await rom.supabase.from('lfg_posts').insert([{
            user_id: rom.currentUser.id,
            username: rom.currentUser.email.split('@')[0], // Fallback username
            game_title: game,
            platform: platform,
            region: region,
            scheduled_time: new Date(scheduledTime).toISOString(),
            timezone: timezone,
            description: description,
            status: 'open',
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h expiry
        }]);

        if (error) throw error;

        alert('✅ LFG Post created! Users can now accept your request.');
        window.closePostModal();
        await renderLFGList(rom);

    } catch (err) {
        console.error('Error posting LFG:', err);
        alert('❌ Error: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
};

window.acceptLFG = async function(postId, hostId, rom) {
    if (!rom.currentUser) {
        alert('You must be logged in to accept an LFG request.');
        return;
    }
    if (hostId === rom.currentUser.id) {
        alert('You cannot accept your own post.');
        return;
    }

    if (!confirm('Accept this match request? The host will be notified via alerts.')) return;

    try {
        // 1. Update Post Status
        const { error: updateError } = await rom.supabase
            .from('lfg_posts')
            .update({ 
                status: 'full', 
                accepted_by: rom.currentUser.id,
                accepted_username: rom.currentUser.email.split('@')[0]
            })
            .eq('id', postId);

        if (updateError) throw updateError;

        // 2. Create Alert Notification for Host
        const { error: alertError } = await rom.supabase.from('alerts').insert([{
            user_id: hostId,
            type: 'lfg_accepted',
            title: 'LFG Request Accepted!',
            message: `Your LFG post has been accepted by ${rom.currentUser.email.split('@')[0]}. Check your matches!`,
            link: '#/lfg',
            is_read: false
        }]);

        if (alertError) throw alertError;

        alert('✅ You joined the match! The host has been notified.');
        await renderLFGList(rom);

    } catch (err) {
        console.error('Error accepting LFG:', err);
        alert('❌ Error: ' + err.message);
    }
};

// --- Helper Functions ---

async function renderLFGList(rom) {
    const container = document.getElementById('lfg-list');
    if (!container) return;

    container.innerHTML = `<div class="text-center py-8 text-gray-400">Loading...</div>`;

    try {
        let query = rom.supabase
            .from('lfg_posts')
            .select('*')
            .eq('status', 'open')
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });

        const gameFilter = document.getElementById('lfg-filter-game')?.value.toLowerCase();
        const platformFilter = document.getElementById('lfg-filter-platform')?.value;

        if (gameFilter) {
            // Note: Supabase ILIKE requires specific syntax, doing client-side filter for simplicity here
            // Or use .ilike() if supported in your version
        }
        
        const { data, error } = await query;

        if (error) throw error;

        // Client-side filtering
        let filtered = data || [];
        if (gameFilter) {
            filtered = filtered.filter(p => p.game_title.toLowerCase().includes(gameFilter));
        }
        if (platformFilter) {
            filtered = filtered.filter(p => p.platform === platformFilter);
        }

        if (filtered.length === 0) {
            container.innerHTML = `<div class="text-center py-8 text-gray-400">No active LFG posts found. Be the first to post!</div>`;
            return;
        }

        container.innerHTML = filtered.map(post => {
            const dateObj = new Date(post.scheduled_time);
            const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            
            // Avatar Logic (Using UI Avatars for demo, replace with profile fetch if needed)
            const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(post.username)}&background=06b6d4&color=fff`;

            return `
                <div class="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-cyan-500 transition shadow-lg">
                    <div class="flex justify-between items-start">
                        <div class="flex items-start gap-4">
                            <img src="${avatarUrl}" alt="${post.username}" class="w-12 h-12 rounded-full border-2 border-cyan-500">
                            <div>
                                <h3 class="text-xl font-bold text-white">${escapeHtml(post.game_title)}</h3>
                                <div class="flex gap-2 mt-1 text-sm text-gray-300">
                                    <span class="bg-gray-700 px-2 py-0.5 rounded">${post.platform}</span>
                                    <span class="bg-gray-700 px-2 py-0.5 rounded">${post.region}</span>
                                </div>
                                <div class="mt-2 text-sm text-cyan-300 font-bold flex items-center gap-2">
                                    <span>🕒</span> ${dateStr} at ${timeStr} (${post.timezone})
                                </div>
                                ${post.description ? `<p class="mt-2 text-gray-400 text-sm">${escapeHtml(post.description)}</p>` : ''}
                                <div class="mt-2 text-xs text-gray-500">Posted by ${escapeHtml(post.username)}</div>
                            </div>
                        </div>
                        
                        ${rom.currentUser && rom.currentUser.id !== post.user_id ? `
                            <button onclick="acceptLFG('${post.id}', '${post.user_id}', window.rom)" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-bold text-sm whitespace-nowrap">
                                Accept Match
                            </button>
                        ` : `
                            <span class="text-gray-500 text-sm italic">${rom.currentUser?.id === post.user_id ? 'Your Post' : 'Log in to join'}</span>
                        `}
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Error loading LFG:', err);
        container.innerHTML = `<div class="text-center py-8 text-red-400">Error: ${err.message}</div>`;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
