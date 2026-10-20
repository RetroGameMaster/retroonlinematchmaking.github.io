// Receives read-only SQLite snapshots from the separate ROM bridge worker.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const bridgeSecret = Deno.env.get("ROM_BRIDGE_SECRET");

if (!url || !serviceKey || !bridgeSecret) {
  throw new Error("Supabase URL, service role key, and ROM_BRIDGE_SECRET must be configured.");
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function snowflake(value: unknown): value is string {
  return typeof value === "string" && /^\d{15,22}$/.test(value);
}

function text(value: unknown, max: number): string | null {
  return typeof value === "string" ? value.trim().slice(0, max) || null : null;
}

function number(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.floor(value)))
    : fallback;
}

function array(value: unknown, max: number): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.length <= max &&
    value.every((row) => row !== null && typeof row === "object" && !Array.isArray(row));
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "POST required." }, 405);
  if (request.headers.get("x-rom-bridge-secret") !== bridgeSecret) {
    return json({ error: "Unauthorized bridge request." }, 401);
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ error: "A JSON object is required." }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }

  if (body.action === "sync_catalog") {
    if (!array(body.games, 500)) return json({ error: "games must contain at most 500 objects." }, 400);
    const { data, error } = await admin.rpc("sync_discord_bot_catalog", { p_games: body.games });
    if (error) {
      console.error("Bot catalog sync failed:", error.message);
      return json({ error: "Could not sync game catalog." }, 500);
    }
    return json({ ok: true, action: body.action, result: data });
  }

  if (body.action === "sync_invites") {
    if (!snowflake(body.guild_id) || !array(body.invites, 500)) {
      return json({ error: "sync_invites requires a Discord guild ID and up to 500 invites." }, 400);
    }

    const now = new Date().toISOString();
    const rows = [];
    for (const invite of body.invites) {
      if (invite.guild_id !== body.guild_id || !snowflake(invite.channel_id) ||
          !snowflake(invite.message_id)) {
        return json({ error: "Invite guild, channel, or message ID is invalid." }, 400);
      }
      const gameTitle = text(invite.game_title, 200);
      const expiresAt = new Date(String(invite.expires_at ?? ""));
      if (!gameTitle || !Number.isFinite(expiresAt.getTime())) {
        return json({ error: "Each invite requires a game title and valid expiry timestamp." }, 400);
      }
      rows.push({
        external_invite_id: `${body.guild_id}:${invite.message_id}`,
        guild_id: body.guild_id,
        channel_id: invite.channel_id,
        message_id: invite.message_id,
        game_title: gameTitle,
        console: text(invite.console, 80),
        minimum_players: number(invite.minimum_players, 2, 1, 100),
        player_count: number(invite.player_count, 0, 0, 1000),
        role_name: text(invite.role_name, 100),
        connection_methods: text(invite.connection_methods, 1000),
        additional_notes: text(invite.additional_notes, 1000),
        discord_url: `https://discord.com/channels/${body.guild_id}/${invite.channel_id}/${invite.message_id}`,
        expires_at: expiresAt.toISOString(),
        is_expired: expiresAt.getTime() <= Date.now(),
        updated_at: now,
      });
    }

    if (rows.length) {
      const { error } = await admin.from("discord_bot_lfg_invites")
        .upsert(rows, { onConflict: "external_invite_id" });
      if (error) {
        console.error("Bot invite upsert failed:", error.message);
        return json({ error: "Could not save invite snapshot." }, 500);
      }
    }

    let cleanup = admin.from("discord_bot_lfg_invites")
      .update({ is_expired: true, updated_at: now })
      .eq("guild_id", body.guild_id)
      .eq("is_expired", false);
    if (rows.length) {
      const keys = rows.map((row) => `"${row.external_invite_id}"`).join(",");
      cleanup = cleanup.not("external_invite_id", "in", `(${keys})`);
    }
    const { error: cleanupError } = await cleanup;
    if (cleanupError) {
      console.error("Bot invite reconciliation failed:", cleanupError.message);
      return json({ error: "Could not reconcile invite snapshot." }, 500);
    }
    return json({ ok: true, action: body.action, invites_received: rows.length });
  }

  if (body.action === "sync_services") {
    if (!snowflake(body.guild_id) || !array(body.services, 500)) {
      return json({ error: "sync_services requires a Discord guild ID and up to 500 services." }, 400);
    }
    const now = new Date().toISOString();
    const rows = [];
    for (const service of body.services) {
      const sourceKey = text(service.source_key, 160);
      const gameTitle = text(service.game_title, 200);
      const serviceName = text(service.service_name, 100);
      if (service.guild_id !== body.guild_id || !sourceKey || !gameTitle || !serviceName) {
        return json({ error: "Each service requires matching guild_id, source_key, service_name, and game_title." }, 400);
      }
      rows.push({
        guild_id: body.guild_id,
        source_key: sourceKey,
        service_name: serviceName,
        game_title: gameTitle,
        console: text(service.console, 80),
        players_online: number(service.players_online, 0, 0, 1000000),
        discord_url: text(service.discord_url, 500),
        is_active: true,
        updated_at: now,
      });
    }

    const { error: staleError } = await admin.from("discord_live_services")
      .update({ is_active: false, updated_at: now })
      .eq("guild_id", body.guild_id);
    if (staleError) {
      console.error("Bot service deactivation failed:", staleError.message);
      return json({ error: "Could not prepare service snapshot." }, 500);
    }
    if (rows.length) {
      const { error } = await admin.from("discord_live_services")
        .upsert(rows, { onConflict: "guild_id,source_key" });
      if (error) {
        console.error("Bot service snapshot failed:", error.message);
        return json({ error: "Could not save service snapshot." }, 500);
      }
    }
    return json({ ok: true, action: body.action, services_received: rows.length });
  }

  if (body.action === "sync_stats") {
    const stats = body.stats;
    if (!stats || typeof stats !== "object" || Array.isArray(stats)) {
      return json({ error: "sync_stats requires a stats object." }, 400);
    }
    const row = {
      scope_key: "global",
      game_count: number(stats.game_count, 0, 0, 2147483647),
      active_service_count: number(stats.active_service_count, 0, 0, 2147483647),
      active_player_count: number(stats.active_player_count, 0, 0, 2147483647),
      active_invite_count: number(stats.active_invite_count, 0, 0, 2147483647),
      total_wins: number(stats.total_wins, 0, 0, 2147483647),
      team_wins: number(stats.team_wins, 0, 0, 2147483647),
      updated_at: new Date().toISOString(),
    };
    const { error } = await admin.from("discord_bot_public_stats")
      .upsert(row, { onConflict: "scope_key" });
    if (error) {
      console.error("Bot aggregate stats sync failed:", error.message);
      return json({ error: "Could not save aggregate stats." }, 500);
    }
    return json({ ok: true, action: body.action });
  }

  return json({ error: "Unsupported action." }, 400);
});
