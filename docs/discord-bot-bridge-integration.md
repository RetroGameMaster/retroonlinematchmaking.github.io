# ROM external read-only bridge (no bot changes)

**This is a separate helper process. It does not patch, rebuild, restart, or modify the Discord bot.** The bridge opens the existing SQLite database in read-only mode and sends a filtered snapshot to Supabase. Keep the bot running exactly as it is.

## What this first version syncs

- Active LFG searches from `LfgMessages` that have not expired.
- Game title and console from `Games` and `Consoles`.
- Minimum player count, host Discord ID, connection methods, notes, and expiry time.
- A snapshot is sent every 60 seconds when run with `--watch`.

The current bridge syncs active LFG searches, live API/service activity from `ActiveGames`, `ActiveOpenSpyGameRecords`, `ActiveRewiredGameRecords`, and `ActiveSocomCCGameRecords`, plus per-member matchmaking preferences and score totals. The member snapshot includes favorite games, games marked not interested in, connection-service role mappings, gaming availability, region locks, custom game lists, recent wins, and individual/team win totals. The ticker shows only service records reporting more than zero players.

## Setup requirements

1. Apply these migrations in order in the Supabase SQL Editor: `202610130001_discord_account_links.sql`, `202610130002_discord_live_lobbies.sql`, `202610130003_bot_game_catalog_staging.sql`, `202610150001_discord_live_services.sql`, `202610150002_discord_member_snapshots.sql`, and `202610150003_public_discord_profile_links.sql`, and `202610150004_community_forum.sql`.
2. Deploy the `discord-link` and `discord-lobby-bridge` Edge Functions.
3. In Supabase Dashboard → Edge Functions → Secrets, add `ROM_BRIDGE_SECRET` with a long random secret. Do not put this secret in the website code or GitHub.
4. Download [`scripts/rom_sqlite_bridge.py`](../scripts/rom_sqlite_bridge.py) from this branch. It sends both lobby and service snapshots.
5. Run the script on the same VM as the database (recommended) or another machine that can read the database file. Set the environment variables below.

## Windows PowerShell example

Replace the example values with your actual values. Do not send the secret to anyone.

```powershell
$env:ROM_SQLITE_PATH = "C:\path\to\localdb.db"
$env:ROM_SUPABASE_FUNCTION_URL = "https://YOUR_PROJECT_REF.supabase.co/functions/v1/discord-lobby-bridge"
$env:ROM_BRIDGE_SECRET = "PASTE_THE_SECRET_YOU_SET_IN_SUPABASE"
$env:ROM_DISCORD_GUILD_ID = "YOUR_DISCORD_SERVER_ID"
python .\rom_sqlite_bridge.py
```

If the command succeeds, it prints counts for active LFG searches, live service records, and member profiles synced. After a successful one-time test, run continuously with:

```powershell
python .\rom_sqlite_bridge.py --watch --interval 60
```

The website branch also includes a Live Services ticker, a Discord Matchmaking Leaderboards page, linked member profile panels, and a community forum with posts and replies. These features remain empty until the migrations, functions, and bridge are deployed. For a production setup, run the bridge under Windows Task Scheduler or a service manager so it restarts after a reboot. Do not run multiple copies simultaneously.

## Safety notes

- The script connects using SQLite `mode=ro`; it cannot write to the bot database.
- Never copy the SQLite database to a public website or commit it to GitHub.
- Keep the bridge secret private.
- A failed website sync must not affect Discord matchmaking.
- Test against the deployed Edge Function before enabling continuous polling.
