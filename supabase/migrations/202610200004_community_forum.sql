create table if not exists public.forum_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.forum_topics (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.forum_categories(id) on delete restrict,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  post_count integer not null default 0 check (post_count >= 0),
  created_at timestamptz not null default now(),
  last_post_at timestamptz not null default now(),
  last_post_author_id uuid references auth.users(id) on delete set null
);

create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.forum_topics(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 10000),
  created_at timestamptz not null default now()
);

create index if not exists forum_topics_category_activity_idx
  on public.forum_topics (category_id, last_post_at desc);
create index if not exists forum_posts_topic_created_idx
  on public.forum_posts (topic_id, created_at);

alter table public.forum_categories enable row level security;
alter table public.forum_topics enable row level security;
alter table public.forum_posts enable row level security;

revoke all on table public.forum_categories, public.forum_topics, public.forum_posts
  from anon, authenticated;
grant select on table public.forum_categories, public.forum_topics, public.forum_posts
  to anon, authenticated;
grant insert (topic_id, author_id, content) on public.forum_posts to authenticated;

drop policy if exists "Forum categories are public" on public.forum_categories;
create policy "Forum categories are public"
  on public.forum_categories for select to anon, authenticated
  using (true);

drop policy if exists "Forum topics are public" on public.forum_topics;
create policy "Forum topics are public"
  on public.forum_topics for select to anon, authenticated
  using (true);

drop policy if exists "Forum posts are public" on public.forum_posts;
create policy "Forum posts are public"
  on public.forum_posts for select to anon, authenticated
  using (
    exists (
      select 1
      from public.forum_topics topic
      where topic.id = forum_posts.topic_id
    )
  );

drop policy if exists "Signed-in users can reply to forum topics" on public.forum_posts;
create policy "Signed-in users can reply to forum topics"
  on public.forum_posts for insert to authenticated
  with check (author_id = auth.uid());

create or replace function public.update_forum_topic_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.forum_topics
  set post_count = post_count + 1,
      last_post_at = new.created_at,
      last_post_author_id = new.author_id
  where id = new.topic_id;
  return new;
end;
$$;

revoke all on function public.update_forum_topic_activity() from public, anon, authenticated;

drop trigger if exists forum_post_updates_topic_activity on public.forum_posts;
create trigger forum_post_updates_topic_activity
  after insert on public.forum_posts
  for each row execute function public.update_forum_topic_activity();

create or replace function public.create_forum_topic(
  p_category_id uuid,
  p_title text,
  p_content text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  topic_id uuid;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Sign in is required to start a discussion.';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 160 then
    raise exception 'Discussion titles must be between 1 and 160 characters.';
  end if;
  if p_content is null or char_length(btrim(p_content)) not between 1 and 10000 then
    raise exception 'Posts must be between 1 and 10000 characters.';
  end if;

  insert into public.forum_topics (category_id, author_id, title)
  values (p_category_id, current_user_id, btrim(p_title))
  returning id into topic_id;

  insert into public.forum_posts (topic_id, author_id, content)
  values (topic_id, current_user_id, btrim(p_content));

  return topic_id;
end;
$$;

revoke all on function public.create_forum_topic(uuid, text, text) from public, anon;
grant execute on function public.create_forum_topic(uuid, text, text) to authenticated;

insert into public.forum_categories (slug, name, description, sort_order)
values
  ('general', 'General Gaming', 'Introductions, community chat, and gaming topics that do not fit another board.', 10),
  ('retro', 'Retro Gaming', 'Classic consoles, games, hardware, collecting, and preservation.', 20),
  ('help', 'Game Help & Support', 'Ask questions, share fixes, and help other players.', 30),
  ('online-play', 'Online Play', 'Discuss multiplayer, netplay, matchmaking, and finding players.', 40),
  ('site-feedback', 'ROM Website Feedback', 'Ideas, questions, and feedback about the ROM website.', 50)
on conflict (slug) do nothing;
