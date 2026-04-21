import { supabase, checkIsAdmin } from '../../lib/supabase.js';

export async function initModule(container, params) {
  // Determine which user to load (from URL param or current user)
  const requestedSlug = params.id; 
  let targetUser = null;
  let isOwnProfile = false;
  const currentUser = window.rom?.currentUser;

  container.innerHTML = `<div class="loading-spinner">Loading Profile...</div>`;

  try {
    // 1. Fetch Profile Data
    let query = supabase.from('profiles').select('*');
    
    if (requestedSlug) {
      query = query.eq('slug', requestedSlug);
    } else if (currentUser) {
      query = query.eq('id', currentUser.id); // Fallback to ID if no slug provided
    } else {
      container.innerHTML = `<div class="error-msg">Please log in or provide a username.</div>`;
      return;
    }

    const { data: profile, error: profileError } = await query.single();

    if (profileError || !profile) {
      container.innerHTML = `<div class="error-msg">Profile not found!</div>`;
      console.error("Profile Error:", profileError);
      return;
    }

    targetUser = profile;
    isOwnProfile = currentUser && (currentUser.id === profile.id || currentUser.email === profile.email);

    // 2. Render the UI
    renderProfile(container, targetUser, isOwnProfile);

  } catch (err) {
    console.error("Failed to load profile:", err);
    container.innerHTML = `<div class="error-msg">Error loading profile.</div>`;
  }
}

// --- RENDER FUNCTION ---
function renderProfile(container, profile, isOwnProfile) {
  const bgStyle = getBackgroundStyle(profile.custom_background);
  const avatarClass = profile.avatar_overlay && profile.avatar_overlay !== 'none' ? `avatar-overlay-${profile.avatar_overlay}` : '';
  
  // Signature Class
  const sigClass = profile.signature_style && profile.signature_style !== 'none' ? `sig-effect-${profile.signature_style}` : '';

  container.innerHTML = `
    <div class="ra-profile-wrapper">
      
      <!-- HEADER SECTION -->
      <div class="ra-header" style="${bgStyle}">
        <div class="ra-header-shade"></div>
        <div class="ra-header-content">
          
          <!-- Avatar -->
          <div class="ra-avatar-container ${avatarClass}">
            <img src="${profile.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(profile.username)}" 
                 alt="${profile.username}" 
                 class="ra-avatar-img">
            <span class="status-dot ${profile.is_online ? 'online' : 'offline'}"></span>
          </div>

          <!-- Info -->
          <div class="ra-info-section">
            <h1 class="ra-username">${profile.username}</h1>
            ${profile.display_name ? `<div class="ra-display-name">${profile.display_name}</div>` : ''}
            
            <!-- Stats Bar -->
            <div class="ra-stats-row">
              <div class="ra-stat">
                <span class="stat-icon">🎮</span>
                <div class="stat-data">
                  <span class="stat-num">${profile.stats?.games_played || 0}</span>
                  <span class="stat-label">Games</span>
                </div>
              </div>
              <div class="ra-stat">
                <span class="stat-icon">🏆</span>
                <div class="stat-data">
                  <span class="stat-num">${profile.stats?.total_points || 0}</span>
                  <span class="stat-label">Points</span>
                </div>
              </div>
              <div class="ra-stat">
                <span class="stat-icon">⭐</span>
                <div class="stat-data">
                  <span class="stat-num">${profile.stats?.achievements_unlocked || 0}</span>
                  <span class="stat-label">Achievements</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Edit Button -->
          ${isOwnProfile ? `
            <button id="btn-open-edit" class="ra-edit-btn" title="Edit Profile">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
          ` : ''}
        </div>
      </div>

      <!-- SIGNATURE SECTION -->
      ${profile.signature_text ? `
        <div class="ra-signature-box ${sigClass}">
          ${profile.signature_text}
        </div>
      ` : ''}

      <!-- MAIN CONTENT GRID -->
      <div class="ra-content-grid">
        <div class="ra-col-left">
          <div class="ra-card">
            <h3>About Me</h3>
            <p class="ra-bio-text">${profile.bio || '<em>No bio written yet.</em>'}</p>
          </div>
          
          <div class="ra-card">
            <h3>Recent Activity</h3>
            <div id="activity-feed" class="ra-activity-list">
              <p class="text-muted">No recent activity.</p>
            </div>
          </div>
        </div>

        <div class="ra-col-right">
          <div class="ra-card">
            <h3>Friends</h3>
            <div id="friends-list" class="ra-friends-list">
              <p class="text-muted">Loading friends...</p>
            </div>
          </div>
          
          <div class="ra-card">
            <h3>Favorite Console</h3>
            <p>${profile.favorite_console || 'Not specified'}</p>
          </div>
        </div>
      </div>

      <!-- EDIT MODAL (Hidden by default) -->
      ${isOwnProfile ? `
        <div id="edit-modal" class="ra-modal-overlay" style="display:none;">
          <div class="ra-modal-content">
            <div class="ra-modal-header">
              <h2>Edit Profile</h2>
              <button id="btn-close-edit" class="ra-modal-close">&times;</button>
            </div>
            
            <form id="profile-edit-form" class="ra-form">
              
              <div class="form-group">
                <label>Display Name</label>
                <input type="text" id="edit-display-name" value="${profile.display_name || ''}">
              </div>

              <div class="form-group">
                <label>Bio</label>
                <textarea id="edit-bio" rows="4">${profile.bio || ''}</textarea>
              </div>

              <div class="form-group">
                <label>Favorite Console</label>
                <input type="text" id="edit-fav-console" value="${profile.favorite_console || ''}">
              </div>

              <hr class="ra-divider">

              <div class="form-row">
                <div class="form-group">
                  <label>Signature Text (HTML allowed)</label>
                  <textarea id="edit-signature" rows="3">${profile.signature_text || ''}</textarea>
                </div>
                <div class="form-group">
                  <label>Signature Effect</label>
                  <select id="edit-sig-style">
                    <option value="none" ${profile.signature_style === 'none' ? 'selected' : ''}>None</option>
                    <option value="glow" ${profile.signature_style === 'glow' ? 'selected' : ''}>Neon Glow</option>
                    <option value="pulse" ${profile.signature_style === 'pulse' ? 'selected' : ''}>Pulse</option>
                    <option value="rainbow" ${profile.signature_style === 'rainbow' ? 'selected' : ''}>Rainbow</option>
                    <option value="retro" ${profile.signature_style === 'retro' ? 'selected' : ''}>Retro Terminal</option>
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Avatar Overlay</label>
                  <select id="edit-avatar-overlay">
                    <option value="none" ${!profile.avatar_overlay || profile.avatar_overlay === 'none' ? 'selected' : ''}>None</option>
                    <option value="crt" ${profile.avatar_overlay === 'crt' ? 'selected' : ''}>CRT Scanlines</option>
                    <option value="neon" ${profile.avatar_overlay === 'neon' ? 'selected' : ''}>Neon Border</option>
                    <option value="badge" ${profile.avatar_overlay === 'badge' ? 'selected' : ''}>Corner Badge</option>
                  </select>
                </div>
              </div>

              <hr class="ra-divider">
              <h4>Custom Background</h4>
              
              <div class="form-row">
                <div class="form-group">
                  <label>Type</label>
                  <select id="edit-bg-type">
                    <option value="color" ${!profile.custom_background || profile.custom_background.type === 'color' ? 'selected' : ''}>Solid Color</option>
                    <option value="gradient" ${profile.custom_background?.type === 'gradient' ? 'selected' : ''}>Gradient</option>
                    <option value="image" ${profile.custom_background?.type === 'image' ? 'selected' : ''}>Image URL</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Value (Color Code, Gradient, or URL)</label>
                  <input type="text" id="edit-bg-value" value="${profile.custom_background?.value || '#1f2937'}" placeholder="#hex or url(...)">
                </div>
              </div>

              <div class="form-actions">
                <button type="button" id="btn-cancel-edit" class="btn-secondary">Cancel</button>
                <button type="submit" class="btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  // --- EVENT LISTENERS ---
  setupEventListeners(profile, isOwnProfile);
  
  // Load sub-data (Friends, Activity)
  loadFriends(profile.id);
  loadActivity(profile.id);
}

