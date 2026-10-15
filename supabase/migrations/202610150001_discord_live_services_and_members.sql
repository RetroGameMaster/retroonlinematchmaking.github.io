-- ROM live service ticker and Discord matchmaking member snapshots.
-- Additive: leaves existing website tables and bot database untouched.

create table if not exists public.discord_live_services (
  guild_id text not null,
  source_key text not null,
  service_name text not null,
  game_title text not null,
  console text,
  players_online integer not null default 0 check (players_online >= 0),
  discord_url text,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (guild_id, source_key)
);

create index if not exists discord_live_services_active_updated_idx
  on public.discord_live_services (is_active, updated_at desc);

alter table public.discord_live_services enable row level security;
revoke all on table public.discord_live_services from anon, authenticated;
grant select on table public.discord_live_services to anon, authenticated;
drop policy if exists "Public can view active live services" on public.discord_live_services;
create policy "Public can view active live services"
  on public.discord_live_services for select to anon, authenticated
  using (is_active = true);

create table if not exists public.discord_member_snapshots (
  guild_id text not null,
  discord_user_id text not null,
  profile_data jsonb not null default '{}'::jsonb,
  total_wins integer not null default 0 check (total_wins >= 0),
  team_wins integer not null default 0 check (team_wins >= 0),
  updated_at timestamptz not null default now(),
  primary key (guild_id, discord_user_id)
);

-- Matchmaking preferences and availability are not public by default.
alter table public.discord_member_snapshots enable row level security;
revoke all on table public.discord_member_snapshots from anon, authenticated;
