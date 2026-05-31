import type { Song, SongAudioResource } from "./data";

export const AUDIO_RESOURCE_TYPES: { value: SongAudioResource["type"]; label: string; description: string }[] = [
  { value: "original", label: "Original recording", description: "Official or reference recording for practice" },
  { value: "backing", label: "Backing track", description: "Track to rehearse or perform along with" },
  { value: "practice", label: "Practice aid", description: "Lesson, tutorial, rehearsal loop, or tempo track" },
  { value: "reference", label: "Reference", description: "Alternate version, live version, or arrangement example" },
  { value: "other", label: "Other audio", description: "Any other useful audio link" },
];

export function audioTypeLabel(type?: SongAudioResource["type"]): string {
  return AUDIO_RESOURCE_TYPES.find((item) => item.value === type)?.label ?? "Audio";
}

export function audioTypeShortLabel(type?: SongAudioResource["type"]): string {
  if (type === "original") return "Original";
  if (type === "backing") return "Backing";
  if (type === "practice") return "Practice";
  if (type === "reference") return "Reference";
  return "Audio";
}

export function audioTypeTone(type?: SongAudioResource["type"]): string {
  if (type === "original") return "border-sky-300/60 bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200";
  if (type === "backing") return "border-violet-300/60 bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200";
  if (type === "practice") return "border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  if (type === "reference") return "border-amber-300/60 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
  return "border-border bg-muted/70 text-foreground";
}

export function detectAudioProvider(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "YouTube";
    if (host.includes("spotify.com")) return "Spotify";
    if (host.includes("music.apple.com") || host.includes("itunes.apple.com")) return "Apple Music";
    if (host.includes("soundcloud.com")) return "SoundCloud";
    if (host.includes("bandcamp.com")) return "Bandcamp";
    if (host.includes("dropbox.com")) return "Dropbox";
    if (host.includes("drive.google.com")) return "Google Drive";
    return host.split(".").slice(-2, -1)[0]?.replace(/^./, (c) => c.toUpperCase()) || "Link";
  } catch {
    return "Link";
  }
}

export function isValidAudioUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function createAudioResource(input: {
  type: SongAudioResource["type"];
  url: string;
  label?: string;
  notes?: string;
}): SongAudioResource {
  const cleanUrl = input.url.trim();
  const label = input.label?.trim() || audioTypeLabel(input.type);
  return {
    id: `audio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: input.type,
    label,
    url: cleanUrl,
    provider: detectAudioProvider(cleanUrl),
    notes: input.notes?.trim() || undefined,
  };
}

export function normalizeAudioResources(resources?: SongAudioResource[] | null): SongAudioResource[] {
  if (!Array.isArray(resources)) return [];
  return resources
    .map((resource) => {
      const url = String(resource?.url ?? "").trim();
      if (!url) return null;
      const type = resource.type || "reference";
      return {
        id: resource.id || `audio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        label: resource.label?.trim() || audioTypeLabel(type),
        url,
        provider: resource.provider?.trim() || detectAudioProvider(url),
        notes: resource.notes?.trim() || undefined,
      } satisfies SongAudioResource;
    })
    .filter(Boolean) as SongAudioResource[];
}

export function getPrimaryAudioResource(song: Pick<Song, "audioResources">, prefer: SongAudioResource["type"] = "backing"): SongAudioResource | null {
  const resources = normalizeAudioResources(song.audioResources);
  return resources.find((resource) => resource.type === prefer)
    ?? resources.find((resource) => resource.type === "original")
    ?? resources.find((resource) => resource.type === "practice")
    ?? resources[0]
    ?? null;
}

export function openAudioResource(resource: SongAudioResource | null | undefined): boolean {
  if (!resource?.url || typeof window === "undefined") return false;
  window.open(resource.url, "_blank", "noopener,noreferrer");
  return true;
}
