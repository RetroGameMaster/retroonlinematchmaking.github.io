create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  link_url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.alerts add column if not exists user_id uuid;
alter table public.alerts add column if not exists id uuid default gen_random_uuid();
alter table public.alerts add column if not exists type text;
alter table public.alerts add column if not exists title text;
alter table public.alerts add column if not exists message text;
alter table public.alerts add column if not exists link_url text;
alter table public.alerts add column if not exists is_read boolean not null default false;
alter table public.alerts add column if not exists created_at timestamptz not null default now();

create index if not exists alerts_user_created_idx
  on public.alerts (user_id, created_at desc);
create index if not exists alerts_unread_user_idx
  on public.alerts (user_id)
  where is_read = false;

alter table public.alerts enable row level security;
revoke all on table public.alerts from anon, authenticated;
grant select on table public.alerts to authenticated;
grant update (is_read) on table public.alerts to authenticated;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'alerts'
  loop
    execute format('drop policy %I on public.alerts', existing_policy.policyname);
  end loop;
end $$;

create policy "Users can read their own alerts"
  on public.alerts for select to authenticated
  using (user_id = auth.uid());

create policy "Users can mark their own alerts read"
  on public.alerts for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.create_user_alert(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_link_url text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user_id is null or p_title is null or p_message is null then
    return;
  end if;

  insert into public.alerts (user_id, type, title, message, link_url, is_read)
  values (
    p_user_id,
    left(coalesce(nullif(btrim(p_type), ''), 'update'), 40),
    left(btrim(p_title), 120),
    left(btrim(p_message), 500),
    left(nullif(btrim(p_link_url), ''), 500),
    false
  );
end;
$$;

revoke all on function public.create_user_alert(uuid, text, text, text, text)
  from public, anon, authenticated;

create or replace function public.notify_friend_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requester_name text;
begin
  select coalesce(nullif(btrim(username), ''), 'A ROM member')
    into requester_name
    from public.profiles
    where id = new.user_id;

  perform public.create_user_alert(
    new.friend_id,
    'friend_request',
    'New friend request',
    coalesce(requester_name, 'A ROM member') || ' sent you a friend request.',
    '#/profile/' || new.user_id::text
  );
  return new;
end;
$$;

drop trigger if exists alerts_friend_request_insert on public.friends;
create trigger alerts_friend_request_insert
  after insert on public.friends
  for each row
  when (new.status = 'pending')
  execute function public.notify_friend_request();

create or replace function public.notify_friend_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  accepter_name text;
begin
  if old.status is distinct from 'accepted' and new.status = 'accepted' then
    select coalesce(nullif(btrim(username), ''), 'A ROM member')
      into accepter_name
      from public.profiles
      where id = new.friend_id;

    perform public.create_user_alert(
      new.user_id,
      'friend_accepted',
      'Friend request accepted',
      coalesce(accepter_name, 'A ROM member') || ' accepted your friend request.',
      '#/profile/' || new.friend_id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists alerts_friend_acceptance_update on public.friends;
create trigger alerts_friend_acceptance_update
  after update of status on public.friends
  for each row
  when (new.status = 'accepted')
  execute function public.notify_friend_acceptance();

create or replace function public.notify_direct_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sender_name text;
begin
  select coalesce(nullif(btrim(username), ''), 'A ROM member')
    into sender_name
    from public.profiles
    where id = new.sender_id;

  perform public.create_user_alert(
    new.receiver_id,
    'direct_message',
    'New direct message',
    'You received a message from ' || coalesce(sender_name, 'a ROM member') || '.',
    '#/direct-messages?user=' || new.sender_id::text
  );
  return new;
end;
$$;

drop trigger if exists alerts_direct_message_insert on public.direct_messages;
create trigger alerts_direct_message_insert
  after insert on public.direct_messages
  for each row
  execute function public.notify_direct_message();

create or replace function public.notify_achievement_unlock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  achievement_title text;
begin
  select nullif(btrim(title), '')
    into achievement_title
    from public.achievements
    where id = new.achievement_id;

  perform public.create_user_alert(
    new.user_id,
    'achievement',
    'Achievement unlocked',
    'You unlocked ' || coalesce(achievement_title, 'a new achievement') || '.',
    '#/profile/' || new.user_id::text
  );
  return new;
end;
$$;

drop trigger if exists alerts_achievement_insert on public.user_achievements;
create trigger alerts_achievement_insert
  after insert on public.user_achievements
  for each row
  execute function public.notify_achievement_unlock();

create or replace function public.notify_lfg_join()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.accepted_by is null and new.accepted_by is not null
     and new.user_id is distinct from new.accepted_by then
    perform public.create_user_alert(
      new.user_id,
      'lfg_accepted',
      'Lobby joined',
      coalesce(new.accepted_username, 'A player') || ' joined your ' ||
        coalesce(new.game_title, 'game') || ' lobby.',
      '#/lfg'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists alerts_lfg_join_update on public.lfg_posts;
create trigger alerts_lfg_join_update
  after update of accepted_by on public.lfg_posts
  for each row
  when (new.accepted_by is not null)
  execute function public.notify_lfg_join();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'alerts'
     ) then
    alter publication supabase_realtime add table public.alerts;
  end if;
end $$;
