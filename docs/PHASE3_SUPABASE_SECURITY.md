# Phase 3 Supabase Security Notes

This phase adds **gig-scoped audience links** in the app and provides an additive Supabase migration.

## What is now implemented in the app

- Audience links can target a specific setlist/gig: `#/audience/<setlistId>`.
- Setlists now have a **Copy Audience Link** button.
- The public Audience page submits requests with a `gig_id` when available.
- Stage Manager polls only requests for the active setlist when the `gig_id` column exists.
- The code has backward-compatible fallbacks for older request schemas, so the app still works before the Phase 3 SQL migration is applied, but request scoping will not be strict until that migration is applied.
- Phase 4 adds the `songs` table so user-added songs and edited song records sync across devices.

## Apply the migration

Open Supabase → SQL Editor and run these migrations in order:

```sql
supabase/migrations/20260528_phase3_gig_scoped_requests.sql
supabase/migrations/20260528_phase4_cloud_songs_cleanup.sql
```

After applying the migration, redeploy the app and retest:

1. Load a setlist for tonight.
2. Copy its Audience Link from Setlists.
3. Open that link in a private/incognito window.
4. Submit a request.
5. Confirm Stage shows the request only for the loaded setlist.
6. Load a different setlist and confirm the previous request does not leak into the new Stage queue.
7. Add a new song, refresh the app, and confirm the new song remains available.
8. Open the app on another device/browser and confirm the new song appears there too.

## Current security level

This is still a **personal-MVP security model**, not a commercial security model.

The app still uses:

- a public Supabase anon key
- a fixed client-side user id
- public/admin actions from the browser

That means a determined user could still inspect the app bundle and call Supabase directly. The migration improves scoping and creates a cleaner path, but it does not create true commercial-grade access control by itself.

## Commercial target

Before a paid/public release, add:

- Supabase Auth
- owner/team/band ids on every private table
- RLS policies using `auth.uid()`
- private PDF storage with signed URLs
- public audience tokens that can only insert requests for one active gig
- rate limiting or one-request-per-device behavior
- audit/backup/export support
