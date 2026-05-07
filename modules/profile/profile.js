import { supabase, isAdmin } from '../../lib/supabase.js';

// ============================================================================
// MODULE INITIALIZATION
// ============================================================================

export async function initModule(container, params) {
  // FORCE TARGET: Always render directly into #app-content
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
  `;

  const updatePageSEO = (profile) => {
    document.title = `${profile.username}'s Profile | RetroOnlineMatchmaking`;
    
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        targetContainer.innerHTML = '<div class="text-center p-10 text-red-400 text-xl">🔒 Please log in to view your profile.</div>';
        return;
      }
      targetUser = await fetchProfileByUserId(user.id);
    } else {
      targetUser = await fetchProfileBySlug(slugOrId);
      if (!targetUser) {
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
    const isTargetUserAdmin = !!targetUser.is_admin;
    
    updatePageSEO(targetUser);
    
    if (typeof loadCurrentlyPlayingList === 'function') loadCurrentlyPlayingList(targetUser);
    if (typeof loadSiteAwardsWall === 'function') loadSiteAwardsWall(targetUser.id);
    if (typeof loadProudAchievementsWall === 'function') loadProudAchievementsWall(targetUser.id, isOwnProfile);
    if (typeof loadGameAchievementsWall === 'function') loadGameAchievementsWall(targetUser.id, isOwnProfile);
    if (typeof loadMasteredGamesWall === 'function') loadMasteredGamesWall(targetUser.id);
    
    // 3. Render the Layout
    renderProfileLayout(targetContainer, targetUser, isOwnProfile, isTargetUserAdmin, currentUser);

    // 4. Attach Event Listeners
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
    .select(`
      *,
      rank:user_ranks (
        id,
        name,
        color,
        description
      )
    `)
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
    
  return error ? null : targetUser;
}

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
// ACHIEVEMENT DATA FETCHERS
// ============================================================================

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
  return (data || []).filter(item => item.achievements);
}

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
  return (data || []).filter(item => item.achievements);
}

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
  return (data || []).filter(item => item.achievements);
}

