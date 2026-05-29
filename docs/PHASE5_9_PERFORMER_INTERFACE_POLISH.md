# Phase 5.9 — Performer Interface Polish

This phase focuses on the live performer interface, especially the Stage Manager timing display and app appearance controls.

## Stage Manager timing improvements

The earlier timing columns were compact and could feel misaligned with their headings. Phase 5.9 replaces that with larger, self-labeled timing tiles.

Timing options now read as performer-facing cues:

- **Song length** — estimated duration for the song
- **Set elapsed** — projected elapsed time by the end of that song
- **Start time** — projected wall-clock start time for that song when a set start time is entered

The Stage Manager header now has larger timing cards for:

- Played time
- Remaining time
- Set start time
- Projected end time

The Next Up card also shows larger timing cues for the next song.

## Appearance and palettes

Settings now includes an Appearance section with:

- Light mode
- Dark mode
- Multiple color palettes

Available palettes:

- Maggie Gold
- Stage Light
- Rosewood
- Sage Folk
- Ocean Blue
- Violet Hour

The selected mode and palette are stored locally on the device and applied immediately across the app.

## Notes

No Supabase migration is required for this phase. Appearance preferences are local device preferences, which is intentional for stage use because an iPad can use a high-contrast palette while a laptop can use a lighter planning palette.
