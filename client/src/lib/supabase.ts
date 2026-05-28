// ============================================================
// Maggie App — Supabase Client
// Cross-device sync for setlists, venues, and performance notes
// ============================================================

import { createClient } from "@supabase/supabase-js";

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
    // Strip gig_start_time — column doesn't exist in DB; stored in localStorage only
    const { gig_start_time: _drop, ...rest } = setlist;
    const { error } = await supabase
      .from("setlists")
      .upsert({ ...rest, user_id: userId }, { onConflict: "id" });
    if (error) throw error;
  },

  async update(id: string, data: Partial<Omit<SbSetlist, "id" | "user_id" | "created_at">>): Promise<void> {
    const userId = getDeviceId();
    // Strip gig_start_time — column doesn't exist in DB; stored in localStorage only
    const { gig_start_time: _drop, ...rest } = data;
    const { error } = await supabase
      .from("setlists")
      .update(rest)
      .eq("id", id)
      .eq("user_id", userId);
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
      .eq("setlist_id", setlistId);
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
  song_id: string | null;
  song_title: string;
  is_write_in?: boolean;
  status: "pending" | "approved" | "denied" | "alternative";
  created_at: string;
}

export const sbRequests = {
  /** Audience submits a known song request */
  async submit(songId: string, songTitle: string): Promise<void> {
    await supabase.from("song_requests").insert({
      song_id: songId,
      song_title: songTitle,
      status: "pending",
      is_write_in: false,
    });
  },

  /** Audience or artist submits a write-in (song not in catalogue) */
  async submitWriteIn(songTitle: string): Promise<void> {
    const { error } = await supabase.from("song_requests").insert({
      song_id: null,
      song_title: songTitle,
      status: "pending",
      is_write_in: true,
    });
    if (error) throw new Error(error.message);
  },

  /** Same as submitWriteIn but returns raw result for caller error handling */
  async submitWriteInSafe(songTitle: string): Promise<{ error: any }> {
    return supabase.from("song_requests").insert({
      song_id: null,
      song_title: songTitle,
      status: "pending",
      is_write_in: true,
    });
  },

  async getPending(): Promise<SbRequest[]> {
    const { data } = await supabase
      .from("song_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    return (data ?? []) as SbRequest[];
  },

  /** Resolve a request and log the outcome permanently */
  async resolve(
    req: SbRequest,
    outcome: "approved" | "denied" | "alternative"
  ): Promise<void> {
    // Mark the live request as resolved
    await supabase.from("song_requests").update({ status: outcome }).eq("id", req.id);
    // Write to permanent log
    await supabase.from("request_log").insert({
      song_id: req.song_id ?? null,
      song_title: req.song_title,
      is_write_in: req.is_write_in ?? false,
      outcome,
      requested_at: req.created_at,
      resolved_at: new Date().toISOString(),
    });
  },

  /** Fetch full request history log */
  async getLog(): Promise<any[]> {
    const { data } = await supabase
      .from("request_log")
      .select("*")
      .order("requested_at", { ascending: false });
    return data ?? [];
  },

  async clearAll(): Promise<void> {
    await supabase.from("song_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000");
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
