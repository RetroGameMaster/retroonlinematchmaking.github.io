import { supabase, isAdmin } from '../../lib/supabase.js';

// ============================================================================
// MODULE INITIALIZATION
// ============================================================================

export async function initModule(container, params) {
  // FORCE TARGET: Always render directly into #app-content to bypass app.js passing issues
  const targetContainer = document.getElementById('app-content');
  
  if (!targetContainer) {
    console.error("❌ CRITICAL: #app-content not found in DOM!");
    return;
  }

  // Show loading state immediately
  targetContainer.innerHTML = `
    <div class="text-center p-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      <p class="text-cyan-400 mt-4 text-xl">Loading Profile...</p>
    </div>
  `;const updatePageSEO = (profile) => {
    document.title = `${profile.username}'s Profile | RetroOnlineMatchmaking`;
    
    // Update/Open Graph Meta Tags
    const setMeta = (name, content, property = false) => {
      let tag = document.querySelector(`meta[${property ? 'property' : 'name'}="${name}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(property ? 'property' : 'name', name);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    setMeta('description', `Check out ${profile.username}'s retro gaming profile, achievements, and currently playing games on ROM.`);
    setMeta('og:title', `${profile.username}'s Profile`);
    setMeta('og:description', `Retro gamer since ${new Date(profile.created_at).getFullYear()}. Playing: ${profile.favorite_console || 'Various'}.`);
    setMeta('og:image', profile.avatar_url || 'https://ui-avatars.com/api/?name=' + profile.username);
    setMeta('og:url', window.location.href);
    setMeta('og:type', 'profile');
    
    // JSON-LD Structured Data
    const scriptId = 'profile-schema';
    let script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Person",
      "name": profile.username,
      "url": window.location.href,
      "image": profile.avatar_url,
      "description": profile.bio || `Profile of ${profile.username} on RetroOnlineMatchmaking`,
      "knowsAbout": ["Retro Gaming", profile.favorite_console].filter(Boolean)
    });
  };

  try {
    // 1. Identify User (by Slug or ID)
    let targetUser = null;
    const slugOrId = params?.id || params?.slug; 
    
    if (!slugOrId) {
      // Default to current user if no param provided
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        targetContainer.innerHTML = '<div class="text-center p-10 text-red-400 text-xl">🔒 Please log in to view your profile.</div>';
        return;
      }
      targetUser = await fetchProfileByUserId(user.id);
    } else {
      // Try fetching by Slug/Username first
      targetUser = await fetchProfileBySlug(slugOrId);
      if (!targetUser) {
        // Fallback to ID if slug fails
        targetUser = await fetchProfileByUserId(slugOrId);
      }
    }

    if (!targetUser) {
      targetContainer.innerHTML = '<div class="text-center p-10 text-red-400 text-xl">❌ Profile not found.</div>';
      return;
    }

    // 2. Check Permissions & Status
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const isOwnProfile = currentUser && currentUser.id === targetUser.id;
    
    // FIX 1: DYNAMIC ADMIN CHECK
    const isTargetUserAdmin = !!targetUser.is_admin;
    // --- NEW: Trigger SEO and Data Loaders ---
    updatePageSEO(targetUser); // Apply SEO tags
    
    // Load new sections (Ensure these functions exist in your file)
    if (typeof loadCurrentlyPlayingList === 'function') loadCurrentlyPlayingList(targetUser);
    if (typeof loadSiteAwardsWall === 'function') loadSiteAwardsWall(targetUser.id);
    if (typeof loadProudAchievementsWall === 'function') loadProudAchievementsWall(targetUser.id, isOwnProfile);
    if (typeof loadGameAchievementsWall === 'function') loadGameAchievementsWall(targetUser.id, isOwnProfile);
    if (typeof loadMasteredGamesWall === 'function') loadMasteredGamesWall(targetUser.id);
    // 3. Render the Layout
    renderProfileLayout(targetContainer, targetUser, isOwnProfile, isTargetUserAdmin, currentUser);

    // 4. Attach Event Listeners (Now includes loaders for new walls)
    attachEventListeners(targetContainer, targetUser, isOwnProfile, currentUser);

  } catch (error) {
    console.error("💥 Error loading profile:", error);
    targetContainer.innerHTML = `
      <div class="text-center p-10 text-red-400">
        <h2 class="text-2xl font-bold mb-2">Error Loading Profile</h2>
        <p>${error.message}</p>
        <button onclick="window.location.reload()" class="mt-4 bg-cyan-600 text-white px-4 py-2 rounded">Refresh Page</button>
      </div>
    `;
  }
}

// ============================================================================
// DATA FETCHING HELPERS
// ============================================================================

