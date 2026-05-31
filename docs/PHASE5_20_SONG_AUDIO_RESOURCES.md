# Phase 5.20 — Song Audio Resources

Adds URL-based audio resources to song cards so the performer can connect each song to the original recording, backing tracks, practice references, or other useful audio links.

## Included

- Adds `audioResources` to song metadata.
- Adds Supabase `songs.audio_resources` JSONB column.
- Add Song supports optional original recording and backing track URLs.
- Song Detail has a dedicated **Audio** tab.
- Edit tab supports multiple audio resources with type, label, URL, and notes.
- Song cards show an audio chip when a song has a recording/backing link.
- Performance Mode adds a **Track** button for the current song.
- Keyboard shortcut `T` opens the current song's preferred backing/original audio resource.

## Audio resource types

- Original recording
- Backing track
- Practice aid
- Reference
- Other audio

## Notes

This phase links to external audio resources. It does not upload or host audio files. Good sources include YouTube, Spotify, Apple Music, SoundCloud, Dropbox, Google Drive, or a direct hosted MP3 link.

## Required Supabase migration

Run:

```sql
supabase/migrations/20260531_phase5_20_song_audio_resources.sql
```

The app has a fallback path if the column is missing, but cloud syncing for audio resources requires this migration.
