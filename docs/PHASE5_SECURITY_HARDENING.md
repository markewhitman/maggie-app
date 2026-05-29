# Phase 5 Security Hardening

This phase tightens the current personal-app Supabase setup while preserving the no-login workflow.

## What changed

- Enabled RLS on the app tables that were still marked **UNRESTRICTED** in Supabase.
- Added per-table policies scoped to the Maggie single-app user id: `maggie-whitman-app-2026`.
- Switched new audience links from raw setlist ids to random audience slugs where available.
- Stage Manager now looks for requests using the active setlist's audience slug, falling back to the setlist id for older links.
- Added `user_id` ownership metadata to `song_pdfs` mappings.
- Added explicit Storage policies for the `pdfs` bucket while keeping current public-PDF behavior.

## What this does not solve yet

This is not full commercial-grade security. The app still runs as a static GitHub Pages app with a public Supabase anon key and a fixed client-side user id. That means a determined technical user could inspect the bundle and attempt API calls as the personal app.

Commercial-grade security still requires:

- Supabase Auth
- private performer/admin routes tied to an authenticated user
- per-user or per-band ownership policies using `auth.uid()`
- private PDF storage with signed URLs
- request rate limiting / abuse controls

## Required Supabase step

Apply:

```sql
supabase/migrations/20260528_phase5_security_hardening.sql
```

After running it, the Supabase Table Editor should no longer show the core app tables as unrestricted.

## Test checklist

1. Songs page loads without a red permissions banner.
2. Add/edit/delete a song.
3. Attach and remove a PDF.
4. Create/edit/delete a setlist.
5. Copy a setlist Audience Link and confirm it uses a long slug rather than a raw setlist id for new setlists.
6. Submit an audience request through that link.
7. Load that setlist in Stage and confirm only that set's requests appear.
8. Add a performance note.
9. Create/edit/delete a venue.
10. Run Backup & Export from Settings.
