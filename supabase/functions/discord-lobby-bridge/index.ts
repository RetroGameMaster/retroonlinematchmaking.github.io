// Supabase Edge Function: discord-lobby-bridge
// Configure ROM_BRIDGE_SECRET as a Supabase Function secret. Never put it in browser code.
// Bot sends POST JSON with x-rom-bridge-secret; service role stays in Supabase.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const bridgeSecret = Deno.env.get("ROM_BRIDGE_SECRET")!;
const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function validSnowflake(value: unknown): value is string {
  return typeof value === "string" && /^\d{15,22}$/.test(value);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST required." }, 405);
  if (!bridgeSecret || !serviceKey || req.headers.get("x-rom-bridge-secret") !== bridgeSecret) {
    return json({ error: "Unauthorized bridge request." }, 401);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }

  const guildId = body.guild_id;
  if (!validSnowflake(guildId)) {
    return json({ error: "guild_id must be a Discord snowflake string." }, 400);
  }

  // Sync a batch of member profile/preferences and leaderboard data from SQLite.
  if (body.action === "sync_members") {
    if (!Array.isArray(body.members) || body.members.length > 100) {
      return json({ error: "members must be an array with at most 100 records." }, 400);
    }
    const numeric = (v: unknown) => typeof v === "number" && Number.isFinite(v)
      ? Math.min(2147483647, Math.max(0, Math.floor(v))) : 0;
    const rows: Array<Record<string, unknown>> = [];
    for (const member of body.members as Array<Record<string, unknown>>) {
      if (!validSnowflake(member.discord_user_id) || member.guild_id !== guildId ||
          !member.profile_data || typeof member.profile_data !== "object" || Array.isArray(member.profile_data)) {
        return json({ error: "A member snapshot has invalid IDs or profile_data." }, 400);
      }
      rows.push({
        discord_user_id: member.discord_user_id,
        guild_id: guildId,
        profile_data: member.profile_data,
        total_wins: numeric(member.total_wins),
        team_wins: numeric(member.team_wins),
        updated_at: new Date().toISOString(),
      });
    }
    if (rows.length) {
      const { error } = await admin.from("discord_member_snapshots").upsert(rows, { onConflict: "discord_user_id" });
      if (error) return json({ error: "Could not save member snapshots." }, 500);
    }
    return json({ ok: true, action: "sync_members", members_synced: rows.length });
  }
  // Sync live API/service activity from the separate read-only SQLite bridge.
  // This path is deliberately separate from LFG lobby sync.
  if (body.action === "sync_services") {
    if (!Array.isArray(body.services) || body.services.length > 500) {
      return json({ error: "services must be an array with at most 500 records." }, 400);
    }
    const activeKeys: string[] = [];
    for (const service of body.services as Array<Record<string, unknown>>) {
      if (typeof service.source_key !== "string" || !service.source_key.trim() ||
          service.source_key.length > 180 || !validSnowflake(service.guild_id) ||
          service.guild_id !== guildId || typeof service.service_name !== "string" ||
          !service.service_name.trim() || typeof service.game_title !== "string" || !service.game_title.trim()) {
        return json({ error: "A service record has missing or invalid source_key, guild_id, service_name, or game_title." }, 400);
      }
      const numeric = (v: unknown) => typeof v === "number" && Number.isFinite(v)
        ? Math.min(1000000, Math.max(0, Math.floor(v))) : 0;
      const row = {
        source_key: service.source_key.trim().slice(0, 180),
        guild_id: guildId,
        service_name: service.service_name.trim().slice(0, 100),
        game_title: service.game_title.trim().slice(0, 200),
        console: typeof service.console === "string" ? service.console.slice(0, 80) : null,
        players_online: numeric(service.players_online),
        discord_url: typeof service.discord_url === "string" && service.discord_url.startsWith("https://discord.com/") ? service.discord_url.slice(0, 500) : null,
        is_active: true,
        updated_at: new Date().toISOString(),
      };
      const { error } = await admin.from("discord_live_services").upsert(row, { onConflict: "source_key" });
      if (error) return json({ error: "Could not upsert live service snapshot." }, 500);
      activeKeys.push(row.source_key);
    }
    let staleQuery = admin.from("discord_live_services")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("guild_id", guildId).eq("is_active", true);
    if (activeKeys.length) staleQuery = staleQuery.not("source_key", "in", "(" + activeKeys.map(k => '"' + k.replace(/"/g, '\\"') + '"').join(",") + ")");
    const { error: staleError } = await staleQuery;
    if (staleError) return json({ error: "Could not expire stale service records." }, 500);
    return json({ ok: true, action: "sync_services", active_services: activeKeys.length });
  }
  // Snapshot sync lets a separate read-only process poll the bot's SQLite database.
  // It does not require modifying the bot application.
  if (body.action === "sync") {
    if (!Array.isArray(body.lobbies) || body.lobbies.length > 500) {
      return json({ error: "lobbies must be an array with at most 500 records." }, 400);
    }
    const rows = body.lobbies as Array<Record<string, unknown>>;
    const activeKeys: string[] = [];
    for (const lobby of rows) {
      if (!validSnowflake(lobby.guild_id) || lobby.guild_id !== guildId ||
          !validSnowflake(lobby.channel_id) || !validSnowflake(lobby.message_id) ||
          !validSnowflake(lobby.host_discord_id) ||
          typeof lobby.game_title !== "string" || !lobby.game_title.trim()) {
        return json({ error: "A lobby has missing or invalid Discord IDs or game_title." }, 400);
      }
      const expiry = new Date(String(lobby.expires_at ?? ""));
      if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now()) continue;
      const lobbyKey = `${guildId}:${lobby.message_id}`;
      const numeric = (v: unknown, fallback: number, min: number, max: number) =>
        typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : fallback;
      const row = {
        discord_lobby_key: lobbyKey,
        guild_id: guildId,
        channel_id: lobby.channel_id,
        message_id: lobby.message_id,
        host_discord_id: lobby.host_discord_id,
        game_id: numeric(lobby.game_id, 0, 0, 2147483647) || null,
        game_title: String(lobby.game_title).trim().slice(0, 200),
        console: typeof lobby.console === "string" ? lobby.console.slice(0, 80) : null,
        minimum_players: numeric(lobby.minimum_players, 2, 1, 100),
        joined_players: numeric(lobby.joined_players, 0, 0, 100),
        connection_methods: typeof lobby.connection_methods === "string" ? lobby.connection_methods.slice(0, 1000) : null,
        additional_notes: typeof lobby.additional_notes === "string" ? lobby.additional_notes.slice(0, 1000) : null,
        discord_url: `https://discord.com/channels/${guildId}/${lobby.channel_id}/${lobby.message_id}`,
        expires_at: expiry.toISOString(),
        is_expired: false,
        updated_at: new Date().toISOString(),
      };
      const { error } = await admin.from("discord_live_lobbies").upsert(row, { onConflict: "discord_lobby_key" });
      if (error) return json({ error: "Could not upsert a lobby snapshot." }, 500);
      activeKeys.push(lobbyKey);
    }
    let staleQuery = admin.from("discord_live_lobbies")
      .update({ is_expired: true, updated_at: new Date().toISOString() })
      .eq("guild_id", guildId)
      .eq("is_expired", false);
    if (activeKeys.length) staleQuery = staleQuery.not("discord_lobby_key", "in", `(${activeKeys.map(k => `"${k}"`).join(",")})`);
    const { error: staleError } = await staleQuery;
    if (staleError) return json({ error: "Could not expire stale lobby records." }, 500);
    return json({ ok: true, action: "sync", active_lobbies: activeKeys.length });
  }

  const channelId = body.channel_id;
  const messageId = body.message_id;
  if (!validSnowflake(channelId) || !validSnowflake(messageId)) {
    return json({ error: "channel_id and message_id must be Discord snowflake strings." }, 400);
  }
  const key = `${guildId}:${messageId}`;

  if (body.action === "expire") {
    const { error } = await admin.from("discord_live_lobbies")
      .update({ is_expired: true, updated_at: new Date().toISOString() })
      .eq("discord_lobby_key", key);
    if (error) return json({ error: "Could not expire lobby." }, 500);
    return json({ ok: true, action: "expire" });
  }

  if (body.action !== "upsert") return json({ error: "action must be upsert, expire, or sync." }, 400);
  if (!validSnowflake(body.host_discord_id)) return json({ error: "host_discord_id must be a Discord snowflake string." }, 400);
  if (typeof body.game_title !== "string" || !body.game_title.trim() || body.game_title.length > 200) {
    return json({ error: "game_title is required (max 200 characters)." }, 400);
  }
  const expiry = new Date(String(body.expires_at ?? ""));
  if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now()) {
    return json({ error: "expires_at must be a future ISO timestamp." }, 400);
  }
  const numeric = (v: unknown, fallback: number, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : fallback;

  const row = {
    discord_lobby_key: key,
    guild_id: guildId,
    channel_id: channelId,
    message_id: messageId,
    host_discord_id: body.host_discord_id,
    game_id: numeric(body.game_id, 0, 0, 2147483647) || null,
    game_title: body.game_title.trim(),
    console: typeof body.console === "string" ? body.console.slice(0, 80) : null,
    minimum_players: numeric(body.minimum_players, 2, 2, 100),
    joined_players: numeric(body.joined_players, 0, 0, 100),
    connection_methods: typeof body.connection_methods === "string" ? body.connection_methods.slice(0, 1000) : null,
    additional_notes: typeof body.additional_notes === "string" ? body.additional_notes.slice(0, 1000) : null,
    discord_url: `https://discord.com/channels/${guildId}/${channelId}/${messageId}`,
    expires_at: expiry.toISOString(),
    is_expired: false,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin.from("discord_live_lobbies").upsert(row, { onConflict: "discord_lobby_key" });
  if (error) return json({ error: "Could not save lobby." }, 500);
  return json({ ok: true, action: "upsert", discord_lobby_key: key });
});
