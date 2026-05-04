// modules/articles/home.js
import { supabase } from '../../lib/supabase.js';
import { getReactionConfig } from './reactions-config.js'; // Assuming you made this earlier

export default async function initArticlesHome(rom) {
  const container = document.getElementById('app-content');
  if (!container) return;

  // Load HTML if not present
  if (!document.getElementById('articles-grid')) {
    const response = await fetch('./modules/articles/home.html');
    const html = await response.text();
    container.innerHTML = html;
  }

  // Setup "Write" Button
  const writeBtn = document.getElementById('btn-write-new');
  if (writeBtn) {
    writeBtn.addEventListener('click', () => {
      if (!rom.currentUser) return window.location.hash = '#/auth';
      window.location.hash = '#/write';
    });
  }

  // Setup Filters
  setupFilters(rom);
  
  // Initial Load
  await loadArticles(rom, 'all');
}

async function setupFilters(rom) {
  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      // Update UI
      buttons.forEach(b => {
        b.classList.remove('bg-purple-600', 'text-white');
        b.classList.add('bg-gray-800', 'text-gray-400');
      });
      e.target.classList.remove('bg-gray-800', 'text-gray-400');
      e.target.classList.add('bg-purple-600', 'text-white');

      // Load Data
      const filter = e.target.dataset.filter;
      await loadArticles(rom, filter);
    });
  });
}

async function loadArticles(rom, filter) {
  const grid = document.getElementById('articles-grid');
  const emptyState = document.getElementById('empty-state');
  const hero = document.getElementById('magazine-hero');
  
  if (!grid) return;

  try {
    let query = supabase
      .from('articles')
      .select(`
        *,
        author:profiles!articles_author_id_fkey (
          id, username, avatar_url, gamercard_bg_type, gamercard_bg_value,
          rank:user_ranks (name, color)
        )
      `)
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      if (filter === 'magazine') {
        query = query.eq('is_magazine_issue', true);
      } else {
        query = query.eq('category_slug', filter);
      }
    }

    const { data: articles, error } = await query;

    if (error) throw error;

    // 1. Handle Magazine Hero (Only show if filter is 'all' or 'magazine' and we have issues)
    if ((filter === 'all' || filter === 'magazine') && articles && articles.length > 0) {
      const latestIssue = articles.find(a => a.is_magazine_issue);
      if (latestIssue) {
        renderMagazineHero(latestIssue, hero);
      } else {
        hero.classList.add('hidden');
      }
    } else {
      hero.classList.add('hidden');
    }

    // 2. Render Grid
    grid.innerHTML = '';
    
    // Filter out the hero item from the grid if it's the magazine issue to avoid duplication
    const gridItems = filter === 'magazine' 
      ? articles 
      : articles?.filter(a => !a.is_magazine_issue);

    if (!gridItems || gridItems.length === 0) {
      grid.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }

    grid.classList.remove('hidden');
    emptyState.classList.add('hidden');

    gridItems.forEach(article => {
      grid.appendChild(createArticleCard(article, rom));
    });

  } catch (err) {
    console.error('Error loading articles:', err);
    grid.innerHTML = `<div class="text-red-400 text-center col-span-full">Failed to load articles.</div>`;
  }
}

function renderMagazineHero(article, container) {
  if (!container) return;
  
  // Extract first image from content for cover
  const coverImage = extractCoverImage(article.content_html) || 'https://via.placeholder.com/800x400?text=No+Cover';
  
  container.innerHTML = `
    <a href="#/article/${article.id}" class="group block relative rounded-2xl overflow-hidden shadow-2xl border border-purple-500/30 aspect-[21/9]">
      <img src="${coverImage}" class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Cover">
      <div class="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
      
      <div class="absolute bottom-0 left-0 p-8 md:p-12">
        <span class="bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3 inline-block shadow-lg">
          📰 Latest Issue
        </span>
        <h2 class="text-3xl md:text-5xl font-bold text-white mb-4 drop-shadow-lg group-hover:text-purple-300 transition">${escapeHtml(article.title)}</h2>
        <div class="flex items-center gap-4 text-gray-300 text-sm">
          <span>By ${escapeHtml(article.author?.username || 'Anonymous')}</span>
          <span>•</span>
          <span>${new Date(article.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </a>
  `;
  container.classList.remove('hidden');
}

function createArticleCard(article, rom) {
  const card = document.createElement('div');
  card.className = 'bg-gray-800/40 backdrop-blur border border-gray-700 rounded-xl overflow-hidden hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)] transition-all duration-300 group flex flex-col h-full';
  
  const coverImage = extractCoverImage(article.content_html) || null;
  
  // Determine Badge Color
  const badgeColors = {
    'guides': 'bg-blue-600',
    'stories': 'bg-green-600',
    'general': 'bg-gray-600',
    'magazine': 'bg-purple-600'
  };
  const badgeColor = badgeColors[article.category_slug] || 'bg-gray-600';

  card.innerHTML = `
    <a href="#/article/${article.id}" class="flex flex-col h-full">
      ${coverImage ? `
        <div class="h-48 overflow-hidden relative">
          <img src="${coverImage}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="Cover">
          <div class="absolute top-2 right-2 ${badgeColor} text-white text-[10px] font-bold px-2 py-1 rounded shadow-md uppercase">
            ${article.category_slug}
          </div>
        </div>
      ` : `
        <div class="h-48 bg-gray-700 flex items-center justify-center relative">
          <span class="text-4xl opacity-20">📝</span>
          <div class="absolute top-2 right-2 ${badgeColor} text-white text-[10px] font-bold px-2 py-1 rounded shadow-md uppercase">
            ${article.category_slug}
          </div>
        </div>
      `}
      
      <div class="p-5 flex-1 flex flex-col">
        <h3 class="text-xl font-bold text-white mb-2 line-clamp-2 group-hover:text-purple-400 transition">${escapeHtml(article.title)}</h3>
        
        <div class="mt-auto pt-4 flex items-center justify-between border-t border-gray-700/50">
          <div class="flex items-center gap-2">
            <img src="${article.author?.avatar_url || 'https://ui-avatars.com/api/?name=User'}" class="w-6 h-6 rounded-full border border-gray-600" alt="Author">
            <span class="text-xs text-gray-400 truncate max-w-[100px]">${escapeHtml(article.author?.username || 'Unknown')}</span>
          </div>
          <span class="text-[10px] text-gray-500">${new Date(article.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </a>
  `;
  
  return card;
}

// Helper: Extract first <img> src from HTML string
function extractCoverImage(html) {
  if (!html) return null;
  const div = document.createElement('div');
  div.innerHTML = html;
  const img = div.querySelector('img');
  return img ? img.src : null;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
