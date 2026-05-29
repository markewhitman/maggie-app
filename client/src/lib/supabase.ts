// ============================================================
// Maggie App — Supabase Client
// Cross-device sync for setlists, venues, requests, PDFs, and performance notes
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { SEED_SONGS, songsStore, type Song } from "./data";

const SUPABASE_URL = "https://bephofcynjspsulmuikh.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlcGhvZmN5bmpzcHN1bG11aWtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NTQxNDksImV4cCI6MjA5NTIzMDE0OX0.pEgo93W2IRoIaQromvPu0EudmTaMV9y4YYjdDXSHwjo";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Shared User ID ───────────────────────────────────────
// All devices (phone, laptop, tablet) share a single fixed ID so that
// setlists, venues, and session data sync seamlessly across all of them.
// This is a personal single-user app — one identity for all devices.

const SHARED_USER_ID = "maggie-whitman-app-2026";

export function getDeviceId(): string {
  return SHARED_USER_ID;
}

function isMissingColumnError(error: any): boolean {
  const message = String(error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST204" ||
    error?.code === "42703" ||
    message.includes("could not find") ||
    message.includes("schema cache") ||
    message.includes("column")
  );
}

// ─── Types (Supabase row shapes) ──────────────────────────

export interface SbSetlist {
  id: string;
  user_id: string;
  name: string;
  gig_date: string | null;
  gig_start_time: string | null;  // "HH:MM" 24h, stored if column exists
  venue_id: string | null;
  song_ids: string[];
  created_at: string;
}

export interface SbVenue {
  id: string;
  user_id: string;
  name: string;
  city: string | null;
  notes: string | null;
  gig_count: number;
  created_at: string;
}

export interface SbPerfNote {
  id: string;
  user_id: string;
  setlist_id: string;
  song_id: string;
  gig_date: string | null;
  crowd_reaction: number;
  tempo_feel: string;
  lyrics_confidence: string;
  notes: string;
  created_at: string;
}

export interface SbActiveSession {
  user_id: string;
  setlist_id: string;
  ordered_song_ids: string[];
  played_ids: string[];
  skipped_ids: string[];
  updated_at: string;
}

export interface SbSong {
  id: string;
  user_id: string;
  title: string;
  artist: string;
  year: number;
  song_key: string;
  capo: string;
  chords: string;
  strumming: string;
  guitar_type: string;
  tempo: number;
  tempo_feel: string;
  mood: string;
  mood2: string | null;
  genre: string;
  genre2: string | null;
  decade: string | null;
  energy: string | null;
  vocal_style: string | null;
  similar: string[] | null;
  difficulty: string;
  tags: string[];
  performance_note: string;
  ultimate_guitar_url: string;
  set_position: number;
  duration: number | null;
  pdf_url: string | null;
  pdf_asset_id: number | null;
  pdf_filename: string | null;
  user_added: boolean;
  is_deleted: boolean;
  created_at?: string;
  updated_at?: string;
}

const LOCAL_SONG_MIGRATION_KEY = "maggie_songs_migrated_to_supabase_v1";

function songToSbSong(song: Song, userId = getDeviceId(), isDeleted = false): SbSong {
  return {
    id: song.id,
    user_id: userId,
    title: song.title,
    artist: song.artist,
    year: Number(song.year) || new Date().getFullYear(),
    song_key: song.key ?? "",
    capo: song.capo ?? "No capo",
    chords: song.chords ?? "",
    strumming: song.strumming ?? "",
    guitar_type: song.guitarType ?? "acoustic",
    tempo: Number(song.tempo) || 120,
    tempo_feel: song.tempoFeel ?? "Mid-Tempo",
    mood: song.mood ?? "",
    mood2: song.mood2 ?? null,
    genre: song.genre ?? "",
    genre2: song.genre2 ?? null,
    decade: song.decade ?? null,
    energy: song.energy ?? null,
    vocal_style: song.vocalStyle ?? null,
    similar: song.similar ?? null,
    difficulty: song.difficulty ?? "Intermediate",
    tags: Array.isArray(song.tags) ? song.tags : [],
    performance_note: song.performanceNote ?? "",
    ultimate_guitar_url: song.ultimateGuitarUrl ?? "",
    set_position: Number(song.setPosition) || 99,
    duration: song.duration ?? null,
    pdf_url: song.pdfUrl ?? null,
    pdf_asset_id: song.pdfAssetId ?? null,
    pdf_filename: song.pdfFilename ?? null,
    user_added: song.userAdded ?? !SEED_SONGS.some((s) => s.id === song.id),
    is_deleted: isDeleted,
  };
}

