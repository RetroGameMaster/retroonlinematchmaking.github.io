-- Bot-owned game catalog mapping and public, non-identifying snapshots.
-- Existing website game IDs and the deployed discord_live_lobbies table are untouched.

create table if not exists public.discord_bot_game_map (
  source_game_id bigint primary key,
  website_game_id uuid not null references public.games(id) on delete cascade,
  alternate_names text[] not null default '{}',
  synced_at timestamptz not null default now()
);

alter table public.discord_bot_game_map enable row level security;
revoke all on table public.discord_bot_game_map from anon, authenticated;

create table if not exists public.discord_bot_lfg_invites (
  external_invite_id text primary key,
  guild_id text not null,
  channel_id text not null,
  message_id text not null,
  game_title text not null,
  console text,
  minimum_players integer not null default 2 check (minimum_players > 0),
  player_count integer not null default 0 check (player_count >= 0),
  role_name text,
  connection_methods text,
  additional_notes text,
  discord_url text not null,
  expires_at timestamptz not null,
  is_expired boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists discord_bot_lfg_invites_active_expiry_idx
  on public.discord_bot_lfg_invites (expires_at)
  where is_expired = false;
create index if not exists discord_bot_lfg_invites_guild_idx
  on public.discord_bot_lfg_invites (guild_id, external_invite_id);

alter table public.discord_bot_lfg_invites enable row level security;
revoke all on table public.discord_bot_lfg_invites from anon, authenticated;
grant select on table public.discord_bot_lfg_invites to anon, authenticated;
drop policy if exists "Public can view active bot invites" on public.discord_bot_lfg_invites;
create policy "Public can view active bot invites"
  on public.discord_bot_lfg_invites for select to anon, authenticated
  using (is_expired = false and expires_at > now());

create table if not exists public.discord_bot_public_stats (
  scope_key text primary key,
  game_count integer not null default 0 check (game_count >= 0),
  active_service_count integer not null default 0 check (active_service_count >= 0),
  active_player_count integer not null default 0 check (active_player_count >= 0),
  active_invite_count integer not null default 0 check (active_invite_count >= 0),
  total_wins integer not null default 0 check (total_wins >= 0),
  team_wins integer not null default 0 check (team_wins >= 0),
  updated_at timestamptz not null default now()
);

alter table public.discord_bot_public_stats enable row level security;
revoke all on table public.discord_bot_public_stats from anon, authenticated;
grant select on table public.discord_bot_public_stats to anon, authenticated;
drop policy if exists "Public can view bot aggregate stats" on public.discord_bot_public_stats;
create policy "Public can view bot aggregate stats"
  on public.discord_bot_public_stats for select to anon, authenticated
  using (true);

create or replace function public.sync_discord_bot_catalog(p_games jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item jsonb;
  source_id bigint;
  game_title text;
  console_name text;
  alt_names text[];
  mapped_game_id uuid;
  matches uuid[];
  slug_base text;
  inserted_count integer := 0;
  matched_count integer := 0;
  updated_count integer := 0;
  ambiguous_count integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;
  if jsonb_typeof(p_games) <> 'array' or jsonb_array_length(p_games) > 500 then
    raise exception 'p_games must be an array of at most 500 games';
  end if;

  for item in select value from jsonb_array_elements(p_games)
  loop
    source_id := nullif(item->>'source_game_id', '')::bigint;
    game_title := nullif(btrim(item->>'title'), '');
    console_name := nullif(btrim(item->>'console'), '');
    if source_id is null or game_title is null or console_name is null then
      raise exception 'each game requires source_game_id, title, and console';
    end if;

    select coalesce(array_agg(value), '{}')
      into alt_names
      from jsonb_array_elements_text(
        case when jsonb_typeof(item->'alternate_names') = 'array'
          then item->'alternate_names' else '[]'::jsonb end
      ) as names(value)
      where btrim(value) <> '';

    select website_game_id into mapped_game_id
      from public.discord_bot_game_map
      where source_game_id = source_id;

    if mapped_game_id is not null then
      update public.games
        set title = game_title, console = console_name
        where id = mapped_game_id
          and (title is distinct from game_title or console is distinct from console_name);
      if found then
        updated_count := updated_count + 1;
      end if;
    else
      select array_agg(g.id order by g.id)
        into matches
        from public.games g
        where regexp_replace(lower(btrim(g.title)), '\s+', ' ', 'g')
              = regexp_replace(lower(game_title), '\s+', ' ', 'g')
          and regexp_replace(lower(btrim(g.console)), '\s+', ' ', 'g')
              = regexp_replace(lower(console_name), '\s+', ' ', 'g');

      if coalesce(array_length(matches, 1), 0) > 1 then
        ambiguous_count := ambiguous_count + 1;
        continue;
      elsif coalesce(array_length(matches, 1), 0) = 1 then
        mapped_game_id := matches[1];
        matched_count := matched_count + 1;
      else
        mapped_game_id := gen_random_uuid();
        slug_base := regexp_replace(lower(game_title), '[^a-z0-9]+', '-', 'g');
        slug_base := trim(both '-' from slug_base);
        insert into public.games (
          id, title, console, submitted_by, status, approved_at, slug
        ) values (
          mapped_game_id,
          game_title,
          console_name,
          'discord-bot-sync',
          'approved',
          now(),
          left('discord-bot-' || source_id::text || '-' || coalesce(nullif(slug_base, ''), 'game'), 220)
            || '-' || left(replace(mapped_game_id::text, '-', ''), 8)
        );
        inserted_count := inserted_count + 1;
      end if;

      insert into public.discord_bot_game_map (
        source_game_id, website_game_id, alternate_names, synced_at
      ) values (source_id, mapped_game_id, alt_names, now())
      on conflict (source_game_id) do update
        set website_game_id = excluded.website_game_id,
            alternate_names = excluded.alternate_names,
            synced_at = excluded.synced_at;
    end if;

    update public.discord_bot_game_map
      set alternate_names = alt_names, synced_at = now()
      where source_game_id = source_id
        and alternate_names is distinct from alt_names;
  end loop;

  return jsonb_build_object(
    'inserted', inserted_count,
    'matched_existing', matched_count,
    'updated', updated_count,
    'ambiguous_skipped', ambiguous_count
  );
end;
$$;

revoke all on function public.sync_discord_bot_catalog(jsonb) from public, anon, authenticated;
grant execute on function public.sync_discord_bot_catalog(jsonb) to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public'
        and tablename = 'discord_bot_lfg_invites'
    ) then
      alter publication supabase_realtime add table public.discord_bot_lfg_invites;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public'
        and tablename = 'discord_live_services'
    ) then
      alter publication supabase_realtime add table public.discord_live_services;
    end if;
  end if;
end $$;
