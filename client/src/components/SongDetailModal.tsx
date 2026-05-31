import { Suspense, lazy, useState, useRef, useCallback, useEffect } from "react";
import type { Song, PerformanceNote, SongAudioResource } from "@/lib/data";
import { formatDuration } from "@/lib/data";
import { analyzeSongPdf, enhanceSongPdfWithAi, confidenceLabel, type SmartPdfImportResult, type SmartImportSuggestion } from "@/lib/smartPdfImport";
import { sbPdfs, sbSongPdfs, sbPerfNotes, sbSongs, type SbPerfNote } from "@/lib/supabase";
import { AUDIO_RESOURCE_TYPES, audioTypeLabel, audioTypeShortLabel, audioTypeTone, detectAudioProvider, getPrimaryAudioResource, isValidAudioUrl, normalizeAudioResources, openAudioResource } from "@/lib/audioResources";
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
  Music, Guitar, Star, Clock, Loader2, AlertCircle, Info, Pencil, Save, Maximize2, UserPlus, Tag, Mic2, Sparkles, Wand2, CheckCircle2, AlertTriangle, Headphones, PlayCircle, Plus, X, Link2
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


const MAX_AI_PDF_BYTES = 12 * 1024 * 1024;

function parseDurationSuggestion(raw?: string): number | undefined {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return undefined;
  const parts = trimmed.split(":").map((part) => part.trim());
  if (parts.length === 1) {
    const minutes = Number(parts[0]);
    return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : undefined;
  }
  if (parts.length === 2) {
    const minutes = Number(parts[0]);
    const seconds = Number(parts[1]);
    if (Number.isFinite(minutes) && Number.isFinite(seconds) && minutes >= 0 && seconds >= 0) {
      return Math.round(minutes * 60 + Math.min(seconds, 59));
    }
  }
  return undefined;
}

function suggestionTone(confidence: SmartImportSuggestion["confidence"]): string {
  if (confidence === "high") return "border-emerald-300/50 bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100";
  if (confidence === "medium") return "border-amber-300/50 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-100";
  return "border-border bg-muted/50 text-muted-foreground";
}

function qualityTone(confidence: SmartImportSuggestion["confidence"]): string {
  if (confidence === "high") return "border-emerald-300/50 bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100";
  if (confidence === "medium") return "border-amber-300/50 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-100";
  return "border-red-300/50 bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-100";
}

function mergeTagArray(current: string[] = [], incoming?: string): string[] {
  const tags = new Set(current.map((tag) => tag.trim()).filter(Boolean));
  incoming?.split(",").map((tag) => tag.trim()).filter(Boolean).forEach((tag) => tags.add(tag));
  return Array.from(tags);
}

function isMissingSongValue(song: Song, field: keyof Song): boolean {
  const value = song[field];
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "" || value.trim().toLowerCase() === "unknown";
  if (typeof value === "number") return !Number.isFinite(value) || value <= 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function ExistingSongSuggestionRow({ label, current, suggestion }: { label: string; current?: string | number; suggestion?: SmartImportSuggestion }) {
  if (!suggestion) return null;
  const currentText = String(current ?? "").trim();
  const changed = currentText && currentText.toLowerCase() !== suggestion.value.toLowerCase();
  return (
    <div className="rounded-lg border border-border/70 bg-background/70 px-2.5 py-2 text-xs space-y-1.5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
        <div className="sm:w-28 font-semibold text-muted-foreground">{label}</div>
        <div className="flex-1 min-w-0 font-medium break-words">{suggestion.value}</div>
        <Badge variant="outline" className={`w-fit text-[10px] ${suggestionTone(suggestion.confidence)}`}>
          {confidenceLabel(suggestion.confidence)} · {suggestion.source}
        </Badge>
      </div>
      {currentText && (
        <div className={`pl-0 sm:pl-28 text-[11px] ${changed ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>
          Current: {currentText}{changed ? " · suggested update" : " · matches current"}
        </div>
      )}
    </div>
  );
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

function getEditableAudioResources(resources?: SongAudioResource[] | null): SongAudioResource[] {
  if (!Array.isArray(resources)) return [];
  return resources.map((resource) => {
    const type = resource?.type || "reference";
    const url = String(resource?.url ?? "");
    return {
      id: resource?.id || `audio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      label: resource?.label ?? audioTypeLabel(type),
      url,
      provider: resource?.provider ?? (url.trim() ? detectAudioProvider(url) : ""),
      notes: resource?.notes ?? "",
    } satisfies SongAudioResource;
  });
}

function AudioResourceCard({ resource }: { resource: SongAudioResource }) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <Badge variant="outline" className={`text-[10px] gap-1 ${audioTypeTone(resource.type)}`}>
            <Headphones className="w-3 h-3" /> {audioTypeShortLabel(resource.type)}
          </Badge>
          {resource.provider && <Badge variant="secondary" className="text-[10px]">{resource.provider}</Badge>}
        </div>
        <div className="font-semibold text-sm truncate">{resource.label || audioTypeLabel(resource.type)}</div>
        {resource.notes && <p className="text-xs text-muted-foreground mt-1 leading-snug">{resource.notes}</p>}
        <div className="text-[11px] text-muted-foreground truncate mt-1">{resource.url}</div>
      </div>
      <Button size="sm" className="gap-1.5 shrink-0" onClick={() => openAudioResource(resource)}>
        <PlayCircle className="w-4 h-4" /> Open
      </Button>
    </div>
  );
}

