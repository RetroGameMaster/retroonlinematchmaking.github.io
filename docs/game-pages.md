# Game pages

Game-page editing and player reviews use the migration
`202610210001_game_page_admin_and_reviews.sql`. Apply it to Supabase before
deploying the updated site.

The game detail page shows **Edit Game Page** only when the signed-in user's
`profiles.is_admin` value is `true`. Saving uses the
`admin_update_game_page` database function, which independently checks that
admin status and accepts only supported game-page fields. Cover art is optional;
an admin can leave the existing URL in place or upload a JPEG, PNG, GIF, or
WebP image to the existing `game-images` bucket. YouTube game videos use
click-to-play embeds rather than autoplay.

Signed-in users can post one review per game, update or delete their own
review, react to reviews with admin-managed animated stickers, and read the
public review wall. Row-level security enforces review permissions in Supabase.

## Guide submissions

Signed-in users can submit a guide for an approved game. Their guide stays
unlisted until an admin approves it in the Admin Panel's Guides tab. Admins can
continue to publish guides directly. Apply
`supabase/migrations/202610220002_guide_submissions.sql` before enabling member
submissions; it adds an atomic submission function that associates the guide
with its selected game and escapes submitted HTML.

## Animated reaction stickers

Admins can upload GIF, WebP, or PNG stickers in the Admin Panel's Reaction
Stickers tab. Enabled stickers are available as reactions on game discussions,
profile walls, game reviews, and public chat. Apply
`supabase/migrations/202610220004_animated_content_reactions.sql` first. The
migration creates the public sticker bucket and restricts uploads and sticker
management to admins.

## Guide import

The checked-in local bot database snapshot (`docs/localdb.db`) has no guide
table or guide records. The existing website guide catalog can still be
managed through its current guide tools, but importing guide content from the
bot database requires a source database/export that actually contains those
records. No bot changes or fabricated guide records are part of this update.
