import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const pollSecret = Deno.env.get("EXTERNAL_LIVE_POLL_SECRET");
const maxResponseBytes = 5_000_000;

if (!supabaseUrl || !serviceRoleKey || !pollSecret) {
  throw new Error("Supabase URL, service-role key, and EXTERNAL_LIVE_POLL_SECRET must be configured.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Activity = {
  title: string;
  players: number;
  console?: string | null;
  kind: "players" | "lobbies";
};

type Provider = {
  key: string;
  name: string;
  url?: string;
  parse?: (body: string) => Activity[];
  load?: () => Promise<Activity[]>;
};

type CatalogGame = {
  id: string;
  title: string;
  console: string | null;
};

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function field(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key];
    const actualKey = Object.keys(row).find(candidate => candidate.toLowerCase() === key.toLowerCase());
    if (actualKey) return row[actualKey];
  }
  return undefined;
}

function rows(value: unknown, source: string): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.some(item => !object(item))) {
    throw new Error(`${source} response did not contain the expected list.`);
  }
  return value as Record<string, unknown>[];
}

function count(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

function activity(
  titleValue: unknown,
  playersValue: unknown,
  consoleValue?: unknown,
  kind: Activity["kind"] = "players",
): Activity | null {
  if (typeof titleValue !== "string" || !titleValue.trim()) return null;
  const players = count(playersValue);
  if (!players) return null;
  return {
    title: titleValue.trim().slice(0, 200),
    players,
    console: typeof consoleValue === "string" ? consoleValue.trim().slice(0, 80) || null : null,
    kind,
  };
}

function aggregate(entries: Activity[]): Activity[] {
  const grouped = new Map<string, Activity>();
  for (const entry of entries) {
    const key = `${entry.title.toLocaleLowerCase()}|${entry.console?.toLocaleLowerCase() ?? ""}|${entry.kind}`;
    const previous = grouped.get(key);
    if (previous) previous.players += entry.players;
    else grouped.set(key, { ...entry });
  }
  return [...grouped.values()];
}

function jsonProvider(
  key: string,
  name: string,
  url: string,
  parse: (value: unknown) => Activity[],
): Provider {
  return {
    key,
    name,
    url,
    parse(body) {
      let value: unknown;
      try {
        value = JSON.parse(body);
      } catch {
        throw new Error("Provider returned invalid JSON.");
      }
      return parse(value);
    },
  };
}

function parsePrometheus(body: string): Activity[] {
  if (!/<prometheus(?:\s|>)/i.test(body) || !/<\/prometheus\s*>/i.test(body)) {
    throw new Error("Provider response is not a complete Prometheus lobby document.");
  }
  const entries: Activity[] = [];
  const gamePattern = /<game\b([^>]*)>([\s\S]*?)<\/game\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = gamePattern.exec(body))) {
    const nameValue = match[1].match(/\bname\s*=\s*["']([^"']+)["']/i)?.[1];
    const name = nameValue?.replaceAll("&amp;", "&").replaceAll("&quot;", '"')
      .replaceAll("&apos;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
    if (!name) continue;
    const groups = [...match[2].matchAll(/<group\b([^>]*)>/gi)];
    let players = 0;
    for (const group of groups) {
      const groupName = group[1].match(/\bname\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
      const userCount = group[1].match(/\busercount\s*=\s*["']([^"']*)["']/i)?.[1];
      if (groupName.toLowerCase() !== "groupless") players += count(userCount);
    }
    if (!groups.length) {
      const gameCount = match[1].match(/\busercount\s*=\s*["']([^"']*)["']/i)?.[1];
      players = count(gameCount);
    }
    const entry = activity(name, players);
    if (entry) entries.push(entry);
  }
  return entries;
}

async function loadPsRewiredActivities(): Promise<Activity[]> {
  const applications = [
    [10414, "us"], [10411, "eu"], [20174, "us"], [20214, "us"], [20774, "us"],
    [10694, "us"], [20034, "us"], [20304, "us"], [21244, "us"], [21784, "us"],
    [10472, "us"], [20604, "us"], [10782, "us"], [11484, "us"], [20244, "us"],
  ] as const;
  const playersByApplication = new Map<number, number>();

  for (let offset = 0; offset < applications.length; offset += 5) {
    const batch = applications.slice(offset, offset + 5);
    const results = await Promise.all(batch.map(async ([applicationId, region]) => {
      const url = `https://api.psrewired.com/${region}/api/universes/players?applicationId=${applicationId}`;
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error(`PSRewired application ${applicationId} returned HTTP ${response.status}.`);
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error(`PSRewired application ${applicationId} returned invalid JSON.`);
      }
      return { applicationId, players: rows(payload, `PSRewired application ${applicationId}`).length };
    }));
    for (const result of results) {
      if (result.players > 0) playersByApplication.set(result.applicationId, result.players);
    }
  }

  return [...playersByApplication.entries()].map(([applicationId, playerCount]) => ({
    title: String(applicationId),
    players: playerCount,
    kind: "players" as const,
  }));
}

