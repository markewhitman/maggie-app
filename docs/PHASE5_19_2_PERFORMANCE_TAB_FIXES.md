# Phase 5.19.2 — Performance Tab Flow Fixes

This refinement tightens the separation between the Stage Manager and Perform views.

## Changes

- Reordered the Live navigation to: **Perform | Manager | Audience**.
- The `/performance` route now stays in the dedicated live-performance view.
- Opening and closing sheet music from Perform returns to Perform instead of revealing the Manager view.
- Opening and closing performance notes from Perform returns to Perform instead of revealing the Manager view.
- Requests and Recap can open over the Perform view without switching out of it.
- The Perform view now shows the full setlist directly, with a compact scrollable list.
- Coming-up song cards are clickable and open the song card/details without switching into Manager.
- Full-set rows are clickable and open song details without exposing Manager controls.

## Validation

- `npm run check`
- `npm run build:gh`

No Supabase SQL migration or Edge Function redeploy is required.
