# Phase 5.7 — Song Library and Add/Edit Workflow Polish

This phase focuses on day-to-day song management rather than schema/security changes.

## What changed

### Song Library

- Added quick filter statistic cards for:
  - songs with PDFs
  - custom/user-added songs
  - songs missing duration metadata
- Added sort controls:
  - library order
  - title A-Z
  - artist A-Z
  - newest first
  - shortest first
- Search now also checks key and chord text, not just title/artist/tags.
- Active filter chips now include search and quick-filter state.
- The filter drawer now includes quick filters for Has PDF, Needs PDF, Custom, and Missing duration.

### Song cards

- Improved list mode for mobile scanning.
- Made PDF, custom song, capo, key, genre, and duration indicators clearer.
- Avoided nested clickable buttons inside song-card buttons.
- Grid cards now show a clearer Sheet PDF / No PDF indicator.

### Add Song workflow

- Reworked Add Song into clearer sections:
  - Identity
  - Live essentials
  - Findability
  - Resources and stage note
- Added duplicate-title and duplicate-title/artist warnings.
- Exact title + artist duplicates are blocked to prevent accidental duplicate records.
- Added duration entry in `m:ss` format.
- Added energy and vocal-style fields so new songs work better with existing filters.
- Added quick capo chips for common values.
- Added basic Ultimate Guitar URL validation.
- Improved PDF attachment feedback, including size display and upload-on-save copy.
- Added a simple completion badge in the modal header.

### Song detail

- Cleaned up the song detail header with custom/PDF/difficulty badges.
- Reorganized Details into clearer stage-summary and metadata sections.
- Added direct sheet-music and Ultimate Guitar actions from the Details tab when available.

## Validation

Validated with:

```bash
npm run check
npm run build:gh
```

No Supabase SQL migration is required for this phase.
