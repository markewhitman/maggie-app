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
| Seed songs and user-added songs | Browser `localStorage` for now |
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

The audience route is currently:

```text
https://YOUR_USERNAME.github.io/maggie-app/#/audience
```

Note: the audience route now uses a request-only public layout with no admin navigation. It still needs gig-scoped URLs and database policies before broad public use.

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

### Storage

- Bucket: `pdfs`
- Current code assumes public URLs from the `pdfs` bucket.
- Current UI copy references a 20 MB PDF limit; enforce the same limit in Supabase/storage policy if possible.

For commercial use, the `pdfs` bucket should be private with signed URLs, and all tables/storage objects should be protected by RLS.

---

## 7. PDF storage

New PDF uploads from both the song detail modal and add-song modal now use Supabase:

1. Upload file to the `pdfs` storage bucket.
2. Save the public URL and original name in `song_pdfs`.
3. Patch the local song record with the PDF URL for the current browser.

The legacy GitHub Release Asset/PAT workflow is no longer used by Add Song. Some legacy helper files remain in the repo until the rest of the migration is cleaned up.

---

## Known migration gaps

These are intentional current-state notes, not deployment steps:

- User-added songs still live in `localStorage`.
- Setlist quick-add, Stage edits, venues, active sessions, PDFs, requests, and performance notes now use Supabase from the UI.
- Audience requests are not yet gig-scoped.
- `gig_start_time` is still stripped before cloud setlist writes unless the Supabase column exists and the client is updated.
- There is no authentication or commercial-grade tenancy yet.
- Supabase RLS and bucket policies are not represented in this repository.

