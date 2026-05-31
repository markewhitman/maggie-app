# Phase 5.19.1 — UI Accessibility Refinement

This hotfix/refinement pass responds to performer feedback from Phase 5.19.

## Changes

- Added a separate **Perform** route/tab for the streamlined live performance view.
- Retained **Manager** as the control-console view for requests, readiness, set editing, timing, keys, reset, and recap.
- Reworked the Stage Manager header layout so status/timing cards no longer compress or overlap with the action toolbar.
- Improved contrast in Performance Mode, especially timing tiles, chord blocks, key/capo labels, and secondary text.
- Restored full opacity on song cards and added stronger accessible focus/hover states.
- Reduced duplicated readiness chips on song cards by separating PDF/time status from general review issues.
- Added stronger visual status chips for PDF, missing PDF, time, and missing time.
- Improved Clear Cues behavior for song cards with more legible typography and stronger outlines.

## Testing

- `npm run check`
- `npm run build:gh`

No Supabase migration or Edge Function redeploy is required.