async function loadMgnPspActivities(): Promise<Activity[]> {
  const response = await fetch("https://home.mgn.pub/data.json", {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`MGN PSP returned HTTP ${response.status}.`);
  const body = await response.text();
  if (new TextEncoder().encode(body).byteLength > maxResponseBytes) {
    throw new Error("MGN PSP response exceeded the 5 MB safety limit.");
  }
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error("MGN PSP returned invalid JSON.");
  }
  const games = field(object(payload) ?? {}, "games");
  if (!Array.isArray(games)) throw new Error("MGN PSP response did not contain a game list.");

  return aggregate(games.flatMap(item => {
    const game = object(item);
    if (!game) return [];
    const groups = field(game, "groups");
    if (!Array.isArray(groups)) return [];
    const players = groups.reduce((total, item) => {
      const group = object(item);
      if (!group || String(field(group, "name") ?? "").toLowerCase() === "groupless") return total;
      return total + count(field(group, "usercount"));
    }, 0);
    const entry = activity(field(game, "name"), players, "PSP");
    return entry ? [entry] : [];
  }));
}

async function loadMgnXmlActivities(
  path: string,
  consoleName: string,
  fallbackTitle: string,
): Promise<Activity[]> {
  const response = await fetch(`https://home.mgn.pub/${path}/status.xml`, {
    headers: { Accept: "application/xml, text/xml" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`MGN ${consoleName} returned HTTP ${response.status}.`);
  const body = await response.text();
  if (new TextEncoder().encode(body).byteLength > maxResponseBytes) {
    throw new Error(`MGN ${consoleName} response exceeded the 5 MB safety limit.`);
  }
  const rootMatch = body.match(/<([a-z][\w-]*)\b([^>]*)>/i);
  if (!rootMatch || !new RegExp(`<\\/${rootMatch[1]}\\s*>|<${rootMatch[1]}\\b[^>]*\\/\\s*>`, "i").test(body)) {
    throw new Error(`MGN ${consoleName} response was not a complete XML document.`);
  }

  const entries: Activity[] = [];
  const playersByGame = new Map<string, number>();
  const roomPattern = /<room\b([^>]*)>([\s\S]*?)<\/room\s*>/gi;
  let roomMatch: RegExpExecArray | null;
  while ((roomMatch = roomPattern.exec(body))) {
    const roomName = roomMatch[1].match(/\bname\s*=\s*["']([^"']+)["']/i)?.[1];
    const users = [...roomMatch[2].matchAll(/<user\b([^>]*)>([\s\S]*?)<\/user\s*>/gi)];
    if (users.length) {
      users.forEach(user => {
        const gameName = user[1].match(/\bgamename\s*=\s*["']([^"']+)["']/i)?.[1] || roomName;
        if (gameName) playersByGame.set(gameName, (playersByGame.get(gameName) || 0) + 1);
      });
    } else if (roomName) {
      const playerCount = count(roomMatch[1].match(/\busercount\s*=\s*["']([^"']+)["']/i)?.[1]);
      if (playerCount) {
        const gameName = roomName.replace(/\s+Room\s+\d+$/i, "");
        playersByGame.set(gameName, (playersByGame.get(gameName) || 0) + playerCount);
      }
    }
  }
  for (const [gameName, playerCount] of playersByGame) {
    const entry = activity(gameName, playerCount, consoleName);
    if (entry) entries.push(entry);
  }

  const rootPlayers = count(rootMatch[2].match(/\busercount\s*=\s*["']([^"']+)["']/i)?.[1]);
  if (!entries.length && rootPlayers) {
    const entry = activity(fallbackTitle, rootPlayers, consoleName);
    if (entry) entries.push(entry);
  }
  return aggregate(entries);
}

const providers: Provider[] = [
  jsonProvider("dolphin", "Dolphin Netplay", "https://lobby.dolphin-emu.org/v0/list", value => {
    const root = object(value);
    const sessions = field(root ?? {}, "sessions");
    if (!root || !Array.isArray(sessions)) throw new Error("Provider response did not contain sessions.");
    return aggregate(sessions.flatMap(item => {
      const session = object(item);
      if (!session) return [];
      const entry = activity(field(session, "game"), field(session, "player_count") ?? 1);
      return entry ? [entry] : [];
    }));
  }),
  jsonProvider("insignia", "Insignia", "https://insignia.live/api/v1/titles", value =>
    aggregate(rows(value, "Insignia").flatMap(title => {
      const entry = activity(field(title, "title_name"), field(title, "active_user_count"));
      return entry ? [entry] : [];
    }))
  ),
  { key: "mgn-psp", name: "Madness Gaming Network", load: loadMgnPspActivities },
  { key: "mgn-3ds", name: "Madness Gaming Network", load: () => loadMgnXmlActivities("3DS", "3DS", "3DS Network") },
  { key: "mgn-g5", name: "Madness Gaming Network", load: () => loadMgnXmlActivities("G5", "G5", "G5 Network") },
  { key: "mgn-fw5", name: "Madness Gaming Network", load: () => loadMgnXmlActivities("FW5", "FW5", "FW5 Network") },
  { key: "mgn-zz", name: "Madness Gaming Network", load: () => loadMgnXmlActivities("ZZ", "ZZ", "ZZ Network") },
  { key: "mgn-minecraft", name: "Madness Gaming Network", load: () => loadMgnXmlActivities("minecraft", "Minecraft", "Minecraft") },
  jsonProvider("mohh1", "Medal of Honor Heroes Online", "http://ablondel.ddns.net/games/api", value => {
    const root = object(value);
    const stats = object(field(root ?? {}, "stats"));
    if (!root || !stats) throw new Error("Provider response did not contain player statistics.");
    const entry = activity("Medal of Honor: Heroes", field(stats, "totalPlayers"), "PSP");
    return entry ? [entry] : [];
  }),
  jsonProvider("retroarch", "RetroArch Netplay", "http://lobby.libretro.com/list", value =>
    aggregate(rows(value, "RetroArch").flatMap(lobby => {
      const fields = object(field(lobby, "fields")) ?? lobby;
      const gameName = field(fields, "game_name", "game");
      const entry = activity(gameName, 1, undefined, "lobbies");
      return entry ? [entry] : [];
    }))
  ),
  jsonProvider("openspy", "OpenSpy", "https://openspy-website.nyc3.digitaloceanspaces.com/servers.json", value =>
    aggregate(rows(value, "OpenSpy").flatMap(server => {
      const entry = activity(
        field(server, "gamename", "game_name", "name"),
        field(server, "numplayers", "players"),
      );
      return entry ? [entry] : [];
    }))
  ),
  {
    key: "wipeout",
    name: "Wipeout Online",
    url: "https://svo.agracingfoundation.org/medius_db/api/GetPlayerCount",
    parse(body) {
      const root = body.match(/<GetPlayerCount\b([^>]*)>/i);
      if (!root || !/<\/GetPlayerCount\s*>/i.test(body)) {
        throw new Error("Provider response is not a complete GetPlayerCount document.");
      }
      const players = root[1].match(/\btotalEntries\s*=\s*["']([^"']*)["']/i)?.[1];
      const entry = activity("Wipeout Online", players);
      return entry ? [entry] : [];
    },
  },
  jsonProvider("xlink-kai", "XLink Kai", "https://api.teamxlink.co.uk/rom/GetActiveGames/v1", value => {
    const root = object(value);
    const gameList = object(field(root ?? {}, "gamelist"));
    const games = field(gameList ?? {}, "games");
    if (!root || !Array.isArray(games)) throw new Error("Provider response did not contain a game list.");
    return aggregate(games.flatMap(item => {
      const game = object(item);
      if (!game) return [];
      const entry = activity(field(game, "title", "name"), field(game, "player_count", "players"));
      return entry ? [entry] : [];
    }));
  }),
  {
    key: "socom-us",
    name: "SOCOM.cc",
    url: "https://www.socom.cc/status.xml",
    parse: parsePrometheus,
  },
  {
    key: "socom-eu",
    name: "SOCOM Europe",
    url: "https://www.socom.fr/status.xml",
    parse: parsePrometheus,
  },
  {
    key: "socom-ftb2",
    name: "SOCOM FTB2",
    url: "https://www.socomftb2.com/status.xml",
    parse: parsePrometheus,
  },
  {
    key: "retroverze",
    name: "RetroVerze",
    url: "https://status.anotherlore.site/status.xml",
    parse: parsePrometheus,
  },
  {
    key: "psrewired",
    name: "PSRewired",
    load: loadPsRewiredActivities,
  },
];

function normalize(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, "");
}

async function readCatalog(): Promise<{ games: CatalogGame[]; aliases: Map<string, string[]> }> {
  const games: CatalogGame[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await admin.from("games")
      .select("id, title, console")
      .eq("status", "approved")
      .order("id")
      .range(offset, offset + 499);
    if (error) throw new Error(`Could not read the approved game catalog: ${error.message}`);
    games.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }

  const aliases = new Map<string, string[]>();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await admin.from("discord_bot_game_map")
      .select("website_game_id, alternate_names")
      .range(offset, offset + 499);
    if (error) throw new Error(`Could not read bot game aliases: ${error.message}`);
    for (const mapping of data ?? []) {
      if (!Array.isArray(mapping.alternate_names)) continue;
      for (const alias of mapping.alternate_names) {
        if (typeof alias !== "string" || !alias.trim()) continue;
        const key = normalize(alias);
        aliases.set(key, [...(aliases.get(key) ?? []), mapping.website_game_id]);
      }
    }
    if (!data || data.length < 500) break;
  }
  return { games, aliases };
}

