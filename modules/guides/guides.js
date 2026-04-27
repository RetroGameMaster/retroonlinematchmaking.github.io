import { supabase } from '../../lib/supabase.js';

export default async function initGuidesModule(rom) {
    console.log('📚 Initializing Guides Module...');
    
    const grid = document.getElementById('guides-grid');
    const searchInput = document.getElementById('guide-search');
    const diffFilter = document.getElementById('guide-difficulty');
    const createBtn = document.getElementById('btn-create-guide');
    const modal = document.getElementById('guide-modal');
    const closeBtn = document.getElementById('close-guide-modal');
    const form = document.getElementById('guide-form');
    const gameSelect = document.getElementById('g-game');

    // Check Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (user && createBtn) createBtn.classList.remove('hidden');

    // Load Games for Dropdown
    loadGamesForDropdown();

    // Initial Load
    loadGuides();

    // Listeners
    if (searchInput) searchInput.addEventListener('input', loadGuides);
    if (diffFilter) diffFilter.addEventListener('change', loadGuides);
    if (createBtn) createBtn.addEventListener('click', () => modal.classList.remove('hidden'));
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await submitGuide(user);
        });
    }

    async function loadGamesForDropdown() {
        const { data } = await supabase.from('games').select('id, title, console').order('title');
        if (data && gameSelect) {
            gameSelect.innerHTML = '<option value="">Select Game...</option>' + 
                data.map(g => `<option value="${g.id}">${g.title} (${g.console})</option>`).join('');
        }
    }

    async function loadGuides() {
        if (!grid) return;
        grid.innerHTML = '<div class="col-span-full text-center py-12">Loading...</div>';

        let query = supabase
            .from('guides')
            .select(`
                *,
                game:games(title, cover_image_url, slug),
                author:profiles(username, avatar_url)
            `)
            .eq('is_approved', true)
            .order('created_at', { ascending: false });

        const search = searchInput?.value.toLowerCase();
        const diff = diffFilter?.value;

        if (diff) query = query.eq('difficulty', diff);
        
        // Note: Filtering by search text requires a different approach in Supabase 
        // or filtering client-side for simplicity here.
        
        const { data, error } = await query;

        if (error) {
            grid.innerHTML = '<div class="text-red-400">Error loading guides.</div>';
            return;
        }

        // Client-side search filter
        let filtered = data;
        if (search) {
            filtered = data.filter(g => 
                g.title.toLowerCase().includes(search) || 
                g.game?.title.toLowerCase().includes(search)
            );
        }

        if (!filtered || filtered.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-12">No guides found yet.</div>';
            return;
        }

        grid.innerHTML = filtered.map(guide => `
            <div class="bg-gray-800/80 border border-purple-500/30 rounded-xl p-5 hover:border-purple-400 transition cursor-pointer" onclick="window.location.hash='#/guide/${guide.slug || guide.id}'">
                <div class="flex justify-between items-start mb-3">
                    <span class="text-xs font-bold px-2 py-1 rounded ${getDiffColor(guide.difficulty)}">${guide.difficulty}</span>
                    <span class="text-xs text-gray-500">${new Date(guide.created_at).toLocaleDateString()}</span>
                </div>
                <h3 class="text-xl font-bold text-white mb-2 line-clamp-2">${escapeHtml(guide.title)}</h3>
                <p class="text-sm text-cyan-400 mb-4">For: ${guide.game?.title || 'Unknown Game'}</p>
                <div class="flex items-center gap-2 text-xs text-gray-400">
                    <span>By ${guide.author?.username || 'Anonymous'}</span>
                    ${guide.video_url ? '<span class="text-red-400">📺 Video Included</span>' : ''}
                </div>
            </div>
        `).join('');
    }

    async function submitGuide(user) {
        if (!user) return alert('Must be logged in');
        
        const title = document.getElementById('g-title').value;
        const gameId = document.getElementById('g-game').value;
        const diff = document.getElementById('g-diff').value;
        const video = document.getElementById('g-video').value;
        const content = document.getElementById('g-content').value;

        // Simple slug generator
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        const { error } = await supabase.from('guides').insert({
            game_id: gameId,
            author_id: user.id,
            title,
            slug,
            difficulty: diff,
            video_url: video,
            content_html: content,
            is_approved: false // Requires admin approval
        });

        if (error) {
            alert('Error: ' + error.message);
        } else {
            alert('Guide submitted! It will appear after admin approval.');
            modal.classList.add('hidden');
            form.reset();
            loadGuides();
        }
    }

    function getDiffColor(diff) {
        if (diff === 'Easy') return 'bg-green-900 text-green-300';
        if (diff === 'Hard') return 'bg-red-900 text-red-300';
        return 'bg-yellow-900 text-yellow-300';
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Expose for routing if needed
    window.loadSingleGuide = async (identifier) => {
        // Logic to fetch single guide by slug/ID and render full view
        // We will implement the full view renderer next
        console.log("Loading guide:", identifier);
    };
}
