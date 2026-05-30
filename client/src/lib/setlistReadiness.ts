import type { Setlist, Song } from "./data";
import { formatDurationLong } from "./data";
import { getSongReadinessIssues, normalizeSongTags, songNeedsReview } from "./songReadiness";

export const LAST_BACKUP_EXPORT_KEY = "maggie_last_backup_export_at";
const DEFAULT_SONG_DURATION = 210;

export type ReadinessSeverity = "critical" | "warning" | "info";
export type ReadinessStatus = "ready" | "prep" | "risk";

export interface ReadinessIssue {
  key: string;
  title: string;
  description: string;
  severity: ReadinessSeverity;
  count?: number;
  songTitles?: string[];
  action?: string;
}

export interface SetlistReadinessSummary {
  status: ReadinessStatus;
  score: number;
  label: string;
  tone: "green" | "amber" | "red";
  totalSongs: number;
  resolvedSongs: Song[];
  missingSongIds: string[];
  totalRuntimeSeconds: number;
  estimatedSongs: number;
  duplicateSongTitles: string[];
  missingPdfSongs: Song[];
  missingDurationSongs: Song[];
  needsReviewSongs: Song[];
  missingKeySongs: Song[];
  missingChordSongs: Song[];
  backupLabel: string;
  backupAgeDays: number | null;
  issues: ReadinessIssue[];
}

function isBlank(value?: string | null): boolean {
  const cleaned = (value ?? "").trim().toLowerCase();
  return !cleaned || cleaned === "unknown" || cleaned === "unknown key" || cleaned === "n/a";
}

function firstTitles(songs: Song[], limit = 5): string[] {
  return songs.slice(0, limit).map((song) => song.title);
}

function getBackupAgeDays(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_BACKUP_EXPORT_KEY);
    if (!raw) return null;
    const last = new Date(raw).getTime();
    if (Number.isNaN(last)) return null;
    return Math.max(0, Math.floor((Date.now() - last) / 86_400_000));
  } catch {
    return null;
  }
}

export function markBackupExported(date = new Date()): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAST_BACKUP_EXPORT_KEY, date.toISOString());
  } catch {}
}

export function getBackupLabel(ageDays: number | null): string {
  if (ageDays === null) return "No backup recorded";
  if (ageDays === 0) return "Backed up today";
  if (ageDays === 1) return "Backed up yesterday";
  return `Backed up ${ageDays} days ago`;
}

function duplicateTitles(songIds: string[], songsById: Map<string, Song>): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const id of songIds) {
    if (seen.has(id)) {
      dupes.add(songsById.get(id)?.title ?? id);
    }
    seen.add(id);
  }
  return Array.from(dupes);
}

