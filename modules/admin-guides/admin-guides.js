import { supabase } from '../../lib/supabase.js';

export default async function initAdminGuides(rom) {
    console.log('🛡️ Initializing Admin Guides Manager...');

    // Check Admin Status
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return window.location.hash = '#/auth';

    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) {
        alert('Access Denied: Admins only.');
        return window.location.hash = '#/home';
    }

    const grid = document.getElementById('guides-admin-grid');
    const newBtn = document.getElementById('btn-new-guide');
    const modal = document.getElementById('guide-editor-modal');
    const closeBtn = document.getElementById('close-editor');
    const cancelBtn = document.getElementById('cancel-edit');
    const form = document.getElementById('admin-guide-form');
    const gameSelect = document.getElementById('a-game');
    const tabs = document.querySelectorAll('.tab-btn');

    let currentTab = 'pending';

    // Load Games for Dropdown
    loadGames();

    // Initial Load
    loadGuides();

    // Event Listeners
    if (newBtn) newBtn.addEventListener('click', () => openEditor());
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    if (cancelBtn) cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => {
                t.classList.remove('active', 'border-purple-500', 'text-purple-400');
                t.classList.add('border-transparent', 'text-gray-400');
            });
            e.target.classList.add('active', 'border-purple-500', 'text-purple-400');
            e.target.classList.remove('border-transparent', 'text-gray-400');
            currentTab = e.target.dataset.tab;
            loadGuides();
        });
    });

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveGuide(user.id);
        });
    }

    async function loadGames() {
        const { data } = await supabase.from('games').select('id, title, console').order('title');
        if (data && gameSelect) {
            gameSelect.innerHTML = '<option value="">Select Game...</option>' + 
                data.map(g => `<option value="${g.id}">${g.title} (${g.console})</option>`).join('');
        }
    }

    async function loadGuides() {
        if (!grid) return;
        grid.innerHTML = '<div class="text-center text-gray-500 py-8">Loading...</div>';

        let query = supabase
            .from('guides')
            .select(`
                *,
                game:games(title),
                author:profiles(username)
            `)
            .order('created_at', { ascending: false });

        if (currentTab === 'pending') {
            query = query.eq('is_approved', false);
        } else if (currentTab === 'approved') {
            query = query.eq('is_approved', true);
        }
        // 'all' needs no filter

        const { data, error } = await query;

        if (error) {
            grid.innerHTML = `<div class="text-red-400">Error: ${error.message}</div>`;
            return;
        }

        if (!data || data.length === 0) {
            grid.innerHTML = '<div class="text-center text-gray-500 py-8">No guides found in this category.</div>';
            return;
        }

        grid.innerHTML = data.map(guide => `
            <div class="bg-gray-800/50 border ${guide.is_approved ? 'border-green-500/30' : 'border-yellow-500/30'} rounded-lg p-4 flex justify-between items-center hover:bg-gray-800 transition">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-xs font-bold px-2 py-0.5 rounded ${guide.is_approved ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}">
                            ${guide.is_approved ? 'APPROVED' : 'PENDING'}
                        </span>
                        <span class="text-xs text-gray-400">${guide.difficulty}</span>
                        <span class="text-xs text-cyan-400 font-bold">${guide.game?.title || 'Unknown Game'}</span>
                    </div>
                    <h3 class="text-lg font-bold text-white">${guide.title}</h3>
                    <p class="text-xs text-gray-500">By ${guide.author?.username || 'Admin'} • ${new Date(guide.created_at).toLocaleDateString()}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="window.editGuide('${guide.id}')" class="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded font-bold">Edit</button>
                    ${!guide.is_approved ? `
                        <button onclick="window.approveGuide('${guide.id}')" class="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded font-bold">Approve</button>
                    ` : ''}
                    <button onclick="window.deleteGuide('${guide.id}')" class="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded font-bold">Delete</button>
                </div>
            </div>
        `).join('');
    }

    function openEditor(guide = null) {
        if (guide) {
            document.getElementById('edit-guide-id').value = guide.id;
            document.getElementById('a-title').value = guide.title;
            document.getElementById('a-game').value = guide.game_id;
            document.getElementById('a-diff').value = guide.difficulty;
            document.getElementById('a-video').value = guide.video_url || '';
            document.getElementById('a-content').value = guide.content_html || '';
            document.getElementById('a-approved').checked = guide.is_approved;
            document.getElementById('modal-title').textContent = '✏️ Edit Guide';
        } else {
            form.reset();
            document.getElementById('edit-guide-id').value = '';
            document.getElementById('modal-title').textContent = '✨ Create New Guide';
            document.getElementById('a-approved').checked = true; // Default to approved for admins
        }
        modal.classList.remove('hidden');
    }

    async function saveGuide(adminId) {
        const id = document.getElementById('edit-guide-id').value;
        const gameId = document.getElementById('a-game').value;
        const title = document.getElementById('a-title').value;
        const diff = document.getElementById('a-diff').value;
        const video = document.getElementById('a-video').value;
        const content = document.getElementById('a-content').value;
        const isApproved = document.getElementById('a-approved').checked;

        if (!gameId) return alert('Please select a game');

        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        const payload = {
            game_id: gameId,
            title,
            slug,
            difficulty: diff,
            video_url: video,
            content_html: content,
            is_approved: isApproved,
            updated_at: new Date().toISOString()
        };

        if (!id) {
            // Create
            payload.author_id = adminId;
            payload.created_at = new Date().toISOString();
        }

        const { error } = id 
            ? await supabase.from('guides').update(payload).eq('id', id)
            : await supabase.from('guides').insert(payload);

        if (error) {
            alert('Error saving: ' + error.message);
        } else {
            modal.classList.add('hidden');
            loadGuides();
            alert('Guide saved successfully!');
        }
    }

    // Global Helpers
    window.editGuide = async (id) => {
        const { data } = await supabase.from('guides').select('*').eq('id', id).single();
        if (data) openEditor(data);
    };

    window.approveGuide = async (id) => {
        if(!confirm('Approve this guide? It will be visible to everyone.')) return;
        const { error } = await supabase.from('guides').update({ is_approved: true }).eq('id', id);
        if (error) alert('Error: ' + error.message);
        else loadGuides();
    };

    window.deleteGuide = async (id) => {
        if(!confirm('Are you sure? This cannot be undone.')) return;
        const { error } = await supabase.from('guides').delete().eq('id', id);
        if (error) alert('Error: ' + error.message);
        else loadGuides();
    };
}
