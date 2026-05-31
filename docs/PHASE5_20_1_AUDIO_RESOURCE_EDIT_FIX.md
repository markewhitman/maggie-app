# Phase 5.20.1 — Audio Resource Edit Fix

## Summary

This hotfix corrects the Song Detail edit form so adding a new recording or backing-track link creates an editable row immediately.

## Fixed

- The **+ Original** and **+ Backing** buttons in the Song Detail edit tab now add visible draft audio-resource rows.
- Empty draft audio links are preserved while editing instead of being filtered out before the user can paste a URL.
- On save, blank draft rows are still ignored, while completed links are normalized and saved.
- URL validation remains in place for non-empty links.

## Validation

- `npm run check`
- `npm run build:gh`
