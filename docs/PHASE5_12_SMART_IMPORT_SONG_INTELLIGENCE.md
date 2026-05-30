# Phase 5.12 — Smart Import + Song Card Intelligence Polish

Phase 5.12 refines the Phase 5.11 Smart PDF Import workflow and adds clearer song-card readiness cues.

## Smart PDF Import improvements

- Added an import-confidence summary: High, Medium, or Low.
- Added a missing-essentials checklist during import review:
  - Title
  - Artist
  - Key
  - Capo
  - Chords
  - Duration
  - PDF
- Added detected-chord preview chips so the performer can quickly confirm whether the parser found useful chords.
- Improved key/capo detection from both PDF text and filenames.
- Improved duration detection from labels and simple `m:ss` values.
- Added broader tag inference for scanned PDFs, acoustic charts, tabs, duets, and male/female vocal hints.
- Imported PDFs now keep `imported-from-pdf` and `needs-review` tags unless the performer removes them later.

## Song card readiness

Song cards now surface performance-readiness information directly in the library:

- `Ready` badge when core information is present.
- `Review` badge for smart-imported songs that should be checked.
- `Incomplete` badge when key/chords or other important fields are missing.
- Small issue chips such as Add key, Add chords, Add time, No PDF, and Review import.

## Song Library filters

- Added a `Needs review` quick stat/filter card.
- Added a `Needs review` filter chip inside the filter panel.
- Search placeholder now clarifies that key and chord text are searchable.

## Notes

No Supabase SQL migration is required for Phase 5.12.

The review status is stored using normal song tags, especially `needs-review` and `imported-from-pdf`, so the feature remains compatible with the existing cloud songs table.
