-- Maggie App Phase 4.2: cleanup/reliability fixes
-- Safe to run after Phase 4. Adds the grants that are required for anon-key access
-- to the cloud-backed songs table while retaining RLS policy control.

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.songs to anon, authenticated;