async function fetchProfileBySlug(slug) {
  let cleanSlug;
  try {
    cleanSlug = decodeURIComponent(slug);
  } catch (e) {
    cleanSlug = slug;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('username', cleanSlug)
    .single();
    
  return error ? null : data;
}

async function fetchProfileByUserId(id) {
  const { data: targetUser, error } = await supabase
    .from('profiles')
    .select(`
      *,
      rank:user_ranks (
        id,
        name,
        color,
        description
      )
    `)
    .eq('id', id)
    .single();
    
  // FIX: Return targetUser, not data
  return error ? null : targetUser;
}

// --- fetchWallComments ---
async function fetchWallComments(profileId) {
  const { data: comments, error } = await supabase
    .from('profile_comments')
    .select('*')
    .eq('target_user_id', profileId)
    .order('created_at', { ascending: false });

  if (error || !comments) return [];

  const authorIds = [...new Set(comments.map(c => c.author_id))];
  if (authorIds.length === 0) return comments;

  const { data: authors } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', authorIds);

  const authorMap = new Map(authors?.map(a => [a.id, a]) || []);
  
  return comments.map(c => ({
    ...c,
    author: authorMap.get(c.author_id) || { username: 'Unknown', avatar_url: '' }
  }));
}

async function fetchFriends(userId) {
  const { data, error } = await supabase
    .from('friends')
    .select(`
      status,
      user_id,
      friend_id,
      friend_profile:profiles!friends_friend_id_fkey (
        id,
        username,
        avatar_url,
        is_online
      ),
      user_profile:profiles!friends_user_id_fkey (
        id,
        username,
        avatar_url,
        is_online
      )
    `)
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq('status', 'accepted');
  
  if (error) {
    console.error("Error fetching friends:", error);
    return [];
  }

  return data.map(item => {
    if (item.user_id === userId) {
      return item.friend_profile;
    } else {
      return item.user_profile;
    }
  }).filter(p => p !== null);
}

// FIX 2: Helper to check friendship status
async function checkFriendStatus(currentUserId, targetUserId) {
  if (!currentUserId) return null;

  const { data, error } = await supabase
    .from('friends')
    .select('*')
    .in('user_id', [currentUserId, targetUserId])
    .in('friend_id', [currentUserId, targetUserId]);

  if (error || !data || data.length === 0) return null;

  const relationship = data.find(row => 
    (row.user_id === currentUserId && row.friend_id === targetUserId) ||
    (row.user_id === targetUserId && row.friend_id === currentUserId)
  );

  return relationship || null;
}

// NEW: Fetch full game details for the "Currently Playing" list
async function fetchCurrentlyPlayingGames(gameIdentifiers) {
  if (!gameIdentifiers || gameIdentifiers.length === 0) return [];

  const games = [];
  const ids = [];
  const titles = [];

  gameIdentifiers.forEach(item => {
    if (typeof item === 'object' && item.id) {
      games.push(item); 
    } else if (typeof item === 'number' || (typeof item === 'string' && item.length > 20)) {
      ids.push(item);
    } else if (typeof item === 'string') {
      titles.push(item);
    } else if (typeof item === 'object' && item.title) {
      titles.push(item.title);
    }
  });

  if (ids.length > 0) {
    const { data: gamesById } = await supabase
      .from('games')
      .select('id, title, slug, cover_image_url, console')
      .in('id', ids);
    
    if (gamesById) games.push(...gamesById);
  }

  if (titles.length > 0) {
    for (const title of titles) {
      if (games.some(g => g.title.toLowerCase() === title.toLowerCase())) continue;

      const { data: gameByTitle } = await supabase
        .from('games')
        .select('id, title, slug, cover_image_url, console')
        .ilike('title', title)
        .single();
      
      if (gameByTitle) {
        games.push(gameByTitle);
      } else {
        games.push({
          id: null,
          title: title,
          slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          cover_image_url: null,
          console: 'Unknown'
        });
      }
    }
  }

  return games;
}

// ============================================================================
// NEW ACHIEVEMENT DATA FETCHERS
// ============================================================================

// Fetch Site Awards (Type = 'site')
async function fetchSiteAwards(userId) {
  const { data, error } = await supabase
    .from('user_achievements')
    .select(`
      unlocked_at,
      is_proud,
      achievements (
        id,
        title,
        description,
        badge_url,
        points,
        type
      )
    `)
    .eq('user_id', userId)
    .eq('achievements.type', 'site')
    .order('unlocked_at', { ascending: false });

  if (error) return [];
  // Safety filter: ensure achievement data exists
  return (data || []).filter(item => item.achievements);
}

// Fetch "Most Proud" Achievements (is_proud = true)
async function fetchProudAchievements(userId) {
  const { data, error } = await supabase
    .from('user_achievements')
    .select(`
      unlocked_at,
      is_proud,
      achievements (
        id,
        title,
        description,
        badge_url,
        points,
        game_id,
        games (title, slug)
      )
    `)
    .eq('user_id', userId)
    .eq('is_proud', true)
    .order('unlocked_at', { ascending: false });

  if (error) return [];
  // Safety filter: ensure achievement data exists
  return (data || []).filter(item => item.achievements);
}

// Fetch ALL Game Achievements (Type = 'game', regardless of proud status)
async function fetchGameAchievements(userId) {
  const { data, error } = await supabase
    .from('user_achievements')
    .select(`
      unlocked_at,
      is_proud,
      achievements (
        id,
        title,
        description,
        badge_url,
        points,
        game_id,
        games (title, slug)
      )
    `)
    .eq('user_id', userId)
    .eq('achievements.type', 'game')
    .order('unlocked_at', { ascending: false });

  if (error) return [];
  // Safety filter: ensure achievement data exists
  return (data || []).filter(item => item.achievements);
}

// Fetch Mastered Games (User has ALL achievements for a game)
async function fetchMasteredGames(userId) {
  // 1. Get all games that have achievements
  const { data: allGamesWithAchievements } = await supabase
    .from('achievements')
    .select('game_id, games(title, slug, cover_image_url, console)', { count: 'exact' })
    .not('game_id', 'is', null);

  if (!allGamesWithAchievements) return [];

  // Group by game_id to count total achievements per game
  const gameTotals = {};
  allGamesWithAchievements.forEach(a => {
    if (!gameTotals[a.game_id]) {
      gameTotals[a.game_id] = { 
        total: 0, 
        info: a.games 
      };
    }
    gameTotals[a.game_id].total++;
  });

  // 2. Get user's unlocked achievements
  const { data: userUnlocks } = await supabase
    .from('user_achievements')
    .select('achievement_id, achievements(game_id)')
    .eq('user_id', userId);

  if (!userUnlocks) return [];

  // Count unlocks per game for this user
  const userCounts = {};
  userUnlocks.forEach(u => {
    const gid = u.achievements?.game_id;
    if (gid) {
      userCounts[gid] = (userCounts[gid] || 0) + 1;
    }
  });

  // 3. Filter for mastered games (userCount == totalCount)
  const masteredIds = [];
  Object.keys(gameTotals).forEach(gid => {
    if (userCounts[gid] === gameTotals[gid].total) {
      masteredIds.push(gid);
    }
  });

  if (masteredIds.length === 0) return [];

  // 4. Fetch game details for mastered IDs
  const { data: masteredGames } = await supabase
    .from('games')
    .select('id, title, slug, cover_image_url, console')
    .in('id', masteredIds);

  return masteredGames || [];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getProfileLink(profile) {
  if (profile.username) return `#/profile/${profile.username}`;
  return `#/profile/${profile.id}`;
}

function getGameLink(game) {
  if (!game) return '#/games';
  if (game.slug) return `#/game/${game.slug}`;
  const slug = game.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `#/game/${slug}`;
}

// ============================================================================
// RENDERING LOGIC
// ============================================================================

function renderProfileLayout(container, profile, isOwnProfile, isTargetUserAdmin, currentUser) {
  // 1. CLEANUP: Remove any existing dynamic backgrounds from previous pages
  document.getElementById('dynamic-profile-bg')?.remove();
  document.getElementById('profile-bg-overlay')?.remove();

  // 2. INJECT FULL-SCREEN BACKGROUND (Like Game Detail Page)
  const bg = profile.custom_background;
  let bgValue = '#111827'; // Default
  let bgType = 'color';
  
  if (bg && bg.type) {
    bgType = bg.type;
    bgValue = bg.value;
  }

  const bgEl = document.createElement('div');
  bgEl.id = 'dynamic-profile-bg';
  
  // Apply styles based on type
  if (bgType === 'image') {
    bgEl.style.backgroundImage = `url('${bgValue}')`;
    bgEl.style.backgroundSize = 'cover';
    bgEl.style.backgroundPosition = 'center';
  } else if (bgType === 'gradient') {
    bgEl.style.backgroundImage = bgValue;
  } else {
    bgEl.style.backgroundColor = bgValue;
  }

  // Fixed positioning to cover entire viewport
  Object.assign(bgEl.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    zIndex: '-2',
    backgroundAttachment: 'fixed'
  });

  // Create Overlay for readability
  const overlayEl = document.createElement('div');
  overlayEl.id = 'profile-bg-overlay';
  Object.assign(overlayEl.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.45)', // Darker overlay for profiles
    zIndex: '-1',
    backdropFilter: 'blur(4px)', // Nice blur effect
    pointerEvents: 'none'
  });

  // Inject into DOM
  document.body.insertBefore(bgEl, document.body.firstChild);
  document.body.insertBefore(overlayEl, document.body.firstChild);

  // 3. Prepare Avatar Styles (Rest of original logic)
  const avatarStyle = profile.avatar_custom_css ? profile.avatar_custom_css : '';
  const avatarClass = profile.avatar_custom_css ? `ra-avatar custom-overlay` : 'ra-avatar';

  container.innerHTML = `
    <div class="ra-profile-wrapper">
      <div class="ra-header" style="position: relative; overflow: hidden; border-radius: 12px;">
  <!-- Gamercard Dynamic Background -->
  ${profile.gamercard_bg_type === 'image' && profile.gamercard_bg_value ? `
    <div style="position: absolute; inset: 0; background-image: url('${profile.gamercard_bg_value}'); background-size: cover; background-position: center; opacity: 0.25; z-index: 0; transition: transform 0.5s ease;" class="gamercard-bg-animate"></div>
  ` : ''}
  ${profile.gamercard_bg_type === 'gradient' && profile.gamercard_bg_value ? `
    <div style="position: absolute; inset: 0; background-image: ${profile.gamercard_bg_value}; opacity: 0.25; z-index: 0;"></div>
  ` : ''}
  ${profile.gamercard_bg_type === 'color' && profile.gamercard_bg_value ? `
    <div style="position: absolute; inset: 0; background-color: ${profile.gamercard_bg_value}; opacity: 0.15; z-index: 0;"></div>
  ` : ''}
  
  <div class="ra-header-overlay" style="position: relative; z-index: 1;"></div>
  <div class="ra-header-content" style="position: relative; z-index: 2;">
          <div class="ra-avatar-container" style="${avatarStyle}">
            <img src="${profile.avatar_url || 'https://ui-avatars.com/api/?name=' + profile.username}" 
                 alt="${profile.username}" 
                 class="${avatarClass}">
            <div class="ra-status-dot ${profile.is_online ? 'online' : 'offline'}"></div>
          </div>

         <div class="ra-info">
  <h1 class="ra-username">${profile.username}</h1>
  
  <!-- NEW: Rank Badge -->
  ${profile.rank ? `
    <span class="inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold border shadow-lg" 
          style="background-color: ${profile.rank.color}20; color: ${profile.rank.color}; border-color: ${profile.rank.color}">
      👑 ${profile.rank.name}
    </span>
  ` : ''}

  ${profile.display_name ? `<div class="ra-display-name">${profile.display_name}</div>` : ''}
  ${profile.motto ? `<p class="text-gray-400 text-sm italic mt-1">"${escapeHtml(profile.motto)}"</p>` : ''}
            
            <div class="ra-stats-row">
              <div class="ra-stat">
      <span class="ra-stat-icon">🎮</span>
      <span class="ra-stat-val">${profile.stats?.games_approved || 0}</span>
      <span class="ra-stat-label">Games</span>
    </div>
              <div class="ra-stat">
                <span class="ra-stat-icon">💬</span>
                <span class="ra-stat-val">${profile.stats?.comments_made || 0}</span>
                <span class="ra-stat-label">Comments</span>
              </div>
              <div class="ra-stat">
                <span class="ra-stat-icon">⭐</span>
                <span class="ra-stat-val">${profile.stats?.total_points || 0}</span>
                <span class="ra-stat-label">Points</span>
              </div>
            </div>
          </div>

          ${isOwnProfile ? `
            <button id="btn-edit-profile" class="ra-edit-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit
            </button>
          ` : ''}
        </div>
      </div>

      ${profile.signature_text ? `
        <div class="ra-signature-box" style="${profile.signature_custom_css || ''}">
          ${profile.signature_text}
        </div>
      ` : ''}

      <!-- NEW: SITE AWARDS WALL (Top Priority) -->
      <div class="ra-card mb-6 border-purple-500/50 bg-purple-900/10">
        <h3 class="text-xl font-bold text-purple-300 mb-4 flex items-center gap-2">
          🎖️ Site Awards & Badges
        </h3>
        <div id="site-awards-list" class="flex flex-wrap gap-4 min-h-[60px]">
          <div class="text-gray-500 text-sm italic">Loading awards...</div>
        </div>
      </div>

      <div class="ra-grid">
        <div class="ra-col-main">
          <div class="ra-card">
            <h3>About</h3>
            <p class="ra-bio">${profile.bio || 'No bio added yet.'}</p>
          </div>
          
          <!-- Currently Playing Section -->
          <div class="ra-card">
            <h3>🎮 What I'm Playing Currently</h3>
            <div id="currently-playing-container">
              <div id="currently-playing-list" class="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div class="col-span-full text-center text-gray-500 py-4">
                  <div class="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-cyan-500"></div>
                  <span class="ml-2 text-sm">Loading games...</span>
                </div>
              </div>
            </div>
          </div>

          <!-- NEW: MOST PROUD ACHIEVEMENTS WALL -->
          <div class="ra-card mt-6">
            <h3 class="text-xl font-bold text-yellow-400 mb-4 flex items-center gap-2">
              ⭐ Most Proud Achievements
            </h3>
            <div id="proud-achievements-list" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div class="col-span-full text-center text-gray-500 py-4">
                <div class="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-yellow-500"></div>
                <span class="ml-2 text-sm">Loading proud moments...</span>
              </div>
            </div>
          </div>

          <!-- NEW: ALL GAME ACHIEVEMENTS WALL -->
          <div class="ra-card mt-6">
            <h3 class="text-xl font-bold text-cyan-400 mb-4 flex items-center gap-2">
              🎮 Game Achievements
              <span id="game-achieve-count" class="text-sm font-normal text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full"></span>
            </h3>
            <div id="game-achievements-list" class="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-3">
              <div class="col-span-full text-center text-gray-500 py-4">
                <div class="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-cyan-500"></div>
                <span class="ml-2 text-sm">Loading achievements...</span>
              </div>
            </div>
          </div>

          <div class="ra-card mt-6">
            <h3>Shout Box / Wall</h3>
            <div id="wall-container">
              ${isOwnProfile || currentUser ? `
                <div class="wall-post-form">
                  <textarea id="new-wall-comment" placeholder="Say something on ${profile.username}'s wall..." class="ra-input"></textarea>
                  <button id="btn-post-wall" class="btn-primary mt-2">Post Shout</button>
                </div>
              ` : ''}
              <div id="wall-list" class="space-y-3 mt-4">
                <div class="text-center text-gray-500 py-4">Loading wall comments...</div>
              </div>
            </div>
          </div>
        </div>

        <div class="ra-col-side">
          <div class="ra-card">
            <h3>Friends</h3>
            <div id="friends-list" class="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              <div class="text-sm text-gray-500 py-2">Loading friends...</div>
            </div>
            
            ${!isOwnProfile ? `
              <div id="friend-action-container" class="mt-3">
                <div class="text-center text-gray-400 text-sm py-2">Checking status...</div>
              </div>
            ` : ''}
          </div>

          <!-- NEW: MASTERED GAMES WALL -->
          <div class="ra-card mt-6">
            <h3 class="text-xl font-bold text-green-400 mb-4 flex items-center gap-2">
              🏆 Mastered Games
            </h3>
            <div id="mastered-games-list" class="grid grid-cols-2 gap-3">
              <div class="col-span-full text-center text-gray-500 py-4">
                <div class="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-green-500"></div>
                <span class="ml-2 text-sm">Checking completion...</span>
              </div>
            </div>
          </div>

          <div class="ra-card mt-6">
            <h3>Profile Details</h3>
            <ul class="ra-details-list text-sm space-y-2">
  <li><strong>Member Since:</strong> ${new Date(profile.created_at).toLocaleDateString()}</li>
  <li><strong>Favorite Console:</strong> ${profile.favorite_console || 'None'}</li>
  
  ${profile.rank ? `
    <li>
      <strong>Current Rank:</strong> 
      <span class="inline-block px-2 py-0.5 rounded text-xs font-bold mt-1" 
            style="background:${profile.rank.color}20; color:${profile.rank.color}; border:1px solid ${profile.rank.color}">
        ${profile.rank.name}
      </span>
      <div class="text-xs text-gray-400 mt-1">${profile.xp_total || 0} XP Total</div>
    </li>
  ` : '<li><strong>Rank:</strong> NPC</li>'}
  
  ${isTargetUserAdmin ? '<li><strong>Role:</strong> <span class="text-red-400 font-bold">Admin</span></li>' : ''}
</ul>
          </div>
        </div>
      </div>

      ${isOwnProfile ? `
        <div id="edit-modal" class="ra-modal">
          <div class="ra-modal-content">
            <h2>Edit Profile Settings</h2>
            <form id="profile-form">
             <label>Username (Unique)</label>
  <div class="flex flex-col gap-1 mb-4">
    <input type="text" name="username" class="ra-input w-full" value="${profile.username || ''}" placeholder="Enter new username">
    <span class="text-xs text-yellow-500">⚠️ Changing this updates your profile URL and all chat history instantly.</span>
  </div>
  <label>Favorite Console</label>
