import { supabase, checkIsAdmin } from '../../lib/supabase.js';

export async function initModule(container, params) {
  // 1. Identify User
  const targetUserId = params.id; // From URL hash e.g., #profile=uuid
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user?.id;
  const isOwnProfile = targetUserId === currentUserId;

  // 2. Initial UI Loading State
  container.innerHTML = `
    <div class="ra-profile-loading">
      <div class="ra-spinner"></div>
      <p>Loading Profile...</p>
    </div>
  `;

  // 3. Fetch Profile Data
  let { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', targetUserId)
    .single();

  if (error || !profile) {
    container.innerHTML = `
      <div class="ra-error-state">
        <h2>Profile Not Found</h2>
        <p>The user you are looking for doesn't exist or has been deleted.</p>
        <button onclick="window.location.hash='home'" class="ra-btn-primary">Go Home</button>
      </div>
    `;
    return;
  }

  // 4. Render Main Layout
  renderProfile(container, profile, isOwnProfile);

  // 5. Attach Event Listeners
  attachEventListeners(container, profile, isOwnProfile);
}

// --- RENDER FUNCTIONS ---

function renderProfile(container, profile, isOwnProfile) {
  const bgStyle = getBackgroundStyle(profile.custom_background);
  const avatarUrl = profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.username}&background=06b6d4&color=fff`;
  
  container.innerHTML = `
    <!-- RA Style Header -->
    <div class="ra-profile-header" style="${bgStyle}">
      <div class="ra-header-overlay"></div>
      <div class="ra-header-content">
        
        <!-- Avatar (Overlapping) -->
        <div class="ra-avatar-wrapper">
          <img src="${avatarUrl}" alt="${profile.username}" class="ra-avatar ${profile.avatar_overlay ? 'overlay-' + profile.avatar_overlay : ''}">
          ${profile.is_online ? '<span class="ra-status-dot"></span>' : ''}
        </div>

        <!-- Info & Stats -->
        <div class="ra-header-info">
          <h1 class="ra-username">${profile.username}</h1>
          ${profile.display_name ? `<div class="ra-display-name">${profile.display_name}</div>` : ''}
          
          <div class="ra-stats-bar">
            <div class="ra-stat">
              <span class="ra-stat-icon">🎮</span>
              <div class="ra-stat-details">
                <span class="ra-stat-val">${profile.stats?.games_played || 0}</span>
                <span class="ra-stat-label">Games</span>
              </div>
            </div>
            <div class="ra-stat-divider"></div>
            <div class="ra-stat">
              <span class="ra-stat-icon">🏆</span>
              <div class="ra-stat-details">
                <span class="ra-stat-val">${profile.stats?.total_points || 0}</span>
                <span class="ra-stat-label">Points</span>
              </div>
            </div>
            <div class="ra-stat-divider"></div>
            <div class="ra-stat">
              <span class="ra-stat-icon">⭐</span>
              <div class="ra-stat-details">
                <span class="ra-stat-val">${profile.stats?.achievements_unlocked || 0}</span>
                <span class="ra-stat-label">Achievements</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Edit Button -->
        ${isOwnProfile ? `
          <button id="btn-open-edit" class="ra-edit-btn" title="Edit Profile">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Signature Section -->
    ${profile.signature_text ? `
      <div class="ra-signature-box sig-${profile.signature_style || 'none'}">
        <div class="ra-signature-inner">${profile.signature_text}</div>
      </div>
    ` : ''}

    <!-- Main Content Grid -->
    <div class="ra-content-grid">
      <!-- Left Column: Bio & Activity -->
      <div class="ra-col-left">
        <div class="ra-card">
          <h3 class="ra-card-title">About</h3>
          <div class="ra-card-body">
            ${profile.bio ? `<p>${profile.bio.replace(/\n/g, '<br>')}</p>` : '<p class="text-muted">No bio written yet.</p>'}
          </div>
        </div>

        <div class="ra-card">
          <h3 class="ra-card-title">Recent Activity</h3>
          <div class="ra-card-body" id="activity-feed">
            <p class="text-muted">Loading activity...</p>
          </div>
        </div>
      </div>

      <!-- Right Column: Friends & Info -->
      <div class="ra-col-right">
        <div class="ra-card">
          <h3 class="ra-card-title">Friends</h3>
          <div class="ra-card-body" id="friends-list">
            <p class="text-muted">Loading friends...</p>
          </div>
        </div>
        
        ${isOwnProfile || await checkIsAdmin() ? `
        <div class="ra-card">
          <h3 class="ra-card-title">Account Info</h3>
          <div class="ra-card-body">
            <div class="info-row"><span>Email:</span> <span>${profile.email || 'Hidden'}</span></div>
            <div class="info-row"><span>Joined:</span> <span>${new Date(profile.created_at).toLocaleDateString()}</span></div>
          </div>
        </div>
        ` : ''}
      </div>
    </div>

    <!-- Edit Modal (Hidden by default) -->
    ${isOwnProfile ? `
      <div id="edit-modal" class="ra-modal">
        <div class="ra-modal-content">
          <div class="ra-modal-header">
            <h2>Edit Profile</h2>
            <button id="btn-close-edit" class="ra-modal-close">&times;</button>
          </div>
          <form id="profile-edit-form">
            <div class="form-group">
              <label>Display Name</label>
              <input type="text" id="edit-display-name" value="${profile.display_name || ''}">
            </div>
            
            <div class="form-group">
              <label>Bio</label>
              <textarea id="edit-bio" rows="4">${profile.bio || ''}</textarea>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Signature (HTML allowed)</label>
                <textarea id="edit-signature" rows="3">${profile.signature_text || ''}</textarea>
              </div>
              <div class="form-group">
                <label>Signature Effect</label>
                <select id="edit-signature-style">
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
                  <option value="none" ${profile.avatar_overlay === 'none' ? 'selected' : ''}>None</option>
                  <option value="crt" ${profile.avatar_overlay === 'crt' ? 'selected' : ''}>CRT Scanlines</option>
                  <option value="neon" ${profile.avatar_overlay === 'neon' ? 'selected' : ''}>Neon Border</option>
                  <option value="badge" ${profile.avatar_overlay === 'badge' ? 'selected' : ''}>Corner Badge</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Custom Background</label>
              <div class="bg-controls">
                <select id="edit-bg-type">
                  <option value="color" ${!profile.custom_background || profile.custom_background.type === 'color' ? 'selected' : ''}>Solid Color</option>
                  <option value="gradient" ${profile.custom_background?.type === 'gradient' ? 'selected' : ''}>Gradient</option>
                  <option value="image" ${profile.custom_background?.type === 'image' ? 'selected' : ''}>Image URL</option>
                </select>
                <input type="text" id="edit-bg-value" placeholder="#hex or url(...)" value="${profile.custom_background?.value || '#1f2937'}">
              </div>
            </div>

            <div class="form-actions">
              <button type="button" id="btn-cancel-edit" class="ra-btn-secondary">Cancel</button>
              <button type="submit" class="ra-btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      </div>
    ` : ''}
  `;

  // Load Async Content (Activity/Friends)
  loadActivityFeed(profile.id);
  loadFriendsList(profile.id);
}

// --- HELPER FUNCTIONS ---

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

async function loadActivityFeed(userId) {
  const container = document.getElementById('activity-feed');
  if (!container) return;
  
  // Placeholder logic - replace with real query if table exists
  container.innerHTML = `<p class="text-muted">No recent activity recorded.</p>`;
}

async function loadFriendsList(userId) {
  const container = document.getElementById('friends-list');
  if (!container) return;

  const { data, error } = await supabase
    .from('profile_friends') // Using your specific table name
    .select('friend_id, profiles(username, avatar_url)')
    .eq('user_id', userId)
    .eq('status', 'accepted')
    .limit(5);

  if (error || !data || data.length === 0) {
    container.innerHTML = `<p class="text-muted">No friends yet.</p>`;
    return;
  }

  container.innerHTML = data.map(f => `
    <div class="friend-item">
      <img src="${f.profiles.avatar_url || 'https://ui-avatars.com/api/?name=' + f.profiles.username}" class="friend-avatar">
      <span>${f.profiles.username}</span>
    </div>
  `).join('');
}

function attachEventListeners(container, profile, isOwnProfile) {
  if (!isOwnProfile) return;

  const modal = document.getElementById('edit-modal');
  const openBtn = document.getElementById('btn-open-edit');
  const closeBtn = document.getElementById('btn-close-edit');
  const cancelBtn = document.getElementById('btn-cancel-edit');
  const form = document.getElementById('profile-edit-form');

  // Modal Logic
  if (openBtn && modal) openBtn.addEventListener('click', () => modal.style.display = 'flex');
  const closeModal = () => { if(modal) modal.style.display = 'none'; };
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  // Form Submit
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = form.querySelector('button[type="submit"]');
      const originalText = saveBtn.innerText;
      saveBtn.innerText = 'Saving...';
      saveBtn.disabled = true;

      const updates = {
        display_name: document.getElementById('edit-display-name').value,
        bio: document.getElementById('edit-bio').value,
        signature_text: document.getElementById('edit-signature').value,
        signature_style: document.getElementById('edit-signature-style').value,
        avatar_overlay: document.getElementById('edit-avatar-overlay').value,
        custom_background: {
          type: document.getElementById('edit-bg-type').value,
          value: document.getElementById('edit-bg-value').value,
          position: 'center',
          size: 'cover'
        }
      };

      const { error } = await supabase.from('profiles').update(updates).eq('id', profile.id);

      if (error) {
        alert('Error saving: ' + error.message);
        saveBtn.innerText = originalText;
        saveBtn.disabled = false;
      } else {
        location.reload(); // Simple reload to reflect changes
      }
    });
  }
}
