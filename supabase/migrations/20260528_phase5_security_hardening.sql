-- Maggie App Phase 5: security hardening baseline
-- Apply after Phase 4.2. This enables RLS on the app tables that were still
-- marked UNRESTRICTED and narrows browser access to Maggie's single-app user id.
--
-- Important: this is a personal-app hardening pass, not full commercial auth.
-- Because the current static app still uses the public anon key and a fixed
-- app user id, a determined technical user could still inspect the client and
-- attempt requests as that user. The commercial target remains Supabase Auth.

create extension if not exists pgcrypto;

do $$
begin
  -- Keep future audience links unguessable even if the client forgets to send a slug.
  if to_regclass('public.setlists') is not null then
    alter table public.setlists
      add column if not exists audience_slug text,
      add column if not exists requests_enabled boolean not null default true;

    update public.setlists
    set audience_slug = coalesce(audience_slug, replace(gen_random_uuid()::text, '-', ''))
    where audience_slug is null;

    alter table public.setlists
      alter column audience_slug set default replace(gen_random_uuid()::text, '-', ''),
      alter column requests_enabled set default true;
  end if;

  -- Add ownership metadata to PDF URL mappings so RLS can scope them.
  if to_regclass('public.song_pdfs') is not null then
    alter table public.song_pdfs
      add column if not exists user_id text;

    update public.song_pdfs
    set user_id = coalesce(user_id, 'maggie-whitman-app-2026')
    where user_id is null;

    alter table public.song_pdfs
      alter column user_id set default 'maggie-whitman-app-2026';
  end if;
end $$;

create unique index if not exists setlists_audience_slug_key
  on public.setlists (audience_slug)
  where audience_slug is not null;

create index if not exists setlists_user_audience_slug_idx
  on public.setlists (user_id, audience_slug);

create index if not exists song_pdfs_user_song_idx
  on public.song_pdfs (user_id, song_id);

-- Required grants. RLS below determines which rows are visible/mutable.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.setlists to anon, authenticated;
grant select, insert, update, delete on table public.venues to anon, authenticated;
grant select, insert, update, delete on table public.active_sessions to anon, authenticated;
grant select, insert, update, delete on table public.perf_notes to anon, authenticated;
grant select, insert, update, delete on table public.songs to anon, authenticated;
grant select, insert, update, delete on table public.song_pdfs to anon, authenticated;
grant select, insert, update, delete on table public.song_requests to anon, authenticated;
grant select, insert on table public.request_log to anon, authenticated;

-- Enable RLS on app tables.
alter table if exists public.setlists enable row level security;
alter table if exists public.venues enable row level security;
alter table if exists public.active_sessions enable row level security;
alter table if exists public.perf_notes enable row level security;
alter table if exists public.songs enable row level security;
alter table if exists public.song_pdfs enable row level security;
alter table if exists public.song_requests enable row level security;
alter table if exists public.request_log enable row level security;

-- Setlists -----------------------------------------------------------------
drop policy if exists "Personal app can read setlists" on public.setlists;
create policy "Personal app can read setlists"
  on public.setlists
  for select
  to anon, authenticated
  using (user_id = 'maggie-whitman-app-2026');

drop policy if exists "Personal app can insert setlists" on public.setlists;
create policy "Personal app can insert setlists"
  on public.setlists
  for insert
  to anon, authenticated
  with check (user_id = 'maggie-whitman-app-2026');

drop policy if exists "Personal app can update setlists" on public.setlists;
create policy "Personal app can update setlists"
  on public.setlists
  for update
  to anon, authenticated
  using (user_id = 'maggie-whitman-app-2026')
  with check (user_id = 'maggie-whitman-app-2026');

drop policy if exists "Personal app can delete setlists" on public.setlists;
create policy "Personal app can delete setlists"
  on public.setlists
  for delete
  to anon, authenticated
  using (user_id = 'maggie-whitman-app-2026');

-- Venues -------------------------------------------------------------------
drop policy if exists "Personal app can read venues" on public.venues;
create policy "Personal app can read venues"
  on public.venues
  for select
  to anon, authenticated
  using (user_id = 'maggie-whitman-app-2026');

drop policy if exists "Personal app can insert venues" on public.venues;
create policy "Personal app can insert venues"
  on public.venues
  for insert
  to anon, authenticated
  with check (user_id = 'maggie-whitman-app-2026');