<select name="favorite_console" class="ra-input w-full mb-4">
  <option value="">Select a system...</option>
  <option value="3D0 Interactive Multiplayer" ${profile.favorite_console === '3D0 Interactive Multiplayer' ? 'selected' : ''}>3D0 Interactive Multiplayer</option>
  <option value="Arcade" ${profile.favorite_console === 'Arcade' ? 'selected' : ''}>Arcade</option>
  <option value="Gameboy Color" ${profile.favorite_console === 'Gameboy Color' ? 'selected' : ''}>Gameboy Color</option>
  <option value="Gameboy Advance" ${profile.favorite_console === 'Gameboy Advance' ? 'selected' : ''}>Gameboy Advance</option>
  <option value="GameCube" ${profile.favorite_console === 'GameCube' ? 'selected' : ''}>GameCube</option>
  <option value="Nintendo Entertainment System" ${profile.favorite_console === 'Nintendo Entertainment System' ? 'selected' : ''}>Nintendo Entertainment System</option>
  <option value="Nintendo Gameboy" ${profile.favorite_console === 'Nintendo Gameboy' ? 'selected' : ''}>Nintendo Gameboy</option>
  <option value="Nintendo 64" ${profile.favorite_console === 'Nintendo 64' ? 'selected' : ''}>Nintendo 64</option>
  <option value="Nintendo DS" ${profile.favorite_console === 'Nintendo DS' ? 'selected' : ''}>Nintendo DS</option>
  <option value="Nintendo 3DS" ${profile.favorite_console === 'Nintendo 3DS' ? 'selected' : ''}>Nintendo 3DS</option>
  <option value="Nintendo Virtual Boy" ${profile.favorite_console === 'Nintendo Virtual Boy' ? 'selected' : ''}>Nintendo Virtual Boy</option>
  <option value="PC" ${profile.favorite_console === 'PC' ? 'selected' : ''}>PC</option>
  <option value="PlayStation 1" ${profile.favorite_console === 'PlayStation 1' ? 'selected' : ''}>PlayStation 1</option>
  <option value="PlayStation 2" ${profile.favorite_console === 'PlayStation 2' ? 'selected' : ''}>PlayStation 2</option>
  <option value="PlayStation 3" ${profile.favorite_console === 'PlayStation 3' ? 'selected' : ''}>PlayStation 3</option>
  <option value="PlayStation 4" ${profile.favorite_console === 'PlayStation 4' ? 'selected' : ''}>PlayStation 4</option>
  <option value="PlayStation 5" ${profile.favorite_console === 'PlayStation 5' ? 'selected' : ''}>PlayStation 5</option>
  <option value="Playstation Portable" ${profile.favorite_console === 'Playstation Portable' ? 'selected' : ''}>Playstation Portable</option>
  <option value="PlayStation Vita" ${profile.favorite_console === 'PlayStation Vita' ? 'selected' : ''}>PlayStation Vita</option>
  <option value="Neo Geo AES" ${profile.favorite_console === 'Neo Geo AES' ? 'selected' : ''}>Neo Geo AES</option>
  <option value="Neo Geo CD" ${profile.favorite_console === 'Neo Geo CD' ? 'selected' : ''}>Neo Geo CD</option>
  <option value="Sega SG-1000" ${profile.favorite_console === 'Sega SG-1000' ? 'selected' : ''}>Sega SG-1000</option>
  <option value="Sega Mark III" ${profile.favorite_console === 'Sega Mark III' ? 'selected' : ''}>Sega Mark III</option>
  <option value="Sega Genesis/MD" ${profile.favorite_console === 'Sega Genesis/MD' ? 'selected' : ''}>Sega Genesis/MD</option>
  <option value="Sega 32X" ${profile.favorite_console === 'Sega 32X' ? 'selected' : ''}>Sega 32X</option>
  <option value="Sega CD" ${profile.favorite_console === 'Sega CD' ? 'selected' : ''}>Sega CD</option>
  <option value="Sega Gamegear" ${profile.favorite_console === 'Sega Gamegear' ? 'selected' : ''}>Sega Gamegear</option>
  <option value="Sega Saturn" ${profile.favorite_console === 'Sega Saturn' ? 'selected' : ''}>Sega Saturn</option>
  <option value="Sega Dreamcast" ${profile.favorite_console === 'Sega Dreamcast' ? 'selected' : ''}>Sega Dreamcast</option>
  <option value="Super Nintendo Entertainment System" ${profile.favorite_console === 'Super Nintendo Entertainment System' ? 'selected' : ''}>Super Nintendo Entertainment System</option>
  <option value="Nintendo Switch" ${profile.favorite_console === 'Nintendo Switch' ? 'selected' : ''}>Nintendo Switch</option>
  <option value="TurboGrafx16/CD" ${profile.favorite_console === 'TurboGrafx16/CD' ? 'selected' : ''}>TurboGrafx16/CD</option>
  <option value="Wii" ${profile.favorite_console === 'Wii' ? 'selected' : ''}>Wii</option>
  <option value="Wii U" ${profile.favorite_console === 'Wii U' ? 'selected' : ''}>Wii U</option>
  <option value="Xbox" ${profile.favorite_console === 'Xbox' ? 'selected' : ''}>Xbox</option>
  <option value="Xbox 360" ${profile.favorite_console === 'Xbox 360' ? 'selected' : ''}>Xbox 360</option>
  <option value="Other" ${profile.favorite_console === 'Other' ? 'selected' : ''}>Other</option>
