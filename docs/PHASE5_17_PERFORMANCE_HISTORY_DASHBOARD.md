# Phase 5.17 — Performance History Dashboard

Phase 5.17 turns saved show recaps into a performer-facing history dashboard.

## Added

- New **History** navigation item.
- New `/history` route.
- Show recap timeline with completion, venue, notes, and per-song recap notes.
- Summary cards for shows logged, completion percentage, average music time, and requests handled.
- Song trends table showing plays, requests, skips, notes, and last-played date.
- Venue trends cards showing shows, average completion, music time, request counts, and crowd-favorite notes.
- Charts for completion trend and top songs.
- Filters by search text, venue, setlist, and date range.
- Performance history JSON export.
- Recap deletion with confirmation.

## Data source

This phase uses the show recaps saved by Phase 5.16. Those recaps are currently stored locally on the device and included in full Backup Export. The dashboard also reads Supabase songs, setlists, venues, performance notes, and request log data to enrich the local recaps.

## Notes

- No Supabase SQL migration is required.
- No Edge Function redeploy is required.
- The History page is lazy-loaded so Recharts does not increase the initial app bundle.
- A later phase can move show recaps to Supabase if cross-device show-history sync becomes important.
