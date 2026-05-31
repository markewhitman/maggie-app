# Phase 5.16 — Performance Recap + Show Wrap-Up

Phase 5.16 adds a post-show workflow for capturing what happened during a set before the performer clears Stage.

## What changed

- Added a **Recap** button to Stage.
- Added a **Recap** control inside Performance Mode.
- Added a show recap dialog with:
  - completion percentage
  - played / skipped / pending counts
  - music time played
  - remaining planned music time
  - pending request count
  - overall post-show notes
  - crowd favorites
  - changes for next time
  - optional quick per-song notes
- Added a **Save recap** action.
- Added **Save recap & finish set**, which saves the recap and clears the active Stage session.
- Per-song recap notes are also saved into performance history as post-show performance notes.
- Show recaps are stored locally and included in future backup exports.

## Storage notes

Show recaps are currently a local reliability feature. They are saved under the local `maggie_show_recaps_v1` key and included in JSON backup exports.

This avoids adding database risk while testing the wrap-up workflow. A future phase can move show recaps into Supabase if cross-device show-history sync becomes important.

## Deployment

No Supabase SQL migration or Edge Function redeploy is required.

Use the normal frontend deployment flow:

```powershell
npm install
npm run check
npm run build:gh
git add .
git commit -m "Add performance recap and show wrap-up"
git push
npm run deploy
```

## Smoke test

1. Load a set into Stage.
2. Mark a few songs Done and Skip one song.
3. Open **Recap** from Stage.
4. Add overall notes and one per-song note.
5. Save the recap and confirm the active set remains loaded.
6. Open Recap again and choose **Save recap & finish set**.
7. Confirm Stage clears the active set.
8. Export a backup and confirm `showRecaps` is included.
