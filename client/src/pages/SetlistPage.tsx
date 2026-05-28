import { useState, useEffect } from "react";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { songsStore, type Song, type Setlist, type Venue, formatDuration, formatDurationLong, stageTimingStore } from "@/lib/data";
import { sbSetlists, sbVenues, sbSession, getDeviceId, type SbSetlist, type SbVenue } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useConfirmDialog } from "@/hooks/use-confirm";
import {
  Plus, GripVertical, X, Trash2, Mic2, Search, Calendar, MapPin, ChevronDown, ChevronUp, Pencil, RefreshCw, Wifi, Clock, Coffee, Flag,
} from "lucide-react";

// ─── Helpers: map Supabase rows ↔ local types ─────────────

function sbToSetlist(r: SbSetlist): Setlist {
  return {
    id: r.id,
    name: r.name,
    gigDate: r.gig_date ?? undefined,
    gigStartTime: r.gig_start_time ?? undefined,
    venueId: r.venue_id ?? undefined,
    songIds: r.song_ids,
    createdAt: r.created_at,
  };
}

function sbToVenue(r: SbVenue): Venue {
  return {
    id: r.id,
    name: r.name,
    city: r.city ?? undefined,
    notes: r.notes ?? undefined,
    gigCount: r.gig_count,
    createdAt: r.created_at,
  };
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Sortable Item ────────────────────────────────────────

function DraggableSong({ id, song, onRemove }: { id: string; song: Song; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 ${isDragging ? "opacity-50 shadow-lg" : ""}`}
    >
      <span {...attributes} {...listeners} className="drag-handle cursor-grab text-muted-foreground">
        <GripVertical className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{song?.title ?? id}</div>
        {song && (
          <div className="text-xs text-muted-foreground">
            {song.artist}
            {song.duration && <span className="ml-1 opacity-70">· {formatDuration(song.duration)}</span>}
          </div>
        )}
      </div>
      {song?.capo && song.capo !== "No capo" && (
        <Badge className="capo-badge text-xs shrink-0">{song.capo}</Badge>
      )}
      <Button variant="ghost" size="icon" className="w-6 h-6 shrink-0" onClick={onRemove}>
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

// ─── Venue Selector ──────────────────────────────────────

function VenueSelector({
  venues, value, onChange, onNewVenue,
}: {
  venues: Venue[];
  value: string;
  onChange: (id: string) => void;
  onNewVenue: (name: string) => Promise<Venue>;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const v = await onNewVenue(newName.trim());
    onChange(v.id);
    setNewName("");
    setCreating(false);
  };

  if (creating) {
    return (
      <div className="flex gap-2">
        <Input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="Venue name…"
          className="flex-1"
        />
        <Button size="sm" onClick={handleCreate}>Add</Button>
        <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>Cancel</Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Select venue (optional)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">— No venue —</SelectItem>
          {venues.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.name}{v.city ? ` · ${v.city}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" className="gap-1 shrink-0" onClick={() => setCreating(true)}>
        <Plus className="w-3.5 h-3.5" /> New
      </Button>
    </div>
  );
}


// ─── Runtime Timeline ─────────────────────────────────────

const DEFAULT_SONG_DURATION = 210; // 3:30 fallback if song has no duration set
const DEFAULT_BETWEEN_GAP = 30;    // 30s gap between songs (tuning/chat)

function RuntimeTimeline({ songs }: { songs: Song[] }) {
  const [intermissions, setIntermissions] = useState<number[]>([]);
  const [intermissionDuration, setIntermissionDuration] = useState(15);

  const toggleIntermission = (afterIndex: number) => {
    setIntermissions((prev) =>
      prev.includes(afterIndex)
        ? prev.filter((i) => i !== afterIndex)
        : [...prev, afterIndex].sort((a, b) => a - b)
    );
  };

  const rows: { song: Song; startsAt: number }[] = [];
  let elapsed = 0;
  songs.forEach((song, i) => {
    const dur = song.duration ?? DEFAULT_SONG_DURATION;
    rows.push({ song, startsAt: elapsed });
    elapsed += dur + DEFAULT_BETWEEN_GAP;
    if (intermissions.includes(i)) {
      elapsed += intermissionDuration * 60;
    }
  });

  const totalMusicTime = songs.reduce((sum, s) => sum + (s.duration ?? DEFAULT_SONG_DURATION), 0);
  const totalShowTime = rows.length > 0
    ? rows[rows.length - 1].startsAt + (songs[songs.length - 1]?.duration ?? DEFAULT_SONG_DURATION) + intermissions.length * intermissionDuration * 60
    : 0;
  const hasMissingDurations = songs.some((s) => !s.duration);

  return (
    <div className="border-t border-border pt-3 mt-1 space-y-3">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-3 px-1">
        <div className="flex items-center gap-1.5 text-xs">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span className="font-semibold">Music:</span>
          <span className="text-muted-foreground">{formatDurationLong(totalMusicTime)}</span>
        </div>
        {intermissions.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs">
            <Coffee className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-semibold">Breaks:</span>
            <span className="text-muted-foreground">{formatDurationLong(intermissions.length * intermissionDuration * 60)}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-xs">
          <Flag className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
          <span className="font-semibold">~Show total:</span>
          <span className="text-muted-foreground">{formatDurationLong(totalShowTime)}</span>
        </div>
        {hasMissingDurations && (
          <span className="text-[10px] text-muted-foreground/50 italic">*estimated for unset songs</span>
        )}
      </div>

      {/* Intermission length picker */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs text-muted-foreground">Intermission:</span>
        {[10, 15, 20, 30].map((min) => (
          <button
            key={min}
            onClick={() => setIntermissionDuration(min)}
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
              intermissionDuration === min
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {min}m
          </button>
        ))}
      </div>

      {/* Per-song rows */}
      <div className="space-y-0.5">
        {rows.map(({ song, startsAt }, i) => (
          <div key={song.id}>
            <div className="flex items-center gap-2 text-sm py-0.5">
              <span className="w-5 text-right text-muted-foreground text-xs shrink-0">{i + 1}</span>
              <span className="flex-1 truncate">{song.title}</span>
              <span className="text-xs text-muted-foreground/70 shrink-0">
                {formatDuration(song.duration ?? DEFAULT_SONG_DURATION)}
                {!song.duration && <span className="text-[10px] ml-0.5 opacity-50">*</span>}
              </span>
              <span className="text-xs text-muted-foreground/50 w-12 text-right shrink-0 font-mono">
                @{Math.floor(startsAt / 60)}:{(startsAt % 60).toString().padStart(2, "0")}
              </span>
            </div>
            {i < songs.length - 1 && (
              <button
                className={`flex items-center gap-1 text-[10px] ml-7 px-2 py-0.5 rounded-full border transition-colors my-0.5 ${
                  intermissions.includes(i)
                    ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700"
                    : "text-muted-foreground/40 border-border/40 hover:border-amber-300 hover:text-amber-600"
                }`}
                onClick={() => toggleIntermission(i)}
              >
                <Coffee className="w-2.5 h-2.5" />
                {intermissions.includes(i) ? `☕ Intermission (${intermissionDuration}m) ×` : "+ Intermission"}
              </button>
            )}
          </div>
        ))}
      </div>

      {rows.length > 0 && (
        <div className="flex items-center gap-2 text-xs bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
          <Flag className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
          <span className="font-semibold">Est. show end:</span>
          <span className="text-muted-foreground">
            ~{formatDurationLong(totalShowTime)} from start
            {intermissions.length > 0 && ` (incl. ${intermissions.length} intermission${intermissions.length > 1 ? "s" : ""})`}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Setlist Card ─────────────────────────────────────────

function SetlistCard({
  setlist, songs, venues, onDelete, onLoad, onEdit,
}: {
  setlist: Setlist;
  songs: Song[];
  venues: Venue[];
  onDelete: () => void;
  onLoad: () => void;
  onEdit: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const venue = venues.find((v) => v.id === setlist.venueId);
  const setlistSongs = setlist.songIds
    .map((id) => songs.find((s) => s.id === id))
    .filter(Boolean) as Song[];

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold italic truncate">{setlist.name}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {setlist.gigDate && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {setlist.gigDate}
                </span>
              )}
              {venue && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {venue.name}
                </span>
              )}
              <span className="text-xs text-muted-foreground">{setlistSongs.length} songs</span>
              {setlist.gigStartTime && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {(() => {
                    const [h, m] = setlist.gigStartTime.split(":").map(Number);
                    const ampm = h >= 12 ? "PM" : "AM";
                    const h12 = h % 12 || 12;
                    return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
                  })()}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" onClick={onLoad} className="gap-1.5 text-xs h-8">
              <Mic2 className="w-3.5 h-3.5" /> Load Tonight
            </Button>
            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={onEdit} title="Edit setlist">
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setExpanded((p) => !p)}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={onDelete}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-1.5">
          {/* Song list with artist + capo */}
          {setlistSongs.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 text-sm">
              <span className="w-5 text-right text-muted-foreground text-xs shrink-0">{i + 1}</span>
              <span className="flex-1 truncate">{s.title}</span>
              <span className="text-xs text-muted-foreground shrink-0">{s.artist}</span>
              {s.capo && s.capo !== "No capo" && (
                <Badge className="capo-badge text-[10px] shrink-0">{s.capo}</Badge>
              )}
            </div>
          ))}
          {/* Runtime Timeline */}
          {setlistSongs.length > 0 && <RuntimeTimeline songs={setlistSongs} />}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────

export default function SetlistPage() {
  const [songs] = useState<Song[]>(() => songsStore.getAll());
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [showBuilder, setShowBuilder] = useState(false);
  const [editingSetlistId, setEditingSetlistId] = useState<string | null>(null);
  const [gigName, setGigName] = useState("");
  const [gigDate, setGigDate] = useState("");
  const [gigStartTime, setGigStartTime] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState("none");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [songSearch, setSongSearch] = useState("");
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [activeSessionCount, setActiveSessionCount] = useState(0);

  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ─── Load from Supabase on mount ──────────────────────────
  const loadData = async () => {
    setLoading(true);
    try {
      const [sbSls, sbVens, session] = await Promise.all([
        sbSetlists.getAll(),
        sbVenues.getAll(),
        sbSession.get(),
      ]);
      setSetlists(sbSls.map(sbToSetlist));
      setVenues(sbVens.map(sbToVenue));
      if (session) {
        setHasActiveSession(true);
        setActiveSessionCount(session.ordered_song_ids.length);
      }
    } catch (err) {
      console.error("Supabase load error:", err);
      toast({ title: "Sync error", description: "Could not load from cloud. Check your connection.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ─── Venue creation ───────────────────────────────────────
  const handleNewVenue = async (name: string): Promise<Venue> => {
    const now = new Date().toISOString();
    const newVenue: SbVenue = {
      id: uid(),
      user_id: getDeviceId(),
      name,
      city: null,
      notes: null,
      gig_count: 0,
      created_at: now,
    };
    await sbVenues.save(newVenue);
    const local = sbToVenue(newVenue);
    setVenues((prev) => [...prev, local]);
    return local;
  };

  // ─── Drag & drop ─────────────────────────────────────────
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSelectedIds((ids) => {
        const oldIndex = ids.indexOf(active.id as string);
        const newIndex = ids.indexOf(over.id as string);
        return arrayMove(ids, oldIndex, newIndex);
      });
    }
  };

  const toggleSong = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectedSongs = selectedIds
    .map((id) => songs.find((s) => s.id === id))
    .filter(Boolean) as Song[];

  const filteredSongs = songs.filter(
    (s) =>
      !selectedIds.includes(s.id) &&
      (songSearch === "" ||
        s.title.toLowerCase().includes(songSearch.toLowerCase()) ||
        s.artist.toLowerCase().includes(songSearch.toLowerCase()))
  );

  const resetBuilder = () => {
    setShowBuilder(false);
    setEditingSetlistId(null);
    setGigName("");
    setGigDate("");
    setGigStartTime("");
    setSelectedVenueId("none");
    setSelectedIds([]);
    setSongSearch("");
  };

  const openEdit = (setlist: Setlist) => {
    setEditingSetlistId(setlist.id);
    setGigName(setlist.name);
    setGigDate(setlist.gigDate || "");
    setGigStartTime(setlist.gigStartTime || "");
    setSelectedVenueId(setlist.venueId || "none");
    setSelectedIds([...setlist.songIds]);
    setSongSearch("");
    setShowBuilder(true);
  };

  // ─── Save setlist ─────────────────────────────────────────
  const saveSetlist = async () => {
    if (!gigName.trim()) {
      toast({ title: "Give this gig a name", variant: "destructive" });
      return;
    }
    if (selectedIds.length === 0) {
      toast({ title: "Add at least one song", variant: "destructive" });
      return;
    }
    setSyncing(true);
    const venueId = selectedVenueId === "none" ? null : selectedVenueId;
    const now = new Date().toISOString();

    try {
      if (editingSetlistId) {
        const existing = setlists.find((s) => s.id === editingSetlistId);
        if (existing) {
          await sbSetlists.update(editingSetlistId, {
            name: gigName,
            gig_date: gigDate || null,
            gig_start_time: gigStartTime || null,
            venue_id: venueId,
            song_ids: selectedIds,
          });
          setSetlists((prev) =>
            prev.map((s) =>
              s.id === editingSetlistId
                ? { ...s, name: gigName, gigDate: gigDate || undefined, gigStartTime: gigStartTime || undefined, venueId: venueId ?? undefined, songIds: selectedIds }
                : s
            )
          );
          toast({ title: "Setlist updated!", description: gigName });
        }
      } else {
        const newSl: SbSetlist = {
          id: uid(),
          user_id: getDeviceId(),
          name: gigName,
          gig_date: gigDate || null,
          gig_start_time: gigStartTime || null,
          venue_id: venueId,
          song_ids: selectedIds,
          created_at: now,
        };
        await sbSetlists.save(newSl);
        if (venueId) await sbVenues.incrementGigCount(venueId);
        setSetlists((prev) => [sbToSetlist(newSl), ...prev]);
        toast({ title: "Setlist saved!", description: gigName });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Save failed", description: "Could not save to cloud.", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
    resetBuilder();
  };

  // ─── Load tonight ─────────────────────────────────────────
  const loadSetlist = async (setlist: Setlist) => {
    setSyncing(true);
    // Save the planned start time so Stage page can load it
    if (setlist.gigStartTime) {
      stageTimingStore.setStartTime(setlist.id, setlist.gigStartTime);
    }
    try {
      await sbSession.save({
        setlist_id: setlist.id,
        ordered_song_ids: setlist.songIds,
        played_ids: [],
        skipped_ids: [],
      });
      setHasActiveSession(true);
      setActiveSessionCount(setlist.songIds.length);
      toast({ title: "Set loaded for tonight!", description: "Head to the Stage tab to start." });
    } catch (err) {
      console.error(err);
      toast({ title: "Load failed", description: "Could not sync to cloud.", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const clearSession = async () => {
    const confirmed = await confirm({
      title: "Clear active set?",
      description: "This removes the currently loaded Stage session, but keeps your saved setlists.",
      confirmLabel: "Clear active set",
      destructive: true,
    });
    if (!confirmed) return;
    await sbSession.clear();
    setHasActiveSession(false);
    setActiveSessionCount(0);
  };

  // ─── Delete setlist ───────────────────────────────────────
  const deleteSetlist = async (id: string) => {
    const confirmed = await confirm({
      title: "Delete this setlist?",
      description: "This permanently deletes the saved setlist. This cannot be undone.",
      confirmLabel: "Delete setlist",
      destructive: true,
    });
    if (!confirmed) return;
    setSyncing(true);
    try {
      await sbSetlists.delete(id);
      setSetlists((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-xl italic mb-0.5">Setlists</h1>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground text-sm">Build and save setlists per gig</p>
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <Wifi className="w-3 h-3" /> Synced
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={loadData} title="Refresh from cloud">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => setShowBuilder(true)} className="gap-1.5" data-testid="button-new-setlist">
            <Plus className="w-4 h-4" /> New Setlist
          </Button>
        </div>
      </div>

      {hasActiveSession && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
          <Mic2 className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-semibold">Active set loaded</span>
            <span className="text-muted-foreground ml-2">{activeSessionCount} songs queued</span>
          </div>
          <Button size="sm" variant="outline" onClick={clearSession} className="text-xs gap-1">
            <X className="w-3 h-3" /> Clear
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : setlists.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-4xl mb-3">📋</div>
          <div className="font-medium">No setlists yet</div>
          <div className="text-sm mt-1">Create your first setlist for tonight's gig</div>
        </div>
      ) : (
        <div className="space-y-3">
          {setlists.map((sl) => (
            <SetlistCard
              key={sl.id}
              setlist={sl}
              songs={songs}
              venues={venues}
              onDelete={() => deleteSetlist(sl.id)}
              onLoad={() => loadSetlist(sl)}
              onEdit={() => openEdit(sl)}
            />
          ))}
        </div>
      )}

      {ConfirmDialog}

      {/* Builder Dialog */}
      <Dialog open={showBuilder} onOpenChange={(open) => { if (!open) resetBuilder(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display italic">{editingSetlistId ? "Edit Setlist" : "New Setlist"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Gig Name *</Label>
              <Input value={gigName} onChange={(e) => setGigName(e.target.value)} placeholder="Saturday Night at The Burren" data-testid="input-gig-name" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Calendar className="w-3 h-3" /> Gig Date</Label>
                <Input type="date" value={gigDate} onChange={(e) => setGigDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> Approx. Start Time</Label>
                <Input
                  type="time"
                  value={gigStartTime}
                  onChange={(e) => setGigStartTime(e.target.value)}
                  placeholder="20:00"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3" /> Venue</Label>
              <VenueSelector
                venues={venues}
                value={selectedVenueId}
                onChange={setSelectedVenueId}
                onNewVenue={handleNewVenue}
              />
            </div>

            <div>
              <Label className="text-xs mb-2 block flex items-center gap-2">
              Set Order ({selectedIds.length} songs)
              {selectedIds.length > 0 && (
                <span className="text-muted-foreground font-normal">
                  · ~{formatDurationLong(selectedSongs.reduce((s, song) => s + (song.duration ?? 210), 0))}
                </span>
              )}
            </Label>
              {selectedIds.length === 0 ? (
                <div className="border border-dashed border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
                  Add songs from the list below
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={selectedIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1.5">
                      {selectedIds.map((id) => {
                        const song = songs.find((s) => s.id === id);
                        return song ? (
                          <DraggableSong key={id} id={id} song={song} onRemove={() => toggleSong(id)} />
                        ) : null;
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
                  value={songSearch}
                  onChange={(e) => setSongSearch(e.target.value)}
                  placeholder="Search songs…"
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-xl p-2">
                {filteredSongs.length === 0 ? (
                  <div className="text-center py-4 text-xs text-muted-foreground">All songs added or no matches</div>
                ) : (
                  filteredSongs.map((song) => (
                    <button
                      key={song.id}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-muted transition-colors"
                      onClick={() => toggleSong(song.id)}
                    >
                      <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1">{song.title}</span>
                      <span className="text-xs text-muted-foreground">{song.artist}</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={saveSetlist} className="flex-1" disabled={syncing} data-testid="button-save-setlist">
                {syncing ? "Saving…" : editingSetlistId ? "Update Setlist" : "Save Setlist"}
              </Button>
              <Button variant="outline" onClick={resetBuilder}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
