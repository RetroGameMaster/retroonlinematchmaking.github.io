create table if not exists public.game_lobby_streams (
  game_id uuid primary key references public.games(id) on delete cascade,
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stream_url text not null,
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  constraint game_lobby_streams_valid_url check (
    stream_url ~* '^https://(www\.)?(youtube\.com|youtu\.be|twitch\.tv)(/|\?|$)'
  ),
  constraint game_lobby_streams_one_hour check (
    expires_at <= claimed_at + interval '1 hour'
  )
);

alter table public.game_lobby_streams enable row level security;
revoke all on table public.game_lobby_streams from anon, authenticated;
grant select on table public.game_lobby_streams to anon, authenticated;

drop policy if exists "View active game lobby streams" on public.game_lobby_streams;
create policy "View active game lobby streams"
  on public.game_lobby_streams for select to anon, authenticated
  using (expires_at > now());

create or replace function public.claim_game_lobby_stream(
  p_game_id uuid,
  p_room_id uuid,
  p_stream_url text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  active_room boolean;
  existing_owner uuid;
  existing_room uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in to claim the stream slot' using errcode = '42501';
  end if;

  perform 1 from public.games where id = p_game_id for update;
  if not found then
    raise exception 'game not found';
  end if;

  select exists (
    select 1
    from public.chat_rooms
    where id = p_room_id
      and game_id = p_game_id
      and is_ephemeral is true
      and last_activity > now() - interval '1 hour'
  ) into active_room;
  if not active_room then
    raise exception 'this live lobby is no longer active';
  end if;

  if p_stream_url is null or length(p_stream_url) > 2048
    or p_stream_url !~* '^https://(www\.)?(youtube\.com|youtu\.be|twitch\.tv)(/|\?|$)' then
    raise exception 'enter a valid HTTPS Twitch or YouTube live link';
  end if;

  delete from public.game_lobby_streams
    where game_id = p_game_id
      and (
        expires_at <= now()
        or not exists (
          select 1
          from public.chat_rooms room
          where room.id = game_lobby_streams.room_id
            and room.is_ephemeral is true
            and room.last_activity > now() - interval '1 hour'
        )
      );

  select user_id, room_id
    into existing_owner, existing_room
    from public.game_lobby_streams
    where game_id = p_game_id
    for update;

  if existing_owner is not null then
    if existing_owner <> auth.uid() or existing_room <> p_room_id then
      raise exception 'another streamer already has this game lobby slot';
    end if;

    update public.game_lobby_streams
      set stream_url = p_stream_url
      where game_id = p_game_id;
    return;
  end if;

  insert into public.game_lobby_streams (game_id, room_id, user_id, stream_url)
  values (p_game_id, p_room_id, auth.uid(), p_stream_url);
end;
$$;

create or replace function public.release_game_lobby_stream(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in to stop the stream' using errcode = '42501';
  end if;

  delete from public.game_lobby_streams
    where game_id = p_game_id
      and user_id = auth.uid();
end;
$$;

revoke all on function public.claim_game_lobby_stream(uuid, uuid, text)
  from public, anon;
revoke all on function public.release_game_lobby_stream(uuid)
  from public, anon;
grant execute on function public.claim_game_lobby_stream(uuid, uuid, text)
  to authenticated;
grant execute on function public.release_game_lobby_stream(uuid)
  to authenticated;

create table if not exists public.game_lobby_activity (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  played_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists game_lobby_activity_user_played_idx
  on public.game_lobby_activity (user_id, played_at desc);

alter table public.game_lobby_activity enable row level security;
revoke all on table public.game_lobby_activity from anon, authenticated;
grant select on table public.game_lobby_activity to anon, authenticated;

drop policy if exists "Public can view game lobby activity" on public.game_lobby_activity;
create policy "Public can view game lobby activity"
  on public.game_lobby_activity for select to anon, authenticated
  using (true);

create or replace function public.record_game_lobby_activity(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  lobby_game_id uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in to record lobby activity' using errcode = '42501';
  end if;

  select game_id into lobby_game_id
    from public.chat_rooms
    where id = p_room_id
      and is_ephemeral is true
      and last_activity > now() - interval '1 hour';
  if lobby_game_id is null then
    raise exception 'this live lobby is no longer active';
  end if;

  insert into public.game_lobby_activity (room_id, user_id, game_id)
  values (p_room_id, auth.uid(), lobby_game_id)
  on conflict (room_id, user_id) do nothing;
end;
$$;

revoke all on function public.record_game_lobby_activity(uuid)
  from public, anon;
grant execute on function public.record_game_lobby_activity(uuid)
  to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'game_lobby_streams'
    ) then
      alter publication supabase_realtime add table public.game_lobby_streams;
    end if;
  end if;
end;
$$;
