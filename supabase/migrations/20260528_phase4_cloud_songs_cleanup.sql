-- Maggie App Phase 4: cloud-backed song catalogue
-- Apply in Supabase SQL Editor before relying on cross-device user-added songs.
-- This migration is additive and should not delete existing data.

create extension if not exists pgcrypto;

create table if not exists public.songs (
  id text not null,
  user_id text not null,
  title text not null,
  artist text not null,
  year integer not null default extract(year from now())::integer,
  song_key text not null default '',
  capo text not null default 'No capo',
  chords text not null default '',
  strumming text not null default '',
  guitar_type text not null default 'acoustic',
  tempo integer not null default 120,
  tempo_feel text not null default 'Mid-Tempo',
  mood text not null default '',
  mood2 text,
  genre text not null default '',
  genre2 text,
  decade text,
  energy text,
  vocal_style text,
  "similar" text[],
  difficulty text not null default 'Intermediate',
  tags text[] not null default '{}',
  performance_note text not null default '',
  ultimate_guitar_url text not null default '',
  set_position integer not null default 99,
  duration integer,
  pdf_url text,
  pdf_asset_id integer,
  pdf_filename text,
  user_added boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, user_id)
);

create index if not exists songs_user_title_idx
  on public.songs (user_id, lower(title));

create index if not exists songs_user_set_position_idx
  on public.songs (user_id, set_position, lower(title));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_songs_updated_at on public.songs;
create trigger set_songs_updated_at
before update on public.songs
for each row
execute function public.set_updated_at();

alter table public.songs enable row level security;

-- Personal-MVP policy baseline: the app still uses the anon key and fixed
-- client-side user_id. This keeps the current personal workflow working.
-- Replace with Supabase Auth ownership policies before commercial release.
drop policy if exists "Personal app can read songs" on public.songs;
create policy "Personal app can read songs"
  on public.songs
  for select
  to anon
  using (true);

drop policy if exists "Personal app can insert songs" on public.songs;
create policy "Personal app can insert songs"
  on public.songs
  for insert
  to anon
  with check (true);

drop policy if exists "Personal app can update songs" on public.songs;
create policy "Personal app can update songs"
  on public.songs
  for update
  to anon
  using (true)
  with check (true);

drop policy if exists "Personal app can delete songs" on public.songs;
create policy "Personal app can delete songs"
  on public.songs
  for delete
  to anon
  using (true);

-- Table privileges required for browser anon-key access. RLS still controls row visibility/mutation.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.songs to anon, authenticated;
