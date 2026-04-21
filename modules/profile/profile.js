import { supabase, isAdmin } from '../../lib/supabase.js';

export async function initModule(container, params) {
  // --- SELF-HEALING CONTAINER CHECK ---
  // If container isn't passed or is invalid, grab #app-content directly
  let targetContainer = container;
  if (!targetContainer || !(targetContainer instanceof Element)) {
    console.warn('⚠️ Profile Module: Container not provided. Grabbing #app-content directly.');
    targetContainer = document.getElementById('app-content');
  }
  
  if (!targetContainer) {
    console.error('❌ CRITICAL: Could not find #app-content to render profile.');
    return;
  }

  // Show loading state immediately
  targetContainer.innerHTML = `
    <div class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      <p class="text-cyan-400 mt-4">Loading Profile...</p>
    </div>
  `;

  try {
    // 1. Identify User
    let targetUser = null;
    const slugOrId = params?.id || params?.slug; 
    
    // Get Current User Context
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    if (!slugOrId) {
      // No param? Default to current logged-in user
      if (!currentUser) {
        targetContainer.innerHTML = `
          <div class="text-center p-10 bg-gray-800 rounded-lg border border-red-500">
            <h2 class="text-2xl font-bold text-red-400 mb-2">Access Denied</h2>
            <p class="text-gray-300">Please log in to view your profile.</p>
            <button onclick="window.location.hash='#/auth'" class="mt-4 bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded">Log In</button>
          </div>
        `;
        return;
      }
      targetUser = await fetchProfileByUserId(currentUser.id);
    } else {
      // Param exists? Try fetching by Slug (username) first, then ID
      targetUser = await fetchProfileBySlug(slugOrId);
      if (!targetUser) {
        targetUser = await fetchProfileByUserId(slugOrId);
      }
    }

    if (!targetUser) {
      targetContainer.innerHTML = `
        <div class="text-center p-10 bg-gray-800 rounded-lg border border-yellow-500">
          <h2 class="text-2xl font-bold text-yellow-400 mb-2">Profile Not Found</h2>
          <p class="text-gray-300">We couldn't find a user with that name or ID.</p>
          <button onclick="window.location.hash='#/games'" class="mt-4 bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded">Back to Games</button>
        </div>
      `;
      return;
    }

    const isOwnProfile = currentUser && currentUser.id === targetUser.id;
    
    // Safe Admin Check (renamed variable to avoid conflict)
    let isUserAdmin = false;
    try {
      isUserAdmin = await isAdmin();
    } catch (e) {
      console.warn('Admin check failed, assuming non-admin', e);
    }

    // 2. Render the Layout
    renderProfileLayout(targetContainer, targetUser, isOwnProfile, isUserAdmin);

    // 3. Attach Event Listeners
    attachEventListeners(targetContainer, targetUser, isOwnProfile);

  } catch (error) {
    console.error('❌ Profile Module Critical Error:', error);
    targetContainer.innerHTML = `
      <div class="text-center p-10 bg-gray-800 rounded-lg border border-red-500">
        <h2 class="text-2xl font-bold text-red-400 mb-2">Error Loading Profile</h2>
        <p class="text-gray-300">${error.message}</p>
        <pre class="text-xs text-left bg-black p-2 mt-4 overflow-auto max-h-40">${error.stack}</pre>
      </div>
    `;
  }
}

// --- Data Fetching Helpers ---

