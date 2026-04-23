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
    
    // Check Admin Status safely
    let isUserAdmin = false;
    try {
      isUserAdmin = await isAdmin();
    } catch (e) {
      console.warn("Admin check failed, assuming user", e);
    }

    // 3. Render the Layout
    renderProfileLayout(targetContainer, targetUser, isOwnProfile, isUserAdmin, currentUser);

    // 4. Attach Event Listeners (Edit, Wall, Friends, Currently Playing, Avatar Upload)
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
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('username', slug) // Case insensitive match
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

// --- fetchWallComments ---
// Fixed to avoid Foreign Key constraint name errors by fetching authors separately
async function fetchWallComments(profileId) {
  // Step 1: Get all comments for this profile
  const { data: comments, error } = await supabase
    .from('profile_comments')
    .select('*')
    .eq('target_user_id', profileId)
    .order('created_at', { ascending: false });

  if (error || !comments) return [];

  // Step 2: Fetch author details separately to avoid FK constraint name issues
  const authorIds = [...new Set(comments.map(c => c.author_id))];
  
  if (authorIds.length === 0) return comments;

  const { data: authors } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', authorIds);

  // Step 3: Merge author data into comments
  const authorMap = new Map(authors?.map(a => [a.id, a]) || []);
  
  return comments.map(c => ({
    ...c,
    author: authorMap.get(c.author_id) || { username: 'Unknown', avatar_url: '' }
  }));
}