export function analyzeSetlistReadiness(setlist: Setlist, catalog: Song[]): SetlistReadinessSummary {
  const songsById = new Map(catalog.map((song) => [song.id, song]));
  const resolvedSongs = setlist.songIds
    .map((id) => songsById.get(id))
    .filter(Boolean) as Song[];
  const missingSongIds = setlist.songIds.filter((id) => !songsById.has(id));
  const duplicateSongTitles = duplicateTitles(setlist.songIds, songsById);
  const missingPdfSongs = resolvedSongs.filter((song) => !song.pdfUrl);
  const missingDurationSongs = resolvedSongs.filter((song) => !song.duration);
  const needsReviewSongs = resolvedSongs.filter(songNeedsReview);
  const missingKeySongs = resolvedSongs.filter((song) => isBlank(song.key));
  const missingChordSongs = resolvedSongs.filter((song) => isBlank(song.chords));
  const estimatedSongs = missingDurationSongs.length;
  const totalRuntimeSeconds = resolvedSongs.reduce(
    (sum, song) => sum + (song.duration ?? DEFAULT_SONG_DURATION),
    0,
  );
  const backupAgeDays = getBackupAgeDays();
  const issues: ReadinessIssue[] = [];

  if (resolvedSongs.length === 0) {
    issues.push({
      key: "empty-set",
      title: "No songs in this set",
      description: "Add songs before loading this for performance.",
      severity: "critical",
      action: "Open the setlist builder and add songs.",
    });
  }

  if (missingSongIds.length > 0) {
    issues.push({
      key: "missing-catalog-songs",
      title: "Some saved songs are missing from the library",
      description: "These entries may not appear correctly in Stage.",
      severity: "critical",
      count: missingSongIds.length,
      songTitles: missingSongIds.slice(0, 5),
      action: "Refresh the song library or re-add these songs to the setlist.",
    });
  }

  if (duplicateSongTitles.length > 0) {
    issues.push({
      key: "duplicate-songs",
      title: "Duplicate songs in set order",
      description: "Duplicates can make progress tracking harder during the show.",
      severity: "warning",
      count: duplicateSongTitles.length,
      songTitles: duplicateSongTitles.slice(0, 5),
      action: "Edit the setlist and remove duplicate entries unless intentional.",
    });
  }

  if (missingPdfSongs.length > 0) {
    issues.push({
      key: "missing-pdfs",
      title: "Songs without sheet PDFs",
      description: "These songs will not have one-tap sheet music in Stage.",
      severity: "warning",
      count: missingPdfSongs.length,
      songTitles: firstTitles(missingPdfSongs),
      action: "Attach PDFs to the songs you are least comfortable performing from memory.",
    });
  }

  if (needsReviewSongs.length > 0) {
    issues.push({
      key: "needs-review",
      title: "Imported songs need review",
      description: "These songs were imported or AI/OCR-filled and still need artist confirmation.",
      severity: "warning",
      count: needsReviewSongs.length,
      songTitles: firstTitles(needsReviewSongs),
      action: "Open each song card, verify the details, then remove the needs-review tag.",
    });
  }

  if (missingKeySongs.length > 0) {
    issues.push({
      key: "missing-key",
      title: "Songs missing key info",
      description: "Key/capo reminders are one of the highest-value stage cues.",
      severity: "warning",
      count: missingKeySongs.length,
      songTitles: firstTitles(missingKeySongs),
      action: "Add or confirm the performance key before the gig.",
    });
  }

  if (missingChordSongs.length > 0) {
    issues.push({
      key: "missing-chords",
      title: "Songs missing chord cues",
      description: "Stage and Performance Mode will have fewer quick-reference cues.",
      severity: "warning",
      count: missingChordSongs.length,
      songTitles: firstTitles(missingChordSongs),
      action: "Use Smart Import or manually add the main chord set.",
    });
  }

  if (missingDurationSongs.length > 0) {
    issues.push({
      key: "missing-duration",
      title: "Songs using estimated duration",
      description: `Runtime uses ${formatDurationLong(DEFAULT_SONG_DURATION)} for each missing duration.`,
      severity: "info",
      count: missingDurationSongs.length,
      songTitles: firstTitles(missingDurationSongs),
      action: "Add durations for more reliable projected end times.",
    });
  }

  if (!setlist.gigDate) {
    issues.push({
      key: "no-date",
      title: "No gig date set",
      description: "Adding a date makes the set easier to identify later in history and backups.",
      severity: "info",
      action: "Add the performance date when you know it.",
    });
  }

  if (!setlist.gigStartTime) {
    issues.push({
      key: "no-start-time",
      title: "No start time set",
      description: "Projected song start and end times need a planned start time.",
      severity: "info",
      action: "Set a start time before loading Stage.",
    });
  }

  if (!setlist.audienceSlug) {
    issues.push({
      key: "no-audience-link",
      title: "Audience QR link has not been generated",
      description: "The request QR works best when this set has its own unique link.",
      severity: "info",
      action: "Open Audience QR once to confirm the scoped link.",
    });
  }

  if (setlist.requestsEnabled === false) {
    issues.push({
      key: "requests-off",
      title: "Audience requests are off for this set",
      description: "Guests may not be able to request from the QR link.",
      severity: "warning",
      action: "Turn requests on before sharing the QR code.",
    });
  }

  if (backupAgeDays === null || backupAgeDays >= 14) {
    issues.push({
      key: "backup-stale",
      title: backupAgeDays === null ? "No backup recorded on this device" : "Backup is more than two weeks old",
      description: "A fresh backup protects the song library, notes, request history, and annotation data.",
      severity: "info",
      action: "Export a backup before major library edits or important gigs.",
    });
  }

  const criticalCount = issues.filter((issue) => issue.severity === "critical").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const infoCount = issues.filter((issue) => issue.severity === "info").length;
  const score = Math.max(0, Math.min(100, 100 - criticalCount * 30 - warningCount * 10 - infoCount * 3));
  const status: ReadinessStatus = criticalCount > 0 ? "risk" : warningCount > 0 ? "prep" : "ready";
  const label = status === "ready" ? "Ready for tonight" : status === "prep" ? "Needs prep" : "Not ready";
  const tone = status === "ready" ? "green" : status === "prep" ? "amber" : "red";

  return {
    status,
    score,
    label,
    tone,
    totalSongs: setlist.songIds.length,
    resolvedSongs,
    missingSongIds,
    totalRuntimeSeconds,
    estimatedSongs,
    duplicateSongTitles,
    missingPdfSongs,
    missingDurationSongs,
    needsReviewSongs,
    missingKeySongs,
    missingChordSongs,
    backupLabel: getBackupLabel(backupAgeDays),
    backupAgeDays,
    issues,
  };
}

export function readinessToneClasses(tone: SetlistReadinessSummary["tone"]): string {
  if (tone === "green") return "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300";
  if (tone === "amber") return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300";
  return "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300";
}
