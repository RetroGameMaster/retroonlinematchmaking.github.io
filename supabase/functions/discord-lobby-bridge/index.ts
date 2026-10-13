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
  const channelId = body.channel_id;
  const messageId = body.message_id;
  if (!validSnowflake(guildId) || !validSnowflake(channelId) || !validSnowflake(messageId)) {
    return json({ error: "guild_id, channel_id, and message_id must be Discord snowflake strings." }, 400);
  }
  const key = `${guildId}:${messageId}`;

  if (body.action === "expire") {
    const { error } = await admin.from("discord_live_lobbies")
      .update({ is_expired: true, updated_at: new Date().toISOString() })
      .eq("discord_lobby_key", key);
    if (error) return json({ error: "Could not expire lobby." }, 500);
    return json({ ok: true, action: "expire" });
  }

  if (body.action !== "upsert") return json({ error: "action must be upsert or expire." }, 400);
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
