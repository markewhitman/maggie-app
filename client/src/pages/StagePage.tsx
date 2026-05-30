import { Suspense, lazy, useState, useEffect, useRef } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  SEED_SONGS,
  formatDuration,
  formatDurationLong,
  stageTimingStore,
  type Song,
  type PerformanceNote,
  type StageTimingPrefs,
  type Setlist,
} from "@/lib/data";
import {
  sbSession,
  sbRequests,
  sbSongPdfs,
  sbSetlists,
  sbPerfNotes,
  sbSongs,
  requestScopeForSetlist,
  type SbRequest,
  type SbPerfNote,
  type SbSetlist,
} from "@/lib/supabase";
import { SongDetailModal } from "@/components/SongDetailModal";
import { AudienceShareDialog } from "@/components/AudienceShareDialog";
import { PreGigReadinessDialog } from "@/components/PreGigReadinessDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useConfirmDialog } from "@/hooks/use-confirm";
import {
  CheckCircle2,
  SkipForward,
  RotateCcw,
  GripVertical,
  Star,
  Maximize2,
  ClipboardList,
  X,
  Pencil,
  Plus,
  Search,
  FileText,
  Bell,
  ThumbsUp,
  ThumbsDown,
  Shuffle,
  Info,
  Music2,
  Clock,
  Keyboard,
  QrCode,
  ListMusic,
  Timer,
  ChevronUp,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import { STAGE_SHORTCUTS, performanceControlsStore, shouldIgnorePerformanceShortcut } from "@/lib/performanceControls";

const FullscreenPdfViewer = lazy(() =>
  import("@/components/FullscreenPdfViewer").then((mod) => ({
    default: mod.FullscreenPdfViewer,
  })),
);

// ─── Session type ─────────────────────────────────────────

interface Session {
  setlistId: string;
  orderedSongIds: string[];
  playedIds: string[];
  skippedIds: string[];
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sbToPerfNote(r: SbPerfNote): PerformanceNote {
  return {
    id: r.id,
    setlistId: r.setlist_id,
    songId: r.song_id,
    gigDate: r.gig_date ?? undefined,
    crowdReaction: r.crowd_reaction,
    tempoFeel: r.tempo_feel as PerformanceNote["tempoFeel"],
    lyricsConfidence:
      r.lyrics_confidence as PerformanceNote["lyricsConfidence"],
    notes: r.notes,
    createdAt: r.created_at,
  };
}

function sbToSetlist(r: SbSetlist): Setlist {
  return {
    id: r.id,
    name: r.name,
    gigDate: r.gig_date ?? undefined,
    gigStartTime: r.gig_start_time ?? undefined,
    venueId: r.venue_id ?? undefined,
    songIds: r.song_ids,
    createdAt: r.created_at,
    audienceSlug: r.audience_slug ?? undefined,
    requestsEnabled: r.requests_enabled ?? true,
  };
}


function formatClockTime(date: Date | null): string | null {
  if (!date) return null;
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatStageStart(time: string): string | null {
  if (!time) return null;
  const [hRaw, mRaw] = time.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ap}`;
}

function audienceUrlForScope(scope: string): string {
  if (typeof window === "undefined") return `#/audience/${encodeURIComponent(scope)}`;
  return `${window.location.origin}${window.location.pathname}#/audience/${encodeURIComponent(scope)}`;
}

function perfNoteToSb(note: PerformanceNote): Omit<SbPerfNote, "user_id"> {
  return {
    id: note.id,
    setlist_id: note.setlistId,
    song_id: note.songId,
    gig_date: note.gigDate ?? null,
    crowd_reaction: note.crowdReaction,
    tempo_feel: note.tempoFeel,
    lyrics_confidence: note.lyricsConfidence,
    notes: note.notes,
    created_at: note.createdAt,
  };
}

async function saveSession(session: Session) {
  await sbSession.save({
    setlist_id: session.setlistId,
    ordered_song_ids: session.orderedSongIds,
    played_ids: session.playedIds,
    skipped_ids: session.skippedIds,
  });
}

// ─── Performance Note Modal ───────────────────────────────

function PerfNoteModal({
  song,
  setlistId,
  gigDate,
  existing,
  onSaved,
  onClose,
}: {
  song: Song;
  setlistId: string;
  gigDate?: string;
  existing?: PerformanceNote;
  onSaved: (note: PerformanceNote) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"update" | "new">(
    existing ? "update" : "new",
  );
  const [crowdReaction, setCrowdReaction] = useState(
    existing?.crowdReaction ?? 3,
  );
  const [tempoFeel, setTempoFeel] = useState<PerformanceNote["tempoFeel"]>(
    existing?.tempoFeel ?? "Spot-on",
  );
  const [lyricsConfidence, setLyricsConfidence] = useState<
    PerformanceNote["lyricsConfidence"]
  >(existing?.lyricsConfidence ?? "Good");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const startNewNote = () => {
    setMode("new");
    setCrowdReaction(3);
    setTempoFeel("Spot-on");
    setLyricsConfidence("Good");
    setNotes("");
  };

  const editLatestNote = () => {
    if (!existing) return;
    setMode("update");
    setCrowdReaction(existing.crowdReaction);
    setTempoFeel(existing.tempoFeel);
    setLyricsConfidence(existing.lyricsConfidence);
    setNotes(existing.notes);
  };

  const handleSave = async () => {
    const note: PerformanceNote =
      existing && mode === "update"
        ? { ...existing, crowdReaction, tempoFeel, lyricsConfidence, notes }
        : {
            id: uid(),
            setlistId,
            songId: song.id,
            gigDate,
            crowdReaction,
            tempoFeel,
            lyricsConfidence,
            notes,
            createdAt: new Date().toISOString(),
          };

    setSaving(true);
    try {
      await sbPerfNotes.upsert(perfNoteToSb(note));
      onSaved(note);
      toast({ title: "Notes saved!" });
      onClose();
    } catch (err: any) {
      toast({
        title: "Notes not saved",
        description:
          err?.message ?? "Could not save performance notes to the cloud.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display italic text-base">
            {song.title} — Performance Notes
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {existing && (
            <div className="rounded-xl border border-border bg-muted/30 p-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={mode === "update" ? "default" : "outline"}
                  size="sm"
                  className="text-xs"
                  onClick={editLatestNote}
                >
                  Update latest
                </Button>
                <Button
                  type="button"
                  variant={mode === "new" ? "default" : "outline"}
                  size="sm"
                  className="text-xs gap-1"
                  onClick={startNewNote}
                >
                  <Plus className="w-3 h-3" /> Add new note
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                {mode === "new"
                  ? "This will save a separate performance-history entry."
                  : "This will edit the most recent note for this song in the active set."}
              </p>
            </div>
          )}
          <div>
            <Label className="text-xs mb-2 block">Crowd Reaction</Label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setCrowdReaction(n)}
                  className="p-1"
                >
                  <Star
                    className={`w-6 h-6 transition-colors ${n <= crowdReaction ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5 block">Tempo Feel</Label>
              <Select
                value={tempoFeel}
                onValueChange={(v) =>
                  setTempoFeel(v as PerformanceNote["tempoFeel"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dragged">Dragged</SelectItem>
                  <SelectItem value="Spot-on">Spot-on ✓</SelectItem>
                  <SelectItem value="Rushed">Rushed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Lyrics Confidence</Label>
              <Select
                value={lyricsConfidence}
                onValueChange={(v) =>
                  setLyricsConfidence(v as PerformanceNote["lyricsConfidence"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Good">Good ✓</SelectItem>
                  <SelectItem value="Blanked">Blanked</SelectItem>
                  <SelectItem value="Stumbled">Stumbled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Additional Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Crowd loved it, key change tricky, nail the bridge…"
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1" disabled={saving}>
              {saving
                ? "Saving…"
                : mode === "new"
                  ? "Save New Note"
                  : "Update Note"}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Setlist Modal ───────────────────────────────────

function EditSetlistModal({
  session,
  allSongs,
  onSave,
  onClose,
}: {
  session: Session;
  allSongs: Song[];
  onSave: (newIds: string[]) => void;
  onClose: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([
    ...session.orderedSongIds,
  ]);
  const [search, setSearch] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSelectedIds((ids) =>
        arrayMove(
          ids,
          ids.indexOf(active.id as string),
          ids.indexOf(over.id as string),
        ),
      );
    }
  };

  const toggleSong = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const available = allSongs.filter(
    (s) =>
      !selectedIds.includes(s.id) &&
      (search === "" ||
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.artist.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display italic">
            Edit Active Setlist
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs mb-2 block">
              Set Order ({selectedIds.length} songs) — drag to reorder
            </Label>
            {selectedIds.length === 0 ? (
              <div className="border border-dashed border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
                Add songs below
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={selectedIds}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1.5">
                    {selectedIds.map((id) => {
                      const song = allSongs.find((s) => s.id === id);
                      if (!song) return null;
                      return (
                        <EditDraggableSong
                          key={id}
                          id={id}
                          song={song}
                          onRemove={() => toggleSong(id)}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
          <div>
            <Label className="text-xs mb-2 block">Add Songs</Label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search songs…"
                className="pl-8 h-8 text-sm"
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-xl p-2">
              {available.map((song) => (
                <button
                  key={song.id}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-muted transition-colors"
                  onClick={() => toggleSong(song.id)}
                >
                  <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1">{song.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {song.artist}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => onSave(selectedIds)} className="flex-1">
              Update Set
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditDraggableSong({
  id,
  song,
  onRemove,
}: {
  id: string;
  song: Song;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 ${isDragging ? "opacity-50 shadow-lg" : ""}`}
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground"
      >
        <GripVertical className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{song.title}</div>
        <div className="text-xs text-muted-foreground">{song.artist}</div>
      </div>
      {song.capo && song.capo !== "No capo" && (
        <Badge className="capo-badge text-xs shrink-0">{song.capo}</Badge>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="w-6 h-6 shrink-0"
        onClick={onRemove}
      >
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

// ─── Sortable Stage Song Row ──────────────────────────────

function StageSongRow({
  song,
  status,
  isNext,
  onMarkPlayed,
  onMarkSkipped,
  onUndo,
  onAddNote,
  onViewSheet,
  onViewCard,
  hasPdf,
  songDuration,
  cumulativeTime,
  clockTime,
  showDuration,
  showCumulative,
  showClock,
  focusMode = false,
}: {
  song: Song;
  status: "pending" | "played" | "skipped";
  isNext: boolean;
  onMarkPlayed: () => void;
  onMarkSkipped: () => void;
  onUndo: () => void;
  onAddNote: () => void;
  onViewSheet: () => void;
  onViewCard: () => void;
  hasPdf: boolean;
  songDuration: number;
  cumulativeTime: number; // seconds from show start at which this song ends
  clockTime: Date | null; // wall-clock time this song starts (null if no start time)
  showDuration: boolean;
  showCumulative: boolean;
  showClock: boolean;
  focusMode?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: song.id });

  const isDone = status !== "pending";
  const rowClass =
    status === "played"
      ? "opacity-55 bg-card/70"
      : status === "skipped"
        ? "opacity-45 bg-card/60"
        : isNext
          ? "bg-primary/10 border-primary/50 shadow-sm shadow-primary/10"
          : "bg-card";

  const clockLabel = formatClockTime(clockTime);
  const timingItems = [
    showDuration
      ? { key: "duration", label: "Song length", value: formatDuration(songDuration) }
      : null,
    showCumulative
      ? { key: "elapsed", label: "Set elapsed", value: formatDuration(cumulativeTime) }
      : null,
    showClock && clockLabel
      ? { key: "clock", label: "Start time", value: clockLabel }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; value: string }>;

  const TimingTiles = ({ compact = false }: { compact?: boolean }) => (
    <div className={`flex flex-wrap gap-1.5 ${compact ? "" : "justify-end"}`}>
      {timingItems.map((item) => (
        <div
          key={item.key}
          className={`stage-timing-tile ${item.key === "clock" ? "border-primary/35 bg-primary/10" : ""}`}
        >
          <span className="stage-timing-label">{item.label}</span>
          <span
            className={`stage-timing-value ${compact ? "text-sm" : "text-base"}`}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`stage-song-row group border rounded-2xl px-3 py-3 sm:px-3.5 sm:py-3 transition-all ${rowClass} ${isDragging ? "opacity-50 shadow-lg z-50" : ""}`}
    >
      <div className="flex items-start gap-3">
        <span
          {...attributes}
          {...listeners}
          className="drag-handle cursor-grab text-muted-foreground shrink-0 pt-2 hidden sm:inline-flex"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </span>

        {isNext && (
          <div className="hidden sm:flex flex-col items-center pt-1 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <div className="w-px h-8 bg-primary/25 mt-1" />
          </div>
        )}

        <button
          className="flex-1 min-w-0 text-left"
          onClick={hasPdf ? onViewSheet : onViewCard}
          title={hasPdf ? "Open sheet music" : "Open song details"}
        >
          <div className="flex flex-wrap items-center gap-2">
            {isNext && (
              <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 uppercase tracking-wide">
                Next
              </Badge>
            )}
            <span
              className={`font-display font-bold italic leading-tight ${isNext ? "text-lg sm:text-xl" : "text-base sm:text-[17px]"} ${status === "skipped" ? "line-through" : ""}`}
            >
              {song.title}
            </span>
            {song.capo && song.capo !== "No capo" && (
              <Badge className="capo-badge text-[11px] shrink-0">
                {song.capo}
              </Badge>
            )}
            {hasPdf && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <FileText className="w-3 h-3" />
                PDF
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{song.artist}</span>
            <span>·</span>
            <span className="font-semibold text-foreground/70">
              {song.key.split("(")[0].trim()}
            </span>
          </div>
          {timingItems.length > 0 && (
            <div className={focusMode ? "mt-3" : "mt-2 md:hidden"}>
              <TimingTiles compact />
            </div>
          )}
        </button>

        {!focusMode && timingItems.length > 0 && (
          <div className="hidden md:block shrink-0 pt-1 min-w-[255px]">
            <TimingTiles />
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 sm:pl-7">
        <Button
          variant="outline"
          size="sm"
          className="h-10 min-w-10 px-3 gap-1.5 text-xs"
          onClick={onViewCard}
          title="Song details"
        >
          <Info className="w-4 h-4" />{" "}
          <span className="hidden sm:inline">Details</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-10 min-w-10 px-3 gap-1.5 text-xs"
          onClick={onAddNote}
          title="Performance note"
        >
          <ClipboardList className="w-4 h-4" />{" "}
          <span className="hidden sm:inline">Note</span>
        </Button>
        {hasPdf && (
          <Button
            variant="outline"
            size="sm"
            className="h-10 min-w-10 px-3 gap-1.5 text-xs"
            onClick={onViewSheet}
            title="Open PDF"
          >
            <FileText className="w-4 h-4" />{" "}
            <span className="hidden sm:inline">Sheet</span>
          </Button>
        )}
        <div className="flex-1" />
        {isDone ? (
          <Button
            variant="outline"
            size="sm"
            className="h-10 px-3 gap-1.5 text-xs"
            onClick={onUndo}
            title="Undo"
          >
            <RotateCcw className="w-4 h-4" /> Undo
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-10 px-3 gap-1.5 text-xs text-muted-foreground"
              onClick={onMarkSkipped}
              title="Skip"
            >
              <SkipForward className="w-4 h-4" /> Skip
            </Button>
            <Button
              size="sm"
              className="h-10 px-4 gap-1.5 text-xs font-semibold"
              onClick={onMarkPlayed}
              title="Mark played"
            >
              <CheckCircle2 className="w-4 h-4" /> Done
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Glance Mode ─────────────────────────────────────────

function GlanceView({
  next,
  upcoming,
}: {
  next: Song | null;
  upcoming: Song[];
}) {
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-8 text-center">
      {next ? (
        <>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
            Next Up
          </div>
          <div className="font-display font-bold text-4xl italic mb-2">
            {next.title}
          </div>
          <div className="text-muted-foreground text-lg mb-4">
            {next.artist}
          </div>
          {next.capo && next.capo !== "No capo" && (
            <Badge className="capo-badge text-base px-4 py-1 mb-4">
              {next.capo}
            </Badge>
          )}
          <div className="text-sm text-muted-foreground mb-8">{next.key}</div>
          {upcoming.slice(1, 4).length > 0 && (
            <div className="border-t border-border pt-6 w-full max-w-xs">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
                Coming Up
              </div>
              {upcoming.slice(1, 4).map((s, i) => (
                <div key={s.id} className="text-sm py-1 text-muted-foreground">
                  {i + 1}. {s.title}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="text-muted-foreground">
          <div className="text-4xl mb-4">🎉</div>
          <div className="font-display font-bold text-2xl italic">
            All done!
          </div>
          <div className="text-sm mt-2">Great show!</div>
        </div>
      )}
    </div>
  );
}


// ─── Keyboard Shortcut Help ──────────────────────────────

function StageShortcutHelpDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-primary" /> Performance shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            These controls work from Stage and Performance Mode when keyboard/pedal controls are enabled.
            Most Bluetooth page-turners send Arrow, PageUp/PageDown, or Space keystrokes.
          </p>
          <div className="grid gap-2">
            {STAGE_SHORTCUTS.map((shortcut) => (
              <div key={shortcut.keys} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/35 px-3 py-2 text-sm">
                <span className="font-mono font-bold text-primary whitespace-nowrap">{shortcut.keys}</span>
                <span className="text-muted-foreground text-right">{shortcut.action}</span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Performance Mode ────────────────────────────────────

function PerformanceModeView({
  currentSong,
  upcoming,
  orderedSongs,
  playedIds,
  skippedIds,
  requestsCount,
  timePlayed,
  timeRemaining,
  projectedEndLabel,
  stageStartLabel,
  hasPdf,
  onClose,
  onOpenSheet,
  onAddNote,
  onMarkPlayed,
  onMarkSkipped,
  onUndo,
  onUndoLast,
  onOpenRequests,
}: {
  currentSong: Song | null;
  upcoming: Song[];
  orderedSongs: Song[];
  playedIds: string[];
  skippedIds: string[];
  requestsCount: number;
  timePlayed: number;
  timeRemaining: number;
  projectedEndLabel: string | null;
  stageStartLabel: string | null;
  hasPdf: boolean;
  onClose: () => void;
  onOpenSheet: () => void;
  onAddNote: () => void;
  onMarkPlayed: () => void;
  onMarkSkipped: () => void;
  onUndo: (songId: string) => void;
  onUndoLast: () => void;
  onOpenRequests: () => void;
}) {
  const [showFullSet, setShowFullSet] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const currentStatus = currentSong
    ? playedIds.includes(currentSong.id)
      ? "played"
      : skippedIds.includes(currentSong.id)
        ? "skipped"
        : "pending"
    : "pending";

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!performanceControlsStore.isEnabled()) return;
      if (shouldIgnorePerformanceShortcut(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key;
      const lowerKey = key.toLowerCase();

      if (key === "Escape") {
        event.preventDefault();
        if (showShortcutHelp) setShowShortcutHelp(false);
        else onClose();
        return;
      }

      if (lowerKey === "?" || (key === "/" && event.shiftKey)) {
        event.preventDefault();
        setShowShortcutHelp((value) => !value);
        return;
      }

      if (!currentSong) return;

      if (key === "Enter" || lowerKey === "d") {
        event.preventDefault();
        if (currentStatus === "pending") onMarkPlayed();
      } else if (lowerKey === "s") {
        event.preventDefault();
        if (currentStatus === "pending") onMarkSkipped();
      } else if (lowerKey === "u") {
        event.preventDefault();
        onUndoLast();
      } else if (lowerKey === "m") {
        event.preventDefault();
        if (hasPdf) onOpenSheet();
      } else if (lowerKey === "n") {
        event.preventDefault();
        onAddNote();
      } else if (lowerKey === "r") {
        event.preventDefault();
        onOpenRequests();
      } else if (lowerKey === "l") {
        event.preventDefault();
        setShowFullSet((value) => !value);
      } else if (lowerKey === "p") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentSong, currentStatus, hasPdf, onAddNote, onClose, onMarkPlayed, onMarkSkipped, onOpenRequests, onOpenSheet, onUndo, onUndoLast, showShortcutHelp]);

  return (
    <div className="fixed inset-0 z-50 bg-background text-foreground flex flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border bg-card/80 backdrop-blur px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            Performance Mode
          </div>
          <div className="font-mono text-xl font-extrabold leading-tight">
            {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onOpenRequests} className="gap-1.5 relative h-10">
            <Bell className="w-4 h-4" /> Requests
            {requestsCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground rounded-full w-5 h-5 text-[11px] flex items-center justify-center font-bold">
                {requestsCount}
              </span>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowFullSet((p) => !p)} className="gap-1.5 h-10">
            <ListMusic className="w-4 h-4" /> Set
            {showFullSet ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowShortcutHelp((value) => !value)} className="gap-1.5 h-10">
            <Keyboard className="w-4 h-4" /> Keys
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-10">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {showShortcutHelp && (
        <div className="absolute right-4 top-20 z-[55] w-[min(92vw,400px)] rounded-2xl border border-border bg-card p-4 shadow-2xl">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="font-semibold text-sm">Performance shortcuts</div>
              <div className="text-xs text-muted-foreground">Keyboard and Bluetooth pedal actions.</div>
            </div>
            <button onClick={() => setShowShortcutHelp(false)} className="rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid gap-1.5">
            {STAGE_SHORTCUTS.map((shortcut) => (
              <div key={shortcut.keys} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                <span className="font-mono font-bold text-primary whitespace-nowrap">{shortcut.keys}</span>
                <span className="text-muted-foreground text-right">{shortcut.action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {currentSong ? (
          <div className="mx-auto max-w-5xl space-y-4">
            <div className="rounded-3xl border border-primary/35 bg-gradient-to-br from-primary/18 via-primary/8 to-transparent p-5 sm:p-8 shadow-sm">
              <div className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground mb-2">
                Current / Next Song
              </div>
              <h2 className="font-display text-4xl sm:text-6xl font-black italic leading-none tracking-tight">
                {currentSong.title}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-base sm:text-lg text-muted-foreground">
                <span>{currentSong.artist}</span>
                <span>·</span>
                <span className="font-bold text-foreground/80">{currentSong.key.split("(")[0].trim()}</span>
                {currentSong.capo && currentSong.capo !== "No capo" && (
                  <Badge className="capo-badge text-base px-4 py-1">{currentSong.capo}</Badge>
                )}
              </div>

              {currentSong.chords && (
                <div className="mt-5 rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Chords</div>
                  <div className="font-mono text-lg sm:text-2xl font-bold leading-relaxed break-words">
                    {currentSong.chords}
                  </div>
                </div>
              )}

              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="stage-timing-tile">
                  <span className="stage-timing-label">Played</span>
                  <span className="stage-timing-value text-lg">{formatDuration(timePlayed)}</span>
                </div>
                <div className="stage-timing-tile">
                  <span className="stage-timing-label">Remaining</span>
                  <span className="stage-timing-value text-lg">{formatDuration(timeRemaining)}</span>
                </div>
                <div className="stage-timing-tile">
                  <span className="stage-timing-label">Set start</span>
                  <span className="stage-timing-value text-lg">{stageStartLabel ?? "—"}</span>
                </div>
                <div className="stage-timing-tile border-primary/35 bg-primary/10">
                  <span className="stage-timing-label">Projected end</span>
                  <span className="stage-timing-value text-lg">{projectedEndLabel ?? "—"}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button size="lg" variant="outline" onClick={onOpenSheet} disabled={!hasPdf} className="h-14 gap-2 text-base">
                <FileText className="w-5 h-5" /> Sheet
              </Button>
              <Button size="lg" variant="outline" onClick={onAddNote} className="h-14 gap-2 text-base">
                <ClipboardList className="w-5 h-5" /> Note
              </Button>
              {currentStatus !== "pending" ? (
                <Button size="lg" variant="outline" onClick={() => onUndo(currentSong.id)} className="h-14 gap-2 text-base">
                  <RotateCcw className="w-5 h-5" /> Undo
                </Button>
              ) : (
                <Button size="lg" variant="outline" onClick={onMarkSkipped} className="h-14 gap-2 text-base">
                  <SkipForward className="w-5 h-5" /> Skip
                </Button>
              )}
              <Button size="lg" onClick={onMarkPlayed} className="h-14 gap-2 text-base font-bold" disabled={currentStatus !== "pending"}>
                <CheckCircle2 className="w-5 h-5" /> Done
              </Button>
            </div>

            {upcoming.slice(1, 4).length > 0 && (
              <div className="rounded-2xl border border-border bg-card px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">Coming up</div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {upcoming.slice(1, 4).map((song, i) => (
                    <div key={song.id} className="rounded-xl bg-muted/45 px-3 py-2">
                      <div className="text-[10px] text-muted-foreground">Next +{i + 1}</div>
                      <div className="font-semibold truncate">{song.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{song.artist}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showFullSet && (
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Full set fallback</div>
                    <div className="text-xs text-muted-foreground">Use this if you need to jump around quickly.</div>
                  </div>
                </div>
                <div className="max-h-[42vh] overflow-y-auto divide-y divide-border/60">
                  {orderedSongs.map((song, index) => {
                    const status = playedIds.includes(song.id)
                      ? "played"
                      : skippedIds.includes(song.id)
                        ? "skipped"
                        : song.id === currentSong.id
                          ? "current"
                          : "pending";
                    return (
                      <div key={`${song.id}-${index}`} className={`flex items-center gap-3 px-4 py-3 ${status === "current" ? "bg-primary/10" : ""}`}>
                        <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{song.title}</div>
                          <div className="text-xs text-muted-foreground truncate">{song.artist}</div>
                        </div>
                        {status === "played" && <Badge className="bg-green-600 text-white">Done</Badge>}
                        {status === "skipped" && <Badge variant="outline">Skipped</Badge>}
                        {status === "current" && <Badge className="bg-primary text-primary-foreground">Now</Badge>}
                        {status !== "pending" && status !== "current" && (
                          <Button variant="ghost" size="sm" onClick={() => onUndo(song.id)} className="h-8 text-xs">
                            Undo
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
            <div className="text-5xl mb-4">🎉</div>
            <div className="font-display font-bold text-3xl italic">All done!</div>
            <div className="text-sm mt-2">Great show.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Requests Panel ──────────────────────────────────────

const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
  approved: { label: "Approved", color: "text-green-600 dark:text-green-400" },
  denied: { label: "Declined", color: "text-red-500" },
  alternative: {
    label: "Alternative",
    color: "text-amber-600 dark:text-amber-400",
  },
};

function RequestsPanel({
  requests,
  songs,
  gigId,
  onApprove,
  onDeny,
  onSuggest,
  onClearAll,
  onClose,
}: {
  requests: SbRequest[];
  gigId?: string | null;
  songs: Song[];
  onApprove: (r: SbRequest) => void;
  onDeny: (r: SbRequest) => void;
  onSuggest: (r: SbRequest) => void;
  onClearAll: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [log, setLog] = useState<any[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const { toast } = useToast();

  const loadLog = async () => {
    setLogLoading(true);
    try {
      const data = await sbRequests.getLog(gigId);
      setLog(data);
    } finally {
      setLogLoading(false);
    }
  };

  const handleTabChange = (t: "pending" | "history") => {
    setTab(t);
    if (t === "history" && log.length === 0) loadLog();
  };

  // Frequency summary from log
  const freqMap: Record<string, number> = {};
  log.forEach((r) => {
    freqMap[r.song_title] = (freqMap[r.song_title] ?? 0) + 1;
  });
  const topRequests = Object.entries(freqMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-display italic flex items-center gap-2">
            <Bell className="w-4 h-4" /> Audience Requests
            {gigId && (
              <span className="text-[10px] text-muted-foreground font-normal">
                Scoped to active set
              </span>
            )}
            {requests.length > 0 && (
              <Badge className="bg-primary text-primary-foreground ml-1">
                {requests.length}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-border pb-0 shrink-0">
          {(["pending", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "pending" ? "Queue" : "History & Trends"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === "pending" && (
            <div className="space-y-3 pt-2">
              {requests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Music2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No pending requests</p>
                  <p className="text-xs mt-1 opacity-60">
                    Updates every 30 seconds
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {requests.map((req) => {
                    const song = songs.find((s) => s.id === req.song_id);
                    return (
                      <div
                        key={req.id}
                        className="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-2.5"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-sm truncate">
                              {req.song_title}
                            </span>
                            {req.is_write_in && (
                              <Badge
                                variant="outline"
                                className="text-[10px] shrink-0"
                              >
                                write-in
                              </Badge>
                            )}
                          </div>
                          {song && (
                            <div className="text-xs text-muted-foreground">
                              {song.artist} · {song.key?.split(" ")[0]}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-7 h-7 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                            title="Approve — adds to setlist"
                            onClick={() => onApprove(req)}
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-7 h-7 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                            title="Suggest alternative"
                            onClick={() => onSuggest(req)}
                          >
                            <Shuffle className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-7 h-7 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Decline"
                            onClick={() => onDeny(req)}
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground mt-1"
                    onClick={onClearAll}
                  >
                    Clear all
                  </Button>
                </div>
              )}
            </div>
          )}

          {tab === "history" && (
            <div className="pt-2 space-y-4">
              {/* Top requested songs */}
              {topRequests.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Most Requested
                  </div>
                  <div className="space-y-1.5">
                    {topRequests.map(([title, count]) => (
                      <div key={title} className="flex items-center gap-2">
                        <div className="flex-1 text-sm truncate">{title}</div>
                        <div className="flex items-center gap-1">
                          <div
                            className="h-2 bg-primary/60 rounded-full"
                            style={{
                              width: `${Math.max(20, (count / (topRequests[0][1] || 1)) * 80)}px`,
                            }}
                          />
                          <span className="text-xs font-semibold text-muted-foreground w-5 text-right">
                            {count}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full log */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Full Log
                </div>
                {logLoading ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    Loading…
                  </div>
                ) : log.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    No history yet
                  </div>
                ) : (
                  <div className="space-y-1">
                    {log.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-2 py-1.5 border-b border-border/40 last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-sm truncate block">
                            {entry.song_title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.requested_at).toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric" },
                            )}
                            {entry.is_write_in && " · write-in"}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-medium shrink-0 ${
                            OUTCOME_LABELS[entry.outcome]?.color ??
                            "text-muted-foreground"
                          }`}
                        >
                          {OUTCOME_LABELS[entry.outcome]?.label ??
                            entry.outcome}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────

export default function StagePage() {
  const [songs, setSongs] = useState<Song[]>(SEED_SONGS);
  const [session, setSessionState] = useState<Session | null>(null);
  const [currentSetlist, setCurrentSetlist] = useState<SbSetlist | null>(null);
  const [requestScopeId, setRequestScopeId] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [glanceMode, setGlanceMode] = useState(false);
  const [performanceMode, setPerformanceMode] = useState(false);
  const [showAudienceShare, setShowAudienceShare] = useState(false);
  const [showReadiness, setShowReadiness] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [noteModalSong, setNoteModalSong] = useState<Song | null>(null);
  const [sheetSong, setSheetSong] = useState<Song | null>(null);
  const [fullscreenPdfSong, setFullscreenPdfSong] = useState<Song | null>(null);
  const [cardSong, setCardSong] = useState<Song | null>(null);
  const [showEditSetlist, setShowEditSetlist] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [requests, setRequests] = useState<SbRequest[]>([]);
  const [perfNotes, setPerfNotes] = useState<PerformanceNote[]>([]);
  const [pdfMap, setPdfMap] = useState<
    Record<string, { url: string; name: string }>
  >({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Timing state ─────────────────────────────────────────
  const [stageStartTime, setStageStartTime] = useState<string>(""); // "HH:MM" 24h
  const [showStartTimeEdit, setShowStartTimeEdit] = useState(false);
  const [colPrefs, setColPrefs] = useState<StageTimingPrefs>(() =>
    stageTimingStore.getPrefs(),
  );

  const toggleCol = (col: keyof StageTimingPrefs) => {
    setColPrefs((prev) => {
      const next = { ...prev, [col]: !prev[col] };
      stageTimingStore.savePrefs(next);
      return next;
    });
  };

  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  // Load synced song catalogue, including user-added songs and seed-song edits.
  useEffect(() => {
    sbSongs
      .getCatalog()
      .then(setSongs)
      .catch(() => {});
  }, []);

  // Load session from Supabase on mount
  useEffect(() => {
    sbSession
      .get()
      .then((s) => {
        if (s) {
          setSessionState({
            setlistId: s.setlist_id,
            orderedSongIds: s.ordered_song_ids,
            playedIds: s.played_ids,
            skippedIds: s.skipped_ids,
          });
          // Load the planned start time for this setlist
          const savedTime = stageTimingStore.getStartTime(s.setlist_id);
          if (savedTime) setStageStartTime(savedTime);
        }
        setSessionLoading(false);
      })
      .catch(() => setSessionLoading(false));
  }, []);

  // Resolve the public request scope for the active set. New audience links
  // use an unguessable audience slug; older links/setlists fall back to the setlist id.
  useEffect(() => {
    if (!session?.setlistId) {
      setCurrentSetlist(null);
      setRequestScopeId(null);
      return;
    }
    sbSetlists
      .getById(session.setlistId)
      .then((setlist) => {
        setCurrentSetlist(setlist);
        setRequestScopeId(
          setlist ? requestScopeForSetlist(setlist) : session.setlistId,
        );
        if (setlist?.gig_start_time && !stageTimingStore.getStartTime(session.setlistId)) {
          setStageStartTime(setlist.gig_start_time);
        }
      })
      .catch(() => {
        setCurrentSetlist(null);
        setRequestScopeId(session.setlistId);
      });
  }, [session?.setlistId]);

  // Load PDF map so we know which songs have sheet music
  useEffect(() => {
    sbSongPdfs
      .getAll()
      .then(setPdfMap)
      .catch(() => {});
  }, []);

  // Load synced performance notes for the active setlist
  useEffect(() => {
    if (!session?.setlistId) {
      setPerfNotes([]);
      return;
    }
    sbPerfNotes
      .getForSetlist(session.setlistId)
      .then((rows) => setPerfNotes(rows.map(sbToPerfNote)))
      .catch(() => setPerfNotes([]));
  }, [session?.setlistId]);

  // Poll for audience requests every 30 s. When an active set is loaded,
  // only show requests that were submitted through that set's audience link.
  useEffect(() => {
    const activeGigId = requestScopeId ?? session?.setlistId ?? null;
    const fetchRequests = () => {
      sbRequests
        .getPending(activeGigId)
        .then(setRequests)
        .catch(() => {});
    };
    fetchRequests();
    pollRef.current = setInterval(fetchRequests, 30000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [session?.setlistId, requestScopeId]);

  const handleApprove = async (req: SbRequest) => {
    await sbRequests.resolve(req, "approved");
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
    // Add the song to the active setlist if it's in the catalogue and not already there
    if (req.song_id && session) {
      const alreadyIn = session.orderedSongIds.includes(req.song_id);
      if (!alreadyIn) {
        const newIds = [...session.orderedSongIds, req.song_id];
        updateSession({ orderedSongIds: newIds });
        sbSetlists.update(session.setlistId, { song_ids: newIds }).catch(() => {
          toast({
            title: "Active set updated only",
            description:
              "The request was added tonight, but the saved setlist did not sync.",
            variant: "destructive",
          });
        });
        toast({
          title: "Added to setlist!",
          description: `“${req.song_title}” added to the end of the set`,
        });
      } else {
        toast({
          title: "Approved",
          description: `“${req.song_title}” is already in the set`,
        });
      }
    } else if (req.is_write_in) {
      toast({
        title: "Approved (write-in)",
        description: `“${req.song_title}” noted — not in catalogue`,
      });
    }
  };

  const handleDeny = async (req: SbRequest) => {
    await sbRequests.resolve(req, "denied");
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
    toast({
      title: "Declined",
      description: `“${req.song_title}” removed from queue`,
    });
  };

  const handleSuggestAlternative = async (req: SbRequest) => {
    await sbRequests.resolve(req, "alternative");
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
    const reqSong = songs.find((s) => s.id === req.song_id);
    const alternatives = songs.filter(
      (s) =>
        s.id !== req.song_id &&
        (s.genre === reqSong?.genre ||
          (reqSong?.similar ?? []).includes(s.title)),
    );
    if (alternatives.length > 0) {
      const alt = alternatives[Math.floor(Math.random() * alternatives.length)];
      toast({
        title: "Suggested alternative",
        description: `How about “${alt.title}” by ${alt.artist}?`,
      });
    } else {
      toast({
        title: "No similar songs found",
        description: "Consider picking one manually from the setlist",
      });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const setlist = null; // setlist details not needed here — session carries song IDs

  const updateSession = (update: Partial<Session>) => {
    if (!session) return;
    const next: Session = { ...session, ...update };
    saveSession(next); // async, fire-and-forget
    setSessionState(next);
  };

  const orderedIds = session?.orderedSongIds ?? [];
  const playedIds = session?.playedIds ?? [];
  const skippedIds = session?.skippedIds ?? [];

  const orderedSongs = orderedIds
    .map((id) => songs.find((s) => s.id === id))
    .filter(Boolean) as Song[];
  const pendingSongs = orderedSongs.filter(
    (s) => !playedIds.includes(s.id) && !skippedIds.includes(s.id),
  );
  const nextSong = pendingSongs[0] ?? null;
  const nextSongHasPdf = nextSong
    ? !!(pdfMap[nextSong.id]?.url ?? nextSong.pdfUrl)
    : false;

  const getStatus = (song: Song): "played" | "skipped" | "pending" => {
    if (playedIds.includes(song.id)) return "played";
    if (skippedIds.includes(song.id)) return "skipped";
    return "pending";
  };

  const lastProgressedSongId = [...orderedIds]
    .reverse()
    .find((id) => playedIds.includes(id) || skippedIds.includes(id)) ?? null;

  const undoLastProgress = () => {
    if (!lastProgressedSongId) {
      toast({ title: "Nothing to undo", description: "No songs have been marked done or skipped yet." });
      return;
    }
    undo(lastProgressedSongId);
  };

  const markPlayed = (id: string) =>
    updateSession({
      playedIds: [...playedIds, id],
      skippedIds: skippedIds.filter((x) => x !== id),
    });
  const markSkipped = (id: string) =>
    updateSession({
      skippedIds: [...skippedIds, id],
      playedIds: playedIds.filter((x) => x !== id),
    });
  const undo = (id: string) =>
    updateSession({
      playedIds: playedIds.filter((x) => x !== id),
      skippedIds: skippedIds.filter((x) => x !== id),
    });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      updateSession({
        orderedSongIds: arrayMove(
          orderedIds,
          orderedIds.indexOf(active.id as string),
          orderedIds.indexOf(over.id as string),
        ),
      });
    }
  };

  const resetProgress = async () => {
    if (playedIds.length === 0 && skippedIds.length === 0) {
      toast({ title: "No completed songs to reset" });
      return;
    }
    const confirmed = await confirm({
      title: "Reset completed songs?",
      description:
        "This marks every song in the active Stage session as pending again. Your saved setlist order will not change.",
      confirmLabel: "Reset progress",
      destructive: false,
    });
    if (!confirmed) return;
    updateSession({ playedIds: [], skippedIds: [] });
    toast({
      title: "Stage progress reset",
      description: "All songs are pending again.",
    });
  };

  const clearSession = async () => {
    const confirmed = await confirm({
      title: "End active set?",
      description:
        "This clears the currently loaded Stage session. Your saved setlist will remain available.",
      confirmLabel: "End set",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await sbSession.clear();
      setSessionState(null);
      toast({ title: "Set ended" });
    } catch (err: any) {
      toast({
        title: "Could not end set",
        description: err?.message ?? "The active session was not cleared.",
        variant: "destructive",
      });
    }
  };

  const handleEditSave = async (newIds: string[]) => {
    updateSession({ orderedSongIds: newIds });
    if (session) {
      try {
        await sbSetlists.update(session.setlistId, { song_ids: newIds });
        toast({ title: "Setlist updated!" });
      } catch (err: any) {
        toast({
          title: "Active set updated only",
          description:
            err?.message ?? "The saved cloud setlist did not update.",
          variant: "destructive",
        });
      }
    }
    setShowEditSetlist(false);
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!session || !performanceControlsStore.isEnabled()) return;
      if (shouldIgnorePerformanceShortcut(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const modalOpen = Boolean(
        fullscreenPdfSong ||
          noteModalSong ||
          cardSong ||
          sheetSong ||
          showEditSetlist ||
          showAudienceShare,
      );
      if (modalOpen) return;

      const key = event.key;
      const lowerKey = key.toLowerCase();

      if (key === "Escape") {
        if (showShortcutHelp) {
          event.preventDefault();
          setShowShortcutHelp(false);
        } else if (showRequests) {
          event.preventDefault();
          setShowRequests(false);
        } else if (performanceMode) {
          event.preventDefault();
          setPerformanceMode(false);
        }
        return;
      }

      if (lowerKey === "?" || (key === "/" && event.shiftKey)) {
        event.preventDefault();
        setShowShortcutHelp((value) => !value);
        return;
      }

      if (performanceMode) return;
      if (!nextSong) return;

      if (key === "Enter" || lowerKey === "d") {
        event.preventDefault();
        markPlayed(nextSong.id);
      } else if (lowerKey === "s") {
        event.preventDefault();
        markSkipped(nextSong.id);
      } else if (lowerKey === "u") {
        event.preventDefault();
        undoLastProgress();
      } else if (lowerKey === "m") {
        event.preventDefault();
        if (nextSongHasPdf) setFullscreenPdfSong(nextSong);
        else setSheetSong(nextSong);
      } else if (lowerKey === "n") {
        event.preventDefault();
        setNoteModalSong(nextSong);
      } else if (lowerKey === "p") {
        event.preventDefault();
        setPerformanceMode(true);
      } else if (lowerKey === "r") {
        event.preventDefault();
        setShowRequests(true);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cardSong, fullscreenPdfSong, nextSong, nextSongHasPdf, noteModalSong, performanceMode, session, sheetSong, showAudienceShare, showEditSetlist, showRequests, showShortcutHelp, undoLastProgress]);

  if (sessionLoading) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <div className="text-5xl mb-4 animate-pulse">🎤</div>
        <div className="text-sm">Loading set from cloud…</div>
      </div>
    );
  }

  if (!session || orderedIds.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <div className="text-5xl mb-4">🎤</div>
        <div className="font-display font-bold text-xl italic mb-2">
          No Active Set
        </div>
        <p className="text-sm max-w-sm mx-auto mb-6">
          Go to Setlists, pick a gig, and hit "Load Tonight" to start the stage
          manager.
        </p>
      </div>
    );
  }

  // ─── Runtime calculations ─────────────────────────────────
  const DEFAULT_DUR = 210;
  const BETWEEN_GAP = 30; // 30s between songs
  const timePlayed = orderedSongs
    .filter((s) => playedIds.includes(s.id))
    .reduce((sum, s) => sum + (s.duration ?? DEFAULT_DUR), 0);
  const timeRemaining = pendingSongs.reduce(
    (sum, s) => sum + (s.duration ?? DEFAULT_DUR),
    0,
  );

  // Parse stageStartTime ("HH:MM") into a Date for today
  const startDate: Date | null = (() => {
    if (!stageStartTime) return null;
    const parts = stageStartTime.split(":");
    if (parts.length < 2) return null;
    const h = parseInt(parts[0]);
    const m = parseInt(parts[1]);
    if (isNaN(h) || isNaN(m)) return null;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  })();

  // Build per-song timing data: { songId, songDuration, cumulativeTime, clockTime }
  interface SongTiming {
    songId: string;
    songDuration: number;
    cumulativeTime: number; // seconds from show start when song ENDS
    clockTime: Date | null; // wall-clock when song STARTS
  }
  const songTimings: SongTiming[] = [];
  let elapsed = 0;
  orderedSongs.forEach((song) => {
    const dur = song.duration ?? DEFAULT_DUR;
    const startSec = elapsed;
    const endSec = elapsed + dur;
    const clock = startDate
      ? new Date(startDate.getTime() + startSec * 1000)
      : null;
    songTimings.push({
      songId: song.id,
      songDuration: dur,
      cumulativeTime: endSec,
      clockTime: clock,
    });
    elapsed = endSec + BETWEEN_GAP;
  });

  const projectedMusicTime = Math.max(0, elapsed - BETWEEN_GAP);
  const projectedEndLabel = startDate
    ? formatClockTime(new Date(startDate.getTime() + projectedMusicTime * 1000))
    : null;
  const stageStartLabel = formatStageStart(stageStartTime);
  const nextTiming = nextSong
    ? songTimings.find((timing) => timing.songId === nextSong.id)
    : null;
  const audienceScope = requestScopeId ?? session.setlistId;
  const audienceShareUrl = audienceUrlForScope(audienceScope);
  return (
    <div>
      {ConfirmDialog}
      <StageShortcutHelpDialog open={showShortcutHelp} onClose={() => setShowShortcutHelp(false)} />

      {/* Header */}
      <div className="flex flex-col gap-4 mb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="font-display font-bold text-xl italic mb-0.5">
            Stage Manager
          </h1>
          <p className="text-muted-foreground text-sm">
            {playedIds.length} played · {pendingSongs.length} remaining ·{" "}
            {skippedIds.length} skipped
          </p>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-3xl">
            <div className="rounded-xl border border-border bg-card px-3 py-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Played
              </div>
              <div className="font-mono text-lg font-extrabold leading-tight">
                {formatDuration(timePlayed)}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card px-3 py-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Remaining
              </div>
              <div className="font-mono text-lg font-extrabold leading-tight">
                {formatDuration(timeRemaining)}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card px-3 py-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Set starts
              </div>
              {showStartTimeEdit ? (
                <input
                  type="time"
                  value={stageStartTime}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStageStartTime(v);
                    if (session) stageTimingStore.setStartTime(session.setlistId, v);
                  }}
                  className="mt-0.5 w-full bg-background border border-border rounded px-2 py-1 font-mono text-base font-bold"
                  autoFocus
                  onBlur={() => setShowStartTimeEdit(false)}
                />
              ) : (
                <button
                  className="mt-0.5 flex items-center gap-1 text-left font-mono text-lg font-extrabold leading-tight hover:text-primary transition-colors"
                  onClick={() => setShowStartTimeEdit(true)}
                  title="Set / adjust show start time"
                >
                  <Clock className="w-4 h-4" />
                  {stageStartLabel ?? <span className="text-sm italic text-muted-foreground">Set time</span>}
                </button>
              )}
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Projected end
              </div>
              <div className="font-mono text-lg font-extrabold leading-tight">
                {projectedEndLabel ?? "—"}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowRequests((p) => !p);
            }}
            className="gap-1.5 relative"
          >
            <Bell className="w-3.5 h-3.5" /> Requests
            {requests.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold">
                {requests.length}
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAudienceShare(true)}
            className="gap-1.5"
            title="Show audience QR code and scoped request link"
          >
            <QrCode className="w-3.5 h-3.5" /> Audience QR
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowReadiness(true)}
            disabled={!currentSetlist}
            className="gap-1.5"
            title="Check missing PDFs, durations, review flags, QR readiness, and backup status"
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Ready
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setPerformanceMode(true)}
            className="gap-1.5"
            title="Open simplified live performance view"
          >
            <Timer className="w-3.5 h-3.5" /> Performance
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEditSetlist(true)}
            className="gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit Set
          </Button>
          <Button
            variant={focusMode ? "default" : "outline"}
            size="sm"
            onClick={() => setFocusMode((p) => !p)}
            className="gap-1.5"
            title="Toggle larger, lower-distraction stage rows"
          >
            <Music2 className="w-3.5 h-3.5" /> Focus
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGlanceMode(true)}
            className="gap-1.5"
          >
            <Maximize2 className="w-3.5 h-3.5" /> At-a-Glance
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowShortcutHelp(true)}
            className="gap-1.5"
            title="Show keyboard and Bluetooth pedal controls"
          >
            <Keyboard className="w-3.5 h-3.5" /> Keys
          </Button>
          {(playedIds.length > 0 || skippedIds.length > 0) && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetProgress}
              className="gap-1.5"
              title="Mark completed/skipped songs as pending again"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSession}
            className="text-muted-foreground gap-1.5"
          >
            <X className="w-3.5 h-3.5" /> End Set
          </Button>
        </div>
      </div>

      {/* Next up highlight */}
      {nextSong && (
        <div className="bg-gradient-to-br from-primary/15 via-primary/8 to-transparent border border-primary/35 rounded-2xl p-4 sm:p-5 mb-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-1">
                Next Up
              </div>
              <div className="font-display font-bold text-2xl sm:text-3xl italic leading-tight">
                {nextSong.title}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span>{nextSong.artist}</span>
                <span>·</span>
                <span className="font-semibold text-foreground/75">
                  {nextSong.key.split("(")[0].trim()}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <div className="stage-timing-tile">
                  <span className="stage-timing-label">Song length</span>
                  <span className="stage-timing-value text-base">
                    {formatDuration(nextTiming?.songDuration ?? nextSong.duration ?? DEFAULT_DUR)}
                  </span>
                </div>
                {nextTiming && (
                  <div className="stage-timing-tile">
                    <span className="stage-timing-label">Set elapsed</span>
                    <span className="stage-timing-value text-base">
                      {formatDuration(nextTiming.cumulativeTime)}
                    </span>
                  </div>
                )}
                {nextTiming?.clockTime && (
                  <div className="stage-timing-tile border-primary/35 bg-primary/10">
                    <span className="stage-timing-label">Expected start</span>
                    <span className="stage-timing-value text-base">
                      {formatClockTime(nextTiming.clockTime)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {nextSong.capo && nextSong.capo !== "No capo" && (
                <Badge className="capo-badge text-sm px-3 py-1">
                  {nextSong.capo}
                </Badge>
              )}
              {!!(pdfMap[nextSong.id]?.url ?? nextSong.pdfUrl) && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setFullscreenPdfSong(nextSong)}
                  className="h-11 gap-1.5"
                >
                  <FileText className="w-4 h-4" /> Sheet
                </Button>
              )}
              <Button
                size="lg"
                variant="outline"
                onClick={() => markSkipped(nextSong.id)}
                className="h-11 gap-1.5"
              >
                <SkipForward className="w-4 h-4" /> Skip
              </Button>
              <Button
                size="lg"
                onClick={() => markPlayed(nextSong.id)}
                className="h-11 gap-1.5 font-semibold"
              >
                <CheckCircle2 className="w-4 h-4" /> Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Timing display controls */}
      {!focusMode && (
        <div className="mb-3 rounded-xl border border-border bg-card/70 px-3 py-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Timing shown on each song
              </div>
              <div className="text-xs text-muted-foreground">
                Choose only the timing cues that help during performance.
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  {
                    key: "showDuration" as keyof StageTimingPrefs,
                    label: "Song length",
                  },
                  {
                    key: "showCumulative" as keyof StageTimingPrefs,
                    label: "Set elapsed",
                  },
                  {
                    key: "showClock" as keyof StageTimingPrefs,
                    label: "Start time",
                  },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => toggleCol(key)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    colPrefs[key]
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent text-muted-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {focusMode && (
        <div className="mb-3 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-muted-foreground">
          Focus mode is on: rows are larger and timing columns are tucked into
          each song.
        </div>
      )}

      {/* Full set list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={orderedIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1.5">
            {orderedSongs.map((song) => {
              const timing = songTimings.find((t) => t.songId === song.id);
              return (
                <StageSongRow
                  key={song.id}
                  song={song}
                  status={getStatus(song)}
                  isNext={song.id === nextSong?.id}
                  onMarkPlayed={() => markPlayed(song.id)}
                  onMarkSkipped={() => markSkipped(song.id)}
                  onUndo={() => undo(song.id)}
                  onAddNote={() => setNoteModalSong(song)}
                  onViewSheet={() => {
                    // If a PDF is available, go straight to fullscreen — no modal friction during performance
                    const hasPdfUrl = !!(pdfMap[song.id]?.url ?? song.pdfUrl);
                    if (hasPdfUrl) {
                      setFullscreenPdfSong(song);
                    } else {
                      setSheetSong(song); // fallback: open modal to pdf tab (no PDF uploaded yet)
                    }
                  }}
                  onViewCard={() => setCardSong(song)}
                  hasPdf={!!(pdfMap[song.id] || song.pdfUrl)}
                  songDuration={timing?.songDuration ?? DEFAULT_DUR}
                  cumulativeTime={timing?.cumulativeTime ?? 0}
                  clockTime={timing?.clockTime ?? null}
                  showDuration={colPrefs.showDuration}
                  showCumulative={colPrefs.showCumulative}
                  showClock={colPrefs.showClock}
                  focusMode={focusMode}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Glance mode overlay */}
      {glanceMode && (
        <>
          <GlanceView next={nextSong} upcoming={pendingSongs} />
          <button
            className="fixed top-4 right-4 z-[60] bg-background/80 backdrop-blur border border-border rounded-full p-2"
            onClick={() => setGlanceMode(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Performance mode overlay */}
      {performanceMode && (
        <PerformanceModeView
          currentSong={nextSong}
          upcoming={pendingSongs}
          orderedSongs={orderedSongs}
          playedIds={playedIds}
          skippedIds={skippedIds}
          requestsCount={requests.length}
          timePlayed={timePlayed}
          timeRemaining={timeRemaining}
          projectedEndLabel={projectedEndLabel}
          stageStartLabel={stageStartLabel}
          hasPdf={nextSongHasPdf}
          onClose={() => setPerformanceMode(false)}
          onOpenSheet={() => {
            if (nextSongHasPdf && nextSong) {
              setPerformanceMode(false);
              setFullscreenPdfSong(nextSong);
            }
          }}
          onAddNote={() => {
            if (nextSong) {
              setPerformanceMode(false);
              setNoteModalSong(nextSong);
            }
          }}
          onMarkPlayed={() => {
            if (nextSong) markPlayed(nextSong.id);
          }}
          onMarkSkipped={() => {
            if (nextSong) markSkipped(nextSong.id);
          }}
          onUndo={undo}
          onUndoLast={undoLastProgress}
          onOpenRequests={() => {
            setPerformanceMode(false);
            setShowRequests(true);
          }}
        />
      )}

      <AudienceShareDialog
        open={showAudienceShare}
        onClose={() => setShowAudienceShare(false)}
        url={audienceShareUrl}
        setlistName={currentSetlist?.name ?? "Active Stage set"}
        subtitle={[currentSetlist?.gig_date, currentSetlist?.gig_start_time ? `Starts ${formatStageStart(currentSetlist.gig_start_time) ?? currentSetlist.gig_start_time}` : null]
          .filter(Boolean)
          .join(" · ")}
        songCount={orderedSongs.length}
        source="stage"
      />


      {showReadiness && currentSetlist && (
        <PreGigReadinessDialog
          open={showReadiness}
          onClose={() => setShowReadiness(false)}
          setlist={sbToSetlist(currentSetlist)}
          songs={songs}
          loadLabel="Return to Stage"
        />
      )}

      {/* Edit setlist modal */}
      {showEditSetlist && (
        <EditSetlistModal
          session={session}
          allSongs={songs}
          onSave={handleEditSave}
          onClose={() => setShowEditSetlist(false)}
        />
      )}

      {/* Performance note modal */}
      {noteModalSong && (
        <PerfNoteModal
          song={noteModalSong}
          setlistId={session.setlistId}
          gigDate={undefined}
          existing={perfNotes.find((n) => n.songId === noteModalSong.id)}
          onSaved={(saved) => {
            setPerfNotes((prev) => {
              const exists = prev.some((n) => n.id === saved.id);
              return exists
                ? prev.map((n) => (n.id === saved.id ? saved : n))
                : [saved, ...prev];
            });
          }}
          onClose={() => setNoteModalSong(null)}
        />
      )}

      {/* Sheet music — goes FULLSCREEN directly for performance use */}
      {fullscreenPdfSong &&
        (() => {
          const url =
            pdfMap[fullscreenPdfSong.id]?.url ?? fullscreenPdfSong.pdfUrl;
          return url ? (
            <Suspense fallback={null}>
              <FullscreenPdfViewer
                pdfUrl={url}
                songTitle={fullscreenPdfSong.title}
                songId={fullscreenPdfSong.id}
                onClose={() => setFullscreenPdfSong(null)}
              />
            </Suspense>
          ) : null;
        })()}

      {/* Sheet music modal fallback (no pdf uploaded) — opens info tab */}
      {sheetSong && (
        <SongDetailModal
          song={{
            ...sheetSong,
            pdfUrl: pdfMap[sheetSong.id]?.url ?? sheetSong.pdfUrl,
          }}
          onClose={() => setSheetSong(null)}
          defaultTab="pdf"
        />
      )}

      {/* Song card modal (info icon) */}
      {cardSong && (
        <SongDetailModal
          song={{
            ...cardSong,
            pdfUrl: pdfMap[cardSong.id]?.url ?? cardSong.pdfUrl,
          }}
          onClose={() => setCardSong(null)}
        />
      )}

      {/* Audience Requests Panel */}
      {showRequests && (
        <RequestsPanel
          requests={requests}
          songs={songs}
          gigId={requestScopeId ?? session?.setlistId ?? null}
          onApprove={handleApprove}
          onDeny={handleDeny}
          onSuggest={handleSuggestAlternative}
          onClearAll={async () => {
            const confirmed = await confirm({
              title: "Clear all pending requests?",
              description:
                "This removes every pending audience request from the queue.",
              confirmLabel: "Clear requests",
              destructive: true,
            });
            if (!confirmed) return;
            try {
              await sbRequests.clearAll(
                requestScopeId ?? session?.setlistId ?? null,
              );
              setRequests([]);
              toast({ title: "Requests cleared" });
            } catch (err: any) {
              toast({
                title: "Could not clear requests",
                description:
                  err?.message ?? "The request queue was not cleared.",
                variant: "destructive",
              });
            }
          }}
          onClose={() => setShowRequests(false)}
        />
      )}
    </div>
  );
}
