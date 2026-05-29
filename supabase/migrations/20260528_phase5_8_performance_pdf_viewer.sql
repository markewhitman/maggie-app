-- Maggie App Phase 5.8: performance PDF viewer annotations
-- Adds an annotation overlay table for pen/touch/mouse notes on sheet music.
-- The original PDF file remains unchanged in Supabase Storage.

create table if not exists public.pdf_annotations (
  id text primary key,
  user_id text not null,
  song_id text not null,
  pdf_url text not null,
  annotations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pdf_annotations_user_song_idx
  on public.pdf_annotations (user_id, song_id);

create index if not exists pdf_annotations_updated_at_idx
  on public.pdf_annotations (updated_at desc);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.pdf_annotations to anon, authenticated;

alter table public.pdf_annotations enable row level security;

drop policy if exists "Personal app can read pdf annotations" on public.pdf_annotations;
create policy "Personal app can read pdf annotations"
  on public.pdf_annotations
  for select
  to anon, authenticated
  using (user_id = 'maggie-whitman-app-2026');

drop policy if exists "Personal app can insert pdf annotations" on public.pdf_annotations;
create policy "Personal app can insert pdf annotations"
  on public.pdf_annotations
  for insert
  to anon, authenticated
  with check (user_id = 'maggie-whitman-app-2026');

drop policy if exists "Personal app can update pdf annotations" on public.pdf_annotations;
create policy "Personal app can update pdf annotations"
  on public.pdf_annotations
  for update
  to anon, authenticated
  using (user_id = 'maggie-whitman-app-2026')
  with check (user_id = 'maggie-whitman-app-2026');

drop policy if exists "Personal app can delete pdf annotations" on public.pdf_annotations;
create policy "Personal app can delete pdf annotations"
  on public.pdf_annotations
  for delete
  to anon, authenticated
  using (user_id = 'maggie-whitman-app-2026');
