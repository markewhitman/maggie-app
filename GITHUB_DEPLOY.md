# Maggie App — GitHub Pages Deployment Guide

This guide reflects the current app architecture: the frontend is hosted on GitHub Pages, while cloud sync and PDF storage use Supabase.

---

## Current architecture

| Area | Current implementation |
|---|---|
| Static hosting | GitHub Pages |
| Frontend build | Vite |
| Setlists | Supabase `setlists` table |
| Venues | Supabase `venues` table |
| Active stage session | Supabase `active_sessions` table |
| Audience requests | Supabase `song_requests` and `request_log` tables |
| PDF files | Supabase Storage `pdfs` bucket |
| Song-to-PDF mapping | Supabase `song_pdfs` table |
| Built-in seed songs | Frontend bundle, with Supabase overrides/tombstones |
| User-added songs and song edits | Supabase `songs` table |
| Performance notes | Supabase `perf_notes` table in Stage and song history views |

The app currently uses a shared single-user Supabase identity in `client/src/lib/supabase.ts`. That is suitable for a private personal app only. A commercial release needs authentication, per-user tenancy, RLS policies, and private/scoped audience routes.

---

## 1. Create or connect the GitHub repository

```bash
git init
git add .
git commit -m "Initial commit — Maggie Performer App"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/maggie-app.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## 2. Configure the app URL

Open `package.json` and update the `homepage` field:

```json
"homepage": "https://YOUR_USERNAME.github.io/maggie-app"
```

---

## 3. Install dependencies

```bash
npm ci
```

Use `npm install` only when intentionally updating dependencies.

---

## 4. Validate before deploying

Run:

```bash
npm run check
npm run build:gh
```

`build:gh` now runs TypeScript first, then the production Vite build. Deployment should fail if type checking fails.

---

## 5. Deploy to GitHub Pages

```bash
npm run deploy
```

This builds the static app and publishes `dist/public` to the `gh-pages` branch.

Then enable Pages in GitHub:

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Choose **Deploy from a branch**.
4. Select `gh-pages` and `/ (root)`.
5. Save.

The app will be available at:

```text
https://YOUR_USERNAME.github.io/maggie-app
```

The audience routes are:

```text
https://YOUR_USERNAME.github.io/maggie-app/#/audience
https://YOUR_USERNAME.github.io/maggie-app/#/audience/<setlistId>
```

Use the **Audience Link** button on a setlist to copy the scoped link for that gig. The generic `#/audience` route will try to bind to the currently loaded Stage set.

---

## 6. Supabase configuration required

The code expects these Supabase resources to exist:

### Tables

- `setlists`
- `venues`
- `active_sessions`
- `perf_notes`
- `song_pdfs`
- `song_requests`
- `request_log`
- `songs`

### Storage

- Bucket: `pdfs`
- Current code assumes public URLs from the `pdfs` bucket.
- Current UI copy references a 20 MB PDF limit; enforce the same limit in Supabase/storage policy if possible.

For commercial use, the `pdfs` bucket should be private with signed URLs, and all tables/storage objects should be protected by RLS.

Apply these migrations before relying on the current cloud-sync behavior:

```text
supabase/migrations/20260528_phase3_gig_scoped_requests.sql
supabase/migrations/20260528_phase4_cloud_songs_cleanup.sql
supabase/migrations/20260528_phase4_2_cleanup_reliability.sql
supabase/migrations/20260528_phase5_security_hardening.sql
```

See `docs/PHASE5_SECURITY_HARDENING.md` for the current personal-MVP hardening baseline and the remaining commercial security gap.

---

## 7. Backup/export

Settings includes **Backup & Export**, which downloads a JSON file containing:

- song metadata and synced song overrides
- setlists
- venues
- active stage session
- performance notes
- pending/request history metadata
- song-to-PDF URL mappings
- local app preferences

The backup contains PDF URLs, not PDF file binaries. Supabase Storage remains the source of truth for uploaded PDFs.

---

## 8. PDF storage

New PDF uploads from both the song detail modal and add-song modal now use Supabase:

1. Upload file to the `pdfs` storage bucket.
2. Save the public URL and original name in `song_pdfs`.
3. Save/update the synced song record so the PDF is visible across devices.

The legacy GitHub Release Asset/PAT workflow has been removed from the client code. The fullscreen PDF viewer and PDF preview are lazy-loaded so the initial app bundle is smaller; PDF code downloads only when sheet music is opened.

---

## Known migration gaps

These are intentional current-state notes, not deployment steps:

- User-added songs and edited seed-song overrides now sync through Supabase after the Phase 4 migration is applied.
- The first app load after deploying Phase 4 migrates any existing local user-added songs into Supabase.
- Phase 4.2 adds the missing `songs` table grants to the migration history, adds JSON backup/export, and lazy-loads PDF rendering.
- Phase 5 enables RLS on the remaining core app tables and moves new audience links toward random audience slugs instead of raw setlist ids.
- Built-in seed songs still ship in the frontend bundle, with synced overrides stored in Supabase.
- Audience requests are gig-scoped after applying the Phase 3 Supabase migration. Before the migration, the client falls back to the legacy unscoped queue.
- `gig_start_time` syncs after applying the Phase 3 Supabase migration. Before the migration, the client falls back to the older schema.
- There is no authentication or commercial-grade tenancy yet.
- The included RLS migrations are a personal-MVP baseline. They reduce accidental/public exposure but are not a commercial-grade auth/tenant model.

