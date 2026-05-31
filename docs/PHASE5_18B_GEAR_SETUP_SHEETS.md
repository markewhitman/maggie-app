# Phase 5.18B — Gear Setup Sheets + Pack Checklist

This phase extends the Gear dashboard from basic gear/preset memory into a practical show-prep tool.

## Added

- Venue setup sheets from saved gear presets.
- Printable setup sheets with venue notes, gear checklist, default setup, and control settings.
- Copyable plain-text setup sheets for notes/messages.
- Per-venue pack checklist state saved locally on the device.
- Default setup preset per venue.
- Copy preset to another venue / any-venue preset.
- Backup/export now includes gear defaults and pack checklist state through the existing gear export.

## Notes

- Gear data remains local-first in browser storage for this phase.
- Setup sheets print metadata/settings only. They do not include gear photos or PDF files.
- Pack checklist checkmarks are device-local and intended as a practical pre-show packing aid.
- Default venue setups are saved locally and included in app backup exports.

## Recommended test

1. Create two gear items.
2. Create presets for a venue.
3. Mark one preset as the venue default.
4. Open the venue setup sheet.
5. Check off gear in the pack checklist.
6. Copy the setup sheet.
7. Print the setup sheet.
8. Copy a preset to another venue.
9. Export a backup and confirm gear defaults/checklists are included.
