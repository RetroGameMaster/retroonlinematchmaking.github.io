create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.cleanup_expired_general_chat_messages()
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  removed_count bigint;
begin
  delete from public.chat_messages message
  using public.chat_rooms room
  where message.room_id = room.id
    and room.is_ephemeral is not true
    and message.created_at < now() - interval '24 hours';

  get diagnostics removed_count = row_count;
  return removed_count;
end;
$$;

revoke all on function public.cleanup_expired_general_chat_messages()
  from public, anon, authenticated;

do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid
    from cron.job
    where jobname = 'rom-cleanup-general-chat'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;

  perform cron.schedule(
    'rom-cleanup-general-chat',
    '0 * * * *',
    'select public.cleanup_expired_general_chat_messages();'
  );
end;
$$;
