# Phase 5.10 — Performance Mode and Audience Request Polish

This phase focuses on performer-facing reliability during a gig and clearer audience request sharing.

## Performer interface

- Added a dedicated **Performance** view from Stage Manager.
- Shows a simplified full-screen performance surface with:
  - current/next song
  - artist, key, capo, and chord cues
  - played time, remaining time, set start, and projected end
  - large Sheet, Note, Skip, Done, Requests, and Set controls
  - an emergency full-set fallback drawer
- Existing Stage Manager remains available for detailed editing/reordering.

## Audience request sharing

- Replaced copy-only audience link behavior with a reusable **Audience Request QR** dialog.
- Setlist cards now open a QR modal instead of only copying the link.
- Stage Manager now has an **Audience QR** button for the currently loaded set.
- The QR modal includes:
  - setlist name
  - date/start metadata when available
  - song count
  - scannable QR code
  - copy/share/preview actions

## Audience page clarity

- Audience request pages now clearly show which set the guest is requesting for.
- If the link resolves to a setlist, guests see the set name, date/start time, and song count.
- Added a **Tonight’s set / All songs** toggle when a specific setlist is available.
- Requests remain scoped to the QR/link the guest opened.

## Database changes

No Supabase SQL migration is required for this phase.
