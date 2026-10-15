-- Live API/service activity mirror for the ROM home-page ticker.
-- The external read-only bridge is the only writer (through the authenticated Edge Function).
create table if not exists public.discord_live_services (
  source_key text primary key,
  guild_id text not null,
  service_name text not null,
  game_title text not null,
  console text,
  players_online integer not null default 0,
  discord_url text,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists discord_live_services_active_updated_idx
  on public.discord_live_services (is_active, updated_at desc);

alter table public.discord_live_services enable row level security;
revoke all on table public.discord_live_services from anon, authenticated;
grant select on table public.discord_live_services to anon, authenticated;

drop policy if exists "Anyone can view active ROM live services" on public.discord_live_services;
create policy "Anyone can view active ROM live services"
on public.discord_live_services
for select to anon, authenticated
using (is_active = true);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'discord_live_services'
     ) then
    alter publication supabase_realtime add table public.discord_live_services;
  end if;
end $$;
