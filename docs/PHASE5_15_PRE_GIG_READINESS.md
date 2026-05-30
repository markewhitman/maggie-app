# Phase 5.15 — Pre-Gig Readiness + Set Confidence

This phase adds a performer-facing readiness check before a set is loaded for performance and from the active Stage session.

## Added

- Set confidence score for each setlist.
- Readiness badge on setlist cards:
  - Ready for tonight
  - Needs prep
  - Not ready
- Load Tonight now opens a readiness dialog before loading Stage.
- Stage has a Ready button for checking the active set at any time.
- Readiness checks include:
  - missing songs from the library
  - duplicate songs
  - missing PDFs
  - missing song durations
  - songs tagged `needs-review`
  - missing key information
  - missing chord cues
  - missing gig date
  - missing start time
  - audience QR/link state
  - backup freshness
- Readiness dialog includes an Export Backup action.
- Backup export now records the last backup time in local device preferences so readiness can warn when backups are stale.

## Notes

No Supabase SQL migration is required for this phase. Backup freshness is tracked per device in localStorage.

## Test checklist

1. Open Setlists and confirm each card shows a readiness badge.
2. Click Load Tonight and confirm the readiness dialog appears.
3. Confirm the dialog shows runtime, PDF count, audience QR state, and backup state.
4. Export a backup from the readiness dialog and confirm the backup warning updates.
5. Load a set from the dialog and confirm Stage opens/updates normally.
6. In Stage, click Ready and confirm the same active-set readiness view appears.
