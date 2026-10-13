# Bot-side Discord live-lobby bridge patch

**This is a patch guide, not an already-installed bot change.** The GitHub connector declined authorization for the bot repository edit, so the existing bot source was not modified. The website and bridge can receive lobby data only after this bot-side patch is added, built, and deployed.

## Configuration on the VM

Set these environment variables for the bot process:

- `ROM_DISCORD_LOBBY_BRIDGE_URL=https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/discord-lobby-bridge`
- `ROM_DISCORD_LOBBY_BRIDGE_SECRET=<the exact ROM_BRIDGE_SECRET configured for the Edge Function>`

Keep the secret out of source control and logs.

## Upsert when Find Players creates its LFG record

The primary waiting-room creation path in `FindPlayersModule.cs` saves an `LfgMessage` with `GuildId`, `ChannelId`, `MessageId`, `UserId`, `ExpireDateTime`, `MinimumPlayersNeeded`, `RoleName`, `ConnectionMethods`, and `GameId`. Immediately after that successful `LfgMessageStore.AddMessage(...)`, call a helper that POSTs:

```json
{
  "action": "upsert",
  "guild_id": "DISCORD_GUILD_SNOWFLAKE",
  "channel_id": "WAITING_ROOM_THREAD_SNOWFLAKE",
  "message_id": "LOBBY_MESSAGE_SNOWFLAKE",
  "host_discord_id": "HOST_USER_SNOWFLAKE",
  "game_id": 123,
  "game_title": "Game title",
  "minimum_players": 2,
  "joined_players": 0,
  "connection_methods": "Connection option names",
  "additional_notes": "Optional notes",
  "expires_at": "2026-10-13T23:00:00.000Z"
}
```

Send the JSON to the bridge URL with `Content-Type: application/json` and header `x-rom-bridge-secret`. Convert every Discord snowflake to a **string** to avoid 64-bit integer precision loss. Convert the expiry to UTC ISO-8601.

Use the existing Newtonsoft.Json dependency for serialization and `HttpClient` for the request. Catch bridge errors and log only the HTTP status; the website outage must not break the Discord matchmaking command.

## Expire when the bot marks an LFG record expired

In `MessageExpirationService.CheckExpiredMessages()`, after the bot has processed an expired record, POST this payload:

```json
{
  "action": "expire",
  "guild_id": "DISCORD_GUILD_SNOWFLAKE",
  "channel_id": "THREAD_SNOWFLAKE",
  "message_id": "LOBBY_MESSAGE_SNOWFLAKE"
}
```

Use the same secret header. The bridge keys records by `guild_id:message_id`, so preserve the same guild and message IDs used in the upsert.

## Test checklist

1. Deploy the two live-lobby SQL migrations and the `discord-lobby-bridge` Edge Function.
2. Set the two VM environment variables and restart the bot process.
3. Start a test Find Players search; confirm one row appears in `discord_live_lobbies` and on the website.
4. Let the search expire or test the expiry helper; confirm it disappears from the website feed.
5. Test a deliberately incorrect bridge secret; the endpoint must return HTTP 401.
6. Only after the test passes should the updated bot executable replace the running version.
