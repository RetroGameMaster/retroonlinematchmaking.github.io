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

    // 1. Check Auth & Admin Status
    const { data: { user } } = await supabase.auth.getUser();
    let isAdmin = false;

    if (user) {
        // Check if user is admin via profiles table
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .single();
        
        isAdmin = profile?.is_admin === true;
    }

    // Hide Create button if NOT admin
    if (createBtn) {
        if (isAdmin) {
            createBtn.classList.remove('hidden');
        } else {
            createBtn.classList.add('hidden');
        }
    }

    // Initial Load
    loadGuides();

    // Listeners
    if (searchInput) searchInput.addEventListener('input', loadGuides);
    if (diffFilter) diffFilter.addEventListener('change', loadGuides);
    
    if (createBtn) {
        createBtn.addEventListener('click', () => {
            if (!isAdmin) return alert('Admin access required');
            modal.classList.remove('hidden');
        });
    }
    
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!isAdmin) return alert('Admin access required');
            await submitGuide(user);
        });
    }

    // 2. Fixed Load Function (No Joins to avoid cache errors)
    async function loadGuides() {
        if (!grid) return;
        grid.innerHTML = '<div class="col-span-full text-center py-12">Loading...</div>';

        // Fetch Guides Only
        let query = supabase
            .from('guides')
            .select('*')
            .eq('is_approved', true)
            .order('created_at', { ascending: false });

        const diff = diffFilter?.value;
        if (diff) query = query.eq('difficulty', diff);
        
        const { data: guides, error } = await query;

        if (error) {
            console.error('Guide fetch error:', error);
            grid.innerHTML = '<div class="text-red-400">Error loading guides.</div>';
            return;
        }

        // If no guides
        if (!guides || guides.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-12">No approved guides found yet.</div>';
            return;
        }

        // Fetch Authors separately to avoid Join errors
        const authorIds = [...new Set(guides.map(g => g.author_id).filter(Boolean))];
        let authorsMap = {};
        
        if (authorIds.length > 0) {
            const { data: authors } = await supabase
                .from('profiles')
                .select('id, username, avatar_url')
                .in('id', authorIds);
            
            if (authors) {
                authorsMap = Object.fromEntries(authors.map(a => [a.id, a]));
            }
        }

        // Client-side search filter
        const search = searchInput?.value.toLowerCase();
        let filtered = guides;
        if (search) {
            filtered = guides.filter(g => g.title.toLowerCase().includes(search));
        }

        if (!filtered || filtered.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-12">No guides match your search.</div>';
            return;
        }

        // Render
        grid.innerHTML = filtered.map(guide => {
            const author = authorsMap[guide.author_id] || { username: 'Anonymous', avatar_url: null };
            const link = guide.slug ? `#/guide/${guide.slug}` : `#/guide/${guide.id}`;
            
            return `
            <div class="bg-gray-800/80 border border-purple-500/30 rounded-xl p-5 hover:border-purple-400 transition cursor-pointer" onclick="window.location.hash='${link}'">
                <div class="flex justify-between items-start mb-3">
                    <span class="text-xs font-bold px-2 py-1 rounded ${getDiffColor(guide.difficulty)}">${guide.difficulty}</span>
                    <span class="text-xs text-gray-500">${new Date(guide.created_at).toLocaleDateString()}</span>
                </div>
                <h3 class="text-xl font-bold text-white mb-2 line-clamp-2">${escapeHtml(guide.title)}</h3>
                <div class="flex items-center gap-2 text-xs text-gray-400 mt-4">
                    <img src="${author.avatar_url || `https://ui-avatars.com/api/?name=${author.username}&background=8b5cf6&color=fff`}" 
                         class="w-6 h-6 rounded-full">
                    <span>By ${author.username || 'Anonymous'}</span>
                    ${guide.video_url ? '<span class="text-red-400 ml-auto">📺 Video Included</span>' : ''}
                </div>
            </div>
        `}).join('');
    }

    async function submitGuide(user) {
        if (!user || !isAdmin) return alert('Admin access required');
        
        const title = document.getElementById('g-title').value;
        const diff = document.getElementById('g-diff').value;
        const video = document.getElementById('g-video').value;
        const content = document.getElementById('g-content').value;

        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();

        const { error } = await supabase.from('guides').insert({
            author_id: user.id,
            title,
            slug,
            difficulty: diff,
            video_url: video,
            content_html: content,
            is_approved: true // Auto-approve for admins
        });

        if (error) {
            alert('Error: ' + error.message);
        } else {
            alert('Guide created successfully!');
            modal.classList.add('hidden');
            form.reset();
            loadGuides();
        }
    }

    function getDiffColor(diff) {
        if (diff === 'Easy') return 'bg-green-900 text-green-300';
        if (diff === 'Hard') return 'bg-red-900 text-red-300';
        if (diff === 'Expert') return 'bg-purple-900 text-purple-300';
        return 'bg-yellow-900 text-yellow-300';
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
