import { useState, useMemo } from "react";
import type { Song } from "@/lib/data";
import { songsStore, SEED_SONGS } from "@/lib/data";
import { SongCard } from "@/components/SongCard";
import { SongDetailModal } from "@/components/SongDetailModal";
import { AddSongModal } from "@/components/AddSongModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, LayoutGrid, List, SlidersHorizontal, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const FILTERS = {
  difficulty: ["Beginner", "Intermediate", "Advanced"],
  guitarType: ["acoustic", "electric", "either"],
  tempoFeel: ["Ballad", "Mid-Tempo", "Up-Tempo", "Driving", "Upbeat", "Slow", "Very Fast"],
  capo: ["With Capo", "No Capo"],
};

export default function Dashboard() {
  const [songs, setSongs] = useState<Song[]>(() => songsStore.getAll());
  const [search, setSearch] = useState("");
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showAddSong, setShowAddSong] = useState(false);
  const { toast } = useToast();

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

      const matchDiff = !activeFilters.difficulty || s.difficulty === activeFilters.difficulty;
      const matchGuitar = !activeFilters.guitarType || s.guitarType === activeFilters.guitarType;
      const matchTempo = !activeFilters.tempoFeel || s.tempoFeel === activeFilters.tempoFeel;
      const matchCapo =
        !activeFilters.capo ||
        (activeFilters.capo === "With Capo" && s.capo !== "No capo") ||
        (activeFilters.capo === "No Capo" && (!s.capo || s.capo === "No capo"));

      return matchSearch && matchDiff && matchGuitar && matchTempo && matchCapo;
    });
  }, [songs, search, activeFilters]);

  const toggleFilter = (key: string, val: string) => {
    setActiveFilters((prev) => ({
      ...prev,
      [key]: prev[key] === val ? "" : val,
    }));
  };

  const clearFilters = () => {
    setActiveFilters({});
    setSearch("");
  };

  const activeCount = Object.values(activeFilters).filter(Boolean).length + (search ? 1 : 0);

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

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-muted/50 rounded-xl p-4 mb-4 space-y-3">
          {Object.entries(FILTERS).map(([key, values]) => (
            <div key={key} className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20 shrink-0 capitalize">
                {key}
              </span>
              {values.map((val) => (
                <Badge
                  key={val}
                  variant={activeFilters[key] === val ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => toggleFilter(key, val)}
                  data-testid={`filter-${key}-${val}`}
                >
                  {val}
                </Badge>
              ))}
            </div>
          ))}
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 h-7 text-xs mt-1">
              <X className="w-3 h-3" /> Clear all
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
            />
          ))}
        </div>
      )}

      {/* Song detail modal */}
      {selectedSong && (
        <SongDetailModal
          song={selectedSong}
          onClose={() => { setSelectedSong(null); refresh(); }}
          onDelete={(id) => {
            songsStore.delete(id);
            refresh();
            setSelectedSong(null);
            toast({ title: "Song removed" });
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
    </div>
  );
}
