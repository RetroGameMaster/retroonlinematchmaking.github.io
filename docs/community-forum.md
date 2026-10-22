# ROM Community Forum

The forum is a persistent, category-based discussion board. It uses its own `forum_categories`, `forum_topics`, and `forum_posts` tables; it does not use or change the temporary `chat_rooms` used by Live Lobbies.

Visitors can read discussions. Signed-in users can start a topic, reply, or delete their own posts. Deleting the last post also removes its now-empty topic. Post content is plain text. The schema and row-level security policies are defined in `supabase/migrations/202610200004_community_forum.sql` and `supabase/migrations/202610200005_forum_post_deletion.sql`.

This plain-text forum is separate from each game's **Community Hub** discussion
page. Game discussions support a small safe BBCode subset, including HTTPS
images and links; raw HTML is escaped. Both community surfaces can show the
admin-managed animated reaction stickers described in `docs/game-pages.md`.

Tournament organizers can delete their own events, and the external signup URL
is optional. Apply `supabase/migrations/202610220003_tournament_owner_management.sql`
to make the event link nullable and enforce owner-only edits/deletion.

To enable the feature, review and run both migrations in numerical order in the Supabase SQL Editor, then publish the website changes. The forum schema migration seeds the initial categories.