</select>
<hr class="border-gray-700 my-4">
<h3 class="text-cyan-400 font-bold mb-2">🎮 Gamercard Settings</h3>

<label>Gamer Motto / Signature</label>
<input type="text" name="motto" class="ra-input w-full mb-4" value="${profile.motto || ''}" placeholder="Enter a short motto..." maxlength="100">

<label>Gamercard Background Type</label>
<select name="gc_bg_type" id="gc_bg_type" class="ra-input w-full mb-4">
  <option value="color" ${profile.gamercard_bg_type === 'color' ? 'selected' : ''}>Solid Color</option>
  <option value="image" ${profile.gamercard_bg_type === 'image' ? 'selected' : ''}>Uploaded Image / GIF</option>
  <option value="gradient" ${profile.gamercard_bg_type === 'gradient' ? 'selected' : ''}>Gradient</option>
</select>

<div id="gc-upload-container" style="display: ${profile.gamercard_bg_type === 'image' ? 'block' : 'none'};" class="mb-4">
  <label class="block text-sm text-cyan-400 mb-1">Upload Gamercard Background</label>
  <input type="file" id="gc_file_input" accept="image/*" class="ra-input">
</div>

<label class="block mb-4">Background Value (Color Hex, Gradient CSS, or URL)</label>
<input type="text" name="gc_bg_value" id="gc_bg_value" class="ra-input w-full" value="${profile.gamercard_bg_value || '#1f2937'}">
              <label>Bio</label>
              <textarea name="bio" class="ra-input" rows="3">${profile.bio || ''}</textarea>

              <hr class="border-gray-700 my-4">
              <label>Signature Content (HTML Allowed)</label>
              <textarea name="signature_text" class="ra-input" rows="3">${profile.signature_text || ''}</textarea>
              
              <label>Signature Custom CSS</label>
              <textarea name="signature_custom_css" class="ra-input font-mono text-xs" rows="4">${profile.signature_custom_css || ''}</textarea>

              <hr class="border-gray-700 my-4">
              <label>Avatar Overlay Custom CSS</label>
              <textarea name="avatar_custom_css" class="ra-input font-mono text-xs" rows="4">${profile.avatar_custom_css || ''}</textarea>

              <hr class="border-gray-700 my-4">
              <label>Update Profile Picture</label>
              <input type="file" id="avatar_file_input" accept="image/*" class="ra-input">
              <div class="mt-2">
                <img src="${profile.avatar_url || 'https://ui-avatars.com/api/?name=' + profile.username}" class="w-16 h-16 rounded-full border border-gray-600" alt="Current Avatar">
              </div>

              <hr class="border-gray-700 my-4">
              <label>Background Type</label>
              <select name="bg_type" id="bg_type" class="ra-input">
                <option value="color" ${profile.custom_background?.type === 'color' ? 'selected' : ''}>Solid Color</option>
                <option value="image" ${profile.custom_background?.type === 'image' ? 'selected' : ''}>Uploaded Image / GIF</option>
                <option value="gradient" ${profile.custom_background?.type === 'gradient' ? 'selected' : ''}>Gradient</option>
              </select>

              <div id="bg-upload-container" style="display: ${profile.custom_background?.type === 'image' ? 'block' : 'none'}; margin-top: 15px;">
                <label class="block text-sm font-bold text-cyan-400 mb-1">Upload New Background</label>
                <input type="file" id="bg_file_input" accept="image/*" class="ra-input">
              </div>

              <label class="block mt-4">Background Value</label>
              <input type="text" name="bg_value" id="bg_value_input" class="ra-input" value="${profile.custom_background?.value || '#1f2937'}">

              <div class="modal-actions">
                <button type="button" id="btn-cancel-edit" class="bg-gray-600 text-white px-4 py-2 rounded">Cancel</button>
                <button type="submit" class="btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function getBackgroundCSS(bg) {
  if (!bg || !bg.type) return 'background-color: #111827;';
  const { type, value } = bg;
  if (type === 'image') return `background-image: url('${value}'); background-size: cover; background-position: center; background-attachment: fixed;`;
  if (type === 'gradient') return `background-image: ${value}; background-attachment: fixed;`;
  return `background-color: ${value};`;
}

