-- ROM Discord live lobbies. Additive; existing website chat_rooms remain unchanged.
create table if not exists public.discord_live_lobbies (
  discord_lobby_key text primary key,
  guild_id text not null,
  channel_id text not null,
  message_id text not null,
  host_discord_id text not null,
  game_id integer,
  game_title text not null,
  console text,
  minimum_players integer not null default 2,
  joined_players integer not null default 0,
  connection_methods text,
  additional_notes text,
  discord_url text not null,
  expires_at timestamptz not null,
  is_expired boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists discord_live_lobbies_active_expiry_idx
  on public.discord_live_lobbies (expires_at)
  where is_expired = false;
create index if not exists discord_live_lobbies_game_title_idx
  on public.discord_live_lobbies (game_title);

alter table public.discord_live_lobbies enable row level security;
revoke all on table public.discord_live_lobbies from anon, authenticated;
grant select on table public.discord_live_lobbies to anon, authenticated;

drop policy if exists "Anyone can view active Discord lobbies" on public.discord_live_lobbies;
create policy "Anyone can view active Discord lobbies"
on public.discord_live_lobbies
for select
to anon, authenticated
using (is_expired = false and expires_at > now());

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'discord_live_lobbies'
     ) then
    alter publication supabase_realtime add table public.discord_live_lobbies;
  end if;
end $$;