function matchGame(
  title: string,
  consoleName: string | null,
  games: CatalogGame[],
  aliases: Map<string, string[]>,
): CatalogGame | null {
  const key = normalize(title);
  const aliasIds = aliases.get(key) ?? [];
  const matches = games.filter(game => normalize(game.title) === key || aliasIds.includes(game.id));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1 && consoleName) {
    const consoleMatches = matches.filter(game => normalize(game.console ?? "") === normalize(consoleName));
    if (consoleMatches.length === 1) return consoleMatches[0];
  }
  return null;
}

async function pollProvider(
  provider: Provider,
  games: CatalogGame[],
  aliases: Map<string, string[]>,
) {
  let activities: Activity[];
  if (provider.load) {
    activities = await provider.load();
  } else {
    if (!provider.url || !provider.parse) throw new Error("Provider is missing its fetch configuration.");
    const response = await fetch(provider.url, {
      headers: { Accept: "application/json, application/xml, text/xml" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`);
    const body = await response.text();
    if (new TextEncoder().encode(body).byteLength > maxResponseBytes) {
      throw new Error("Provider response exceeded the 5 MB safety limit.");
    }
    activities = provider.parse(body);
  }
  const now = new Date().toISOString();
  const grouped = new Map<string, {
    title: string;
    console: string | null;
    gameId: string | null;
    players: number;
    kind: Activity["kind"];
  }>();
  for (const entry of activities) {
    const game = matchGame(entry.title, entry.console ?? null, games, aliases);
    const title = game?.title ?? entry.title;
    const consoleName = game?.console ?? entry.console ?? null;
    const key = `${game?.id ?? `${normalize(title)}|${normalize(consoleName ?? "")}`}|${entry.kind}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.players += entry.players;
    } else {
      grouped.set(key, {
        title,
        console: consoleName,
        gameId: game?.id ?? null,
        players: entry.players,
        kind: entry.kind,
      });
    }
  }
  const rows = [...grouped.values()].map(entry => ({
      provider_key: provider.key,
      source_key: `${normalize(entry.title)}|${normalize(entry.console ?? "")}`.slice(0, 240),
      service_name: provider.name,
      game_title: entry.title,
      console: entry.console,
      matched_game_id: entry.gameId,
      activity_kind: entry.kind,
      players_online: entry.players,
      is_active: true,
      updated_at: now,
    }));

  if (rows.length) {
    const { error } = await admin.from("external_live_services")
      .upsert(rows, { onConflict: "provider_key,source_key" });
    if (error) throw new Error(`Could not save provider data: ${error.message}`);
  }

  let deactivateQuery = admin.from("external_live_services")
    .update({ is_active: false })
    .eq("provider_key", provider.key);
  if (rows.length) {
    const keys = rows.map(row => `"${row.source_key.replaceAll('"', '\\"')}"`).join(",");
    deactivateQuery = deactivateQuery.not("source_key", "in", `(${keys})`);
  }
  const { error: deactivateError } = await deactivateQuery;
  if (deactivateError) throw new Error(`Could not expire old provider data: ${deactivateError.message}`);

  return { provider: provider.name, ok: true, active_games: rows.length };
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "POST required." }, { status: 405 });
  }
  if (request.headers.get("x-live-poll-secret") !== pollSecret) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { games, aliases } = await readCatalog();
    const results = await Promise.all(providers.map(async provider => {
      try {
        const result = await pollProvider(provider, games, aliases);
        console.info("External live provider poll succeeded.", result);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown provider error.";
        console.error(`External live provider ${provider.name} failed: ${message}`);
        return { provider: provider.name, ok: false, error: message };
      }
    }));
    return Response.json({
      ok: results.every(result => result.ok),
      polled_at: new Date().toISOString(),
      results,
    }, { status: results.every(result => result.ok) ? 200 : 207 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load catalog.";
    console.error("External live poll could not start:", message);
    return Response.json({ error: message }, { status: 500 });
  }
});
