# ROM Discord linking and live-lobby integration

This feature is intentionally additive. It does not migrate Supabase Auth users, rewrite bot SQLite records, or replace the existing website LFG system.

## Discord account linking

1. Apply `supabase/migrations/202610130001_discord_account_links.sql`.
2. Link the Supabase CLI to the project and deploy the function:
   ```sh
   supabase link --project-ref lapyxhothazalssrbimb
   supabase functions deploy discord-link
   ```
   `supabase/config.toml` disables gateway JWT verification for this function because Discord's OAuth callback has no ROM session token. The function validates the user's JWT for browser `POST` requests and validates the one-time OAuth state for the callback.
3. In Supabase Function secrets, configure:
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET`
   - `SITE_URL` (the canonical ROM website origin, without a trailing slash)
4. In the Discord Developer Portal, set the OAuth2 redirect URL to:
   `https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/discord-link?mode=callback`
5. Verify the site origin in the Edge Function CORS configuration before production deployment.

The function validates the current Supabase JWT before starting a flow, uses a random one-time state stored as a hash, exchanges the code server-side, and writes the Discord identity through the service role. The service role key and Discord client secret must never be put in browser code.

## Game catalog and live lobbies

These are separate data tasks and are deliberately not silently deployed by the account-linking migration:
- Keep the bot SQLite database on the bot/server side. The separate Python sidecar in `supabase/bridge/rom_sqlite_sync.py` opens it read-only and sends allow-listed snapshots; it does not modify bot code or write to SQLite.
- The bridge matches `Games` + `Consoles` against the website catalog using normalized title + console. It preserves existing website game UUIDs, adds missing entries as approved, records source IDs in `discord_bot_game_map`, and retains `GameAlternateNames` privately in that mapping table. Ambiguous existing matches are skipped for review.
- The bridge publishes generic `ActiveGames` + `ActiveGameRecords` and provider-specific OpenSpy, PSRewired, and SOCOM.cc records to `discord_live_services`; active `LfgMessages` are projected to `discord_bot_lfg_invites` with participant counts, not participant IDs. Public aggregate stats are stored separately. User settings, preferences, private messages, and individual member profiles are not synced.
- The deployed `discord_live_lobbies` table has a different schema from the older migration in this repository. The bot bridge leaves that table untouched. Apply the new bot-bridge migration separately after reviewing the actual project schema; do not blindly apply older pending migrations with conflicting assumptions.
- Deploy the bridge from the linked Supabase CLI project:
  ```sh
  supabase functions deploy discord-lobby-bridge
  ```
  Its `verify_jwt = false` setting allows the sidecar's server-to-server request to reach the handler; the handler requires the `x-rom-bridge-secret` header and keeps the service-role key server-side. Configure `ROM_BRIDGE_SECRET` as a Supabase Function secret and on the sidecar host. The sidecar needs only the function URL and this bridge secret; never put the service-role key in the bot, sidecar, or browser.
- Do not expose bot tokens or use a public unauthenticated endpoint to accept lobby events. Configure a separate bridge secret and validate it server-side.

## Deployment order

1. Review and apply `supabase/migrations/202610200001_discord_bot_bridge.sql` in the Supabase SQL Editor.
2. Configure `ROM_BRIDGE_SECRET` and deploy `discord-lobby-bridge`.
3. Copy the Python sidecar to the bot database host, configure its database path, function URL, and bridge secret as environment variables, and run `--dry-run`.
4. Run the sidecar once with `--once`; verify imported games, active services, invites, and aggregate stats in Supabase and on the website.
5. Run the sidecar under the host's service manager for periodic read-only snapshots.
