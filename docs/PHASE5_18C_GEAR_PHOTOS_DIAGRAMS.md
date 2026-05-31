# Phase 5.18C — Gear Photos + Setup Diagrams

This phase extends the Gear dashboard with practical venue setup memory for performers.

## Added

- Gear item photos stored locally as compressed data URLs.
- Setup preset photos stored locally as compressed data URLs.
- Simple top-down setup diagrams linked to venues.
- Diagram objects for performer, microphone, speaker, monitor, mixer, pedalboard, amp, power, stand, and other items.
- Drag-to-position diagram editor with editable labels and rotation.
- Default diagram per venue.
- Venue setup cards show the default diagram.
- Setup sheets include default diagrams, gear photos, preset photos, pack checklist, and settings.
- Backup export includes gear photos and diagram data through the existing gear export payload.

## Notes

Photos are stored in browser localStorage as compressed images. This keeps the phase simple and avoids new database/storage migrations, but very large or numerous photos can eventually hit browser storage limits. Future commercial hardening should move gear/setup photos to Supabase Storage.

Setup diagrams are saved as lightweight JSON layout data and are safe to include in backup exports.

## Test checklist

1. Open Gear.
2. Add or edit a gear item and attach a photo.
3. Add or edit a setup preset and attach a setup photo.
4. Create a venue setup diagram.
5. Drag objects into place and rename/rotate them.
6. Mark one diagram as the default for the venue.
7. Confirm the Venue setups tab shows the default diagram.
8. Open the setup sheet and confirm photos/diagram appear.
9. Print the setup sheet and confirm the diagram/photo layout is readable.
10. Export a backup and confirm gear data is included.
