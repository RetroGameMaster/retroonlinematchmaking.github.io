-- Server-polled external game activity, kept separate from bot snapshots.
create table if not exists public.external_live_services (
  provider_key text not null,
  source_key text not null,
  service_name text not null,
  game_title text not null,
  console text,
  matched_game_id uuid references public.games(id) on delete set null,
  activity_kind text not null default 'players' check (activity_kind in ('players', 'lobbies')),
  players_online integer not null default 0 check (players_online >= 0),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (provider_key, source_key)
);

create index if not exists external_live_services_active_updated_idx
  on public.external_live_services (is_active, updated_at desc);

alter table public.external_live_services enable row level security;
revoke all on table public.external_live_services from anon, authenticated;
grant select on table public.external_live_services to anon, authenticated;
drop policy if exists "Public can view recent external live services" on public.external_live_services;
create policy "Public can view recent external live services"
  on public.external_live_services for select to anon, authenticated
  using (is_active = true and updated_at > now() - interval '10 minutes');

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'external_live_services'
  ) then
    alter publication supabase_realtime add table public.external_live_services;
  end if;
end
$$;
