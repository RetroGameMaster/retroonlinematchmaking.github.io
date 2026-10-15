-- Linked Discord names/IDs are displayed on public ROM profiles and leaderboard rows.
-- OAuth states remain private; only the account-link directory is readable.
grant select on table public.discord_account_links to anon, authenticated;
drop policy if exists "Public can view linked Discord identities" on public.discord_account_links;
create policy "Public can view linked Discord identities"
on public.discord_account_links
for select to anon, authenticated
using (true);
