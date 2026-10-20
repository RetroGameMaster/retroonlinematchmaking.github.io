# Game pages

Game-page editing and player reviews use the migration
`202610210001_game_page_admin_and_reviews.sql`. Apply it to Supabase before
deploying the updated site.

The game detail page shows **Edit Game Page** only when the signed-in user's
`profiles.is_admin` value is `true`. Saving uses the
`admin_update_game_page` database function, which independently checks that
admin status and accepts only supported game-page fields.

Signed-in users can post one review per game, update or delete their own
review, and read the public review wall. Row-level security enforces those
permissions in Supabase.

## Guide import

The checked-in local bot database snapshot (`docs/localdb.db`) has no guide
table or guide records. The existing website guide catalog can still be
managed through its current guide tools, but importing guide content from the
bot database requires a source database/export that actually contains those
records. No bot changes or fabricated guide records are part of this update.
