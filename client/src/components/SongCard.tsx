import type { Song } from "@/lib/data";
import { formatDuration } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock, FileText, Guitar, ListPlus, Music, UserPlus, Zap } from "lucide-react";
import { StrumPattern } from "@/components/StrumPattern";
import { getSongReadinessIssues, normalizeSongTags, readinessLabel, songNeedsReview } from "@/lib/songReadiness";

interface SongCardProps {
  song: Song;
  onClick: () => void;
  compact?: boolean;
  index?: number;
  onAddToSetlist?: () => void;
}

const DIFFICULTY_COLOR = {
  Beginner: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  Intermediate: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Advanced: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const TEMPO_ICON = {
  Ballad: "🎵",
  "Mid-Tempo": "🎶",
  Driving: "⚡",
  "Up-Tempo": "🔥",
  Upbeat: "🔥",
};

function capoLabel(capo?: string): string {
  if (!capo || capo === "No capo") return "No Capo";
  const fret = capo.match(/\d+/)?.[0];
  return fret ? `Capo ${fret}` : capo;
}

export function SongCard({ song, onClick, compact = false, onAddToSetlist }: SongCardProps) {
  const tags = normalizeSongTags(song.tags);
  const readiness = readinessLabel(song);
  const issues = getSongReadinessIssues(song);
  const needsReview = songNeedsReview(song);
  const displayIssues = issues.filter((issue) => !["pdf", "duration"].includes(issue.key));
  const diffClass = DIFFICULTY_COLOR[song.difficulty as keyof typeof DIFFICULTY_COLOR] ?? DIFFICULTY_COLOR.Intermediate;
  const tempoIcon = TEMPO_ICON[song.tempoFeel as keyof typeof TEMPO_ICON] ?? "🎵";
  const hasCapo = song.capo && song.capo !== "No capo";

  if (compact) {
    return (
      <div
        data-testid={`card-song-${song.id}`}
        className="song-card song-card-accessible w-full rounded-xl border border-border bg-card hover:border-primary/40 transition-colors overflow-hidden"
      >
        <div className="flex items-stretch gap-1">
          <button onClick={onClick} className="flex-1 min-w-0 px-3 py-3 text-left">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{song.title}</div>
                <div className="text-xs text-muted-foreground truncate">{song.artist} · {song.year}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {song.pdfUrl && <FileText className="w-3.5 h-3.5 text-primary" />}
                {song.userAdded && <UserPlus className="w-3.5 h-3.5 text-muted-foreground" />}
                {needsReview && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                <span className="text-base leading-none">{tempoIcon}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
              <span className="rounded-md bg-muted px-1.5 py-0.5">{song.key?.split(" ")[0] || "Key?"}</span>
              <span className={`rounded-md px-1.5 py-0.5 ${hasCapo ? "bg-primary/10 text-primary" : "bg-muted"}`}>{capoLabel(song.capo)}</span>
              {song.duration && <span className="rounded-md bg-muted px-1.5 py-0.5">{formatDuration(song.duration)}</span>}
              {song.genre && <span className="rounded-md bg-muted px-1.5 py-0.5 truncate max-w-[110px]">{song.genre}</span>}
              {issues.some((issue) => issue.severity === "warning") && <span className="rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 px-1.5 py-0.5">Review</span>}
            </div>
          </button>
          {onAddToSetlist && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddToSetlist(); }}
              className="shrink-0 w-11 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors border-l border-border"
              title="Add to setlist"
            >
              <ListPlus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid={`card-song-${song.id}`}
      className="song-card song-card-accessible w-full rounded-xl border border-border bg-card hover:border-primary/50 transition-colors overflow-hidden"
    >
      <button onClick={onClick} className="w-full text-left p-4 cursor-pointer">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <div className="font-display font-bold text-base leading-tight truncate">{song.title}</div>
              {song.userAdded && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary shrink-0">Custom</Badge>
              )}
              {needsReview && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300/60 text-amber-700 dark:text-amber-300 shrink-0 gap-1">
                  <AlertTriangle className="w-2.5 h-2.5" /> Review
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground truncate">{song.artist} · {song.year}</div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${diffClass}`}>{song.difficulty}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${readiness === "Ready" ? "border-emerald-300/60 text-emerald-700 dark:text-emerald-300" : readiness === "Review" ? "border-amber-300/60 text-amber-700 dark:text-amber-300" : "border-border text-muted-foreground"}`}>
              {readiness === "Ready" && <CheckCircle2 className="inline w-3 h-3 mr-1" />}
              {readiness}
            </span>
            <span className={hasCapo ? "capo-badge" : "capo-badge no-capo"}>{capoLabel(song.capo)}</span>
          </div>
        </div>

        {/* Key + chords row */}
        <div className="flex flex-wrap gap-2 mb-3 text-xs">
          <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
            <Music className="w-3 h-3 text-primary" />
            <span className="font-medium">{song.key || "Unknown key"}</span>
          </span>
          <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md max-w-full">
            <Guitar className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="font-mono truncate">{song.chords || "No chords yet"}</span>
          </span>
          {song.duration && (
            <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span>{formatDuration(song.duration)}</span>
            </span>
          )}
          {song.tempo && (
            <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
              <Zap className="w-3 h-3 text-muted-foreground" />
              <span>{song.tempo} bpm · {song.tempoFeel}</span>
            </span>
          )}
        </div>

        {/* Strumming */}
        {song.strumming && (
          <div className="mb-3 rounded-lg bg-muted/40 px-2 py-1.5">
            <StrumPattern pattern={song.strumming} />
          </div>
        )}

        {displayIssues.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {displayIssues.slice(0, 3).map((issue) => (
              <Badge key={issue.key} variant="outline" className={`text-[10px] px-1.5 py-0 ${issue.severity === "warning" ? "border-amber-300/60 text-amber-700 dark:text-amber-300" : "text-muted-foreground border-border"}`}>
                {issue.label}
              </Badge>
            ))}
          </div>
        )}

        {/* Tags + PDF indicator */}
        <div className="flex flex-wrap gap-1 items-center">
          {song.pdfUrl ? (
            <Badge variant="outline" className="song-status-chip chip-pdf text-xs px-1.5 py-0 gap-1">
              <FileText className="w-2.5 h-2.5" /> Sheet PDF
            </Badge>
          ) : (
            <Badge variant="outline" className="song-status-chip chip-missing text-xs px-1.5 py-0">
              No PDF
            </Badge>
          )}
          {song.duration ? (
            <Badge variant="outline" className="song-status-chip chip-time text-xs px-1.5 py-0 gap-1">
              <Clock className="w-2.5 h-2.5" /> {formatDuration(song.duration)}
            </Badge>
          ) : (
            <Badge variant="outline" className="song-status-chip chip-missing text-xs px-1.5 py-0">
              Add time
            </Badge>
          )}
          {song.genre && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">{song.genre}</Badge>
          )}
          {tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
              {tag}
            </Badge>
          ))}
        </div>
      </button>

      {onAddToSetlist && (
        <button
          onClick={(e) => { e.stopPropagation(); onAddToSetlist(); }}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors px-3 py-2 border-t border-border hover:bg-primary/10"
          title="Add to setlist"
        >
          <ListPlus className="w-3.5 h-3.5" /> Add to setlist
        </button>
      )}
    </div>
  );
}
