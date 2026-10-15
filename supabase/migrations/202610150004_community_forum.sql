-- ROM community forum. Existing chat and Discord are unchanged.
create table if not exists public.community_forum_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'General' check (char_length(category) between 1 and 40),
  title text not null check (char_length(title) between 3 and 160),
  body text not null check (char_length(body) between 1 and 12000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_forum_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_forum_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 6000),
  created_at timestamptz not null default now()
);

create index if not exists community_forum_posts_created_idx on public.community_forum_posts (created_at desc);
create index if not exists community_forum_posts_category_idx on public.community_forum_posts (category, created_at desc);
create index if not exists community_forum_replies_post_created_idx on public.community_forum_replies (post_id, created_at);

alter table public.community_forum_posts enable row level security;
alter table public.community_forum_replies enable row level security;
grant select on public.community_forum_posts, public.community_forum_replies to anon, authenticated;
grant insert, update, delete on public.community_forum_posts to authenticated;
grant insert, delete on public.community_forum_replies to authenticated;

drop policy if exists "Anyone can read forum posts" on public.community_forum_posts;
create policy "Anyone can read forum posts" on public.community_forum_posts for select to anon, authenticated using (true);
drop policy if exists "Signed-in members can create forum posts" on public.community_forum_posts;
create policy "Signed-in members can create forum posts" on public.community_forum_posts for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Authors can update their own forum posts" on public.community_forum_posts;
create policy "Authors can update their own forum posts" on public.community_forum_posts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Authors can delete their own forum posts" on public.community_forum_posts;
create policy "Authors can delete their own forum posts" on public.community_forum_posts for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Anyone can read forum replies" on public.community_forum_replies;
create policy "Anyone can read forum replies" on public.community_forum_replies for select to anon, authenticated using (true);
drop policy if exists "Signed-in members can reply" on public.community_forum_replies;
create policy "Signed-in members can reply" on public.community_forum_replies for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Authors can delete their own forum replies" on public.community_forum_replies;
create policy "Authors can delete their own forum replies" on public.community_forum_replies for delete to authenticated using (auth.uid() = user_id);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'community_forum_posts') then
    alter publication supabase_realtime add table public.community_forum_posts;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'community_forum_replies') then
    alter publication supabase_realtime add table public.community_forum_replies;
  end if;
end $$;