function sbSongToSong(row: SbSong): Song {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    year: row.year,
    key: row.song_key,
    capo: row.capo,
    chords: row.chords,
    strumming: row.strumming,
    guitarType: (row.guitar_type as Song["guitarType"]) || "acoustic",
    tempo: row.tempo,
    tempoFeel: row.tempo_feel,
    mood: row.mood,
    mood2: row.mood2 ?? undefined,
    genre: row.genre,
    genre2: row.genre2 ?? undefined,
    decade: row.decade ?? undefined,
    energy: (row.energy as Song["energy"]) ?? undefined,
    vocalStyle: (row.vocal_style as Song["vocalStyle"]) ?? undefined,
    similar: row.similar ?? undefined,
    difficulty: (row.difficulty as Song["difficulty"]) || "Intermediate",
    tags: row.tags ?? [],
    performanceNote: row.performance_note ?? "",
    ultimateGuitarUrl: row.ultimate_guitar_url ?? "",
    setPosition: row.set_position ?? 99,
    duration: row.duration ?? undefined,
    pdfUrl: row.pdf_url ?? undefined,
    pdfAssetId: row.pdf_asset_id ?? undefined,
    pdfFilename: row.pdf_filename ?? undefined,
    userAdded: row.user_added,
  };
}

function songDiffKey(song: Song): string {
  const { pdfUrl, pdfAssetId, pdfFilename, ...rest } = song;
  return JSON.stringify(rest);
}

function shouldMigrateLocalSong(song: Song): boolean {
  const seed = SEED_SONGS.find((s) => s.id === song.id);
  if (!seed) return true;
  if (song.userAdded) return true;
  return songDiffKey(song) !== songDiffKey(seed);
}

function sortCatalog(a: Song, b: Song): number {
  return (a.setPosition ?? 999) - (b.setPosition ?? 999) || a.title.localeCompare(b.title);
}

// ─── Songs ────────────────────────────────────────────────
// Built-in seed songs remain in the app bundle. User-added songs and edited
// seed-song overrides are stored in Supabase so the catalogue follows you
// across devices. Deleted built-in songs are represented as tombstones.

export const sbSongs = {
  async getRows(): Promise<SbSong[]> {
    const userId = getDeviceId();
    const { data, error } = await supabase
      .from("songs")
      .select("*")
      .eq("user_id", userId)
      .order("set_position", { ascending: true });
    if (error) throw error;
    return (data ?? []) as SbSong[];
  },

  async getCatalog(): Promise<Song[]> {
    await this.migrateLocalSongs();

    const [rows, pdfMap] = await Promise.all([
      this.getRows(),
      sbSongPdfs.getAll().catch(() => ({} as Record<string, { url: string; name: string }>)),
    ]);

    const map = new Map<string, Song>(SEED_SONGS.map((song) => [song.id, { ...song, tags: [...song.tags] }]));

    for (const row of rows) {
      if (row.is_deleted) {
        map.delete(row.id);
      } else {
        map.set(row.id, sbSongToSong(row));
      }
    }

    for (const [songId, pdf] of Object.entries(pdfMap)) {
      const song = map.get(songId);
      if (song) map.set(songId, { ...song, pdfUrl: pdf.url, pdfFilename: pdf.name, pdfAssetId: undefined });
    }

    return Array.from(map.values()).sort(sortCatalog);
  },

  async upsert(song: Song): Promise<void> {
    const userId = getDeviceId();
    const payload = songToSbSong(song, userId, false);
    const { error } = await supabase
      .from("songs")
      .upsert(payload, { onConflict: "id,user_id" });
    if (error) throw error;
  },

  async updatePdf(songId: string, pdfUrl: string, pdfFilename: string): Promise<void> {
    const song = (await this.getCatalog()).find((s) => s.id === songId);
    if (!song) return;
    await this.upsert({ ...song, pdfUrl, pdfFilename, pdfAssetId: undefined });
  },

  async removePdf(songId: string): Promise<void> {
    const song = (await this.getCatalog()).find((s) => s.id === songId);
    if (!song) return;
    const { pdfUrl: _url, pdfAssetId: _asset, pdfFilename: _name, ...rest } = song;
    await this.upsert(rest as Song);
  },

  async delete(songId: string): Promise<void> {
    const userId = getDeviceId();
    const seed = SEED_SONGS.find((s) => s.id === songId);
    if (seed) {
      const { error } = await supabase
        .from("songs")
        .upsert(songToSbSong(seed, userId, true), { onConflict: "id,user_id" });
      if (error) throw error;
      return;
    }

    const { error } = await supabase
      .from("songs")
      .delete()
      .eq("id", songId)
      .eq("user_id", userId);
    if (error) throw error;
  },

  async migrateLocalSongs(): Promise<void> {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(LOCAL_SONG_MIGRATION_KEY) === "true") return;

    try {
      const localSongs = songsStore.getAll();
      const toSync = localSongs.filter(shouldMigrateLocalSong);

      for (const song of toSync) {
        await this.upsert(song);
        if (song.pdfUrl) {
          await sbSongPdfs.save(song.id, song.pdfUrl, song.pdfFilename ?? "Sheet music.pdf");
        }
      }

      localStorage.setItem(LOCAL_SONG_MIGRATION_KEY, "true");
    } catch (err) {
      console.warn("Local song migration to Supabase was skipped", err);
    }
  },
};