async function fetchMasteredGames(userId) {
  const { data: allGamesWithAchievements } = await supabase
    .from('achievements')
    .select('game_id, games(title, slug, cover_image_url, console)', { count: 'exact' })
    .not('game_id', 'is', null);

  if (!allGamesWithAchievements) return [];

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

  const { data: userUnlocks } = await supabase
    .from('user_achievements')
    .select('achievement_id, achievements(game_id)')
    .eq('user_id', userId);

  if (!userUnlocks) return [];

  const userCounts = {};
  userUnlocks.forEach(u => {
    const gid = u.achievements?.game_id;
    if (gid) {
      userCounts[gid] = (userCounts[gid] || 0) + 1;
    }
  });

  const masteredIds = [];
  Object.keys(gameTotals).forEach(gid => {
    if (userCounts[gid] === gameTotals[gid].total) {
      masteredIds.push(gid);
    }
  });

  if (masteredIds.length === 0) return [];

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

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// RENDERING LOGIC (MOBILE FIXES APPLIED HERE)
// ============================================================================

function renderProfileLayout(container, profile, isOwnProfile, isTargetUserAdmin, currentUser) {
  // 1. CLEANUP
  document.getElementById('dynamic-profile-bg')?.remove();
  document.getElementById('profile-bg-overlay')?.remove();

  // 2. INJECT FULL-SCREEN BACKGROUND
  const bg = profile.custom_background;
  let bgValue = '#111827';
  let bgType = 'color';
  
  if (bg && bg.type) {
    bgType = bg.type;
    bgValue = bg.value;
  }

  const bgEl = document.createElement('div');
  bgEl.id = 'dynamic-profile-bg';
  
  if (bgType === 'image') {
    bgEl.style.backgroundImage = `url('${bgValue}')`;
    bgEl.style.backgroundSize = 'cover';
    bgEl.style.backgroundPosition = 'center';
  } else if (bgType === 'gradient') {
    bgEl.style.backgroundImage = bgValue;
  } else {
    bgEl.style.backgroundColor = bgValue;
  }

  Object.assign(bgEl.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    zIndex: '-2',
    backgroundAttachment: 'fixed'
  });

  const overlayEl = document.createElement('div');
  overlayEl.id = 'profile-bg-overlay';

  let overlayOpacity = '0.45';
  if (bgType === 'image') {
    overlayOpacity = '0.15';
  }

  Object.assign(overlayEl.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})`,
    zIndex: '-1',
    backdropFilter: bgType === 'image' ? 'blur(2px)' : 'blur(4px)',
    pointerEvents: 'none'
  });

  document.body.insertBefore(bgEl, document.body.firstChild);
  document.body.insertBefore(overlayEl, document.body.firstChild);

  // 3. Prepare Avatar Styles
  const avatarStyle = profile.avatar_custom_css ? profile.avatar_custom_css : '';
  const avatarClass = profile.avatar_custom_css ? `ra-avatar custom-overlay` : 'ra-avatar';

  // ✅ MOBILE FIX: Full width, no clipping
  container.innerHTML = `
    <div class="ra-profile-wrapper w-full overflow-x-hidden">
    
    <!-- HEADER: Fixed Overflow for Mobile Button -->
    <div class="ra-header w-full mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-4" style="position: relative; overflow: visible; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 20px rgba(0,0,0,0.6);">
  
      <!-- Background Layers -->
      ${profile.gamercard_bg_type === 'image' && profile.gamercard_bg_value ? `
        <div style="position: absolute; inset: 0; background-image: url('${profile.gamercard_bg_value}'); background-size: cover; background-position: center; z-index: 0; border-radius: 12px;"></div>
      ` : ''}
      ${profile.gamercard_bg_type === 'gradient' && profile.gamercard_bg_value ? `
        <div style="position: absolute; inset: 0; background-image: ${profile.gamercard_bg_value}; z-index: 0; border-radius: 12px;"></div>
      ` : ''}
      ${profile.gamercard_bg_type === 'color' && profile.gamercard_bg_value ? `
        <div style="position: absolute; inset: 0; background-color: ${profile.gamercard_bg_value}; z-index: 0; border-radius: 12px;"></div>
      ` : ''}

      <!-- Overlay -->
      <div style="position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.6)); z-index: 1; pointer-events: none; border-radius: 12px;"></div>
      
        <!-- Content: Optimized Mobile Stack / Desktop Row -->
      <div class="ra-header-content w-full p-4 sm:p-6 md:p-8 flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start relative z-20">
        
        <!-- Avatar: Fixed size to prevent shrinking -->
        <div class="ra-avatar-container flex-shrink-0 mx-auto md:mx-0" style="${avatarStyle || ''}">
          <img src="${profile.avatar_url || 'https://ui-avatars.com/api/?name=' + profile.username}" 
               alt="${profile.username}" 
               class="${avatarClass || 'ra-avatar'}" 
               style="border: 2px solid white; box-shadow: 0 0 15px rgba(255,255,255,0.3); width: 100px; height: 100px;">
          
          <div class="ra-status-dot" 
               style="position: absolute; bottom: 4px; right: 4px; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; background-color: ${profile.is_online ? '#22c55e' : '#6b7280'}; z-index: 10;">
          </div>
        </div>

        <!-- Info: Full width on mobile to wrap text properly -->
        <div class="ra-info flex-1 w-full text-center md:text-left min-w-0">
          <h1 class="ra-username text-3xl md:text-4xl font-bold m-0 text-white break-words" style="text-shadow: 0 2px 4px black;">${profile.username}</h1>
          
          ${profile.rank && profile.rank.name ? `
            <div class="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-md border shadow-lg backdrop-blur-sm" 
                 style="background: rgba(0,0,0,0.6); border-color: ${profile.rank.color}; box-shadow: 0 0 10px ${profile.rank.color}40;">
              <span style="color: ${profile.rank.color}; font-weight: 800; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">
                👑 ${profile.rank.name}
              </span>
            </div>
          ` : `
            <div class="mt-3 inline-block px-3 py-1 rounded-md border border-gray-600 bg-gray-800/80">
              <span style="color: #9ca3af; font-weight: 600; font-size: 0.85rem;">NPC</span>
            </div>
          `}

          ${profile.motto ? `<p class="text-gray-300 text-sm italic mt-3 font-medium break-words" style="text-shadow: 0 1px 2px black;">"${escapeHtml(profile.motto)}"</p>` : ''}
          
          <!-- Stats Row: Centered on mobile, Left on desktop -->
          <div class="ra-stats-row flex flex-wrap justify-center md:justify-start gap-4 md:gap-6 mt-4 pt-4 border-t border-white/10 w-full">
            <div class="ra-stat text-center">
              <div class="text-xl font-bold text-white">${profile.stats?.games_approved || 0}</div>
              <div class="text-xs text-gray-400 uppercase">Games</div>
            </div>
            <div class="ra-stat text-center">
             <div style="font-size: 1.2rem; font-weight: bold; color: #fbbf24;">${profile.stats?.site_posts_total || 0}</div>
             <div style="font-size: 0.75rem; color: #fbbf24; text-transform: uppercase;">Site Posts</div>
            </div>
            <div class="ra-stat text-center">
              <div class="text-xl font-bold text-yellow-400">${profile.xp_total || 0}</div>
              <div class="text-xs text-yellow-400 uppercase">XP</div>
            </div>
          </div>
        </div>

        <!-- Edit Button: 
             MOBILE: Full width, appears on new line below stats 
             DESKTOP: Auto width, appears to the right 
        -->
        ${isOwnProfile ? `
          <div class="w-full md:w-auto mt-6 md:mt-0 md:ml-4 flex-shrink-0 relative z-30">
            <button id="btn-edit-profile" class="ra-edit-btn w-full md:w-auto bg-white/10 hover:bg-white/20 border border-white/20 text-white px-6 py-3 rounded-lg cursor-pointer backdrop-blur-md transition font-bold whitespace-nowrap shadow-xl">
              Edit Profile
            </button>
          </div>
        ` : ''}
      </div>

      ${profile.signature_text ? `
        <div class="ra-signature-box w-full mx-auto max-w-7xl px-4 mt-4" style="${profile.signature_custom_css || ''}">
          ${profile.signature_text}
        </div>
      ` : ''}

      <!-- MAIN GRID -->
      <div class="w-full mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        
        <!-- LEFT COLUMN -->
        <div class="lg:col-span-2 space-y-6">
          
          <!-- Site Awards -->
          <div class="ra-card bg-gray-900/80 backdrop-blur rounded-xl border border-purple-500/30 p-6">
            <h3 class="text-xl font-bold text-purple-300 mb-4 flex items-center gap-2">
              🎖️ Site Awards & Badges
            </h3>
            <div id="site-awards-list" class="flex flex-wrap gap-4 min-h-[60px]">
              <div class="text-gray-500 text-sm italic">Loading awards...</div>
            </div>
          </div>

          <!-- About -->
          <div class="ra-card bg-gray-900/80 backdrop-blur rounded-xl border border-gray-700 p-6">
            <h3 class="text-lg font-bold text-white mb-3">About</h3>
            <p class="ra-bio text-gray-300 leading-relaxed break-words">${profile.bio || 'No bio added yet.'}</p>
          </div>
          
          <!-- Currently Playing -->
          <div class="ra-card bg-gray-900/80 backdrop-blur rounded-xl border border-gray-700 p-6">
            <h3 class="text-lg font-bold text-white mb-4">🎮 What I'm Playing Currently</h3>
            <div id="currently-playing-container">
              <div id="currently-playing-list" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                <div class="col-span-full text-center text-gray-500 py-4">
                  <div class="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-cyan-500"></div>
                  <span class="ml-2 text-sm">Loading games...</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Proud Achievements -->
          <div class="ra-card bg-gray-900/80 backdrop-blur rounded-xl border border-yellow-500/30 p-6">
            <h3 class="text-xl font-bold text-yellow-400 mb-4 flex items-center gap-2">
              ⭐ Most Proud Achievements
            </h3>
            <div id="proud-achievements-list" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
              <div class="col-span-full text-center text-gray-500 py-4">
                <div class="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-yellow-500"></div>
                <span class="ml-2 text-sm">Loading proud moments...</span>
              </div>
            </div>
          </div>

          <!-- All Game Achievements -->
          <div class="ra-card bg-gray-900/80 backdrop-blur rounded-xl border border-cyan-500/30 p-6">
            <h3 class="text-xl font-bold text-cyan-400 mb-4 flex items-center gap-2">
              🎮 Game Achievements
              <span id="game-achieve-count" class="text-sm font-normal text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full"></span>
            </h3>
            <div id="game-achievements-list" class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
              <div class="col-span-full text-center text-gray-500 py-4">
                <div class="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-cyan-500"></div>
                <span class="ml-2 text-sm">Loading achievements...</span>
              </div>
            </div>
          </div>

          <!-- Wall -->
          <div class="ra-card bg-gray-900/80 backdrop-blur rounded-xl border border-gray-700 p-6">
            <h3 class="text-lg font-bold text-white mb-4">Shout Box / Wall</h3>
            <div id="wall-container">
              ${isOwnProfile || currentUser ? `
                <div class="wall-post-form mb-4">
                  <textarea id="new-wall-comment" placeholder="Say something on ${profile.username}'s wall..." class="ra-input w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-cyan-500 outline-none"></textarea>
                  <button id="btn-post-wall" class="btn-primary mt-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded font-bold w-full sm:w-auto">Post Shout</button>
                </div>
              ` : ''}
              <div id="wall-list" class="space-y-3">
                <div class="text-center text-gray-500 py-4">Loading wall comments...</div>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN -->
        <div class="space-y-6">
          
          <!-- Friends -->
          <div class="ra-card bg-gray-900/80 backdrop-blur rounded-xl border border-gray-700 p-6">
            <h3 class="text-lg font-bold text-white mb-4">Friends</h3>
            <div id="friends-list" class="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              <div class="text-sm text-gray-500 py-2">Loading friends...</div>
            </div>
            
            ${!isOwnProfile ? `
              <div id="friend-action-container" class="mt-4 space-y-2">
                <div class="text-center text-gray-400 text-sm py-2">Checking status...</div>
              </div>
            ` : ''}
          </div>

          <!-- Mastered Games -->
          <div class="ra-card bg-gray-900/80 backdrop-blur rounded-xl border border-green-500/30 p-6">
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

          <!-- Details -->
          <div class="ra-card bg-gray-900/80 backdrop-blur rounded-xl border border-gray-700 p-6">
            <h3 class="text-lg font-bold text-white mb-4">Profile Details</h3>
            <ul class="ra-details-list text-sm space-y-3 text-gray-300">
              <li><strong class="text-white">Member Since:</strong> ${new Date(profile.created_at).toLocaleDateString()}</li>
              <li><strong class="text-white">Favorite Console:</strong> ${profile.favorite_console || 'None'}</li>
              
              ${profile.rank ? `
                <li>
                  <strong class="text-white">Current Rank:</strong> 
                  <span class="inline-block px-2 py-0.5 rounded text-xs font-bold mt-1" 
                        style="background:${profile.rank.color}20; color:${profile.rank.color}; border:1px solid ${profile.rank.color}">
                    ${profile.rank.name}
                  </span>
                  <div class="text-xs text-gray-400 mt-1">${profile.xp_total || 0} XP Total</div>
                </li>
              ` : '<li><strong class="text-white">Rank:</strong> NPC</li>'}
              
              ${isTargetUserAdmin ? '<li><strong class="text-white">Role:</strong> <span class="text-red-400 font-bold">Admin</span></li>' : ''}
            </ul>
          </div>
        </div>
      </div>

      ${isOwnProfile ? `
        <div id="edit-modal" class="ra-modal fixed inset-0 z-50 flex items-center justify-center bg-black/80 hidden backdrop-blur-sm">
          <div class="ra-modal-content bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 m-4 shadow-2xl">
            <h2 class="text-2xl font-bold text-white mb-6">Edit Profile Settings</h2>
            <form id="profile-form" class="space-y-4">
             <label class="block text-sm font-bold text-cyan-400">Username (Unique)</label>
             <div class="flex flex-col gap-1 mb-4">
                <input type="text" name="username" class="ra-input w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-cyan-500 outline-none" value="${profile.username || ''}" placeholder="Enter new username">
                <span class="text-xs text-yellow-500">⚠️ Changing this updates your profile URL and all chat history instantly.</span>
              </div>
              
              <label class="block text-sm font-bold text-cyan-400">Favorite Console</label>
              <select name="favorite_console" class="ra-input w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-cyan-500 outline-none mb-4">
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

              <hr class="border-gray-700 my-6">
              <h3 class="text-cyan-400 font-bold mb-4">🎮 Gamercard Settings</h3>

              <label class="block text-sm font-bold text-cyan-400">Gamer Motto / Signature</label>
              <input type="text" name="motto" class="ra-input w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-cyan-500 outline-none mb-4" value="${profile.motto || ''}" placeholder="Enter a short motto..." maxlength="100">

              <label class="block text-sm font-bold text-cyan-400">Gamercard Background Type</label>
              <select name="gc_bg_type" id="gc_bg_type" class="ra-input w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-cyan-500 outline-none mb-4">
                <option value="color" ${profile.gamercard_bg_type === 'color' ? 'selected' : ''}>Solid Color</option>
                <option value="image" ${profile.gamercard_bg_type === 'image' ? 'selected' : ''}>Uploaded Image / GIF</option>
                <option value="gradient" ${profile.gamercard_bg_type === 'gradient' ? 'selected' : ''}>Gradient</option>
              </select>

              <div id="gc-upload-container" style="display: ${profile.gamercard_bg_type === 'image' ? 'block' : 'none'};" class="mb-4">
                <label class="block text-sm text-cyan-400 mb-1">Upload Gamercard Background</label>
                <input type="file" id="gc_file_input" accept="image/*" class="ra-input w-full text-gray-400">
              </div>

              <label class="block mb-4 text-sm font-bold text-cyan-400">Background Value (Color Hex, Gradient CSS, or URL)</label>
              <input type="text" name="gc_bg_value" id="gc_bg_value" class="ra-input w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-cyan-500 outline-none" value="${profile.gamercard_bg_value || '#1f2937'}">
              
              <label class="block text-sm font-bold text-cyan-400">Bio</label>
              <textarea name="bio" class="ra-input w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-cyan-500 outline-none" rows="3">${profile.bio || ''}</textarea>

              <hr class="border-gray-700 my-6">
              <label class="block text-sm font-bold text-cyan-400">Signature Content (HTML Allowed)</label>
              <textarea name="signature_text" class="ra-input w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-cyan-500 outline-none" rows="3">${profile.signature_text || ''}</textarea>
              
              <label class="block text-sm font-bold text-cyan-400">Signature Custom CSS</label>
              <textarea name="signature_custom_css" class="ra-input font-mono text-xs w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-cyan-500 outline-none" rows="4">${profile.signature_custom_css || ''}</textarea>

              <hr class="border-gray-700 my-6">
              <label class="block text-sm font-bold text-cyan-400">Avatar Overlay Custom CSS</label>
              <textarea name="avatar_custom_css" class="ra-input font-mono text-xs w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-cyan-500 outline-none" rows="4">${profile.avatar_custom_css || ''}</textarea>

              <hr class="border-gray-700 my-6">
              <label class="block text-sm font-bold text-cyan-400">Update Profile Picture</label>
              <input type="file" id="avatar_file_input" accept="image/*" class="ra-input w-full text-gray-400 mb-2">
              <div class="mt-2">
                <img src="${profile.avatar_url || 'https://ui-avatars.com/api/?name=' + profile.username}" class="w-16 h-16 rounded-full border border-gray-600" alt="Current Avatar">
              </div>

              <hr class="border-gray-700 my-6">
              <label class="block text-sm font-bold text-cyan-400">Profile Background Type</label>
              <select name="bg_type" id="bg_type" class="ra-input w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-cyan-500 outline-none">
                <option value="color" ${profile.custom_background?.type === 'color' ? 'selected' : ''}>Solid Color</option>
                <option value="image" ${profile.custom_background?.type === 'image' ? 'selected' : ''}>Uploaded Image / GIF</option>
                <option value="gradient" ${profile.custom_background?.type === 'gradient' ? 'selected' : ''}>Gradient</option>
              </select>

              <div id="bg-upload-container" style="display: ${profile.custom_background?.type === 'image' ? 'block' : 'none'}; margin-top: 15px;">
                <label class="block text-sm font-bold text-cyan-400 mb-1">Upload New Background</label>
                <input type="file" id="bg_file_input" accept="image/*" class="ra-input w-full text-gray-400">
              </div>

              <label class="block mt-4 text-sm font-bold text-cyan-400">Background Value</label>
              <input type="text" name="bg_value" id="bg_value_input" class="ra-input w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-cyan-500 outline-none" value="${profile.custom_background?.value || '#1f2937'}">

              <div class="modal-actions flex gap-3 mt-8 pt-4 border-t border-gray-700">
                <button type="button" id="btn-cancel-edit" class="flex-1 bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded font-bold transition">Cancel</button>
                <button type="submit" class="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded font-bold transition">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  setTimeout(() => {
    fetchProfileBySlug(profile.username).then(freshData => {
      if (freshData && freshData.rank) {
        const rankBadge = document.querySelector('.ra-header .inline-flex span');
        if (rankBadge) {
          rankBadge.textContent = `👑 ${freshData.rank.name}`;
          rankBadge.style.color = freshData.rank.color;
          rankBadge.parentElement.style.borderColor = freshData.rank.color;
          rankBadge.parentElement.style.boxShadow = `0 0 10px ${freshData.rank.color}40`;
        }
      }
    });
  }, 1000);
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
  const editBtn = document.getElementById('btn-edit-profile');
  const modal = document.getElementById('edit-modal');
  const cancelBtn = document.getElementById('btn-cancel-edit');
  const form = document.getElementById('profile-form');
  const bgTypeSelect = document.getElementById('bg_type');
  const bgUploadContainer = document.getElementById('bg-upload-container');

  if (editBtn && modal) editBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  });
  
  if (cancelBtn && modal) cancelBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  });

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

      let finalGcBgValue = formData.get('gc_bg_value');
      const gcFileType = formData.get('gc_bg_type');

      const gcFileInput = document.getElementById('gc_file_input');
      if (gcFileType === 'image' && gcFileInput && gcFileInput.files.length > 0) {
         const file = gcFileInput.files[0];
         const fileName = `${profile.id}/gc_bg_${Date.now()}_${file.name.replace(/\s/g, '_')}`;
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
        gamercard_bg_value: finalGcBgValue, 
        custom_background: { type: bgType, value: finalBgValue, opacity: 1, position: 'center', size: 'cover' }
      };

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
        
        modal.classList.add('hidden');
        modal.style.display = 'none';
        
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

  loadWallComments(profile.id);

  const postBtn = document.getElementById('btn-post-wall');
  if (postBtn) {
    postBtn.addEventListener('click', async () => {
      const input = document.getElementById('new-wall-comment');
      const content = input.value.trim();
      
      if (!content) return alert("Please type a message first.");
      if (!currentUser) return alert("You must be logged in.");

      postBtn.disabled = true;
      postBtn.textContent = 'Posting...';

      try {
        const { data: targetData, error: targetErr } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', profile.id)
          .single();

        if (targetErr || !targetData) throw new Error("Could not find profile owner.");
        const targetUsername = targetData.username;

        const { data: authorData, error: authorErr } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', currentUser.id)
          .single();

        const authorUsername = authorData?.username || currentUser.email.split('@')[0];

        const { error: insertErr } = await supabase.from('profile_comments').insert({
          target_user_id: profile.id,
          target_username: targetUsername,      
          author_id: currentUser.id,
          author_username: authorUsername,      
          content: content
        });

        if (insertErr) throw insertErr;

        input.value = '';
        loadWallComments(profile.id);

      } catch (err) {
        console.error("Wall Post Failed:", err);
        alert('Failed to post: ' + err.message);
      } finally {
        postBtn.disabled = false;
        postBtn.textContent = 'Post Shout';
      }
    });
  }

  loadFriends(profile.id);
  
  if (!isOwnProfile && currentUser) {
    const dmContainer = document.getElementById('dm-action-container');
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

      friendContainer.parentNode.insertBefore(dmBtn, friendContainer);
    }
  }
  
  if (!isOwnProfile && currentUser) {
    loadFriendButtonState(profile.id, currentUser.id);
  }

  loadCurrentlyPlayingList(profile);

  loadSiteAwardsWall(profile.id);
  loadProudAchievementsWall(profile.id, isOwnProfile); 
  loadGameAchievementsWall(profile.id, isOwnProfile); 
  loadMasteredGamesWall(profile.id);

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
// RENDERING FUNCTIONS FOR ACHIEVEMENT WALLS
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
          loadProudAchievementsWall(userId, true); 
          loadGameAchievementsWall(userId, true);  
        }
      });
    });
  }
}

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
    const badgeSrc = a.badge_url || 'https://via.placeholder.com/64?text=Trophy';
    
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
        <div class="absolute top-1 right-1 bg-green-600 text-white p-1 rounded-full shadow-lg">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
      </a>
    `;
  }).join('');
}

// ============================================================================
// EXISTING HELPER FUNCTIONS
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
      <img src="${avatarSrc}" class="w-8 h-8 rounded-full bg-gray-600 object-cover flex-shrink-0">
      <div class="flex-1 min-w-0">
        <div class="flex items-baseline gap-2 flex-wrap">
          <span class="font-bold text-cyan-400 text-sm hover:underline cursor-pointer" onclick="window.location.hash='${link}'">${displayName}</span>
          <span class="text-xs text-gray-500 whitespace-nowrap">${new Date(c.created_at).toLocaleDateString()}</span>
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
      <div class="relative flex-shrink-0">
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
const observer = new MutationObserver(() => {
  const hash = window.location.hash;
  if (!hash.startsWith('#/profile/')) {
    document.getElementById('dynamic-profile-bg')?.remove();
    document.getElementById('profile-bg-overlay')?.remove();
  }
});

observer.observe(document.body, { attributes: false, childList: true, subtree: false });
