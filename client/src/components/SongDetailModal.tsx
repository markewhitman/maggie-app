import { Suspense, lazy, useState, useRef, useCallback, useEffect } from "react";
import type { Song, PerformanceNote } from "@/lib/data";
import { formatDuration } from "@/lib/data";
import { sbPdfs, sbSongPdfs, sbPerfNotes, sbSongs, type SbPerfNote } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StrumPattern } from "@/components/StrumPattern";
import { useToast } from "@/hooks/use-toast";
import { useConfirmDialog } from "@/hooks/use-confirm";
import {
  ExternalLink, Upload, Trash2, FileText, ChevronLeft, ChevronRight,
  Music, Guitar, Star, Clock, Loader2, AlertCircle, Info, Pencil, Save, Maximize2, UserPlus, Tag, Mic2
} from "lucide-react";
const FullscreenPdfViewer = lazy(() =>
  import("@/components/FullscreenPdfViewer").then((mod) => ({ default: mod.FullscreenPdfViewer }))
);
const PdfPreview = lazy(() => import("@/components/PdfPreview"));

interface Props {
  song: Song;
  onClose: () => void;
  onDelete?: (id: string) => void | Promise<void>;
  onEdit?: (updated: Song) => void; // if provided, shows Edit tab
  defaultTab?: "info" | "pdf" | "history" | "edit";
}

const DIFF_COLORS: Record<string, string> = {
  Beginner: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  Intermediate: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Advanced: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};


function sbToPerfNote(r: SbPerfNote): PerformanceNote {
  return {
    id: r.id,
    setlistId: r.setlist_id,
    songId: r.song_id,
    gigDate: r.gig_date ?? undefined,
    crowdReaction: r.crowd_reaction,
    tempoFeel: r.tempo_feel as PerformanceNote["tempoFeel"],
    lyricsConfidence: r.lyrics_confidence as PerformanceNote["lyricsConfidence"],
    notes: r.notes,
    createdAt: r.created_at,
  };
}

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

// ─── Edit Form ────────────────────────────────────────────

