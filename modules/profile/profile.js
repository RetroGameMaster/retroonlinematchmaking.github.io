import { supabase, isAdmin } from '../../lib/supabase.js';

export async function initModule(container, params) {
  // 1. Identify User (by Slug or ID)
  let targetUser = null;
  const slugOrId = params.id || params.slug; 
  
  if (!slugOrId) {
    // Default to current user if no param
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      container.innerHTML = '<div class="text-center p-10">Please log in to view your profile.</div>';
      return;
    }
    targetUser = await fetchProfileByUserId(user.id);
  } else {
    // Try fetching by Slug first, then fallback to ID
    targetUser = await fetchProfileBySlug(slugOrId);
    if (!targetUser) {
      targetUser = await fetchProfileByUserId(slugOrId);
    }
  }

  if (!targetUser) {
    container.innerHTML = '<div class="text-center p-10 text-red-400">Profile not found.</div>';
    return;
  }

  const { data: { user: currentUser } } = await supabase.auth.getUser();
  const isOwnProfile = currentUser && currentUser.id === targetUser.id;
  const isAdmin = await isAdmin();

  // 2. Render the RA-Style Layout
  renderProfileLayout(container, targetUser, isOwnProfile, isAdmin);

  // 3. Attach Event Listeners
  attachEventListeners(container, targetUser, isOwnProfile);
}

// --- Data Fetching Helpers ---

async function fetchProfileBySlug(slug) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', slug) // Assuming username acts as slug
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

  container.innerHTML = `
    <!-- RetroAchievements Style Header -->
    <div class="ra-header" style="${bgStyle}">
      <div class="ra-header-overlay"></div>
      <div class="ra-header-content">
        
        <!-- Avatar -->
        <div class="ra-avatar-container">
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
          <div id="activity-feed">Loading activity...</div>
        </div>
      </div>

      <div class="ra-col-side">
        <div class="ra-card">
          <h3>Details</h3>
          <ul class="ra-details-list">
            <li><strong>Member Since:</strong> ${new Date(profile.created_at).toLocaleDateString()}</li>
            <li><strong>Favorite Console:</strong> ${profile.favorite_console || 'None'}</li>
            ${isAdmin ? '<li><strong>Role:</strong> <span class="text-red-400">Admin</span></li>' : ''}
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
  
  // Note: Opacity is handled by an overlay div in CSS to keep text readable
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

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);

      if (error) {
        alert('Error saving: ' + error.message);
      } else {
        alert('Profile updated!');
        location.reload();
      }
    });
  }
}
