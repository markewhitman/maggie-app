# Phase 5.11 — Smart PDF Song Import

This phase improves the performer song-import workflow by reading a newly attached PDF and suggesting song-card metadata before the song is saved.

## What changed

- The Add Song modal now runs a Smart PDF Import pass when a PDF is selected.
- The importer reads:
  - the PDF filename
  - selectable text embedded in the first few pages of the PDF
- It suggests editable fields such as:
  - title
  - artist
  - key
  - capo
  - chords
  - strumming pattern
  - tempo
  - duration, when explicitly printed in the PDF
  - source URL, when present
  - tags
  - a short stage note
- Blank form fields are filled automatically when confidence is reasonable.
- The performer can use **Fill blanks** or **Apply all** from the Smart PDF Import review panel.

## Privacy and reliability notes

- The importer runs in the browser.
- The PDF text is not sent to an AI service.
- The original PDF file is not modified.
- Scanned/image-only PDFs cannot be read without OCR, so the app falls back to filename-based suggestions.
- All detected values remain editable before saving.

## No database migration required

No Supabase SQL migration is required for this phase. The final song record and PDF upload continue to use the existing cloud song and PDF storage paths.
