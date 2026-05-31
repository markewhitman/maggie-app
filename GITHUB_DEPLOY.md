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
| PDF annotations | Supabase `pdf_annotations` table, stored as overlay JSON |

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
- `pdf_annotations`

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
supabase/migrations/20260528_phase5_8_performance_pdf_viewer.sql
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
- PDF annotation overlay data

The backup contains PDF URLs and annotation overlay data, not PDF file binaries. Supabase Storage remains the source of truth for uploaded PDFs.

---

## 8. PDF storage

New PDF uploads from both the song detail modal and add-song modal now use Supabase:

1. Upload file to the `pdfs` storage bucket.
2. Save the public URL and original name in `song_pdfs`.
3. Save/update the synced song record so the PDF is visible across devices.

The legacy GitHub Release Asset/PAT workflow has been removed from the client code. The fullscreen PDF viewer and PDF preview are lazy-loaded so the initial app bundle is smaller; PDF code downloads only when sheet music is opened. The fullscreen viewer supports Page and Scroll modes, swipe/tap page turning, and optional annotation overlays saved to Supabase.

---

## Known migration gaps

These are intentional current-state notes, not deployment steps:

- User-added songs and edited seed-song overrides now sync through Supabase after the Phase 4 migration is applied.
- The first app load after deploying Phase 4 migrates any existing local user-added songs into Supabase.
- Phase 4.2 adds the missing `songs` table grants to the migration history, adds JSON backup/export, and lazy-loads PDF rendering.
- Phase 5 enables RLS on the remaining core app tables and moves new audience links toward random audience slugs instead of raw setlist ids.
- Phase 5.5 is a front-end polish pass: larger Stage controls, Focus mode, clearer Audience request buttons, setlist duplication, and PDF fit/last-page behavior.
- Phase 5.6 polishes the setlist builder: visible runtime summaries, duplicate-song warnings, clearer drag/reorder affordances, builder clear-order support, and Stage progress reset.
- Phase 5.7 polishes the song library and add/edit workflow: quick library stats/filters, sorting, clearer song cards, duplicate warnings, duration entry, and stronger song detail organization.
- Phase 5.8 improves the performer PDF viewer: Page/Scroll modes, swipe page turns, pen/touch annotation overlays, eraser/undo/clear-page controls, and backup export of annotation data.
- Built-in seed songs still ship in the frontend bundle, with synced overrides stored in Supabase.
- Audience requests are gig-scoped after applying the Phase 3 Supabase migration. Before the migration, the client falls back to the legacy unscoped queue.
- `gig_start_time` syncs after applying the Phase 3 Supabase migration. Before the migration, the client falls back to the older schema.
- There is no authentication or commercial-grade tenancy yet.
- The included RLS migrations are a personal-MVP baseline. They reduce accidental/public exposure but are not a commercial-grade auth/tenant model.

## Phase 5.9 performer interface polish

Phase 5.9 improves the live performer UI:

- Stage timing is now displayed as larger self-labeled tiles instead of small aligned columns.
- Stage header shows larger played, remaining, start, and projected-end timing cards.
- Next Up shows larger timing cues.
- Settings includes light/dark mode controls plus multiple color palettes.
- Palette choices are stored locally on each device.

No Supabase SQL migration is required for Phase 5.9.


## Phase 5.10 notes — Performance Mode and Audience QR

Phase 5.10 adds a dedicated Stage Performance view and replaces copy-only audience link behavior with QR/share dialogs. Setlist and Stage audience-share controls now show the scoped QR code, set name, and copy/share/preview actions. Audience request pages also identify the target set and can show either Tonight’s Set or All Songs.

No Supabase SQL migration is required for Phase 5.10.

## Phase 5.11 notes — Smart PDF Song Import

Phase 5.11 improves the Add Song workflow. When a performer attaches a PDF, the app reads the filename and selectable PDF text to suggest song-card fields such as title, artist, key, capo, chords, strumming, tempo, duration, source URL, tags, and stage notes. Blank fields are filled automatically when possible, and the Smart PDF Import review panel allows Fill blanks or Apply all before saving.

No Supabase SQL migration is required for Phase 5.11. Scanned/image-only PDFs still require manual entry unless OCR is added later.

## Phase 5.12 notes — Smart Import + Song Card Intelligence

Phase 5.12 refines Smart PDF Import with import-confidence scoring, detected-chord preview chips, better key/capo/duration parsing, review reasons, and a missing-essentials checklist. Song cards and the Song Library now show readiness/review indicators and a Needs Review quick filter.

No Supabase SQL migration is required for Phase 5.12. Review state is stored with normal song tags such as `needs-review` and `imported-from-pdf`.

## Phase 5.13 — AI/OCR PDF Import

Phase 5.13 adds an optional Supabase Edge Function for scanned/image-only PDF import.

Client-side deployment is still the normal flow:

