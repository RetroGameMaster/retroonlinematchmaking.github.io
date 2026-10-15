// Supabase Edge Function: discord-lobby-bridge
// Receives snapshots from the read-only ROM SQLite bridge. Never expose the service-role key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const bridgeSecret = Deno.env.get("ROM_BRIDGE_SECRET")!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
function snowflake(v: unknown): v is string {
  return typeof v === "string" && /^\d{15,22}$/.test(v);
}
function num(v: unknown, fallback: number, min: number, max: number): number {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.min(max, Math.max(min, Math.floor(v))) : fallback;
}
function txt(v: unknown, max: number): string | null {
  return typeof v === "string" ? v.slice(0, max) : null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST required." }, 405);
  if (!bridgeSecret || !serviceKey || req.headers.get("x-rom-bridge-secret") !== bridgeSecret)
    return json({ error: "Unauthorized bridge request." }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  const action = body.action;

  if (action === "sync") {
    if (!snowflake(body.guild_id) || !Array.isArray(body.lobbies) || body.lobbies.length > 500)
      return json({ error: "sync requires guild_id and up to 500 lobbies." }, 400);
    const rows = [];
    for (const raw of body.lobbies) {
      if (!raw || typeof raw !== "object") return json({ error: "Invalid lobby row." }, 400);
      const l = raw as Record<string, unknown>;
      if (l.guild_id !== body.guild_id || !snowflake(l.guild_id) || !snowflake(l.channel_id) ||
          !snowflake(l.message_id) || !snowflake(l.host_discord_id))
        return json({ error: "Lobby Discord IDs are invalid or guild IDs do not match." }, 400);
      if (typeof l.game_title !== "string" || !l.game_title.trim() || l.game_title.length > 200)
        return json({ error: "Lobby game_title is required (max 200 characters)." }, 400);
      const expiry = new Date(String(l.expires_at ?? ""));
      if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now())
        return json({ error: "Lobby expires_at must be in the future." }, 400);
      rows.push({
        discord_lobby_key: `${l.guild_id}:${l.message_id}`,
        guild_id: l.guild_id, channel_id: l.channel_id, message_id: l.message_id,
        host_discord_id: l.host_discord_id,
        game_id: num(l.game_id, 0, 0, 2147483647) || null,
        game_title: l.game_title.trim(), console: txt(l.console, 80),
        minimum_players: num(l.minimum_players, 2, 1, 100),
        joined_players: num(l.joined_players, 0, 0, 100),
        connection_methods: txt(l.connection_methods, 1000),
        additional_notes: txt(l.additional_notes, 1000),
        discord_url: `https://discord.com/channels/${l.guild_id}/${l.channel_id}/${l.message_id}`,
        expires_at: expiry.toISOString(), is_expired: false, updated_at: new Date().toISOString(),
      });
    }
    if (rows.length) {
      const { error } = await admin.from("discord_live_lobbies").upsert(rows, { onConflict: "discord_lobby_key" });
      if (error) { console.error("Lobby sync failed:", error.message); return json({ error: "Could not save lobby snapshot." }, 500); }
    }
    // Expire rows omitted from this full snapshot only when they belong to this guild.
    const activeKeys = rows.map((r) => r.discord_lobby_key);
    let cleanup = admin.from("discord_live_lobbies")
      .update({ is_expired: true, updated_at: new Date().toISOString() })
      .eq("guild_id", body.guild_id).eq("is_expired", false);
    if (activeKeys.length) cleanup = cleanup.not("discord_lobby_key", "in", `(${activeKeys.map((k) => `"${k}"`).join(",")})`);
    const { error: cleanupError } = await cleanup;
    if (cleanupError) { console.error("Lobby snapshot cleanup failed:", cleanupError.message); return json({ error: "Could not reconcile lobby snapshot." }, 500); }
    return json({ ok: true, action, lobbies_received: rows.length });
  }

  if (action === "sync_services") {
    if (!snowflake(body.guild_id) || !Array.isArray(body.services) || body.services.length > 500)
      return json({ error: "sync_services requires guild_id and up to 500 services." }, 400);
    const snapshotAt = new Date().toISOString();
    const rows = [];
    for (const raw of body.services) {
      if (!raw || typeof raw !== "object") return json({ error: "Invalid service row." }, 400);
      const s = raw as Record<string, unknown>;
      if (s.guild_id !== body.guild_id || typeof s.source_key !== "string" || !s.source_key.trim() ||
          s.source_key.length > 160 || typeof s.service_name !== "string" || !s.service_name.trim() ||
          typeof s.game_title !== "string" || !s.game_title.trim())
        return json({ error: "Each service needs source_key, service_name, game_title, and matching guild_id." }, 400);
      rows.push({
        guild_id: body.guild_id, source_key: s.source_key,
        service_name: s.service_name.slice(0, 100), game_title: s.game_title.slice(0, 200),
        console: txt(s.console, 80), players_online: num(s.players_online, 0, 0, 1000000),
        discord_url: txt(s.discord_url, 500), is_active: true, updated_at: snapshotAt,
      });
    }
    // Mark current rows inactive first, then reactivate rows present in this snapshot.
    // If upsert fails, the next poll can safely restore the snapshot.
    const { error: staleError } = await admin.from("discord_live_services")
      .update({ is_active: false }).eq("guild_id", body.guild_id);
    if (staleError) { console.error("Service deactivation failed:", staleError.message); return json({ error: "Could not prepare service snapshot." }, 500); }
    if (rows.length) {
      const { error } = await admin.from("discord_live_services").upsert(rows, { onConflict: "guild_id,source_key" });
      if (error) { console.error("Service sync failed:", error.message); return json({ error: "Could not save live service snapshot." }, 500); }
    }
    return json({ ok: true, action, services_received: rows.length });
  }

  if (action === "sync_members") {
    if (!snowflake(body.guild_id) || !Array.isArray(body.members) || body.members.length > 100)
      return json({ error: "sync_members requires guild_id and up to 100 members." }, 400);
    const rows = [];
    for (const raw of body.members) {
      if (!raw || typeof raw !== "object") return json({ error: "Invalid member row." }, 400);
      const m = raw as Record<string, unknown>;
      if (m.guild_id !== body.guild_id || !snowflake(m.discord_user_id) ||
          !m.profile_data || typeof m.profile_data !== "object" || Array.isArray(m.profile_data))
        return json({ error: "Each member needs a valid Discord ID, matching guild_id, and profile_data object." }, 400);
      rows.push({
        guild_id: body.guild_id, discord_user_id: m.discord_user_id,
        profile_data: m.profile_data,
        total_wins: num(m.total_wins, 0, 0, 2147483647),
        team_wins: num(m.team_wins, 0, 0, 2147483647),
        updated_at: new Date().toISOString(),
      });
    }
    if (rows.length) {
      const { error } = await admin.from("discord_member_snapshots")
        .upsert(rows, { onConflict: "guild_id,discord_user_id" });
      if (error) { console.error("Member sync failed:", error.message); return json({ error: "Could not save member snapshot." }, 500); }
    }
    return json({ ok: true, action, members_received: rows.length });
  }

  // Preserve the existing single-lobby upsert/expire API.
  const guildId = body.guild_id, channelId = body.channel_id, messageId = body.message_id;
  if (!snowflake(guildId) || !snowflake(channelId) || !snowflake(messageId))
    return json({ error: "guild_id, channel_id, and message_id must be Discord snowflake strings." }, 400);
  const key = `${guildId}:${messageId}`;
  if (action === "expire") {
    const { error } = await admin.from("discord_live_lobbies")
      .update({ is_expired: true, updated_at: new Date().toISOString() }).eq("discord_lobby_key", key);
    if (error) return json({ error: "Could not expire lobby." }, 500);
    return json({ ok: true, action });
  }
  if (action !== "upsert") return json({ error: "Unsupported action." }, 400);
  if (!snowflake(body.host_discord_id) || typeof body.game_title !== "string" ||
      !body.game_title.trim() || body.game_title.length > 200)
    return json({ error: "upsert requires a valid host_discord_id and game_title." }, 400);
  const expiry = new Date(String(body.expires_at ?? ""));
  if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now())
    return json({ error: "expires_at must be a future ISO timestamp." }, 400);
  const row = {
    discord_lobby_key: key, guild_id: guildId, channel_id: channelId, message_id: messageId,
    host_discord_id: body.host_discord_id, game_id: num(body.game_id, 0, 0, 2147483647) || null,
    game_title: body.game_title.trim(), console: txt(body.console, 80),
    minimum_players: num(body.minimum_players, 2, 1, 100), joined_players: num(body.joined_players, 0, 0, 100),
    connection_methods: txt(body.connection_methods, 1000), additional_notes: txt(body.additional_notes, 1000),
    discord_url: `https://discord.com/channels/${guildId}/${channelId}/${messageId}`,
    expires_at: expiry.toISOString(), is_expired: false, updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from("discord_live_lobbies").upsert(row, { onConflict: "discord_lobby_key" });
  if (error) return json({ error: "Could not save lobby." }, 500);
  return json({ ok: true, action, discord_lobby_key: key });
});
