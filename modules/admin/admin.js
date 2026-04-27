// modules/admin/admin.js - COMPLETE FIXED VERSION (FULL LENGTH)
import { supabase, getCurrentUser, isAdmin } from '../../lib/supabase.js';

let allGames = [];
let currentDeleteGameId = null;
let currentUser = null;

export function initModule() {
  console.log('👑 Admin module initialized');
  loadAdminPanel();
}

// Global function for standalone editing
window.adminEditGame = async function(gameId) {
  try {
    const { data: game, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (error || !game) {
      alert('Game not found');
      return;
    }

    const user = await getCurrentUser();
    if (!user) {
      window.location.hash = '#/auth';
      return;
    }

    const canEdit = await checkEditPermission(user, game);
    if (!canEdit) {
      alert('You do not have permission to edit this game.');
      return;
    }

    const appContent = document.getElementById('app-content');
    if (!appContent) return;

    appContent.innerHTML = `
      <div class="max-w-6xl mx-auto p-4">
        <div class="mb-6">
          <a href="#/games" class="inline-flex items-center text-cyan-400 hover:text-cyan-300">
            ← Back to Games
          </a>
        </div>
        <div id="edit-game-container" class="bg-gray-800 rounded-lg p-6 border border-gray-700"></div>
      </div>
    `;

    const editFormHtml = createGameEditForm(game);
    document.getElementById('edit-game-container').innerHTML = editFormHtml;
    setupGameEditForm(game);

  } catch (error) {
    console.error('Failed to load game editor:', error);
    alert('Error: ' + error.message);
  }
};

async function loadAdminPanel() {
  currentUser = await getCurrentUser();
  if (!currentUser) {
    window.location.hash = '#/auth';
    return;
  }

  const adminStatus = await isAdmin();
  if (!adminStatus) {
    alert('Admin access required');
    window.location.hash = '#/';
    return;
  }

  document.getElementById('app-content').innerHTML = `
    <div class="max-w-7xl mx-auto p-4">
      <h1 class="text-3xl font-bold text-white mb-6">👑 Admin Panel</h1>
      
      <!-- Navigation Tabs -->
      <div class="mb-6 border-b border-gray-700">
        <nav class="flex flex-wrap -mb-px">
    <button id="tab-submissions" class="admin-tab active py-3 px-4 font-medium text-sm border-b-2 border-cyan-500 text-cyan-500">
        📥 Submissions (0)
    </button>
    <button id="tab-games" class="admin-tab py-3 px-4 font-medium text-sm border-b-2 border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300">
        🎮 Games (0)
    </button>
    <button id="tab-achievements" class="admin-tab py-3 px-4 font-medium text-sm border-b-2 border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300">
    🏆 Game Achievements
</button>
<button id="tab-awards" class="admin-tab py-3 px-4 font-medium text-sm border-b-2 border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300">
    🎖️ Award Manager
</button>
<button id="tab-admins" class="admin-tab py-3 px-4 font-medium text-sm border-b-2 border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300">
    👑 Admins
</button>
    <button id="tab-users" class="admin-tab py-3 px-4 font-medium text-sm border-b-2 border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300">
        👥 Users
    </button>
</nav>
      </div>
      
      <!-- Quick Actions -->
      <div class="mb-6" id="admin-actions">
        <button id="refresh-btn" class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded mr-3">
          🔄 Refresh
        </button>
        <button id="test-submission-btn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
          🧪 Create Test Submission
        </button>
      </div>
      
      <!-- Stats -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="bg-gray-800 p-6 rounded-lg border border-cyan-500">
          <h3 class="text-xl font-bold text-cyan-300 mb-2">Pending</h3>
          <p class="text-4xl font-bold text-white" id="pending-count">0</p>
        </div>
        <div class="bg-gray-800 p-6 rounded-lg border border-purple-500">
          <h3 class="text-xl font-bold text-purple-300 mb-2">Total Games</h3>
          <p class="text-4xl font-bold text-white" id="total-games">0</p>
        </div>
        <div class="bg-gray-800 p-6 rounded-lg border border-yellow-500">
          <h3 class="text-xl font-bold text-yellow-300 mb-2">Total Users</h3>
          <p class="text-4xl font-bold text-white" id="total-users">0</p>
        </div>
        <div class="bg-gray-800 p-6 rounded-lg border border-green-500">
          <h3 class="text-xl font-bold text-green-300 mb-2">Admins</h3>
          <p class="text-4xl font-bold text-white" id="admin-count">0</p>
        </div>
      </div>
      
      <!-- Main Content Area -->
      <div id="admin-content" class="bg-gray-800 rounded-lg p-6 border border-gray-700 min-h-[400px]">
        <div class="text-center py-8">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
          <p class="text-gray-400 mt-2">Loading admin data...</p>
        </div>
      </div>
    </div>
  `;

  // Setup tab listeners
  setupTabListeners();

  // Setup event listeners
  document.getElementById('refresh-btn').addEventListener('click', () => {
    const activeTab = document.querySelector('.admin-tab.active').id;
    switch(activeTab) {
      case 'tab-submissions':
        loadPendingSubmissions();
        break;
      case 'tab-games':
        loadAdminGames();
        break;
      case 'tab-admins':
        loadAdminList();
        break;
      case 'tab-users':
        loadAllUsers();
        break;
        case 'tab-settings':
        loadSiteSettings();
        break;
        case 'tab-awards':
        loadAwardManager(); 
        break;
    }
  });

  document.getElementById('test-submission-btn').addEventListener('click', createTestSubmission);

  // Load initial data
  await loadInitialStats();
  await loadPendingSubmissions();
}

function setupTabListeners() {
  const tabs = document.querySelectorAll('.admin-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active', 'border-cyan-500', 'text-cyan-500');
        t.classList.add('border-transparent', 'text-gray-400');
      });
      
      tab.classList.add('active', 'border-cyan-500', 'text-cyan-500');
      tab.classList.remove('border-transparent', 'text-gray-400');
      
      switch(tab.id) {
    case 'tab-submissions':
        loadPendingSubmissions();
        break;
    case 'tab-games':
        loadAdminGames();
        break;
    case 'tab-achievements':
        loadAchievementsAdmin();
        break;
          case 'tab-awards':
    loadAwardManager();
    break;
    case 'tab-admins':
        loadAdminList();
        break;
    case 'tab-users':
        loadAllUsers();
        break;
}
    });
  });
}

