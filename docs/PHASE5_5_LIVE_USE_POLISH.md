# Phase 5.5 — Live-Use UX Polish

This phase intentionally avoids authentication/database ownership changes and focuses on aesthetic and functional improvements for actual gig use.

## Included changes

- Stage Manager rows have larger touch targets for Done, Skip, Undo, Note, Details, and Sheet.
- Stage Manager adds a Focus toggle for lower-distraction, larger rows during performance.
- Next Up is more prominent and includes larger Done, Skip, and Sheet actions.
- Audience cards now use an explicit Request button rather than relying on whole-row tapping.
- Audience request submissions show a Sending state and clearer confirmation copy.
- Fullscreen PDF viewer remembers the last page per PDF and adds a Fit page / Fit width toggle.
- Setlists can be duplicated from the setlist card.

## Testing checklist

1. Open Stage on phone/tablet width and confirm controls are easy to tap.
2. Toggle Focus mode and confirm the row layout remains usable.
3. Open a multi-page PDF, change pages, close it, reopen it, and confirm it returns to the last page.
4. Toggle Fit page / Fit width in the PDF viewer.
5. Open an audience link and confirm the explicit Request button submits successfully.
6. Duplicate a setlist and confirm the copy has its own audience link.

## Not included

- Supabase Auth or commercial user tenancy.
- Private PDF signed URLs.
- Database schema changes.
