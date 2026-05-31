import { showRecapsStore } from "@/lib/data";
import { gearStore } from "@/lib/gear";
import { markBackupExported } from "@/lib/setlistReadiness";
import {
  getDeviceId,
  sbPdfAnnotations,
  sbPerfNotes,
  sbRequests,
  sbSession,
  sbSetlists,
  sbSongPdfs,
  sbSongs,
  sbVenues,
  supabase,
} from "@/lib/supabase";

export interface MaggieBackup {
  app: "maggie";
  backupVersion: 1;
  exportedAt: string;
  userId: string;
  tables: {
    songs: unknown[];
    setlists: unknown[];
    venues: unknown[];
    activeSession: unknown | null;
    performanceNotes: unknown[];
    songPdfs: Record<string, { url: string; name: string }>;
    pdfAnnotations: unknown[];
    pendingRequests: unknown[];
    requestLog: unknown[];
    showRecaps: unknown[];
    gear: unknown;
  };
  localPreferences: Record<string, unknown>;
  notes: string[];
}

function collectLocalPreferences(): Record<string, unknown> {
  const prefs: Record<string, unknown> = {};
  if (typeof window === "undefined") return prefs;

  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith("maggie_")) continue;

    try {
      const raw = localStorage.getItem(key);
      prefs[key] = raw ? JSON.parse(raw) : raw;
    } catch {
      prefs[key] = localStorage.getItem(key);
    }
  }

  return prefs;
}

async function getPendingRequestsSafely(): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("song_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("Backup skipped pending requests", error);
    return [];
  }
  return data ?? [];
}

export async function createMaggieBackup(): Promise<MaggieBackup> {
  const [songs, setlists, venues, activeSession, performanceNotes, songPdfs, pdfAnnotations, pendingRequests, requestLog] =
    await Promise.all([
      sbSongs.getCatalog(),
      sbSetlists.getAll(),
      sbVenues.getAll(),
      sbSession.get(),
      sbPerfNotes.getAll(),
      sbSongPdfs.getAll().catch(() => ({} as Record<string, { url: string; name: string }>)),
      sbPdfAnnotations.getAll().catch(() => []),
      getPendingRequestsSafely(),
      sbRequests.getLog().catch(() => []),
    ]);

  return {
    app: "maggie",
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    userId: getDeviceId(),
    tables: {
      songs,
      setlists,
      venues,
      activeSession,
      performanceNotes,
      songPdfs,
      pdfAnnotations,
      pendingRequests,
      requestLog,
      showRecaps: showRecapsStore.getAll(),
      gear: gearStore.exportAll(),
    },
    localPreferences: collectLocalPreferences(),
    notes: [
      "This backup exports metadata, public PDF URLs, annotation overlay data, locally saved show recaps, and gear setup memory, not PDF file binaries.",
      "Use Supabase Storage as the source of truth for uploaded PDF files.",
    ],
  };
}

export function downloadBackup(backup: MaggieBackup): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const filename = `maggie-backup-${stamp}.json`;
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  markBackupExported(new Date(backup.exportedAt));
  return filename;
}
