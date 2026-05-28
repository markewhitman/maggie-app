-- Maggie App Phase 3: gig-scoped audience requests
-- Apply in Supabase SQL Editor before relying on scoped QR/audience links.
-- This migration is additive and should not delete existing data.

-- Required by gen_random_uuid() on most Supabase projects.
create extension if not exists pgcrypto;

-- Persist setlist start times across devices. Older app builds stored this locally.
alter table if exists public.setlists
  add column if not exists gig_start_time text;

-- Optional audience controls for future public/private request links.
alter table if exists public.setlists
  add column if not exists audience_slug text,
  add column if not exists requests_enabled boolean not null default true;

update public.setlists
set audience_slug = coalesce(audience_slug, replace(gen_random_uuid()::text, '-', ''))
where audience_slug is null;

create unique index if not exists setlists_audience_slug_key
  on public.setlists (audience_slug)
  where audience_slug is not null;

-- Scope live requests and request history to one gig/setlist.
alter table if exists public.song_requests
  add column if not exists gig_id text,
  add column if not exists requester_id text,
  add column if not exists resolved_at timestamptz;

alter table if exists public.request_log
  add column if not exists gig_id text;

create index if not exists song_requests_gig_status_created_idx
  on public.song_requests (gig_id, status, created_at);

create index if not exists request_log_gig_requested_idx
  on public.request_log (gig_id, requested_at desc);

-- Personal-MVP RLS baseline -------------------------------------------------
-- This app still uses a public anon key and a fixed user_id in client code.
-- These policies make audience inserts possible and keep the current admin UI
-- working, but they are NOT sufficient for a commercial multi-user product.
-- The commercial target is Supabase Auth + per-user/band ownership policies.

alter table if exists public.song_requests enable row level security;
alter table if exists public.request_log enable row level security;

-- Public audience users may submit requests for an enabled setlist.
drop policy if exists "Audience can submit enabled gig requests" on public.song_requests;
create policy "Audience can submit enabled gig requests"
  on public.song_requests
  for insert
  to anon
  with check (
    gig_id is null
    or exists (
      select 1
      from public.setlists s
      where s.id = song_requests.gig_id
        and coalesce(s.requests_enabled, true) = true
    )
  );

-- Current performer/admin UI uses the anon key. Keep read/update/delete open
-- for now so the existing personal app continues to function.
-- Replace these with authenticated ownership policies before commercial use.
drop policy if exists "Personal app can read requests" on public.song_requests;
create policy "Personal app can read requests"
  on public.song_requests
  for select
  to anon
  using (true);

drop policy if exists "Personal app can resolve requests" on public.song_requests;
create policy "Personal app can resolve requests"
  on public.song_requests
  for update
  to anon
  using (true)
  with check (true);

drop policy if exists "Personal app can clear requests" on public.song_requests;
create policy "Personal app can clear requests"
  on public.song_requests
  for delete
  to anon
  using (true);

drop policy if exists "Personal app can insert request log" on public.request_log;
create policy "Personal app can insert request log"
  on public.request_log
  for insert
  to anon
  with check (true);

drop policy if exists "Personal app can read request log" on public.request_log;
create policy "Personal app can read request log"
  on public.request_log
  for select
  to anon
  using (true);
