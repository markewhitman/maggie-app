# Phase 5.14 — Pedal / Keyboard Performance Controls

Phase 5.14 adds performer-first keyboard and Bluetooth pedal controls for live use.

## What changed

- Stage Manager now responds to keyboard shortcuts when performance controls are enabled.
- Performance Mode now responds to the same shortcuts and includes an on-screen **Keys** reference.
- The fullscreen PDF viewer now supports common page-turner pedal commands:
  - Arrow right / PageDown / Space for next page
  - Arrow left / PageUp for previous page
  - F for fit page / fit width
  - V for page / scroll view
  - N for annotation mode
  - Z for undo last annotation stroke on the current page
- Settings now includes a **Performance Controls** card with an enable/disable toggle and shortcut reference.
- The Stage header and PDF viewer include shortcut help buttons.

## Why this matters

Most Bluetooth page-turn pedals emulate keyboard keys. By listening for common key events, Maggie can support many pedals without hardware-specific integrations.

## Stage shortcuts

| Shortcut | Action |
|---|---|
| D / Enter | Mark current song Done |
| S | Skip current song |
| U | Undo current song |
| M | Open sheet music |
| N | Open performance note |
| P | Open Performance Mode |
| R | Open audience requests |
| L | Show/hide full set in Performance Mode |
| ? | Show shortcuts |
| Esc | Close overlay |

## PDF shortcuts

| Shortcut | Action |
|---|---|
| Right Arrow / PageDown / Space | Next page |
| Left Arrow / PageUp | Previous page |
| F | Toggle Fit page / Fit width |
| V | Toggle Page / Scroll view |
| N | Toggle annotation mode |
| Z | Undo last note stroke on the current page |
| ? | Show shortcuts |
| Esc | Close PDF |

## Deployment

No Supabase SQL migration is required. Deploy the frontend normally:

```powershell
npm install
npm run check
npm run build:gh
git add .
git commit -m "Add pedal and keyboard performance controls"
git push
npm run deploy
```
