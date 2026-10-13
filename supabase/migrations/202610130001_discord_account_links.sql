-- ROM Discord account linking (additive; existing accounts and bot data are untouched)
-- Apply with Supabase CLI or SQL editor after reviewing the feature branch.

create table if not exists public.discord_account_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  discord_user_id text not null unique,
  discord_username text,
  discord_avatar_hash text,
  linked_at timestamptz not null default now()
);

create table if not exists public.discord_oauth_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  state_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.discord_account_links enable row level security;
alter table public.discord_oauth_states enable row level security;

-- The Edge Function uses the service role after validating the caller's Supabase JWT.
-- Browser roles receive no direct access to these tables.
revoke all on table public.discord_account_links from anon, authenticated;
revoke all on table public.discord_oauth_states from anon, authenticated;