drop policy if exists "Personal app can update venues" on public.venues;
create policy "Personal app can update venues"
  on public.venues
  for update
  to anon, authenticated
  using (user_id = 'maggie-whitman-app-2026')
  with check (user_id = 'maggie-whitman-app-2026');

drop policy if exists "Personal app can delete venues" on public.venues;
create policy "Personal app can delete venues"
  on public.venues
  for delete
  to anon, authenticated
  using (user_id = 'maggie-whitman-app-2026');

-- Active session ------------------------------------------------------------
drop policy if exists "Personal app can read active session" on public.active_sessions;
create policy "Personal app can read active session"
  on public.active_sessions
  for select
  to anon, authenticated
  using (user_id = 'maggie-whitman-app-2026');

drop policy if exists "Personal app can insert active session" on public.active_sessions;
create policy "Personal app can insert active session"
  on public.active_sessions
  for insert
  to anon, authenticated
  with check (user_id = 'maggie-whitman-app-2026');

drop policy if exists "Personal app can update active session" on public.active_sessions;
create policy "Personal app can update active session"
  on public.active_sessions
  for update
  to anon, authenticated
  using (user_id = 'maggie-whitman-app-2026')
  with check (user_id = 'maggie-whitman-app-2026');

drop policy if exists "Personal app can delete active session" on public.active_sessions;
create policy "Personal app can delete active session"
  on public.active_sessions
  for delete
  to anon, authenticated
  using (user_id = 'maggie-whitman-app-2026');

-- Performance notes ---------------------------------------------------------
drop policy if exists "Personal app can read perf notes" on public.perf_notes;
create policy "Personal app can read perf notes"
  on public.perf_notes
  for select
  to anon, authenticated
  using (user_id = 'maggie-whitman-app-2026');

drop policy if exists "Personal app can insert perf notes" on public.perf_notes;
create policy "Personal app can insert perf notes"
  on public.perf_notes
  for insert
  to anon, authenticated
  with check (user_id = 'maggie-whitman-app-2026');

drop policy if exists "Personal app can update perf notes" on public.perf_notes;
create policy "Personal app can update perf notes"
  on public.perf_notes
  for update
  to anon, authenticated
  using (user_id = 'maggie-whitman-app-2026')
  with check (user_id = 'maggie-whitman-app-2026');

drop policy if exists "Personal app can delete perf notes" on public.perf_notes;
create policy "Personal app can delete perf notes"
  on public.perf_notes
  for delete
  to anon, authenticated
  using (user_id = 'maggie-whitman-app-2026');

-- Songs ---------------------------------------------------------------------
drop policy if exists "Personal app can read songs" on public.songs;
create policy "Personal app can read songs"
  on public.songs
  for select
  to anon, authenticated
  using (user_id = 'maggie-whitman-app-2026');

drop policy if exists "Personal app can insert songs" on public.songs;
create policy "Personal app can insert songs"
  on public.songs
  for insert
  to anon, authenticated
  with check (user_id = 'maggie-whitman-app-2026');

drop policy if exists "Personal app can update songs" on public.songs;
create policy "Personal app can update songs"
  on public.songs
  for update
  to anon, authenticated
  using (user_id = 'maggie-whitman-app-2026')
  with check (user_id = 'maggie-whitman-app-2026');

drop policy if exists "Personal app can delete songs" on public.songs;
create policy "Personal app can delete songs"
  on public.songs
  for delete
  to anon, authenticated
  using (user_id = 'maggie-whitman-app-2026');

-- Song PDF URL mappings -----------------------------------------------------
drop policy if exists "Personal app can read song pdfs" on public.song_pdfs;
create policy "Personal app can read song pdfs"
  on public.song_pdfs
  for select
  to anon, authenticated
  using (coalesce(user_id, 'maggie-whitman-app-2026') = 'maggie-whitman-app-2026');

drop policy if exists "Personal app can insert song pdfs" on public.song_pdfs;
create policy "Personal app can insert song pdfs"
  on public.song_pdfs
  for insert
  to anon, authenticated
  with check (coalesce(user_id, 'maggie-whitman-app-2026') = 'maggie-whitman-app-2026');