// ============================================================================
// EVENT LISTENERS & INTERACTIVITY
// ============================================================================

function attachEventListeners(container, profile, isOwnProfile, currentUser) {
  // --- 1. Edit Modal Logic ---
  const editBtn = document.getElementById('btn-edit-profile');
  const modal = document.getElementById('edit-modal');
  const cancelBtn = document.getElementById('btn-cancel-edit');
  const form = document.getElementById('profile-form');
  const bgTypeSelect = document.getElementById('bg_type');
  const bgUploadContainer = document.getElementById('bg-upload-container');

  if (editBtn && modal) editBtn.addEventListener('click', () => modal.style.display = 'flex');
  if (cancelBtn && modal) cancelBtn.addEventListener('click', () => modal.style.display = 'none');

  if (bgTypeSelect && bgUploadContainer) {
    bgTypeSelect.addEventListener('change', (e) => {
      bgUploadContainer.style.display = e.target.value === 'image' ? 'block' : 'none';
    });
  }
  const gcTypeSelect = document.getElementById('gc_bg_type');
const gcUploadContainer = document.getElementById('gc-upload-container');
if (gcTypeSelect && gcUploadContainer) {
  gcTypeSelect.addEventListener('change', (e) => {
    gcUploadContainer.style.display = e.target.value === 'image' ? 'block' : 'none';
  });
}

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      let finalBgValue = formData.get('bg_value');
      const bgType = formData.get('bg_type');
      let finalAvatarUrl = profile.avatar_url;

      // 1. Handle Avatar Upload
      const avatarInput = document.getElementById('avatar_file_input');
      if (avatarInput && avatarInput.files.length > 0) {
        const file = avatarInput.files[0];
        const fileName = `${profile.id}/avatar_${Date.now()}_${file.name.replace(/\s/g, '_')}`;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Uploading Avatar...';
        submitBtn.disabled = true;

        try {
          const { error } = await supabase.storage.from('user-backgrounds').upload(fileName, file, { cacheControl: '3600', upsert: true });
          if (error) throw error;
          const { data: { publicUrl } } = supabase.storage.from('user-backgrounds').getPublicUrl(fileName);
          finalAvatarUrl = publicUrl;
        } catch (err) {
          alert('Avatar upload failed: ' + err.message);
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          return;
        }
      }

      // 2. Handle Background Upload
      const fileInput = document.getElementById('bg_file_input');
      if (bgType === 'image' && fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileName = `${profile.id}/${Date.now()}_${file.name.replace(/\s/g, '_')}`;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Uploading Background...';
        submitBtn.disabled = true;

        try {
          const { error } = await supabase.storage.from('user-backgrounds').upload(fileName, file, { cacheControl: '3600', upsert: true });
          if (error) throw error;
          const { data: { publicUrl } } = supabase.storage.from('user-backgrounds').getPublicUrl(fileName);
          finalBgValue = publicUrl;
        } catch (err) {
          alert('Background upload failed: ' + err.message);
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          return;
        }
      }

      // 3. Prepare Updates Object (INCLUDING USERNAME)
      let finalGcBgValue = formData.get('gc_bg_value');
const gcFileType = formData.get('gc_bg_type');

const gcFileInput = document.getElementById('gc_file_input');
if (gcFileType === 'image' && gcFileInput && gcFileInput.files.length > 0) {
   const file = gcFileInput.files[0];
   const fileName = `${profile.id}/gc_bg_${Date.now()}_${file.name.replace(/\s/g, '_')}`;
   // Reuse storage bucket 'user-backgrounds'
   const { error } = await supabase.storage.from('user-backgrounds').upload(fileName, file, { cacheControl: '3600', upsert: true });
   if (!error) {
     const { data: { publicUrl } } = supabase.storage.from('user-backgrounds').getPublicUrl(fileName);
     finalGcBgValue = publicUrl;
   }
}

const updates = {
  bio: formData.get('bio'),
  signature_text: formData.get('signature_text'),
  signature_custom_css: formData.get('signature_custom_css'),
  avatar_custom_css: formData.get('avatar_custom_css'),
  avatar_url: finalAvatarUrl,
  username: formData.get('username')?.trim(), 
  favorite_console: formData.get('favorite_console'),
  motto: formData.get('motto'),
  gamercard_bg_type: formData.get('gc_bg_type'),
  gamercard_bg_value: formData.get('gc_bg_value'), // Temporary value, overwritten below if file exists
  custom_background: { type: bgType, value: finalBgValue, opacity: 1, position: 'center', size: 'cover' }
};

// Handle Gamercard Background File Upload
if (formData.get('gc_bg_type') === 'image') {
  const gcFileInput = document.getElementById('gc_file_input');
  if (gcFileInput && gcFileInput.files.length > 0) {
    const file = gcFileInput.files[0];
    const fileName = `${profile.id}/gc_bg_${Date.now()}_${file.name.replace(/\s/g, '_')}`;
    
    try {
      const { error } = await supabase.storage.from('user-backgrounds').upload(fileName, file, { cacheControl: '3600', upsert: true });
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage.from('user-backgrounds').getPublicUrl(fileName);
      updates.gamercard_bg_value = publicUrl; // Overwrite temporary value
    } catch (err) {
      alert('Gamercard BG upload failed: ' + err.message);
      submitBtn.textContent = 'Save Changes';
      submitBtn.disabled = false;
      return;
    }
  }
}
      // 4. Send to Database
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.textContent = 'Saving...';
      submitBtn.disabled = true;

      try {
        const { error } = await supabase.from('profiles').update(updates).eq('id', profile.id);
        
        if (error) {
          if (error.code === '23505') {
            throw new Error('That username is already taken! Please choose another.');
          }
          throw error;
        }

        alert('✅ Profile updated successfully! Refreshing to show changes...');
        
        // Close Modal
        document.getElementById('edit-modal').style.display = 'none';
        
        // FORCE RELOAD: This fetches the fresh data from DB and re-renders the whole page
        // We use a small timeout to allow the alert to dismiss first
        setTimeout(() => {
            window.location.reload();
        }, 500);
      } catch (err) {
        console.error('Update error:', err);
        alert('❌ Error: ' + err.message);
        submitBtn.textContent = 'Save Changes';
        submitBtn.disabled = false;
      }
    });
  }

  // --- 2. Load Wall Comments ---
  loadWallComments(profile.id);

  // --- 3. Post Wall Comment ---
  const postBtn = document.getElementById('btn-post-wall');
  if (postBtn) {
    postBtn.addEventListener('click', async () => {
      const input = document.getElementById('new-wall-comment');
      const content = input.value.trim();
      
      if (!content) return alert("Please type a message first.");
      if (!currentUser) return alert("You must be logged in.");

      // Disable button to prevent double posts
      postBtn.disabled = true;
      postBtn.textContent = 'Posting...';

      try {
        // 1. Explicitly fetch Target Username (The Profile Owner)
        // We do this again to ensure we have it, even if 'profile' var is stale
        const { data: targetData, error: targetErr } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', profile.id)
          .single();

        if (targetErr || !targetData) throw new Error("Could not find profile owner.");
        const targetUsername = targetData.username;

        // 2. Explicitly fetch Author Username (The Person Posting)
        const { data: authorData, error: authorErr } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', currentUser.id)
          .single();

        const authorUsername = authorData?.username || currentUser.email.split('@')[0];

        // 3. Insert with ALL required fields
        const { error: insertErr } = await supabase.from('profile_comments').insert({
          target_user_id: profile.id,
          target_username: targetUsername,      
          author_id: currentUser.id,
          author_username: authorUsername,      
          content: content
        });

        if (insertErr) throw insertErr;

        // Success
        input.value = '';
        loadWallComments(profile.id);

      } catch (err) {
        console.error("Wall Post Failed:", err);
        alert('Failed to post: ' + err.message);
      } finally {
        // Re-enable button
        postBtn.disabled = false;
        postBtn.textContent = 'Post Shout';
      }
    });
  }

  // --- 4. Load Friends List ---
  loadFriends(profile.id);
  // --- 4.5. Direct Message Button Logic ---
  if (!isOwnProfile && currentUser) {
    const dmContainer = document.getElementById('dm-action-container');
    
    // If the container doesn't exist in HTML yet, create it dynamically above the friend button
    // Or better, let's inject it right before the friend-action-container in the DOM
    const friendContainer = document.getElementById('friend-action-container');
    
    if (friendContainer && !document.getElementById('btn-send-dm')) {
      const dmBtn = document.createElement('button');
      dmBtn.id = 'btn-send-dm';
      dmBtn.className = 'w-full bg-cyan-700 hover:bg-cyan-600 text-white py-2 rounded text-sm font-bold transition-colors mb-2 flex items-center justify-center gap-2 shadow-lg';
      dmBtn.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
        </svg>
        Send Message
      `;
      
      dmBtn.addEventListener('click', () => {
        window.location.hash = `#/messages?user=${profile.id}`;
      });

      // Insert before the friend button
      friendContainer.parentNode.insertBefore(dmBtn, friendContainer);
    }
  }
  // --- 5. Smart Friend Button Logic ---
  if (!isOwnProfile && currentUser) {
    loadFriendButtonState(profile.id, currentUser.id);
  }

  // --- 6. Load Currently Playing Games ---
  loadCurrentlyPlayingList(profile);

  // --- NEW: Load Achievement Walls ---
  loadSiteAwardsWall(profile.id);
  loadProudAchievementsWall(profile.id, isOwnProfile); 
  loadGameAchievementsWall(profile.id, isOwnProfile); // NEW: Load All Game Achievements
  loadMasteredGamesWall(profile.id);

  // --- 7. Remove Game Listener ---
  const listContainer = document.getElementById('currently-playing-list');
  if (listContainer && isOwnProfile) {
    listContainer.addEventListener('click', async (e) => {
      const btn = e.target.closest('.remove-game-btn');
      if (!btn) return;
      
      e.stopPropagation();
      e.preventDefault();
      
      const gameId = btn.getAttribute('data-id');
      if (!confirm('Remove this game from your list?')) return;

      let currentGames = [];
      if (profile.currently_playing) {
        try {
          currentGames = typeof profile.currently_playing === 'string' 
            ? JSON.parse(profile.currently_playing) 
            : profile.currently_playing;
        } catch (e) { currentGames = []; }
      }

      const updatedGames = currentGames.filter(item => {
        if (typeof item === 'object' && item.id) {
          return item.id != gameId;
        }
        return item != gameId;
      });

      const { error } = await supabase.from('profiles').update({ currently_playing: updatedGames }).eq('id', profile.id);
      if (error) alert('Error: ' + error.message);
      else location.reload();
    });
  }
}

