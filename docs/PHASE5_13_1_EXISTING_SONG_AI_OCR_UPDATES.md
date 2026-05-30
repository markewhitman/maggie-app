# Phase 5.13.1 — Existing Song PDF AI/OCR Updates

This phase extends the Smart PDF Import / AI-OCR workflow beyond Add Song.

## What changed

- Existing song cards can now analyze attached PDFs from the **Sheet Music** tab.
- When a PDF is added or replaced on an existing song, the app scans it for song-card updates.
- Image-only/scanned PDFs can be enhanced with the existing Supabase Edge Function `analyze-song-pdf`.
- The review panel compares suggested values against the current song card.
- The performer can choose:
  - **Fill missing** — fills only blank/missing fields.
  - **Apply suggestions** — updates existing song-card fields from the PDF/AI suggestions.
  - **AI/OCR enhance** — sends the PDF to the Edge Function when deeper scan support is needed.
- Suggested performance notes are appended to existing notes instead of silently discarding existing performer notes.
- Applied updates are saved through `sbSongs.upsert`, so they sync through Supabase.

## Existing-song safety behavior

The Edge Function now receives the current song card as context. It should use that context to avoid changing title/artist/key/capo/etc. unless the PDF or metadata provides a supported suggestion. If the PDF looks like a different song, the AI should return a warning/review reason.

## Deployment note

Because this phase changes the Supabase Edge Function prompt/payload, redeploy the function after deploying the web app:

```powershell
npx supabase functions deploy analyze-song-pdf --project-ref bephofcynjspsulmuikh
```

No SQL migration is required.