// ─── Setlists ─────────────────────────────────────────────

export const sbSetlists = {
  async getAll(): Promise<SbSetlist[]> {
    const userId = getDeviceId();
    const { data, error } = await supabase
      .from("setlists")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async save(setlist: Omit<SbSetlist, "user_id">): Promise<void> {
    const userId = getDeviceId();
    const payload = { ...setlist, user_id: userId };
    const { error } = await supabase
      .from("setlists")
      .upsert(payload, { onConflict: "id" });

    // Backward-compatible fallback for older Supabase projects that do not yet
    // have the gig_start_time column. After applying the Phase 3 migration, the
    // first write path above will persist start time cross-device.
    if (error && isMissingColumnError(error) && "gig_start_time" in payload) {
      const { gig_start_time: _drop, ...legacyPayload } = payload;
      const retry = await supabase
        .from("setlists")
        .upsert(legacyPayload, { onConflict: "id" });
      if (retry.error) throw retry.error;
      return;
    }
    if (error) throw error;
  },

  async update(id: string, data: Partial<Omit<SbSetlist, "id" | "user_id" | "created_at">>): Promise<void> {
    const userId = getDeviceId();
    const { error } = await supabase
      .from("setlists")
      .update(data)
      .eq("id", id)
      .eq("user_id", userId);

    if (error && isMissingColumnError(error) && "gig_start_time" in data) {
      const { gig_start_time: _drop, ...legacyData } = data;
      const retry = await supabase
        .from("setlists")
        .update(legacyData)
        .eq("id", id)
        .eq("user_id", userId);
      if (retry.error) throw retry.error;
      return;
    }
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const userId = getDeviceId();
    const { error } = await supabase
      .from("setlists")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;
  },
};

// ─── Venues ───────────────────────────────────────────────

export const sbVenues = {
  async getAll(): Promise<SbVenue[]> {
    const userId = getDeviceId();
    const { data, error } = await supabase
      .from("venues")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async save(venue: Omit<SbVenue, "user_id">): Promise<void> {
    const userId = getDeviceId();
    const { error } = await supabase
      .from("venues")
      .upsert({ ...venue, user_id: userId }, { onConflict: "id" });
    if (error) throw error;
  },

  async update(venue: Omit<SbVenue, "user_id">): Promise<void> {
    const userId = getDeviceId();
    const { error } = await supabase
      .from("venues")
      .upsert({ ...venue, user_id: userId }, { onConflict: "id" });
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const userId = getDeviceId();
    const { error } = await supabase
      .from("venues")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;
  },

  async incrementGigCount(id: string): Promise<void> {
    const userId = getDeviceId();
    const { data } = await supabase
      .from("venues")
      .select("gig_count")
      .eq("id", id)
      .eq("user_id", userId)
      .single();
    if (data) {
      await supabase
        .from("venues")
        .update({ gig_count: data.gig_count + 1 })
        .eq("id", id)
        .eq("user_id", userId);
    }
  },
};

// ─── Performance Notes ────────────────────────────────────

export const sbPerfNotes = {
  async getAll(): Promise<SbPerfNote[]> {
    const userId = getDeviceId();
    const { data, error } = await supabase
      .from("perf_notes")
      .select("*")
      .eq("user_id", userId);
    if (error) throw error;
    return data ?? [];
  },

  async getForSetlist(setlistId: string): Promise<SbPerfNote[]> {
    const userId = getDeviceId();
    const { data, error } = await supabase
      .from("perf_notes")
      .select("*")
      .eq("user_id", userId)
      .eq("setlist_id", setlistId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getForSong(songId: string): Promise<SbPerfNote[]> {
    const userId = getDeviceId();
    const { data, error } = await supabase
      .from("perf_notes")
      .select("*")
      .eq("user_id", userId)
      .eq("song_id", songId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async upsert(note: Omit<SbPerfNote, "user_id">): Promise<void> {
    const userId = getDeviceId();
    const { error } = await supabase
      .from("perf_notes")
      .upsert({ ...note, user_id: userId }, { onConflict: "id" });
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const userId = getDeviceId();
    const { error } = await supabase
      .from("perf_notes")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;
  },
};

// ─── PDF Storage ─────────────────────────────────────────
// PDFs stored in Supabase Storage bucket "pdfs".
// Path: pdfs/<songId>/<filename>
// The bucket is public — URLs are stable and work without auth.

export const sbPdfs = {
  /** Upload a PDF for a song. Returns the public URL. */
  async upload(songId: string, file: File): Promise<string> {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${songId}/${safeName}`;

    // Remove any existing PDF for this song first
    await sbPdfs.deleteForSong(songId);

    const { error } = await supabase.storage
      .from("pdfs")
      .upload(path, file, { contentType: "application/pdf", upsert: true });

    if (error) throw error;

    const { data } = supabase.storage.from("pdfs").getPublicUrl(path);
    return data.publicUrl;
  },

  /** Delete all PDFs stored for a given song. */
  async deleteForSong(songId: string): Promise<void> {
    const { data } = await supabase.storage.from("pdfs").list(songId);
    if (data && data.length > 0) {
      const paths = data.map((f) => `${songId}/${f.name}`);
      await supabase.storage.from("pdfs").remove(paths);
    }
  },

  /** Delete a specific PDF by its full storage path. */
  async deleteByPath(path: string): Promise<void> {
    await supabase.storage.from("pdfs").remove([path]);
  },

  /** Extract the storage path from a Supabase public URL. */
  pathFromUrl(url: string): string | null {
    try {
      const u = new URL(url);
      // URL format: .../storage/v1/object/public/pdfs/<path>
      const match = u.pathname.match(/\/storage\/v1\/object\/public\/pdfs\/(.+)$/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  },
};

// ─── Song PDF URLs (cross-device sync) ────────────────────────
// Maps song_id -> pdf_url so every device knows which songs have PDFs.

export const sbSongPdfs = {
  async save(songId: string, pdfUrl: string, pdfName: string): Promise<void> {
    await supabase.from("song_pdfs").upsert(
      { song_id: songId, pdf_url: pdfUrl, pdf_name: pdfName, updated_at: new Date().toISOString() },
      { onConflict: "song_id" }
    );
  },
  async getAll(): Promise<Record<string, { url: string; name: string }>> {
    const { data } = await supabase.from("song_pdfs").select("song_id, pdf_url, pdf_name");
    const map: Record<string, { url: string; name: string }> = {};
    (data ?? []).forEach((r: any) => { map[r.song_id] = { url: r.pdf_url, name: r.pdf_name ?? "" }; });
    return map;
  },
  async remove(songId: string): Promise<void> {
    await supabase.from("song_pdfs").delete().eq("song_id", songId);
  },
};

// ─── Audience Song Requests ──────────────────────────────
// Audience taps “Request” → row inserted. Stage page polls and displays queue.

export interface SbRequest {
  id: string;
  gig_id?: string | null;
  song_id: string | null;
  song_title: string;
  is_write_in?: boolean;
  status: "pending" | "approved" | "denied" | "alternative";
  created_at: string;
}

async function insertRequestWithFallback(payload: Record<string, any>, gigId?: string | null): Promise<void> {
  const scopedPayload = gigId ? { ...payload, gig_id: gigId } : payload;
  const { error } = await supabase.from("song_requests").insert(scopedPayload);
  if (error && gigId && isMissingColumnError(error)) {
    const retry = await supabase.from("song_requests").insert(payload);
    if (retry.error) throw new Error(retry.error.message);
    return;
  }
  if (error) throw new Error(error.message);
}

async function insertRequestLogWithFallback(payload: Record<string, any>): Promise<void> {
  const { error } = await supabase.from("request_log").insert(payload);
  if (error && "gig_id" in payload && isMissingColumnError(error)) {
    const { gig_id: _drop, ...legacyPayload } = payload;
    await supabase.from("request_log").insert(legacyPayload);
  }
}

export const sbRequests = {
  /** Audience submits a known song request. gigId is usually the active setlist id. */
  async submit(songId: string, songTitle: string, gigId?: string | null): Promise<void> {
    await insertRequestWithFallback({
      song_id: songId,
      song_title: songTitle,
      status: "pending",
      is_write_in: false,
    }, gigId);
  },

  /** Audience or artist submits a write-in (song not in catalogue). */
  async submitWriteIn(songTitle: string, gigId?: string | null): Promise<void> {
    await insertRequestWithFallback({
      song_id: null,
      song_title: songTitle,
      status: "pending",
      is_write_in: true,
    }, gigId);
  },

  /** Same as submitWriteIn but returns raw result for caller error handling. */
  async submitWriteInSafe(songTitle: string, gigId?: string | null): Promise<{ error: any }> {
    const payload = {
      song_id: null,
      song_title: songTitle,
      status: "pending",
      is_write_in: true,
      ...(gigId ? { gig_id: gigId } : {}),
    };
    const result = await supabase.from("song_requests").insert(payload);
    if (result.error && gigId && isMissingColumnError(result.error)) {
      return supabase.from("song_requests").insert({
        song_id: null,
        song_title: songTitle,
        status: "pending",
        is_write_in: true,
      });
    }
    return { error: result.error };
  },

  async getPending(gigId?: string | null): Promise<SbRequest[]> {
    let query = supabase
      .from("song_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (gigId) query = query.eq("gig_id", gigId);

    const { data, error } = await query;
    if (error && gigId && isMissingColumnError(error)) {
      const fallback = await supabase
        .from("song_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      return (fallback.data ?? []) as SbRequest[];
    }
    return (data ?? []) as SbRequest[];
  },

  /** Resolve a request and log the outcome permanently. */
  async resolve(
    req: SbRequest,
    outcome: "approved" | "denied" | "alternative"
  ): Promise<void> {
    await supabase.from("song_requests").update({ status: outcome }).eq("id", req.id);
    await insertRequestLogWithFallback({
      gig_id: req.gig_id ?? null,
      song_id: req.song_id ?? null,
      song_title: req.song_title,
      is_write_in: req.is_write_in ?? false,
      outcome,
      requested_at: req.created_at,
      resolved_at: new Date().toISOString(),
    });
  },

  /** Fetch request history log, optionally scoped to one gig/setlist. */
  async getLog(gigId?: string | null): Promise<any[]> {
    let query = supabase
      .from("request_log")
      .select("*")
      .order("requested_at", { ascending: false });
    if (gigId) query = query.eq("gig_id", gigId);

    const { data, error } = await query;
    if (error && gigId && isMissingColumnError(error)) {
      const fallback = await supabase
        .from("request_log")
        .select("*")
        .order("requested_at", { ascending: false });
      return fallback.data ?? [];
    }
    return data ?? [];
  },

  async clearAll(gigId?: string | null): Promise<void> {
    let query = supabase.from("song_requests").delete().eq("status", "pending");
    if (gigId) query = query.eq("gig_id", gigId);

    const { error } = await query;
    if (error && gigId && isMissingColumnError(error)) {
      const retry = await supabase.from("song_requests").delete().eq("status", "pending");
      if (retry.error) throw new Error(retry.error.message);
      return;
    }
    if (error) throw new Error(error.message);
  },
};

// ─── Active Session ───────────────────────────────────────

export const sbSession = {
  async get(): Promise<SbActiveSession | null> {
    const userId = getDeviceId();
    const { data } = await supabase
      .from("active_sessions")
      .select("*")
      .eq("user_id", userId)
      .single();
    return data ?? null;
  },

  async save(session: Omit<SbActiveSession, "user_id" | "updated_at">): Promise<void> {
    const userId = getDeviceId();
    const { error } = await supabase
      .from("active_sessions")
      .upsert({ ...session, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw error;
  },

  async clear(): Promise<void> {
    const userId = getDeviceId();
    const { error } = await supabase
      .from("active_sessions")
      .delete()
      .eq("user_id", userId);
    if (error) throw error;
  },
};