```powershell
npm install
npm run check
npm run build:gh
git add .
git commit -m "Add AI OCR PDF song import"
git push
npm run deploy
```

The Edge Function must also be deployed separately with the Supabase CLI:

```powershell
supabase login
supabase link --project-ref bephofcynjspsulmuikh
supabase secrets set OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
supabase secrets set OPENAI_MODEL="gpt-4.1-mini"
supabase functions deploy analyze-song-pdf
```

No SQL migration is required for Phase 5.13.

The browser app never stores the OpenAI API key. The key lives only in Supabase secrets. If the Edge Function is not deployed or the key is missing, the Add Song modal still works with the existing local Smart PDF Import path.



## Phase 5.13.1 note — AI/OCR updates for existing song PDFs

Existing song cards can now scan newly attached/replaced PDFs and use the existing `analyze-song-pdf` Edge Function to suggest updates for missing or outdated song-card details. The web deployment is not enough for this phase; after committing/pushing/deploying the app, redeploy the Edge Function:

```powershell
npx supabase functions deploy analyze-song-pdf --project-ref bephofcynjspsulmuikh
```

No database migration is required for this phase.


## Phase 5.14.1 — Keyboard / Pedal Control Fixes

Phase 5.14.1 fixes the `U` shortcut so it undoes the most recently completed/skipped song, and adds explicit vertical keyboard scrolling in PDF Scroll mode for ArrowUp/ArrowDown/PageUp/PageDown/Space.

No Supabase SQL migration or Edge Function redeploy is required for Phase 5.14.1.

## Phase 5.14 — Pedal / Keyboard Performance Controls

Phase 5.14 adds keyboard and Bluetooth page-turner support for Stage, Performance Mode, and the fullscreen PDF viewer. Settings now includes a Performance Controls toggle and shortcut reference. Stage and PDF viewer surfaces also include on-screen shortcut help.

No Supabase SQL migration is required for Phase 5.14.

## Phase 5.15 — Pre-Gig Readiness + Set Confidence

Phase 5.15 adds a readiness screen before loading a set for performance. The app now checks missing PDFs, missing durations, songs needing review, duplicate songs, missing key/chord cues, audience QR readiness, runtime estimates, and backup freshness.

No Supabase SQL migration or Edge Function redeploy is required for this phase.

## Phase 5.16 — Performance Recap + Show Wrap-Up

Phase 5.16 adds a Stage/Performance Mode recap workflow. Performers can review played/skipped/pending songs, capture post-show notes, save per-song recap notes into performance history, and optionally finish/clear the active set after saving the recap.

Show recaps are stored locally and included in backup exports. No Supabase SQL migration or Edge Function redeploy is required.

## Phase 5.17 — Performance History Dashboard

Phase 5.17 adds a new History page for saved show recaps. It includes show timeline cards, summary statistics, song trends, venue trends, completion/top-song charts, filters, performance-history JSON export, and recap deletion.

Show recaps are still stored locally and included in Backup Export. The History page enriches those local recaps with Supabase songs, setlists, venues, performance notes, and request log data. No Supabase SQL migration or Edge Function redeploy is required.

## Phase 5.18A Notes — Gear Dashboard + Venue Setup Memory

Phase 5.18A adds a Gear page for cataloging performance gear and storing venue/situation-specific setup presets.

- No Supabase SQL migration is required.
- No Edge Function redeploy is required.
- Gear data is currently local to the browser and included in Maggie backup exports.
- New route: `#/gear`.
- Visual settings include dial, slider, and toggle graphics for quick soundcheck recall.

### Phase 5.18B — Gear Setup Sheets + Pack Checklist

Adds printable/copyable setup sheets, per-venue pack checklists, default venue setups, and preset-copy-to-venue workflow. No Supabase SQL migration or Edge Function deploy is required.

## Phase 5.18B.1 — Print setup-sheet hotfix

Phase 5.18B.1 fixes a blank `about:blank` print window issue in the Gear setup sheet print workflow. No Supabase migration or Edge Function deploy is required.

## Phase 5.18C — Gear Photos + Setup Diagrams

Gear now supports local gear/preset photos and simple venue setup diagrams. Diagrams are saved as JSON in localStorage and are included in backup export through the gear payload. Photos are compressed and stored locally; future versions should move setup photos to Supabase Storage if cross-device photo sync becomes important.

No Supabase SQL migration or Edge Function redeploy is required for this phase.


### Phase 5.19 — Accessible UI Wayfinding + Performance View Distinction

- Adds grouped, color-coded top navigation for faster feature recognition.
- Adds Settings → Appearance → Visual Clarity mode for stronger outlines, larger labels, dyslexia-friendly typography, and lower cognitive load.
- Makes Stage Manager feel like a control console and Performance Mode feel like a dedicated live performer cockpit.
- No Supabase SQL migration or Edge Function redeploy is required.
