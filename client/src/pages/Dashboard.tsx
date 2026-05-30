import { useState, useMemo, useEffect, useCallback } from "react";
import { SEED_SONGS, type Song, type Setlist } from "@/lib/data";
import { sbSetlists, sbSongs, type SbSetlist } from "@/lib/supabase";
import { SongCard } from "@/components/SongCard";
import { SongDetailModal } from "@/components/SongDetailModal";
import { AddSongModal } from "@/components/AddSongModal";
import { getSongReadinessIssues, songNeedsReview } from "@/lib/songReadiness";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, LayoutGrid, List, SlidersHorizontal, X, Plus, ListMusic, ChevronDown, ChevronUp, ArrowUpDown, FileText, Clock, UserPlus, AlertTriangle } from "lucide-react";
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
  const [songs, setSongs] = useState<Song[]>(SEED_SONGS);
  const [search, setSearch] = useState("");
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortMode, setSortMode] = useState<"library" | "title" | "artist" | "year" | "duration">("library");
  const [quickFilters, setQuickFilters] = useState({ pdfOnly: false, needsPdf: false, customOnly: false, missingDuration: false, needsReview: false });
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [showAddSong, setShowAddSong] = useState(false);
  const [addToSetlistSong, setAddToSetlistSong] = useState<Song | null>(null);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const loadSongs = useCallback(async () => {
    try {
      const catalog = await sbSongs.getCatalog();
      setSongs(catalog);
    } catch (err: any) {
      toast({
        title: "Songs unavailable",
        description: err?.message ?? "Could not load the cloud song catalogue.",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    loadSongs();
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
  }, [loadSongs, toast]);

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

  const refresh = () => { void loadSongs(); };

  const stats = useMemo(() => {
    const withPdf = songs.filter((song) => !!song.pdfUrl).length;
    const custom = songs.filter((song) => !!song.userAdded).length;
    const missingDuration = songs.filter((song) => !song.duration).length;
    const needsReview = songs.filter((song) => songNeedsReview(song)).length;
    const missingEssentials = songs.filter((song) => getSongReadinessIssues(song).some((issue) => issue.severity === "warning")).length;
    return { withPdf, custom, missingDuration, needsReview, missingEssentials };
  }, [songs]);

  const filtered = useMemo(() => {
    const visible = songs.filter((s) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        (s.genre ?? "").toLowerCase().includes(q) ||
        (s.mood ?? "").toLowerCase().includes(q) ||
        (s.key ?? "").toLowerCase().includes(q) ||
        (s.chords ?? "").toLowerCase().includes(q) ||
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

      const matchQuick =
        (!quickFilters.pdfOnly || !!s.pdfUrl) &&
        (!quickFilters.needsPdf || !s.pdfUrl) &&
        (!quickFilters.customOnly || !!s.userAdded) &&
        (!quickFilters.missingDuration || !s.duration) &&
        (!quickFilters.needsReview || songNeedsReview(s));

      return matchSearch && matchGenre && matchMood && matchDecade && matchEnergy &&
             matchVocal && matchDiff && matchGuitar && matchCapo && matchQuick;
    });

    return [...visible].sort((a, b) => {
      if (sortMode === "title") return a.title.localeCompare(b.title);
      if (sortMode === "artist") return a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title);
      if (sortMode === "year") return (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title);
      if (sortMode === "duration") return (a.duration ?? Number.MAX_SAFE_INTEGER) - (b.duration ?? Number.MAX_SAFE_INTEGER);
      return (a.setPosition ?? 999) - (b.setPosition ?? 999) || a.title.localeCompare(b.title);
    });
  }, [songs, search, activeFilters, quickFilters, sortMode]);

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
    setQuickFilters({ pdfOnly: false, needsPdf: false, customOnly: false, missingDuration: false, needsReview: false });
    setSearch("");
  };

  const toggleQuickFilter = (key: keyof typeof quickFilters) => {
    setQuickFilters((prev) => ({
      ...prev,
      [key]: !prev[key],
      ...(key === "pdfOnly" ? { needsPdf: false } : {}),
      ...(key === "needsPdf" ? { pdfOnly: false } : {}),
    }));
  };

  const quickFilterCount = Object.values(quickFilters).filter(Boolean).length;
  const activeCount = Object.values(activeFilters).filter(Boolean).length + quickFilterCount + (search ? 1 : 0);

  // Quick-access active filter chips for the bar
  const activeChips = Object.entries(activeFilters).filter(([, v]) => v);

  return (
    <div>
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-4 gap-3">
        <div>
          <h1 className="font-display font-bold text-xl italic mb-0.5">Song Library</h1>
          <p className="text-muted-foreground text-sm">{songs.length} songs · {filtered.length} showing</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowAddSong(true)} className="gap-1.5 w-full sm:w-auto" data-testid="button-add-song">
            <Plus className="w-4 h-4" /> Add Song
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <button type="button" onClick={() => toggleQuickFilter("pdfOnly")} className={`rounded-xl border px-3 py-2 text-left transition-colors ${quickFilters.pdfOnly ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"}`}>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><FileText className="w-3.5 h-3.5" /> PDFs</div>
          <div className="font-semibold text-sm">{stats.withPdf}</div>
        </button>
        <button type="button" onClick={() => toggleQuickFilter("customOnly")} className={`rounded-xl border px-3 py-2 text-left transition-colors ${quickFilters.customOnly ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"}`}>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><UserPlus className="w-3.5 h-3.5" /> Custom</div>
          <div className="font-semibold text-sm">{stats.custom}</div>
        </button>
        <button type="button" onClick={() => toggleQuickFilter("missingDuration")} className={`rounded-xl border px-3 py-2 text-left transition-colors ${quickFilters.missingDuration ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"}`}>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="w-3.5 h-3.5" /> Needs time</div>
          <div className="font-semibold text-sm">{stats.missingDuration}</div>
        </button>
        <button type="button" onClick={() => toggleQuickFilter("needsReview")} className={`rounded-xl border px-3 py-2 text-left transition-colors ${quickFilters.needsReview ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"}`}>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><AlertTriangle className="w-3.5 h-3.5" /> Needs review</div>
          <div className="font-semibold text-sm">{stats.needsReview}</div>
        </button>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search songs, artists, key, chords, tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <div className="flex gap-2">
          <Select value={sortMode} onValueChange={(v) => setSortMode(v as typeof sortMode)}>
            <SelectTrigger className="w-[150px] gap-1" aria-label="Sort songs">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="library">Library order</SelectItem>
              <SelectItem value="title">Title A-Z</SelectItem>
              <SelectItem value="artist">Artist A-Z</SelectItem>
              <SelectItem value="year">Newest first</SelectItem>
              <SelectItem value="duration">Shortest first</SelectItem>
            </SelectContent>
          </Select>
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
      </div>

      {/* Active filter chips */}
      {(activeChips.length > 0 || quickFilterCount > 0 || search) && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {search && (
            <Badge className="bg-primary/20 text-primary border-primary/30 gap-1 cursor-pointer hover:bg-primary/30 transition-colors" onClick={() => setSearch("")}>
              Search: {search}
              <X className="w-3 h-3" />
            </Badge>
          )}
          {quickFilters.pdfOnly && <Badge className="bg-primary/20 text-primary border-primary/30 gap-1 cursor-pointer hover:bg-primary/30 transition-colors" onClick={() => toggleQuickFilter("pdfOnly")}>Has PDF<X className="w-3 h-3" /></Badge>}
          {quickFilters.needsPdf && <Badge className="bg-primary/20 text-primary border-primary/30 gap-1 cursor-pointer hover:bg-primary/30 transition-colors" onClick={() => toggleQuickFilter("needsPdf")}>Needs PDF<X className="w-3 h-3" /></Badge>}
          {quickFilters.customOnly && <Badge className="bg-primary/20 text-primary border-primary/30 gap-1 cursor-pointer hover:bg-primary/30 transition-colors" onClick={() => toggleQuickFilter("customOnly")}>Custom songs<X className="w-3 h-3" /></Badge>}
          {quickFilters.missingDuration && <Badge className="bg-primary/20 text-primary border-primary/30 gap-1 cursor-pointer hover:bg-primary/30 transition-colors" onClick={() => toggleQuickFilter("missingDuration")}>Missing duration<X className="w-3 h-3" /></Badge>}
          {quickFilters.needsReview && <Badge className="bg-primary/20 text-primary border-primary/30 gap-1 cursor-pointer hover:bg-primary/30 transition-colors" onClick={() => toggleQuickFilter("needsReview")}>Needs review<X className="w-3 h-3" /></Badge>}
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
        <div className="bg-muted/40 border border-border rounded-xl p-4 mb-4 space-y-3">
          <div className="flex flex-wrap gap-1.5 pb-2 border-b border-border/50">
            <Badge variant={quickFilters.pdfOnly ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => toggleQuickFilter("pdfOnly")}>Has PDF</Badge>
            <Badge variant={quickFilters.needsPdf ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => toggleQuickFilter("needsPdf")}>Needs PDF</Badge>
            <Badge variant={quickFilters.customOnly ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => toggleQuickFilter("customOnly")}>Custom</Badge>
            <Badge variant={quickFilters.missingDuration ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => toggleQuickFilter("missingDuration")}>Missing duration</Badge>
            <Badge variant={quickFilters.needsReview ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => toggleQuickFilter("needsReview")}>Needs review</Badge>
          </div>
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
              description: "This removes it from your synced song library. This cannot be undone.",
              confirmLabel: "Delete song",
              destructive: true,
            });
            if (!confirmed) return;
            await sbSongs.delete(id);
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
          existingSongs={songs}
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
