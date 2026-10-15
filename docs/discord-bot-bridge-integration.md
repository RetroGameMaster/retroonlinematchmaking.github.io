# ROM external read-only bridge (no bot changes)

**This is a separate helper process. It does not patch, rebuild, restart, or modify the Discord bot.** The bridge opens the existing SQLite database in read-only mode and sends a filtered snapshot to Supabase. Keep the bot running exactly as it is.

## What this first version syncs

- Active LFG searches from `LfgMessages` that have not expired.
- Game title and console from `Games` and `Consoles`.
- Minimum player count, host Discord ID, connection methods, notes, and expiry time.
- A snapshot is sent every 60 seconds when run with `--watch`.

This first version only syncs LFG searches. It does **not yet** sync all profile preferences, role mappings, leaderboard history, or the API/service activity tables. Those are separate data streams being implemented so that stale data is not presented as live.

## Setup requirements

1. Apply `supabase/migrations/202610130002_discord_live_lobbies.sql` in the Supabase SQL Editor.
2. Deploy the `discord-lobby-bridge` Edge Function.
3. In Supabase Dashboard → Edge Functions → Secrets, add `ROM_BRIDGE_SECRET` with a long random secret. Do not put this secret in the website code or GitHub.
4. Download `rom_sqlite_bridge.py` from the project’s bridge folder / release location, or use the copy supplied directly in the project conversation.
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

If the command succeeds, it prints how many active lobbies were synced. After a successful one-time test, run continuously with:

```powershell
python .\rom_sqlite_bridge.py --watch --interval 60
```

For a production setup, run the bridge under Windows Task Scheduler or a service manager so it restarts after a reboot. Do not run multiple copies simultaneously.

## Safety notes

- The script connects using SQLite `mode=ro`; it cannot write to the bot database.
- Never copy the SQLite database to a public website or commit it to GitHub.
- Keep the bridge secret private.
- A failed website sync must not affect Discord matchmaking.
- Test against the deployed Edge Function before enabling continuous polling.
