# Read-only ROM bot database bridge

`rom_sqlite_sync.py` runs as a separate process beside the bot's SQLite database. It opens SQLite with `mode=ro` and `PRAGMA query_only`, then sends allow-listed snapshots over HTTPS to the `discord-lobby-bridge` Supabase Edge Function. It does not import or modify the bot, write to the database, or require the Supabase service-role key on the bot host.

## Simple Windows start

Once Supabase has been configured as described below:

1. Put `Start-ROM-Bridge.bat` and `rom_sqlite_sync.py` in the same folder as the bot's `localdb.db`.
2. Double-click `Start-ROM-Bridge.bat`.
3. Confirm the dry-run counts look reasonable. During live sync, enter the `ROM_BRIDGE_SECRET` and the public anon API key if needed; secret input is hidden. Never use a `service_role` key.
4. Leave the window open for updates every 60 seconds. Close it or press Ctrl+C to stop.

If the database has a different name or is in another folder, the batch file asks for its full path. Python 3 must be installed. No Python packages are needed.

The `.bat` is a launcher, not a replacement for the one-time Supabase setup below. The Edge Function and its database migration must be deployed first.

The sync includes:

- `Games`, `Consoles`, and `GameAlternateNames`, inserted into the website's approved `games` catalog while preserving existing website game UUIDs. Existing exact title/console matches are linked; ambiguous duplicates are skipped for review.
- Generic `ActiveGames` and `ActiveGameRecords`, plus provider-specific OpenSpy, PSRewired, and SOCOM.cc active-game records, published to `discord_live_services`. Generic connection types such as Dolphin Netplay and RetroArch Netplay retain their configured names; each service is displayed in its own website section.
- Active `LfgMessages`, with participant counts from `Users`, published to `discord_bot_lfg_invites`. Participant Discord IDs are not copied.
- Aggregate game, active-service, active-player, active-invite, win, and team-win counts. No per-member profile or preference data is synced.

## Supabase setup

1. Review `supabase/migrations/202610200001_discord_bot_bridge.sql` against the project's current schema. Your existing `discord_live_lobbies` table has a different schema from an older migration in this repository; this migration intentionally does not alter that table.
2. Apply it using the Supabase SQL Editor. Do not blindly apply older pending migrations with `supabase db push` until their assumptions about `discord_live_lobbies` have been reconciled.
3. Deploy the updated Edge Function:

   ```sh
   supabase functions deploy discord-lobby-bridge
   ```

4. Generate a long random bridge secret and configure it as the Supabase Edge Function secret `ROM_BRIDGE_SECRET`. The worker prompts for this secret. Never put the service-role key on that machine or in the website.
5. The launcher includes the project's **anon/public** API key and sends it in the `apikey` and `Authorization` headers required by the Supabase gateway. This is the public browser key, not the `service_role` key. The function must have `verify_jwt = false` deployed (as set in `supabase/config.toml`); the bridge secret is checked by the function itself.

The function URL is:

```text
https://lapyxhothazalssrbimb.supabase.co/functions/v1/discord-lobby-bridge
```

## Run on the database host

Copy `rom_sqlite_sync.py` to the directory containing the bot SQLite database. Set these environment variables in the service manager used to run the bridge:

- `ROM_SQLITE_PATH`: absolute path to the bot's SQLite file.
- `ROM_BRIDGE_FUNCTION_URL`: the HTTPS function URL shown above.
- `ROM_BRIDGE_SECRET`: the same secret configured in Supabase.
- `SUPABASE_ANON_KEY`: the project's anon/public API key (not the service-role key). The batch launcher sets this automatically.
No Discord bot token or OAuth credentials are required by this bridge. The game library’s console filter is populated from the website’s synced game catalog and also includes the systems currently present in the attached bot database.

Run a read-only check first:

```sh
python3 rom_sqlite_sync.py --dry-run
```

Then send one snapshot:

```sh
python3 rom_sqlite_sync.py --once
```

Run continuously, syncing once per minute:

```sh
python3 rom_sqlite_sync.py
```

The worker retries on the next interval after transient errors and logs failures. Keep it running under the host's service manager so it restarts after a reboot.
