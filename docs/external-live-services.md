# External live game activity

The site can poll public game-network APIs independently of the Discord bot. The Edge Function normalizes each provider response, matches exact game titles and the bot catalog's alternate names against approved website games, and writes snapshots to `external_live_services`. The home page and Live Lobbies page combine those records with the existing bot-synced services.

Providers are polled independently every two minutes. A provider error is returned and logged without stopping successful providers. Failed providers keep their last good snapshot, which the website stops showing after ten minutes. A successful empty response expires that provider's old rows. The home-page reported-player counter includes fresh bot snapshots and fresh external provider snapshots that report players, but excludes lobby-only counts. Counts across networks or between bot and direct API snapshots can overlap and should not be interpreted as unique players. RetroArch exposes lobby listings rather than player totals, so its cards are labeled as lobby counts.

The poller currently supports:

- Dolphin Netplay
- Insignia
- Madness Gaming Network
- Medal of Honor: Heroes Online
- RetroArch Netplay
- OpenSpy
- PSRewired
- RetroVerze
- Wipeout Online / SV0
- XLink Kai
- SOCOM.cc, SOCOM Europe, and SOCOM FTB2

PSRewired is queried using the application IDs present in the attached bot source and mapped to approved game records through bot-synced alternate names. If those aliases are not present in `discord_bot_game_map`, the numeric application ID remains unmatched.

## Deploy

1. Apply `supabase/migrations/202610220001_external_live_services.sql` after the existing game-catalog and `discord_bot_game_map` migrations. The function needs the bot map table to read alternate names.
2. Deploy the function:

   ```sh
   supabase functions deploy external-live-services
   ```

3. Generate a long random polling secret and configure it as an Edge Function secret. Do not commit it or put a service-role key in the browser:

   ```sh
   supabase secrets set EXTERNAL_LIVE_POLL_SECRET='YOUR_RANDOM_SECRET'
   ```

   Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the function.

4. In the Supabase SQL Editor, enable the scheduled HTTP extensions if they are not already enabled:

   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net with schema extensions;
   ```

5. Schedule the poller every two minutes. Replace both placeholders before running. Use the same random poll secret configured in the Edge Function and the project's anon/publishable key. Never use the service-role key.

   ```sql
   select cron.schedule(
     'external-live-services-2min',
     '*/2 * * * *',
     $$
     select net.http_post(
       url := 'https://lapyxhothazalssrbimb.supabase.co/functions/v1/external-live-services',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'apikey', 'PASTE_YOUR_PROJECT_ANON_OR_PUBLISHABLE_KEY',
         'Authorization', 'Bearer PASTE_YOUR_PROJECT_ANON_OR_PUBLISHABLE_KEY',
         'x-live-poll-secret', 'PASTE_THE_SAME_RANDOM_VALUE_SET_AS_EXTERNAL_LIVE_POLL_SECRET'
       ),
       body := '{}'::jsonb
     );
     $$
   );
   ```

   **Security trade-off:** without Vault, the poll secret is stored in the scheduled job definition and may be visible to project database administrators through `cron.job` or SQL history. Use a dedicated random value, never reuse a password or API key, and restrict project/SQL Editor access. If this storage risk is not acceptable, do not create the scheduled job without a secure secret store.

   To replace an existing job before scheduling it again, run:

   ```sql
   select cron.unschedule(jobid)
   from cron.job
   where jobname = 'external-live-services-2min';
   ```

   Then run the scheduling statement above.

## Verify

Invoke the function once using a POST request with the `apikey` header and `x-live-poll-secret` header. Its JSON response contains an individual success or error result for each provider. Supabase Edge Function logs contain the same provider-level result; the cron request ID and response can be inspected in `net._http_response`.

If the response is `401 {"error":"Unauthorized."}`, the request reached the function but the `x-live-poll-secret` value does not exactly match the `EXTERNAL_LIVE_POLL_SECRET` Edge Function secret. Set one new random value in the Edge Function secrets and in the cron job, taking care not to include quotes or spaces in one value but not the other. Updating an Edge Function secret does not require redeploying the function. Never share the secret in chat or screenshots.

Check recent public rows with:

```sql
select provider_key, service_name, game_title, console, players_online, updated_at
from public.external_live_services
where is_active = true
order by updated_at desc
limit 100;
```
