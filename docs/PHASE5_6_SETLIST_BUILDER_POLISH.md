# Phase 5.6 — Setlist Builder Polish

This front-end pass improves setlist-building and active-session recovery without requiring a Supabase schema change.

## Improvements

### Setlist cards

- Saved setlists now show a more prominent estimated runtime directly on the collapsed card.
- Setlists with duplicate song ids show a visible duplicate-song warning.
- Expanded setlists explain which duplicated songs were detected.
- Expanded runtime rows now tolerate duplicate song ids without React key collisions.

### Builder dialog

- The selected order now has a compact summary panel for song count, estimated music time, and drag/reorder guidance.
- Selected songs display explicit position numbers next to the drag handle.
- The song picker no longer hides already-added songs; it marks them as **Added** instead.
- Clicking an already-added song shows a warning instead of silently doing nothing.
- Duplicate entries are blocked at save time to keep Stage progress tracking reliable.
- Existing duplicate entries can be cleaned up with a **Remove** action in the duplicate warning.
- A **Clear order** action lets the performer quickly rebuild a set from scratch.

### Stage Manager

- Added a **Reset** action when any songs are marked played or skipped.
- Reset clears the active Stage progress and marks every song as pending again without changing the saved setlist order.
- Reset uses the same confirmation-dialog pattern as other live-use actions.

## Validation

Completed locally:

```text
npm run check
npm run build:gh
```

No Supabase SQL migration is required for this phase.
