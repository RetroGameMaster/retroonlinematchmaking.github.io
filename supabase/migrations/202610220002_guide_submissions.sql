alter table public.guides enable row level security;

grant select on table public.guides to anon, authenticated;
grant insert, update, delete on table public.guides to authenticated;

drop policy if exists "Public can view approved guides" on public.guides;
create policy "Public can view approved guides"
  on public.guides for select to anon, authenticated
  using (is_approved is true);

drop policy if exists "Admins can review all guides" on public.guides;
create policy "Admins can review all guides"
  on public.guides for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin is true
    )
  );

drop policy if exists "Authors can view their pending guides" on public.guides;
create policy "Authors can view their pending guides"
  on public.guides for select to authenticated
  using (author_id = auth.uid() and is_approved is false);

drop policy if exists "Admins can publish guides" on public.guides;
create policy "Admins can publish guides"
  on public.guides for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin is true
    )
  );

drop policy if exists "Admins can update guides" on public.guides;
create policy "Admins can update guides"
  on public.guides for update to authenticated
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

drop policy if exists "Admins can delete guides" on public.guides;
create policy "Admins can delete guides"
  on public.guides for delete to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin is true
    )
  );

create or replace function public.submit_guide_for_approval(
  p_game_id uuid,
  p_title text,
  p_slug text,
  p_difficulty text,
  p_video_url text,
  p_content_html text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  submitted_guide_id uuid;
  escaped_content text;
begin
  if auth.uid() is null then
    raise exception 'sign in to submit a guide' using errcode = '42501';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 200 then
    raise exception 'guide title must be between 1 and 200 characters';
  end if;
  if p_content_html is null or char_length(btrim(p_content_html)) not between 1 and 50000 then
    raise exception 'guide content must be between 1 and 50000 characters';
  end if;
  if p_difficulty not in ('Easy', 'Medium', 'Hard') then
    raise exception 'invalid guide difficulty';
  end if;
  if p_video_url is not null
    and btrim(p_video_url) <> ''
    and p_video_url !~* '^https://(www\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be)/' then
    raise exception 'guide videos must be a HTTPS YouTube link';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'invalid guide slug';
  end if;
  if not exists (
    select 1 from public.games where id = p_game_id and status = 'approved'
  ) then
    raise exception 'select an approved game';
  end if;

  escaped_content := replace(
    replace(
      replace(
        replace(
          replace(coalesce(p_content_html, ''), '&', '&amp;'),
          '<', '&lt;'
        ),
        '>', '&gt;'
      ),
      '"', '&quot;'
    ),
    '''', '&#39;'
  );
  escaped_content := replace(replace(escaped_content, E'\r\n', E'\n'), E'\n', '<br>');

  insert into public.guides (
    author_id, title, slug, difficulty, video_url, content_html, is_approved
  ) values (
    auth.uid(), btrim(p_title), p_slug, p_difficulty, nullif(btrim(p_video_url), ''),
    escaped_content, false
  )
  returning id into submitted_guide_id;

  insert into public.game_guides (game_id, guide_id)
  values (p_game_id, submitted_guide_id);

  return submitted_guide_id;
end;
$$;

revoke all on function public.submit_guide_for_approval(uuid, text, text, text, text, text)
  from public, anon;
grant execute on function public.submit_guide_for_approval(uuid, text, text, text, text, text)
  to authenticated;