// ─── Edit Form ────────────────────────────────────────────

function EditForm({ song, onSave, onCancel }: { song: Song; onSave: (s: Song) => void | Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState<Song>({ ...song, audioResources: normalizeAudioResources(song.audioResources) });
  const set = (field: keyof Song, value: any) => setForm((prev) => ({ ...prev, [field]: value }));

  const audioResources = getEditableAudioResources(form.audioResources);
  const updateAudioResource = (index: number, patch: Partial<SongAudioResource>) => {
    const next = [...audioResources];
    const current = next[index];
    if (!current) return;
    const patched = { ...current, ...patch };
    if (patch.url !== undefined) patched.provider = patch.url.trim() ? detectAudioProvider(patch.url) : "";
    next[index] = patched;
    set("audioResources", next);
  };
  const addAudioResource = (type: SongAudioResource["type"] = "original") => {
    set("audioResources", [
      ...audioResources,
      { id: `audio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, label: audioTypeLabel(type), url: "", provider: "", notes: "" },
    ]);
  };
  const removeAudioResource = (index: number) => {
    set("audioResources", audioResources.filter((_, i) => i !== index));
  };
  const saveEditedSong = () => {
    const editableAudioResources = getEditableAudioResources(form.audioResources);
    const invalid = editableAudioResources.find((resource) => resource.url.trim() && !isValidAudioUrl(resource.url));
    if (invalid) return;
    onSave({ ...form, audioResources: normalizeAudioResources(editableAudioResources) });
  };

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

        {/* Audio resources */}
        <div className="col-span-2 space-y-3 rounded-xl border border-border bg-muted/25 p-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <Label className="text-xs flex items-center gap-1.5"><Headphones className="w-3.5 h-3.5" /> Recordings and backing tracks</Label>
              <p className="text-[11px] text-muted-foreground mt-1">Link the song card to original recordings, practice references, or backing tracks.</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={() => addAudioResource("original")}>
                <Plus className="w-3.5 h-3.5" /> Original
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={() => addAudioResource("backing")}>
                <Plus className="w-3.5 h-3.5" /> Backing
              </Button>
            </div>
          </div>

          {audioResources.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-background/50 p-3 text-xs text-muted-foreground">
              No audio links yet. Add a reference recording or backing track URL.
            </div>
          ) : (
            <div className="space-y-2">
              {audioResources.map((resource, index) => {
                const invalidUrl = !!resource.url && !isValidAudioUrl(resource.url);
                return (
                  <div key={resource.id} className="rounded-lg border border-border bg-background/70 p-2 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr_auto] gap-2">
                      <Select value={resource.type} onValueChange={(v) => updateAudioResource(index, { type: v as SongAudioResource["type"], label: resource.label || audioTypeLabel(v as SongAudioResource["type"]) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AUDIO_RESOURCE_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input value={resource.label} onChange={(e) => updateAudioResource(index, { label: e.target.value })} placeholder="Label" />
                      <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeAudioResource(index)} title="Remove audio link">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <Input value={resource.url} onChange={(e) => updateAudioResource(index, { url: e.target.value })} placeholder="https://…" inputMode="url" className={invalidUrl ? "border-destructive" : ""} />
                    {invalidUrl && <div className="text-[11px] text-destructive">Use a full http:// or https:// link.</div>}
                    <Textarea value={resource.notes ?? ""} onChange={(e) => updateAudioResource(index, { notes: e.target.value })} placeholder="Optional notes, e.g. acoustic reference, capo differs, backing track is in G…" rows={2} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2 pt-2 border-t border-border">
        <Button onClick={saveEditedSong} className="flex-1 gap-1.5">
          <Save className="w-4 h-4" /> Save Changes
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}


async function fetchCurrentPdfFile(pdfUrl: string, filename: string): Promise<File> {
  const response = await fetch(pdfUrl);
  if (!response.ok) throw new Error(`Could not fetch the attached PDF (${response.status}).`);
  const blob = await response.blob();
  return new File([blob], filename || "sheet-music.pdf", { type: blob.type || "application/pdf" });
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
  const [analyzingImport, setAnalyzingImport] = useState(false);
  const [enhancingImport, setEnhancingImport] = useState(false);
  const [smartImport, setSmartImport] = useState<SmartPdfImportResult | null>(null);
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

  const analyzePdfForSongUpdates = useCallback(async (file: File, options: { autoEnhanceScans?: boolean } = {}) => {
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "PDF is too large to analyze", description: "The file is attached, but analysis is limited to PDFs under 20 MB.", variant: "destructive" });
      return;
    }

    setAnalyzingImport(true);
    setSmartImport(null);
    try {
      const localResult = await analyzeSongPdf(file, [song]);
      setSmartImport(localResult);

      if (!localResult.readableTextFound && options.autoEnhanceScans !== false) {
        if (file.size > MAX_AI_PDF_BYTES) {
          toast({
            title: "PDF attached; AI/OCR skipped",
            description: "This scan is over 12 MB. Compress it or use Analyze PDF manually after replacing with a smaller file.",
          });
          return;
        }

        setEnhancingImport(true);
        const enhanced = await enhanceSongPdfWithAi(file, localResult, [song], song);
        setSmartImport(enhanced);
        toast({ title: "AI/OCR suggestions ready", description: "Review the suggested updates before applying them to this song card." });
        return;
      }

      toast({
        title: localResult.readableTextFound ? "PDF scanned for song details" : "PDF attached",
        description: localResult.readableTextFound
          ? "Review suggested updates before applying them to this song card."
          : "No selectable text was found. Use AI/OCR to read the scanned pages.",
      });
    } catch (err: any) {
      toast({ title: "PDF analysis failed", description: err?.message ?? "The PDF was attached, but analysis failed.", variant: "destructive" });
    } finally {
      setAnalyzingImport(false);
      setEnhancingImport(false);
    }
  }, [song, toast]);

  const enhanceCurrentImport = useCallback(async () => {
    if (!smartImport) return;
    try {
      setEnhancingImport(true);
      const file = song.pdfUrl
        ? await fetchCurrentPdfFile(song.pdfUrl, song.pdfFilename || `${song.title}.pdf`)
        : null;
      if (!file) throw new Error("No PDF is attached to this song.");
      const enhanced = await enhanceSongPdfWithAi(file, smartImport, [song], song);
      setSmartImport(enhanced);
      toast({ title: "AI/OCR suggestions ready", description: "Review the suggestions before applying them." });
    } catch (err: any) {
      toast({ title: "AI/OCR failed", description: err?.message ?? "Could not analyze this PDF.", variant: "destructive" });
    } finally {
      setEnhancingImport(false);
    }
  }, [smartImport, song, toast]);

  const analyzeExistingPdf = useCallback(async () => {
    if (!song.pdfUrl) return;
    try {
      setAnalyzingImport(true);
      const file = await fetchCurrentPdfFile(song.pdfUrl, song.pdfFilename || `${song.title}.pdf`);
      await analyzePdfForSongUpdates(file, { autoEnhanceScans: true });
    } catch (err: any) {
      toast({ title: "Could not read PDF", description: err?.message ?? "Try replacing the PDF and analyzing again.", variant: "destructive" });
    } finally {
      setAnalyzingImport(false);
    }
  }, [analyzePdfForSongUpdates, song.pdfFilename, song.pdfUrl, song.title, toast]);

  const applySmartImportToSong = useCallback(async (overwrite: boolean) => {
    if (!smartImport) return;
    const s = smartImport.suggestions;
    const updated: Song = { ...song };
    const applyString = (field: keyof Song, value?: string) => {
      if (!value) return;
      if (overwrite || isMissingSongValue(updated, field)) {
        (updated as any)[field] = value;
      }
    };

    applyString("title", s.title?.value);
    applyString("artist", s.artist?.value);
    applyString("key", s.key?.value);
    applyString("capo", s.capo?.value);
    applyString("chords", s.chords?.value);
    applyString("strumming", s.strumming?.value);
    applyString("genre", s.genre?.value);
    applyString("mood", s.mood?.value);
    applyString("energy", s.energy?.value as Song["energy"] | undefined);
    applyString("vocalStyle", s.vocalStyle?.value as Song["vocalStyle"] | undefined);
    applyString("ultimateGuitarUrl", s.ultimateGuitarUrl?.value);

    const tempoValue = s.tempo?.value ? Number(String(s.tempo.value).match(/\d+/)?.[0]) : undefined;
    if (tempoValue && (overwrite || !updated.tempo)) updated.tempo = tempoValue;

    const durationValue = parseDurationSuggestion(s.duration?.value);
    if (durationValue && (overwrite || !updated.duration)) updated.duration = durationValue;

    if (s.tags?.value) updated.tags = mergeTagArray(updated.tags, s.tags.value);

    if (s.performanceNote?.value) {
      if (overwrite || !updated.performanceNote?.trim()) {
        updated.performanceNote = s.performanceNote.value;
      } else if (!updated.performanceNote.toLowerCase().includes(s.performanceNote.value.toLowerCase())) {
        updated.performanceNote = `${updated.performanceNote}\n\nPDF import note: ${s.performanceNote.value}`;
      }
    }

    if (!updated.tags.includes("ai-reviewed")) updated.tags = mergeTagArray(updated.tags, "ai-reviewed");

    try {
      await sbSongs.upsert(updated);
      setSong(updated);
      onEdit?.(updated);
      toast({
        title: overwrite ? "Song card updated" : "Missing details filled",
        description: "Review the song card before using it live.",
      });
    } catch (err: any) {
      toast({ title: "Could not save updates", description: err?.message ?? "Try again when you are online.", variant: "destructive" });
    }
  }, [onEdit, smartImport, song, toast]);

  const handleUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith(".pdf") && file.type !== "application/pdf") {
      toast({ title: "PDF files only", variant: "destructive" });
      return;
    }
    setUploading(true);
    let uploaded = false;
    try {
      const publicUrl = await sbPdfs.upload(song.id, file);
      // Save URL to Supabase so all devices can find it
      await sbSongPdfs.save(song.id, publicUrl, file.name);
      await sbSongs.updatePdf(song.id, publicUrl, file.name).catch(() => undefined);
      setSong((prev) => ({ ...prev, pdfUrl: publicUrl, pdfFilename: file.name, pdfAssetId: undefined }));
      uploaded = true;
      toast({ title: "PDF uploaded!", description: `${file.name} — scanning for song-card updates…` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }

    if (uploaded) {
      await analyzePdfForSongUpdates(file, { autoEnhanceScans: true });
    }
  }, [analyzePdfForSongUpdates, song.id, toast]);

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

  const audioResources = normalizeAudioResources(song.audioResources);
  const primaryAudioResource = getPrimaryAudioResource(song);

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
            {audioResources.length > 0 && (
              <Badge variant="outline" className="gap-1 border-primary/40 text-primary"><Headphones className="w-3 h-3" /> Audio</Badge>
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
            <TabsTrigger value="audio" className="text-xs gap-1.5"><Headphones className="w-3 h-3" />Audio</TabsTrigger>
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
              {primaryAudioResource && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openAudioResource(primaryAudioResource)}>
                  <PlayCircle className="w-4 h-4" /> Open {audioTypeShortLabel(primaryAudioResource.type)}
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

          {/* ── AUDIO TAB ── */}
          <TabsContent value="audio" className="p-4 sm:p-6 mt-0 space-y-4">
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold">Recordings and backing tracks</div>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    Link this song to original recordings for practice, alternate references, or backing tracks for rehearsal and performance.
                  </p>
                </div>
              </div>
            </div>

            {audioResources.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground rounded-2xl border border-dashed border-border bg-muted/20">
                <Headphones className="w-9 h-9 mx-auto mb-3 opacity-45" />
                <p className="font-medium">No audio links yet</p>
                <p className="text-sm mt-1">Use Edit to add an original recording, practice reference, or backing track.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {audioResources.map((resource) => <AudioResourceCard key={resource.id} resource={resource} />)}
              </div>
            )}

            {onEdit && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => undefined} disabled>
                <Pencil className="w-4 h-4" /> Edit audio links from the Edit tab
              </Button>
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

                {/* PDF tools */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading || analyzingImport || enhancingImport}
                  >
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Replace PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={analyzeExistingPdf}
                    disabled={uploading || analyzingImport || enhancingImport}
                  >
                    {analyzingImport || enhancingImport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {enhancingImport ? "AI/OCR scanning…" : analyzingImport ? "Scanning…" : "Analyze PDF"}
                  </Button>
                </div>
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

            {(analyzingImport || enhancingImport) && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary mt-0.5" />
                <div>
                  <div className="font-semibold text-sm">Scanning PDF for song-card details</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {enhancingImport ? "AI/OCR is reading scanned pages and estimating missing details." : "Reading filename and selectable PDF text."}
                  </p>
                </div>
              </div>
            )}

            {smartImport && (
              <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-semibold">
                      <Sparkles className="w-4 h-4 text-primary" />
                      PDF song-card suggestions
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Review these before applying. Use <span className="font-semibold">Fill missing</span> to preserve existing details, or <span className="font-semibold">Apply suggestions</span> to update existing fields too.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className={`text-[10px] ${qualityTone(smartImport.importQuality)}`}>
                      {confidenceLabel(smartImport.importQuality)} confidence
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {smartImport.aiEnhanced ? "AI/OCR enhanced" : smartImport.readableTextFound ? "Readable text" : "Filename only"}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <ExistingSongSuggestionRow label="Title" current={song.title} suggestion={smartImport.suggestions.title} />
                  <ExistingSongSuggestionRow label="Artist" current={song.artist} suggestion={smartImport.suggestions.artist} />
                  <ExistingSongSuggestionRow label="Key" current={song.key} suggestion={smartImport.suggestions.key} />
                  <ExistingSongSuggestionRow label="Capo" current={song.capo} suggestion={smartImport.suggestions.capo} />
                  <ExistingSongSuggestionRow label="Chords" current={song.chords} suggestion={smartImport.suggestions.chords} />
                  <ExistingSongSuggestionRow label="Strumming" current={song.strumming} suggestion={smartImport.suggestions.strumming} />
                  <ExistingSongSuggestionRow label="Tempo" current={song.tempo ? `${song.tempo} BPM` : ""} suggestion={smartImport.suggestions.tempo} />
                  <ExistingSongSuggestionRow label="Duration" current={song.duration ? formatDuration(song.duration) : ""} suggestion={smartImport.suggestions.duration} />
                  <ExistingSongSuggestionRow label="Genre" current={song.genre} suggestion={smartImport.suggestions.genre} />
                  <ExistingSongSuggestionRow label="Mood" current={song.mood} suggestion={smartImport.suggestions.mood} />
                  <ExistingSongSuggestionRow label="Tags" current={song.tags.join(", ")} suggestion={smartImport.suggestions.tags} />
                  <ExistingSongSuggestionRow label="Stage note" current={song.performanceNote} suggestion={smartImport.suggestions.performanceNote} />
                </div>

                {smartImport.detectedChords.length > 0 && (
                  <div className="rounded-xl border border-border bg-background/70 px-3 py-2">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="text-xs font-semibold text-muted-foreground">Detected chord preview</div>
                      <Badge variant="outline" className="text-[10px]">{smartImport.detectedChords.length} found</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {smartImport.detectedChords.slice(0, 18).map((chord) => (
                        <Badge key={chord} variant="secondary" className="font-mono text-xs">{chord}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {(smartImport.reviewReasons.length > 0 || smartImport.warnings.length > 0 || smartImport.enhancementNotes?.length) && (
                  <div className="rounded-xl border border-amber-300/40 bg-amber-50/70 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-900 dark:text-amber-100 space-y-1">
                    <div className="font-semibold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Review notes</div>
                    {[...smartImport.reviewReasons, ...smartImport.warnings, ...(smartImport.enhancementNotes ?? [])].slice(0, 6).map((note) => (
                      <div key={note}>• {note}</div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <Button size="sm" className="gap-1.5" onClick={() => applySmartImportToSong(false)}>
                    <CheckCircle2 className="w-4 h-4" /> Fill missing
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => applySmartImportToSong(true)}>
                    <Wand2 className="w-4 h-4" /> Apply suggestions
                  </Button>
                  {!smartImport.aiEnhanced && (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={enhanceCurrentImport} disabled={enhancingImport || analyzingImport}>
                      {enhancingImport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      AI/OCR enhance
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setSmartImport(null)}>Dismiss</Button>
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