async function fetchFriends(userId) {
  // Fetch accepted friends where this user is the owner
  const { data, error } = await supabase
    .from('friends')
    .select(`
      friend_profile:profiles!friends_friend_id_fkey (
        id,
        username,
        avatar_url,
        is_online
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'accepted');
  
  if (error) return [];
  return data.map(item => item.friend_profile);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Ensures we always link to username if available, preventing ID redirect issues
function getProfileLink(profile) {
  if (profile.username) return `#/profile/${profile.username}`;
  return `#/profile/${profile.id}`;
}

// ============================================================================
// RENDERING LOGIC
// ============================================================================

function renderProfileLayout(container, profile, isOwnProfile, isUserAdmin, currentUser) {
  const bgStyle = getBackgroundCSS(profile.custom_background);
  
  // Apply Custom CSS for Avatar if exists
  const avatarStyle = profile.avatar_custom_css ? profile.avatar_custom_css : '';
  const avatarClass = profile.avatar_custom_css ? `ra-avatar custom-overlay` : 'ra-avatar';

  // Parse Currently Playing Games (Stored as JSON string or Array)
  let currentlyPlayingGames = [];
  if (profile.currently_playing) {
    try {
      currentlyPlayingGames = typeof profile.currently_playing === 'string' 
        ? JSON.parse(profile.currently_playing) 
        : profile.currently_playing;
    } catch (e) {
      console.error("Error parsing currently_playing", e);
    }
  }

  // Inject the full HTML structure
  // NOTE: Background style is applied to the Wrapper for full-page effect
  container.innerHTML = `
    <div class="ra-profile-wrapper" style="${bgStyle}">
      <!-- RetroAchievements Style Header (Now Transparent to show wrapper bg) -->
      <div class="ra-header">
        <div class="ra-header-overlay"></div>
        <div class="ra-header-content">
          
          <!-- Avatar with Custom CSS Overlay -->
          <!-- Increased z-index and adjusted margin to prevent cutoff -->
          <div class="ra-avatar-container" style="${avatarStyle}">
            <img src="${profile.avatar_url || 'https://ui-avatars.com/api/?name=' + profile.username}" 
                 alt="${profile.username}" 
                 class="${avatarClass}">
            <div class="ra-status-dot ${profile.is_online ? 'online' : 'offline'}"></div>
          </div>

          <!-- Info -->
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

          <!-- Edit Button (Only for Owner) -->
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

      <!-- Custom Signature Section (User Defined CSS & HTML) -->
      ${profile.signature_text ? `
        <div class="ra-signature-box" style="${profile.signature_custom_css || ''}">
          ${profile.signature_text}
        </div>
      ` : ''}

      <!-- Main Grid -->
      <div class="ra-grid">
        <div class="ra-col-main">
          <!-- About Card -->
          <div class="ra-card">
            <h3>About</h3>
            <p class="ra-bio">${profile.bio || 'No bio added yet.'}</p>
          </div>
          
          <!-- Currently Playing Section (NEW) -->
          <div class="ra-card">
            <h3>🎮 What I'm Playing Currently</h3>
            <div id="currently-playing-container">
              ${isOwnProfile ? `
                <div class="flex gap-2 mb-4">
                  <input type="text" id="new-game-input" placeholder="Enter game title..." class="ra-input flex-1">
                  <button id="btn-add-game" class="btn-primary whitespace-nowrap">Add Game</button>
                </div>
              ` : ''}
              
              <div id="currently-playing-list" class="grid grid-cols-2 md:grid-cols-3 gap-3">
                ${currentlyPlayingGames.length > 0 
                  ? currentlyPlayingGames.map((game, index) => `
                      <div class="relative group bg-gray-800/80 backdrop-blur-sm border border-gray-600 p-3 rounded-lg flex items-center gap-3">
                        <span class="text-cyan-400 text-xl">🎮</span>
                        <span class="text-sm font-bold text-gray-200 truncate flex-1">${game}</span>
                        ${isOwnProfile ? `
                          <button class="remove-game-btn opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300" data-index="${index}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          </button>
                        ` : ''}
                      </div>
                    `).join('')
                  : '<div class="col-span-full text-gray-500 italic text-center py-4">No games listed yet.</div>'
                }
              </div>
            </div>
          </div>

          <!-- Comment Wall / Shout Box -->
          <div class="ra-card">
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
          <!-- Friends List Card -->
          <div class="ra-card">
            <h3>Friends</h3>
            <div id="friends-list" class="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              <div class="text-sm text-gray-500 py-2">Loading friends...</div>
            </div>
            
            ${!isOwnProfile ? `
              <button id="btn-add-friend" class="w-full mt-3 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-sm transition-colors">
                Add Friend
              </button>
            ` : ''}
          </div>

          <!-- Details Card -->
          <div class="ra-card">
            <h3>Profile Details</h3>
            <ul class="ra-details-list text-sm space-y-2">
              <li><strong>Member Since:</strong> ${new Date(profile.created_at).toLocaleDateString()}</li>
              <li><strong>Favorite Console:</strong> ${profile.favorite_console || 'None'}</li>
              ${isUserAdmin ? '<li><strong>Role:</strong> <span class="text-red-400 font-bold">Admin</span></li>' : ''}
            </ul>
          </div>
        </div>
      </div>

      <!-- Edit Modal (Hidden by default, Only for Owner) -->
      ${isOwnProfile ? `
        <div id="edit-modal" class="ra-modal">
          <div class="ra-modal-content">
            <h2>Edit Profile Settings</h2>
            <form id="profile-form">
              
              <label>Bio</label>
              <textarea name="bio" class="ra-input" rows="3">${profile.bio || ''}</textarea>

              <hr class="border-gray-700 my-4">

              <label>Signature Content (HTML Allowed)</label>
              <textarea name="signature_text" class="ra-input" rows="3" placeholder="<b>Bold</b> text, images, etc.">${profile.signature_text || ''}</textarea>
              
              <label>Signature Custom CSS</label>
              <textarea name="signature_custom_css" class="ra-input font-mono text-xs" rows="4" placeholder="e.g. color: #0f0; text-shadow: 0 0 5px #0f0; border: 1px solid #333; padding: 10px;">${profile.signature_custom_css || ''}</textarea>
              <p class="text-xs text-gray-500 mt-1">Enter valid CSS properties to style your signature box.</p>

              <hr class="border-gray-700 my-4">

              <label>Avatar Overlay Custom CSS</label>
              <textarea name="avatar_custom_css" class="ra-input font-mono text-xs" rows="4" placeholder="e.g. box-shadow: 0 0 10px cyan; border: 2px solid white; filter: sepia(1);">${profile.avatar_custom_css || ''}</textarea>
              <p class="text-xs text-gray-500 mt-1">Enter valid CSS properties to style your avatar image.</p>

              <hr class="border-gray-700 my-4">

              <!-- NEW: Avatar Upload Section -->
              <label>Update Profile Picture</label>
              <input type="file" id="avatar_file_input" accept="image/*" class="ra-input">
              <p class="text-xs text-gray-500 mt-1">Upload a new avatar. Supports JPG, PNG, GIF.</p>
              <div class="mt-2">
                <img src="${profile.avatar_url || 'https://ui-avatars.com/api/?name=' + profile.username}" class="w-16 h-16 rounded-full border border-gray-600" alt="Current Avatar">
              </div>

              <hr class="border-gray-700 my-4">

              <label>Background Type</label>
              <select name="bg_type" id="bg_type" class="ra-input">
                <option value="color" ${profile.custom_background?.type === 'color' ? 'selected' : ''}>Solid Color</option>
                <option value="image" ${profile.custom_background?.type === 'image' ? 'selected' : ''}>Uploaded Image / GIF (Animated)</option>
                <option value="gradient" ${profile.custom_background?.type === 'gradient' ? 'selected' : ''}>Gradient</option>
              </select>

              <!-- NEW: File Upload Section (Visible only if 'image' is selected) -->
              <div id="bg-upload-container" style="display: ${profile.custom_background?.type === 'image' ? 'block' : 'none'}; margin-top: 15px;">
                <label class="block text-sm font-bold text-cyan-400 mb-1">Upload New Background</label>
                <input type="file" id="bg_file_input" accept="image/*" class="ra-input">
                <p class="text-xs text-gray-500 mt-1">Supports JPG, PNG, and <strong>GIF/WebP for animation</strong>. Uploading will replace the URL below.</p>
              </div>

              <label class="block mt-4">Background Value (URL or Color Code)</label>
              <input type="text" name="bg_value" id="bg_value_input" class="ra-input" value="${profile.custom_background?.value || '#1f2937'}" placeholder="#hex or https://...">

              <div class="modal-actions">
                <button type="button" id="btn-cancel-edit" class="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded transition-colors">Cancel</button>
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
// CSS GENERATORS
// ============================================================================

function getBackgroundCSS(bg) {
  if (!bg || !bg.type) return 'background-color: #111827;';
  
  const { type, value, opacity = 1 } = bg;
  let css = '';

  if (type === 'image') {
    // Supports animated GIFs/WebP naturally via standard CSS
    css = `background-image: url('${value}'); background-size: cover; background-position: center; background-attachment: fixed;`;
  } else if (type === 'gradient') {
    css = `background-image: ${value}; background-attachment: fixed;`;
  } else {
    css = `background-color: ${value};`;
  }
  
  return css;
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
  
  // Elements for Background Upload Toggle
  const bgTypeSelect = document.getElementById('bg_type');
  const bgUploadContainer = document.getElementById('bg-upload-container');

  if (editBtn && modal) {
    editBtn.addEventListener('click', () => {
      modal.style.display = 'flex';
    });
  }

  if (cancelBtn && modal) {
    cancelBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  // Toggle File Input based on Dropdown Selection
  if (bgTypeSelect && bgUploadContainer) {
    bgTypeSelect.addEventListener('change', (e) => {
      if (e.target.value === 'image') {
        bgUploadContainer.style.display = 'block';
      } else {
        bgUploadContainer.style.display = 'none';
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      
      let finalBgValue = formData.get('bg_value');
      const bgType = formData.get('bg_type');
      let finalAvatarUrl = profile.avatar_url;

      // --- HANDLE AVATAR UPLOAD ---
      const avatarInput = document.getElementById('avatar_file_input');
      if (avatarInput && avatarInput.files.length > 0) {
        const file = avatarInput.files[0];
        if (!file.type.startsWith('image/')) {
          alert('Please select a valid image file for avatar.');
          return;
        }
        const fileName = `${profile.id}/avatar_${Date.now()}_${file.name.replace(/\s/g, '_')}`;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        submitBtn.textContent = 'Uploading Avatar...';
        submitBtn.disabled = true;

        try {
          const { data, error } = await supabase.storage
            .from('user-backgrounds') // Reusing bucket or create 'avatars'
            .upload(fileName, file, { cacheControl: '3600', upsert: true });

          if (error) throw error;
          const { data: { publicUrl } } = supabase.storage.from('user-backgrounds').getPublicUrl(fileName);
          finalAvatarUrl = publicUrl;
        } catch (err) {
          alert('Avatar upload failed: ' + err.message);
          submitBtn.textContent = originalBtnText;
          submitBtn.disabled = false;
          return;
        }
      }

      // --- HANDLE BACKGROUND UPLOAD IF IMAGE TYPE SELECTED ---
      const fileInput = document.getElementById('bg_file_input');
      if (bgType === 'image' && fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        
        if (!file.type.startsWith('image/')) {
          alert('Please select a valid image file.');
          return;
        }

        const fileName = `${profile.id}/${Date.now()}_${file.name.replace(/\s/g, '_')}`;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        submitBtn.textContent = 'Uploading Background...';
        submitBtn.disabled = true;

        try {
          const { data, error } = await supabase.storage
            .from('user-backgrounds')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: true
            });

          if (error) throw error;

          const { data: { publicUrl } } = supabase.storage
            .from('user-backgrounds')
            .getPublicUrl(fileName);

          finalBgValue = publicUrl;

        } catch (err) {
          alert('Upload failed: ' + err.message);
          submitBtn.textContent = originalBtnText;
          submitBtn.disabled = false;
          return;
        }
      }
      // --------------------------------------------------

      const updates = {
        bio: formData.get('bio'),
        signature_text: formData.get('signature_text'),
        signature_custom_css: formData.get('signature_custom_css'),
        avatar_custom_css: formData.get('avatar_custom_css'),
        avatar_url: finalAvatarUrl, // Update avatar URL
        custom_background: {
          type: bgType,
          value: finalBgValue,
          opacity: 1,
          position: 'center',
          size: 'cover'
        }
      };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);

      if (error) {
        alert('Error saving: ' + error.message);
      } else {
        alert('Profile updated successfully!');
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
      
      if (!content) {
        alert('Please enter a message.');
        return;
      }

      const { error } = await supabase.from('profile_comments').insert({
        target_user_id: profile.id,
        author_id: currentUser.id,
        content: content
      });

      if (error) {
        alert('Error posting: ' + error.message);
      } else {
        input.value = ''; // Clear input
        loadWallComments(profile.id); // Reload list
      }
    });
  }

  // --- 4. Load Friends List ---
  if (isOwnProfile) {
    loadFriends(currentUser.id);
  } else {
    const friendsListEl = document.getElementById('friends-list');
    if (friendsListEl) {
      friendsListEl.innerHTML = '<div class="text-sm text-gray-400 italic py-2">Friends list is private.</div>';
    }
  }

  // --- 5. Add Friend Button ---
  const addFriendBtn = document.getElementById('btn-add-friend');
  if (addFriendBtn) {
    addFriendBtn.addEventListener('click', async () => {
      if (!confirm(`Send a friend request to ${profile.username}?`)) return;
      
      const { error } = await supabase.from('friends').insert({
        user_id: currentUser.id,
        friend_id: profile.id,
        status: 'pending'
      });

      if (error) {
        alert('Error sending request: ' + error.message);
      } else {
        alert('Friend request sent!');
        addFriendBtn.disabled = true;
        addFriendBtn.textContent = 'Request Sent';
        addFriendBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
    });
  }

  // --- 6. Currently Playing: Add Game ---
  const addGameBtn = document.getElementById('btn-add-game');
  if (addGameBtn) {
    addGameBtn.addEventListener('click', async () => {
      const input = document.getElementById('new-game-input');
      const gameTitle = input.value.trim();
      
      if (!gameTitle) {
        alert('Please enter a game title.');
        return;
      }

      // Get current list
      let currentGames = [];
      if (profile.currently_playing) {
        try {
          currentGames = typeof profile.currently_playing === 'string' 
            ? JSON.parse(profile.currently_playing) 
            : profile.currently_playing;
        } catch (e) { currentGames = []; }
      }

      // Add new game
      currentGames.push(gameTitle);

      // Update DB
      const { error } = await supabase
        .from('profiles')
        .update({ currently_playing: currentGames })
        .eq('id', profile.id);

      if (error) {
        alert('Error adding game: ' + error.message);
      } else {
        input.value = '';
        // Reload profile to reflect changes
        location.reload(); 
      }
    });
  }

  // --- 7. Currently Playing: Remove Game ---
  const removeGameBtns = document.querySelectorAll('.remove-game-btn');
  removeGameBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation(); // Prevent triggering parent clicks
      const index = parseInt(btn.getAttribute('data-index'));
      
      if (!confirm('Remove this game from your list?')) return;

      // Get current list
      let currentGames = [];
      if (profile.currently_playing) {
        try {
          currentGames = typeof profile.currently_playing === 'string' 
            ? JSON.parse(profile.currently_playing) 
            : profile.currently_playing;
        } catch (e) { currentGames = []; }
      }

      // Remove game at index
      if (index >= 0 && index < currentGames.length) {
        currentGames.splice(index, 1);
      }

      // Update DB
      const { error } = await supabase
        .from('profiles')
        .update({ currently_playing: currentGames })
        .eq('id', profile.id);

      if (error) {
        alert('Error removing game: ' + error.message);
      } else {
        location.reload();
      }
    });
  });
}

