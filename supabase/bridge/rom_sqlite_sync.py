#!/usr/bin/env python3
"""Read-only snapshot sync from the ROM bot SQLite database to Supabase."""

from __future__ import annotations

import argparse
import getpass
import json
import logging
import os
import sqlite3
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

LOG = logging.getLogger("rom-sqlite-sync")
BATCH_SIZE = 250
DEFAULT_INTERVAL_SECONDS = 60
DEFAULT_FUNCTION_URL = (
    "https://lapyxhothazalssrbimb.supabase.co/functions/v1/discord-lobby-bridge"
)


def required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Required environment variable {name} is not set.")
    return value


def open_database(path: Path) -> sqlite3.Connection:
    if not path.is_file():
        raise FileNotFoundError(f"SQLite database does not exist: {path}")
    uri = f"file:{quote(str(path.resolve()))}?mode=ro"
    connection = sqlite3.connect(uri, uri=True, timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA query_only = ON")
    return connection


def as_text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def iso_timestamp(value: Any) -> str:
    raw = as_text(value)
    if not raw:
        raise ValueError("Database contains an invite with no expiry timestamp.")
    normalized = raw.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def read_catalog(connection: sqlite3.Connection) -> list[dict[str, Any]]:
    games = connection.execute(
        """
        SELECT g.Id AS source_game_id, g.Title AS title,
               COALESCE(NULLIF(TRIM(c.Abbreviation), ''), 'Unknown Console') AS console
        FROM Games g
        LEFT JOIN Consoles c ON c.Id = g.ConsoleId
        ORDER BY g.Id
        """
    ).fetchall()
    alternates: dict[int, list[str]] = defaultdict(list)
    for row in connection.execute(
        "SELECT GameId, Name FROM GameAlternateNames ORDER BY GameId, Id"
    ):
        name = as_text(row["Name"])
        if name:
            alternates[int(row["GameId"])].append(name)
    return [
        {
            "source_game_id": int(row["source_game_id"]),
            "title": as_text(row["title"]),
            "console": as_text(row["console"]),
            "alternate_names": alternates.get(int(row["source_game_id"]), []),
        }
        for row in games
        if as_text(row["title"])
    ]


def read_invites(connection: sqlite3.Connection) -> dict[str, list[dict[str, Any]]]:
    rows = connection.execute(
        """
        SELECT l.GuildId AS guild_id, l.ChannelId AS channel_id,
               l.MessageId AS message_id, l.ExpireDateTime AS expires_at,
               l.MinimumPlayersNeeded AS minimum_players, l.RoleName AS role_name,
               l.ConnectionMethods AS connection_methods,
               l.AdditionalNotes AS additional_notes,
               g.Title AS game_title, c.Abbreviation AS console,
               (SELECT COUNT(*) FROM Users u WHERE u.LfgMessageId = l.Id) AS player_count
        FROM LfgMessages l
        LEFT JOIN Games g ON g.Id = l.GameId
        LEFT JOIN Consoles c ON c.Id = g.ConsoleId
        WHERE l.Expired = 0
        ORDER BY l.GuildId, l.Id
        """
    ).fetchall()

    now = datetime.now(timezone.utc)
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        expires_at = iso_timestamp(row["expires_at"])
        if datetime.fromisoformat(expires_at.replace("Z", "+00:00")) <= now:
            continue
        title = as_text(row["game_title"])
        if not title:
            continue
        guild_id = as_text(row["guild_id"])
        grouped[guild_id].append(
            {
                "guild_id": guild_id,
                "channel_id": as_text(row["channel_id"]),
                "message_id": as_text(row["message_id"]),
                "game_title": title,
                "console": as_text(row["console"]) or None,
                "minimum_players": int(row["minimum_players"] or 2),
                "player_count": int(row["player_count"] or 0),
                "role_name": as_text(row["role_name"]) or None,
                "connection_methods": as_text(row["connection_methods"]) or None,
                "additional_notes": as_text(row["additional_notes"]) or None,
                "expires_at": expires_at,
            }
        )
    return grouped


def read_services(connection: sqlite3.Connection) -> dict[str, list[dict[str, Any]]]:
    rows = connection.execute(
        """
        SELECT agr.Id AS source_key, agr.GuildId AS guild_id,
               COALESCE(NULLIF(TRIM(agr.FullGameName), ''), g.Title) AS game_title,
               c.Abbreviation AS console, ag.PlayersOnline AS players_online,
               COALESCE(NULLIF(TRIM(ct.RoleName), ''), 'Discord') AS service_name,
               agr.ThreadId AS thread_id
        FROM ActiveGameRecords agr
        JOIN ActiveGames ag ON ag.Id = agr.ActiveGameId
        LEFT JOIN Games g ON g.Id = ag.GameId
        LEFT JOIN Consoles c ON c.Id = g.ConsoleId
        LEFT JOIN ConnectionTypes ct ON ct.Id = ag.ConnectionTypeId
        WHERE ag.PlayersOnline > 0
        ORDER BY agr.GuildId, agr.Id
        """
    ).fetchall()
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        guild_id = as_text(row["guild_id"])
        game_title = as_text(row["game_title"])
        if not guild_id or not game_title:
            continue
        thread_id = as_text(row["thread_id"])
        grouped[guild_id].append(
            {
                "guild_id": guild_id,
                "source_key": as_text(row["source_key"]),
                "game_title": game_title,
                "console": as_text(row["console"]) or None,
                "players_online": int(row["players_online"] or 0),
                "service_name": as_text(row["service_name"]) or "Discord",
                "discord_url": (
                    f"https://discord.com/channels/{guild_id}/{thread_id}"
                    if thread_id and thread_id != "0"
                    else None
                ),
            }
        )
    return grouped


def read_public_stats(
    connection: sqlite3.Connection,
    catalog_count: int,
    invites: dict[str, list[dict[str, Any]]],
    services: dict[str, list[dict[str, Any]]],
) -> dict[str, int]:
    total_wins = int(connection.execute("SELECT COUNT(*) FROM Wins").fetchone()[0])
    team_wins = int(connection.execute("SELECT COUNT(*) FROM TeamWins").fetchone()[0])
    return {
        "game_count": catalog_count,
        "active_service_count": sum(map(len, services.values())),
        "active_player_count": sum(
            int(service["players_online"])
            for group in services.values()
            for service in group
        ),
        "active_invite_count": sum(map(len, invites.values())),
        "total_wins": total_wins,
        "team_wins": team_wins,
    }


def post_action(
    function_url: str,
    secret: str,
    public_key: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    encoded = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    request = Request(
        function_url,
        data=encoded,
        headers={
            "Content-Type": "application/json",
            "apikey": public_key,
            "Authorization": f"Bearer {public_key}",
            "x-rom-bridge-secret": secret,
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=45) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        details = error.read().decode("utf-8", "replace")[:1000]
        request_id = error.headers.get("sb-request-id") or error.headers.get("x-request-id")
        content_type = error.headers.get("Content-Type", "unknown")
        response_info = details if details else f"<empty response body; content-type={content_type}>"
        if request_id:
            response_info += f" [request id: {request_id}]"
        raise RuntimeError(f"Supabase returned HTTP {error.code}: {response_info}") from error
    except URLError as error:
        raise RuntimeError(f"Could not reach Supabase function: {error.reason}") from error
    if not isinstance(result, dict) or result.get("ok") is not True:
        raise RuntimeError(f"Supabase rejected {payload.get('action')}: {result!r}")
    return result


def send_catalog(
    function_url: str,
    secret: str,
    public_key: str,
    games: list[dict[str, Any]],
) -> None:
    for start in range(0, len(games), BATCH_SIZE):
        result = post_action(
            function_url,
            secret,
            public_key,
            {"action": "sync_catalog", "games": games[start : start + BATCH_SIZE]},
        )
        LOG.info("Catalog batch %d: %s", start // BATCH_SIZE + 1, result.get("result"))
    if not games:
        post_action(function_url, secret, public_key, {"action": "sync_catalog", "games": []})


def send_snapshot(
    function_url: str,
    secret: str,
    public_key: str,
    action: str,
    group_name: str,
    guild_ids: set[str],
    grouped: dict[str, list[dict[str, Any]]],
) -> None:
    for guild_id in sorted(guild_ids):
        rows = grouped.get(guild_id, [])
        if len(rows) > 500:
            raise RuntimeError(
                f"{guild_id} has {len(rows)} {group_name}; the bridge safety limit is 500."
            )
        result = post_action(
            function_url,
            secret,
            public_key,
            {"action": action, "guild_id": guild_id, group_name: rows},
        )
        LOG.info("%s snapshot for guild %s: %s", group_name, guild_id, result)


def sync_once(
    database_path: Path,
    function_url: str,
    secret: str,
    public_key: str,
    dry_run: bool,
) -> None:
    with open_database(database_path) as connection:
        catalog = read_catalog(connection)
        invites = read_invites(connection)
        services = read_services(connection)
        stats = read_public_stats(connection, len(catalog), invites, services)

    LOG.info(
        "Read-only snapshot: %d catalog games, %d active invites, %d active services.",
        len(catalog),
        sum(map(len, invites.values())),
        sum(map(len, services.values())),
    )
    if dry_run:
        LOG.info("Dry run: no requests sent. Aggregate counts: %s", stats)
        return

    send_catalog(function_url, secret, public_key, catalog)
    guild_ids = read_known_guilds(database_path) | set(invites) | set(services)
    send_snapshot(function_url, secret, public_key, "sync_invites", "invites", guild_ids, invites)
    send_snapshot(function_url, secret, public_key, "sync_services", "services", guild_ids, services)

    post_action(function_url, secret, public_key, {"action": "sync_stats", "stats": stats})
    LOG.info("Snapshot sync completed.")


def read_known_guilds(database_path: Path) -> set[str]:
    with open_database(database_path) as connection:
        guilds = {
            as_text(row[0])
            for row in connection.execute(
                """
                SELECT GuildId FROM LfgMessages
                UNION
                SELECT GuildId FROM ActiveGameRecords
                """
            )
        }
    return {guild for guild in guilds if guild}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--once", action="store_true", help="sync once, then exit")
    parser.add_argument("--dry-run", action="store_true", help="read SQLite and report counts only")
    parser.add_argument(
        "--interval",
        type=int,
        default=DEFAULT_INTERVAL_SECONDS,
        help=f"seconds between snapshots (default: {DEFAULT_INTERVAL_SECONDS})",
    )
    args = parser.parse_args()
    if args.interval < 10:
        parser.error("--interval must be at least 10 seconds.")

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    try:
        database_path = Path(required_env("ROM_SQLITE_PATH"))
        function_url = os.environ.get("ROM_BRIDGE_FUNCTION_URL", DEFAULT_FUNCTION_URL).strip()
        if not args.dry_run:
            secret = os.environ.get("ROM_BRIDGE_SECRET", "").strip()
            if not secret:
                secret = getpass.getpass("Supabase bridge secret (input hidden): ").strip()
            if not secret:
                raise RuntimeError("A Supabase bridge secret is required.")
            public_key = os.environ.get("SUPABASE_ANON_KEY", "").strip()
            if not public_key:
                public_key = getpass.getpass(
                    "Supabase anon/public API key (NOT service_role; input hidden): "
                ).strip()
            if not public_key:
                raise RuntimeError("A Supabase anon/public API key is required.")
            if not function_url.startswith("https://"):
                raise RuntimeError("ROM_BRIDGE_FUNCTION_URL must use HTTPS.")
        else:
            secret = ""
            public_key = ""

        while True:
            try:
                sync_once(database_path, function_url, secret, public_key, args.dry_run)
            except Exception:
                LOG.exception("Snapshot sync failed; the next scheduled attempt will retry.")
                if args.once or args.dry_run:
                    return 1
            if args.once or args.dry_run:
                return 0
            time.sleep(args.interval)
    except Exception as error:
        LOG.error("%s", error)
        return 2


if __name__ == "__main__":
    sys.exit(main())
