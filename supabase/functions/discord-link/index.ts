// Supabase Edge Function: discord-link
// Required secrets: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, SITE_URL
// Supabase provides SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("SITE_URL") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const clientId = Deno.env.get("DISCORD_CLIENT_ID")!;
const clientSecret = Deno.env.get("DISCORD_CLIENT_SECRET")!;
const siteUrl = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
const redirectUri = `${supabaseUrl}/functions/v1/discord-link?mode=callback`;

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function redirectResult(userId: string | null, result: string) {
  const url = new URL(siteUrl || "https://retroonlinematchmaking.com");
  // Keep the router path clean; pass the result as a normal query parameter.
  url.searchParams.set("discord_link", result);
  url.hash = userId
    ? `/profile/${encodeURIComponent(userId)}`
    : `/auth`;
  return Response.redirect(url.toString(), 302);
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await caller.auth.getUser(token);
  return error || !data.user ? null : data.user;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!siteUrl || !clientId || !clientSecret || !supabaseUrl || !serviceKey) {
    return json({ error: "Discord linking is not configured on the server." }, 503);
  }

  const url = new URL(req.url);

  // Discord sends the browser back here after authorization.
  if (req.method === "GET" && url.searchParams.get("mode") === "callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return redirectResult(null, "missing_parameters");

    const stateHash = await sha256(state);
    const now = new Date().toISOString();
    const { data: stateRow, error: stateError } = await admin
      .from("discord_oauth_states")
      .update({ used_at: now })
      .eq("state_hash", stateHash)
      .is("used_at", null)
      .gt("expires_at", now)
      .select("user_id")
      .maybeSingle();

    if (stateError || !stateRow) return redirectResult(null, "invalid_or_expired_state");

    try {
      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }),
      });
      if (!tokenResponse.ok) return redirectResult(stateRow.user_id, "token_exchange_failed");

      const tokenData = await tokenResponse.json();
      const discordResponse = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!discordResponse.ok) return redirectResult(stateRow.user_id, "discord_identity_failed");

      const discordUser = await discordResponse.json();
      if (typeof discordUser.id !== "string" || !/^\d{15,22}$/.test(discordUser.id)) {
        return redirectResult(stateRow.user_id, "invalid_discord_identity");
      }

      const { error: insertError } = await admin.from("discord_account_links").insert({
        user_id: stateRow.user_id,
        discord_user_id: discordUser.id,
        discord_username: discordUser.global_name || discordUser.username || null,
        discord_avatar_hash: discordUser.avatar || null,
      });

      if (insertError) {
        // Unique conflict means this website account or Discord account is already linked.
        return redirectResult(stateRow.user_id, insertError.code === "23505" ? "already_linked" : "link_failed");
      }
      return redirectResult(stateRow.user_id, "success");
    } catch {
      return redirectResult(stateRow.user_id, "link_failed");
    }
  }

  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const user = await requireUser(req);
  if (!user) return json({ error: "Sign in to ROM first." }, 401);

  let body: { action?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }

  if (body.action === "status") {
    const { data, error } = await admin
      .from("discord_account_links")
      .select("discord_username, linked_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) return json({ error: "Could not load Discord link status." }, 500);
    return json({ linked: !!data, username: data?.discord_username ?? null, linked_at: data?.linked_at ?? null });
  }

  if (body.action !== "start") return json({ error: "Unsupported action." }, 400);

  const state = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  const { error: stateInsertError } = await admin.from("discord_oauth_states").insert({
    user_id: user.id,
    state_hash: await sha256(state),
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (stateInsertError) return json({ error: "Could not start Discord linking." }, 500);

  const discordUrl = new URL("https://discord.com/oauth2/authorize");
  discordUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify",
    state,
  }).toString();
  return json({ url: discordUrl.toString() });
});
