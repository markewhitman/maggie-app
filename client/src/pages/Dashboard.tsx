import { useState, useMemo, useEffect } from "react";
import type { Song, Setlist } from "@/lib/data";
import { songsStore } from "@/lib/data";
import { sbSetlists, type SbSetlist } from "@/lib/supabase";
import { SongCard } from "@/components/SongCard";
import { SongDetailModal } from "@/components/SongDetailModal";
import { AddSongModal } from "@/components/AddSongModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, LayoutGrid, List, SlidersHorizontal, X, Plus, ListMusic, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useConfirmDialog } from "@/hooks/use-confirm";


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

// ─── Filter definitions ────────────────────────────────────
// Genre labels mapped from slug → display
const GENRE_LABELS: Record<string, string> = {
  "pop": "Pop",
  "rock": "Rock",
  "classic-rock": "Classic Rock",
  "indie-rock": "Indie Rock",
  "alternative": "Alternative",
  "folk": "Folk",
  "folk-rock": "Folk Rock",
  "indie-folk": "Indie Folk",
  "singer-songwriter": "Singer-Songwriter",
  "country-pop": "Country/Pop",
  "80s-pop": "80s Pop",
  "new-wave": "New Wave",
  "britpop": "Britpop",
  "art-rock": "Art Rock",
  "glam-rock": "Glam Rock",
  "synth-pop": "Synth Pop",
};

const MOOD_LABELS: Record<string, string> = {
  "feel-good": "Feel Good",
  "nostalgic": "Nostalgic",
  "emotional": "Emotional",
  "anthemic": "Anthemic",
  "uplifting": "Uplifting",
  "romantic": "Romantic",
  "melancholic": "Melancholic",
  "energetic": "Energetic",
  "chill": "Chill",
  "bittersweet": "Bittersweet",
  "heartfelt": "Heartfelt",
  "whimsical": "Whimsical",
};

const FILTER_GROUPS = [
  {
    key: "genre",
    label: "Genre",
    options: Object.keys(GENRE_LABELS),
    displayLabel: (v: string) => GENRE_LABELS[v] ?? v,
  },
  {
    key: "mood",
    label: "Mood / Vibe",
    options: Object.keys(MOOD_LABELS),
    displayLabel: (v: string) => MOOD_LABELS[v] ?? v,
  },
  {
    key: "decade",
    label: "Era",
    options: ["60s", "70s", "80s", "90s", "00s", "10s", "20s"],
    displayLabel: (v: string) => v === "00s" ? "2000s" : v === "10s" ? "2010s" : v === "20s" ? "2020s" : `${v.slice(0, -1)}0s`,
  },
  {
    key: "energy",
    label: "Energy",
    options: ["low", "medium", "high"],
    displayLabel: (v: string) => v === "low" ? "Low Energy" : v === "medium" ? "Medium Energy" : "High Energy",
  },
  {
    key: "vocalStyle",
    label: "Vocal Style",
    options: ["storytelling", "singalong", "emotional", "powerful", "conversational"],
    displayLabel: (v: string) => v.charAt(0).toUpperCase() + v.slice(1),
  },
  {
    key: "difficulty",
    label: "Difficulty",
    options: ["Beginner", "Intermediate", "Advanced"],
    displayLabel: (v: string) => v,
  },
  {
    key: "guitarType",
    label: "Guitar",
    options: ["acoustic", "electric", "either"],
    displayLabel: (v: string) => v.charAt(0).toUpperCase() + v.slice(1),
  },
  {
    key: "capo",
    label: "Capo",
    options: ["With Capo", "No Capo"],
    displayLabel: (v: string) => v,
  },
];

