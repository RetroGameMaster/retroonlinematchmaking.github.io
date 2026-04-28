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
    // Removed gameSelect as we don't link directly in this simple view anymore
    // If you still have a dropdown in your HTML for games, keep the element but don't use it for insertion logic below

    // Check Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (user && createBtn) createBtn.classList.remove('hidden');

    // Initial Load
    loadGuides();

    // Listeners
    if (searchInput) searchInput.addEventListener('input', loadGuides);
    if (diffFilter) diffFilter.addEventListener('change', loadGuides);
    if (createBtn) createBtn.addEventListener('click', () => {
        if (!user) return alert('Please log in to create a guide');
        modal.classList.remove('hidden');
    });
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await submitGuide(user);
        });
    }

    async function loadGuides() {
        if (!grid) return;
        grid.innerHTML = '<div class="col-span-full text-center py-12 text-cyan-400">Loading guides...</div>';

        // FIX: Removed the join with 'games' because guides table has no game_id column.
        // We only fetch from 'guides' and 'profiles'.
        let query = supabase
            .from('guides')
            .select(`
                *,
                author:profiles(username, avatar_url)
            `)
            .eq('is_approved', true)
            .order('created_at', { ascending: false });

        const search = searchInput?.value.toLowerCase();
        const diff = diffFilter?.value;

        if (diff) query = query.eq('difficulty', diff);
        
        const { data, error } = await query;

        if (error) {
            console.error('Error loading guides:', error);
            grid.innerHTML = '<div class="text-red-400 text-center py-12">Error loading guides: ' + error.message + '</div>';
            return;
        }

        // Client-side search filter
        let filtered = data || [];
        if (search) {
            filtered = filtered.filter(g => 
                g.title.toLowerCase().includes(search) || 
                (g.content_html && g.content_html.toLowerCase().includes(search))
            );
        }

        if (filtered.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-12">No guides found yet.</div>';
            return;
        }

        grid.innerHTML = filtered.map(guide => `
            <div class="bg-gray-800/80 border border-purple-500/30 rounded-xl p-5 hover:border-purple-400 transition cursor-pointer group" onclick="window.location.hash='#/guide/${guide.slug || guide.id}'">
                <div class="flex justify-between items-start mb-3">
                    <span class="text-xs font-bold px-2 py-1 rounded ${getDiffColor(guide.difficulty)}">${guide.difficulty}</span>
                    <span class="text-xs text-gray-500">${new Date(guide.created_at).toLocaleDateString()}</span>
                </div>
                <h3 class="text-xl font-bold text-white mb-2 line-clamp-2 group-hover:text-cyan-400 transition">${escapeHtml(guide.title)}</h3>
                
                <!-- Since guides are universal, we don't show "For: Game Title" unless you implement a complex join later -->
                <p class="text-sm text-gray-400 mb-4 line-clamp-2">${guide.content_html ? guide.content_html.replace(/<[^>]*>?/gm, '').substring(0, 100) + '...' : 'No description'}</p>
                
                <div class="flex items-center gap-2 text-xs text-gray-400 border-t border-gray-700 pt-3">
                    <div class="flex items-center gap-2">
                        ${guide.author?.avatar_url ? `<img src="${guide.author.avatar_url}" class="w-5 h-5 rounded-full">` : '<div class="w-5 h-5 rounded-full bg-gray-600"></div>'}
                        <span>By ${guide.author?.username || 'Anonymous'}</span>
                    </div>
                    ${guide.video_url ? '<span class="text-red-400 ml-auto">📺 Video Included</span>' : ''}
                </div>
            </div>
        `).join('');
    }

    async function submitGuide(user) {
        if (!user) return alert('Must be logged in');
        
        const title = document.getElementById('g-title').value;
        // Removed gameId requirement since guides are universal now
        const diff = document.getElementById('g-diff').value;
        const video = document.getElementById('g-video').value;
        const content = document.getElementById('g-content').value;

        if (!title || !content) return alert('Title and Content are required');

        // Simple slug generator with timestamp to ensure uniqueness
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();

        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Submitting...';

        try {
            const { error } = await supabase.from('guides').insert({
                // game_id: gameId, // REMOVED: No such column in guides table
                author_id: user.id,
                title,
                slug,
                difficulty: diff,
                video_url: video || null,
                content_html: content,
                is_approved: false // Requires admin approval
            });

            if (error) throw error;

            alert('Guide submitted! It will appear after admin approval.');
            modal.classList.add('hidden');
            form.reset();
            loadGuides();
        } catch (err) {
            alert('Error submitting guide: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

    function getDiffColor(diff) {
        if (diff === 'Easy') return 'bg-green-900 text-green-300';
        if (diff === 'Hard') return 'bg-red-900 text-red-300';
        if (diff === 'Expert') return 'bg-red-900 text-red-300';
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
        console.log("Loading guide:", identifier);
        // Implementation for single guide view would go here
    };
}
