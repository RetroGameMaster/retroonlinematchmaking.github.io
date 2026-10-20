alter table public.game_submissions
  add column if not exists github_url text,
  add column if not exists youtube_url text;

alter table public.games
  add column if not exists github_url text,
  add column if not exists youtube_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.game_submissions'::regclass
      and conname = 'game_submissions_decomp_project_links_check'
  ) then
    alter table public.game_submissions
      add constraint game_submissions_decomp_project_links_check
      check (
        console is distinct from 'Decomps'
        or (
          github_url is not null
          and
          github_url ~ '^https://github\.com/[^/]+/[^/?#]+/?([?#].*)?$'
          and (
            youtube_url is null
            or youtube_url ~ '^https://(www\.)?(youtube\.com|youtu\.be)/'
          )
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.games'::regclass
      and conname = 'games_decomp_project_links_check'
  ) then
    alter table public.games
      add constraint games_decomp_project_links_check
      check (
        console is distinct from 'Decomps'
        or (
          github_url is not null
          and
          github_url ~ '^https://github\.com/[^/]+/[^/?#]+/?([?#].*)?$'
          and (
            youtube_url is null
            or youtube_url ~ '^https://(www\.)?(youtube\.com|youtu\.be)/'
          )
        )
      );
  end if;
end;
$$;

create table if not exists public.community_user_restrictions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  restriction_type text not null check (restriction_type in ('timeout', 'ban')),
  reason text not null default '',
  expires_at timestamptz,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  constraint community_user_restrictions_expiry check (
    (restriction_type = 'timeout' and expires_at is not null)
    or (restriction_type = 'ban' and expires_at is null)
  )
);

alter table public.community_user_restrictions enable row level security;
revoke all on table public.community_user_restrictions from anon, authenticated;
grant select on table public.community_user_restrictions to authenticated;

drop policy if exists "Admins can view community restrictions" on public.community_user_restrictions;
create policy "Admins can view community restrictions"
  on public.community_user_restrictions for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin is true
    )
  );

create or replace function public.admin_set_community_restriction(
  p_user_id uuid,
  p_restriction_type text,
  p_duration_hours integer default null,
  p_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_is_admin boolean;
  expiry timestamptz;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin is true
  ) then
    raise exception 'Admin access is required.' using errcode = '42501';
  end if;

  if p_user_id is null or p_user_id = auth.uid() then
    raise exception 'You cannot moderate your own account.';
  end if;

  select is_admin into target_is_admin
  from public.profiles where id = p_user_id;
  if not found then
    raise exception 'User not found.';
  end if;
  if target_is_admin is true then
    raise exception 'Administrator accounts cannot be moderated here.';
  end if;

  if p_restriction_type = 'timeout' then
    if p_duration_hours is null or p_duration_hours < 1 or p_duration_hours > 8760 then
      raise exception 'Timeout duration must be between 1 and 8760 hours.';
    end if;
    expiry := now() + make_interval(hours => p_duration_hours);
  elsif p_restriction_type = 'ban' then
    if p_duration_hours is not null then
      raise exception 'Permanent bans do not have a duration.';
    end if;
    expiry := null;
  else
    raise exception 'Choose a timeout or permanent ban.';
  end if;

  insert into public.community_user_restrictions
    (user_id, restriction_type, reason, expires_at, updated_by, updated_at)
  values
    (p_user_id, p_restriction_type, left(coalesce(p_reason, ''), 1000), expiry, auth.uid(), now())
  on conflict (user_id) do update
    set restriction_type = excluded.restriction_type,
        reason = excluded.reason,
        expires_at = excluded.expires_at,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;
end;
$$;

create or replace function public.admin_clear_community_restriction(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin is true
  ) then
    raise exception 'Admin access is required.' using errcode = '42501';
  end if;

  delete from public.community_user_restrictions
  where user_id = p_user_id;
end;
$$;

revoke all on function public.admin_set_community_restriction(uuid, text, integer, text)
  from public, anon;
revoke all on function public.admin_clear_community_restriction(uuid)
  from public, anon;
grant execute on function public.admin_set_community_restriction(uuid, text, integer, text)
  to authenticated;
grant execute on function public.admin_clear_community_restriction(uuid)
  to authenticated;

create or replace function public.enforce_community_user_restriction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid;
  restriction public.community_user_restrictions%rowtype;
begin
  actor_id := nullif(to_jsonb(new) ->> tg_argv[0], '')::uuid;
  if actor_id is null then
    return new;
  end if;

  select * into restriction
  from public.community_user_restrictions
  where user_id = actor_id
    and (
      restriction_type = 'ban'
      or expires_at > now()
    );

  if found then
    if restriction.restriction_type = 'ban' then
      raise exception 'This account is banned from community actions.'
        using errcode = '42501';
    end if;
    raise exception 'This account is timed out from community actions until %.',
      restriction.expires_at
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_community_user_restriction() from public, anon, authenticated;

do $$
declare
  target_table text;
  actor_column text;
  trigger_name text;
begin
  for target_table, actor_column in
    select * from (values
      ('chat_messages', 'user_id'),
      ('private_messages', 'sender_id'),
      ('forum_topics', 'author_id'),
      ('forum_posts', 'author_id'),
      ('game_submissions', 'user_id'),
      ('profile_comments', 'author_id'),
      ('lfg_posts', 'user_id'),
      ('game_reviews', 'user_id')
    ) as targets(table_name, column_name)
  loop
    if to_regclass(format('public.%I', target_table)) is not null
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = target_table
          and column_name = actor_column
      ) then
      trigger_name := target_table || '_enforce_community_restriction';
      execute format('drop trigger if exists %I on public.%I', trigger_name, target_table);
      execute format(
        'create trigger %I before insert or update on public.%I for each row execute function public.enforce_community_user_restriction(%L)',
        trigger_name, target_table, actor_column
      );
    end if;
  end loop;
end;
$$;
