# Phase 5.8 — Performance PDF Viewer

This phase focuses on the performer-facing sheet music experience.

## Added

- **Page / Scroll viewer modes**
  - Page mode keeps the prior tap-zone performance behavior.
  - Scroll mode supports continuous vertical PDF scrolling, closer to Files/Preview-style reading.

- **Swipe page turning**
  - In Page mode, swiping left/right turns pages in addition to the existing tap zones and keyboard arrows.

- **Annotation mode**
  - Toggle **Notes** in the PDF viewer.
  - Draw with touch, Apple Pencil, mouse, or trackpad.
  - Supports pen, eraser, undo, clear current page, colors, and stroke thickness.

- **Supabase annotation sync**
  - Notes are stored in `public.pdf_annotations` as JSON overlay strokes.
  - The source PDF file remains unchanged.
  - Reopening the same PDF restores the annotation overlay.

- **Backup export update**
  - Backup JSON now includes annotation overlay data.
  - PDF binaries are still not included in backups.

## Supabase migration required

Apply:

```text
supabase/migrations/20260528_phase5_8_performance_pdf_viewer.sql
```

Until this migration is applied, the PDF viewer still works, but annotation saving will show an unavailable/save-error message.

## Intentional choices

- The app does **not** permanently modify the PDF file yet.
- Annotation overlays are safer because they can be erased, replaced, exported later, or rendered on top of a private PDF without rewriting the binary file.
- Animated page-curl effects were intentionally deferred. Reliable tap/swipe page turns are better for live performance than decorative animation.

## Future optional enhancements

- Two-page spread in iPad landscape.
- Export annotated PDF.
- Per-song preferred view mode.
- Apple Pencil pressure sensitivity where supported.
