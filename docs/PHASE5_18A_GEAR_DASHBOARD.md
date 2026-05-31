# Phase 5.18A — Gear Dashboard + Venue Setup Memory

This phase adds a performer-focused gear dashboard for cataloging equipment and remembering settings that work for different venues and situations.

## Added

- New **Gear** navigation item and `/gear` route.
- Gear library for guitars, amps, pedals, vocal processors, PA speakers, mixers, monitors, microphones, DI/interface gear, lighting, and miscellaneous items.
- Setup presets for each gear item.
- Optional venue association for presets.
- Situation labels such as patio, ceremony, loud room, small indoor bar, outdoor setup, etc.
- Visual control graphics for:
  - dials / knobs
  - sliders
  - toggles
- Venue setup view that groups saved presets by venue.
- Gear setup memory included in backup export.

## Storage model

This first gear pass stores gear items and setup presets in browser localStorage:

- `maggie_gear_items_v1`
- `maggie_gear_presets_v1`

This keeps the feature low-risk and fast to iterate. The backup export includes this data. A later phase can move gear data to Supabase if cross-device gear sync becomes important.

## Intended use

The Gear page is meant to help the performer remember:

- what to bring
- what settings worked
- what to change next time
- which setup belongs to which venue
- mixer, speaker, pedal, amp, and vocal processor positions

The graphics are intentionally simple and readable rather than photorealistic.
