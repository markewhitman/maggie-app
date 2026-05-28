import { useState, useEffect, useRef } from "react";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { songsStore, setlistsStore, perfNotesStore, formatDuration, formatDurationLong, stageTimingStore, type Song, type PerformanceNote, type StageTimingPrefs } from "@/lib/data";
import { sbSession, sbRequests, sbSongPdfs, type SbRequest } from "@/lib/supabase";
import { SongDetailModal } from "@/components/SongDetailModal";
import { FullscreenPdfViewer } from "@/components/FullscreenPdfViewer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, SkipForward, RotateCcw, GripVertical, Star,
  Maximize2, ClipboardList, X, Pencil, Plus, Search, FileText, Bell,
  ThumbsUp, ThumbsDown, Shuffle, Info, Music2, Clock,
} from "lucide-react";

// ─── Session type ─────────────────────────────────────────

interface Session {
  setlistId: string;
  orderedSongIds: string[];
  playedIds: string[];
  skippedIds: string[];
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
  song, setlistId, gigDate, existing, onClose,
}: {
  song: Song; setlistId: string; gigDate?: string; existing?: PerformanceNote; onClose: () => void;
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
          <div>
            <Label className="text-xs mb-2 block">Crowd Reaction</Label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setCrowdReaction(n)} className="p-1">
                  <Star className={`w-6 h-6 transition-colors ${n <= crowdReaction ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                </button>
              ))}
            </div>
          </div>
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
          <div>
            <Label className="text-xs mb-1.5 block">Additional Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Crowd loved it, key change tricky, nail the bridge…" rows={3} />
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

// ─── Edit Setlist Modal ───────────────────────────────────

function EditSetlistModal({
  session, allSongs, onSave, onClose,
}: {
  session: Session; allSongs: Song[]; onSave: (newIds: string[]) => void; onClose: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([...session.orderedSongIds]);
  const [search, setSearch] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSelectedIds((ids) => arrayMove(ids, ids.indexOf(active.id as string), ids.indexOf(over.id as string)));
    }
  };

  const toggleSong = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const available = allSongs.filter(
    (s) => !selectedIds.includes(s.id) &&
      (search === "" || s.title.toLowerCase().includes(search.toLowerCase()) || s.artist.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display italic">Edit Active Setlist</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs mb-2 block">Set Order ({selectedIds.length} songs) — drag to reorder</Label>
            {selectedIds.length === 0 ? (
              <div className="border border-dashed border-border rounded-xl p-6 text-center text-sm text-muted-foreground">Add songs below</div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={selectedIds} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1.5">
                    {selectedIds.map((id) => {
                      const song = allSongs.find((s) => s.id === id);
                      if (!song) return null;
                      return <EditDraggableSong key={id} id={id} song={song} onRemove={() => toggleSong(id)} />;
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
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search songs…" className="pl-8 h-8 text-sm" />
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
                  <span className="text-xs text-muted-foreground">{song.artist}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => onSave(selectedIds)} className="flex-1">Update Set</Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditDraggableSong({ id, song, onRemove }: { id: string; song: Song; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 ${isDragging ? "opacity-50 shadow-lg" : ""}`}
    >
      <span {...attributes} {...listeners} className="cursor-grab text-muted-foreground">
        <GripVertical className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{song.title}</div>
        <div className="text-xs text-muted-foreground">{song.artist}</div>
      </div>
      {song.capo && song.capo !== "No capo" && <Badge className="capo-badge text-xs shrink-0">{song.capo}</Badge>}
      <Button variant="ghost" size="icon" className="w-6 h-6 shrink-0" onClick={onRemove}>
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

// ─── Sortable Stage Song Row ──────────────────────────────