async function fetchProfileBySlug(slug) {
  // Try matching 'username' OR 'slug' column if it exists
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', slug) 
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

// --- Rendering Logic ---

function renderProfileLayout(container, profile, isOwnProfile, isAdmin) {
  const bgStyle = getBackgroundCSS(profile.custom_background);
  const avatarClass = profile.avatar_overlay && profile.avatar_overlay !== 'none' 
    ? `ra-avatar overlay-${profile.avatar_overlay}` 
    : 'ra-avatar';

  // NOTE: We are writing directly to container.innerHTML
  container.innerHTML = `
    <!-- RetroAchievements Style Header -->
    <div class="ra-header" style="${bgStyle}">
      <div class="ra-header-overlay"></div>
      <div class="ra-header-content">
        
        <!-- Avatar -->
        <div class="ra-avatar-container">
          <img src="${profile.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(profile.username)}" 
               alt="${profile.username}" 
               class="${avatarClass}"
               onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(profile.username)}&background=06b6d4&color=fff'">
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

        <!-- Edit Button -->
        ${isOwnProfile ? `
          <button id="btn-edit-profile" class="ra-edit-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Signature Section -->
    ${profile.signature_text ? `
      <div class="ra-signature-box sig-effect-${profile.signature_style || 'none'}">
        ${profile.signature_text}
      </div>
    ` : ''}

    <!-- Main Grid -->
    <div class="ra-grid">
      <div class="ra-col-main">
        <div class="ra-card">
          <h3>About</h3>
          <p class="ra-bio">${profile.bio || 'No bio added yet.'}</p>
        </div>
        
        <div class="ra-card">
          <h3>Recent Activity</h3>
          <div id="activity-feed">
            <p class="text-gray-500 italic">No recent activity recorded.</p>
          </div>
        </div>
      </div>

      <div class="ra-col-side">
        <div class="ra-card">
          <h3>Details</h3>
          <ul class="ra-details-list">
            <li><strong>Member Since:</strong> ${new Date(profile.created_at).toLocaleDateString()}</li>
            <li><strong>Favorite Console:</strong> ${profile.favorite_console || 'None'}</li>
            ${isAdmin ? '<li><strong>Role:</strong> <span class="text-red-400 font-bold">👑 Admin</span></li>' : ''}
          </ul>
        </div>
      </div>
    </div>

    <!-- Edit Modal (Hidden by default) -->
    ${isOwnProfile ? `
      <div id="edit-modal" class="ra-modal">
        <div class="ra-modal-content">
          <h2>Edit Profile</h2>
          <form id="profile-form">
            <label>Bio</label>
            <textarea name="bio">${profile.bio || ''}</textarea>

            <label>Signature (HTML allowed)</label>
            <textarea name="signature_text">${profile.signature_text || ''}</textarea>

            <label>Signature Effect</label>
            <select name="signature_style">
              <option value="none" ${profile.signature_style === 'none' ? 'selected' : ''}>None</option>
              <option value="glow" ${profile.signature_style === 'glow' ? 'selected' : ''}>Neon Glow</option>
              <option value="pulse" ${profile.signature_style === 'pulse' ? 'selected' : ''}>Pulse</option>
              <option value="retro" ${profile.signature_style === 'retro' ? 'selected' : ''}>Retro Terminal</option>
            </select>

            <label>Avatar Overlay</label>
            <select name="avatar_overlay">
              <option value="none" ${profile.avatar_overlay === 'none' ? 'selected' : ''}>None</option>
              <option value="crt" ${profile.avatar_overlay === 'crt' ? 'selected' : ''}>CRT Scanlines</option>
              <option value="neon" ${profile.avatar_overlay === 'neon' ? 'selected' : ''}>Neon Border</option>
            </select>

            <label>Background Type</label>
            <select name="bg_type" id="bg_type">
              <option value="color" ${profile.custom_background?.type === 'color' ? 'selected' : ''}>Solid Color</option>
              <option value="image" ${profile.custom_background?.type === 'image' ? 'selected' : ''}>Image URL</option>
              <option value="gradient" ${profile.custom_background?.type === 'gradient' ? 'selected' : ''}>Gradient</option>
            </select>

            <label>Background Value (Color Code, URL, or Gradient)</label>
            <input type="text" name="bg_value" value="${profile.custom_background?.value || '#1f2937'}">

            <div class="modal-actions">
              <button type="button" id="btn-cancel-edit">Cancel</button>
              <button type="submit" class="btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      </div>
    ` : ''}
  `;
}

// --- CSS Generator ---

function getBackgroundCSS(bg) {
  if (!bg || !bg.type) return 'background-color: #111827;';
  
  const { type, value, opacity = 1 } = bg;
  let css = '';

  if (type === 'image') {
    css = `background-image: url('${value}'); background-size: cover; background-position: center;`;
  } else if (type === 'gradient') {
    css = `background-image: ${value};`;
  } else {
    css = `background-color: ${value};`;
  }
  
  return css;
}

// --- Event Listeners ---

function attachEventListeners(container, profile, isOwnProfile) {
  // Edit Modal Logic
  const editBtn = document.getElementById('btn-edit-profile');
  const modal = document.getElementById('edit-modal');
  const cancelBtn = document.getElementById('btn-cancel-edit');
  const form = document.getElementById('profile-form');

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

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      
      const updates = {
        bio: formData.get('bio'),
        signature_text: formData.get('signature_text'),
        signature_style: formData.get('signature_style'),
        avatar_overlay: formData.get('avatar_overlay'),
        custom_background: {
          type: formData.get('bg_type'),
          value: formData.get('bg_value'),
          opacity: 1,
          position: 'center',
          size: 'cover'
        }
      };

      const saveBtn = form.querySelector('button[type="submit"]');
      const originalText = saveBtn.textContent;
      saveBtn.textContent = 'Saving...';
      saveBtn.disabled = true;

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);

      if (error) {
        alert('Error saving: ' + error.message);
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
      } else {
        alert('Profile updated! Refreshing...');
        location.reload();
      }
    });
  }
}