export default function Dashboard() {
  const [songs, setSongs] = useState<Song[]>(() => songsStore.getAll());
  const [search, setSearch] = useState("");
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [showAddSong, setShowAddSong] = useState(false);
  const [addToSetlistSong, setAddToSetlistSong] = useState<Song | null>(null);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  useEffect(() => {
    sbSetlists
      .getAll()
      .then((rows) => setSetlists(rows.map(sbToSetlist)))
      .catch(() => {
        toast({
          title: "Setlists unavailable",
          description: "Could not load cloud setlists for quick add.",
          variant: "destructive",
        });
      });
  }, []);

  const handleAddToSetlist = async (setlistId: string, song: Song) => {
    const setlist = setlists.find((s) => s.id === setlistId);
    if (!setlist) return;
    if (setlist.songIds.includes(song.id)) {
      toast({ title: "Already in setlist", description: `${song.title} is already in "${setlist.name}"` });
      return;
    }

    const songIds = [...setlist.songIds, song.id];
    try {
      await sbSetlists.update(setlistId, { song_ids: songIds });
      setSetlists((prev) => prev.map((sl) => (sl.id === setlistId ? { ...sl, songIds } : sl)));
      toast({ title: "Added to setlist", description: `${song.title} added to "${setlist.name}"` });
      setAddToSetlistSong(null);
    } catch (err: any) {
      toast({
        title: "Could not update setlist",
        description: err?.message ?? "The cloud save failed. Try again when you are online.",
        variant: "destructive",
      });
    }
  };

  const refresh = () => setSongs(songsStore.getAll());

  const filtered = useMemo(() => {
    return songs.filter((s) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        (s.genre ?? "").toLowerCase().includes(q) ||
        (s.mood ?? "").toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q));

      const matchGenre =
        !activeFilters.genre ||
        (s.genre ?? "").toLowerCase().replace(/[/ ]/g, "-").includes(activeFilters.genre) ||
        (s.genre2 ?? "") === activeFilters.genre;

      const matchMood =
        !activeFilters.mood ||
        (s.mood ?? "").toLowerCase().includes(activeFilters.mood.replace("-", " ")) ||
        (s.mood2 ?? "").toLowerCase() === activeFilters.mood ||
        (s.mood ?? "").toLowerCase() === activeFilters.mood;

      const matchDecade = !activeFilters.decade || s.decade === activeFilters.decade;
      const matchEnergy = !activeFilters.energy || s.energy === activeFilters.energy;
      const matchVocal = !activeFilters.vocalStyle || s.vocalStyle === activeFilters.vocalStyle;
      const matchDiff = !activeFilters.difficulty || s.difficulty === activeFilters.difficulty;
      const matchGuitar = !activeFilters.guitarType || s.guitarType === activeFilters.guitarType;
      const matchCapo =
        !activeFilters.capo ||
        (activeFilters.capo === "With Capo" && s.capo !== "No capo") ||
        (activeFilters.capo === "No Capo" && (!s.capo || s.capo === "No capo"));

      return matchSearch && matchGenre && matchMood && matchDecade && matchEnergy &&
             matchVocal && matchDiff && matchGuitar && matchCapo;
    });
  }, [songs, search, activeFilters]);

  const toggleFilter = (key: string, val: string) => {
    setActiveFilters((prev) => ({
      ...prev,
      [key]: prev[key] === val ? "" : val,
    }));
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const clearFilters = () => {
    setActiveFilters({});
    setSearch("");
  };

  const activeCount = Object.values(activeFilters).filter(Boolean).length + (search ? 1 : 0);

  // Quick-access active filter chips for the bar
  const activeChips = Object.entries(activeFilters).filter(([, v]) => v);

  return (
    <div>
      {/* Header row */}
      <div className="flex items-start justify-between mb-5 gap-3">
        <div>
          <h1 className="font-display font-bold text-xl italic mb-0.5">Song Library</h1>
          <p className="text-muted-foreground text-sm">{songs.length} songs · {filtered.length} showing</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowAddSong(true)} className="gap-1.5" data-testid="button-add-song">
            <Plus className="w-4 h-4" /> Add Song
          </Button>
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search songs, artists, mood, tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <Button
          variant={showFilters ? "default" : "outline"}
          size="icon"
          onClick={() => setShowFilters((p) => !p)}
          className="relative"
          data-testid="button-filters"
        >
          <SlidersHorizontal className="w-4 h-4" />
          {activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold">
              {activeCount}
            </span>
          )}
        </Button>
        <Button
          variant={viewMode === "grid" ? "default" : "outline"}
          size="icon"
          onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
          data-testid="button-viewmode"
        >
          {viewMode === "grid" ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
        </Button>
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {activeChips.map(([key, val]) => {
            const group = FILTER_GROUPS.find((g) => g.key === key);
            const label = group?.displayLabel(val) ?? val;
            return (
              <Badge
                key={key}
                className="bg-primary/20 text-primary border-primary/30 gap-1 cursor-pointer hover:bg-primary/30 transition-colors"
                onClick={() => toggleFilter(key, val)}
                data-testid={`active-filter-${key}`}
              >
                {label}
                <X className="w-3 h-3" />
              </Badge>
            );
          })}
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-xs px-2 text-muted-foreground">
            Clear all
          </Button>
        </div>
      )}

      {/* Filters panel — Spotify-style grouped */}
      {showFilters && (
        <div className="bg-muted/40 border border-border rounded-xl p-4 mb-4 space-y-1">
          {FILTER_GROUPS.map((group) => {
            const isExpanded = expandedGroups[group.key] ?? true;
            const hasActive = !!activeFilters[group.key];
            return (
              <div key={group.key} className="border-b border-border/50 last:border-0 pb-2 last:pb-0">
                <button
                  className="flex items-center justify-between w-full py-1.5 text-left"
                  onClick={() => toggleGroup(group.key)}
                >
                  <span className={`text-xs font-semibold uppercase tracking-wide ${hasActive ? "text-primary" : "text-muted-foreground"}`}>
                    {group.label}
                    {hasActive && (
                      <span className="ml-1.5 normal-case font-normal">
                        · {group.displayLabel(activeFilters[group.key])}
                      </span>
                    )}
                  </span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
                {isExpanded && (
                  <div className="flex flex-wrap gap-1.5 pt-1 pb-1">
                    {group.options.map((val) => (
                      <Badge
                        key={val}
                        variant={activeFilters[group.key] === val ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() => toggleFilter(group.key, val)}
                        data-testid={`filter-${group.key}-${val}`}
                      >
                        {group.displayLabel(val)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 h-7 text-xs mt-1">
              <X className="w-3 h-3" /> Clear all filters
            </Button>
          )}
        </div>
      )}

      {/* Song grid/list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-4xl mb-3">🎸</div>
          <div className="font-medium">No songs match</div>
          <div className="text-sm mt-1">Try adjusting your search or filters</div>
          <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-3">Clear filters</Button>
        </div>
      ) : (
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
              : "space-y-2"
          }
        >
          {filtered.map((song) => (
            <SongCard
              key={song.id}
              song={song}
              compact={viewMode === "list"}
              onClick={() => setSelectedSong(song)}
              onAddToSetlist={setlists.length > 0 ? () => setAddToSetlistSong(song) : undefined}
            />
          ))}
        </div>
      )}

      {/* Song detail modal */}
      {selectedSong && (
        <SongDetailModal
          song={selectedSong}
          onClose={() => { setSelectedSong(null); refresh(); }}
          onDelete={async (id) => {
            const confirmed = await confirm({
              title: "Delete this song?",
              description: "This removes it from your local song library. This cannot be undone.",
              confirmLabel: "Delete song",
              destructive: true,
            });
            if (!confirmed) return;
            songsStore.delete(id);
            refresh();
            setSelectedSong(null);
            toast({ title: "Song removed" });
          }}
          onEdit={(updated) => {
            // Update the selected song so the modal header refreshes live
            setSelectedSong(updated);
            refresh();
          }}
        />
      )}

      {/* Add song modal */}
      {showAddSong && (
        <AddSongModal
          onClose={() => setShowAddSong(false)}
          onSaved={() => { refresh(); setShowAddSong(false); }}
        />
      )}

      {/* Add to Setlist dialog */}
      {ConfirmDialog}

      <Dialog open={!!addToSetlistSong} onOpenChange={(open) => { if (!open) setAddToSetlistSong(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display italic">
              Add "{addToSetlistSong?.title}" to Setlist
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {setlists.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No setlists yet — create one first</p>
            ) : (
              setlists.map((sl) => (
                <button
                  key={sl.id}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted text-left transition-colors"
                  onClick={() => addToSetlistSong && handleAddToSetlist(sl.id, addToSetlistSong)}
                >
                  <ListMusic className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{sl.name}</div>
                    <div className="text-xs text-muted-foreground">{sl.songIds.length} songs{sl.gigDate ? ` · ${sl.gigDate}` : ""}</div>
                  </div>
                  {sl.songIds.includes(addToSetlistSong?.id ?? "") && (
                    <Badge variant="secondary" className="text-xs shrink-0">Added</Badge>
                  )}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
