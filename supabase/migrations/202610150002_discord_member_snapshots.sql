-- Public read-only projection of bot matchmaking profile data and score totals.
-- The external bridge is the only writer; it never writes to the bot's SQLite DB.
create table if not exists public.discord_member_snapshots (
  discord_user_id text primary key,
  guild_id text not null,
  profile_data jsonb not null default '{}'::jsonb,
  total_wins integer not null default 0,
  team_wins integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists discord_member_snapshots_guild_wins_idx
  on public.discord_member_snapshots (guild_id, total_wins desc);
create index if not exists discord_member_snapshots_guild_team_wins_idx
  on public.discord_member_snapshots (guild_id, team_wins desc);

alter table public.discord_member_snapshots enable row level security;
revoke all on table public.discord_member_snapshots from anon, authenticated;
grant select on table public.discord_member_snapshots to anon, authenticated;

drop policy if exists "Anyone can view ROM community member snapshots" on public.discord_member_snapshots;
create policy "Anyone can view ROM community member snapshots"
on public.discord_member_snapshots
for select to anon, authenticated
using (true);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'discord_member_snapshots'
     ) then
    alter publication supabase_realtime add table public.discord_member_snapshots;
  end if;
end $$;