drop policy if exists "Personal app can update song pdfs" on public.song_pdfs;
create policy "Personal app can update song pdfs"
  on public.song_pdfs
  for update
  to anon, authenticated
  using (coalesce(user_id, 'maggie-whitman-app-2026') = 'maggie-whitman-app-2026')
  with check (coalesce(user_id, 'maggie-whitman-app-2026') = 'maggie-whitman-app-2026');

drop policy if exists "Personal app can delete song pdfs" on public.song_pdfs;
create policy "Personal app can delete song pdfs"
  on public.song_pdfs
  for delete
  to anon, authenticated
  using (coalesce(user_id, 'maggie-whitman-app-2026') = 'maggie-whitman-app-2026');

-- Audience requests ---------------------------------------------------------
-- Audience users can only insert pending requests for an enabled audience slug
-- or legacy setlist id. They cannot mark a request approved/denied at insert.
drop policy if exists "Audience can submit enabled gig requests" on public.song_requests;
create policy "Audience can submit enabled gig requests"
  on public.song_requests
  for insert
  to anon, authenticated
  with check (
    status = 'pending'
    and (
      exists (
        select 1
        from public.setlists s
        where s.user_id = 'maggie-whitman-app-2026'
          and coalesce(s.requests_enabled, true) = true
          and (s.id = song_requests.gig_id or s.audience_slug = song_requests.gig_id)
      )
    )
  );

drop policy if exists "Personal app can read requests" on public.song_requests;
create policy "Personal app can read requests"
  on public.song_requests
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.setlists s
      where s.user_id = 'maggie-whitman-app-2026'
        and (s.id = song_requests.gig_id or s.audience_slug = song_requests.gig_id)
    )
  );

drop policy if exists "Personal app can resolve requests" on public.song_requests;
create policy "Personal app can resolve requests"
  on public.song_requests
  for update
  to anon, authenticated
  using (
    exists (
      select 1
      from public.setlists s
      where s.user_id = 'maggie-whitman-app-2026'
        and (s.id = song_requests.gig_id or s.audience_slug = song_requests.gig_id)
    )
  )
  with check (
    exists (
      select 1
      from public.setlists s
      where s.user_id = 'maggie-whitman-app-2026'
        and (s.id = song_requests.gig_id or s.audience_slug = song_requests.gig_id)
    )
  );

drop policy if exists "Personal app can clear requests" on public.song_requests;
create policy "Personal app can clear requests"
  on public.song_requests
  for delete
  to anon, authenticated
  using (
    exists (
      select 1
      from public.setlists s
      where s.user_id = 'maggie-whitman-app-2026'
        and (s.id = song_requests.gig_id or s.audience_slug = song_requests.gig_id)
    )
  );

-- Request history -----------------------------------------------------------
drop policy if exists "Personal app can insert request log" on public.request_log;
create policy "Personal app can insert request log"
  on public.request_log
  for insert
  to anon, authenticated
  with check (
    exists (
      select 1
      from public.setlists s
      where s.user_id = 'maggie-whitman-app-2026'
        and (s.id = request_log.gig_id or s.audience_slug = request_log.gig_id)
    )
  );

drop policy if exists "Personal app can read request log" on public.request_log;
create policy "Personal app can read request log"
  on public.request_log
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.setlists s
      where s.user_id = 'maggie-whitman-app-2026'
        and (s.id = request_log.gig_id or s.audience_slug = request_log.gig_id)
    )
  );

-- Supabase Storage ----------------------------------------------------------
-- Keep the existing public-PDF behavior, but scope write policies to the pdfs bucket.
-- This does not make PDFs private; it only documents and narrows bucket-level access.
drop policy if exists "Public can read Maggie PDFs" on storage.objects;
create policy "Public can read Maggie PDFs"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'pdfs');

drop policy if exists "Personal app can upload Maggie PDFs" on storage.objects;
create policy "Personal app can upload Maggie PDFs"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'pdfs');

drop policy if exists "Personal app can update Maggie PDFs" on storage.objects;
create policy "Personal app can update Maggie PDFs"
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'pdfs')
  with check (bucket_id = 'pdfs');

drop policy if exists "Personal app can delete Maggie PDFs" on storage.objects;
create policy "Personal app can delete Maggie PDFs"
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'pdfs');
