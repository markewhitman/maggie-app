import { useState } from "react";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { songsStore, setlistsStore, venuesStore, type Song, type Setlist, type Venue } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, GripVertical, X, Trash2, Mic2, Search, Calendar, MapPin, ChevronDown, ChevronUp, Building2,
} from "lucide-react";

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
        {song && <div className="text-xs text-muted-foreground">{song.artist}</div>}
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
  venues,
  value,
  onChange,
  onNewVenue,
}: {
  venues: Venue[];
  value: string;
  onChange: (id: string) => void;
  onNewVenue: (name: string) => Venue;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = () => {
    if (!newName.trim()) return;
    const v = onNewVenue(newName.trim());
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

// ─── Setlist Card ─────────────────────────────────────────

function SetlistCard({
  setlist, songs, venues, onDelete, onLoad,
}: {
  setlist: Setlist;
  songs: Song[];
  venues: Venue[];
  onDelete: () => void;
  onLoad: () => void;
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
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" onClick={onLoad} className="gap-1.5 text-xs h-8">
              <Mic2 className="w-3.5 h-3.5" /> Load Tonight
            </Button>
            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setExpanded((p) => !p)}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border px-4 pb-3 pt-3 space-y-1.5">
          {setlistSongs.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 text-sm">
              <span className="w-5 text-right text-muted-foreground text-xs shrink-0">{i + 1}</span>
              <span className="flex-1">{s.title}</span>
              <span className="text-xs text-muted-foreground">{s.artist}</span>
              {s.capo && s.capo !== "No capo" && (
                <Badge className="capo-badge text-[10px]">{s.capo}</Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────

export default function SetlistPage() {
  const [songs] = useState<Song[]>(() => songsStore.getAll());
  const [setlists, setSetlists] = useState<Setlist[]>(() => setlistsStore.getAll());
  const [venues, setVenues] = useState<Venue[]>(() => venuesStore.getAll());

  const [showBuilder, setShowBuilder] = useState(false);
  const [gigName, setGigName] = useState("");
  const [gigDate, setGigDate] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState("none");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [songSearch, setSongSearch] = useState("");
  const [activeSession, setActiveSession] = useState<{ setlistId: string; orderedSongIds: string[] } | null>(
    () => {
      try { return JSON.parse(localStorage.getItem("maggie_active_session") || "null"); } catch { return null; }
    }
  );

  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const refresh = () => {
    setSetlists(setlistsStore.getAll());
    setVenues(venuesStore.getAll());
  };

  const handleNewVenue = (name: string): Venue => {
    const v = venuesStore.create({ name });
    setVenues(venuesStore.getAll());
    return v;
  };

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
    setGigName("");
    setGigDate("");
    setSelectedVenueId("none");
    setSelectedIds([]);
    setSongSearch("");
  };

  const saveSetlist = () => {
    if (!gigName.trim()) {
      toast({ title: "Give this gig a name", variant: "destructive" });
      return;
    }
    if (selectedIds.length === 0) {
      toast({ title: "Add at least one song", variant: "destructive" });
      return;
    }
    const venueId = selectedVenueId === "none" ? undefined : selectedVenueId;
    setlistsStore.create({
      name: gigName,
      gigDate: gigDate || undefined,
      venueId,
      songIds: selectedIds,
    });
    if (venueId) venuesStore.incrementGigCount(venueId);
    refresh();
    toast({ title: "Setlist saved!", description: gigName });
    resetBuilder();
  };

  const loadSetlist = (setlist: Setlist) => {
    const session = { setlistId: setlist.id, orderedSongIds: setlist.songIds };
    localStorage.setItem("maggie_active_session", JSON.stringify(session));
    setActiveSession(session);
    toast({ title: "Set loaded for tonight!", description: "Head to the Stage tab to start." });
  };

  const deleteSetlist = (id: string) => {
    setlistsStore.delete(id);
    refresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-xl italic mb-0.5">Setlists</h1>
          <p className="text-muted-foreground text-sm">Build and save setlists per gig</p>
        </div>
        <Button onClick={() => setShowBuilder(true)} className="gap-1.5" data-testid="button-new-setlist">
          <Plus className="w-4 h-4" /> New Setlist
        </Button>
      </div>

      {activeSession && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
          <Mic2 className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-semibold">Active set loaded</span>
            <span className="text-muted-foreground ml-2">{activeSession.orderedSongIds.length} songs queued</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => {
            localStorage.removeItem("maggie_active_session");
            setActiveSession(null);
          }} className="text-xs gap-1">
            <X className="w-3 h-3" /> Clear
          </Button>
        </div>
      )}

      {setlists.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-4xl mb-3">📋</div>
          <div className="font-medium">No setlists yet</div>
          <div className="text-sm mt-1">Create your first setlist for tonight's gig</div>
        </div>
      ) : (
        <div className="space-y-3">
          {[...setlists].reverse().map((sl) => (
            <SetlistCard
              key={sl.id}
              setlist={sl}
              songs={songs}
              venues={venues}
              onDelete={() => deleteSetlist(sl.id)}
              onLoad={() => loadSetlist(sl)}
            />
          ))}
        </div>
      )}

      {/* Builder Dialog */}
      <Dialog open={showBuilder} onOpenChange={(open) => { if (!open) resetBuilder(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display italic">New Setlist</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Gig name */}
            <div className="space-y-1.5">
              <Label className="text-xs">Gig Name *</Label>
              <Input value={gigName} onChange={(e) => setGigName(e.target.value)} placeholder="Saturday Night at The Burren" data-testid="input-gig-name" />
            </div>

            {/* Date + Venue */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Calendar className="w-3 h-3" /> Gig Date</Label>
                <Input type="date" value={gigDate} onChange={(e) => setGigDate(e.target.value)} />
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
            </div>

            {/* Selected songs (draggable) */}
            <div>
              <Label className="text-xs mb-2 block">
                Set Order ({selectedIds.length} songs)
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
                          <DraggableSong
                            key={id}
                            id={id}
                            song={song}
                            onRemove={() => toggleSong(id)}
                          />
                        ) : null;
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>

            {/* Song picker */}
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

            {/* Save */}
            <div className="flex gap-2 pt-2">
              <Button onClick={saveSetlist} className="flex-1" data-testid="button-save-setlist">
                Save Setlist
              </Button>
              <Button variant="outline" onClick={resetBuilder}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
