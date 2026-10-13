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

## Game catalog import

The bot database export is available as `rom_bot_game_catalog.csv` and contains 1,454 games, 32 console labels, and 360 alternate names. Its columns are `source_game_id`, `title`, `console`, and `alternate_names_json`.

1. Apply `supabase/migrations/202610130003_bot_game_catalog_staging.sql`.
2. In the Supabase Table Editor, open `bot_game_catalog_staging` and use its CSV import feature to import the export. Map the four CSV columns to the same-named fields; `imported_at` can use its default.
3. Compare staging rows against `public.games` using normalized title + console. Do not blindly copy rows into `public.games`: its schema has additional required fields and existing slugs/IDs that must be preserved.
4. Review duplicate and missing-game candidates before performing a separate, deliberate merge into the public catalog. The staging table does not automatically publish games.

## Live Discord lobbies

The website now reads a dedicated `discord_live_lobbies` table and subscribes to Supabase Realtime. Apply `supabase/migrations/202610130002_discord_live_lobbies.sql` and deploy `supabase/functions/discord-lobby-bridge` before the panel can receive rows. Configure the function secret `ROM_BRIDGE_SECRET`.

The bot integration itself still needs to be added to the running bot source and rebuilt/deployed. Its `Find Players` handler should send an authenticated `upsert` event when it creates the lobby record; its expiration handler should send `expire` when it marks the record expired. Use the endpoint `https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/discord-lobby-bridge` and header `x-rom-bridge-secret`. Payload details are validated in `supabase/functions/discord-lobby-bridge/index.ts`. Never put the bridge secret in browser code. SQLite remains authoritative; this table is a live website projection.

## Deployment order

1. Review and deploy the migration and Edge Function.
2. Deploy the website UI change and test with a non-admin account.
3. Prepare a dry-run game catalog import and review duplicate candidates.
4. Build/test the bot bridge against a staging endpoint; only then deploy a new bot executable.
5. Confirm expired or full Discord lobbies disappear from the website.
