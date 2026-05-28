import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { QRCodeSVG as QRCode } from "qrcode.react";
import { songsStore, type Song } from "@/lib/data";
import { sbRequests, sbSession } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Music, Heart, Check, ChevronDown, ChevronUp, SlidersHorizontal, X, PenLine, Plus } from "lucide-react";

// ─── Filter config ─────────────────────────────────────────

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

const AUDIENCE_FILTER_GROUPS = [
  {
    key: "genre",
    label: "Genre",
    options: Object.keys(GENRE_LABELS),
    display: (v: string) => GENRE_LABELS[v] ?? v,
  },
  {
    key: "mood",
    label: "Mood / Vibe",
    options: Object.keys(MOOD_LABELS),
    display: (v: string) => MOOD_LABELS[v] ?? v,
  },
  {
    key: "decade",
    label: "Era",
    options: ["60s", "70s", "80s", "90s", "00s", "10s", "20s"],
    display: (v: string) =>
      v === "00s" ? "2000s" : v === "10s" ? "2010s" : v === "20s" ? "2020s" : `${v.slice(0, -1)}0s`,
  },
  {
    key: "energy",
    label: "Energy",
    options: ["low", "medium", "high"],
    display: (v: string) =>
      v === "low" ? "Mellow" : v === "medium" ? "Mid-Energy" : "High Energy",
  },
  {
    key: "vocalStyle",
    label: "Style",
    options: ["storytelling", "singalong", "emotional", "powerful", "conversational"],
    display: (v: string) => v.charAt(0).toUpperCase() + v.slice(1),
  },
];

interface Request {
  songId: string;
  timestamp: number;
}

// ─── Audience Song Card ────────────────────────────────────