// ============================================================================
// NEW RENDERING FUNCTIONS FOR ACHIEVEMENT WALLS
// ============================================================================

async function loadSiteAwardsWall(userId) {
  const listEl = document.getElementById('site-awards-list');
  if (!listEl) return;

  const awards = await fetchSiteAwards(userId);

  if (!awards || awards.length === 0) {
    listEl.innerHTML = '<div class="text-gray-500 text-sm italic">No site awards yet.</div>';
    return;
  }

  listEl.innerHTML = awards.map(item => {
    const a = item.achievements;
    // Safety check for badge_url
    const badgeSrc = a.badge_url || 'https://via.placeholder.com/64?text=Award';
    
    return `
      <div class="group relative flex flex-col items-center text-center w-24">
        <div class="relative">
          <img src="${badgeSrc}" 
               alt="${a.title}" 
               class="w-16 h-16 object-contain drop-shadow-lg group-hover:scale-110 transition-transform">
          <div class="absolute -bottom-2 -right-2 bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-gray-900">
            ${a.points}
          </div>
        </div>
        <div class="mt-2">
          <h4 class="text-xs font-bold text-purple-300 line-clamp-2 leading-tight" title="${a.title}">${a.title}</h4>
          <p class="text-[10px] text-gray-500 mt-0.5">${new Date(item.unlocked_at).toLocaleDateString()}</p>
        </div>
      </div>
    `;
  }).join('');
}

