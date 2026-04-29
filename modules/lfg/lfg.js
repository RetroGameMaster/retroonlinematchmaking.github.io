// modules/lfg/lfg.js

export default async function initLFG(rom) {
    const container = document.getElementById('lfg-container');
    if (!container) return;

    // Check Auth
    if (!rom.currentUser) {
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="text-6xl mb-4">🔒</div>
                <h2 class="text-2xl font-bold text-white mb-4">Login Required</h2>
                <p class="text-gray-400 mb-6">You must be logged in to view or create LFG posts.</p>
                <button onclick="window.location.hash='#/auth'" class="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-lg font-bold">Log In</button>
            </div>
        `;
        return;
    }

    // Render Layout
    container.innerHTML = `
        <div class="flex flex-col lg:flex-row gap-6">
            <!-- Create Post Section -->
            <div class="lg:w-1/3">
                <div class="bg-gray-800 rounded-xl border border-cyan-500/30 p-6 sticky top-4 shadow-xl">
                    <h2 class="text-2xl font-bold text-cyan-400 mb-4 flex items-center gap-2">
                        <span>📢</span> Create LFG Post
                    </h2>
                    <form id="create-lfg-form" class="space-y-4">
                        <div>
                            <label class="block text-sm text-gray-300 mb-1">Game Title *</label>
                            <input type="text" id="lfg-game" required class="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:border-cyan-500 outline-none" placeholder="e.g. Mario Kart 64">
                        </div>
                        
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-sm text-gray-300 mb-1">Platform *</label>
                                <select id="lfg-platform" required class="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none">
                                    <option value="N64">N64</option>
                                    <option value="PS1">PS1</option>
                                    <option value="Dreamcast">Dreamcast</option>
                                    <option value="GC">GameCube</option>
                                    <option value="PS2">PS2</option>
                                    <option value="Xbox">Xbox</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm text-gray-300 mb-1">Region</label>
                                <select id="lfg-region" class="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none">
                                    <option value="NA">North America</option>
                                    <option value="EU">Europe</option>
                                    <option value="ASIA">Asia</option>
                                    <option value="SA">South America</option>
                                    <option value="OCE">Oceania</option>
                                    <option value="Global">Global</option>
                                </select>
                            </div>
                        </div>

                        <!-- NEW: Time & Timezone -->
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-sm text-gray-300 mb-1">Time *</label>
                                <input type="time" id="lfg-time" required class="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none">
                            </div>
                            <div>
                                <label class="block text-sm text-gray-300 mb-1">Timezone *</label>
                                <select id="lfg-timezone" required class="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none">
                                    <option value="EST">EST (US East)</option>
                                    <option value="PST">PST (US West)</option>
                                    <option value="CST">CST (US Central)</option>
                                    <option value="MST">MST (US Mountain)</option>
                                    <option value="GMT">GMT (UK)</option>
                                    <option value="CET">CET (Europe)</option>
                                    <option value="JST">JST (Japan)</option>
                                    <option value="AEST">AEST (Australia)</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm text-gray-300 mb-1">Notes</label>
                            <textarea id="lfg-notes" rows="2" class="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none" placeholder="Rules, rank requirements, etc."></textarea>
                        </div>

                        <button type="submit" id="post-lfg-btn" class="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 rounded transition flex justify-center items-center gap-2">
                            <span>🚀</span> Post LFG
                        </button>
                    </form>
                </div>
            </div>

            <!-- Feed Section -->
            <div class="lg:w-2/3">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-2xl font-bold text-white">📅 Active Posts</h2>
                    <button onclick="loadLFGPosts()" class="text-sm text-cyan-400 hover:text-cyan-300 underline">Refresh</button>
                </div>
                <div id="lfg-feed" class="space-y-4">
                    <div class="text-center py-8 text-gray-400">Loading posts...</div>
                </div>
            </div>
        </div>
    `;

    // Attach Event Listener
    document.getElementById('create-lfg-form').addEventListener('submit', handleCreatePost);
    
    // Initial Load
    loadLFGPosts();
}

// Handle Form Submission
async function handleCreatePost(e) {
    e.preventDefault();
    const btn = document.getElementById('post-lfg-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Posting...';

    try {
        const user = window.rom.currentUser;
        const game = document.getElementById('lfg-game').value.trim();
        const platform = document.getElementById('lfg-platform').value;
        const region = document.getElementById('lfg-region').value;
        const time = document.getElementById('lfg-time').value;
        const timezone = document.getElementById('lfg-timezone').value;
        const notes = document.getElementById('lfg-notes').value.trim();

        if (!user) throw new Error('User not logged in');

        const { error } = await window.supabase.from('lfg_posts').insert([{
            user_id: user.id,
            game_title: game,
            platform,
            region,
            scheduled_time: time,
            timezone,
            notes,
            status: 'open',
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        }]);

        if (error) throw error;

        // Reset form and reload
        document.getElementById('create-lfg-form').reset();
        showNotification('✅ LFG Post created!');
        loadLFGPosts();

    } catch (err) {
        console.error(err);
        showNotification('❌ Error: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// Load and Render Posts
async function loadLFGPosts() {
    const feed = document.getElementById('lfg-feed');
    if (!feed) return;

    try {
        // Fetch posts + user profiles
        const { data: posts, error } = await window.supabase
            .from('lfg_posts')
            .select(`
                *,
                profiles:user_id (username, avatar_url)
            `)
            .eq('status', 'open')
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!posts || posts.length === 0) {
            feed.innerHTML = `<div class="text-center py-8 text-gray-400 bg-gray-800/50 rounded-lg">No active posts. Be the first to host!</div>`;
            return;
        }

        feed.innerHTML = posts.map(post => {
            const profile = post.profiles;
            const avatar = profile?.avatar_url || 'https://via.placeholder.com/40/1f2937/6b7280?text=?';
            const username = profile?.username || 'Unknown';
            
            return `
                <div class="bg-gray-800 rounded-lg border border-gray-700 p-4 hover:border-cyan-500/50 transition shadow-lg">
                    <div class="flex justify-between items-start mb-3">
                        <div class="flex items-center gap-3">
                            <img src="${avatar}" alt="${username}" class="w-10 h-10 rounded-full border border-gray-600 object-cover">
                            <div>
                                <h3 class="font-bold text-white text-lg">${escapeHtml(post.game_title)}</h3>
                                <div class="flex gap-2 text-xs text-gray-400">
                                    <span class="bg-gray-700 px-2 py-0.5 rounded">${post.platform}</span>
                                    <span class="bg-gray-700 px-2 py-0.5 rounded">${post.region}</span>
                                </div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-cyan-400 font-bold text-sm">🕒 ${post.scheduled_time} ${post.timezone}</div>
                            <div class="text-xs text-gray-500">Posted by <span class="text-gray-300">${escapeHtml(username)}</span></div>
                        </div>
                    </div>
                    
                    ${post.notes ? `<p class="text-gray-300 text-sm mb-4 bg-gray-900/50 p-2 rounded">${escapeHtml(post.notes)}</p>` : ''}

                    <div class="flex justify-between items-center border-t border-gray-700 pt-3">
                        <div class="text-xs text-gray-500">
                            Expires in ${Math.floor((new Date(post.expires_at) - new Date()) / 3600000)}h
                        </div>
                        <button onclick="acceptLFG('${post.id}', '${post.user_id}')" class="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-sm font-bold transition flex items-center gap-1">
                            <span>✓</span> Join Match
                        </button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error(err);
        feed.innerHTML = `<div class="text-center py-8 text-red-400">Error loading posts: ${err.message}</div>`;
    }
}

// Handle Accepting a Match
window.acceptLFG = async function(postId, hostId) {
    if (!confirm('Join this match? The host will receive a notification on their profile.')) return;

    try {
        const user = window.rom.currentUser;
        if (!user) throw new Error('Must be logged in');

        // 1. Create Notification for Host
        await window.supabase.from('notifications').insert([{
            user_id: hostId,
            type: 'lfg_accept',
            message: `${user.email} joined your LFG post!`,
            link: `#/lfg`,
            is_read: false
        }]);

        // 2. Optional: Mark post as filled or just leave open
        // For now we just notify. You could update status to 'filled' if you want only 1 person.
        
        showNotification('✅ Request sent! Host has been notified.');
        loadLFGPosts(); // Refresh to show any changes

    } catch (err) {
        console.error(err);
        showNotification('❌ Error: ' + err.message, 'error');
    }
};

// Helper: Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Helper: Notification
function showNotification(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded shadow-lg text-white font-bold ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}
