import { supabase } from '../../lib/supabase.js';

const TOPIC_PAGE_SIZE = 30;
const POST_PAGE_SIZE = 30;

export default async function initForumModule(rom, params = {}) {
  const root = document.getElementById('forum-root');
  if (!root) return;

  const user = rom.currentUser || (await supabase.auth.getUser()).data?.user || null;
  const status = document.getElementById('forum-status');
  const content = document.getElementById('forum-content');
  const categoryFilter = document.getElementById('forum-category-filter');
  const createPanel = document.getElementById('forum-topic-form-panel');
  const createButton = document.getElementById('forum-new-topic-button');
  const categorySelect = document.getElementById('forum-topic-category');
  const authHint = document.getElementById('forum-auth-hint');
  let categories = [];
  let activeCategory = params.category || '';
  let postOffset = 0;
  let topicOffset = 0;
  let loadedTopics = [];

  if (!user) {
    createButton.classList.add('hidden');
    authHint.innerHTML = '<a class="text-cyan-400 hover:text-cyan-300" href="#/auth">Sign in</a> to start a discussion or reply.';
  } else {
    authHint.textContent = 'Signed in as a community member.';
  }

  createButton.addEventListener('click', () => {
    if (!user) {
      window.location.hash = '#/auth';
      return;
    }
    createPanel.classList.toggle('hidden');
    if (!createPanel.classList.contains('hidden')) {
      document.getElementById('forum-topic-title')?.focus();
    }
  });
  document.getElementById('forum-cancel-topic').addEventListener('click', () => {
    createPanel.classList.add('hidden');
  });
  document.getElementById('forum-topic-form').addEventListener('submit', createTopic);

  if (!(await loadCategories())) return;
  renderCategoryControls();
  if (params.topicId) {
    await loadTopic(params.topicId);
  } else {
    await loadTopics();
  }

  async function loadCategories() {
    const { data, error } = await supabase
      .from('forum_categories')
      .select('id, slug, name, description, sort_order')
      .order('sort_order', { ascending: true });
    if (error) {
      showError(`Could not load forum categories: ${error.message}`);
      content.textContent = 'The forum is not available right now.';
      return false;
    }
    categories = data || [];
    categorySelect.replaceChildren(...categories.map(category =>
      new Option(category.name, category.id)
    ));
    createButton.disabled = categories.length === 0;
    return true;
  }

  function renderCategoryControls() {
    const buttons = [
      { id: '', name: 'All discussions' },
      ...categories.map(category => ({ id: category.id, name: category.name })),
    ];
    categoryFilter.replaceChildren(...buttons.map(category => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = category.name;
      button.className = `rounded-full border px-3 py-1.5 text-sm transition ${
        activeCategory === category.id
          ? 'border-cyan-400 bg-cyan-700/40 text-cyan-100'
          : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500'
      }`;
      button.addEventListener('click', () => {
        activeCategory = category.id;
        topicOffset = 0;
        loadedTopics = [];
        window.history.replaceState(null, '', `#/forum${activeCategory ? `?category=${encodeURIComponent(activeCategory)}` : ''}`);
        renderCategoryControls();
        void loadTopics();
      });
      return button;
    }));
  }

  async function loadTopics() {
    if (topicOffset === 0) {
      content.innerHTML = '<div class="rounded-xl border border-gray-700 bg-gray-800/60 p-8 text-center text-gray-400">Loading discussions…</div>';
    }
    let query = supabase
      .from('forum_topics')
      .select('id, category_id, author_id, title, post_count, created_at, last_post_at, last_post_author_id', { count: 'exact' })
      .order('last_post_at', { ascending: false })
      .range(topicOffset, topicOffset + TOPIC_PAGE_SIZE - 1);
    if (activeCategory) query = query.eq('category_id', activeCategory);

    const { data: topics, error, count } = await query;
    if (error) {
      showError(`Could not load discussions: ${error.message}`);
      content.textContent = 'Discussions could not be loaded. Please try again later.';
      return;
    }
    if (!topics?.length && topicOffset === 0) {
      content.innerHTML = '<div class="rounded-xl border border-gray-700 bg-gray-800/60 p-10 text-center"><p class="text-xl font-semibold text-white">No discussions yet</p><p class="mt-2 text-gray-400">Start the first conversation in this category.</p></div>';
      return;
    }
    loadedTopics.push(...(topics || []));
    topicOffset += (topics || []).length;

    const authorIds = [...new Set(loadedTopics.flatMap(topic => [topic.author_id, topic.last_post_author_id]).filter(Boolean))];
    const profilesResult = authorIds.length
      ? await supabase.from('profiles').select('id, username, avatar_url').in('id', authorIds)
      : { data: [], error: null };
    if (profilesResult.error) {
      showError(`Could not load discussion authors: ${profilesResult.error.message}`);
      content.textContent = 'Discussion authors could not be loaded.';
      return;
    }
    const profiles = new Map((profilesResult.data || []).map(profile => [profile.id, profile]));
    const categoryNames = new Map(categories.map(category => [category.id, category.name]));

    const list = document.createElement('div');
    list.className = 'overflow-hidden rounded-xl border border-gray-700 bg-gray-800/60';
    for (const topic of loadedTopics) {
      const row = document.createElement('article');
      row.className = 'flex flex-col gap-3 border-b border-gray-700/80 p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:p-5';
      const titleLink = document.createElement('a');
      titleLink.href = `#/forum/topic/${encodeURIComponent(topic.id)}${activeCategory ? `?category=${encodeURIComponent(activeCategory)}` : ''}`;
      titleLink.className = 'text-lg font-bold text-white hover:text-cyan-300';
      titleLink.textContent = topic.title;

      const details = document.createElement('div');
      details.className = 'min-w-0 flex-1';
      const meta = document.createElement('p');
      meta.className = 'mt-1 text-xs text-gray-400';
      const author = profiles.get(topic.author_id)?.username || 'ROM member';
      meta.textContent = `${categoryNames.get(topic.category_id) || 'Forum'} · Started by ${author} · ${formatDate(topic.created_at)}`;
      details.append(titleLink, meta);

      const activity = document.createElement('div');
      activity.className = 'shrink-0 text-sm text-gray-400 sm:text-right';
      const count = document.createElement('p');
      count.className = 'font-semibold text-gray-200';
      count.textContent = `${topic.post_count || 0} ${(topic.post_count || 0) === 1 ? 'post' : 'posts'}`;
      const latestAuthor = profiles.get(topic.last_post_author_id)?.username || author;
      const latest = document.createElement('p');
      latest.className = 'mt-1 text-xs';
      latest.textContent = `Latest: ${latestAuthor} · ${formatDate(topic.last_post_at)}`;
      activity.append(count, latest);
      row.append(details, activity);
      list.appendChild(row);
    }
    if (topicOffset < (count || 0)) {
      const moreButton = document.createElement('button');
      moreButton.type = 'button';
      moreButton.className = 'mt-4 rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-200 hover:bg-gray-700';
      moreButton.textContent = 'Load more discussions';
      moreButton.addEventListener('click', () => void loadTopics());
      list.appendChild(moreButton);
    }
    content.replaceChildren(list);
  }

  async function loadTopic(topicId) {
    if (!/^[0-9a-f-]{36}$/i.test(topicId)) {
      content.textContent = 'That discussion link is not valid.';
      return;
    }
    const { data: topic, error: topicError } = await supabase
      .from('forum_topics')
      .select('id, category_id, author_id, title, post_count, created_at')
      .eq('id', topicId)
      .maybeSingle();
    if (topicError) {
      showError(`Could not load this discussion: ${topicError.message}`);
      content.textContent = 'This discussion could not be loaded.';
      return;
    }
    if (!topic) {
      content.innerHTML = '<div class="rounded-xl border border-gray-700 bg-gray-800/60 p-8 text-center text-gray-300">Discussion not found. <a class="text-cyan-400 hover:text-cyan-300" href="#/forum">Return to the forum</a>.</div>';
      return;
    }

    const { data: posts, error: postsError, count } = await supabase
      .from('forum_posts')
      .select('id, topic_id, author_id, content, created_at', { count: 'exact' })
      .eq('topic_id', topic.id)
      .order('created_at', { ascending: false })
      .range(0, postOffset + POST_PAGE_SIZE - 1);
    if (postsError) {
      showError(`Could not load replies: ${postsError.message}`);
      content.textContent = 'Replies could not be loaded.';
      return;
    }
    const authors = [...new Set([topic.author_id, ...(posts || []).map(post => post.author_id)])];
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', authors);
    if (profileError) {
      showError(`Could not load discussion authors: ${profileError.message}`);
      content.textContent = 'Discussion authors could not be loaded.';
      return;
    }
    const profileMap = new Map((profiles || []).map(profile => [profile.id, profile]));
    const topicCategory = categories.find(item => item.id === topic.category_id);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <a href="#/forum${activeCategory ? `?category=${encodeURIComponent(activeCategory)}` : ''}" class="mb-5 inline-flex text-sm font-semibold text-cyan-400 hover:text-cyan-300">← Back to discussions</a>
      <header class="mb-4 rounded-xl border border-cyan-500/30 bg-gray-800/70 p-5">
        <p class="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-400">${escapeHtml(topicCategory?.name || 'Forum')}</p>
        <h2 class="text-2xl font-bold text-white">${escapeHtml(topic.title)}</h2>
        <p class="mt-2 text-sm text-gray-400">Started by ${escapeHtml(profileMap.get(topic.author_id)?.username || 'ROM member')} · ${formatDate(topic.created_at)}</p>
      </header>`;
    for (const post of [...(posts || [])].reverse()) {
      const author = profileMap.get(post.author_id);
      const article = document.createElement('article');
      article.className = 'mb-3 rounded-xl border border-gray-700 bg-gray-800/60 p-4 sm:p-5';
      const header = document.createElement('div');
      header.className = 'mb-3 flex items-center justify-between gap-3 border-b border-gray-700 pb-3';
      const name = document.createElement('strong');
      name.className = 'text-cyan-200';
      name.textContent = author?.username || 'ROM member';
      const date = document.createElement('time');
      date.className = 'text-xs text-gray-500';
      date.dateTime = post.created_at;
      date.textContent = formatDate(post.created_at);
      const postActions = document.createElement('div');
      postActions.className = 'flex items-center gap-3';
      postActions.appendChild(date);
      if (user?.id === post.author_id) {
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'text-xs font-semibold text-red-300 hover:text-red-200';
        deleteButton.textContent = 'Delete post';
        deleteButton.addEventListener('click', () => void deletePost(post));
        postActions.appendChild(deleteButton);
      }
      header.append(name, postActions);
      const body = document.createElement('p');
      body.className = 'whitespace-pre-wrap break-words text-sm leading-7 text-gray-200';
      body.textContent = post.content;
      article.append(header, body);
      wrapper.appendChild(article);
    }

    const postsLoaded = (posts || []).length;
    if (count > postsLoaded) {
      const olderButton = document.createElement('button');
      olderButton.type = 'button';
      olderButton.className = 'mb-5 rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-200 hover:bg-gray-700';
      olderButton.textContent = 'Load older posts';
      olderButton.addEventListener('click', () => {
        postOffset += POST_PAGE_SIZE;
        void loadTopic(topicId);
      });
      wrapper.appendChild(olderButton);
    }

    if (user) {
      const formPanel = document.createElement('section');
      formPanel.className = 'mt-6 rounded-xl border border-cyan-500/30 bg-gray-800/70 p-5';
      formPanel.innerHTML = `
        <h3 class="mb-3 text-lg font-bold text-white">Write a reply</h3>
        <form id="forum-reply-form" class="space-y-3">
          <textarea id="forum-reply-content" maxlength="10000" rows="5" required placeholder="Add to the conversation…" class="w-full resize-y rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-white"></textarea>
          <div class="flex justify-end"><button type="submit" class="rounded-lg bg-cyan-600 px-5 py-2 font-bold text-white hover:bg-cyan-500">Post reply</button></div>
        </form>`;
      formPanel.querySelector('#forum-reply-form').addEventListener('submit', event => submitReply(event, topic.id));
      wrapper.appendChild(formPanel);
    } else {
      const signIn = document.createElement('p');
      signIn.className = 'mt-5 rounded-lg border border-gray-700 bg-gray-800/60 p-4 text-sm text-gray-300';
      signIn.innerHTML = '<a href="#/auth" class="font-semibold text-cyan-400 hover:text-cyan-300">Sign in</a> to reply to this discussion.';
      wrapper.appendChild(signIn);
    }
    content.replaceChildren(wrapper);
  }

  async function createTopic(event) {
    event.preventDefault();
    if (!user) {
      window.location.hash = '#/auth';
      return;
    }
    const title = document.getElementById('forum-topic-title').value.trim();
    const body = document.getElementById('forum-topic-content').value.trim();
    const categoryId = categorySelect.value;
    if (!title || !body || !categoryId) {
      showError('Choose a category and enter both a title and post.');
      return;
    }
    const submitButton = event.submitter;
    submitButton.disabled = true;
    try {
      const { data: topicId, error } = await supabase.rpc('create_forum_topic', {
        p_category_id: categoryId,
        p_title: title,
        p_content: body,
      });
      if (error) throw error;
      if (!topicId) throw new Error('The forum did not return the new discussion ID.');
      window.location.hash = `#/forum/topic/${encodeURIComponent(topicId)}`;
    } catch (error) {
      showError(`Could not create discussion: ${error.message}`);
      submitButton.disabled = false;
    }
  }

  async function submitReply(event, topicId) {
    event.preventDefault();
    if (!user) {
      window.location.hash = '#/auth';
      return;
    }
    const form = event.currentTarget;
    const textarea = form.querySelector('textarea');
    const replyContent = textarea.value.trim();
    if (!replyContent) {
      showError('Write a reply before posting.');
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    const { error } = await supabase.from('forum_posts').insert({
      topic_id: topicId,
      author_id: user.id,
      content: replyContent,
    });
    if (error) {
      showError(`Could not post reply: ${error.message}`);
      button.disabled = false;
      return;
    }
    postOffset = 0;
    await loadTopic(topicId);
  }

  async function deletePost(post) {
    if (!user || user.id !== post.author_id) return;
    if (!window.confirm('Delete this post? This cannot be undone.')) return;

    const { data, error } = await supabase
      .from('forum_posts')
      .delete()
      .eq('id', post.id)
      .eq('author_id', user.id)
      .select('id');
    if (error) {
      showError(`Could not delete your post: ${error.message}`);
      return;
    }
    if (!data?.length) {
      showError('That post was already removed or you do not have permission to delete it.');
      return;
    }

    const { data: topic, error: topicError } = await supabase
      .from('forum_topics')
      .select('id')
      .eq('id', post.topic_id)
      .maybeSingle();
    if (topicError) {
      showError(`The post was deleted, but the discussion could not be reloaded: ${topicError.message}`);
      return;
    }
    if (!topic) {
      window.location.hash = `#/forum${activeCategory ? `?category=${encodeURIComponent(activeCategory)}` : ''}`;
      return;
    }
    postOffset = 0;
    await loadTopic(post.topic_id);
  }

  function showError(message) {
    status.textContent = message;
    status.classList.remove('hidden');
  }
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}