function EditForm({ song, onSave, onCancel }: { song: Song; onSave: (s: Song) => void | Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState<Song>({ ...song });
  const set = (field: keyof Song, value: any) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleTagsChange = (raw: string) => {
    set("tags", raw.split(",").map((t) => t.trim()).filter(Boolean));
  };

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {/* Title */}
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Title</Label>
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        {/* Artist */}
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Artist</Label>
          <Input value={form.artist} onChange={(e) => set("artist", e.target.value)} />
        </div>
        {/* Year */}
        <div className="space-y-1">
          <Label className="text-xs">Year</Label>
          <Input type="number" value={form.year} onChange={(e) => set("year", parseInt(e.target.value) || form.year)} />
        </div>
        {/* Difficulty */}
        <div className="space-y-1">
          <Label className="text-xs">Difficulty</Label>
          <Select value={form.difficulty} onValueChange={(v) => set("difficulty", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Beginner">Beginner</SelectItem>
              <SelectItem value="Intermediate">Intermediate</SelectItem>
              <SelectItem value="Advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Key */}
        <div className="space-y-1">
          <Label className="text-xs">Key</Label>
          <Input value={form.key} onChange={(e) => set("key", e.target.value)} placeholder="G Major" />
        </div>
        {/* Capo */}
        <div className="space-y-1">
          <Label className="text-xs">Capo</Label>
          <Input value={form.capo} onChange={(e) => set("capo", e.target.value)} placeholder="No capo" />
        </div>
        {/* Tempo BPM */}
        <div className="space-y-1">
          <Label className="text-xs">Tempo (BPM)</Label>
          <Input type="number" value={form.tempo} onChange={(e) => set("tempo", parseInt(e.target.value) || form.tempo)} />
        </div>
        {/* Tempo Feel */}
        <div className="space-y-1">
          <Label className="text-xs">Tempo Feel</Label>
          <Select value={form.tempoFeel} onValueChange={(v) => set("tempoFeel", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Ballad", "Mid-Tempo", "Driving", "Up-Tempo", "Upbeat"].map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Duration */}
        <div className="space-y-1">
          <Label className="text-xs">Duration (m:ss)</Label>
          <Input
            value={form.duration ? `${Math.floor((form.duration ?? 0) / 60)}:${((form.duration ?? 0) % 60).toString().padStart(2, "0")}` : ""}
            onChange={(e) => {
              const val = e.target.value;
              const parts = val.split(":");
              if (parts.length === 2) {
                const m = parseInt(parts[0]) || 0;
                const s = parseInt(parts[1]) || 0;
                set("duration", m * 60 + Math.min(s, 59));
              } else if (parts.length === 1 && val !== "") {
                const m = parseInt(parts[0]) || 0;
                set("duration", m * 60);
              }
            }}
            placeholder="3:30"
          />
        </div>
        {/* Genre */}
        <div className="space-y-1">
          <Label className="text-xs">Genre</Label>
          <Input value={form.genre} onChange={(e) => set("genre", e.target.value)} />
        </div>
        {/* Mood */}
        <div className="space-y-1">
          <Label className="text-xs">Mood</Label>
          <Input value={form.mood} onChange={(e) => set("mood", e.target.value)} />
        </div>
        {/* Energy */}
        <div className="space-y-1">
          <Label className="text-xs">Energy</Label>
          <Select value={form.energy ?? "medium"} onValueChange={(v) => set("energy", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Guitar Type */}
        <div className="space-y-1">
          <Label className="text-xs">Guitar Type</Label>
          <Select value={form.guitarType} onValueChange={(v) => set("guitarType", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="acoustic">Acoustic</SelectItem>
              <SelectItem value="electric">Electric</SelectItem>
              <SelectItem value="either">Either</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Chords */}
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Chords</Label>
          <Input value={form.chords} onChange={(e) => set("chords", e.target.value)} placeholder="G, D, Em, C" />
        </div>
        {/* Strumming */}
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Strumming Pattern</Label>
          <Input value={form.strumming} onChange={(e) => set("strumming", e.target.value)} placeholder="D DU UDU" />
        </div>
        {/* Tags */}
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Tags (comma-separated)</Label>
          <Input
            value={Array.isArray(form.tags) ? form.tags.join(", ") : ""}
            onChange={(e) => handleTagsChange(e.target.value)}
            placeholder="crowd-pleaser, slow-build, singalong"
          />
        </div>
        {/* Stage tip */}
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Stage Tip / Performance Note</Label>
          <Textarea
            value={form.performanceNote}
            onChange={(e) => set("performanceNote", e.target.value)}
            rows={2}
            placeholder="Key change after bridge, watch tempo on verse 2…"
          />
        </div>
        {/* UG URL */}
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Ultimate Guitar URL</Label>
          <Input value={form.ultimateGuitarUrl} onChange={(e) => set("ultimateGuitarUrl", e.target.value)} placeholder="https://tabs.ultimate-guitar.com/…" />
        </div>
      </div>
      <div className="flex gap-2 pt-2 border-t border-border">
        <Button onClick={() => onSave(form)} className="flex-1 gap-1.5">
          <Save className="w-4 h-4" /> Save Changes
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────

export function SongDetailModal({ song: initialSong, onClose, onDelete, onEdit, defaultTab = "info" }: Props) {
  const [song, setSong] = useState<Song>(initialSong);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [fullscreenPdf, setFullscreenPdf] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [perfHistory, setPerfHistory] = useState<PerformanceNote[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  // On open: load pdfUrl from Supabase in case it was uploaded on another device
  useEffect(() => {
    sbSongPdfs.getAll().then((map) => {
      const entry = map[initialSong.id];
      if (entry && entry.url !== initialSong.pdfUrl) {
        const patched = { ...initialSong, pdfUrl: entry.url, pdfFilename: entry.name, pdfAssetId: undefined };
        setSong(patched);
      }
    }).catch(() => {/* network error — use current in-memory value */});
  }, [initialSong.id]);

  // Load synced performance history for this song.
  useEffect(() => {
    sbPerfNotes
      .getForSong(initialSong.id)
      .then((rows) => setPerfHistory(rows.map(sbToPerfNote)))
      .catch(() => setPerfHistory([]));
  }, [initialSong.id]);

  const handleUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith(".pdf") && file.type !== "application/pdf") {
      toast({ title: "PDF files only", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const publicUrl = await sbPdfs.upload(song.id, file);
      // Save URL to Supabase so all devices can find it
      await sbSongPdfs.save(song.id, publicUrl, file.name);
      await sbSongs.updatePdf(song.id, publicUrl, file.name).catch(() => undefined);
      setSong((prev) => ({ ...prev, pdfUrl: publicUrl, pdfFilename: file.name, pdfAssetId: undefined }));
      toast({ title: "PDF uploaded!", description: file.name });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [song.id]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleDeletePdf = async () => {
    const confirmed = await confirm({
      title: "Remove this PDF?",
      description: "This unlinks and removes the sheet music PDF for this song.",
      confirmLabel: "Remove PDF",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await sbPdfs.deleteForSong(song.id);
      await sbSongPdfs.remove(song.id);
    } catch {
      // Ignore storage errors — remove locally regardless
    }
    await sbSongs.removePdf(song.id).catch(() => undefined);
    setSong((prev) => {
      const { pdfUrl: _url, pdfAssetId: _asset, pdfFilename: _name, ...rest } = prev;
      return rest as Song;
    });
    toast({ title: "PDF removed" });
  };

  const avgCrowd = perfHistory.length
    ? Math.round((perfHistory.reduce((a, n) => a + n.crowdReaction, 0) / perfHistory.length) * 10) / 10
    : null;

  return (
    <>
      {ConfirmDialog}
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Amber top bar */}
        <div className="capo-badge-bar bg-primary/10 border-b border-primary/20 px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-display font-bold text-lg italic truncate">{song.title}</div>
            <div className="text-muted-foreground text-sm truncate">{song.artist} · {song.year}</div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {song.userAdded && (
              <Badge variant="outline" className="gap-1 border-primary/40 text-primary"><UserPlus className="w-3 h-3" /> Custom</Badge>
            )}
            {song.pdfUrl && (
              <Badge variant="outline" className="gap-1 border-primary/40 text-primary"><FileText className="w-3 h-3" /> PDF</Badge>
            )}
            {song.capo && song.capo !== "No capo" && <Badge className="capo-badge">{song.capo}</Badge>}
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${DIFF_COLORS[song.difficulty]}`}>
              {song.difficulty}
            </span>
            {onDelete && song.userAdded && (
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 text-destructive"
                onClick={() => onDelete(song.id)}
                title="Delete song"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="w-full rounded-none border-b bg-transparent justify-start px-6 h-10 gap-1">
            <TabsTrigger value="info" className="text-xs gap-1.5"><Info className="w-3 h-3" />Details</TabsTrigger>
            <TabsTrigger value="pdf" className="text-xs gap-1.5"><FileText className="w-3 h-3" />Sheet Music</TabsTrigger>
            <TabsTrigger value="history" className="text-xs gap-1.5"><Star className="w-3 h-3" />Performance History</TabsTrigger>
            {onEdit && (
              <TabsTrigger value="edit" className="text-xs gap-1.5 ml-auto"><Pencil className="w-3 h-3" />Edit</TabsTrigger>
            )}
          </TabsList>

          {/* ── INFO TAB ── */}
          <TabsContent value="info" className="p-4 sm:p-6 space-y-5 mt-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-muted/50 rounded-xl p-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Key</div>
                <div className="font-medium text-sm leading-snug">{song.key || "Unknown"}</div>
              </div>
              <div className="bg-muted/50 rounded-xl p-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Capo</div>
                <div className="font-medium text-sm">{song.capo || "No capo"}</div>
              </div>
              <div className="bg-muted/50 rounded-xl p-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Tempo
                </div>
                <div className="font-medium text-sm">{song.tempo} BPM</div>
                <div className="text-xs text-muted-foreground mt-0.5">{song.tempoFeel}</div>
              </div>
              <div className="bg-muted/50 rounded-xl p-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Duration</div>
                <div className="font-medium text-sm">{song.duration ? formatDuration(song.duration) : "Not set"}</div>
                {!song.duration && <div className="text-xs text-muted-foreground mt-0.5">Add in Edit for set timing</div>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-xl p-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Guitar className="w-3 h-3" /> Chords
                </div>
                <div className="font-medium text-sm leading-relaxed">{song.chords || "No chords saved yet"}</div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Strumming</div>
                {song.strumming ? (
                  <>
                    <StrumPattern pattern={song.strumming} />
                    <div className="text-xs text-muted-foreground mt-1.5 leading-snug">{song.strumming}</div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">No strumming pattern saved yet</div>
                )}
              </div>
            </div>

            {song.performanceNote && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-3">
                <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1.5">Stage Tip</div>
                <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-100">{song.performanceNote}</p>
              </div>
            )}

            <div className="bg-muted/30 border border-border rounded-xl p-3 space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Tag className="w-3 h-3" /> Library Metadata
              </div>
              <div className="flex flex-wrap gap-1.5">
                {song.genre && <Badge variant="secondary" className="text-xs">{song.genre}</Badge>}
                {song.mood && <Badge variant="secondary" className="text-xs">{song.mood}</Badge>}
                {song.energy && <Badge variant="outline" className="text-xs capitalize">{song.energy} energy</Badge>}
                {song.vocalStyle && <Badge variant="outline" className="text-xs capitalize"><Mic2 className="w-3 h-3 mr-1" />{song.vocalStyle}</Badge>}
                {song.guitarType && <Badge variant="outline" className="text-xs capitalize">{song.guitarType} guitar</Badge>}
                {song.decade && <Badge variant="outline" className="text-xs">{song.decade}</Badge>}
                {song.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs capitalize">{tag.replace(/-/g, " ")}</Badge>
                ))}
              </div>
              {song.similar && song.similar.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Similar songs: <span className="text-foreground">{song.similar.join(", ")}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              {song.pdfUrl && (
                <Button size="sm" className="gap-1.5" onClick={() => setFullscreenPdf(true)}>
                  <FileText className="w-4 h-4" /> Open Sheet Music
                </Button>
              )}
              {song.ultimateGuitarUrl && (
                <a href={song.ultimateGuitarUrl} target="_blank" rel="noopener noreferrer" className="inline-flex">
                  <Button variant="outline" size="sm" className="gap-1.5 w-full sm:w-auto">
                    <ExternalLink className="w-4 h-4" /> Open on Ultimate Guitar
                  </Button>
                </a>
              )}
            </div>

            {fullscreenPdf && song.pdfUrl && (
              <Suspense fallback={null}>
                <FullscreenPdfViewer
                  pdfUrl={song.pdfUrl}
                  songTitle={song.title}
                  songId={song.id}
                  onClose={() => setFullscreenPdf(false)}
                  initialPage={pageNumber}
                />
              </Suspense>
            )}
          </TabsContent>

          {/* ── PDF TAB ── */}
          <TabsContent value="pdf" className="p-6 mt-0 space-y-4">

            {/* Fullscreen overlay — rendered outside the Dialog so it covers everything */}
            {fullscreenPdf && song.pdfUrl && (
              <Suspense fallback={null}>
                <FullscreenPdfViewer
                  pdfUrl={song.pdfUrl}
                  songTitle={song.title}
                  songId={song.id}
                  onClose={() => setFullscreenPdf(false)}
                  initialPage={pageNumber}
                />
              </Suspense>
            )}

            {song.pdfUrl ? (
              <>
                {/* ── Primary action: open fullscreen ── */}
                <button
                  onClick={() => setFullscreenPdf(true)}
                  className="w-full flex items-center justify-center gap-3 bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl py-4 font-semibold text-base transition-all shadow-md"
                >
                  <Maximize2 className="w-5 h-5" />
                  Open Sheet Music
                </button>

                {/* Hint text */}
                <p className="text-xs text-center text-muted-foreground -mt-1">
                  Opens full-screen · tap edges to turn pages · press Esc to close
                </p>

                {/* ── Compact preview + management row ── */}
                <div className="border border-border rounded-xl overflow-hidden bg-muted/30 relative">
                  {/* Mini toolbar */}
                  <div className="flex items-center justify-between bg-muted/60 px-3 py-1.5 border-b border-border">
                    <div className="flex items-center gap-1.5">
                      {numPages > 1 && (
                        <>
                          <Button variant="ghost" size="icon" className="w-6 h-6"
                            disabled={pageNumber <= 1}
                            onClick={() => setPageNumber((p) => p - 1)}>
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </Button>
                          <span className="text-xs text-muted-foreground tabular-nums">{pageNumber}/{numPages}</span>
                          <Button variant="ghost" size="icon" className="w-6 h-6"
                            disabled={pageNumber >= numPages}
                            onClick={() => setPageNumber((p) => p + 1)}>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      <span className="text-xs text-muted-foreground truncate max-w-[120px] ml-1">{song.pdfFilename}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <a href={song.pdfUrl} target="_blank" rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary" title="Open in browser">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <Button variant="ghost" size="icon" className="w-6 h-6 text-destructive"
                        onClick={handleDeletePdf} title="Remove PDF">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Small preview — click to fullscreen */}
                  <div
                    className="flex flex-col items-center cursor-pointer relative group"
                    onClick={() => setFullscreenPdf(true)}
                    title="Click to open full screen"
                  >
                    {pdfLoading && (
                      <div className="absolute inset-0 flex items-center justify-center z-10 bg-muted/50">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    )}
                    {pdfError ? (
                      <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground text-center px-4">
                        <AlertCircle className="w-7 h-7 text-destructive" />
                        <p className="text-xs">{pdfError}</p>
                      </div>
                    ) : (
                      <>
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center z-10">
                          <Maximize2 className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 drop-shadow-lg transition-opacity" />
                        </div>
                        <Suspense fallback={<div className="h-[200px] flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>}>
                          <PdfPreview
                            pdfUrl={song.pdfUrl}
                            pageNumber={pageNumber}
                            width={320}
                            onLoadSuccess={(n) => { setNumPages(n); setPdfLoading(false); }}
                            onLoadError={(message) => { setPdfError("Could not load preview. " + message); setPdfLoading(false); }}
                          />
                        </Suspense>
                      </>
                    )}
                  </div>
                </div>

                {/* Replace PDF */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Replace PDF
                </Button>
              </>
            ) : (
              /* Upload zone */
              <div
                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-4 text-center transition-colors ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="font-medium mb-1">Drop a PDF here</p>
                  <p className="text-sm text-muted-foreground">Or click to pick a file</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="gap-1.5"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? "Uploading…" : "Choose PDF"}
                  </Button>
                  <a
                    href={song.ultimateGuitarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" className="gap-1.5">
                      <ExternalLink className="w-4 h-4" />
                      Open on Ultimate Guitar
                    </Button>
                  </a>
                </div>
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileInput}
            />
          </TabsContent>

          {/* ── PERFORMANCE HISTORY TAB ── */}
          <TabsContent value="history" className="p-6 mt-0">
            {perfHistory.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Music className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No performance notes yet</p>
                <p className="text-sm mt-1">Notes you add during gigs will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {avgCrowd !== null && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 flex items-center gap-3 mb-4">
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase">Avg Crowd Reaction</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StarRating value={Math.round(avgCrowd)} />
                        <span className="text-sm font-bold">{avgCrowd}</span>
                        <span className="text-xs text-muted-foreground">across {perfHistory.length} gig{perfHistory.length !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                  </div>
                )}
                {perfHistory.map((note) => (
                  <div key={note.id} className="bg-muted/50 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {note.gigDate || new Date(note.createdAt).toLocaleDateString()}
                      </div>
                      <StarRating value={note.crowdReaction} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {note.tempoFeel && (
                        <Badge variant="outline" className="text-xs">Tempo: {note.tempoFeel}</Badge>
                      )}
                      {note.lyricsConfidence && (
                        <Badge variant="outline" className="text-xs">Lyrics: {note.lyricsConfidence}</Badge>
                      )}
                    </div>
                    {note.notes && <p className="text-sm text-muted-foreground leading-relaxed">{note.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          {/* ── EDIT TAB ── */}
          {onEdit && (
            <TabsContent value="edit" className="mt-0">
              <EditForm
                song={song}
                onSave={async (updated) => {
                  try {
                    await sbSongs.upsert(updated);
                    setSong(updated);
                    onEdit(updated);
                    toast({ title: "Song updated", description: updated.title });
                  } catch (err: any) {
                    toast({
                      title: "Could not save song",
                      description: err?.message ?? "The cloud save failed. Try again when you are online.",
                      variant: "destructive",
                    });
                  }
                }}
                onCancel={onClose}
              />
            </TabsContent>
          )}
        </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
