import { useState, useEffect } from "react";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { songsStore, setlistsStore, perfNotesStore, type Song, type PerformanceNote } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, SkipForward, RotateCcw, GripVertical, Mic2, Star,
  ChevronDown, ChevronUp, Eye, Maximize2, ClipboardList, X,
} from "lucide-react";

// ─── Session type ─────────────────────────────────────────

interface Session {
  setlistId: string;
  orderedSongIds: string[];
  playedIds: string[];
  skippedIds: string[];
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem("maggie_active_session");
    if (!raw) return null;
    const base = JSON.parse(raw);
    return {
      setlistId: base.setlistId,
      orderedSongIds: base.orderedSongIds || [],
      playedIds: base.playedIds || [],
      skippedIds: base.skippedIds || [],
    };
  } catch { return null; }
}

function saveSession(session: Session) {
  localStorage.setItem("maggie_active_session", JSON.stringify(session));
}

// ─── Performance Note Modal ───────────────────────────────

function PerfNoteModal({
  song,
  setlistId,
  gigDate,
  existing,
  onClose,
}: {
  song: Song;
  setlistId: string;
  gigDate?: string;
  existing?: PerformanceNote;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [crowdReaction, setCrowdReaction] = useState(existing?.crowdReaction ?? 3);
  const [tempoFeel, setTempoFeel] = useState<PerformanceNote["tempoFeel"]>(existing?.tempoFeel ?? "Spot-on");
  const [lyricsConfidence, setLyricsConfidence] = useState<PerformanceNote["lyricsConfidence"]>(existing?.lyricsConfidence ?? "Good");
  const [notes, setNotes] = useState(existing?.notes ?? "");

  const handleSave = () => {
    if (existing) {
      perfNotesStore.upsert({ ...existing, crowdReaction, tempoFeel, lyricsConfidence, notes });
    } else {
      perfNotesStore.create({ setlistId, songId: song.id, gigDate, crowdReaction, tempoFeel, lyricsConfidence, notes });
    }
    toast({ title: "Notes saved!" });
    onClose();
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
          {/* Crowd reaction */}
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
                    className={`w-6 h-6 transition-colors ${
                      n <= crowdReaction
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Tempo feel */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5 block">Tempo Feel</Label>
              <Select value={tempoFeel} onValueChange={(v) => setTempoFeel(v as PerformanceNote["tempoFeel"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dragged">Dragged</SelectItem>
                  <SelectItem value="Spot-on">Spot-on ✓</SelectItem>
                  <SelectItem value="Rushed">Rushed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Lyrics Confidence</Label>
              <Select value={lyricsConfidence} onValueChange={(v) => setLyricsConfidence(v as PerformanceNote["lyricsConfidence"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Good">Good ✓</SelectItem>
                  <SelectItem value="Blanked">Blanked</SelectItem>
                  <SelectItem value="Stumbled">Stumbled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Free notes */}
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
            <Button onClick={handleSave} className="flex-1">Save Notes</Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
}: {
  song: Song;
  status: "pending" | "played" | "skipped";
  isNext: boolean;
  onMarkPlayed: () => void;
  onMarkSkipped: () => void;
  onUndo: () => void;
  onAddNote: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: song.id });

  const rowClass =
    status === "played"
      ? "opacity-50 bg-card"
      : status === "skipped"
      ? "opacity-40 bg-card line-through"
      : isNext
      ? "bg-primary/10 border-primary/40 shadow-sm"
      : "bg-card";

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 border border-border rounded-xl px-3 py-2.5 transition-all ${rowClass} ${isDragging ? "opacity-50 shadow-lg z-50" : ""}`}
    >
      <span {...attributes} {...listeners} className="drag-handle cursor-grab text-muted-foreground shrink-0">
        <GripVertical className="w-4 h-4" />
      </span>

      {isNext && (
        <div className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium text-sm ${status === "skipped" ? "line-through" : ""}`}>
            {song.title}
          </span>
          {song.capo && song.capo !== "No capo" && (
            <Badge className="capo-badge text-[10px] shrink-0">{song.capo}</Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">{song.artist} · {song.key.split(" ")[0]}</div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 text-muted-foreground hover:text-foreground"
          onClick={onAddNote}
          title="Add performance note"
        >
          <ClipboardList className="w-3.5 h-3.5" />
        </Button>

        {status !== "pending" ? (
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onUndo} title="Undo">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-muted-foreground"
              onClick={onMarkSkipped}
              title="Skip"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-green-600 dark:text-green-400"
              onClick={onMarkPlayed}
              title="Mark played"
            >
              <CheckCircle2 className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Glance Mode ─────────────────────────────────────────

function GlanceView({ next, upcoming }: { next: Song | null; upcoming: Song[] }) {
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-8 text-center">
      {next ? (
        <>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Next Up</div>
          <div className="font-display font-bold text-4xl italic mb-2">{next.title}</div>
          <div className="text-muted-foreground text-lg mb-4">{next.artist}</div>
          {next.capo && next.capo !== "No capo" && (
            <Badge className="capo-badge text-base px-4 py-1 mb-4">{next.capo}</Badge>
          )}
          <div className="text-sm text-muted-foreground mb-8">{next.key}</div>
          {upcoming.slice(1, 4).length > 0 && (
            <div className="border-t border-border pt-6 w-full max-w-xs">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Coming Up</div>
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
          <div className="font-display font-bold text-2xl italic">All done!</div>
          <div className="text-sm mt-2">Great show!</div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────

export default function StagePage() {
  const songs = songsStore.getAll();
  const [session, setSessionState] = useState<Session | null>(() => loadSession());
  const [glanceMode, setGlanceMode] = useState(false);
  const [noteModalSong, setNoteModalSong] = useState<Song | null>(null);

  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Derive setlist info
  const setlist = session ? setlistsStore.getAll().find((sl) => sl.id === session.setlistId) : null;

  const updateSession = (update: Partial<Session>) => {
    if (!session) return;
    const next: Session = { ...session, ...update };
    saveSession(next);
    setSessionState(next);
  };

  const orderedIds = session?.orderedSongIds ?? [];
  const playedIds = session?.playedIds ?? [];
  const skippedIds = session?.skippedIds ?? [];

  const orderedSongs = orderedIds.map((id) => songs.find((s) => s.id === id)).filter(Boolean) as Song[];
  const pendingSongs = orderedSongs.filter((s) => !playedIds.includes(s.id) && !skippedIds.includes(s.id));
  const nextSong = pendingSongs[0] ?? null;

  const getStatus = (song: Song): "played" | "skipped" | "pending" => {
    if (playedIds.includes(song.id)) return "played";
    if (skippedIds.includes(song.id)) return "skipped";
    return "pending";
  };

  const markPlayed = (id: string) => {
    updateSession({
      playedIds: [...playedIds, id],
      skippedIds: skippedIds.filter((x) => x !== id),
    });
  };

  const markSkipped = (id: string) => {
    updateSession({
      skippedIds: [...skippedIds, id],
      playedIds: playedIds.filter((x) => x !== id),
    });
  };

  const undo = (id: string) => {
    updateSession({
      playedIds: playedIds.filter((x) => x !== id),
      skippedIds: skippedIds.filter((x) => x !== id),
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const newIds = arrayMove(orderedIds, orderedIds.indexOf(active.id as string), orderedIds.indexOf(over.id as string));
      updateSession({ orderedSongIds: newIds });
    }
  };

  const clearSession = () => {
    localStorage.removeItem("maggie_active_session");
    setSessionState(null);
  };

  if (!session || orderedIds.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <div className="text-5xl mb-4">🎤</div>
        <div className="font-display font-bold text-xl italic mb-2">No Active Set</div>
        <p className="text-sm max-w-sm mx-auto mb-6">
          Go to Setlists, pick a gig, and hit "Load Tonight" to start the stage manager.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display font-bold text-xl italic mb-0.5">Stage Manager</h1>
          <p className="text-muted-foreground text-sm">
            {playedIds.length} played · {pendingSongs.length} remaining · {skippedIds.length} skipped
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGlanceMode(true)}
            className="gap-1.5"
          >
            <Maximize2 className="w-3.5 h-3.5" /> At-a-Glance
          </Button>
          <Button variant="ghost" size="sm" onClick={clearSession} className="text-muted-foreground gap-1.5">
            <X className="w-3.5 h-3.5" /> End Set
          </Button>
        </div>
      </div>

      {/* Next up highlight */}
      {nextSong && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 mb-5 flex items-center gap-4">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">Next Up</div>
            <div className="font-display font-bold text-lg italic">{nextSong.title}</div>
            <div className="text-sm text-muted-foreground">{nextSong.artist} · {nextSong.key.split("(")[0].trim()}</div>
          </div>
          {nextSong.capo && nextSong.capo !== "No capo" && (
            <Badge className="capo-badge text-sm px-3 py-1">{nextSong.capo}</Badge>
          )}
          <Button
            size="sm"
            onClick={() => markPlayed(nextSong.id)}
            className="gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" /> Done
          </Button>
        </div>
      )}

      {/* Full set list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {orderedSongs.map((song) => (
              <StageSongRow
                key={song.id}
                song={song}
                status={getStatus(song)}
                isNext={song.id === nextSong?.id}
                onMarkPlayed={() => markPlayed(song.id)}
                onMarkSkipped={() => markSkipped(song.id)}
                onUndo={() => undo(song.id)}
                onAddNote={() => setNoteModalSong(song)}
              />
            ))}
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

      {/* Performance note modal */}
      {noteModalSong && (
        <PerfNoteModal
          song={noteModalSong}
          setlistId={session.setlistId}
          gigDate={setlist?.gigDate}
          existing={perfNotesStore.getForSetlist(session.setlistId).find((n) => n.songId === noteModalSong.id)}
          onClose={() => setNoteModalSong(null)}
        />
      )}
    </div>
  );
}
