# Copilot instructions for RetroOnlineMatchmaking

## Build, test, and validation

- This repository is a browser-only static site. There is no package manifest, no bundler, and no repo-wide lint configuration. The project is served directly from the repository root.
- Local preview:
  ```sh
  cd /workspaces/retroonlinematchmaking.github.io
  python3 -m http.server 8000
  ```
  Then open `http://localhost:8000` and exercise the relevant hash route in the browser.
- Deploys are done by `.github/workflows/deploy.yml`, which uploads the repository root to GitHub Pages; there is no build artifact generation step.
- For the Discord/bridge sync script (`supabase/bridge/rom_sqlite_sync.py`), the repo includes a focused test file:
  ```sh
  python3 -m unittest discover -s supabase/bridge -p 'test_*.py' -v
  ```
  To run a single case, use:
  ```sh
  python3 -m unittest supabase.bridge.test_rom_sqlite_sync.ReadOnlyBridgeTests.test_catalog_includes_alternate_names
  ```
- When touched code is not in the Python bridge tests, validate by browser flow rather than a generic "run all tests" command; there is no broader frontend test runner to use.

## Architecture

- `index.html` is the app shell and shared styling layer. It includes the global navigation, the `#app-content` mount, Tailwind/CDN libraries, and the browser Supabase client.
- `app.js` owns the app's hash-router behavior and module loading. It keeps a `modules` map for standard pages, handles special routes such as `#/auth`, `#/game/...`, `#/profile/...`, forum topic pages, and loads HTML templates from `modules/<feature>/<feature>.html` before initializing the matching JS entry point.
- Feature modules live under `modules/`; shared helpers live under `lib/`. Most browser modules talk directly to Supabase instead of going through a backend layer, so DB tables and row-level security are part of the feature contract.
- The app relies on `window.rom` as the shared context object. Module entry points usually receive `rom` and may read `currentUser`, `supabase`, `loadModule`, and `navigateTo`; check both the module and its call site in `app.js` before changing a module's signature or route handling.
- Realtime subscriptions are started and cleaned up per feature; follow the local feature pattern when editing live data or presence features.
- Privileged integrations live in Supabase Edge Functions under `supabase/functions/`; browser modules must use the shared public client and must not contain server secrets. The separate Python bridge under `supabase/bridge/` reads the bot SQLite database and sends allow-listed snapshots to the bridge function.
- Database changes belong in ordered SQL migrations under `supabase/migrations/`. The migration order is significant; many features depend on the schema and permissions created there.
- Feature-specific design notes live in `docs/`. Read the relevant doc before touching those systems, especially `docs/discord-linking-live-lobbies.md` and `docs/community-forum.md`.

## Key conventions

- Use native JavaScript ES modules and relative imports. There is no build tool to rewrite paths or bundle modules.
- Keep feature markup in the matching HTML template and behavior in the matching JS entry point. When new page routes are added, update both the route logic in `app.js` and the module registration map.
- Preserve the current hash-based URLs (`#/...`). Do not rename or silently remove routes unless you are intentionally changing the app's navigation contract.
- Reuse the same Supabase client instead of creating a second browser client. Keep service-role secrets, server tokens, and other privileged values out of browser code.
- Keep database-only logic and server-side integration in the migration / function boundary, not inside browser modules. The Discord bridge docs explicitly describe the intended server-side boundary.
- When changing Discord or lobby integration, follow the additive design notes in `docs/discord-linking-live-lobbies.md`: the bot database remains authoritative, and the sync bridge is read-only with allow-listed data exports.
- For forum changes, follow the schema and security model in `supabase/migrations/202610200004_community_forum.sql` and related deletion migration; the forum is a distinct table set and not part of the temporary chat-room system.
- The repository already includes a Playwright MCP configuration in `.mcp.json` for browser-style validation. Use it when a route-level UI check needs browser automation.