// ============================================================================
// SUB-FUNCTIONS FOR WALL & FRIENDS
// ============================================================================

async function loadWallComments(profileId) {
  const list = document.getElementById('wall-list');
  if (!list) return;

  const comments = await fetchWallComments(profileId);
  
  if (comments.length === 0) {
    list.innerHTML = '<div class="text-sm text-gray-500 italic py-4 text-center">No shouts yet. Be the first to say hello!</div>';
    return;
  }

  list.innerHTML = comments.map(c => {
    // Use helper to generate safe link
    const link = c.author ? getProfileLink(c.author) : '#/home';
    const displayName = c.author?.username || 'Unknown';
    const avatarSrc = c.author?.avatar_url || `https://ui-avatars.com/api/?name=${displayName}`;

    return `
    <div class="bg-gray-800/50 p-3 rounded border border-gray-700 flex gap-3 hover:bg-gray-800 transition-colors">
      <img src="${avatarSrc}" 
           class="w-8 h-8 rounded-full bg-gray-600 object-cover" 
           alt="${displayName}">
      <div class="flex-1">
        <div class="flex items-baseline gap-2">
          <span class="font-bold text-cyan-400 text-sm hover:underline cursor-pointer" onclick="window.location.hash='${link}'">
            ${displayName}
          </span>
          <span class="text-xs text-gray-500">${new Date(c.created_at).toLocaleDateString()}</span>
        </div>
        <p class="text-gray-300 text-sm mt-1 break-words">${c.content}</p>
      </div>
    </div>
  `}).join('');
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
    // Use helper to generate safe link
    const link = getProfileLink(f);
    const displayName = f.username || 'Unknown';
    const avatarSrc = f.avatar_url || `https://ui-avatars.com/api/?name=${displayName}`;

    return `
    <div class="flex items-center gap-2 p-2 hover:bg-gray-800 rounded cursor-pointer transition-colors" 
         onclick="window.location.hash='${link}'">
      <div class="relative">
        <img src="${avatarSrc}" 
             class="w-6 h-6 rounded-full object-cover">
        <div class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-gray-900 ${f.is_online ? 'bg-green-500' : 'bg-gray-500'}"></div>
      </div>
      <span class="text-sm text-gray-300 truncate flex-1">${displayName}</span>
    </div>
  `}).join('');
}