function AudienceSongCard({
  song,
  requested,
  onRequest,
}: {
  song: Song;
  requested: boolean;
  onRequest: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const energyColor =
    song.energy === "high"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      : song.energy === "medium"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";

  const moodLabel = song.mood2
    ? MOOD_LABELS[song.mood2] ?? song.mood2
    : "";
  const genreLabel = GENRE_LABELS[song.genre?.toLowerCase().replace(/[/ ]/g, "-") ?? ""] ??
    GENRE_LABELS[song.genre2 ?? ""] ?? song.genre;

  return (
    <div
      className={`audience-card rounded-xl border text-left transition-all overflow-hidden ${
        requested
          ? "border-primary bg-primary/8"
          : "border-border bg-card"
      }`}
      data-testid={`audience-song-${song.id}`}
    >
      {/* Main clickable row */}
      <button
        className="w-full flex items-center gap-3 p-3 text-left active:scale-[0.98] transition-transform"
        onClick={onRequest}
      >
        {/* Request indicator */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
          requested
            ? "bg-primary"
            : "border border-border text-muted-foreground hover:border-primary hover:text-primary"
        }`}>
          {requested ? (
            <Check className="w-4 h-4 text-primary-foreground" />
          ) : (
            <Heart className="w-3.5 h-3.5" />
          )}
        </div>

        {/* Song info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm leading-tight">{song.title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{song.artist} · {song.year}</div>
        </div>

        {/* Genre + energy chips */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {genreLabel && (
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full leading-none">
              {genreLabel}
            </span>
          )}
          {song.energy && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full leading-none ${energyColor}`}>
              {song.energy === "high" ? "🔥 High" : song.energy === "medium" ? "〜 Mid" : "💤 Low"}
            </span>
          )}
        </div>
      </button>

      {/* Expandable details */}
      <div className="border-t border-border/50">
        <button
          className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setExpanded((p) => !p)}
        >
          <span className="flex items-center gap-2">
            {moodLabel && (
              <span className="bg-muted px-1.5 py-0.5 rounded-full">{moodLabel}</span>
            )}
            {song.mood2 !== song.mood && song.mood && (
              <span className="bg-muted px-1.5 py-0.5 rounded-full">
                {MOOD_LABELS[song.mood?.toLowerCase().replace(/ /g, "-") ?? ""] ?? song.mood.split(",")[0].trim()}
              </span>
            )}
          </span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {expanded && (
          <div className="px-3 pb-3 space-y-2">
            {/* Similar songs */}
            {song.similar && song.similar.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 font-semibold">If you like this, also try</div>
                <div className="flex flex-wrap gap-1">
                  {song.similar.map((s) => (
                    <span key={s} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {/* Vocal style */}
            {song.vocalStyle && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Style:</span>{" "}
                {song.vocalStyle.charAt(0).toUpperCase() + song.vocalStyle.slice(1)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function buildAudienceUrl(gigId: string): string {
  if (typeof window === "undefined") return `#/audience/${encodeURIComponent(gigId)}`;
  return `${window.location.origin}${window.location.pathname}#/audience/${encodeURIComponent(gigId)}`;
}

// ─── Main Page ────────────────────────────────────────────

export default function AudiencePage() {
  const songs = useMemo(() => songsStore.getAll(), []);
  const [location] = useLocation();
  const routeGigId = useMemo(() => {
    const match = location.match(/^\/audience\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [location]);
  const [activeGigId, setActiveGigId] = useState<string | null>(routeGigId);
  const effectiveGigId = routeGigId ?? activeGigId;
  const [search, setSearch] = useState("");
  const [requests, setRequests] = useState<Request[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [showWriteIn, setShowWriteIn] = useState(false);
  const [writeIn, setWriteIn] = useState("");
  const [writeInSubmitting, setWriteInSubmitting] = useState(false);
  const { toast } = useToast();

  // If someone opens the generic #/audience route, automatically bind it to
  // the currently loaded Stage set. Explicit #/audience/:gigId links stay fixed.
  useEffect(() => {
    if (routeGigId) {
      setActiveGigId(routeGigId);
      return;
    }
    sbSession.get()
      .then((session) => setActiveGigId(session?.setlist_id ?? null))
      .catch(() => setActiveGigId(null));
  }, [routeGigId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return songs.filter((s) => {
      const matchSearch =
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        (s.genre ?? "").toLowerCase().includes(q);

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

      return matchSearch && matchGenre && matchMood && matchDecade && matchEnergy && matchVocal;
    });
  }, [songs, search, activeFilters]);

  const requestSong = async (song: Song) => {
    const alreadyRequested = requests.some((r) => r.songId === song.id);
    if (alreadyRequested) {
      toast({ title: "Already requested!", description: `${song.title} is in the queue` });
      return;
    }

    try {
      await sbRequests.submit(song.id, song.title, effectiveGigId);
      setRequests((prev) => [...prev, { songId: song.id, timestamp: Date.now() }]);
      toast({ title: "Request sent!", description: `${song.title} has been requested` });
    } catch (err: any) {
      toast({
        title: "Failed to send request",
        description: err?.message ?? "Please check your connection and try again.",
        variant: "destructive",
      });
    }
  };

  const isRequested = (id: string) => requests.some((r) => r.songId === id);

  const handleWriteInSubmit = async () => {
    if (!writeIn.trim()) return;
    setWriteInSubmitting(true);
    try {
      const { error } = await sbRequests.submitWriteInSafe(writeIn.trim(), effectiveGigId);
      if (error) throw new Error(error.message);
      setRequests((prev) => [...prev, { songId: `write-in-${Date.now()}`, timestamp: Date.now() }]);
      toast({ title: "Request sent!", description: `“${writeIn.trim()}” has been requested` });
      setWriteIn("");
      setShowWriteIn(false);
    } catch (err: any) {
      toast({ title: "Failed to send request", description: err.message, variant: "destructive" });
    } finally {
      setWriteInSubmitting(false);
    }
  };

  const qrUrl = effectiveGigId ? buildAudienceUrl(effectiveGigId) : (typeof window !== "undefined" ? window.location.href : "");

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
  const activeChips = Object.entries(activeFilters).filter(([, v]) => v);

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="22" height="22" viewBox="0 0 28 28" fill="none" className="text-primary">
              <circle cx="14" cy="14" r="13" stroke="currentColor" strokeWidth="2"/>
              <path d="M7 19 L10 9 L14 16 L18 9 L21 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="font-display font-bold italic text-primary">Maggie</span>
          </div>
          <div className="flex items-center gap-2">
            {requests.length > 0 && (
              <Badge className="bg-primary/20 text-primary border-0 text-xs">
                {requests.length} requested
              </Badge>
            )}
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              className="gap-1.5 text-xs relative"
              onClick={() => setShowFilters((p) => !p)}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filter
              {activeCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold">
                  {activeCount}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setShowQR((p) => !p)}>
              {showQR ? "Hide QR" : "Share QR"}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* QR code */}
        {showQR && (
          <div className="flex flex-col items-center py-6 mb-4 bg-card border border-border rounded-xl">
            <QRCode value={qrUrl} size={180} />
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Scan to open on your phone and request songs
            </p>
          </div>
        )}

        {/* Welcome */}
        <div className="text-center py-3 mb-3">
          <h1 className="font-display font-bold text-2xl italic text-primary mb-1">Request a Song</h1>
          <p className="text-sm text-muted-foreground">Tap a song to request it · use the row below each song for details</p>
          {effectiveGigId ? (
            <p className="text-[11px] text-muted-foreground/70 mt-1">Requests are linked to tonight’s active set.</p>
          ) : (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">No active set detected — requests may go to the general queue.</p>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by song or artist…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Write-in request */}
        <div className="mb-3">
          <button
            className="w-full flex items-center justify-between bg-muted/40 border border-border rounded-xl px-3 py-2.5 text-sm text-left hover:bg-muted/60 transition-colors"
            onClick={() => setShowWriteIn((p) => !p)}
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <PenLine className="w-3.5 h-3.5" />
              Don’t see your song? Request it anyway
            </span>
            {showWriteIn ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
          {showWriteIn && (
            <div className="bg-muted/20 border border-t-0 border-border rounded-b-xl px-3 pb-3 pt-2 space-y-2">
              <p className="text-xs text-muted-foreground">Type the song title and artist — we’ll see what we can do!</p>
              <div className="flex gap-2">
                <Input
                  value={writeIn}
                  onChange={(e) => setWriteIn(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleWriteInSubmit()}
                  placeholder="e.g. Hotel California — Eagles"
                  className="h-9 text-sm flex-1"
                  autoFocus
                />
                <Button
                  size="sm"
                  disabled={!writeIn.trim() || writeInSubmitting}
                  onClick={handleWriteInSubmit}
                  className="h-9 px-3 gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Send
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="bg-muted/40 border border-border rounded-xl p-3 mb-3 space-y-1">
            {AUDIENCE_FILTER_GROUPS.map((group) => {
              const isExpanded = expandedGroups[group.key] ?? false;
              const hasActive = !!activeFilters[group.key];
              return (
                <div key={group.key} className="border-b border-border/40 last:border-0 pb-1.5 last:pb-0">
                  <button
                    className="flex items-center justify-between w-full py-1 text-left"
                    onClick={() => toggleGroup(group.key)}
                  >
                    <span className={`text-xs font-semibold uppercase tracking-wide ${hasActive ? "text-primary" : "text-muted-foreground"}`}>
                      {group.label}
                      {hasActive && (
                        <span className="ml-1.5 normal-case font-normal">
                          · {group.display(activeFilters[group.key])}
                        </span>
                      )}
                    </span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                  {isExpanded && (
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      {group.options.map((val) => (
                        <Badge
                          key={val}
                          variant={activeFilters[group.key] === val ? "default" : "outline"}
                          className="cursor-pointer text-xs"
                          onClick={() => toggleFilter(group.key, val)}
                        >
                          {group.display(val)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 h-7 text-xs mt-1">
                <X className="w-3 h-3" /> Clear filters
              </Button>
            )}
          </div>
        )}

        {/* Active filter chips */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {activeChips.map(([key, val]) => {
              const group = AUDIENCE_FILTER_GROUPS.find((g) => g.key === key);
              const label = group?.display(val) ?? val;
              return (
                <Badge
                  key={key}
                  className="bg-primary/20 text-primary border-primary/30 gap-1 cursor-pointer hover:bg-primary/30 transition-colors text-xs"
                  onClick={() => toggleFilter(key, val)}
                >
                  {label} <X className="w-3 h-3" />
                </Badge>
              );
            })}
          </div>
        )}

        {/* Results count */}
        {(activeCount > 0) && (
          <p className="text-xs text-muted-foreground mb-2">
            {filtered.length} of {songs.length} songs
          </p>
        )}

        {/* Song list */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Music className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No songs match these filters</p>
              <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            filtered.map((song) => (
              <AudienceSongCard
                key={song.id}
                song={song}
                requested={isRequested(song.id)}
                onRequest={() => requestSong(song)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="text-center py-8 text-xs text-muted-foreground">
          {songs.length} songs available · Tap to request
        </div>
      </div>
    </div>
  );
}
