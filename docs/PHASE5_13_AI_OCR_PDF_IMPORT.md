# Phase 5.13 — AI/OCR PDF Song Import + Duration Resolver

This phase adds an optional AI/OCR enhancement path to Smart PDF Import.

## What it does

When a PDF is attached in **Add Song**, the browser still performs the existing private/local PDF text scan first. If the PDF is scanned or image-only, the app can now call a Supabase Edge Function named `analyze-song-pdf` to analyze the PDF with a vision-capable AI model.

The AI/OCR function suggests:

- title
- artist
- key
- capo
- chords
- strumming pattern
- tempo/BPM
- duration
- genre, mood, energy, vocal style
- tags
- stage/performance note
- review warnings

The original PDF is not modified. Suggestions remain editable and must be reviewed before saving.

## Duration resolver

If a running time is not printed in the PDF, the Edge Function attempts a tiered duration resolution:

1. Use a visibly printed duration from the chart when available.
2. Use music metadata lookup by title and artist through Apple/iTunes Search and MusicBrainz.
3. Fall back to an AI estimate based on tempo, chart structure, repeats, page length, and chord/lyric density.
4. Leave the field for manual entry if confidence is too low.

The app labels the duration source in the review panel/toast where possible.

## Required Supabase setup

This phase adds an Edge Function, not a database migration.

Deploy the function from the project root:

```powershell
supabase login
supabase link --project-ref bephofcynjspsulmuikh
supabase secrets set OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
supabase secrets set OPENAI_MODEL="gpt-4.1-mini"
supabase functions deploy analyze-song-pdf
```

`OPENAI_MODEL` is optional. If omitted, the function defaults to `gpt-4.1-mini`.

## Notes

- The app still works without the Edge Function; it simply falls back to filename/selectable-text import.
- The AI/OCR path currently rejects PDFs larger than roughly 12 MB for request-size/cost control.
- Do not put an OpenAI API key in the browser app. Keep it in Supabase secrets only.
- This is a review-before-save workflow. The performer should confirm any AI suggestions before using them on stage.
