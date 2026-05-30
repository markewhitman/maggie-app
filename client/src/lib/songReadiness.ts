import type { Song } from "./data";

export interface SongReadinessIssue {
  key: string;
  label: string;
  severity: "warning" | "info";
}

export function normalizeSongTags(tags: Song["tags"]): string[] {
  if (Array.isArray(tags)) return tags;
  try {
    return JSON.parse((tags as any) ?? "[]");
  } catch {
    return [];
  }
}

export function songNeedsReview(song: Song): boolean {
  return normalizeSongTags(song.tags).some((tag) => tag.toLowerCase() === "needs-review");
}

export function getSongReadinessIssues(song: Song): SongReadinessIssue[] {
  const issues: SongReadinessIssue[] = [];
  const key = (song.key ?? "").trim().toLowerCase();
  const capo = (song.capo ?? "").trim().toLowerCase();
  if (!key || key === "unknown" || key === "unknown key") issues.push({ key: "key", label: "Add key", severity: "warning" });
  if (!capo) issues.push({ key: "capo", label: "Confirm capo", severity: "info" });
  if (!(song.chords ?? "").trim()) issues.push({ key: "chords", label: "Add chords", severity: "warning" });
  if (!song.duration) issues.push({ key: "duration", label: "Add time", severity: "info" });
  if (!song.pdfUrl) issues.push({ key: "pdf", label: "No PDF", severity: "info" });
  if (songNeedsReview(song)) issues.push({ key: "review", label: "Review import", severity: "warning" });
  return issues;
}

export function readinessLabel(song: Song): "Ready" | "Review" | "Incomplete" {
  const issues = getSongReadinessIssues(song);
  if (issues.some((issue) => issue.key === "review")) return "Review";
  if (issues.some((issue) => issue.severity === "warning")) return "Incomplete";
  return "Ready";
}
