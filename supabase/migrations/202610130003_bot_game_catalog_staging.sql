-- Safe staging area for the ROM bot's SQLite game catalog.
-- Import rom_bot_game_catalog.csv into this table first; do not insert directly into public.games.
create table if not exists public.bot_game_catalog_staging (
  source_game_id integer primary key,
  title text not null,
  console text not null default 'Unknown',
  alternate_names_json jsonb not null default '[]'::jsonb,
  imported_at timestamptz not null default now()
);

alter table public.bot_game_catalog_staging enable row level security;
revoke all on table public.bot_game_catalog_staging from anon, authenticated;

comment on table public.bot_game_catalog_staging is
  'Staging-only copy of ROM Discord bot Games/Consoles/GameAlternateNames. Reconcile duplicates against public.games before importing.';
