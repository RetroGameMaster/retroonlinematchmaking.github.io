import { supabase } from '../lib/supabase.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[char]));

export async function initModule() {
  const root = document.getElementById('app-content');
  if (!root) return;
  root.innerHTML = `
    <section class="max-w-6xl mx-auto p-4">
      <header class="text-center mb-8">
        <h1 class="text-4xl font-bold text-green-300 mb-2">🏆 ROM Matchmaking Leaderboards</h1>
        <p class="text-gray-400">Wins and team wins recorded by the Discord matchmaking database.</p>
      </header>
      <div id="rom-leaderboard-content" class="rounded-xl border border-green-500/30 bg-gray-900/70 p-4">
        <p class="text-gray-400 text-center py-8">Loading community rankings…</p>
      </div>
    </section>`;
  const target = root.querySelector('#rom-leaderboard-content');
  try {
    const { data: scores, error } = await supabase
      .from('discord_member_snapshots')
      .select('discord_user_id,total_wins,team_wins,updated_at')
      .order('total_wins', { ascending: false })
      .order('team_wins', { ascending: false })
      .limit(100);
    if (error) throw error;
    if (!scores?.length) {
      target.innerHTML = '<p class="text-gray-400 text-center py-8">No synced leaderboard data yet. Once the read-only bridge is running, rankings will appear here.</p>';
      return;
    }
    const discordIds = scores.map(row => row.discord_user_id);
    const { data: links } = await supabase
      .from('discord_account_links')
      .select('user_id,discord_user_id,discord_username,discord_avatar_hash')
      .in('discord_user_id', discordIds);
    const linkByDiscord = new Map((links || []).map(row => [row.discord_user_id, row]));
    const siteIds = [...new Set((links || []).map(row => row.user_id).filter(Boolean))];
    let profiles = [];
    if (siteIds.length) {
      const result = await supabase.from('profiles').select('id,username,avatar_url').in('id', siteIds);
      profiles = result.data || [];
    }
    const profileById = new Map(profiles.map(row => [row.id, row]));
    target.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-green-200 border-b border-gray-700">
            <tr><th class="p-3">Rank</th><th class="p-3">Player</th><th class="p-3 text-right">Wins</th><th class="p-3 text-right">Team wins</th></tr>
          </thead>
          <tbody>${scores.map((score,index) => {
            const link = linkByDiscord.get(score.discord_user_id);
            const profile = link ? profileById.get(link.user_id) : null;
            const name = profile?.username || link?.discord_username || ('Discord player ' + score.discord_user_id.slice(-5));
            const avatar = profile?.avatar_url || (link?.discord_avatar_hash && link?.discord_user_id
              ? 'https://cdn.discordapp.com/avatars/' + encodeURIComponent(link.discord_user_id) + '/' + encodeURIComponent(link.discord_avatar_hash) + '.png'
              : '');
            const player = profile
              ? '<a class="text-cyan-300 hover:text-cyan-100 font-semibold" href="#/profile/' + encodeURIComponent(profile.username) + '">' + escapeHtml(name) + '</a>'
              : '<span class="text-gray-200 font-semibold">' + escapeHtml(name) + '</span>';
            return '<tr class="border-b border-gray-800 hover:bg-gray-800/50"><td class="p-3 text-green-300 font-bold">#' + (index+1) + '</td><td class="p-3"><div class="flex items-center gap-3">' +
              (avatar ? '<img src="' + escapeHtml(avatar) + '" alt="" class="w-8 h-8 rounded-full object-cover" loading="lazy">' : '') +
              player + '</div></td><td class="p-3 text-right text-white tabular-nums">' + Number(score.total_wins || 0) +
              '</td><td class="p-3 text-right text-white tabular-nums">' + Number(score.team_wins || 0) + '</td></tr>';
          }).join('')}</tbody>
        </table>
      </div>
      <p class="text-xs text-gray-500 mt-4">Synced from ROM's matchmaking database. Rankings update when the bridge syncs.</p>`;
  } catch (error) {
    console.error('Could not load ROM matchmaking leaderboard:', error);
    target.innerHTML = '<p class="text-amber-300 text-center py-8">Leaderboard data is not available yet. Apply the Supabase migrations and run the bridge to populate it.</p>';
  }
}

export default { initModule };
