# Copilot instructions

## Build, test, and deploy

This is a browser-native static site: there is no package manifest, build step, configured linter, or automated test runner. There is no single-test command.

To run the site locally, serve the repository root over HTTP (native ES modules and fetched templates need an HTTP origin):

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000` and exercise the affected hash route and browser flow. Features that use Supabase require the configured project and suitable test accounts/data.

`.github/workflows/deploy.yml` publishes the repository root to GitHub Pages on pushes to `main` or via manual workflow dispatch; there is no build artifact generation step.

## Architecture

- `index.html` is the site shell: it contains the shared navigation and app container, global styles, and CDN-loaded browser libraries (including Supabase JS). `app.js` initializes auth and shared UI, parses hash routes, and loads page modules into `#app-content`.
- The standard module loader fetches `modules/<feature>/<feature>.html` and dynamically imports a JavaScript entry point registered in the `modules` map in `app.js`. Other paths (including direct messages, game lists with query parameters, game/guide/profile details, game discussions, and game editing) have dedicated dispatch logic in `app.js`. A module folder is not auto-discovered: add route/import handling there and preserve any existing route parameters.
- Module entry points receive or use the shared `window.rom` app context (including the current user, Supabase client, and navigation/module-loading helpers), but initialization signatures and export styles vary. Check both the module and its call site in `app.js` before changing or adding one.
- Shared browser-side services and helpers live in `lib/`; feature-specific UI and behavior live in `modules/`. Supabase data access is primarily made directly from those browser modules, so the database schema and row-level security policies are part of the feature contract.
- Realtime subscriptions are created by individual features; follow the feature's existing subscription and cleanup pattern when changing realtime behavior.
- Database changes belong in ordered SQL migrations under `supabase/migrations/`. Read `docs/discord-linking-live-lobbies.md` before changing Discord linking or live-lobby integration: that design is additive and deliberately keeps the Discord bot's database authoritative.

## Repository conventions

- Use native JavaScript ES modules and relative imports; this project has no bundler or server-side application layer. Keep template fetch paths and import paths consistent with the existing router and deployment from the repository root.
- Reuse the existing Supabase client from `lib/supabase.js` or the app context passed to the module; do not create a separate client. Keep privileged credentials and server-only integrations out of browser code. The Discord integration guide describes the intended server-side boundary.
- Keep feature-specific markup in its matching HTML template when the route follows the standard module pattern, and keep its behavior in the matching JavaScript entry point. Update `app.js` when adding a feature that needs route or import registration; preserve special route/query handling where applicable.
- Preserve existing hash URLs (`#/...`) when changing navigation; the site uses hash routing rather than server-side route handling.
