# Phase 5.18B.1 — Print Setup Sheet Fix

This hotfix repairs the Gear setup-sheet print flow.

## Fixed

- Removed the `noopener` flag from the generated print window so the app can safely write the setup-sheet HTML into the new window.
- Added a short render delay before calling `print()` to avoid blank `about:blank` windows in Chrome/Safari.
- Added a popup-blocker fallback message if the print window cannot be opened.

## Validation

- `npm run check`
- `npm run build:gh`

No Supabase SQL migration or Edge Function redeploy is required.
