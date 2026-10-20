grant delete on table public.forum_posts to authenticated;

drop policy if exists "Authors can delete their own forum posts" on public.forum_posts;
create policy "Authors can delete their own forum posts"
  on public.forum_posts for delete to authenticated
  using (author_id = auth.uid());

create or replace function public.reconcile_forum_topic_after_post_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  remaining_count integer;
  latest_post record;
begin
  select count(*)::integer
    into remaining_count
    from public.forum_posts
    where topic_id = old.topic_id;

  if remaining_count = 0 then
    delete from public.forum_topics where id = old.topic_id;
  else
    select author_id, created_at
      into latest_post
      from public.forum_posts
      where topic_id = old.topic_id
      order by created_at desc, id desc
      limit 1;

    update public.forum_topics
      set post_count = remaining_count,
          last_post_at = latest_post.created_at,
          last_post_author_id = latest_post.author_id
      where id = old.topic_id;
  end if;

  return old;
end;
$$;

revoke all on function public.reconcile_forum_topic_after_post_delete()
  from public, anon, authenticated;

drop trigger if exists forum_post_reconciles_topic_after_delete on public.forum_posts;
create trigger forum_post_reconciles_topic_after_delete
  after delete on public.forum_posts
  for each row execute function public.reconcile_forum_topic_after_post_delete();
