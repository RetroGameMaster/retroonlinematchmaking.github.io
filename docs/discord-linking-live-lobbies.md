# ROM Discord linking and live-lobby integration

This feature is intentionally additive. It does not migrate Supabase Auth users, rewrite bot SQLite records, or replace the existing website LFG system.

## Discord account linking

1. Apply `supabase/migrations/202610130001_discord_account_links.sql`.
2. Deploy `supabase/functions/discord-link` with Supabase CLI.
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
- Import the SQLite `Games` + `Consoles` + `GameAlternateNames` catalog into the existing Supabase `games` table only after matching its actual columns, IDs, slug uniqueness, and existing catalog. Use normalized title + console matching to avoid duplicates; preserve all current website game IDs.
- For live lobbies, the bot should send authenticated create/update/expire events for `LfgMessage` records to a backend endpoint. The website can read a dedicated `discord_live_lobbies` view/table using Realtime. The bot's SQLite remains authoritative; website sync is a projection, not a migration.
- Do not expose bot tokens or use a public unauthenticated endpoint to accept lobby events. Configure a separate bridge secret and validate it server-side.

## Deployment order

1. Review and deploy the migration and Edge Function.
2. Deploy the website UI change and test with a non-admin account.
3. Prepare a dry-run game catalog import and review duplicate candidates.
4. Build/test the bot bridge against a staging endpoint; only then deploy a new bot executable.
5. Confirm expired or full Discord lobbies disappear from the website.
