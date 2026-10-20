# ROM Community Forum

The forum is a persistent, category-based discussion board. It uses its own `forum_categories`, `forum_topics`, and `forum_posts` tables; it does not use or change the temporary `chat_rooms` used by Live Lobbies.

Visitors can read discussions. Signed-in users can start a topic or reply. Post content is plain text. The schema and row-level security policies are defined in `supabase/migrations/202610200004_community_forum.sql`.

To enable the feature, review and run that migration in the Supabase SQL Editor, then publish the website changes. The migration seeds the initial forum categories.