function setupEventListeners(profile, isOwnProfile) {
  if (!isOwnProfile) return;

  const modal = document.getElementById('edit-modal');
  const openBtn = document.getElementById('btn-open-edit');
  const closeBtn = document.getElementById('btn-close-edit');
  const cancelBtn = document.getElementById('btn-cancel-edit');
  const form = document.getElementById('profile-edit-form');

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      modal.style.display = 'flex';
    });
  }

  const closeModal = () => {
    if (modal) modal.style.display = 'none';
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveProfileChanges(profile.id);
      closeModal();
      // Reload module to show changes
      setTimeout(() => window.location.hash = `profile/${profile.slug || profile.username}`, 100);
    });
  }
}

async function saveProfileChanges(userId) {
  const bgType = document.getElementById('edit-bg-type').value;
  const bgValue = document.getElementById('edit-bg-value').value;
  
  const updates = {
    display_name: document.getElementById('edit-display-name').value,
    bio: document.getElementById('edit-bio').value,
    favorite_console: document.getElementById('edit-fav-console').value,
    signature_text: document.getElementById('edit-signature').value,
    signature_style: document.getElementById('edit-sig-style').value,
    avatar_overlay: document.getElementById('edit-avatar-overlay').value,
    custom_background: {
      type: bgType,
      value: bgValue,
      opacity: 1,
      position: 'center',
      size: 'cover'
    },
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);

  if (error) {
    alert('Error saving: ' + error.message);
  } else {
    alert('Profile updated successfully!');
  }
}

function getBackgroundStyle(bg) {
  if (!bg || !bg.type) return 'background-color: #1f2937;';
  
  const { type, value, position = 'center', size = 'cover' } = bg;
  
  if (type === 'image') {
    return `background-image: url('${value}'); background-size: ${size}; background-position: ${position}; background-color: #111;`;
  } else if (type === 'gradient') {
    return `background-image: ${value}; background-color: transparent;`;
  } else {
    return `background-color: ${value}; background-image: none;`;
  }
}

async function loadFriends(userId) {
  const list = document.getElementById('friends-list');
  if (!list) return;
  
  // Placeholder logic - replace with actual friend table query
  list.innerHTML = `<p class="text-muted">Friend system loading...</p>`;
}

async function loadActivity(userId) {
  const feed = document.getElementById('activity-feed');
  if (!feed) return;
  
  feed.innerHTML = `<p class="text-muted">No recent activity.</p>`;
}