function StageSongRow({
  song, status, isNext, onMarkPlayed, onMarkSkipped, onUndo, onAddNote,
  onViewSheet, onViewCard, hasPdf,
  songDuration, cumulativeTime, clockTime,
  showDuration, showCumulative, showClock,
}: {
  song: Song; status: "pending" | "played" | "skipped"; isNext: boolean;
  onMarkPlayed: () => void; onMarkSkipped: () => void; onUndo: () => void;
  onAddNote: () => void; onViewSheet: () => void; onViewCard: () => void; hasPdf: boolean;
  songDuration: number;
  cumulativeTime: number;   // seconds from show start at which this song ends
  clockTime: Date | null;   // wall-clock time this song starts (null if no start time)
  showDuration: boolean;
  showCumulative: boolean;
  showClock: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: song.id });

  const rowClass =
    status === "played" ? "opacity-50 bg-card"
    : status === "skipped" ? "opacity-40 bg-card line-through"
    : isNext ? "bg-primary/10 border-primary/40 shadow-sm"
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
      {isNext && <div className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse" />}

      {/* Tappable title area — opens sheet music if available, otherwise song card */}
      <button
        className="flex-1 min-w-0 text-left"
        onClick={hasPdf ? onViewSheet : onViewCard}
        title={hasPdf ? "Tap to view sheet music" : "Tap to view song details"}
      >
        <div className="flex items-center gap-2">
          <span className={`font-medium text-sm ${status === "skipped" ? "line-through" : ""}`}>{song.title}</span>
          {song.capo && song.capo !== "No capo" && <Badge className="capo-badge text-[10px] shrink-0">{song.capo}</Badge>}
          {hasPdf && <FileText className="w-3 h-3 text-primary/60 shrink-0" />}
        </div>
        <div className="text-xs text-muted-foreground">
          {song.artist} · {song.key.split(" ")[0]}
        </div>
      </button>

      {/* ── Timing columns ── */}
      {showDuration && (
        <div className="shrink-0 w-12 text-right">
          <div className="text-xs font-mono font-medium text-muted-foreground">
            {formatDuration(songDuration)}
          </div>
        </div>
      )}
      {showCumulative && (
        <div className="shrink-0 w-14 text-right">
          <div className="text-xs font-mono font-medium text-primary/80">
            {formatDuration(cumulativeTime)}
          </div>
        </div>
      )}
      {showClock && clockTime && (
        <div className="shrink-0 w-14 text-right">
          <div className="text-xs font-mono font-medium text-amber-600 dark:text-amber-400">
            {clockTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 shrink-0">
        {/* Info icon — always opens song card */}
        <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-foreground" onClick={onViewCard} title="Song details">
          <Info className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-foreground" onClick={onAddNote} title="Add performance note">
          <ClipboardList className="w-3.5 h-3.5" />
        </Button>
        {status !== "pending" ? (
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onUndo} title="Undo">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground" onClick={onMarkSkipped} title="Skip">
              <SkipForward className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="w-7 h-7 text-green-600 dark:text-green-400" onClick={onMarkPlayed} title="Mark played">
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
          {next.capo && next.capo !== "No capo" && <Badge className="capo-badge text-base px-4 py-1 mb-4">{next.capo}</Badge>}
          <div className="text-sm text-muted-foreground mb-8">{next.key}</div>
          {upcoming.slice(1, 4).length > 0 && (
            <div className="border-t border-border pt-6 w-full max-w-xs">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Coming Up</div>
              {upcoming.slice(1, 4).map((s, i) => (
                <div key={s.id} className="text-sm py-1 text-muted-foreground">{i + 1}. {s.title}</div>
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

// ─── Requests Panel ──────────────────────────────────────

const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
  approved: { label: "Approved", color: "text-green-600 dark:text-green-400" },
  denied: { label: "Declined", color: "text-red-500" },
  alternative: { label: "Alternative", color: "text-amber-600 dark:text-amber-400" },
};

function RequestsPanel({
  requests, songs, onApprove, onDeny, onSuggest, onClearAll, onClose,
}: {
  requests: SbRequest[];
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
      const data = await sbRequests.getLog();
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
  log.forEach((r) => { freqMap[r.song_title] = (freqMap[r.song_title] ?? 0) + 1; });
  const topRequests = Object.entries(freqMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-display italic flex items-center gap-2">
            <Bell className="w-4 h-4" /> Audience Requests
            {requests.length > 0 && (
              <Badge className="bg-primary text-primary-foreground ml-1">{requests.length}</Badge>
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
                  <p className="text-xs mt-1 opacity-60">Updates every 30 seconds</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {requests.map((req) => {
                    const song = songs.find((s) => s.id === req.song_id);
                    return (
                      <div key={req.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-sm truncate">{req.song_title}</span>
                            {req.is_write_in && (
                              <Badge variant="outline" className="text-[10px] shrink-0">write-in</Badge>
                            )}
                          </div>
                          {song && <div className="text-xs text-muted-foreground">{song.artist} · {song.key?.split(" ")[0]}</div>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="icon" variant="ghost"
                            className="w-7 h-7 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                            title="Approve — adds to setlist"
                            onClick={() => onApprove(req)}
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost"
                            className="w-7 h-7 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                            title="Suggest alternative"
                            onClick={() => onSuggest(req)}
                          >
                            <Shuffle className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost"
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
                  <Button variant="ghost" size="sm"
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
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Most Requested</div>
                  <div className="space-y-1.5">
                    {topRequests.map(([title, count]) => (
                      <div key={title} className="flex items-center gap-2">
                        <div className="flex-1 text-sm truncate">{title}</div>
                        <div className="flex items-center gap-1">
                          <div
                            className="h-2 bg-primary/60 rounded-full"
                            style={{ width: `${Math.max(20, (count / (topRequests[0][1] || 1)) * 80)}px` }}
                          />
                          <span className="text-xs font-semibold text-muted-foreground w-5 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full log */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Full Log</div>
                {logLoading ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">Loading…</div>
                ) : log.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">No history yet</div>
                ) : (
                  <div className="space-y-1">
                    {log.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-2 py-1.5 border-b border-border/40 last:border-0">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm truncate block">{entry.song_title}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.requested_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            {entry.is_write_in && " · write-in"}
                          </span>
                        </div>
                        <span className={`text-xs font-medium shrink-0 ${
                          OUTCOME_LABELS[entry.outcome]?.color ?? "text-muted-foreground"
                        }`}>
                          {OUTCOME_LABELS[entry.outcome]?.label ?? entry.outcome}
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
  const songs = songsStore.getAll();
  const [session, setSessionState] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [glanceMode, setGlanceMode] = useState(false);
  const [noteModalSong, setNoteModalSong] = useState<Song | null>(null);
  const [sheetSong, setSheetSong] = useState<Song | null>(null);
  const [fullscreenPdfSong, setFullscreenPdfSong] = useState<Song | null>(null);
  const [cardSong, setCardSong] = useState<Song | null>(null);
  const [showEditSetlist, setShowEditSetlist] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [requests, setRequests] = useState<SbRequest[]>([]);
  const [pdfMap, setPdfMap] = useState<Record<string, { url: string; name: string }>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Timing state ─────────────────────────────────────────
  const [stageStartTime, setStageStartTime] = useState<string>(""); // "HH:MM" 24h
  const [showStartTimeEdit, setShowStartTimeEdit] = useState(false);
  const [colPrefs, setColPrefs] = useState<StageTimingPrefs>(() => stageTimingStore.getPrefs());

  const toggleCol = (col: keyof StageTimingPrefs) => {
    setColPrefs((prev) => {
      const next = { ...prev, [col]: !prev[col] };
      stageTimingStore.savePrefs(next);
      return next;
    });
  };

  const { toast } = useToast();

  // Load session from Supabase on mount
  useEffect(() => {
    sbSession.get().then((s) => {
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
    }).catch(() => setSessionLoading(false));
  }, []);

  // Load PDF map so we know which songs have sheet music
  useEffect(() => {
    sbSongPdfs.getAll().then(setPdfMap).catch(() => {});
  }, []);

  // Poll for audience requests every 30 s
  useEffect(() => {
    const fetchRequests = () => {
      sbRequests.getPending().then(setRequests).catch(() => {});
    };
    fetchRequests();
    pollRef.current = setInterval(fetchRequests, 30000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleApprove = async (req: SbRequest) => {
    await sbRequests.resolve(req, "approved");
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
    // Add the song to the active setlist if it's in the catalogue and not already there
    if (req.song_id && session) {
      const alreadyIn = session.orderedSongIds.includes(req.song_id);
      if (!alreadyIn) {
        const newIds = [...session.orderedSongIds, req.song_id];
        updateSession({ orderedSongIds: newIds });
        toast({ title: "Added to setlist!", description: `“${req.song_title}” added to the end of the set` });
      } else {
        toast({ title: "Approved", description: `“${req.song_title}” is already in the set` });
      }
    } else if (req.is_write_in) {
      toast({ title: "Approved (write-in)", description: `“${req.song_title}” noted — not in catalogue` });
    }
  };

  const handleDeny = async (req: SbRequest) => {
    await sbRequests.resolve(req, "denied");
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
    toast({ title: "Declined", description: `“${req.song_title}” removed from queue` });
  };

  const handleSuggestAlternative = async (req: SbRequest) => {
    await sbRequests.resolve(req, "alternative");
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
    const reqSong = songs.find((s) => s.id === req.song_id);
    const alternatives = songs.filter(
      (s) => s.id !== req.song_id &&
        (s.genre === reqSong?.genre || (reqSong?.similar ?? []).includes(s.title))
    );
    if (alternatives.length > 0) {
      const alt = alternatives[Math.floor(Math.random() * alternatives.length)];
      toast({ title: "Suggested alternative", description: `How about “${alt.title}” by ${alt.artist}?` });
    } else {
      toast({ title: "No similar songs found", description: "Consider picking one manually from the setlist" });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
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

  const orderedSongs = orderedIds.map((id) => songs.find((s) => s.id === id)).filter(Boolean) as Song[];
  const pendingSongs = orderedSongs.filter((s) => !playedIds.includes(s.id) && !skippedIds.includes(s.id));
  const nextSong = pendingSongs[0] ?? null;

  const getStatus = (song: Song): "played" | "skipped" | "pending" => {
    if (playedIds.includes(song.id)) return "played";
    if (skippedIds.includes(song.id)) return "skipped";
    return "pending";
  };

  const markPlayed = (id: string) => updateSession({ playedIds: [...playedIds, id], skippedIds: skippedIds.filter((x) => x !== id) });
  const markSkipped = (id: string) => updateSession({ skippedIds: [...skippedIds, id], playedIds: playedIds.filter((x) => x !== id) });
  const undo = (id: string) => updateSession({ playedIds: playedIds.filter((x) => x !== id), skippedIds: skippedIds.filter((x) => x !== id) });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      updateSession({ orderedSongIds: arrayMove(orderedIds, orderedIds.indexOf(active.id as string), orderedIds.indexOf(over.id as string)) });
    }
  };

  const clearSession = () => {
    sbSession.clear(); // async, fire-and-forget
    setSessionState(null);
  };

  const handleEditSave = (newIds: string[]) => {
    updateSession({ orderedSongIds: newIds });
    // Also update the saved setlist
    if (session) {
      setlistsStore.update(session.setlistId, { songIds: newIds });
    }
    setShowEditSetlist(false);
    toast({ title: "Setlist updated!" });
  };

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
        <div className="font-display font-bold text-xl italic mb-2">No Active Set</div>
        <p className="text-sm max-w-sm mx-auto mb-6">Go to Setlists, pick a gig, and hit "Load Tonight" to start the stage manager.</p>
      </div>
    );
  }

  // ─── Runtime calculations ─────────────────────────────────
  const DEFAULT_DUR = 210;
  const BETWEEN_GAP = 30; // 30s between songs
  const timePlayed = orderedSongs
    .filter((s) => playedIds.includes(s.id))
    .reduce((sum, s) => sum + (s.duration ?? DEFAULT_DUR), 0);
  const timeRemaining = pendingSongs
    .reduce((sum, s) => sum + (s.duration ?? DEFAULT_DUR), 0);

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
    const clock = startDate ? new Date(startDate.getTime() + startSec * 1000) : null;
    songTimings.push({ songId: song.id, songDuration: dur, cumulativeTime: endSec, clockTime: clock });
    elapsed = endSec + BETWEEN_GAP;
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display font-bold text-xl italic mb-0.5">Stage Manager</h1>
          <p className="text-muted-foreground text-sm">
            {playedIds.length} played · {pendingSongs.length} remaining · {skippedIds.length} skipped
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
            {timePlayed > 0 && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{formatDurationLong(timePlayed)} played</span>
              </span>
            )}
            {timeRemaining > 0 && (
              <span className="text-xs text-muted-foreground">
                ~{formatDurationLong(timeRemaining)} remaining
              </span>
            )}
            {/* Start time display / edit */}
            <div className="flex items-center gap-1.5">
              {showStartTimeEdit ? (
                <div className="flex items-center gap-1">
                  <input
                    type="time"
                    value={stageStartTime}
                    onChange={(e) => {
                      const v = e.target.value;
                      setStageStartTime(v);
                      if (session) stageTimingStore.setStartTime(session.setlistId, v);
                    }}
                    className="text-xs bg-background border border-border rounded px-1.5 py-0.5 font-mono w-24"
                    autoFocus
                    onBlur={() => setShowStartTimeEdit(false)}
                  />
                </div>
              ) : (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  onClick={() => setShowStartTimeEdit(true)}
                  title="Set / adjust show start time"
                >
                  <Clock className="w-3 h-3" />
                  {stageStartTime ? (() => {
                    const [h, m] = stageStartTime.split(":").map(Number);
                    const ap = h >= 12 ? "PM" : "AM";
                    return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ap}`;
                  })() : <span className="opacity-60 italic">Set start time</span>}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => { setShowRequests((p) => !p); }}
            className="gap-1.5 relative"
          >
            <Bell className="w-3.5 h-3.5" /> Requests
            {requests.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold">
                {requests.length}
              </span>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowEditSetlist(true)} className="gap-1.5">
            <Pencil className="w-3.5 h-3.5" /> Edit Set
          </Button>
          <Button variant="outline" size="sm" onClick={() => setGlanceMode(true)} className="gap-1.5">
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
          {nextSong.capo && nextSong.capo !== "No capo" && <Badge className="capo-badge text-sm px-3 py-1">{nextSong.capo}</Badge>}
          <Button size="sm" onClick={() => markPlayed(nextSong.id)} className="gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Done
          </Button>
        </div>
      )}

      {/* Column visibility toggles + column headers */}
      <div className="mb-2 space-y-1.5">
        {/* Toggle pill row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground mr-1">Columns:</span>
          {([
            { key: "showDuration" as keyof StageTimingPrefs, label: "Dur" },
            { key: "showCumulative" as keyof StageTimingPrefs, label: "Total" },
            { key: "showClock" as keyof StageTimingPrefs, label: "Clock" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => toggleCol(key)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-colors ${
                colPrefs[key]
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Column header labels aligned with song rows */}
        {(colPrefs.showDuration || colPrefs.showCumulative || colPrefs.showClock) && (
          <div className="flex items-center gap-2 px-3 py-0">
            {/* spacers for: drag handle, (optional pulse dot), title area flex-1 */}
            <span className="w-4 shrink-0" />{/* drag handle */}
            <span className="flex-1" />{/* title area */}
            {colPrefs.showDuration && (
              <span className="shrink-0 w-12 text-right text-[10px] uppercase tracking-widest text-muted-foreground/60">Dur</span>
            )}
            {colPrefs.showCumulative && (
              <span className="shrink-0 w-14 text-right text-[10px] uppercase tracking-widest text-muted-foreground/60">Total</span>
            )}
            {colPrefs.showClock && (
              <span className="shrink-0 w-14 text-right text-[10px] uppercase tracking-widest text-muted-foreground/60">Clock</span>
            )}
            <span className="w-[108px] shrink-0" />{/* action buttons placeholder */}
          </div>
        )}
      </div>

      {/* Full set list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
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
          existing={perfNotesStore.getForSetlist(session.setlistId).find((n) => n.songId === noteModalSong.id)}
          onClose={() => setNoteModalSong(null)}
        />
      )}

      {/* Sheet music — goes FULLSCREEN directly for performance use */}
      {fullscreenPdfSong && (() => {
        const url = pdfMap[fullscreenPdfSong.id]?.url ?? fullscreenPdfSong.pdfUrl;
        return url ? (
          <FullscreenPdfViewer
            pdfUrl={url}
            songTitle={fullscreenPdfSong.title}
            onClose={() => setFullscreenPdfSong(null)}
          />
        ) : null;
      })()}

      {/* Sheet music modal fallback (no pdf uploaded) — opens info tab */}
      {sheetSong && (
        <SongDetailModal
          song={{ ...sheetSong, pdfUrl: pdfMap[sheetSong.id]?.url ?? sheetSong.pdfUrl }}
          onClose={() => setSheetSong(null)}
          defaultTab="pdf"
        />
      )}

      {/* Song card modal (info icon) */}
      {cardSong && (
        <SongDetailModal
          song={{ ...cardSong, pdfUrl: pdfMap[cardSong.id]?.url ?? cardSong.pdfUrl }}
          onClose={() => setCardSong(null)}
        />
      )}

      {/* Audience Requests Panel */}
      {showRequests && (
        <RequestsPanel
          requests={requests}
          songs={songs}
          onApprove={handleApprove}
          onDeny={handleDeny}
          onSuggest={handleSuggestAlternative}
          onClearAll={async () => { await sbRequests.clearAll(); setRequests([]); }}
          onClose={() => setShowRequests(false)}
        />
      )}
    </div>
  );
}
