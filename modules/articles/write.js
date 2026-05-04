// modules/articles/write.js
import { supabase } from '../../lib/supabase.js';

let editor = null;

export default async function initWriteModule(rom) {
  const container = document.getElementById('app-content');
  if (!container) return;

  // Check Auth
  if (!rom.currentUser) {
    container.innerHTML = `<div class="text-center py-20"><h2 class="text-2xl text-white">Please log in to write.</h2><button onclick="window.location.hash='#/auth'" class="mt-4 text-cyan-400 underline">Log In</button></div>`;
    return;
  }

  // Render HTML (loaded via app.js usually, but ensuring structure exists)
  if (!document.getElementById('editor-content')) {
    const response = await fetch('./modules/articles/write.html');
    const html = await response.text();
    container.innerHTML = html;
  }

  initEditor();
  setupListeners(rom);
}

function initEditor() {
  const { StarterKit, Image, Link } = window.TiptapStarterKit || window.Tiptap; 
  // Note: In browser global scope, Tiptap libraries attach to window. 
  // Adjust based on how your bundler/loader handles the CDN scripts.
  // If using pure CDN without bundler, access via window.TiptapCore, etc.
  
  // Fallback for direct CDN usage where globals are named differently
  const Core = window.TiptapCore; 
  const StarterKitExt = window.TiptapStarterKit;
  const ImageExt = window.TiptapExtensionImage;
  const LinkExt = window.TiptapExtensionLink;

  if (!Core) {
    console.error("Tiptap not loaded. Check network tab.");
    document.getElementById('editor-content').innerHTML = "<p class='text-red-500'>Editor failed to load. Refresh page.</p>";
    return;
  }

  editor = Core.Editor.create({
    element: document.querySelector('#editor-content'),
    extensions: [
      StarterKitExt.StarterKit,
      ImageExt.Image.configure({ inline: true }),
      LinkExt.Link.configure({ openOnClick: false }),
    ],
    content: '<p>Start writing your amazing article here...</p>',
    editable: true,
  });
}

function setupListeners(rom) {
  // Toolbar Actions
  document.querySelectorAll('#toolbar button[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const action = btn.dataset.action;
      if (action === 'heading') editor.chain().focus().toggleHeading({ level: 1 }).run();
      else if (action === 'bold') editor.chain().focus().toggleBold().run();
      else if (action === 'italic') editor.chain().focus().toggleItalic().run();
      else if (action === 'underline') editor.chain().focus().toggleUnderline().run();
      else if (action === 'bulletList') editor.chain().focus().toggleBulletList().run();
      else if (action === 'orderedList') editor.chain().focus().toggleOrderedList().run();
      else if (action === 'blockquote') editor.chain().focus().toggleBlockquote().run();
      else if (action === 'codeBlock') editor.chain().focus().toggleCodeBlock().run();
    });
  });

  // Image Upload Trigger
  const uploadBtn = document.getElementById('btn-upload-image');
  const fileInput = document.getElementById('image-input');
  
  uploadBtn.addEventListener('click', () => fileInput.click());
  
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const statusEl = document.getElementById('save-status');
    statusEl.textContent = 'Uploading image...';
    statusEl.className = 'text-xs text-yellow-400';

    try {
      // Upload to Supabase Storage
      const fileName = `${rom.currentUser.id}/${Date.now()}-${file.name.replace(/\s/g, '-')}`;
      const { data, error } = await supabase.storage
        .from('article-uploads')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (error) throw error;

      // Get Public URL
      const { data: { publicUrl } } = supabase.storage.from('article-uploads').getPublicUrl(fileName);

      // Insert into Editor
      editor.chain().focus().setImage({ src: publicUrl }).run();
      statusEl.textContent = 'Image inserted!';
      statusEl.className = 'text-xs text-green-400';
      setTimeout(() => statusEl.textContent = '', 2000);

    } catch (err) {
      console.error(err);
      alert('Failed to upload image: ' + err.message);
      statusEl.textContent = 'Upload failed.';
      statusEl.className = 'text-xs text-red-400';
    } finally {
      fileInput.value = ''; // Reset input
    }
  });

  // Publish Button
  const publishBtn = document.getElementById('btn-publish');
  publishBtn.addEventListener('click', async () => {
    const title = document.getElementById('article-title').value.trim();
    const categorySlug = document.getElementById('article-category').value;
    const isMagazine = document.getElementById('is-magazine').checked;
    const contentHtml = editor.getHTML();

    if (!title) return alert('Please enter a title.');
    if (!categorySlug) return alert('Please select a category.');
    if (contentHtml.length < 20) return alert('Article is too short.');

    publishBtn.disabled = true;
    publishBtn.textContent = 'Publishing...';

    try {
      // 1. Insert Article
      const { data: article, error: artError } = await supabase
        .from('articles')
        .insert([{
          author_id: rom.currentUser.id,
          title: title,
          content_html: contentHtml,
          category_slug: categorySlug,
          is_magazine_issue: isMagazine,
          status: 'published' // Or 'pending' if you want moderation
        }])
        .select()
        .single();

      if (artError) throw artError;

      // 2. Award XP (Handled by DB Trigger usually, but explicit call ensures it)
      // Assuming you have the RPC function 'award_xp' from previous steps
      await supabase.rpc('award_xp', { 
        user_uuid: rom.currentUser.id, 
        amount: 50, 
        reason: 'article_published' 
      });

      // 3. Update Profile Stats (Optional: Increment article count)
      await supabase.rpc('increment_article_count', { user_uuid: rom.currentUser.id }); 
      // Note: You may need to create this simple RPC or handle via JS update

      alert('🎉 Article Published! You earned 50 XP.');
      window.location.hash = `#/article/${article.id}`;

    } catch (err) {
      console.error(err);
      alert('Error publishing: ' + err.message);
      publishBtn.disabled = false;
      publishBtn.textContent = '🚀 Publish Article (+50 XP)';
    }
  });
}
