alter table public.tournaments
  alter column registration_link drop not null;

alter table public.tournaments enable row level security;

grant select on table public.tournaments to anon, authenticated;
grant insert, update, delete on table public.tournaments to authenticated;

drop policy if exists "Anyone can view tournaments" on public.tournaments;
create policy "Anyone can view tournaments"
  on public.tournaments for select to anon, authenticated
  using (true);

drop policy if exists "Users can create their own tournaments" on public.tournaments;
create policy "Users can create their own tournaments"
  on public.tournaments for insert to authenticated
  with check (organizer_id = auth.uid());

drop policy if exists "Organizers can update their tournaments" on public.tournaments;
create policy "Organizers can update their tournaments"
  on public.tournaments for update to authenticated
  using (organizer_id = auth.uid())
  with check (organizer_id = auth.uid());

drop policy if exists "Organizers can delete their tournaments" on public.tournaments;
create policy "Organizers can delete their tournaments"
  on public.tournaments for delete to authenticated
  using (organizer_id = auth.uid());
