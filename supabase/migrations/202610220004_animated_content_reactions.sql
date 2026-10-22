insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reaction-stickers',
  'reaction-stickers',
  true,
  4194304,
  array['image/gif', 'image/webp', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.reaction_stickers (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(btrim(label)) between 1 and 40),
  image_url text not null,
  storage_path text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.content_reactions (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('game_discussion', 'profile_comment', 'game_review', 'chat_message')),
  target_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  sticker_id uuid not null references public.reaction_stickers(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (target_type, target_id, user_id, sticker_id)
);

create index if not exists content_reactions_target_idx
  on public.content_reactions (target_type, target_id);

alter table public.reaction_stickers enable row level security;
alter table public.content_reactions enable row level security;

revoke all on table public.reaction_stickers, public.content_reactions from anon, authenticated;
grant select on table public.reaction_stickers, public.content_reactions to anon, authenticated;
grant insert, update, delete on table public.reaction_stickers to authenticated;

drop policy if exists "Public can view active reaction stickers" on public.reaction_stickers;
create policy "Public can view active reaction stickers"
  on public.reaction_stickers for select to anon, authenticated
  using (
    is_active is true
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin is true
    )
  );

drop policy if exists "Admins can create reaction stickers" on public.reaction_stickers;
create policy "Admins can create reaction stickers"
  on public.reaction_stickers for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin is true
    )
  );

drop policy if exists "Admins can update reaction stickers" on public.reaction_stickers;
create policy "Admins can update reaction stickers"
  on public.reaction_stickers for update to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin is true
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin is true
    )
  );

drop policy if exists "Admins can delete reaction stickers" on public.reaction_stickers;
create policy "Admins can delete reaction stickers"
  on public.reaction_stickers for delete to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin is true
    )
  );

drop policy if exists "Public can view content reactions" on public.content_reactions;
create policy "Public can view content reactions"
  on public.content_reactions for select to anon, authenticated
  using (true);

drop policy if exists "Admins can upload reaction sticker files" on storage.objects;
create policy "Admins can upload reaction sticker files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'reaction-stickers'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin is true
    )
  );

drop policy if exists "Admins can update reaction sticker files" on storage.objects;
create policy "Admins can update reaction sticker files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'reaction-stickers'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin is true
    )
  )
  with check (
    bucket_id = 'reaction-stickers'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin is true
    )
  );

drop policy if exists "Admins can delete reaction sticker files" on storage.objects;
create policy "Admins can delete reaction sticker files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'reaction-stickers'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin is true
    )
  );

create or replace function public.toggle_content_reaction(
  p_target_type text,
  p_target_id uuid,
  p_sticker_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing_id uuid;
  inserted_id uuid;
  target_exists boolean := false;
begin
  if auth.uid() is null then
    raise exception 'sign in to react' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.reaction_stickers
    where id = p_sticker_id and is_active is true
  ) then
    raise exception 'reaction sticker is not available';
  end if;

  case p_target_type
    when 'game_discussion' then
      select exists(select 1 from public.game_discussions where id = p_target_id) into target_exists;
    when 'profile_comment' then
      select exists(select 1 from public.profile_comments where id = p_target_id) into target_exists;
    when 'game_review' then
      select exists(select 1 from public.game_reviews where id = p_target_id) into target_exists;
    when 'chat_message' then
      select exists(select 1 from public.chat_messages where id = p_target_id and room_id is not null) into target_exists;
    else
      raise exception 'unsupported reaction target';
  end case;
  if not target_exists then
    raise exception 'reaction target was not found';
  end if;

  select id into existing_id
  from public.content_reactions
  where target_type = p_target_type
    and target_id = p_target_id
    and user_id = auth.uid()
    and sticker_id = p_sticker_id;
  if existing_id is not null then
    delete from public.content_reactions where id = existing_id;
    return false;
  end if;

  insert into public.content_reactions (target_type, target_id, user_id, sticker_id)
  values (p_target_type, p_target_id, auth.uid(), p_sticker_id)
  on conflict (target_type, target_id, user_id, sticker_id) do nothing
  returning id into inserted_id;
  return inserted_id is not null;
end;
$$;

revoke all on function public.toggle_content_reaction(text, uuid, uuid) from public, anon;
grant execute on function public.toggle_content_reaction(text, uuid, uuid) to authenticated;
