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
    
    // Dynamic Admin Check
    const isTargetUserAdmin = !!targetUser.is_admin;

    // 3. SEO: Update Meta Tags & Schema for this Profile
    updateProfileSEO(targetUser);

    // 4. Render the Layout
    renderProfileLayout(targetContainer, targetUser, isOwnProfile, isTargetUserAdmin, currentUser);

    // 5. Attach Event Listeners
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
// SEO HELPER: Dynamic Meta Tags & Schema
// ============================================================================
function updateProfileSEO(profile) {
  const siteName = "RetroOnlineMatchmaking";
  const title = `${profile.username}'s Profile - ${siteName}`;
  const description = profile.bio ? `${profile.bio.substring(0, 150)}...` : `View ${profile.username}'s retro gaming profile, achievements, and currently playing games on ${siteName}.`;
  const imageUrl = profile.avatar_url || 'https://ui-avatars.com/api/?name=' + profile.username;
  const url = window.location.href;

  // Update Title
  document.title = title;

  // Update/Open Graph Meta Tags
  const setMeta = (name, content, property = false) => {
    let tag = document.querySelector(`meta[${property ? 'property' : 'name'}="${name}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      if (property) tag.setAttribute('property', name);
      else tag.setAttribute('name', name);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
  };

  setMeta('description', description);
  setMeta('og:title', title, true);
  setMeta('og:description', description, true);
  setMeta('og:image', imageUrl, true);
  setMeta('og:url', url, true);
  setMeta('og:type', 'profile', true);
  setMeta('profile:username', profile.username, true);
  setMeta('twitter:card', 'summary');
  setMeta('twitter:title', title);
  setMeta('twitter:description', description);
  setMeta('twitter:image', imageUrl);

  // Inject JSON-LD Schema
  const schemaId = 'profile-schema';
  let schemaTag = document.getElementById(schemaId);
  if (!schemaTag) {
    schemaTag = document.createElement('script');
    schemaTag.type = 'application/ld+json';
    schemaTag.id = schemaId;
    document.head.appendChild(schemaTag);
  }
  
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": profile.username,
    "url": url,
    "image": imageUrl,
    "description": description,
    "jobTitle": profile.is_admin ? "Administrator" : "Gamer",
    "knowsAbout": ["Retro Gaming", profile.favorite_console || "Gaming"].filter(Boolean)
  };
  schemaTag.textContent = JSON.stringify(schemaData);
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
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();
  return error ? null : data;
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

// ============================================================================
// RENDERING LOGIC
// ============================================================================

function renderProfileLayout(container, profile, isOwnProfile, isTargetUserAdmin, currentUser) {
  const bgStyle = getBackgroundCSS(profile.custom_background);
  const avatarStyle = profile.avatar_custom_css ? profile.avatar_custom_css : '';
  const avatarClass = profile.avatar_custom_css ? `ra-avatar custom-overlay` : 'ra-avatar';

  container.innerHTML = `
    <div class="ra-profile-wrapper" style="${bgStyle}">
      <div class="ra-header">
        <div class="ra-header-overlay"></div>
        <div class="ra-header-content">
          <div class="ra-avatar-container" style="${avatarStyle}">
            <img src="${profile.avatar_url || 'https://ui-avatars.com/api/?name=' + profile.username}" 
                 alt="${profile.username}" 
                 class="${avatarClass}">
            <div class="ra-status-dot ${profile.is_online ? 'online' : 'offline'}"></div>
          </div>

          <div class="ra-info">
            <h1 class="ra-username">${profile.username}</h1>
            ${profile.display_name ? `<div class="ra-display-name">${profile.display_name}</div>` : ''}
            
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

      <!-- Site Awards Wall -->
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

          <!-- Most Proud Achievements Wall -->
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

          <!-- All Game Achievements Wall -->
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

          <!-- Mastered Games Wall -->
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
// EVENT LISTENERS & INTERACTIVITY (Part 1)
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
        submitBtn.textContent = 'Uploading...';
        submitBtn.disabled = true;

        try {
          const { error } = await supabase.storage.from('user-backgrounds').upload(fileName, file, { cacheControl: '3600', upsert: true });
          if (error) throw error;
          const { data: { publicUrl } } = supabase.storage.from('user-backgrounds').getPublicUrl(fileName);
          finalAvatarUrl = publicUrl;
        } catch (err) {
          alert('Avatar upload failed: ' + err.message);
          submitBtn.textContent = 'Save Changes';
          submitBtn.disabled = false;
          return;
        }
      }

      const fileInput = document.getElementById('bg_file_input');
      if (bgType === 'image' && fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileName = `${profile.id}/${Date.now()}_${file.name.replace(/\s/g, '_')}`;
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Uploading...';
        submitBtn.disabled = true;

        try {
          const { error } = await supabase.storage.from('user-backgrounds').upload(fileName, file, { cacheControl: '3600', upsert: true });
          if (error) throw error;
          const { data: { publicUrl } } = supabase.storage.from('user-backgrounds').getPublicUrl(fileName);
          finalBgValue = publicUrl;
        } catch (err) {
          alert('Upload failed: ' + err.message);
          submitBtn.textContent = 'Save Changes';
          submitBtn.disabled = false;
          return;
        }
      }

      const updates = {
        bio: formData.get('bio'),
        signature_text: formData.get('signature_text'),
        signature_custom_css: formData.get('signature_custom_css'),
        avatar_custom_css: formData.get('avatar_custom_css'),
        avatar_url: finalAvatarUrl,
        custom_background: { type: bgType, value: finalBgValue, opacity: 1, position: 'center', size: 'cover' }
      };

      const { error } = await supabase.from('profiles').update(updates).eq('id', profile.id);
      if (error) alert('Error: ' + error.message);
      else { alert('Saved!'); location.reload(); }
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
      if (!content) return;
      const { error } = await supabase.from('profile_comments').insert({
        target_user_id: profile.id, author_id: currentUser.id, content: content
      });
      if (error) alert('Error: ' + error.message);
      else { input.value = ''; loadWallComments(profile.id); }
    });
  }

  // --- 4. Load Friends List ---
  loadFriends(profile.id);

  // --- 5. Smart Friend Button Logic ---
  if (!isOwnProfile && currentUser) {
    loadFriendButtonState(profile.id, currentUser.id);
  }

  // --- 6. Load Currently Playing Games ---
  loadCurrentlyPlayingList(profile);

  // --- 7. Load Achievement Walls ---
  loadSiteAwardsWall(profile.id);
  loadProudAchievementsWall(profile.id, isOwnProfile); 
  loadGameAchievementsWall(profile.id, isOwnProfile);
  loadMasteredGamesWall(profile.id);

  // --- 8. Remove Game Listener ---
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
// HELPER FUNCTIONS
// ============================================================================

