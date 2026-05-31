-- Phase 5.20 — Song audio resources
-- Adds URL-based original recording, practice, reference, and backing-track links.

alter table if exists public.songs
  add column if not exists audio_resources jsonb not null default '[]'::jsonb;

comment on column public.songs.audio_resources is
  'Array of song audio resource links: original recordings, backing tracks, practice aids, references, and notes.';

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.songs to anon, authenticated;
