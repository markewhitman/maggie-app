import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarDays,
  Clock,
  Download,
  Filter,
  Heart,
  History,
  MapPin,
  Music2,
  RefreshCw,
  Search,
  Star,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  formatDurationLong,
  showRecapsStore,
  type Setlist,
  type ShowRecap,
  type Song,
  type Venue,
} from "@/lib/data";
import {
  sbPerfNotes,
  sbRequests,
  sbSetlists,
  sbSongs,
  sbVenues,
  type SbPerfNote,
  type SbSetlist,
  type SbVenue,
} from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
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
    audienceSlug: r.audience_slug ?? undefined,
    requestsEnabled: r.requests_enabled ?? true,
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

type RequestLogRow = {
  gig_id?: string | null;
  song_id?: string | null;
  song_title?: string | null;
  outcome?: string | null;
  requested_at?: string | null;
  resolved_at?: string | null;
};

type DateRange = "all" | "30" | "90" | "365";

type SongInsight = {
  songId: string;
  title: string;
  artist: string;
  played: number;
  skipped: number;
  pending: number;
  requests: number;
  notes: number;
  lastPlayed?: string;
  score: number;
};

type VenueInsight = {
  venueId: string;
  name: string;
  city?: string;
  shows: number;
  avgCompletion: number;
  musicTime: number;
  requests: number;
  lastShow?: string;
  crowdNotes: string[];
};

function safeDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateLabel(value?: string | null): string {
  const date = safeDate(value);
  if (!date) return "No date";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function shortDateLabel(value?: string | null): string {
  const date = safeDate(value);
  if (!date) return "No date";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function percent(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function completionForRecap(recap: ShowRecap): number {
  return percent(recap.playedCount, recap.totalSongs);
}

function getRecapDate(recap: ShowRecap): string {
  return recap.gigDate || recap.endedAt || recap.createdAt;
}

function newestDate(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

function matchesDateRange(recap: ShowRecap, range: DateRange): boolean {
  if (range === "all") return true;
  const date = safeDate(getRecapDate(recap));
  if (!date) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Number(range));
  return date.getTime() >= cutoff.getTime();
}

function setlistVenueId(recap: ShowRecap, setlistById: Map<string, Setlist>): string {
  return setlistById.get(recap.setlistId)?.venueId ?? "none";
}

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function StatCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof History;
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
            {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HistoryPage() {
  const [recaps, setRecaps] = useState<ShowRecap[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [perfNotes, setPerfNotes] = useState<SbPerfNote[]>([]);
  const [requestLog, setRequestLog] = useState<RequestLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [venueFilter, setVenueFilter] = useState("all");
  const [setlistFilter, setSetlistFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const [catalog, setlistRows, venueRows, notes, requests] = await Promise.all([
        sbSongs.getCatalog(),
        sbSetlists.getAll(),
        sbVenues.getAll(),
        sbPerfNotes.getAll().catch(() => [] as SbPerfNote[]),
        sbRequests.getLog().catch(() => [] as RequestLogRow[]),
      ]);
      setSongs(catalog);
      setSetlists(setlistRows.map(sbToSetlist));
      setVenues(venueRows.map(sbToVenue));
      setPerfNotes(notes);
      setRequestLog(requests as RequestLogRow[]);
      setRecaps(showRecapsStore.getAll());
    } catch (err: any) {
      toast({
        title: "History unavailable",
        description: err?.message ?? "Could not load performance history.",
        variant: "destructive",
      });
      setRecaps(showRecapsStore.getAll());
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const songById = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs]);
  const setlistById = useMemo(() => new Map(setlists.map((setlist) => [setlist.id, setlist])), [setlists]);
  const venueById = useMemo(() => new Map(venues.map((venue) => [venue.id, venue])), [venues]);

  const filteredRecaps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recaps
      .filter((recap) => matchesDateRange(recap, dateRange))
      .filter((recap) => venueFilter === "all" || setlistVenueId(recap, setlistById) === venueFilter)
      .filter((recap) => setlistFilter === "all" || recap.setlistId === setlistFilter)
      .filter((recap) => {
        if (!q) return true;
        const setlist = setlistById.get(recap.setlistId);
        const venue = setlist?.venueId ? venueById.get(setlist.venueId) : undefined;
        const songText = recap.songIds
          .map((id) => songById.get(id)?.title ?? id)
          .join(" ")
          .toLowerCase();
        const text = [
          recap.setlistName,
          setlist?.name,
          venue?.name,
          venue?.city,
          recap.whatWorked,
          recap.changeNextTime,
          recap.crowdFavorites,
          songText,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return text.includes(q);
      })
      .sort((a, b) => new Date(getRecapDate(b)).getTime() - new Date(getRecapDate(a)).getTime());
  }, [dateRange, recaps, search, setlistById, setlistFilter, songById, venueById, venueFilter]);

  const filteredSetlistIds = useMemo(() => new Set(filteredRecaps.map((recap) => recap.setlistId)), [filteredRecaps]);

  const requestLogForFilteredRecaps = useMemo(() => {
    if (!filteredRecaps.length) return [];
    return requestLog.filter((row) => !row.gig_id || filteredSetlistIds.has(row.gig_id));
  }, [filteredRecaps.length, filteredSetlistIds, requestLog]);

  const summary = useMemo(() => {
    const shows = filteredRecaps.length;
    const played = filteredRecaps.reduce((sum, recap) => sum + recap.playedCount, 0);
    const skipped = filteredRecaps.reduce((sum, recap) => sum + recap.skippedCount, 0);
    const pending = filteredRecaps.reduce((sum, recap) => sum + recap.pendingCount, 0);
    const totalSongs = filteredRecaps.reduce((sum, recap) => sum + recap.totalSongs, 0);
    const musicTime = filteredRecaps.reduce((sum, recap) => sum + recap.timePlayedSeconds, 0);
    const completion = percent(played, totalSongs);
    const avgSet = shows ? Math.round(musicTime / shows) : 0;
    const requests = requestLogForFilteredRecaps.length;
    return { shows, played, skipped, pending, totalSongs, musicTime, completion, avgSet, requests };
  }, [filteredRecaps, requestLogForFilteredRecaps.length]);

  const songInsights = useMemo<SongInsight[]>(() => {
    const map = new Map<string, SongInsight>();

    const ensure = (songId: string): SongInsight => {
      const song = songById.get(songId);
      const current = map.get(songId);
      if (current) return current;
      const next: SongInsight = {
        songId,
        title: song?.title ?? songId,
        artist: song?.artist ?? "Unknown artist",
        played: 0,
        skipped: 0,
        pending: 0,
        requests: 0,
        notes: 0,
        score: 0,
      };
      map.set(songId, next);
      return next;
    };

    for (const recap of filteredRecaps) {
      const recapDate = getRecapDate(recap);
      for (const songId of recap.playedIds) {
        const insight = ensure(songId);
        insight.played += 1;
        insight.lastPlayed = newestDate(insight.lastPlayed, recapDate);
      }
      for (const songId of recap.skippedIds) ensure(songId).skipped += 1;
      for (const songId of recap.pendingIds) ensure(songId).pending += 1;
    }

    for (const request of requestLogForFilteredRecaps) {
      if (!request.song_id) continue;
      ensure(request.song_id).requests += 1;
    }

    for (const note of perfNotes) {
      if (!map.has(note.song_id)) continue;
      ensure(note.song_id).notes += 1;
    }

    return Array.from(map.values())
      .map((insight) => ({
        ...insight,
        score: insight.played * 4 + insight.requests * 3 + insight.notes - insight.skipped * 2,
      }))
      .sort((a, b) => b.score - a.score || b.played - a.played || b.requests - a.requests || a.title.localeCompare(b.title));
  }, [filteredRecaps, perfNotes, requestLogForFilteredRecaps, songById]);

  const venueInsights = useMemo<VenueInsight[]>(() => {
    const map = new Map<string, VenueInsight>();
    const ensure = (venueId: string): VenueInsight => {
      const venue = venueById.get(venueId);
      const current = map.get(venueId);
      if (current) return current;
      const next: VenueInsight = {
        venueId,
        name: venue?.name ?? (venueId === "none" ? "No venue assigned" : "Unknown venue"),
        city: venue?.city,
        shows: 0,
        avgCompletion: 0,
        musicTime: 0,
        requests: 0,
        crowdNotes: [],
      };
      map.set(venueId, next);
      return next;
    };

    const completionTotals = new Map<string, number>();
    for (const recap of filteredRecaps) {
      const venueId = setlistVenueId(recap, setlistById);
      const insight = ensure(venueId);
      insight.shows += 1;
      insight.musicTime += recap.timePlayedSeconds;
      insight.lastShow = newestDate(insight.lastShow, getRecapDate(recap));
      if (recap.crowdFavorites?.trim()) insight.crowdNotes.push(recap.crowdFavorites.trim());
      completionTotals.set(venueId, (completionTotals.get(venueId) ?? 0) + completionForRecap(recap));
    }

    for (const row of requestLogForFilteredRecaps) {
      if (!row.gig_id) continue;
      const setlist = setlistById.get(row.gig_id);
      ensure(setlist?.venueId ?? "none").requests += 1;
    }

    return Array.from(map.values())
      .map((insight) => ({
        ...insight,
        avgCompletion: insight.shows ? Math.round((completionTotals.get(insight.venueId) ?? 0) / insight.shows) : 0,
      }))
      .sort((a, b) => b.shows - a.shows || b.musicTime - a.musicTime || a.name.localeCompare(b.name));
  }, [filteredRecaps, requestLogForFilteredRecaps, setlistById, venueById]);

  const completionTrend = useMemo(() => {
    return filteredRecaps
      .slice()
      .reverse()
      .slice(-12)
      .map((recap) => ({
        name: shortDateLabel(getRecapDate(recap)),
        completion: completionForRecap(recap),
        played: recap.playedCount,
        skipped: recap.skippedCount,
      }));
  }, [filteredRecaps]);

  const topSongChart = useMemo(() => {
    return songInsights.slice(0, 8).map((song) => ({
      name: song.title.length > 16 ? `${song.title.slice(0, 15)}…` : song.title,
      played: song.played,
      requests: song.requests,
    }));
  }, [songInsights]);

  const handleDeleteRecap = async (recap: ShowRecap) => {
    const ok = await confirm({
      title: "Delete show recap?",
      description: `This removes the saved recap for ${recap.setlistName}. It will not change songs, notes, setlists, or request history.`,
      confirmLabel: "Delete recap",
      destructive: true,
    });
    if (!ok) return;
    showRecapsStore.delete(recap.id);
    setRecaps(showRecapsStore.getAll());
    toast({ title: "Recap deleted" });
  };

  const handleExportHistory = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJson(`maggie-performance-history-${stamp}.json`, {
      exportedAt: new Date().toISOString(),
      filters: { search, venueFilter, setlistFilter, dateRange },
      summary,
      recaps: filteredRecaps,
      songInsights,
      venueInsights,
    });
    toast({ title: "Performance history exported" });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 via-background to-background p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge className="bg-primary text-primary-foreground">Phase 5.17</Badge>
              <Badge variant="outline">Show memory</Badge>
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-primary">Performance History</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Review saved show recaps, track songs that are working, spot skipped songs, and see venue-level patterns from past performances.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={loadHistory} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button onClick={handleExportHistory} className="gap-2" disabled={!filteredRecaps.length}>
              <Download className="h-4 w-4" /> Export history
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" /> History filters
          </CardTitle>
          <CardDescription>Filter by venue, set, time window, or text from recap notes and songs.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div className="space-y-2">
              <Label htmlFor="history-search">Search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="history-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Song, venue, setlist, note…"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Venue</Label>
              <Select value={venueFilter} onValueChange={setVenueFilter}>
                <SelectTrigger><SelectValue placeholder="Venue" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All venues</SelectItem>
                  <SelectItem value="none">No venue assigned</SelectItem>
                  {venues.map((venue) => (
                    <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Setlist</Label>
              <Select value={setlistFilter} onValueChange={setSetlistFilter}>
                <SelectTrigger><SelectValue placeholder="Setlist" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All setlists</SelectItem>
                  {setlists.map((setlist) => (
                    <SelectItem key={setlist.id} value={setlist.id}>{setlist.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date range</Label>
              <Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRange)}>
                <SelectTrigger><SelectValue placeholder="Date range" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="365">Last year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label="Shows logged" value={String(summary.shows)} helper={`${filteredRecaps.length} recap${filteredRecaps.length === 1 ? "" : "s"} in view`} />
        <StatCard icon={TrendingUp} label="Completion" value={`${summary.completion}%`} helper={`${summary.played} played · ${summary.skipped} skipped`} />
        <StatCard icon={Clock} label="Avg music time" value={formatDurationLong(summary.avgSet)} helper={`${formatDurationLong(summary.musicTime)} total played`} />
        <StatCard icon={Heart} label="Requests handled" value={String(summary.requests)} helper="From approved/declined request log" />
      </div>

      {filteredRecaps.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className="rounded-full bg-muted p-4 text-muted-foreground">
              <History className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">No performance recaps yet</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Finish a set from Stage and save a recap. This dashboard will start showing show history, song trends, and venue patterns.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="shows" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="shows">Shows</TabsTrigger>
            <TabsTrigger value="songs">Songs</TabsTrigger>
            <TabsTrigger value="venues">Venues</TabsTrigger>
            <TabsTrigger value="charts">Charts</TabsTrigger>
          </TabsList>

          <TabsContent value="shows" className="space-y-4">
            {filteredRecaps.map((recap) => {
              const setlist = setlistById.get(recap.setlistId);
              const venue = setlist?.venueId ? venueById.get(setlist.venueId) : undefined;
              const completion = completionForRecap(recap);
              return (
                <Card key={recap.id}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <CardTitle className="text-xl">{recap.setlistName}</CardTitle>
                        <CardDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {dateLabel(getRecapDate(recap))}</span>
                          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {venue?.name ?? "No venue assigned"}</span>
                          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatDurationLong(recap.timePlayedSeconds)} played</span>
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={completion >= 90 ? "bg-emerald-600 text-white" : completion >= 60 ? "bg-amber-500 text-black" : "bg-destructive text-destructive-foreground"}>
                          {completion}% complete
                        </Badge>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRecap(recap)} aria-label="Delete recap">
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Progress value={completion} />
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{recap.playedCount} played</span>
                        <span>·</span>
                        <span>{recap.skippedCount} skipped</span>
                        <span>·</span>
                        <span>{recap.pendingCount} pending</span>
                        <span>·</span>
                        <span>{recap.requestsPendingCount} pending request{recap.requestsPendingCount === 1 ? "" : "s"} at wrap-up</span>
                      </div>
                    </div>
                    {(recap.whatWorked || recap.changeNextTime || recap.crowdFavorites) && (
                      <div className="grid gap-3 md:grid-cols-3">
                        {recap.whatWorked && (
                          <div className="rounded-xl border border-border bg-muted/30 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What worked</p>
                            <p className="mt-1 text-sm">{recap.whatWorked}</p>
                          </div>
                        )}
                        {recap.changeNextTime && (
                          <div className="rounded-xl border border-border bg-muted/30 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Change next time</p>
                            <p className="mt-1 text-sm">{recap.changeNextTime}</p>
                          </div>
                        )}
                        {recap.crowdFavorites && (
                          <div className="rounded-xl border border-border bg-muted/30 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Crowd favorites</p>
                            <p className="mt-1 text-sm">{recap.crowdFavorites}</p>
                          </div>
                        )}
                      </div>
                    )}
                    {recap.songNotes.some((note) => note.note.trim()) && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Song notes</p>
                        <div className="space-y-2">
                          {recap.songNotes.filter((note) => note.note.trim()).map((note) => (
                            <div key={`${recap.id}-${note.songId}`} className="rounded-lg border border-border p-3 text-sm">
                              <div className="mb-1 flex items-center gap-2">
                                <Badge variant="outline">{note.status}</Badge>
                                <span className="font-medium">{note.songTitle}</span>
                              </div>
                              <p className="text-muted-foreground">{note.note}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="songs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><Music2 className="h-5 w-5" /> Song trends</CardTitle>
                <CardDescription>Top songs combine plays, requests, notes, and skips from the filtered history.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Song</TableHead>
                      <TableHead className="text-right">Played</TableHead>
                      <TableHead className="text-right">Requests</TableHead>
                      <TableHead className="text-right">Skipped</TableHead>
                      <TableHead className="text-right">Notes</TableHead>
                      <TableHead>Last played</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {songInsights.slice(0, 25).map((song) => (
                      <TableRow key={song.songId}>
                        <TableCell>
                          <div className="font-medium">{song.title}</div>
                          <div className="text-xs text-muted-foreground">{song.artist}</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{song.played}</TableCell>
                        <TableCell className="text-right">{song.requests}</TableCell>
                        <TableCell className="text-right">{song.skipped}</TableCell>
                        <TableCell className="text-right">{song.notes}</TableCell>
                        <TableCell>{song.lastPlayed ? dateLabel(song.lastPlayed) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="venues" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><MapPin className="h-5 w-5" /> Venue trends</CardTitle>
                <CardDescription>See where sets are strongest and what crowd-favorite notes have been saved.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {venueInsights.map((venue) => (
                    <div key={venue.venueId} className="rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">{venue.name}</h3>
                          {venue.city && <p className="text-xs text-muted-foreground">{venue.city}</p>}
                        </div>
                        <Badge variant="outline">{venue.shows} show{venue.shows === 1 ? "" : "s"}</Badge>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                        <div className="rounded-lg bg-muted/40 p-2">
                          <div className="text-lg font-semibold">{venue.avgCompletion}%</div>
                          <div className="text-xs text-muted-foreground">avg complete</div>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-2">
                          <div className="text-lg font-semibold">{formatDurationLong(venue.musicTime)}</div>
                          <div className="text-xs text-muted-foreground">music time</div>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-2">
                          <div className="text-lg font-semibold">{venue.requests}</div>
                          <div className="text-xs text-muted-foreground">requests</div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">Last show: {venue.lastShow ? dateLabel(venue.lastShow) : "—"}</div>
                      {venue.crowdNotes.length > 0 && (
                        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">Crowd favorites</p>
                          <p className="line-clamp-3 text-sm text-muted-foreground">{venue.crowdNotes.slice(0, 3).join(" · ")}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="charts" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg"><TrendingUp className="h-5 w-5" /> Completion trend</CardTitle>
                  <CardDescription>Last twelve saved recaps in the current filter.</CardDescription>
                </CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={completionTrend}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="completion" name="Completion %" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg"><Star className="h-5 w-5" /> Top songs</CardTitle>
                  <CardDescription>Played count plus request activity.</CardDescription>
                </CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topSongChart} layout="vertical" margin={{ left: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                      <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={12} width={90} />
                      <Tooltip />
                      <Bar dataKey="played" name="Played" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                      <Bar dataKey="requests" name="Requests" fill="hsl(var(--accent))" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}

      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-2 p-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-2">
            <Users className="mt-0.5 h-4 w-4 text-primary" />
            <p>
              Show recaps are currently saved on this device and included in Backup Export. Cloud show-history sync can be added later if you want recaps available across every device.
            </p>
          </div>
        </CardContent>
      </Card>
      {ConfirmDialog}
    </div>
  );
}