function getProfileLink(profile) {
  if (!profile) return '#/home';
  if (profile.username) return `#/profile/${profile.username}`;
  return `#/profile/${profile.id}`;
}

function getGameLink(game) {
  if (!game) return '#/games';
  if (game.slug) return `#/game/${game.slug}`;
  if (game.title) {
    const slug = game.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return `#/game/${slug}`;
  }
  return '#/games';
}

function getBackgroundCSS(bg) {
  if (!bg || !bg.type) return 'background-color: #111827;';
  const { type, value, opacity = 1, position = 'center', size = 'cover' } = bg;
  
  if (type === 'image') {
    return `background-image: url('${value}'); background-size: ${size}; background-position: ${position}; background-attachment: fixed; opacity: ${opacity};`;
  }
  if (type === 'gradient') {
    return `background-image: ${value}; background-attachment: fixed;`;
  }
  return `background-color: ${value};`;
}

// ============================================================================
// RENDERING LOGIC
// ============================================================================

function renderProfileLayout(container, profile, isOwnProfile, isTargetUserAdmin, currentUser) {
  const bgStyle = getBackgroundCSS(profile.custom_background);
  const avatarStyle = profile.avatar_custom_css ? profile.avatar_custom_css : '';
  const avatarClass = profile.avatar_custom_css ? `ra-avatar custom-overlay` : 'ra-avatar';

  // Dynamic SEO Update
  updateProfileSEO(profile);

  container.innerHTML = `
    <div class="ra-profile-wrapper" style="${bgStyle}">
      <div class="ra-header">
        <div class="ra-header-overlay"></div>
        <div class="ra-header-content">
          <div class="ra-avatar-container" style="${avatarStyle}">
            <img src="${profile.avatar_url || 'https://ui-avatars.com/api/?name=' + (profile.username || 'User')}" 
                 alt="${profile.username}" 
                 class="${avatarClass}">
            <div class="ra-status-dot ${profile.is_online ? 'online' : 'offline'}"></div>
          </div>

          <div class="ra-info">
            <h1 class="ra-username">${profile.username || 'Unknown User'}</h1>
            ${profile.display_name ? `<div class="ra-display-name">${profile.display_name}</div>` : ''}
            
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
            
            ${!isOwnProfile && currentUser ? `
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
                <img src="${profile.avatar_url || 'https://ui-avatars.com/api/?name=' + (profile.username || 'User')}" class="w-16 h-16 rounded-full border border-gray-600" alt="Current Avatar">
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
  if (modal) {
    window.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  }

  if (bgTypeSelect && bgUploadContainer) {
    bgTypeSelect.addEventListener('change', (e) => {
      bgUploadContainer.style.display = e.target.value === 'image' ? 'block' : 'none';
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
        submitBtn.textContent = 'Uploading...';
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
        submitBtn.textContent = 'Uploading...';
        submitBtn.disabled = true;

        try {
          const { error } = await supabase.storage.from('user-backgrounds').upload(fileName, file, { cacheControl: '3600', upsert: true });
          if (error) throw error;
          const { data: { publicUrl } } = supabase.storage.from('user-backgrounds').getPublicUrl(fileName);
          finalBgValue = publicUrl;
        } catch (err) {
          alert('Upload failed: ' + err.message);
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          return;
        }
      }

      const updates = {
        bio: formData.get('bio'),
        signature_text: formData.get('signature_text'),
        signature_custom_css: formData.get('signature_custom_css'),
        avatar_custom_css: formData.get('avatar_custom_css'),
        avatar_url: finalAvatarUrl,
        custom_background: { 
          type: bgType, 
          value: finalBgValue, 
          opacity: 1, 
          position: 'center', 
          size: 'cover',
          blur: profile.custom_background?.blur || '0'
        }
      };

      const { error } = await supabase.from('profiles').update(updates).eq('id', profile.id);
      if (error) alert('Error: ' + error.message);
      else { 
        alert('Saved!'); 
        location.reload(); 
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
      if (!content) return;
      
      const submitBtn = postBtn;
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Posting...';
      submitBtn.disabled = true;

      const { error } = await supabase.from('profile_comments').insert({
        target_user_id: profile.id, 
        author_id: currentUser.id, 
        content: content,
        author_username: currentUser.email.split('@')[0], // Fallback username
        target_username: profile.username
      });
      
      if (error) {
        alert('Error: ' + error.message);
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      } else { 
        input.value = ''; 
        loadWallComments(profile.id); 
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  // --- 4. Load Friends List ---
  loadFriends(profile.id);

  // --- 5. Smart Friend Button Logic ---
  if (!isOwnProfile && currentUser) {
    loadFriendButtonState(profile.id, currentUser.id);
  }

  // --- 6. Load Currently Playing Games ---
  loadCurrentlyPlayingList(profile);

  // --- NEW: Load Achievement Walls ---
  loadSiteAwardsWall(profile.id);
  loadProudAchievementsWall(profile.id, isOwnProfile); 
  loadGameAchievementsWall(profile.id, isOwnProfile);
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
// ACHIEVEMENT WALL RENDERING FUNCTIONS
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

  if (countEl) {
      countEl.textContent = items.length ? `(${items.length})` : '(0)';
  }

  if (!items || items.length === 0) {
    listEl.innerHTML = '<div class="col-span-full text-center text-gray-500 italic py-4">No game achievements unlocked yet.</div>';
    return;
  }

  listEl.innerHTML = items.map(item => {
    const a = item.achievements;
    const game = a.games;
    const gameLink = game ? getGameLink(game) : '#/games';
    const badgeSrc = a.badge_url || 'https://via.placeholder.com/48?text=ACH';
    const isProud = item.is_proud;

    return `
      <div class="group relative bg-gray-800/30 border border-cyan-500/20 rounded p-1.5 hover:border-cyan-400 transition-colors flex flex-col items-center text-center">
        <div class="relative">
          <img src="${badgeSrc}" 
               alt="${a.title}" 
               class="w-8 h-8 object-contain group-hover:scale-105 transition-transform">
          ${isProud ? '<div class="absolute -top-1 -right-1 text-yellow-400 text-xs">⭐</div>' : ''}
        </div>
        <h5 class="text-[10px] font-bold text-cyan-100 line-clamp-1 mt-1" title="${a.title}">${a.title}</h5>
        ${game ? `
          <a href="${gameLink}" class="text-[9px] text-cyan-400 hover:underline truncate w-full block">
            ${game.title}
          </a>
        ` : ''}
        <div class="mt-0.5">
          <span class="text-[9px] text-gray-400">${a.points} pts</span>
        </div>

        ${isOwnProfile ? `
          <div class="mt-1 flex gap-1">
            ${isProud ? `
              <button class="text-[8px] text-red-400 hover:text-red-300 underline remove-proud-main-btn" data-achieve-id="${a.id}">
                Un-Proud
              </button>
            ` : `
              <button class="text-[8px] text-green-400 hover:text-green-300 underline make-proud-btn" data-achieve-id="${a.id}">
                Make Proud
              </button>
            `}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  if (isOwnProfile) {
    listEl.querySelectorAll('.make-proud-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const achieveId = btn.getAttribute('data-achieve-id');
        const { error } = await supabase
          .from('user_achievements')
          .update({ is_proud: true })
          .eq('user_id', userId)
          .eq('achievement_id', achieveId);

        if (error) alert('Error: ' + error.message);
        else {
          loadProudAchievementsWall(userId, true);
          loadGameAchievementsWall(userId, true);
        }
      });
    });

    listEl.querySelectorAll('.remove-proud-main-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const achieveId = btn.getAttribute('data-achieve-id');
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

async function loadMasteredGamesWall(userId) {
  const listEl = document.getElementById('mastered-games-list');
  if (!listEl) return;

  const games = await fetchMasteredGames(userId);

  if (!games || games.length === 0) {
    listEl.innerHTML = '<div class="col-span-full text-center text-gray-500 italic py-4">No fully mastered games yet.</div>';
    return;
  }

  listEl.innerHTML = games.map(game => {
    const coverSrc = game.cover_image_url || 'https://via.placeholder.com/150x200?text=Game';
    const gameLink = getGameLink(game);
    return `
      <div class="group relative bg-gray-800/50 border border-green-500/30 rounded-lg overflow-hidden hover:border-green-400 transition-colors">
        <a href="${gameLink}" class="block">
          <img src="${coverSrc}" alt="${game.title}" class="w-full h-32 object-cover">
          <div class="p-2">
            <h4 class="text-xs font-bold text-green-100 truncate" title="${game.title}">${game.title}</h4>
            <p class="text-[10px] text-gray-400">${game.console}</p>
          </div>
        </a>
      </div>
    `;
  }).join('');
}

// ============================================================================
// SUPPORTING LOADING FUNCTIONS
// ============================================================================

async function loadWallComments(profileId) {
  const listEl = document.getElementById('wall-list');
  if (!listEl) return;

  const comments = await fetchWallComments(profileId);
  if (!comments || comments.length === 0) {
    listEl.innerHTML = '<div class="text-center text-gray-500 py-4">No shouts on the wall yet.</div>';
    return;
  }

  listEl.innerHTML = comments.map(comment => {
    const authorLink = getProfileLink(comment.author);
    const avatarSrc = comment.author.avatar_url || 'https://ui-avatars.com/api/?name=' + (comment.author.username || 'User');
    return `
      <div class="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
        <div class="flex items-start gap-3">
          <a href="${authorLink}"><img src="${avatarSrc}" class="w-10 h-10 rounded-full object-cover"></a>
          <div class="flex-1">
            <div class="flex justify-between">
              <a href="${authorLink}" class="font-bold text-cyan-400 hover:underline">${comment.author.username || 'Unknown'}</a>
              <span class="text-xs text-gray-500">${new Date(comment.created_at).toLocaleString()}</span>
            </div>
            <p class="mt-1 text-gray-300">${comment.content}</p>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function loadFriends(profileId) {
  const listEl = document.getElementById('friends-list');
  if (!listEl) return;

  const friends = await fetchFriends(profileId);
  if (!friends || friends.length === 0) {
    listEl.innerHTML = '<div class="text-center text-gray-500 py-4">No friends yet.</div>';
    return;
  }

  listEl.innerHTML = friends.map(friend => {
    if (!friend) return '';
    const friendLink = getProfileLink(friend);
    const avatarSrc = friend.avatar_url || 'https://ui-avatars.com/api/?name=' + (friend.username || 'User');
    return `
      <a href="${friendLink}" class="flex items-center gap-3 p-2 rounded hover:bg-gray-700/50 transition-colors">
        <img src="${avatarSrc}" class="w-10 h-10 rounded-full object-cover border ${friend.is_online ? 'border-green-500' : 'border-gray-600'}">
        <div>
          <div class="font-medium text-white">${friend.username || 'Unknown'}</div>
          <div class="text-xs text-gray-400">${friend.is_online ? 'Online' : 'Offline'}</div>
        </div>
      </a>
    `;
  }).join('');
}

async function loadFriendButtonState(targetUserId, currentUserId) {
  const container = document.getElementById('friend-action-container');
  if (!container) return;

  const status = await checkFriendStatus(currentUserId, targetUserId);

  if (!status) {
    container.innerHTML = `<button id="btn-send-request" class="btn-secondary w-full">Add Friend</button>`;
    document.getElementById('btn-send-request').addEventListener('click', async () => {
      const { error } = await supabase.from('friends').insert([{ user_id: currentUserId, friend_id: targetUserId, status: 'pending' }]);
      if (error) alert('Error: ' + error.message);
      else { alert('Friend request sent!'); loadFriendButtonState(targetUserId, currentUserId); }
    });
  } else if (status.status === 'pending') {
    if (status.user_id === currentUserId) {
      container.innerHTML = `<div class="text-center text-gray-500 text-sm py-2">Request sent</div>`;
    } else {
      container.innerHTML = `
        <div class="flex gap-2">
          <button id="btn-accept-friend" class="btn-primary flex-1">Accept</button>
          <button id="btn-reject-friend" class="btn-secondary flex-1">Reject</button>
        </div>
      `;
      document.getElementById('btn-accept-friend').addEventListener('click', async () => {
        const { error } = await supabase.from('friends').update({ status: 'accepted' }).eq('id', status.id);
        if (error) alert('Error: ' + error.message);
        else { loadFriendButtonState(targetUserId, currentUserId); }
      });
      document.getElementById('btn-reject-friend').addEventListener('click', async () => {
        const { error } = await supabase.from('friends').delete().eq('id', status.id);
        if (error) alert('Error: ' + error.message);
        else { loadFriendButtonState(targetUserId, currentUserId); }
      });
    }
  } else if (status.status === 'accepted') {
    container.innerHTML = `<button disabled class="w-full bg-green-900/50 border border-green-700 text-green-400 py-2 rounded text-sm cursor-default">✓ Friends</button>`;
  }
}

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
  // Determine if own profile by checking for the edit button existence
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

// SEO Helper
function updateProfileSEO(profile) {
  const title = `${profile.username} - Retro Online Matchmaking Profile`;
  const description = profile.bio ? `${profile.bio} - View ${profile.username}'s gaming stats, achievements, and currently playing games on ROM.` : `View ${profile.username}'s profile on Retro Online Matchmaking.`;
  
  // Update Document Title
  document.title = title;

  // Update Meta Description
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.name = 'description';
    document.head.appendChild(metaDesc);
  }
  metaDesc.content = description;

  // Update Open Graph Tags
  let ogTitle = document.querySelector('meta[property="og:title"]');
  if (!ogTitle) {
    ogTitle = document.createElement('meta');
    ogTitle.property = 'og:title';
    document.head.appendChild(ogTitle);
  }
  ogTitle.content = title;

  let ogDesc = document.querySelector('meta[property="og:description"]');
  if (!ogDesc) {
    ogDesc = document.createElement('meta');
    ogDesc.property = 'og:description';
    document.head.appendChild(ogDesc);
  }
  ogDesc.content = description;

  let ogImage = document.querySelector('meta[property="og:image"]');
  if (!ogImage) {
    ogImage = document.createElement('meta');
    ogImage.property = 'og:image';
    document.head.appendChild(ogImage);
  }
  ogImage.content = profile.avatar_url || 'https://ui-avatars.com/api/?name=' + (profile.username || 'User');

  // Inject JSON-LD Schema
  const schemaScript = document.getElementById('profile-schema');
  if (schemaScript) schemaScript.remove();
  
  const script = document.createElement('script');
  script.id = 'profile-schema';
  script.type = 'application/ld+json';
  script.text = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Person",
    "name": profile.username,
    "url": window.location.href,
    "image": profile.avatar_url,
    "description": profile.bio,
    "knowsAbout": ["Retro Gaming", "Online Multiplayer", profile.favorite_console].filter(Boolean)
  });
  document.head.appendChild(script);
}
