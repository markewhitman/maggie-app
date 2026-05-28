import type { Song } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { Guitar, Music, Zap, FileText, ListPlus } from "lucide-react";
import { StrumPattern } from "@/components/StrumPattern";

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

export function SongCard({ song, onClick, compact = false, index, onAddToSetlist }: SongCardProps) {
  const tags: string[] = Array.isArray(song.tags) ? song.tags : (() => { try { return JSON.parse((song.tags as any) ?? "[]"); } catch { return []; } })();
  const diffClass = DIFFICULTY_COLOR[song.difficulty as keyof typeof DIFFICULTY_COLOR] ?? DIFFICULTY_COLOR.Intermediate;
  const tempoIcon = TEMPO_ICON[song.tempoFeel as keyof typeof TEMPO_ICON] ?? "🎵";
  const hasCapo = song.capo && song.capo !== "No capo";

  if (compact) {
    return (
      <div
        data-testid={`card-song-${song.id}`}
        className="song-card w-full text-left p-3 rounded-lg border border-border bg-card hover:border-primary/40 flex items-center gap-2"
      >
        <button onClick={onClick} className="flex-1 min-w-0 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{song.title}</div>
            <div className="text-xs text-muted-foreground truncate">{song.artist}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {hasCapo && (
              <span className="capo-badge text-xs">C{song.capo?.match(/\d+/)?.[0]}</span>
            )}
            <span className="text-base">{tempoIcon}</span>
          </div>
        </button>
        {onAddToSetlist && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddToSetlist(); }}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title="Add to setlist"
          >
            <ListPlus className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      data-testid={`card-song-${song.id}`}
      className="song-card w-full text-left p-4 rounded-xl border border-border bg-card hover:border-primary/50 cursor-pointer"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="font-display font-bold text-base leading-tight mb-0.5 truncate">{song.title}</div>
          <div className="text-sm text-muted-foreground truncate">{song.artist} · {song.year}</div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${diffClass}`}>
            {song.difficulty}
          </span>
          {hasCapo ? (
            <span className="capo-badge">Capo {song.capo?.match(/\d+/)?.[0]}</span>
          ) : (
            <span className="capo-badge no-capo">No Capo</span>
          )}
        </div>
      </div>

      {/* Key + chords row */}
      <div className="flex flex-wrap gap-2 mb-3 text-xs">
        <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
          <Music className="w-3 h-3 text-primary" />
          <span className="font-medium">{song.key?.split(" ")[0]} {song.key?.split(" ")[1]}</span>
        </span>
        <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
          <Guitar className="w-3 h-3 text-muted-foreground" />
          <span className="font-mono">{song.chords}</span>
        </span>
        {song.tempo && (
          <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
            <Zap className="w-3 h-3 text-muted-foreground" />
            <span>{song.tempo} bpm · {song.tempoFeel}</span>
          </span>
        )}
      </div>

      {/* Strumming */}
      {song.strumming && (
        <div className="mb-3">
          <StrumPattern pattern={song.strumming} />
        </div>
      )}

      {/* Tags + PDF indicator + Add to Setlist */}
      <div className="flex flex-wrap gap-1 items-center justify-between">
        <div className="flex flex-wrap gap-1 items-center">
          {song.pdfUrl && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 gap-1 border-primary/40 text-primary">
              <FileText className="w-2.5 h-2.5" /> PDF
            </Badge>
          )}
          {tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
              {tag}
            </Badge>
          ))}
        </div>
        {onAddToSetlist && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddToSetlist(); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-1.5 py-0.5 rounded hover:bg-primary/10"
            title="Add to setlist"
          >
            <ListPlus className="w-3.5 h-3.5" /> Add to setlist
          </button>
        )}
      </div>
    </button>
  );
}
