import { supabase } from '../../lib/supabase.js';

export async function initModule(rom) {
    const grid = document.getElementById('lfg-grid');
    const modal = document.getElementById('lfg-modal');
    const btnNew = document.getElementById('btn-new-lfg');
    const btnClose = document.getElementById('close-lfg-modal');
    const form = document.getElementById('lfg-form');
    const gameInput = document.getElementById('lfg-game');
    const datalist = document.getElementById('game-list');

    // Load Games for Autocomplete
    async function loadGames() {
        const { data } = await supabase.from('games').select('title').order('title');
        if (data) {
            datalist.innerHTML = data.map(g => `<option value="${g.title}">`).join('');
        }
    }
    loadGames();

    // Fetch & Render Posts
    async function fetchPosts() {
        const { data, error } = await supabase
            .from('lfg_posts')
            .select(`*, games(title, console, cover_image_url)`)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });

        if (error) {
            grid.innerHTML = `<div class="text-red-400">Error loading posts</div>`;
            return;
        }

        if (!data || data.length === 0) {
            grid.innerHTML = `<div class="col-span-full text-center py-12 bg-gray-800/50 rounded-lg border border-gray-700">
                <h3 class="text-xl font-bold text-white mb-2">No active requests yet</h3>
                <p class="text-gray-400">Be the first to post an LFG!</p>
            </div>`;
            return;
        }

        grid.innerHTML = data.map(post => {
            const timeLeft = getTimeLeft(post.expires_at);
            const isExpiringSoon = timeLeft.includes('hours') && parseInt(timeLeft) < 4;
            
            return `
            <div class="bg-gray-800 rounded-xl border ${isExpiringSoon ? 'border-yellow-500/50' : 'border-gray-700'} overflow-hidden hover:border-cyan-500 transition group relative">
                <div class="absolute top-2 right-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-xs font-bold ${isExpiringSoon ? 'text-yellow-400' : 'text-cyan-400'}">
                    ⏳ ${timeLeft} left
                </div>
                
                <div class="p-4 flex gap-4">
                    <img src="${post.games?.cover_image_url || 'https://via.placeholder.com/100?text=Game'}" 
                         class="w-20 h-24 object-cover rounded border border-gray-600 shadow-md">
                    <div class="flex-1">
                        <h3 class="font-bold text-white text-lg leading-tight mb-1">${escapeHtml(post.games?.title || 'Unknown Game')}</h3>
                        <div class="flex gap-2 mb-2">
                            <span class="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">${post.games?.console || 'Any'}</span>
                            <span class="text-xs bg-purple-900 text-purple-300 px-2 py-0.5 rounded">${post.region}</span>
                        </div>
                        <p class="text-gray-300 text-sm line-clamp-2 mb-3">${escapeHtml(post.description)}</p>
                        
                        <div class="mt-auto pt-3 border-t border-gray-700 flex justify-between items-center">
                            <span class="text-xs text-gray-500">Posted by ${post.user_id ? 'Member' : 'User'}</span>
                            <a href="#" onclick="copyContact('${escapeHtml(post.contact_info)}'); return false;" 
                               class="text-xs bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded font-bold transition">
                                📋 Copy Contact
                            </a>
                        </div>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }

    // Helpers
    function getTimeLeft(expiresAt) {
        const diff = new Date(expiresAt) - new Date();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    }

    window.copyContact = function(text) {
        navigator.clipboard.writeText(text);
        alert('Contact info copied!');
    };

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Event Listeners
    btnNew.addEventListener('click', () => {
        if (!rom.currentUser) {
            alert('Please log in to post LFG requests.');
            rom.navigateTo('auth');
            return;
        }
        modal.classList.remove('hidden');
    });

    btnClose.addEventListener('click', () => modal.classList.add('hidden'));

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Posting...';

        try {
            // Find Game ID by Title (Simple match)
            const gameTitle = document.getElementById('lfg-game').value;
            const { data: gameData } = await supabase.from('games').select('id').eq('title', gameTitle).single();
            
            if (!gameData) {
                alert('Game not found in library. Please try typing the exact title.');
                throw new Error('Game not found');
            }

            const { error } = await supabase.from('lfg_posts').insert({
                user_id: rom.currentUser.id,
                game_id: gameData.id,
                title: `LFG: ${gameTitle}`,
                description: document.getElementById('lfg-desc').value,
                region: document.getElementById('lfg-region').value,
                platform: document.getElementById('lfg-platform').value,
                contact_info: document.getElementById('lfg-contact').value
            });

            if (error) throw error;

            alert('Request posted!');
            modal.classList.add('hidden');
            form.reset();
            fetchPosts();
        } catch (err) {
            console.error(err);
            alert('Error posting: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });

    // Initial Load
    fetchPosts();
    
    // Refresh every 30s to update timers/expired posts
    const interval = setInterval(fetchPosts, 30000);
    
    // Cleanup on module unload (if your router supports it)
    return () => clearInterval(interval);
}
