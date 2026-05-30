# Phase 5.14.1 — Keyboard / Pedal Control Fixes

This patch fixes two live-use issues discovered during Phase 5.14 testing.

## Changes

- Stage and Performance Mode `U` shortcut now undoes the most recently completed or skipped song instead of trying to undo the current pending song.
- If there is nothing to undo, Maggie shows a clear toast instead of appearing unresponsive.
- In fullscreen PDF Scroll mode:
  - `ArrowDown` scrolls down a short distance.
  - `ArrowUp` scrolls up a short distance.
  - `PageDown` and `Space` scroll down by roughly one page.
  - `PageUp` scrolls up by roughly one page.
- Page mode keeps the original page-turn behavior for arrows, PageUp/PageDown, and Space.

## Deployment

No Supabase SQL migration and no Edge Function redeploy are required.
