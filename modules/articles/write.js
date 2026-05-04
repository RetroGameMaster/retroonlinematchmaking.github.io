// modules/articles/write.js
import { supabase } from '../../lib/supabase.js';

let editor = null;

// 1. Robust Loader: Waits specifically for the CDN globals to exist
function waitForTiptap() {
  return new Promise((resolve) => {
    const check = () => {
      // Check if the main Core and StarterKit are on the window object
      if (window.TiptapCore && window.TiptapStarterKit) {
        console.log('✅ Tiptap libraries detected');
        resolve();
      } else {
        console.log('⏳ Waiting for Tiptap...');
        setTimeout(check, 100); // Check every 100ms
      }
    };
    check();
    // Fallback timeout just in case
    setTimeout(() => {
      if (!window.TiptapCore) resolve(); 
    }, 5000);
  });
}

export default async function initWriteModule(rom) {
  const container = document.getElementById('app-content');
  if (!container) return;

  // Check Auth
  if (!rom.currentUser) {
    container.innerHTML = `<div class="text-center py-20"><h2 class="text-2xl text-white">Please log in to write.</h2><button onclick="window.location.hash='#/auth'" class="mt-4 text-cyan-400 underline">Log In</button></div>`;
    return;
  }

  // If HTML isn't already there, fetch it
  if (!document.getElementById('editor-content')) {
    container.innerHTML = `<div class="text-center py-12"><div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div><p class="mt-2 text-gray-300">Loading Editor...</p></div>`;
    
    try {
      const response = await fetch('./modules/articles/write.html');
      if (!response.ok) throw new Error('HTML not found');
      const html = await response.text();
      container.innerHTML = html;
    } catch (e) {
      console.error(e);
      container.innerHTML = `<div class="text-red-400 text-center">Failed to load editor interface.</div>`;
      return;
    }
  }

  // WAIT for scripts to load before doing ANYTHING else
  await waitForTiptap();

  // Initialize
  initEditor();
  setupListeners(rom);
}

function initEditor() {
  const editorElement = document.querySelector('#editor-content');
  if (!editorElement) return;

  // Ensure empty
  editorElement.innerHTML = ''; 

  // Try to find the libraries under various possible global names
  const Core = window.TiptapCore || window.tiptapCore || window.Tiptap;
  
  // StarterKit is often exposed directly as 'StarterKit' or nested
  let StarterKit = window.TiptapStarterKit || window.StarterKit;
  if (StarterKit && StarterKit.StarterKit) StarterKit = StarterKit.StarterKit;

  // Extensions
  let ImageExt = window.TiptapExtensionImage || window.ImageExtension || window.Image;
  if (ImageExt && ImageExt.Image) ImageExt = ImageExt.Image;
  
  let LinkExt = window.TiptapExtensionLink || window.LinkExtension || window.Link;
  if (LinkExt && LinkExt.Link) LinkExt = LinkExt.Link;

  console.log('🛠️ Editor Config:', { Core, StarterKit, ImageExt, LinkExt });

  if (!Core || !StarterKit) {
    console.error("❌ CRITICAL: Tiptap Core or StarterKit not found on window object.");
    console.log("Available keys:", Object.keys(window).filter(k => k.toLowerCase().includes('tip')));
    editorElement.innerHTML = "<p class='text-red-500'>Editor failed to load. Check console for missing libs.</p>";
    return;
  }

  try {
    editor = Core.Editor.create({
      element: editorElement,
      extensions: [
        StarterKit,
        ImageExt ? ImageExt.configure({ inline: true }) : [],
        LinkExt ? LinkExt.configure({ openOnClick: false }) : [],
      ],
      content: '<p>Start writing your amazing article here...</p>',
      editable: true,
      autofocus: true
    });
    console.log('✅ Editor Created Successfully');
  } catch (e) {
    console.error('💥 Init Error:', e);
    editorElement.innerHTML = `<p class='text-red-500'>Init Error: ${e.message}</p>`;
  }
}

function setupListeners(rom) {
  // Toolbar Actions
  document.querySelectorAll('#toolbar button[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const action = btn.dataset.action;
      
      if (!editor) {
        alert('Editor not ready yet.');
        return;
      }

      switch (action) {
        case 'heading': editor.chain().focus().toggleHeading({ level: 1 }).run(); break;
        case 'bold': editor.chain().focus().toggleBold().run(); break;
        case 'italic': editor.chain().focus().toggleItalic().run(); break;
        case 'underline': editor.chain().focus().toggleUnderline().run(); break;
        case 'bulletList': editor.chain().focus().toggleBulletList().run(); break;
        case 'orderedList': editor.chain().focus().toggleOrderedList().run(); break;
        case 'blockquote': editor.chain().focus().toggleBlockquote().run(); break;
        case 'codeBlock': editor.chain().focus().toggleCodeBlock().run(); break;
        default: break;
      }
    });
  });

  // Image Upload Trigger
  const uploadBtn = document.getElementById('btn-upload-image');
  const fileInput = document.getElementById('image-input');
  
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file || !editor) return;

      const statusEl = document.getElementById('save-status');
      if (statusEl) {
        statusEl.textContent = 'Uploading image...';
        statusEl.className = 'text-xs text-yellow-400';
      }

      try {
        const fileName = `${rom.currentUser.id}/${Date.now()}-${file.name.replace(/\s/g, '-')}`;
        const { data, error } = await supabase.storage
          .from('article-uploads')
          .upload(fileName, file, { cacheControl: '3600', upsert: false });

        if (error) throw error;

        const { publicUrl } = supabase.storage.from('article-uploads').getPublicUrl(fileName);
        editor.chain().focus().setImage({ src: publicUrl }).run();
        
        if (statusEl) {
          statusEl.textContent = 'Image inserted!';
          statusEl.className = 'text-xs text-green-400';
          setTimeout(() => statusEl.textContent = '', 2000);
        }

      } catch (err) {
        console.error(err);
        alert('Failed to upload image: ' + err.message);
        if (statusEl) {
          statusEl.textContent = 'Upload failed.';
          statusEl.className = 'text-xs text-red-400';
        }
      } finally {
        fileInput.value = ''; 
      }
    });
  }

  // Publish Button
  const publishBtn = document.getElementById('btn-publish');
  if (publishBtn) {
    publishBtn.addEventListener('click', async () => {
      const titleInput = document.getElementById('article-title');
      const categorySelect = document.getElementById('article-category');
      const magazineCheck = document.getElementById('is-magazine');
      
      const title = titleInput ? titleInput.value.trim() : '';
      const categorySlug = categorySelect ? categorySelect.value : '';
      const isMagazine = magazineCheck ? magazineCheck.checked : false;
      const contentHtml = editor ? editor.getHTML() : '';

      if (!title) return alert('Please enter a title.');
      if (!categorySlug) return alert('Please select a category.');
      if (!contentHtml || contentHtml.length < 20) return alert('Article is too short.');

      publishBtn.disabled = true;
      publishBtn.textContent = 'Publishing...';

      try {
        const { data: article, error: artError } = await supabase
          .from('articles')
          .insert([{
            author_id: rom.currentUser.id,
            title: title,
            content_html: contentHtml,
            category_slug: categorySlug,
            is_magazine_issue: isMagazine,
            status: 'published'
          }])
          .select()
          .single();

        if (artError) throw artError;

        await supabase.rpc('award_xp', { 
          user_uuid: rom.currentUser.id, 
          amount: 50, 
          reason: 'article_published' 
        });

        try {
          await supabase.rpc('increment_article_count', { user_uuid: rom.currentUser.id }); 
        } catch (e) { console.warn('Could not increment count', e); }

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
}
