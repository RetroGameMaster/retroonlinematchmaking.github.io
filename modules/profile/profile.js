import { supabase, getCurrentUser } from '../../lib/supabase.js';

export function initModule() {
    console.log('👤 Profile module initialized');
    loadUserProfile();
}

async function loadUserProfile() {
    const user = await getCurrentUser();
    
    if (!user) {
        window.location.hash = '#/auth';
        return;
    }
    
    const appContent = document.getElementById('app-content');
    if (appContent.innerHTML.includes('coming soon')) {
        appContent.innerHTML = `
            <div class="max-w-4xl mx-auto">
                <!-- Profile Header -->
                <div class="bg-gray-800 p-8 rounded-lg border border-cyan-500 mb-6">
                    <div class="flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-6">
                        <!-- Avatar -->
                        <div class="w-24 h-24 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-full flex items-center justify-center text-3xl">
                            ${user.email.charAt(0).toUpperCase()}
                        </div>
                        
                        <!-- User Info -->
                        <div class="flex-1 text-center md:text-left">
                            <h1 class="text-3xl font-bold text-white mb-2">${user.email}</h1>
                            <p class="text-gray-300 mb-4">Member since ${new Date(user.created_at).toLocaleDateString()}</p>
                            <div class="flex flex-wrap gap-2">
                                <span class="bg-cyan-600 text-white px-3 py-1 rounded text-sm">Verified</span>
                                ${user.user_metadata?.username ? `
                                    <span class="bg-purple-600 text-white px-3 py-1 rounded text-sm">
                                        @${user.user_metadata.username}
                                    </span>
                                ` : ''}
                            </div>
                        </div>
                        
                        <!-- Edit Button -->
                        <button id="edit-profile-btn" 
                                class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded">
                            Edit Profile
                        </button>
                    </div>
                </div>
                
                <!-- Stats Grid -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div class="bg-gray-800 p-6 rounded-lg text-center">
                        <div class="text-3xl font-bold text-green-400 mb-2" id="games-submitted">0</div>
                        <div class="text-gray-300">Games Submitted</div>
                    </div>
                    <div class="bg-gray-800 p-6 rounded-lg text-center">
                        <div class="text-3xl font-bold text-cyan-400 mb-2" id="games-approved">0</div>
                        <div class="text-gray-300">Games Approved</div>
                    </div>
                    <div class="bg-gray-800 p-6 rounded-lg text-center">
                        <div class="text-3xl font-bold text-purple-400 mb-2" id="total-comments">0</div>
                        <div class="text-gray-300">Comments</div>
                    </div>
                </div>
                
                <!-- Recent Activity -->
                <div class="bg-gray-800 p-6 rounded-lg">
                    <h2 class="text-xl font-bold text-white mb-4">Recent Activity</h2>
                    <div id="recent-activity" class="space-y-3">
                        <div class="text-gray-400 text-center py-4">
                            <p>No recent activity</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Load user stats
        loadUserStats(user.id);
    }
}

async function loadUserStats(userId) {
    try {
        // Get user's game submissions
        const { data: submissions, error: submissionsError } = await supabase
            .from('game_submissions')
            .select('*, status')
            .eq('user_id', userId);
        
        if (!submissionsError && submissions) {
            const totalSubmitted = submissions.length;
            const approvedCount = submissions.filter(s => s.status === 'approved').length;
            
            document.getElementById('games-submitted').textContent = totalSubmitted;
            document.getElementById('games-approved').textContent = approvedCount;
        }
        
        // Get user's approved games
        const { data: approvedGames, error: gamesError } = await supabase
            .from('games')
            .select('*')
            .eq('submitted_by', userId);
        
        if (!gamesError && approvedGames) {
            document.getElementById('games-approved').textContent = approvedGames.length;
        }
        
    } catch (error) {
        console.error('Error loading user stats:', error);
    }
}