async function loadProudAchievementsWall(userId, isOwnProfile) {
  const listEl = document.getElementById('proud-achievements-list');
  if (!listEl) return;

  const items = await fetchProudAchievements(userId);

  if (!items || items.length === 0) {
    listEl.innerHTML = '<div class="col-span-full text-center text-gray-500 italic py-4">No proud achievements selected yet.</div>';
    return;
  }

  listEl.innerHTML = items.map(item => {
    const a = item.achievements;
    const game = a.games;
    const gameLink = game ? getGameLink(game) : '#/games';
    // Safety check for badge_url
    const badgeSrc = a.badge_url || 'https://via.placeholder.com/64?text=Trophy';
    
    return `
      <div class="group relative bg-gray-800/50 border border-yellow-500/30 rounded-lg p-2 hover:border-yellow-400 transition-colors flex flex-col items-center text-center">
        <img src="${badgeSrc}" 
             alt="${a.title}" 
             class="w-12 h-12 object-contain mb-2 group-hover:scale-110 transition-transform">
        
        <h4 class="text-xs font-bold text-yellow-100 line-clamp-2 leading-tight mb-1" title="${a.title}">${a.title}</h4>
        
        ${game ? `
          <a href="${gameLink}" class="text-[10px] text-cyan-400 hover:underline truncate w-full block">
            ${game.title}
          </a>
        ` : ''}
        
        <div class="mt-1 flex items-center gap-1">
          <span class="text-[10px] text-yellow-500 font-bold">⭐</span>
          <span class="text-[10px] text-gray-400">${a.points} pts</span>
        </div>

        ${isOwnProfile ? `
          <button class="mt-2 text-[10px] text-red-400 hover:text-red-300 underline remove-proud-btn" data-achieve-id="${a.id}">
            Remove from Proud
          </button>
        ` : ''}
      </div>
    `;
  }).join('');

  // Attach listeners for "Remove Proud" if own profile
  if (isOwnProfile) {
    listEl.querySelectorAll('.remove-proud-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const achieveId = btn.getAttribute('data-achieve-id');
        if (!confirm('Remove this from your Most Proud list?')) return;

        const { error } = await supabase
          .from('user_achievements')
          .update({ is_proud: false })
          .eq('user_id', userId)
          .eq('achievement_id', achieveId);

        if (error) alert('Error: ' + error.message);
        else {
          loadProudAchievementsWall(userId, true); // Reload Proud Wall
          loadGameAchievementsWall(userId, true);  // Reload Main Wall to update star
        }
      });
    });
  }
}