async function loadInitialStats() {
  try {
    // Get pending submissions count
    const { count: pendingCount } = await supabase
      .from('game_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    document.getElementById('pending-count').textContent = pendingCount || 0;
    
    // Get total games count
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
    document.getElementById('total-games').textContent = totalGames || 0;
    
    // Get total users count
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    document.getElementById('total-users').textContent = totalUsers || 0;
    
    // Try to get admin count - handle missing column gracefully
    try {
      const { count: adminCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_admin', true);
      document.getElementById('admin-count').textContent = adminCount || 0;
    } catch (adminError) {
      console.log('Admin column not available yet:', adminError.message);
      document.getElementById('admin-count').textContent = '1'; // Assuming you're the only admin
    }
    
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}
function generateSlug(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-')   // Replace multiple - with single -
    .replace(/^-+/, '')       // Trim - from start
    .replace(/-+$/, '');      // Trim - from end
}
// Helper to normalize console names to match the dropdown values
function normalizeConsoleName(consoleName) {
  if (!consoleName) return '';
  
  const lower = consoleName.toLowerCase();
  
  // Map common variations to standard dropdown values
  const mapping = {
    'playstation 2': 'PS2',
    'ps2': 'PS2',
    'playstation2': 'PS2',
    'playstation 1': 'PS1',
    'ps1': 'PS1',
    'playstation': 'PS1',
    'playstation 3': 'PS3',
    'ps3': 'PS3',
    'playstation 4': 'PS4',
    'ps4': 'PS4',
    'playstation 5': 'PS5',
    'ps5': 'PS5',
    'xbox': 'XBOX',
    'xbox 360': 'XBOX 360',
    'xbox one': 'XBOX ONE', 
    'gamecube': 'GameCube',
    'gc': 'GameCube',
    'nintendo 64': 'N64',
    'n64': 'N64',
    'super nintendo': 'SNES',
    'snes': 'SNES',
    'super nes': 'SNES',
    'nes': 'NES',
    'nintendo entertainment system': 'NES',
    'sega genesis': 'Genesis/Megadrive',
    'genesis': 'Genesis/Megadrive',
    'megadrive': 'Genesis/Megadrive',
    'sega saturn': 'Saturn',
    'saturn': 'Saturn',
    'dreamcast': 'Dreamcast',
    'gameboy advance': 'GBA',
    'gba': 'GBA',
    'gameboy': 'Gameboy',
    'game boy': 'Gameboy',
    'gbc': 'Gameboy Color',
    'gameboy color': 'Gameboy Color',
    'game boy color': 'Gameboy Color',
    '3ds': '3DS',
    'nintendo 3ds': '3DS',
    'switch': 'Nintendo Switch',
    'nintendo switch': 'Nintendo Switch',
    'pc': 'PC',
    'steam': 'PC'
  };

  // Check for exact match first
  if (mapping[lower]) return mapping[lower];
  
  // Check for partial match
  for (const key in mapping) {
    if (lower.includes(key)) return mapping[key];
  }

  // If no match, return the original trimmed string
  return consoleName.trim();
}
async function loadPendingSubmissions() {
  try {
    console.log('Loading pending submissions...');
    const content = document.getElementById('admin-content');
    content.innerHTML = `
      <div class="text-center py-8">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
        <p class="text-gray-400 mt-2">Loading submissions...</p>
      </div>
    `;

    const { data: submissions, error } = await supabase
      .from('game_submissions')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Update count
    document.getElementById('pending-count').textContent = submissions?.length || 0;
    document.querySelector('#tab-submissions').textContent = `📥 Submissions (${submissions?.length || 0})`;

    if (!submissions || submissions.length === 0) {
      content.innerHTML = `
        <div class="text-center py-12">
          <div class="text-6xl mb-4">✅</div>
          <h3 class="text-xl font-bold text-white mb-2">No Pending Submissions</h3>
          <p class="text-gray-400">All caught up! No games need review.</p>
          <div class="mt-6">
            <button onclick="createTestSubmission()" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
              🧪 Create Test Submission
            </button>
          </div>
        </div>
      `;
      return;
    }

    let html = ` <div class="space-y-6">`;

    submissions.forEach(submission => {
      html += `
        <div class="bg-gray-900 rounded-lg p-6 border border-gray-700">
          <div class="flex justify-between items-start mb-4">
            <div class="flex-1">
              <h3 class="text-xl font-bold text-white mb-2">${submission.title}</h3>
              <div class="flex flex-wrap gap-2 mb-2">
                <span class="bg-gray-700 text-white px-3 py-1 rounded text-sm">${submission.console}</span>
                <span class="bg-gray-700 text-white px-3 py-1 rounded text-sm">${submission.year || 'N/A'}</span>
                <span class="bg-gray-700 text-white px-3 py-1 rounded text-sm">${submission.multiplayer_type}</span>
              </div>
              <p class="text-gray-300 mb-4">${submission.description || 'No description provided.'}</p>
             
              <!-- Show images if available -->
              ${submission.cover_image_url ? `
                <div class="mb-4">
                  <p class="text-gray-300 mb-2">Cover Image:</p>
                  <img src="${submission.cover_image_url}" alt="Cover" class="w-32 h-48 object-cover rounded border border-gray-600">
                </div>
              ` : ''}
             
              ${submission.screenshot_urls && submission.screenshot_urls.length > 0 ? `
                <div class="mb-4">
                  <p class="text-gray-300 mb-2">Screenshots (${submission.screenshot_urls.length}):</p>
                  <div class="grid grid-cols-3 gap-2">
                    ${submission.screenshot_urls.map(url => `
                      <img src="${url}" alt="Screenshot" class="w-full h-24 object-cover rounded border border-gray-600">
                    `).join('')}
                  </div>
                </div>
              ` : ''}
             
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p class="text-sm text-gray-400">Submitted by:</p>
                  <p class="text-white">${submission.user_email}</p>
                </div>
                <div>
                  <p class="text-sm text-gray-400">Submitted on:</p>
                  <p class="text-white">${new Date(submission.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
            <span class="bg-yellow-600 text-white px-3 py-1 rounded text-sm font-semibold">
              ⏳ Pending
            </span>
          </div>
         
          <div class="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
            <button onclick="approveSubmission('${submission.id}')" 
                   class="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded font-semibold transition flex items-center justify-center">
              <span class="mr-2">✅</span>
              Approve
            </button>
            <button onclick="rejectSubmission('${submission.id}')" 
                   class="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded font-semibold transition flex items-center justify-center">
              <span class="mr-2">❌</span>
              Reject
            </button>
          </div>
        </div>
      `;
    });

    html += ` </div>`;
    content.innerHTML = html;

  } catch (error) {
    console.error('Error in loadPendingSubmissions:', error);
    const content = document.getElementById('admin-content');
    if (content) {
      content.innerHTML = `
        <div class="text-center py-8">
          <div class="text-4xl mb-4">⚠️</div>
          <h3 class="text-xl font-bold text-white mb-2">Error</h3>
          <p class="text-red-400">${error.message}</p>
        </div>
      `;
    }
  }
}

// ADMIN MANAGEMENT FUNCTIONS
async function loadAdminList() {
  const content = document.getElementById('admin-content');
  try {
    content.innerHTML = `
      <div class="text-center py-8">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
        <p class="text-gray-400 mt-2">Loading admin list...</p>
      </div>
    `;

    // Check if current user is the main admin (retrogamemasterra@gmail.com)
    if (currentUser.email !== 'retrogamemasterra@gmail.com') {
      content.innerHTML = `
        <div class="text-center py-12">
          <div class="text-5xl mb-4">🔒</div>
          <h3 class="text-xl font-bold text-white mb-2">Restricted Access</h3>
          <p class="text-gray-400">Only the main administrator (retrogamemasterra@gmail.com) can manage admin users.</p>
          <div class="mt-6">
            <button onclick="loadPendingSubmissions()" class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded">
              Go to Submissions
            </button>
          </div>
        </div>
      `;
      return;
    }

    // Try to get all admin users - handle missing column gracefully
    let admins = [];
    try {
      const { data: adminData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_admin', true)
        .order('created_at', { ascending: false });
      
      if (error) {
        // If column doesn't exist, show setup instructions
        if (error.message.includes('column profiles.is_admin does not exist')) {
          throw new Error('Admin column not set up. Please run the SQL to add is_admin column.');
        }
        throw error;
      }
      
      admins = adminData || [];
       
    } catch (dbError) {
      console.error('Database error:', dbError);
      
      // Show setup instructions instead of error
      content.innerHTML = `
        <div class="text-center py-12">
          <div class="text-5xl mb-4">🔧</div>
          <h3 class="text-xl font-bold text-white mb-4">Database Setup Required</h3>
          <p class="text-gray-300 mb-6">To manage admins, you need to add the <code class="bg-gray-900 px-2 py-1 rounded">is_admin</code> column to your profiles table.</p>
         
          <div class="bg-gray-900 p-6 rounded-lg border border-cyan-500 mb-6">
            <h4 class="text-lg font-bold text-cyan-300 mb-3">SQL to Run in Supabase:</h4>
            <pre class="bg-black p-4 rounded text-sm text-gray-200 overflow-x-auto">
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
-- Make yourself admin
UPDATE profiles
SET is_admin = TRUE
WHERE email = 'retrogamemasterra@gmail.com';
</pre>
            <div class="mt-4 flex justify-center space-x-4">
              <button onclick="loadAdminList()" class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded">
                🔄 Retry After Setup
              </button>
              <button onclick="loadPendingSubmissions()" class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded">
                Go to Submissions
              </button>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // Get current user's profile to check admin status
    const { data: currentUserProfile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', currentUser.id)
      .single();

    let html = `
      <div>
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-white">Admin Users (${admins.length})</h2>
          <button id="add-admin-btn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center">
            <span class="mr-2">➕</span>
            Add Admin
          </button>
        </div>
       
        ${admins.length === 0 ? `
          <div class="text-center py-12 bg-gray-900 rounded-lg border border-gray-700">
            <div class="text-6xl mb-4">👑</div>
            <h3 class="text-xl font-bold text-white mb-2">No Admins Found</h3>
            <p class="text-gray-400">You are currently the only admin.</p>
          </div>
        ` : `
          <div class="bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
            <table class="min-w-full divide-y divide-gray-700">
              <thead class="bg-gray-800">
                <tr>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    User
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Email
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Admin Since
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody id="adminsList" class="bg-gray-900 divide-y divide-gray-800">
                ${admins.map(admin => `
                  <tr class="hover:bg-gray-800">
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                          <span class="text-white font-bold">
                            ${(admin.username || admin.email).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div class="ml-4">
                          <div class="text-sm font-medium text-white">
                            ${admin.username || 'No username'}
                            ${admin.email === 'retrogamemasterra@gmail.com' ? 
                              ' <span class="ml-2 bg-yellow-600 text-white px-2 py-1 rounded text-xs">Main Admin</span>' : ''}
                          </div>
                          <div class="text-sm text-gray-300">
                            ${admin.favorite_console || 'No console set'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm text-gray-300">${admin.email}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      ${new Date(admin.updated_at || admin.created_at).toLocaleDateString()}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      ${admin.email === 'retrogamemasterra@gmail.com' ? 
                        `<span class="text-gray-400">Cannot remove main admin</span>` :
                        `<button onclick="removeAdminFromList('${admin.id}', '${escapeString(admin.email)}')" 
                                 class="text-red-400 hover:text-red-300 bg-red-600 hover:bg-red-700 px-3 py-1 rounded">
                          Remove Admin
                        </button>`
                      }
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
        
        <div class="mt-6 bg-gray-900 p-6 rounded-lg border border-yellow-600">
          <h3 class="text-lg font-bold text-yellow-400 mb-2">⚠️ Important Notes</h3>
          <ul class="text-gray-300 space-y-1">
            <li>• Only the main admin (retrogamemasterra@gmail.com) can manage admin users</li>
            <li>• Admin users can approve/reject game submissions and manage games</li>
            <li>• Removing admin access does not delete the user account</li>
            <li>• Main admin cannot be removed for security reasons</li>
          </ul>
        </div>
      </div>
    `;

    content.innerHTML = html;

    // Add event listener for add admin button
    document.getElementById('add-admin-btn')?.addEventListener('click', showAddAdminModal);
 
  } catch (error) {
    console.error('Error loading admin list:', error);
    
    // FIX: Ensure content is defined before using it
    if (content) {
      content.innerHTML = `
        <div class="text-center py-8">
          <div class="text-4xl mb-4">⚠️</div>
          <h3 class="text-xl font-bold text-white mb-2">Error</h3>
          <p class="text-red-400">${error.message}</p>
        </div>
      `;
    }
  }
}

async function showAddAdminModal() {
  try {
    // Get all non-admin users - handle missing column
    let nonAdmins = [];
    try {
      const { data: usersData, error } = await supabase
        .from('profiles')
        .select('id, email, username, is_admin')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) {
        // If column doesn't exist, treat all users as non-admins
        if (error.message.includes('column profiles.is_admin does not exist')) {
           const { data: allUsers } = await supabase
            .from('profiles')
            .select('id, email, username')
            .order('created_at', { ascending: false })
            .limit(50);
          nonAdmins = allUsers || [];
        } else {
          throw error;
        }
      } else {
        // Filter out admins
        nonAdmins = usersData.filter(user => !user.is_admin);
      }
      
    } catch (dbError) {
      console.error('Error loading users for admin modal:', dbError);
      
      // Fallback: Get all users
       const { data: allUsers } = await supabase
        .from('profiles')
        .select('id, email, username')
        .order('created_at', { ascending: false })
         .limit(50);
      nonAdmins = allUsers || [];
    }

    if (!nonAdmins || nonAdmins.length === 0) {
      showNotification('No non-admin users found', 'info');
       return;
    }

    const modalHtml = `
      <div id="add-admin-modal" class="fixed inset-0 z-50 overflow-y-auto">
        <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <!-- Background overlay -->
          <div class="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity"></div>
         
          <!-- Modal panel -->
          <div class="inline-block align-bottom bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
            <div class="sm:flex sm:items-start">
              <div class="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <h3 class="text-lg leading-6 font-bold text-white mb-4">
                  ➕ Add New Admin
                </h3>
               
                <div class="mb-4">
                  <label class="block text-sm font-medium text-gray-300 mb-2">
                    Select User to Promote to Admin
                  </label>
                  <select id="admin-user-select" 
                         class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
                    <option value="">-- Select a user --</option>
                    ${nonAdmins.map(user => `
                      <option value="${user.id}">
                        ${user.email} (${user.username || 'no username'})
                      </option>
                    `).join('')}
                  </select>
                </div>
               
                <div class="bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded-lg p-3 mb-4">
                  <p class="text-sm text-yellow-200">
                    ⚠️ This user will be able to approve/reject game submissions and manage games.
                  </p>
                </div>
               
                <div class="flex justify-end space-x-3 mt-6">
                  <button type="button" 
                         onclick="closeAddAdminModal()"
                         class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">
                    Cancel
                  </button>
                  <button type="button" 
                         onclick="promoteToAdmin()"
                         class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold">
                    Promote to Admin
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add modal to body
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);

    // Make functions available globally
    window.closeAddAdminModal = function() {
      const modal = document.getElementById('add-admin-modal');
      if (modal) modal.remove();
    };

    window.promoteToAdmin = async function() {
      const select = document.getElementById('admin-user-select');
      const userId = select.value;
      
       if (!userId) {
        showNotification('Please select a user', 'error');
        return;
      }
      
      try {
        // Update user to admin
         const { error } = await supabase
          .from('profiles')
          .update({ is_admin: true, updated_at: new Date().toISOString() })
          .eq('id', userId);
        
        if (error) {
          // If column doesn't exist, show error with instructions
          if (error.message.includes('column "is_admin" of relation "profiles" does not exist')) {
            showNotification('❌ Error: Admin column not set up. Please run the SQL first.', 'error');
            return;
          }
           throw error;
        }
        
        showNotification('✅ User promoted to admin successfully!');
        
        // Close modal and refresh admin list
        window.closeAddAdminModal();
        await loadAdminList();
        await loadInitialStats(); // Refresh stats
        
      } catch (error) {
         console.error('Error promoting to admin:', error);
        showNotification('❌ Error: ' + error.message, 'error');
      }
    };

  } catch (error) {
    console.error('Error showing add admin modal:', error);
    showNotification('Error loading users: ' + error.message, 'error');
  }
}

// Remove admin function
window.removeAdminFromList = async function(userId, userEmail) {
  // Extra confirmation for admin removal
  if (!confirm(`Are you sure you want to remove admin privileges from ${userEmail}?\n\nThey will no longer be able to access the admin panel.`)) {
  return;
  }
  try {
    // Check if current user is main admin
    if (currentUser.email !== 'retrogamemasterra@gmail.com') {
      showNotification('Only the main admin can remove admin privileges', 'error');
      return;
    }
    
    // Update user to remove admin status
    const { error } = await supabase
      .from('profiles')
      .update({ 
        is_admin: false, 
        updated_at: new Date().toISOString(),
        admin_removed_at: new Date().toISOString(),
        admin_removed_by: currentUser.id
      })
      .eq('id', userId);
    
    if (error) {
      if (error.message.includes('column "is_admin" of relation "profiles" does not exist')) {
        showNotification('❌ Error: Admin column not set up.', 'error');
        return;
      }
      throw error;
    }
    
    showNotification('✅ Admin privileges removed successfully!');
    await loadAdminList();
    await loadInitialStats(); // Refresh stats
    
  } catch (error) {
    console.error('Error removing admin:', error);
    showNotification('❌ Error: ' + error.message, 'error');
  }
};

// USER MANAGEMENT FUNCTION
async function loadAllUsers() {
  const content = document.getElementById('admin-content');
  try {
    content.innerHTML = `
      <div class="text-center py-8">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
        <p class="text-gray-400 mt-2">Loading users...</p>
      </div>
    `;

    const { data: users, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    let html = `
      <div>
        <h2 class="text-2xl font-bold text-white mb-6">All Users (${users?.length || 0})</h2>
       
        <div class="bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
          <table class="min-w-full divide-y divide-gray-700">
            <thead class="bg-gray-800">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  User
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Email
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Joined
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody id="usersList" class="bg-gray-900 divide-y divide-gray-800">
              ${users?.map(user => {
                // Check if user is admin - handle missing column
                const isUserAdmin = user.is_admin === true;
                 return `
                <tr class="hover:bg-gray-800">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                        <span class="text-white font-bold">
                          ${(user.username || user.email).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div class="ml-4">
                        <div class="text-sm font-medium text-white">
                          ${user.username || 'No username'}
                          ${user.email === 'retrogamemasterra@gmail.com' ?  
                            ' <span class="ml-2 bg-yellow-600 text-white px-2 py-1 rounded text-xs">Main Admin</span>' : ''}
                          ${isUserAdmin && user.email !== 'retrogamemasterra@gmail.com' ? 
                            ' <span class="ml-2 bg-yellow-600 text-white px-2 py-1 rounded text-xs">Admin</span>' : ''}
                        </div>
                        <div class="text-sm text-gray-300">
                          ${user.favorite_console || 'No console'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    ${user.email}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      isUserAdmin ? 'bg-yellow-900 text-yellow-200' : 'bg-green-900 text-green-200'
                    }">
                      ${isUserAdmin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    ${new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex space-x-2">
                      ${user.email === 'retrogamemasterra@gmail.com' ? 
                        '<span class="text-gray-400">Main Admin</span>' :
                        isUserAdmin ? 
                          `<button onclick="removeAdminFromList('${user.id}', '${escapeString(user.email)}')" 
                                   class="text-red-400 hover:text-red-300 bg-red-600 hover:bg-red-700 px-3 py-1 rounded">
                            Remove Admin
                          </button>` :
                          currentUser.email === 'retrogamemasterra@gmail.com' ?
                            `<button onclick="promoteUserToAdmin('${user.id}', '${escapeString(user.email)}')" 
                                     class="text-green-400 hover:text-green-300 bg-green-600 hover:bg-green-700 px-3 py-1 rounded">
                              Make Admin
                            </button>` :
                            '<span class="text-gray-400">Main admin only</span>'
                      }
                    </div>
                  </td>
                </tr>
              `}).join('') || `
                <tr>
                  <td colspan="5" class="px-6 py-8 text-center text-gray-400">
                    No users found.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;

    content.innerHTML = html;

  } catch (error) {
    console.error('Error loading users:', error);
    if (content) {
      content.innerHTML = `
        <div class="text-center py-8">
          <div class="text-4xl mb-4">⚠️</div>
          <h3 class="text-xl font-bold text-white mb-2">Error</h3>
          <p class="text-red-400">${error.message}</p>
        </div>
      `;
    }
  }
}

// Promote user to admin from users list
window.promoteUserToAdmin = async function(userId, userEmail) {
  if (currentUser.email !== 'retrogamemasterra@gmail.com') {
  showNotification('Only the main admin can promote users to admin', 'error');
  return;
  }
  if (!confirm(`Promote ${userEmail} to admin?\n\nThey will be able to approve/reject game submissions and manage games.`)) {
    return;
  }

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ 
        is_admin: true, 
        updated_at: new Date().toISOString(),
        admin_promoted_at: new Date().toISOString(),
        admin_promoted_by: currentUser.id
      })
      .eq('id', userId);
    
    if (error) {
      if (error.message.includes('column "is_admin" of relation "profiles" does not exist')) {
        showNotification('❌ Error: Admin column not set up. Please run the SQL first.', 'error');
        return;
      }
      throw error;
    }
    
    showNotification('✅ User promoted to admin successfully!');
    await loadAllUsers();
    await loadInitialStats();
    
  } catch (error) {
    console.error('Error promoting user:', error);
    showNotification('❌ Error: ' + error.message, 'error');
  }
};

// Game management functions
async function loadAdminGames() {
  const content = document.getElementById('admin-content');
  try {
    content.innerHTML = `
      <div class="text-center py-8">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
        <p class="text-gray-400 mt-2">Loading games...</p>
      </div>
    `;

    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    allGames = games || [];
    
    // Update tab count
    document.querySelector('#tab-games').textContent = `🎮 Games (${allGames.length})`;

    let html = `
      <div>
        <h2 class="text-2xl font-bold text-white mb-6">Game Library (${allGames.length})</h2>
       
        <div class="mb-4">
          <input type="text" 
                id="game-search" 
                placeholder="Search games..." 
                class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500">
        </div>
       
        <div class="bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
          <table class="min-w-full divide-y divide-gray-700">
            <thead class="bg-gray-800">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Game
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Submitted By
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody id="gamesList" class="bg-gray-900 divide-y divide-gray-800">
              ${allGames.map(game => `
                <tr class="hover:bg-gray-800">
                  <td class="px-6 py-4">
                    <div class="flex items-center">
                      <div>
                        <div class="text-white font-medium">${game.title}</div>
                        <div class="text-gray-400 text-sm">${game.console} • ${game.year || 'N/A'}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 text-gray-300">${game.submitted_email || 'N/A'}</td>
                  <td class="px-6 py-4">
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-900 text-green-200">
                      Approved
                    </span>
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex flex-wrap gap-2">
                      <button onclick="adminEditGame('${game.id}')" 
                             class="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white text-sm rounded-lg transition">
                        Edit
                      </button>
                      <button onclick="adminDeleteGame('${game.id}', '${escapeString(game.title)}')" 
                             class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('') || `
                <tr>
                  <td colspan="5" class="px-6 py-8 text-center text-gray-400">
                    No games found in the library.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;

    content.innerHTML = html;

    // Add search functionality
    document.getElementById('game-search')?.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const filteredGames = allGames.filter(game => 
        game.title.toLowerCase().includes(searchTerm) ||
        game.console.toLowerCase().includes(searchTerm) ||
        (game.submitted_email && game.submitted_email.toLowerCase().includes(searchTerm))
      );
      renderGamesTable(filteredGames);
    });

  } catch (error) {
    console.error('Error loading admin games:', error);
    if (content) {
      content.innerHTML = `
        <div class="text-center py-8">
          <div class="text-4xl mb-4">⚠️</div>
          <h3 class="text-xl font-bold text-white mb-2">Error</h3>
          <p class="text-red-400">${error.message}</p>
        </div>
      `;
    }
  }
}

function renderGamesTable(games) {
  const gamesListEl = document.getElementById('gamesList');
  if (!gamesListEl) return;
  if (!games || games.length === 0) {
    gamesListEl.innerHTML = `
      <tr>
        <td colspan="4" class="px-6 py-8 text-center text-gray-400">
          No games found matching your search.
        </td>
      </tr>
    `;
    return;
  }

  gamesListEl.innerHTML = games.map(game => `
    <tr class="hover:bg-gray-800">
      <td class="px-6 py-4">
        <div class="flex items-center">
          <div>
            <div class="text-white font-medium">${game.title}</div>
            <div class="text-gray-400 text-sm">${game.console} • ${game.year || 'N/A'}</div>
          </div>
        </div>
      </td>
      <td class="px-6 py-4 text-gray-300">${game.submitted_email || 'N/A'}</td>
      <td class="px-6 py-4">
        <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-900 text-green-200">
          Approved
        </span>
      </td>
      <td class="px-6 py-4">
        <div class="flex flex-wrap gap-2">
          <button onclick="adminEditGame('${game.id}')" 
                 class="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white text-sm rounded-lg transition">
            Edit
          </button>
          <button onclick="adminDeleteGame('${game.id}', '${escapeString(game.title)}')" 
                 class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition">
            Delete
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// SHOW GAME EDIT FORM FUNCTION - FIXED
async function showGameEditForm(gameId) {
  try {
    console.log('Showing game edit form for:', gameId);
    // Load game data using the imported function
    const { data: game, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();
    
    if (error || !game) {
      console.error('Game not found:', gameId);
      showNotification('❌ Error loading game', 'error');
      return;
    }

    console.log('Game data loaded:', game);

    // Create edit form in admin content area
    const content = document.getElementById('admin-content');
    if (!content) {
      // If we're in standalone edit mode, create the container
      const appContent = document.getElementById('app-content');
      if (appContent) {
        appContent.innerHTML = `
          <div class="max-w-7xl mx-auto p-4">
            <div class="mb-6">
              <a href="#/games" class="inline-flex items-center text-cyan-400 hover:text-cyan-300">
                ← Back to Games
              </a>
            </div>
            <div id="edit-game-container"></div>
          </div>
        `;
        content = document.getElementById('edit-game-container');
      }
    }

    if (content) {
      console.log('Creating edit form HTML...');
       content.innerHTML = createGameEditForm(game);
      setTimeout(() => {
        setupGameEditForm(game);
      }, 100);
    }

  } catch (error) {
    console.error('Error showing game edit form:', error);
    showNotification('❌ Error: ' + error.message, 'error');
  }
}

function createGameEditForm(game) {
  const adminEmails = ['retrogamemasterra@gmail.com', 'admin@retroonlinematchmaking.com'];
  const isAdmin = currentUser && adminEmails.includes(currentUser.email?.toLowerCase());
  // Helper function to escape HTML
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  return `
    <div class="bg-gray-800 rounded-lg p-6">
      <h2 class="text-2xl font-bold text-white mb-6">✏️ Edit Game: ${escapeHtml(game.title)}</h2>
     
      <!-- Image Management Section -->
      <div class="bg-gray-900 rounded-lg p-6 mb-6 border border-gray-700">
        <h3 class="text-lg font-bold text-white mb-4">🖼️ Game Images</h3>
       
        <!-- Cover Art -->
        <div class="mb-6">
          <h4 class="text-md font-bold text-cyan-300 mb-3">Cover Art</h4>
          <div class="flex flex-col md:flex-row gap-6">
            <div class="md:w-1/3">
              <div class="current-image mb-4">
                <p class="text-gray-300 mb-2">Current:</p>
                ${game.cover_image_url ? 
                  `<img src="${game.cover_image_url}" alt="Cover" 
                       class="w-full h-64 object-cover rounded-lg border border-gray-600"
                       id="currentCoverImage">` :
                  `<div class="w-full h-64 bg-gray-700 rounded-lg flex items-center justify-center">
                      <span class="text-gray-500 text-2xl">🎮</span>
                  </div>`
                }
              </div>
            </div>
           
            <div class="md:w-2/3">
              <div class="mb-4">
                <label class="block text-gray-300 mb-2">Update Cover Image</label>
                <input type="file" id="newCoverImage" accept="image/*" 
                      class="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white">
              </div>
              <div id="coverPreview" class="hidden mb-4">
                <p class="text-gray-300 mb-2">Preview:</p>
                <img id="coverPreviewImage" class="w-32 h-32 object-cover rounded-lg border border-cyan-500">
              </div>
            </div>
          </div>
        </div>
       
        <!-- Screenshots (Admin Only) -->
        ${isAdmin ? `
          <div>
            <h4 class="text-md font-bold text-purple-300 mb-3">Screenshots</h4>
            <div class="mb-4">
              <div class="mb-3">
                <label class="block text-gray-300 mb-2">Add Screenshots</label>
                <input type="file" id="newScreenshots" accept="image/*" multiple 
                      class="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white">
              </div>
             
              <div id="screenshotsContainer" class="grid grid-cols-2 md:grid-cols-4 gap-4">
                ${game.screenshot_urls && game.screenshot_urls.length > 0 ? 
                  game.screenshot_urls.map((url, index) => `
                    <div class="screenshot-item relative" data-index="${index}">
                      <img src="${url}" alt="Screenshot ${index + 1}" 
                          class="w-full h-32 object-cover rounded-lg border border-gray-600">
                      <button type="button" onclick="removeGameScreenshot('${game.id}', ${index})" 
                             class="absolute top-0 right-0 bg-red-600 text-white w-6 h-6 rounded-full text-xs">
                        ✕
                      </button>
                    </div>
                  `).join('') : 
                  '<p class="text-gray-500 col-span-4 text-center py-4">No screenshots yet</p>'
                }
              </div>
            </div>
          </div>
        ` : ''}
      </div>
     
      <!-- Game Details Form -->
      <form id="gameEditForm" class="space-y-4">
        <input type="hidden" id="editGameId" value="${game.id}">
       
        <div class="grid md:grid-cols-2 gap-4">
          <div>
            <label class="block text-gray-300 mb-2">Title *</label>
            <input type="text" id="editTitle" value="${escapeHtml(game.title)}" required 
                  class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">
          </div>
         
          <div>
            <label class="block text-gray-300 mb-2">Console *</label>
            <input type="text" id="editConsole" value="${escapeHtml(game.console)}" required 
                  class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">
          </div>
        </div>
       
        <div class="grid md:grid-cols-2 gap-4">
          <div>
            <label class="block text-gray-300 mb-2">Year</label>
            <input type="number" id="editYear" value="${game.year || ''}" 
                  class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">
          </div>
         
          <div>
            <label class="block text-gray-300 mb-2">Multiplayer Type</label>
            <select id="editMultiplayerType" 
                   class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">
              <option value="Online" ${game.multiplayer_type === 'Online' ? 'selected' : ''}>Online</option>
              <option value="LAN" ${game.multiplayer_type === 'LAN' ? 'selected' : ''}>LAN</option>
              <option value="Split-screen" ${game.multiplayer_type === 'Split-screen' ? 'selected' : ''}>Split-screen</option>
              <option value="Hotseat" ${game.multiplayer_type === 'Hotseat' ? 'selected' : ''}>Hotseat</option>
              <option value="Mixed" ${game.multiplayer_type === 'Mixed' ? 'selected' : ''}>Mixed</option>
              <option value="Other" ${game.multiplayer_type === 'Other' ? 'selected' : ''}>Other</option>
            </select>
          </div>
        </div>
       
        <div>
          <label class="block text-gray-300 mb-2">Description *</label>
          <textarea id="editDescription" rows="6" required 
                   class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">${escapeHtml(game.description || '')}</textarea>
        </div>
        <div class="grid md:grid-cols-2 gap-4 mb-4">
    <div>
        <label class="block text-gray-300 mb-2">Developer</label>
        <input type="text" id="editDeveloper" value="${escapeHtml(game.developer || '')}"
               class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">
    </div>
    <div>
        <label class="block text-gray-300 mb-2">Publisher</label>
        <input type="text" id="editPublisher" value="${escapeHtml(game.publisher || '')}"
               class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">
    </div>
</div>

<div class="grid md:grid-cols-2 gap-4 mb-4">
    <div>
        <label class="block text-gray-300 mb-2">Genre</label>
        <input type="text" id="editGenre" value="${escapeHtml(game.genre || '')}"
               class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none" placeholder="e.g., Vehicular Combat">
    </div>
    <div>
        <label class="block text-gray-300 mb-2">Release Date</label>
        <input type="date" id="editReleaseDate" value="${game.release_date ? game.release_date.split('T')[0] : ''}"
               class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">
    </div>
</div>

<div class="mb-4">
    <label class="block text-gray-300 mb-2">Features (Comma separated)</label>
    <input type="text" id="editFeatures" value="${game.features ? game.features.join(', ') : ''}"
           class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none" placeholder="e.g., Co-op, Splitscreen, Licensed Soundtrack">
</div>

<div class="mb-4">
    <label class="block text-gray-300 mb-2">Gameplay Video URL (YouTube/Vimeo)</label>
    <input type="url" id="editVideoUrl" value="${escapeHtml(game.video_url || '')}"
           class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none" placeholder="https://www.youtube.com/watch?v=...">
</div>

<div class="mb-4">
    <label class="block text-gray-300 mb-2">Animated Background Video URL</label>
    <input type="url" id="editBackgroundVideo" value="${escapeHtml(game.background_video_url || '')}"
           class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none" placeholder="Direct .mp4 link or YouTube embed">
    <p class="text-xs text-gray-500 mt-1">Leave empty for static background. Supports direct MP4 links.</p>
</div>
<!-- Admin Only: Background Image/GIF Upload -->
<div class="mt-4 p-4 bg-gray-900/50 rounded border border-purple-500/30">
    <label class="block text-purple-300 font-bold mb-2 text-sm">🎨 Background Image/GIF (Admin Only)</label>
    <p class="text-xs text-gray-400 mb-2">Upload a GIF or static image. Overrides the video URL if present.</p>
    
    ${game.background_image_url ? `
        <div class="mb-3">
            <p class="text-xs text-gray-500 mb-1">Current Background:</p>
            <img src="${game.background_image_url}" class="h-24 w-auto rounded border border-gray-600" alt="Current BG">
            <a href="${game.background_image_url}" target="_blank" class="text-xs text-cyan-400 underline ml-2">Open Full Size</a>
        </div>
    ` : ''}

    <input type="file" id="editBgImage" accept="image/gif, image/jpeg, image/png" 
           class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700">
</div>
       
        <div class="grid md:grid-cols-2 gap-4">
          <div>
            <label class="block text-gray-300 mb-2">Connection Method</label>
            <input type="text" id="editConnectionMethod" value="${escapeHtml(game.connection_method || '')}" 
                  class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">
          </div>
         
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-gray-300 mb-2">Min Players</label>
              <input type="number" id="editPlayersMin" value="${game.players_min || 1}" min="1" max="99"
                    class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">
            </div>
            <div>
              <label class="block text-gray-300 mb-2">Max Players</label>
              <input type="number" id="editPlayersMax" value="${game.players_max || 1}" min="1" max="99"
                    class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">
            </div>
          </div>
        </div>
       
        <div>
          <label class="block text-gray-300 mb-2">Connection Details</label>
          <textarea id="editConnectionDetails" rows="3"
                   class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">${escapeHtml(game.connection_details || '')}</textarea>
        </div>
       
        <div>
          <label class="block text-gray-300 mb-2">Server Details</label>
          <textarea id="editServerDetails" rows="3"
                   class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white">${escapeHtml(game.server_details || '')}</textarea>
        </div>
       
        <div class="flex items-center">
          <input type="checkbox" id="editServersAvailable" ${game.servers_available ? 'checked' : ''}
                class="w-4 h-4 text-cyan-500 bg-gray-700 border-gray-600 rounded">
          <label class="ml-2 text-gray-300">Active servers available</label>
        </div>
       
        <div class="flex justify-end gap-3 pt-6">
          <button type="button" onclick="window.location.hash='#/game/${game.slug || game.id}'" 
                 class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg">
            Cancel
          </button>
          <button type="submit" id="saveGameBtn" 
                 class="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg">
            Save Changes
          </button>
        </div>
      </form>
     
      <!-- Delete Game (Admin Only) -->
      ${isAdmin ? `
        <div class="mt-8 pt-6 border-t border-gray-700">
          <h3 class="text-lg font-bold text-red-400 mb-3">⚠️ Admin Actions</h3>
          <button onclick="adminDeleteGame('${game.id}', '${escapeString(game.title)}')"
                 class="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg">
            🗑️ Delete Game
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

function setupGameEditForm(game) {
  const form = document.getElementById('gameEditForm');
  if (!form) {
  console.error('Game edit form not found!');
  return;
  }
  console.log('Setting up game edit form for:', game.id);

  // Cover image preview
  const coverInput = document.getElementById('newCoverImage');
  if (coverInput) {
    coverInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
          const preview = document.getElementById('coverPreview');
          const img = document.getElementById('coverPreviewImage');
          if (img) {
            img.src = e.target.result;
            preview.classList.remove('hidden');
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Screenshots preview
  const screenshotsInput = document.getElementById('newScreenshots');
  if (screenshotsInput) {
    screenshotsInput.addEventListener('change', function(e) {
      const files = Array.from(e.target.files); 
      if (files.length > 0) {
        // Show loading indicator
        const container = document.getElementById('screenshotsContainer');
        if (!container) return;
        
         const loadingMsg = document.createElement('p');
        loadingMsg.className = 'text-gray-500 col-span-4 text-center py-4';
        loadingMsg.textContent = 'Uploading ...';
        container.appendChild(loadingMsg);
        
        // Upload files
        setTimeout(async () => {
          await uploadScreenshots(game.id, files);
          loadingMsg.remove();
        }, 100);
      }
    });
  }

  // Form submission
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    await saveGameEditForm(game);
  });

  // Make remove function available globally
  window.removeGameScreenshot = async function(gameId, index) {
    if (!confirm('Remove this screenshot?')) return;
    
    try {
      const { data: gameData } = await supabase
        .from('games')
        .select('screenshot_urls')
        .eq('id', gameId)
        .single();
      
      if (gameData && gameData.screenshot_urls) {
        const newScreenshots = [...gameData.screenshot_urls];
        newScreenshots.splice(index, 1);
        
        await supabase 
          .from('games')
          .update({ screenshot_urls: newScreenshots })
          .eq('id', gameId);
        
        showNotification('✅ Screenshot removed!');
        // Remove from UI
        const screenshotItem = document.querySelector(`.screenshot-item[data-index="${index}"]`);
        if (screenshotItem) {
          screenshotItem.remove();
        }
        // Update indices
        updateScreenshotIndices(gameId);
      }
    } catch (error) {
      console.error('Error removing screenshot:', error);
      showNotification('❌ Error: ' + error.message, 'error');
    }
  };
}

async function saveGameEditForm(game) {
  const saveBtn = document.getElementById('saveGameBtn');
  if (!saveBtn) {
  console.error('Save button not found!');
  return;
  }
  const originalText = saveBtn.textContent;

  saveBtn.textContent = 'Saving...';
  saveBtn.disabled = true;

  try {
    const gameId = document.getElementById('editGameId').value;
    
     // Handle cover image upload if new one selected
    const coverInput = document.getElementById('newCoverImage');
    let coverImageUrl = game.cover_image_url;
    
    if (coverInput && coverInput.files.length > 0) {
      const coverFile = coverInput.files[0];
      if (coverFile && coverFile.type.startsWith('image/')) {
        const fileExt = coverFile.name.split('.').pop();
        const fileName = `covers/${gameId}/${Date.now()}.${fileExt}`;
         
        const { data, error } = await supabase.storage
          .from('game-images')
          .upload(fileName, coverFile, {
            cacheControl: '3600',
            upsert: true
          });
        
        if (!error) {
          const { data: { publicUrl } } = supabase.storage
             .from('game-images')
            .getPublicUrl(fileName);
          coverImageUrl = publicUrl;
        }
      }
    }
    // --- NEW: Handle Background Image Upload (Admin Only) ---
const bgInput = document.getElementById('editBgImage');
let bgImageUrl = game.background_image_url; // Keep existing if no new file

if (bgInput && bgInput.files.length > 0) {
    const bgFile = bgInput.files[0];
    
    // Validate file type
    if (!bgFile.type.startsWith('image/')) {
        alert('Background must be an image (GIF, JPG, PNG)');
        throw new Error('Invalid background file type');
    }

    const fileExt = bgFile.name.split('.').pop();
    const fileName = `games/${gameId}/bg-${Date.now()}.${fileExt}`;
    
    console.log('⬆️ Uploading background image...', bgFile.name);
    
    const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('game-images')
        .upload(fileName, bgFile, { 
            cacheControl: '3600', 
            upsert: true 
        });

    if (uploadError) {
        console.error('Background upload failed:', uploadError);
        throw new Error('Failed to upload background: ' + uploadError.message);
    }

    const publicUrl = `https://lapyxhothazalssrbimb.supabase.co/storage/v1/object/public/game-images/${fileName}`;
    bgImageUrl = publicUrl;
    console.log('✅ Background uploaded:', publicUrl);
}
    
    // Prepare updates
     const updates = {
      title: document.getElementById('editTitle').value.trim(),
      console: document.getElementById('editConsole').value.trim(),
      year: document.getElementById('editYear').value ? parseInt(document.getElementById('editYear').value) : null,
      description: document.getElementById('editDescription').value.trim(),
      multiplayer_type: document.getElementById('editMultiplayerType').value,
      connection_method: document.getElementById('editConnectionMethod').value.trim() || null,
      connection_details: document.getElementById('editConnectionDetails').value.trim() || null,
      server_details: document.getElementById('editServerDetails').value.trim() || null,
      players_min: parseInt(document.getElementById('editPlayersMin').value) || 1,
      players_max: parseInt(document.getElementById('editPlayersMax').value) || 1,
      servers_available: document.getElementById('editServersAvailable').checked,
      cover_image_url: coverImageUrl,
      developer: document.getElementById('editDeveloper').value.trim() || null,
      publisher: document.getElementById('editPublisher').value.trim() || null,
      genre: document.getElementById('editGenre').value.trim() || null,
      release_date: document.getElementById('editReleaseDate').value || null,
      features: document.getElementById('editFeatures').value.split(',').map(f => f.trim()).filter(f => f) || [],
      video_url: document.getElementById('editVideoUrl').value.trim() || null,
      background_video_url: document.getElementById('editBackgroundVideo').value.trim() || null,
      background_image_url: bgImageUrl,
      updated_at: new Date().toISOString(),
      slug: generateSlug(document.getElementById('editTitle').value.trim())
    };
    
    console.log('Updating game with:', updates);
    
    // Save to database
    const { error } = await supabase
      .from('games')
      .update(updates)
      .eq('id', gameId);
     
    if (error) throw error;
    
    showNotification('✅ Game updated successfully!', 'success');
    
    // Redirect to game page
    setTimeout(() => {
      window.location.hash = `#/game/${updates.slug || gameId}`;
    }, 1500);
    
  } catch (error) {
    console.error('Error saving game edit:', error);
    showNotification('❌ Error: ' + error.message, 'error');
  } finally {
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;
  }
}

async function uploadScreenshots(gameId, files) {
  try {
  // Get current screenshots
  const { data: game } = await supabase
    .from('games')
    .select('screenshot_urls')
    .eq('id', gameId)
    .single();
    const currentScreenshots = game?.screenshot_urls || [];
    const newScreenshots = [...currentScreenshots];
    
    // Upload each file
    for (let i = 0; i < files.length && i < 10; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        const fileExt = file.name.split('.').pop();
        const fileName = `screenshots/${gameId}/${Date.now()}_${i}.${fileExt}`;
        
        const { data, error } = await supabase.storage
          .from('game-images')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true
          });
        
        if (!error) {
          const { data: { publicUrl } } = supabase.storage
            .from('game-images')
            .getPublicUrl(fileName);
          newScreenshots.push(publicUrl);
        }
      }
    }
    
    // Update game record
    await supabase
      .from('games')
      .update({ screenshot_urls: newScreenshots })
      .eq('id', gameId);
    
    showNotification(`✅ Added ${files.length} screenshot(s)!`);
    
    // Update UI
    updateScreenshotsUI(gameId, newScreenshots);
    
  } catch (error) {
    console.error('Error uploading screenshots:', error);
    showNotification('❌ Error uploading images: ' + error.message, 'error');
  }
}

function updateScreenshotsUI(gameId, screenshotUrls) {
  const container = document.getElementById('screenshotsContainer');
  if (!container) return;
  if (!screenshotUrls || screenshotUrls.length === 0) {
    container.innerHTML = '<p class="text-gray-500 col-span-4 text-center py-4">No screenshots yet</p>';
    return;
  }

  container.innerHTML = screenshotUrls.map((url, index) => `
    <div class="screenshot-item relative" data-index="${index}">
      <img src="${url}" alt="Screenshot ${index + 1}" 
          class="w-full h-32 object-cover rounded-lg border border-gray-600">
      <button type="button" onclick="removeGameScreenshot('${gameId}', ${index})" 
             class="absolute top-0 right-0 bg-red-600 text-white w-6 h-6 rounded-full text-xs">
        ✕
      </button>
    </div>
  `).join('');
}

function updateScreenshotIndices(gameId) {
  const items = document.querySelectorAll('.screenshot-item');
  items.forEach((item, index) => {
  item.setAttribute('data-index', index);
  const button = item.querySelector('button');
  if (button) {
  button.setAttribute('onclick', `removeGameScreenshot('${gameId}', ${index})`);
  }
  });
}

// Existing functions
window.approveSubmission = async (submissionId) => {
  if (!confirm('Approve this game submission?')) return;
  try {
    const user = await getCurrentUser();

    const { data: submission, error: fetchError } = await supabase
      .from('game_submissions')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (fetchError) throw fetchError;

    // Generate SEO-friendly slug
    const slug = generateSlug(submission.title);

    const gameData = {
      title: submission.title,
      console: normalizeConsoleName(submission.console),
      year: submission.year,
      description: submission.description,
      file_url: submission.file_url,
      submitted_by: submission.user_id,
      submitted_email: submission.user_email,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      connection_method: submission.connection_method,
      connection_details: submission.connection_details,
      multiplayer_type: submission.multiplayer_type,
      players_min: submission.players_min,
      players_max: submission.players_max,
      servers_available: submission.servers_available,
      server_details: submission.server_details,
      cover_image_url: submission.cover_image_url,
      screenshot_urls: submission.screenshot_urls || [],
      slug: slug
    };

    const { error: insertError } = await supabase
      .from('games')
      .insert([gameData]);

    if (insertError) throw insertError;

    const { error: updateError } = await supabase
      .from('game_submissions')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id
      })
      .eq('id', submissionId);

    if (updateError) throw updateError;

    showNotification('✅ Game approved and added to library!');
    await loadPendingSubmissions();
    await loadAdminGames();

  } catch (error) {
    console.error('Error approving submission:', error);
    showNotification('❌ Error: ' + error.message, 'error');
  }
};

window.rejectSubmission = async (submissionId) => {
  const reason = prompt('Reason for rejection (optional):');
  try {
    const user = await getCurrentUser();

    const { error } = await supabase
      .from('game_submissions')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        review_notes: reason || 'Rejected by admin'
      })
      .eq('id', submissionId);

    if (error) throw error;

    showNotification('✅ Game submission rejected');
    await loadPendingSubmissions();

  } catch (error) {
    console.error('Error rejecting submission:', error);
    showNotification('❌ Error: ' + error.message, 'error');
  }
};

async function createTestSubmission() {
  try {
  const user = await getCurrentUser();
    const testSubmission = {
      title: 'Test Game - ' + new Date().toLocaleTimeString(),
      console: 'PS2',
      year: 2005,
      description: 'Test game submission to verify admin panel is working.',
      user_id: user.id,
      user_email: user.email,
      connection_method: 'LAN',
      multiplayer_type: 'LAN',
      players_min: 2,
      players_max: 4,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('game_submissions')
      .insert([testSubmission])
      .select();

    if (error) throw error;

    showNotification('🧪 Test submission created!');
    await loadPendingSubmissions();

  } catch (error) {
    console.error('Error creating test submission:', error);
    showNotification('❌ Error: ' + error.message, 'error');
  }
}

window.adminDeleteGame = async function(gameId, gameTitle) {
  if (!confirm(`Are you sure you want to delete "${gameTitle}"? This action cannot be undone.`)) {
  return;
  }
  try {
    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', gameId);

    if (error) throw error;

    showNotification('✅ Game deleted successfully!');
    
    // Redirect to games list
    setTimeout(() => {
      window.location.hash = '#/games';
    }, 1500);

  } catch (error) {
    console.error('Error deleting game:', error);
    showNotification('❌ Error: ' + error.message, 'error');
  }
};

// UPDATED adminEditGame function
window.adminEditGame = async function(gameId) {
  try {
  console.log('Admin edit game called for:', gameId);
    // Check if we're in admin panel or standalone
    const inAdminPanel = document.getElementById('admin-content');
    
    if (inAdminPanel) {
      // We're in admin panel, show modal
      const { data: game, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();
      
      if (error || !game) {
        showNotification('❌ Error loading game', 'error');
        return;
       }
      
      // Create modal
      const modalHtml = `
        <div id="edit-game-modal" class="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div class="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div class="p-6">
              <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-white">✏️ Edit Game: ${escapeString(game.title)}</h2>
                <button onclick="document.getElementById('edit-game-modal').remove()" class="text-gray-400 hover:text-white">
                  ✕
                </button>
              </div>
              <div id="modal-edit-content"></div>
            </div>
          </div>
        </div>
      `;
      
      const modalContainer = document.createElement('div');
      modalContainer.innerHTML = modalHtml;
      document.body.appendChild(modalContainer); 
      
      // Load edit form into modal
      const modalContent = document.getElementById('modal-edit-content');
      modalContent.innerHTML = createGameEditForm(game);
      setTimeout(() => {
        setupGameEditForm(game);
      }, 100);
      
    } else {
      // We're not in admin panel, redirect to edit page
      window.location.hash = `#/edit-game/${gameId}`;
    }

  } catch (error) {
    console.error('Error in adminEditGame:', error);
    showNotification('❌ Error: ' + error.message, 'error');
  }
};

// Helper functions
function escapeString(str) {
  if (!str) return '';
  return str.replace(/'/g, "\'").replace(/"/g, '\"');
}

function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transition transform duration-300 ${ type === 'success' ? 'bg-green-600 text-white' : type === 'error' ? 'bg-red-600 text-white' : 'bg-cyan-600 text-white' }`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('opacity-0', 'translate-x-full');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Make functions globally accessible
window.loadPendingSubmissions = loadPendingSubmissions;
window.createTestSubmission = createTestSubmission;

// ===== SITE SETTINGS MANAGEMENT =====
async function loadSiteSettings() {
  const content = document.getElementById('admin-content');
  if (!content) return;

  try {
    // ✅ CORRECT: Use 'data', not 'settings'
    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', [
        'clip_title',
        'clip_youtube_id',
        'discord_url',
        'patreon_url',
        'youtube_url'
      ]);

    if (error) throw error;

    // ✅ SAFE: Handle null/undefined data
    const settingsMap = {};
    if (Array.isArray(data)) {
      data.forEach(s => {
        if (s && s.key && s.value !== undefined) {
          settingsMap[s.key] = s.value;
        }
      });
    }

    // Render settings form
    content.innerHTML = `
      <div class="max-w-3xl mx-auto">
        <h2 class="text-2xl font-bold text-white mb-6">⚙️ Site Settings</h2>
        
        <div class="bg-gray-800 rounded-lg p-6 border border-cyan-500">
          <h3 class="text-xl font-bold text-cyan-300 mb-4">🎬 Clip of the Week</h3>
          
          <div class="space-y-4">
            <div>
              <label class="block text-gray-300 mb-2">Clip Title</label>
              <input type="text" 
                     id="clip-title-input" 
                     value="${escapeHtml(settingsMap.clip_title || 'ROM Clip of the Week')}" 
                     class="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white">
            </div>
            
            <div>
              <label class="block text300 mb-2">YouTube Video ID or URL</label>
              <input type="text" 
                     id="clip-youtube-input" 
                     value="${escapeHtml(settingsMap.clip_youtube_id || 'dQw4w9WgXcQ')}" 
                     placeholder="Example: dQw4w9WgXcQ or https://youtu.be/dQw4w9WgXcQ"
                     class="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white">
              <p class="text-gray-400 text-sm mt-1">
                Paste full YouTube URL or just the video IDthe part after v=)
              </p>
            </div>
            
            <div class="mt-2">
              <label class="block text-gray-300 mb-2">Preview</label>
              <!-- ✅ Fixed aspect with inline styles -->
              <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; background-color: #1a1a1a; border-radius: 0.5rem;">
                <iframe id="clip-preview" 
                        style="position: absolute; top: 0: 0; width: 100%; height: 100%; border: 1px solid #374151;"
                        src="" 
                        frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen>
                </iframe>
              </div>
            </div>
          </div>
        </div>
        
        <div class="bg-gray-800 rounded-lg p-6 border border-purple-500 mt-6">
          <h3 class="text-xl font-bold text-purple-300 mb-4">🔗 Social Media Links</h3>
          
          <div class="space-y-4">
            <div>
              <label class="block text-gray-300 mb-2">Discord Server URL</label>
              <input type="url" 
                     id="discord-url-input" 
                     value="${escapeHtml(settingsMap.discord_url || 'https://discord.gg/example')}" 
                     class="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                     placeholder="https://discord.gg/yourserver">
            </div>
            
            <div>
              <label class="block text-gray-300 mb-2">Patreon Page URL</label>
              <input type="url" 
                     id="patreon-url-input" 
                     value="${escapeHtml(settingsMap.patreon_url || 'https://patreon.com/example')}" 
                     class="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                     placeholder="https://patreon.com/yourpage">
            </div>
            
            <div>
              <label class="block text-gray-300 mb-2">YouTube Channel URL</label>
              <input type="url" 
                     id="youtube-url-input" 
                     value="${escapeHtml(settingsMap.youtube_url || 'https://youtube.com/example')}" 
                     class="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                     placeholder="https://youtube.com/yourchannel">
            </div>
          </div>
        </div>
        
        <div class="mt-8 flex justify-end">
          <button id="save-settings-btn" 
                  class="bg-cyan-600 hover:bg-cyan-700 text-white px-8 py-3 rounded-lg font-bold text-lg transition flex items-center">
            <span>💾</span>
            <span class="ml-2">Save Settings</span>
          </button>
        </div>
      </div>
    `;

    // Setup preview for YouTube clip
    const youtubeInput = document.getElementById('clip-youtube-input');
    const previewFrame = document('-preview');
    
    const updatePreview = () => {
      const rawValue = youtubeInput.value.trim();
      if (!rawValue) {
        previewFrame.src = '';
        return;
      }
      
      // Extract clean YouTube ID from any URL format
      const cleanId = rawValue
  .replace(/.*(?:youtu\.be\/|v\/|u\/\w+\/|embed\/|watch\?v=|&v=|\/shorts\/)([^#&?]{11}).*/, '$1')
  .trim() || 'dQw4w9WgXcQ';
      
      previewFrame.src = `https://www.youtube.com/embed/${cleanId}?rel=0&modestbranding=1&autoplay=0`;
    };
    
    youtubeInput.addEventListener('input', updatePreview);
    updatePreview(); // Initial preview

    // Save button handler
    document.getElementById('save-settings-btn').addEventListener('click', async () => {
      const saveBtn = document.getElementById('save-settings-btn');
      const originalText = saveBtn.innerHTML;
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr"></span>Saving...';
      
      try {
        // Prepare settings updates
        const updates = [
          { key: 'clip_title', value: document.getElementById('clip-title-input').value.trim() || 'ROM Clip of the Week' },
          { key: 'clip_youtube_id', value: document.getElementById('clip-youtube-input').value.trim() || 'dQw4w9WgXQ' },
          { key: 'discord_url', value: document.getElementById('discord-url-input').value.trim() || 'https://discord.gg/example' },
          { key: 'patreon_url', value: document.getElementById('patreon-url-input').value.trim() || 'https://patreon.com/example' },
          { key: 'youtube_url', value: document.getElementById('youtube-url-input').value.trim() || 'https://youtube.com/example' }
        ];
        
        // Upsert each setting
        for (const setting of updates) {
          await supabase
            .from('site_settings')
            .upsert(
              { key: setting.key, value: setting.value },
              { onConflict: 'key' }
            );
        }
        
        // Show success
        showNotification('✅ Site settings saved successfully!', 'success');
        
        // Refresh preview
        updatePreview();
        
      } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('❌ Failed to save settings: ' + error.message, 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
      }
    });

  } catch (error) {
    console.error('Error loading site settings:', error);
    content.innerHTML = `
      <div class="text-center py-12">
        <div class="text-4xl mb-4">⚠️</div>
        <h3 class="text-xl font-bold text-white mb-2">Error Loading Settings</h3>
        <p class="text-gray-400">${error.message}</p>
        <button onclick="loadSiteSettings()" class="mt-4 bg-c-600 hover:bg-cyan-700 text-white px-6 py-2 rounded">
          Retry
        </button>
      </div>
    `;
  }
}

// Helper: Escape HTML for safety
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
// ===== ACHIEVEMENTS ADMIN FUNCTIONS =====
async function loadAchievementsAdmin() {
    const content = document.getElementById('admin-content');
    if (!content) return;
    
    content.innerHTML = `
        <div class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
            <p class="text-gray-400 mt-2">Loading achievements...</p>
        </div>
    `;

    try {
        const { data: achievements, error } = await supabase
            .from('achievements')
            .select('*, games(title)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        let html = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-white">🏆 Achievements (${achievements?.length || 0})</h2>
                <button onclick="window.showAddAchievementModal()" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center">
                    <span class="mr-2">➕</span> Add Achievement
                </button>
            </div>
            <div class="bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                <table class="min-w-full divide-y divide-gray-700">
                    <thead class="bg-gray-800">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Game</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Title</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Points</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Type</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="bg-gray-900 divide-y divide-gray-800">
                        ${achievements?.length > 0 ? achievements.map(a => `
                            <tr class="hover:bg-gray-800">
                                <td class="px-6 py-4 text-white text-sm">${escapeString(a.games?.title || 'Unknown')}</td>
                                <td class="px-6 py-4 text-gray-300 text-sm">${escapeString(a.title)}</td>
                                <td class="px-6 py-4 text-yellow-300 font-bold text-sm">${a.points}</td>
                                <td class="px-6 py-4">
                                    ${a.is_multiplayer ? 
                                        '<span class="bg-purple-900 text-purple-300 px-2 py-1 rounded text-xs">🌐 MP</span>' : 
                                        '<span class="bg-gray-700 text-gray-400 px-2 py-1 rounded text-xs">Single</span>'}
                                </td>
                                <td class="px-6 py-4 text-sm">
                                    <button onclick="window.editAchievement('${a.id}')" class="text-cyan-400 hover:text-cyan-300 mr-3">Edit</button>
                                    <button onclick="window.deleteAchievement('${a.id}', '${escapeString(a.title)}')" class="text-red-400 hover:text-red-300">Delete</button>
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-400">No achievements yet. Add one to get started!</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;

        content.innerHTML = html;
    } catch (error) {
        console.error('Error loading achievements:', error);
        content.innerHTML = `
            <div class="text-center py-8">
                <div class="text-4xl mb-4">⚠️</div>
                <h3 class="text-xl font-bold text-white mb-2">Error</h3>
                <p class="text-red-400">${error.message}</p>
            </div>
        `;
    }
}

window.showAddAchievementModal = async function(editId = null) {
    try {
        // Load games for dropdown
        const { data: games, error: gamesError } = await supabase.from('games').select('id, title').order('title');
        if (gamesError) throw gamesError;

        let achievement = null;
        if (editId) {
            const { data } = await supabase.from('achievements').select('*').eq('id', editId).single();
            achievement = data;
        }

        const modalHtml = `
            <div id="achievement-modal" class="fixed inset-0 z-50 overflow-y-auto">
                <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                    <div class="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onclick="window.closeAchievementModal()"></div>
                    <div class="inline-block align-bottom bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6 border border-gray-700">
                        <h3 class="text-lg font-bold text-white mb-4">${achievement ? '✏️ Edit' : '➕ Add'} Achievement</h3>
                        
                        <form id="achievement-form" class="space-y-4">
                            <input type="hidden" id="achieve-id" value="${editId || ''}">
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-1">Game *</label>
                                <select id="achieve-game" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" required>
                                    <option value="">Select a game</option>
                                    ${games?.map(g => `<option value="${g.id}" ${achievement?.game_id === g.id ? 'selected' : ''}>${escapeString(g.title)}</option>`).join('')}
                                </select>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-1">Title *</label>
                                <input type="text" id="achieve-title" value="${escapeString(achievement?.title || '')}" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" required>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-1">Description</label>
                                <textarea id="achieve-desc" rows="2" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">${escapeString(achievement?.description || '')}</textarea>
                            </div>
                            
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-300 mb-1">Points</label>
                                    <input type="number" id="achieve-points" value="${achievement?.points || 5}" min="1" max="100" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
                                </div>
                                <div>
                                    <div>
    <label class="block text-sm font-medium text-gray-300 mb-1">Badge Image</label>
    
    <!-- Current badge preview -->
    ${achievement?.badge_url ? `
        <div class="mb-2">
            <img src="${escapeString(achievement.badge_url)}" 
                 alt="Current badge" 
                 class="w-16 h-16 object-cover rounded border border-gray-600">
            <p class="text-xs text-gray-400 mt-1">Current badge</p>
        </div>
    ` : ''}
    
    <!-- Upload new badge -->
    <div class="mb-2">
        <input type="file" id="achieve-badge-file" accept="image/*" 
              class="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-700">
        <p class="text-xs text-gray-400 mt-1">Upload new badge (max 2MB)</p>
    </div>
    
    <!-- Preview of new upload -->
    <div id="badge-preview" class="hidden">
        <img id="badge-preview-img" class="w-16 h-16 object-cover rounded border border-cyan-500">
        <p class="text-xs text-cyan-400 mt-1">Preview</p>
    </div>
    
    <!-- Hidden input to store the final URL -->
    <input type="hidden" id="achieve-badge" value="${escapeString(achievement?.badge_url || '')}">
</div>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-1">Memory Logic</label>
                                <textarea id="achieve-logic" rows="3" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-green-400 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500" placeholder="0x1234=5 AND 0x5678!=0">${escapeString(achievement?.memory_logic || '')}</textarea>
                            </div>
                            
                            <div class="flex items-center">
                                <input type="checkbox" id="achieve-mp" ${achievement?.is_multiplayer ? 'checked' : ''} class="w-4 h-4 text-cyan-500 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500">
                                <label class="ml-2 text-sm text-gray-300">🌐 Multiplayer Achievement</label>
                            </div>
                            
                            <div class="flex justify-end space-x-3 mt-6">
                                <button type="button" onclick="window.closeAchievementModal()" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">Cancel</button>
                                <button type="submit" class="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold">${achievement ? 'Save Changes' : 'Add Achievement'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
// Add badge preview functionality
const badgeFileInput = document.getElementById('achieve-badge-file');
const badgePreview = document.getElementById('badge-preview');
const badgePreviewImg = document.getElementById('badge-preview-img');
const badgeUrlInput = document.getElementById('achieve-badge');

if (badgeFileInput) {
    badgeFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            // Validate file size (2MB max)
            if (file.size > 2 * 1024 * 1024) {
                showNotification('❌ Badge image must be under 2MB', 'error');
                badgeFileInput.value = '';
                return;
            }
            
            // Show preview
            const reader = new FileReader();
            reader.onload = function(e) {
                badgePreviewImg.src = e.target.result;
                badgePreview.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });
}
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('achievement-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await window.saveAchievement();
        });
    } catch (error) {
        console.error('Error opening achievement modal:', error);
        showNotification('❌ ' + error.message, 'error');
    }
};

window.closeAchievementModal = function() {
    const modal = document.getElementById('achievement-modal');
    if (modal) modal.remove();
};

window.saveAchievement = async function() {
    const id = document.getElementById('achieve-id').value;
    
    // Start with existing badge URL (if editing)
    let badgeUrl = document.getElementById('achieve-badge').value;
    
    // Handle new badge upload if file selected
    const badgeFileInput = document.getElementById('achieve-badge-file');
    if (badgeFileInput && badgeFileInput.files.length > 0) {
        const file = badgeFileInput.files[0];
        if (file && file.type.startsWith('image/')) {
            try {
                // Upload to Supabase Storage
                const fileExt = file.name.split('.').pop();
                const fileName = `achievement-badges/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
                
                const { data, error: uploadError } = await supabase.storage
                    .from('game-media')  // Using existing bucket
                    .upload(fileName, file, {
                        cacheControl: '3600',
                        upsert: false
                    });
                
                if (uploadError) throw uploadError;
                
                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('game-media')
                    .getPublicUrl(fileName);
                
                badgeUrl = publicUrl;
                
            } catch (uploadErr) {
                console.error('Badge upload error:', uploadErr);
                showNotification('⚠️ Badge upload failed, using existing URL', 'info');
                // Continue with existing badgeUrl
            }
        }
    }
    
    const payload = {
        game_id: document.getElementById('achieve-game').value,
        title: document.getElementById('achieve-title').value.trim(),
        description: document.getElementById('achieve-desc').value.trim() || null,
        points: parseInt(document.getElementById('achieve-points').value) || 5,
        badge_url: badgeUrl,  // Use uploaded URL or existing one
        memory_logic: document.getElementById('achieve-logic').value.trim() || null,
        is_multiplayer: document.getElementById('achieve-mp').checked,
        updated_at: new Date().toISOString()
    };

    if (!payload.game_id || !payload.title) {
        showNotification('❌ Game and Title are required', 'error');
        return;
    }

    const btn = document.querySelector('#achievement-form button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const query = id 
            ? supabase.from('achievements').update(payload).eq('id', id)
            : supabase.from('achievements').insert([payload]);
        
        const { error } = await query;
        if (error) throw error;

        showNotification(id ? '✅ Achievement updated!' : '✅ Achievement added!');
        window.closeAchievementModal();
        await loadAchievementsAdmin();
    } catch (error) {
        console.error('Error saving achievement:', error);
        showNotification('❌ ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = id ? 'Save Changes' : 'Add Achievement';
    }
};

window.editAchievement = function(id) {
    window.showAddAchievementModal(id);
};

window.deleteAchievement = async function(id, title) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    
    try {
        const { error } = await supabase.from('achievements').delete().eq('id', id);
        if (error) throw error;
        showNotification('✅ Achievement deleted!');
        await loadAchievementsAdmin();
    } catch (error) {
        console.error('Error deleting achievement:', error);
        showNotification('❌ ' + error.message, 'error');
    }
};
// ===== END ACHIEVEMENTS FUNCTIONS =====
// ============================================================================
// NEW: AWARD MANAGER (Achievements & Site Awards)
// ============================================================================

async function loadAwardManager() {
    const content = document.getElementById('admin-content');
    if (!content) return;

    content.innerHTML = `
        <div class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
            <p class="text-gray-400 mt-2">Loading Award Manager...</p>
        </div>
    `;

    try {
        const { data: users } = await supabase.from('profiles').select('id, username, email').order('username');
        const { data: games } = await supabase.from('games').select('id, title').order('title');
        
        // Fetch existing Site Awards for the dropdown
        const { data: siteAwards } = await supabase.from('achievements').select('id, title, badge_url').eq('type', 'site');

        content.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                <!-- Column 1: Create New Award (Game OR Site) -->
                <div class="bg-gray-800 p-6 rounded-lg border border-green-500 lg:col-span-1">
                    <h3 class="text-xl font-bold text-white mb-4">➕ Create New Award</h3>
                    <form id="create-award-form" class="space-y-4">
                        
                        <!-- TYPE SELECTOR (The Missing Piece) -->
                        <div>
                            <label class="block text-sm font-bold text-green-400 mb-1">Award Type *</label>
                            <select id="new-award-type" class="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white" onchange="toggleAwardTypeFields()">
                                <option value="game">🎮 Game Achievement</option>
                                <option value="site">🎖️ Site Award (Special)</option>
                            </select>
                        </div>

                        <!-- Game Selector (Only visible if Type = Game) -->
                        <div id="field-game-select">
                            <label class="block text-sm text-gray-300 mb-1">Select Game</label>
                            <select id="new-award-game" class="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white">
                                <option value="">-- Choose Game --</option>
                                ${games?.map(g => `<option value="${g.id}">${g.title}</option>`).join('')}
                            </select>
                        </div>

                        <div>
                            <label class="block text-sm text-gray-300 mb-1">Title *</label>
                            <input type="text" id="new-award-title" required class="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white" placeholder="e.g. First Win or Master Chef">
                        </div>

                        <div>
                            <label class="block text-sm text-gray-300 mb-1">Badge Image *</label>
                            <input type="file" id="new-award-badge" accept="image/*" required class="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-700">
                            <div id="new-badge-preview" class="mt-2 hidden">
                                <img id="new-badge-img" class="w-16 h-16 object-cover rounded border border-cyan-500">
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-sm text-gray-300 mb-1">Points</label>
                                <input type="number" id="new-award-points" value="5" class="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white">
                            </div>
                            <div class="flex items-end pb-2">
                                <label class="flex items-center space-x-2 cursor-pointer">
                                    <input type="checkbox" id="new-award-mp" class="w-4 h-4 text-cyan-500 bg-gray-700 rounded">
                                    <span class="text-sm text-gray-300">Multiplayer?</span>
                                </label>
                            </div>
                        </div>

                        <button type="submit" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded mt-2">
                            Create Award
                        </button>
                    </form>
                </div>

                <!-- Column 2: Award to User -->
                <div class="bg-gray-800 p-6 rounded-lg border border-cyan-500 lg:col-span-2">
                    <h3 class="text-xl font-bold text-white mb-4">🎁 Award to User</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        <!-- Award Game Achievement -->
                        <div class="bg-gray-900 p-4 rounded border border-gray-700">
                            <h4 class="font-bold text-cyan-400 mb-3">🎮 Give Game Achievement</h4>
                            <form id="award-game-form" class="space-y-3">
                                <div>
                                    <label class="block text-xs text-gray-400 mb-1">User</label>
                                    <select id="award-user" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white">
                                        <option value="">-- Choose User --</option>
                                        ${users?.map(u => `<option value="${u.id}">${u.username || u.email}</option>`).join('')}
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-xs text-gray-400 mb-1">Game</label>
                                    <select id="award-game" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white" onchange="loadGameAchievementsForDropdown()">
                                        <option value="">-- Choose Game --</option>
                                        ${games?.map(g => `<option value="${g.id}">${g.title}</option>`).join('')}
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-xs text-gray-400 mb-1">Achievement</label>
                                    <select id="award-achievement" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white">
                                        <option value="">-- Select Game First --</option>
                                    </select>
                                </div>
                                <div class="flex items-center gap-2 pt-2">
                                    <input type="checkbox" id="award-is-proud" class="w-4 h-4 text-yellow-500 bg-gray-800 border-gray-600 rounded">
                                    <label class="text-xs text-yellow-400 cursor-pointer">⭐ Mark as "Most Proud"</label>
                                </div>
                                <button type="submit" class="w-full bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold py-2 rounded">
                                    Award Achievement
                                </button>
                            </form>
                        </div>

                        <!-- Award Site Award -->
                        <div class="bg-gray-900 p-4 rounded border border-gray-700">
                            <h4 class="font-bold text-purple-400 mb-3">🎖️ Give Site Award</h4>
                            <form id="award-site-form" class="space-y-3">
                                <div>
                                    <label class="block text-xs text-gray-400 mb-1">User</label>
                                    <select id="site-award-user" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white">
                                        <option value="">-- Choose User --</option>
                                        ${users?.map(u => `<option value="${u.id}">${u.username || u.email}</option>`).join('')}
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-xs text-gray-400 mb-1">Site Award</label>
                                    <select id="site-award-select" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white">
                                        <option value="">-- Choose Award --</option>
                                        ${siteAwards?.map(a => `<option value="${a.id}">${a.title}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="pt-6 text-xs text-gray-500 italic">
                                    <p>Site awards do not have a "Most Proud" option as they are always displayed in the Site Awards section.</p>
                                </div>
                                <button type="submit" class="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold py-2 rounded">
                                    Award Site Badge
                                </button>
                            </form>
                        </div>

                    </div>
                </div>
            </div>
            
            <!-- Recent Log -->
            <div class="mt-8 bg-gray-800 p-6 rounded-lg border border-gray-700">
                <h3 class="text-lg font-bold text-white mb-4">Recent Activity</h3>
                <div id="recent-awards-log" class="text-gray-400 text-sm">Loading...</div>
            </div>
        `;

        // Attach Listeners
        document.getElementById('create-award-form').addEventListener('submit', handleCreateAward);
        document.getElementById('award-game-form').addEventListener('submit', handleGameAward);
        document.getElementById('award-site-form').addEventListener('submit', handleSiteAward);
        
        // Badge Preview Logic
        const badgeInput = document.getElementById('new-award-badge');
        badgeInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(evt) {
                    document.getElementById('new-badge-img').src = evt.target.result;
                    document.getElementById('new-badge-preview').classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            }
        });

        loadRecentAwardsLog();
        // Initialize visibility
        toggleAwardTypeFields();

    } catch (error) {
        console.error('Error loading award manager:', error);
        content.innerHTML = `<div class="text-red-400">Error: ${error.message}</div>`;
    }
}

// Helper: Toggle Game Field based on Type
window.toggleAwardTypeFields = function() {
    const type = document.getElementById('new-award-type').value;
    const gameField = document.getElementById('field-game-select');
    
    if (type === 'site') {
        gameField.classList.add('hidden');
        document.getElementById('new-award-game').value = ''; // Clear selection
    } else {
        gameField.classList.remove('hidden');
    }
};

// Helper: Load Achievements for Dropdown
window.loadGameAchievementsForDropdown = async function() {
    const gameId = document.getElementById('award-game').value;
    const achieveSelect = document.getElementById('award-achievement');
    
    if (!gameId) {
        achieveSelect.innerHTML = '<option value="">-- Select Game First --</option>';
        return;
    }

    achieveSelect.innerHTML = '<option value="">Loading...</option>';
    
    const { data } = await supabase.from('achievements').select('id, title, points').eq('game_id', gameId);
    
    if (data && data.length > 0) {
        achieveSelect.innerHTML = '<option value="">-- Choose Achievement --</option>' + 
            data.map(a => `<option value="${a.id}">${a.title} (${a.points} pts)</option>`).join('');
    } else {
        achieveSelect.innerHTML = '<option value="">No achievements for this game</option>';
    }
};

// Handler: Create New Award (Game or Site)
async function handleCreateAward(e) {
    e.preventDefault();
    const type = document.getElementById('new-award-type').value;
    const title = document.getElementById('new-award-title').value;
    const points = parseInt(document.getElementById('new-award-points').value) || 0;
    const isMp = document.getElementById('new-award-mp').checked;
    const badgeFile = document.getElementById('new-award-badge').files[0];
    
    let gameId = null;
    if (type === 'game') {
        gameId = document.getElementById('new-award-game').value;
        if (!gameId) return showNotification('Please select a game', 'error');
    }

    if (!badgeFile) return showNotification('Please upload a badge image', 'error');

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Uploading...';

    try {
        // 1. Upload Badge
        const fileExt = badgeFile.name.split('.').pop();
        const fileName = `badges/${type}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('game-media') // Using existing bucket
            .upload(fileName, badgeFile, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('game-media').getPublicUrl(fileName);

        // 2. Create Record
        const payload = {
            type: type, // 'game' or 'site'
            game_id: gameId,
            title: title,
            points: points,
            badge_url: publicUrl,
            is_multiplayer: isMp,
            created_at: new Date().toISOString()
        };

        const { error: dbError } = await supabase.from('achievements').insert([payload]);
        if (dbError) throw dbError;

        showNotification(`✅ ${type === 'site' ? 'Site Award' : 'Achievement'} created successfully!`);
        e.target.reset();
        document.getElementById('new-badge-preview').classList.add('hidden');
        loadAwardManager(); // Refresh lists

    } catch (err) {
        console.error(err);
        showNotification('❌ Error: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// Handler: Award Game Achievement
async function handleGameAward(e) {
    e.preventDefault();
    const userId = document.getElementById('award-user').value;
    const achieveId = document.getElementById('award-achievement').value;
    const isProud = document.getElementById('award-is-proud').checked;

    if (!userId || !achieveId) return showNotification('Please select user and achievement', 'error');

    try {
        const { error } = await supabase.from('user_achievements').insert({
            user_id: userId,
            achievement_id: achieveId,
            unlocked_at: new Date().toISOString(),
            is_proud: isProud
        });
        if (error) throw error;
        showNotification('✅ Achievement awarded!');
        e.target.reset();
        loadRecentAwardsLog();
    } catch (err) {
        showNotification('❌ Error: ' + err.message, 'error');
    }
}

// Handler: Award Site Award
async function handleSiteAward(e) {
    e.preventDefault();
    const userId = document.getElementById('site-award-user').value;
    const achieveId = document.getElementById('site-award-select').value;

    if (!userId || !achieveId) return showNotification('Please select user and award', 'error');

    try {
        const { error } = await supabase.from('user_achievements').insert({
            user_id: userId,
            achievement_id: achieveId,
            unlocked_at: new Date().toISOString(),
            is_proud: false // Site awards aren't "proud" in the game sense
        });
        if (error) throw error;
        showNotification('✅ Site Award awarded!');
        e.target.reset();
        loadRecentAwardsLog();
    } catch (err) {
        showNotification('❌ Error: ' + err.message, 'error');
    }
}

async function loadRecentAwardsLog() {
    const logContainer = document.getElementById('recent-awards-log');
    if (!logContainer) return;

    const { data } = await supabase
        .from('user_achievements')
        .select(`unlocked_at, is_proud, profiles(username), achievements(title, type)`)
        .order('unlocked_at', { ascending: false })
        .limit(10);

    if (data && data.length > 0) {
        logContainer.innerHTML = `<ul class="space-y-2">${data.map(item => `
            <li class="flex justify-between items-center bg-gray-900 p-2 rounded border border-gray-800">
                <div class="flex items-center gap-2">
                    <span class="text-cyan-300 font-bold">${item.profiles?.username || 'Unknown'}</span>
                    <span class="text-gray-500">received</span>
                    <span class="${item.achievements?.type === 'site' ? 'text-purple-400' : 'text-white'} font-medium">${item.achievements?.title}</span>
                </div>
                <div class="flex items-center gap-3">
                    ${item.is_proud ? '<span class="text-yellow-500 text-xs">★ Proud</span>' : ''}
                    <span class="text-xs text-gray-600">${new Date(item.unlocked_at).toLocaleDateString()}</span>
                </div>
            </li>
        `).join('')}</ul>`;
    } else {
        logContainer.textContent = 'No recent awards found.';
    }
}
// ============================================================================
// END AWARD MANAGER
// ============================================================================
// Export for module system
export default initModule;
