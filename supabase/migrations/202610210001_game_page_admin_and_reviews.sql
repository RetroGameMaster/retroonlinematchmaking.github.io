create table if not exists public.game_reviews (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text not null default '',
  content text not null check (char_length(btrim(content)) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, user_id)
);

create index if not exists game_reviews_game_created_idx
  on public.game_reviews (game_id, created_at desc);

alter table public.game_reviews enable row level security;
revoke all on table public.game_reviews from anon, authenticated;
grant select on table public.game_reviews to anon, authenticated;
grant insert (game_id, user_id, rating, title, content) on table public.game_reviews to authenticated;
grant update (rating, title, content, updated_at) on table public.game_reviews to authenticated;
grant delete on table public.game_reviews to authenticated;

drop policy if exists "Game reviews are public" on public.game_reviews;
create policy "Game reviews are public"
  on public.game_reviews for select to anon, authenticated
  using (true);

drop policy if exists "Users can write their own game reviews" on public.game_reviews;
create policy "Users can write their own game reviews"
  on public.game_reviews for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own game reviews" on public.game_reviews;
create policy "Users can update their own game reviews"
  on public.game_reviews for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own game reviews" on public.game_reviews;
create policy "Users can delete their own game reviews"
  on public.game_reviews for delete to authenticated
  using (auth.uid() = user_id);

create or replace function public.set_game_review_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists game_reviews_set_updated_at on public.game_reviews;
create trigger game_reviews_set_updated_at
  before update on public.game_reviews
  for each row execute function public.set_game_review_updated_at();

create or replace function public.admin_update_game_page(p_game_id uuid, p_updates jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_rows integer;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles
    where id = auth.uid() and is_admin is true
  ) then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  if p_updates is null or jsonb_typeof(p_updates) <> 'object' then
    raise exception 'game updates must be a JSON object';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_updates) as update_key(key)
    where key <> all (array[
      'title', 'console', 'year', 'description', 'developer', 'publisher',
      'genre', 'release_date', 'features', 'video_url', 'cover_image_url',
      'background_image_url', 'background_video_url', 'connection_method',
      'connection_details', 'server_details', 'players_min', 'players_max',
      'servers_available', 'multiplayer_type'
    ])
  ) then
    raise exception 'game updates contain unsupported fields';
  end if;

  update public.games as game
  set (
    title, console, year, description, developer, publisher, genre,
    release_date, features, video_url, cover_image_url, background_image_url,
    background_video_url, connection_method, connection_details, server_details,
    players_min, players_max, servers_available, multiplayer_type, updated_at
  ) = (
    select
      updated.title, updated.console, updated.year, updated.description,
      updated.developer, updated.publisher, updated.genre, updated.release_date,
      updated.features, updated.video_url, updated.cover_image_url,
      updated.background_image_url, updated.background_video_url,
      updated.connection_method, updated.connection_details,
      updated.server_details, updated.players_min, updated.players_max,
      updated.servers_available, updated.multiplayer_type, now()
    from jsonb_populate_record(game, p_updates) as updated
  )
  where game.id = p_game_id;

  get diagnostics updated_rows = row_count;
  if updated_rows = 0 then
    raise exception 'game not found';
  end if;
end;
$$;

revoke all on function public.admin_update_game_page(uuid, jsonb) from public, anon;
grant execute on function public.admin_update_game_page(uuid, jsonb) to authenticated;