// NEW: Load All Game Achievements Wall
async function loadGameAchievementsWall(userId, isOwnProfile) {
  const listEl = document.getElementById('game-achievements-list');
  const countEl = document.getElementById('game-achieve-count');
  if (!listEl) return;

  const items = await fetchGameAchievements(userId);

  if (!items || items.length === 0) {
    listEl.innerHTML = '<div class="col-span-full text-center text-gray-500 italic py-4">No game achievements unlocked yet.</div>';
    if (countEl) countEl.textContent = '';
    return;
  }

  if (countEl) countEl.textContent = `${items.length}`;

  listEl.innerHTML = items.map((item) => {
    const a = item.achievements;
    const game = a.games;
    const gameLink = game ? getGameLink(game) : '#/games';
    
    // Safety check for badge_url
    const badgeSrc = a.badge_url || 'https://via.placeholder.com/64?text=Trophy';
    
    // Only show toggle if own profile
    const toggleBtn = isOwnProfile ? `
      <button class="absolute top-1 right-1 p-1 rounded-full bg-gray-900/80 hover:bg-yellow-600 transition-colors z-10" 
              onclick="window.toggleProudStatus(event, '${a.id}', ${item.is_proud})" 
              title="${item.is_proud ? 'Remove from Most Proud' : 'Mark as Most Proud'}">
        <span class="text-xs ${item.is_proud ? 'text-yellow-400' : 'text-gray-400'}">
          ${item.is_proud ? '⭐' : '☆'}
        </span>
      </button>
    ` : '';

    return `
      <div class="group relative bg-gray-800/50 border border-gray-700 rounded-lg p-2 hover:border-cyan-500/50 transition-colors flex flex-col items-center text-center">
        ${toggleBtn}
        
        <img src="${badgeSrc}" 
             alt="${a.title}" 
             class="w-10 h-10 object-contain mb-1 group-hover:scale-110 transition-transform">
        
        <h4 class="text-[10px] font-bold text-gray-300 line-clamp-2 leading-tight mb-1" title="${a.title}">${a.title}</h4>
        
        ${game ? `
          <a href="${gameLink}" class="text-[9px] text-cyan-500 hover:underline truncate w-full block">
            ${game.title}
          </a>
        ` : ''}
        
        <div class="mt-0.5 flex items-center gap-1">
          <span class="text-[9px] text-yellow-500 font-bold">${a.points}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Global Helper to Toggle "Most Proud" Status
window.toggleProudStatus = async function(e, achievementId, currentStatus) {
  e.stopPropagation();
  e.preventDefault();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return alert('Please log in.');

  const newStatus = !currentStatus;
  
  try {
    const { error } = await supabase
      .from('user_achievements')
      .update({ is_proud: newStatus })
      .eq('achievement_id', achievementId)
      .eq('user_id', user.id);

    if (error) throw error;

    // Refresh the walls immediately
    loadProudAchievementsWall(user.id, true);
    loadGameAchievementsWall(user.id, true);
    
  } catch (err) {
    alert('Error updating status: ' + err.message);
  }
};

async function loadMasteredGamesWall(userId) {
  const listEl = document.getElementById('mastered-games-list');
  if (!listEl) return;

  const games = await fetchMasteredGames(userId);

  if (!games || games.length === 0) {
    listEl.innerHTML = '<div class="col-span-full text-center text-gray-500 italic py-4">No mastered games yet.</div>';
    return;
  }

  listEl.innerHTML = games.map(game => {
    const link = getGameLink(game);
    const cover = game.cover_image_url || 'https://via.placeholder.com/150x200?text=No+Cover';
    
    return `
      <a href="${link}" class="group relative block aspect-[3/4] rounded-lg overflow-hidden border border-green-500/50 hover:border-green-400 transition-all">
        <img src="${cover}" alt="${game.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
        <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-2">
          <h4 class="text-xs font-bold text-white line-clamp-2 leading-tight mb-1">${game.title}</h4>
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-green-400 font-bold">100%</span>
            <span class="text-[10px] text-gray-300">${game.console || 'Unknown'}</span>
          </div>
        </div>
        <!-- Mastered Icon Overlay -->
        <div class="absolute top-1 right-1 bg-green-600 text-white p-1 rounded-full shadow-lg">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
      </a>
    `;
  }).join('');
}

// ============================================================================
// EXISTING HELPER FUNCTIONS (Unchanged)
// ============================================================================

async function loadCurrentlyPlayingList(profile) {
  const listEl = document.getElementById('currently-playing-list');
  if (!listEl) return;

  let rawGames = [];
  if (profile.currently_playing) {
    try {
      rawGames = typeof profile.currently_playing === 'string' 
        ? JSON.parse(profile.currently_playing) 
        : profile.currently_playing;
    } catch (e) { rawGames = []; }
  }

  if (rawGames.length === 0) {
    listEl.innerHTML = '<div class="col-span-full text-gray-500 italic text-center py-4">No games listed yet. Visit a game page to add one!</div>';
    return;
  }

  const games = await fetchCurrentlyPlayingGames(rawGames);
  const isOwnProfile = document.getElementById('btn-edit-profile') !== null;

  if (games.length === 0) {
    listEl.innerHTML = '<div class="col-span-full text-gray-500 italic text-center py-4">No games found.</div>';
    return;
  }

  listEl.innerHTML = games.map(game => {
    const link = getGameLink(game);
    const cover = game.cover_image_url || 'https://via.placeholder.com/150x200/1f2937/6b7280?text=No+Cover';
    const title = game.title || 'Unknown Game';
    const consoleName = game.console || '';
    const removeRef = game.id || title;

    return `
      <div class="group relative bg-gray-800/80 backdrop-blur-sm border border-gray-600 rounded-lg overflow-hidden hover:border-cyan-500 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/20 flex flex-col h-full">
        <a href="${link}" class="block flex-1">
          <div class="aspect-[3/4] w-full overflow-hidden bg-gray-900">
            <img src="${cover}" alt="${title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
          </div>
          <div class="p-3">
            <h4 class="text-sm font-bold text-gray-100 line-clamp-2 leading-tight mb-1" title="${title}">${title}</h4>
            ${consoleName ? `<p class="text-xs text-cyan-400 truncate">${consoleName}</p>` : ''}
          </div>
        </a>
        ${isOwnProfile ? `
          <button class="remove-game-btn absolute top-2 right-2 bg-red-600/90 hover:bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" 
                  data-id="${removeRef}" title="Remove from list">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        ` : ''}
      </div>
    `;
  }).join('');
}

async function loadFriendButtonState(targetUserId, currentUserId) {
  const container = document.getElementById('friend-action-container');
  if (!container) return;

  const relationship = await checkFriendStatus(currentUserId, targetUserId);
  
  if (!relationship) {
    container.innerHTML = `
      <button id="btn-add-friend" class="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-sm transition-colors">Add Friend</button>
    `;
    document.getElementById('btn-add-friend').addEventListener('click', async () => {
      if(!confirm('Send friend request?')) return;
      const { error } = await supabase.from('friends').insert({
        user_id: currentUserId, friend_id: targetUserId, status: 'pending'
      });
      if (error) alert('Error: ' + error.message);
      else {
        alert('Request sent!');
        loadFriendButtonState(targetUserId, currentUserId);
      }
    });
  } else if (relationship.status === 'pending') {
    if (relationship.user_id === currentUserId) {
      container.innerHTML = `<button disabled class="w-full bg-gray-800 text-gray-400 py-2 rounded text-sm cursor-not-allowed">Request Sent</button>`;
    } else {
      container.innerHTML = `
        <div class="flex gap-2">
          <button id="btn-accept-friend" class="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 rounded text-sm">Accept</button>
          <button id="btn-decline-friend" class="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded text-sm">Decline</button>
        </div>
      `;
      document.getElementById('btn-accept-friend').addEventListener('click', async () => {
        await supabase.from('friends').update({ status: 'accepted' }).eq('id', relationship.id);
        alert('Friend added!');
        loadFriendButtonState(targetUserId, currentUserId);
      });
      document.getElementById('btn-decline-friend').addEventListener('click', async () => {
        await supabase.from('friends').delete().eq('id', relationship.id);
        alert('Request declined.');
        loadFriendButtonState(targetUserId, currentUserId);
      });
    }
  } else if (relationship.status === 'accepted') {
    container.innerHTML = `<button disabled class="w-full bg-green-900/50 border border-green-700 text-green-400 py-2 rounded text-sm cursor-default">✓ Friends</button>`;
  }
}

async function loadWallComments(profileId) {
  const list = document.getElementById('wall-list');
  if (!list) return;
  const comments = await fetchWallComments(profileId);
  if (comments.length === 0) {
    list.innerHTML = '<div class="text-sm text-gray-500 italic py-4 text-center">No shouts yet.</div>';
    return;
  }
  list.innerHTML = comments.map(c => {
    const link = c.author ? getProfileLink(c.author) : '#/home';
    const displayName = c.author?.username || 'Unknown';
    const avatarSrc = c.author?.avatar_url || `https://ui-avatars.com/api/?name=${displayName}`;
    return `
    <div class="bg-gray-800/50 p-3 rounded border border-gray-700 flex gap-3 hover:bg-gray-800 transition-colors">
      <img src="${avatarSrc}" class="w-8 h-8 rounded-full bg-gray-600 object-cover">
      <div class="flex-1">
        <div class="flex items-baseline gap-2">
          <span class="font-bold text-cyan-400 text-sm hover:underline cursor-pointer" onclick="window.location.hash='${link}'">${displayName}</span>
          <span class="text-xs text-gray-500">${new Date(c.created_at).toLocaleDateString()}</span>
        </div>
        <p class="text-gray-300 text-sm mt-1 break-words">${c.content}</p>
      </div>
    </div>`;
  }).join('');
}

async function loadFriends(userId) {
  const list = document.getElementById('friends-list');
  if (!list) return;
  const friends = await fetchFriends(userId);
  if (friends.length === 0) {
    list.innerHTML = '<div class="text-sm text-gray-500 italic py-2 text-center">No friends yet.</div>';
    return;
  }
  list.innerHTML = friends.map(f => {
    const link = getProfileLink(f);
    const displayName = f.username || 'Unknown';
    const avatarSrc = f.avatar_url || `https://ui-avatars.com/api/?name=${displayName}`;
    return `
    <div class="flex items-center gap-2 p-2 hover:bg-gray-800 rounded cursor-pointer transition-colors" onclick="window.location.hash='${link}'">
      <div class="relative">
        <img src="${avatarSrc}" class="w-6 h-6 rounded-full object-cover">
        <div class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-gray-900 ${f.is_online ? 'bg-green-500' : 'bg-gray-500'}"></div>
      </div>
      <span class="text-sm text-gray-300 truncate flex-1">${displayName}</span>
    </div>`;
  }).join('');
}
// ============================================================================
// CLEANUP ON NAVIGATION
// ============================================================================
// Remove dynamic background when leaving the profile module
const observer = new MutationObserver(() => {
  const hash = window.location.hash;
  // If hash changes to anything other than a profile, remove bg
  if (!hash.startsWith('#/profile/')) {
    document.getElementById('dynamic-profile-bg')?.remove();
    document.getElementById('profile-bg-overlay')?.remove();
  }
});

observer.observe(document.body, { attributes: false, childList: true, subtree: false });
// ============================================================================
// HELPER: ESCAPE HTML (Prevents XSS attacks)
// ============================================================================
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
