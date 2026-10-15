import { supabase } from '../lib/supabase.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[ch]));

async function currentUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

async function profileNames(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const { data } = await supabase.from('profiles').select('id,username,avatar_url').in('id', ids);
  return new Map((data || []).map(p => [p.id, p]));
}

export async function initModule() {
  const root = document.getElementById('app-content');
  if (!root) return;
  root.innerHTML = `
    <section class="max-w-5xl mx-auto p-4">
      <header class="mb-8 text-center">
        <h1 class="text-4xl font-bold text-green-300 mb-2">💬 ROM Community Forum</h1>
        <p class="text-gray-400">Talk retro games, find players, share discoveries, and keep community discussions going.</p>
      </header>
      <div id="forum-compose" class="mb-8 rounded-xl border border-green-500/30 bg-gray-900/80 p-5"></div>
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 class="text-2xl font-bold text-white">Recent discussions</h2>
        <select id="forum-category-filter" class="rounded bg-gray-800 border border-gray-700 p-2 text-white">
          <option value="">All categories</option><option>General</option><option>Looking for Players</option><option>Retro Gaming</option><option>Technical Help</option><option>Events</option><option>Game Suggestions</option>
        </select>
      </div>
      <div id="forum-posts" class="space-y-4"><p class="text-gray-400 text-center py-8">Loading discussions…</p></div>
    </section>`;
  const user = await currentUser();
  const compose = root.querySelector('#forum-compose');
  compose.innerHTML = user ? `
    <h2 class="text-lg font-bold text-cyan-300 mb-3">Start a discussion</h2>
    <form id="forum-new-post" class="space-y-3">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <select name="category" class="rounded bg-gray-800 border border-gray-700 p-3 text-white">
          <option>General</option><option>Looking for Players</option><option>Retro Gaming</option><option>Technical Help</option><option>Events</option><option>Game Suggestions</option>
        </select>
        <input name="title" required minlength="3" maxlength="160" placeholder="Discussion title" class="md:col-span-2 rounded bg-gray-800 border border-gray-700 p-3 text-white">
      </div>
      <textarea name="body" required maxlength="12000" rows="4" placeholder="What's on your mind?" class="w-full rounded bg-gray-800 border border-gray-700 p-3 text-white"></textarea>
      <div class="flex justify-end"><button class="rounded bg-green-600 hover:bg-green-500 px-5 py-2 font-bold text-white" type="submit">Post discussion</button></div>
      <p id="forum-compose-status" class="text-sm text-gray-400"></p>
    </form>` : `<p class="text-gray-300">You can browse discussions without logging in. <a href="#/auth" class="text-cyan-300 underline">Log in</a> to start a discussion or reply.</p>`;

  const postsContainer = root.querySelector('#forum-posts');
  const filter = root.querySelector('#forum-category-filter');
  async function loadPosts() {
    postsContainer.innerHTML = '<p class="text-gray-400 text-center py-8">Loading discussions…</p>';
    let query = supabase.from('community_forum_posts').select('id,user_id,category,title,body,created_at,updated_at').order('created_at',{ascending:false}).limit(100);
    if (filter.value) query = query.eq('category', filter.value);
    const { data: posts, error } = await query;
    if (error) {
      postsContainer.innerHTML = '<p class="text-amber-300 text-center py-8">Forum tables are not ready yet. Apply the community forum migration in Supabase first.</p>';
      return;
    }
    if (!posts?.length) {
      postsContainer.innerHTML = '<p class="text-gray-400 text-center py-8">No discussions here yet. Start the first one!</p>';
      return;
    }
    const names = await profileNames(posts.map(p => p.user_id));
    const { data: replyRows } = await supabase.from('community_forum_replies').select('post_id').in('post_id', posts.map(p => p.id));
    const replyCounts = new Map();
    (replyRows || []).forEach(r => replyCounts.set(r.post_id,(replyCounts.get(r.post_id)||0)+1));
    postsContainer.innerHTML = posts.map(post => {
      const profile = names.get(post.user_id);
      const author = profile?.username || 'ROM member';
      return `
        <article class="rounded-xl border border-gray-700 bg-gray-900/80 p-5" data-forum-post="${esc(post.id)}">
          <div class="flex flex-wrap items-center gap-2 mb-2">
            <span class="text-xs rounded-full border border-cyan-500/40 bg-cyan-950/50 text-cyan-200 px-3 py-1">${esc(post.category)}</span>
            <span class="text-xs text-gray-500">${esc(new Date(post.created_at).toLocaleString())}</span>
          </div>
          <h3 class="text-xl font-bold text-white mb-2">${esc(post.title)}</h3>
          <p class="text-sm text-gray-400 mb-3">Posted by ${esc(author)}</p>
          <p class="text-gray-200 whitespace-pre-wrap break-words">${esc(post.body)}</p>
          <div class="mt-4 flex items-center gap-3">
            <button type="button" data-forum-action="toggle-replies" data-post-id="${esc(post.id)}" class="text-sm text-cyan-300 hover:text-cyan-100 underline">Replies (${replyCounts.get(post.id)||0})</button>
            ${user?.id === post.user_id ? '<button type="button" data-forum-action="delete-post" data-post-id="' + esc(post.id) + '" class="text-sm text-red-300 hover:text-red-100 underline">Delete post</button>' : ''}
          </div>
          <div data-forum-replies="${esc(post.id)}" class="hidden mt-4 border-t border-gray-700 pt-4"></div>
        </article>`;
    }).join('');

    postsContainer.querySelectorAll('[data-forum-action="toggle-replies"]').forEach(button => {
      button.addEventListener('click', () => toggleReplies(button.dataset.postId, user));
    });
    postsContainer.querySelectorAll('[data-forum-action="delete-post"]').forEach(button => {
      button.addEventListener('click', async () => {
        if (!confirm('Delete this discussion and its replies?')) return;
        const { error } = await supabase.from('community_forum_posts').delete().eq('id',button.dataset.postId).eq('user_id',user.id);
        if (error) alert('Could not delete the post.');
        else await loadPosts();
      });
    });
  }

  async function toggleReplies(postId, signedInUser, forceReload = false) {
    const panel = postsContainer.querySelector('[data-forum-replies="' + CSS.escape(postId) + '"]');
    if (!panel) return;
    if (!panel.classList.contains('hidden') && !forceReload) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');
    panel.innerHTML = '<p class="text-gray-400">Loading replies…</p>';
    const { data: replies, error } = await supabase.from('community_forum_replies')
      .select('id,post_id,user_id,body,created_at').eq('post_id',postId).order('created_at',{ascending:true});
    if (error) { panel.innerHTML = '<p class="text-amber-300">Could not load replies.</p>'; return; }
    const names = await profileNames((replies || []).map(r => r.user_id));
    panel.innerHTML = `
      <div class="space-y-3 mb-4">${(replies || []).map(reply => `
        <div class="rounded-lg bg-gray-800/70 p-3">
          <div class="text-xs text-gray-400 mb-2">${esc(names.get(reply.user_id)?.username || 'ROM member')} · ${esc(new Date(reply.created_at).toLocaleString())}</div>
          <p class="text-gray-200 whitespace-pre-wrap break-words">${esc(reply.body)}</p>
          ${signedInUser?.id === reply.user_id ? '<button data-forum-delete-reply="' + esc(reply.id) + '" class="text-xs text-red-300 underline mt-2">Delete reply</button>' : ''}
        </div>`).join('') || '<p class="text-gray-500 text-sm">No replies yet.</p>'}</div>
      ${signedInUser ? `
        <form data-forum-reply-form="${esc(postId)}" class="space-y-2">
          <textarea name="body" rows="2" maxlength="6000" required placeholder="Write a reply…" class="w-full rounded bg-gray-800 border border-gray-700 p-3 text-white"></textarea>
          <button class="rounded bg-cyan-700 hover:bg-cyan-600 px-4 py-2 text-sm font-bold text-white">Reply</button>
          <p data-forum-reply-status class="text-sm text-gray-400"></p>
        </form>` : '<p class="text-gray-400 text-sm"><a href="#/auth" class="text-cyan-300 underline">Log in</a> to reply.</p>'}`;
    panel.querySelectorAll('[data-forum-delete-reply]').forEach(button => button.addEventListener('click', async () => {
      const { error } = await supabase.from('community_forum_replies').delete().eq('id',button.dataset.forumDeleteReply).eq('user_id',signedInUser.id);
      if (error) alert('Could not delete the reply.'); else await toggleReplies(postId,signedInUser,true);
    }));
    const form = panel.querySelector('[data-forum-reply-form]');
    if (form) form.addEventListener('submit', async event => {
      event.preventDefault();
      const status = form.querySelector('[data-forum-reply-status]');
      const body = new FormData(form).get('body').toString().trim();
      if (!body) return;
      status.textContent = 'Posting…';
      const { error } = await supabase.from('community_forum_replies').insert({post_id:postId,user_id:signedInUser.id,body});
      if (error) status.textContent = 'Could not post reply. Please try again.';
      else await toggleReplies(postId,signedInUser);
    });
  }

  const newPostForm = compose.querySelector('#forum-new-post');
  if (newPostForm) newPostForm.addEventListener('submit', async event => {
    event.preventDefault();
    const status = compose.querySelector('#forum-compose-status');
    const form = new FormData(newPostForm);
    status.textContent = 'Posting…';
    const { error } = await supabase.from('community_forum_posts').insert({
      user_id:user.id,category:form.get('category').toString(),title:form.get('title').toString().trim(),body:form.get('body').toString().trim()
    });
    if (error) status.textContent = 'Could not post discussion. Please try again.';
    else { newPostForm.reset(); status.textContent = 'Discussion posted.'; await loadPosts(); }
  });
  filter.addEventListener('change', loadPosts);
  await loadPosts();
}

export default { initModule };
