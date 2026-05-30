import { useMemo, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { Song } from "@/lib/data";
import { sbPdfs, sbSongPdfs, sbSongs } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { analyzeSongPdf, confidenceLabel, type SmartPdfImportResult, type SmartImportSuggestion } from "@/lib/smartPdfImport";
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, FileText, Guitar, Loader2, Music, Sparkles, Tag, Upload, Wand2, X } from "lucide-react";

interface Props {
  onClose: () => void;
  onSaved: () => void;
  existingSongs?: Song[];
}

const MAX_PDF_BYTES = 20 * 1024 * 1024;

function slugify(title: string, artist: string): string {
  return `${artist}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function makeUniqueSongId(baseId: string, existingSongs: Song[]): string {
  const existingIds = new Set(existingSongs.map((song) => song.id));
  if (!existingIds.has(baseId)) return baseId;
  let n = 2;
  while (existingIds.has(`${baseId}-${n}`)) n += 1;
  return `${baseId}-${n}`;
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
}

function parseDuration(raw: string): number | undefined {
  const trimmed = raw.trim();
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

function inferDecade(year: number): Song["decade"] {
  if (!Number.isFinite(year)) return undefined;
  if (year >= 2020) return "20s";
  if (year >= 2010) return "10s";
  if (year >= 2000) return "00s";
  if (year >= 1990) return "90s";
  if (year >= 1980) return "80s";
  if (year >= 1970) return "70s";
  if (year >= 1960) return "60s";
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

function mergeTagList(...groups: string[]): string {
  const tags = new Set<string>();
  for (const group of groups) {
    group.split(",").map((tag) => tag.trim()).filter(Boolean).forEach((tag) => tags.add(tag));
  }
  return Array.from(tags).join(", ");
}

function SuggestionRow({ label, suggestion }: { label: string; suggestion?: SmartImportSuggestion }) {
  if (!suggestion) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 rounded-lg border border-border/70 bg-background/70 px-2.5 py-2 text-xs">
      <div className="sm:w-28 font-semibold text-muted-foreground">{label}</div>
      <div className="flex-1 min-w-0 font-medium break-words">{suggestion.value}</div>
      <Badge variant="outline" className={`w-fit text-[10px] ${suggestionTone(suggestion.confidence)}`}>
        {confidenceLabel(suggestion.confidence)} · {suggestion.source}
      </Badge>
    </div>
  );
}

function SectionHeader({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-muted/40 border border-border px-3 py-2">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div>
        <div className="font-semibold text-sm">{title}</div>
        <p className="text-xs text-muted-foreground leading-snug">{description}</p>
      </div>
    </div>
  );
}

export function AddSongModal({ onClose, onSaved, existingSongs = [] }: Props) {
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [durationInput, setDurationInput] = useState("");
  const [analyzingPdf, setAnalyzingPdf] = useState(false);
  const [smartImport, setSmartImport] = useState<SmartPdfImportResult | null>(null);

  const [form, setForm] = useState({
    title: "",
    artist: "",
    year: new Date().getFullYear().toString(),
    key: "",
    capo: "No capo",
    chords: "",
    strumming: "",
    guitarType: "acoustic" as Song["guitarType"],
    tempo: "",
    tempoFeel: "Mid-Tempo",
    mood: "",
    genre: "",
    energy: "medium" as NonNullable<Song["energy"]>,
    vocalStyle: "singalong" as NonNullable<Song["vocalStyle"]>,
    difficulty: "Intermediate" as Song["difficulty"],
    tags: "",
    performanceNote: "",
    ultimateGuitarUrl: "",
  });

  const set = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));


  const applySmartImport = (result: SmartPdfImportResult, overwrite = false) => {
    const s = result.suggestions;
    setForm((prev) => {
      const next = { ...prev };
      const apply = (field: keyof typeof form, value?: string) => {
        if (!value) return;
        if (overwrite || !String(next[field] ?? "").trim() || (field === "capo" && next.capo === "No capo")) {
          (next as any)[field] = value;
        }
      };

      apply("title", s.title?.value);
      apply("artist", s.artist?.value);
      apply("key", s.key?.value);
      apply("capo", s.capo?.value);
      apply("chords", s.chords?.value);
      apply("strumming", s.strumming?.value);
      apply("tempo", s.tempo?.value);
      apply("genre", s.genre?.value);
      apply("mood", s.mood?.value);
      apply("energy", s.energy?.value as any);
      apply("vocalStyle", s.vocalStyle?.value as any);
      apply("ultimateGuitarUrl", s.ultimateGuitarUrl?.value);

      if (s.tags?.value) {
        if (overwrite || !next.tags.trim()) {
          next.tags = s.tags.value;
        } else {
          next.tags = mergeTagList(next.tags, s.tags.value);
        }
      }

      if (s.performanceNote?.value) {
        if (overwrite || !next.performanceNote.trim()) next.performanceNote = s.performanceNote.value;
      }
      return next;
    });

    if (s.duration?.value && (overwrite || !durationInput.trim())) {
      setDurationInput(s.duration.value);
    }
  };

  const duplicateInfo = useMemo(() => {
    const title = form.title.trim().toLowerCase();
    const artist = form.artist.trim().toLowerCase();
    if (!title) return { exact: null as Song | null, titleMatches: [] as Song[] };
    const titleMatches = existingSongs.filter((song) => song.title.trim().toLowerCase() === title);
    const exact = titleMatches.find((song) => artist && song.artist.trim().toLowerCase() === artist) ?? null;
    return { exact, titleMatches };
  }, [existingSongs, form.artist, form.title]);

  const completion = useMemo(() => {
    const fields = [form.title, form.artist, form.key, form.capo, form.chords, form.strumming, form.tempo, form.genre, form.mood];
    const completed = fields.filter((field) => String(field).trim()).length;
    return Math.round((completed / fields.length) * 100);
  }, [form]);

  const importChecklist = useMemo(() => [
    { label: "Title", done: !!form.title.trim() },
    { label: "Artist", done: !!form.artist.trim() },
    { label: "Key", done: !!form.key.trim() && form.key.trim().toLowerCase() !== "unknown" },
    { label: "Capo", done: !!form.capo.trim() },
    { label: "Chords", done: !!form.chords.trim() },
    { label: "Duration", done: !!durationInput.trim() },
    { label: "PDF", done: !!pdfFile },
  ], [durationInput, form.artist, form.capo, form.chords, form.key, form.title, pdfFile]);

  const missingEssentials = importChecklist.filter((item) => !item.done);

  const handlePdfSelection = async (file: File | undefined) => {
    if (!file) {
      setPdfFile(null);
      setSmartImport(null);
      return;
    }

    if (!isPdf(file)) {
      toast({ title: "PDF files only", variant: "destructive" });
      return;
    }

    if (file.size > MAX_PDF_BYTES) {
      toast({ title: "PDF is too large", description: "Please choose a PDF smaller than 20 MB.", variant: "destructive" });
      return;
    }

    setPdfFile(file);
    setSmartImport(null);
    setAnalyzingPdf(true);

    try {
      const result = await analyzeSongPdf(file, existingSongs);
      setSmartImport(result);
      applySmartImport(result, false);
      toast({
        title: result.readableTextFound ? "PDF scanned for song details" : "PDF attached",
        description: result.readableTextFound
          ? "I filled blank fields from the readable PDF text. Review before saving."
          : "No selectable text was found, so I used the filename where possible.",
      });
    } catch (err: any) {
      toast({
        title: "PDF attached",
        description: err?.message ? `Smart import could not read the PDF: ${err.message}` : "Smart import could not read the PDF, but the file is attached.",
      });
    } finally {
      setAnalyzingPdf(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.artist.trim()) {
      toast({ title: "Title and Artist are required", variant: "destructive" });
      return;
    }

    if (duplicateInfo.exact) {
      toast({
        title: "Duplicate song already exists",
        description: `${duplicateInfo.exact.title} by ${duplicateInfo.exact.artist} is already in the library.`,
        variant: "destructive",
      });
      return;
    }

    if (form.ultimateGuitarUrl.trim()) {
      try {
        new URL(form.ultimateGuitarUrl.trim());
      } catch {
        toast({ title: "Ultimate Guitar URL looks invalid", description: "Leave it blank or paste a full https:// link.", variant: "destructive" });
        return;
      }
    }

    const parsedYear = parseInt(form.year, 10) || new Date().getFullYear();
    const parsedDuration = parseDuration(durationInput);
    if (durationInput.trim() && !parsedDuration) {
      toast({ title: "Duration format not recognized", description: "Use m:ss, such as 3:45.", variant: "destructive" });
      return;
    }

    setSaving(true);

    try {
      const baseId = slugify(form.title, form.artist) || `song-${Date.now()}`;
      const songId = makeUniqueSongId(baseId, existingSongs);
      let pdfUrl: string | undefined;
      let pdfFilename: string | undefined;

      if (pdfFile) {
        const publicUrl = await sbPdfs.upload(songId, pdfFile);
        await sbSongPdfs.save(songId, publicUrl, pdfFile.name);
        pdfUrl = publicUrl;
        pdfFilename = pdfFile.name;
      }

      const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      if (pdfFile) {
        if (!tags.includes("imported-from-pdf")) tags.push("imported-from-pdf");
        if (smartImport && !tags.includes("needs-review")) tags.push("needs-review");
      }

      const song: Song = {
        id: songId,
        title: form.title.trim(),
        artist: form.artist.trim(),
        year: parsedYear,
        key: form.key.trim() || "Unknown",
        capo: form.capo.trim() || "No capo",
        chords: form.chords.trim(),
        strumming: form.strumming.trim(),
        guitarType: form.guitarType,
        tempo: parseInt(form.tempo, 10) || 120,
        tempoFeel: form.tempoFeel,
        mood: form.mood.trim(),
        genre: form.genre.trim(),
        decade: inferDecade(parsedYear),
        energy: form.energy,
        vocalStyle: form.vocalStyle,
        difficulty: form.difficulty,
        tags,
        performanceNote: form.performanceNote.trim(),
        ultimateGuitarUrl: form.ultimateGuitarUrl.trim(),
        setPosition: 99,
        duration: parsedDuration,
        userAdded: true,
        pdfUrl,
        pdfAssetId: undefined,
        pdfFilename,
      };

      await sbSongs.upsert(song);
      toast({ title: "Song added", description: `${song.title} is now in the cloud library.` });
      onSaved();
    } catch (err: any) {
      toast({
        title: "Could not add song",
        description: err?.message ?? "The song was not saved. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border bg-card/95 sticky top-0 z-10">
          <DialogTitle className="font-display italic flex items-center justify-between gap-3">
            <span>Add New Song</span>
            <Badge variant={completion >= 70 ? "default" : "secondary"} className="text-xs">
              {completion}% filled
            </Badge>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Required fields are first. Live-use details make the song easier to find, schedule, and perform later.
          </p>
        </DialogHeader>

        <div className="space-y-5 p-5">
          {duplicateInfo.exact && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold text-destructive">This song is already in the library.</div>
                <div className="text-muted-foreground">Open the existing song to edit it, or change the title/artist before saving.</div>
              </div>
            </div>
          )}
          {!duplicateInfo.exact && duplicateInfo.titleMatches.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-300/50 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-300 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold text-amber-800 dark:text-amber-200">Same title already exists.</div>
                <div className="text-amber-900/80 dark:text-amber-100/80">
                  Existing: {duplicateInfo.titleMatches.slice(0, 3).map((song) => `${song.title} — ${song.artist}`).join("; ")}
                </div>
              </div>
            </div>
          )}

          {(analyzingPdf || smartImport) && (
            <section className="rounded-2xl border border-primary/25 bg-primary/5 p-3 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 rounded-full bg-primary/10 p-1.5 text-primary">
                    {analyzingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Smart PDF Import</div>
                    <p className="text-xs text-muted-foreground leading-snug">
                      {analyzingPdf
                        ? "Reading the PDF text and filename for title, artist, key, capo, chords, tempo, and tags…"
                        : smartImport?.readableTextFound
                          ? `Found readable PDF text${smartImport.pageCount ? ` across ${smartImport.pageCount} page${smartImport.pageCount === 1 ? "" : "s"}` : ""}. Review suggestions before saving.`
                          : "No selectable PDF text was found. Suggestions are based on the filename only; scanned PDFs still need manual entry."}
                    </p>
                  </div>
                </div>
                {smartImport && (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => applySmartImport(smartImport, false)}>
                      <Wand2 className="w-3.5 h-3.5" /> Fill blanks
                    </Button>
                    <Button type="button" size="sm" className="gap-1.5" onClick={() => applySmartImport(smartImport, true)}>
                      <Wand2 className="w-3.5 h-3.5" /> Apply all
                    </Button>
                  </div>
                )}
              </div>

              {smartImport && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                    <div className={`rounded-xl border px-3 py-2 ${qualityTone(smartImport.importQuality)}`}>
                      <div className="text-[10px] uppercase tracking-wide font-semibold opacity-75">Import confidence</div>
                      <div className="font-semibold text-sm">{confidenceLabel(smartImport.importQuality)}</div>
                      <div className="text-[11px] mt-0.5 opacity-85">{smartImport.readableTextFound ? "Readable PDF text found" : "Filename-only import"}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-background/70 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Missing essentials</div>
                      <div className="font-semibold text-sm">{missingEssentials.length === 0 ? "Ready to save" : `${missingEssentials.length} to review`}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {importChecklist.map((item) => (
                          <Badge key={item.label} variant="outline" className={`text-[10px] ${item.done ? "border-emerald-300/50 text-emerald-700 dark:text-emerald-300" : "border-amber-300/50 text-amber-700 dark:text-amber-300"}`}>
                            {item.done ? "✓" : "•"} {item.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border bg-background/70 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Review notes</div>
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {(smartImport.reviewReasons.length ? smartImport.reviewReasons.slice(0, 3) : ["Suggestions look complete. Still confirm before saving."]).map((reason) => (
                          <div key={reason}>• {reason}</div>
                        ))}
                      </div>
                    </div>
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <SuggestionRow label="Title" suggestion={smartImport.suggestions.title} />
                    <SuggestionRow label="Artist" suggestion={smartImport.suggestions.artist} />
                    <SuggestionRow label="Key" suggestion={smartImport.suggestions.key} />
                    <SuggestionRow label="Capo" suggestion={smartImport.suggestions.capo} />
                    <SuggestionRow label="Chords" suggestion={smartImport.suggestions.chords} />
                    <SuggestionRow label="Strumming" suggestion={smartImport.suggestions.strumming} />
                    <SuggestionRow label="Tempo" suggestion={smartImport.suggestions.tempo} />
                    <SuggestionRow label="Duration" suggestion={smartImport.suggestions.duration} />
                    <SuggestionRow label="Tags" suggestion={smartImport.suggestions.tags} />
                    <SuggestionRow label="Source URL" suggestion={smartImport.suggestions.ultimateGuitarUrl} />
                  </div>
                  {smartImport.warnings.length > 0 && (
                    <div className="text-xs text-muted-foreground rounded-lg border border-border bg-background/70 px-3 py-2">
                      {smartImport.warnings.join(" ")}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Smart import never changes the original PDF. It only pre-fills editable song-card fields.
                  </p>
                </div>
              )}
            </section>
          )}

          <section className="space-y-3">
            <SectionHeader icon={<Music className="w-4 h-4" />} title="Identity" description="The minimum needed to make the song searchable and unique." />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Title *</Label>
                <Input value={form.title} onChange={(e) => set("title")(e.target.value)} placeholder="Mr. Brightside" data-testid="input-song-title" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Artist *</Label>
                <Input value={form.artist} onChange={(e) => set("artist")(e.target.value)} placeholder="The Killers" data-testid="input-song-artist" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Year</Label>
                <Input value={form.year} onChange={(e) => set("year")(e.target.value)} placeholder="2003" inputMode="numeric" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Genre</Label>
                <Input value={form.genre} onChange={(e) => set("genre")(e.target.value)} placeholder="Indie Rock" />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeader icon={<Guitar className="w-4 h-4" />} title="Live essentials" description="These are the details you need at a glance in Stage mode." />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Key</Label>
                <Input value={form.key} onChange={(e) => set("key")(e.target.value)} placeholder="C major" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Capo</Label>
                <Input value={form.capo} onChange={(e) => set("capo")(e.target.value)} placeholder="Capo 2 or No capo" />
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {["No capo", "Capo 1", "Capo 2", "Capo 3"].map((capo) => (
                    <button key={capo} type="button" onClick={() => set("capo")(capo)} className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-primary hover:border-primary/50">
                      {capo}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tempo (BPM)</Label>
                <Input value={form.tempo} onChange={(e) => set("tempo")(e.target.value)} placeholder="120" inputMode="numeric" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> Duration</Label>
                <Input value={durationInput} onChange={(e) => setDurationInput(e.target.value)} placeholder="3:45" inputMode="numeric" />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs">Chords</Label>
                <Input value={form.chords} onChange={(e) => set("chords")(e.target.value)} placeholder="C, G, Am, F" />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs">Strumming Pattern</Label>
                <Input value={form.strumming} onChange={(e) => set("strumming")(e.target.value)} placeholder="D DU UDU" />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeader icon={<Tag className="w-4 h-4" />} title="Findability" description="These fields power filters, audience browsing, and better setlist planning." />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Difficulty</Label>
                <Select value={form.difficulty} onValueChange={(v) => set("difficulty")(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Beginner">Beginner</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Guitar</Label>
                <Select value={form.guitarType} onValueChange={(v) => set("guitarType")(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="acoustic">Acoustic</SelectItem>
                    <SelectItem value="electric">Electric</SelectItem>
                    <SelectItem value="either">Either</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tempo Feel</Label>
                <Select value={form.tempoFeel} onValueChange={(v) => set("tempoFeel")(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Slow", "Slow-Mid", "Mid-Tempo", "Up-Tempo", "Very Fast", "Ballad", "Driving", "Upbeat"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Energy</Label>
                <Select value={form.energy} onValueChange={(v) => set("energy")(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Vocal Style</Label>
                <Select value={form.vocalStyle} onValueChange={(v) => set("vocalStyle")(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="storytelling">Storytelling</SelectItem>
                    <SelectItem value="singalong">Singalong</SelectItem>
                    <SelectItem value="emotional">Emotional</SelectItem>
                    <SelectItem value="powerful">Powerful</SelectItem>
                    <SelectItem value="conversational">Conversational</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Mood</Label>
                <Input value={form.mood} onChange={(e) => set("mood")(e.target.value)} placeholder="nostalgic, joyful" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3 space-y-1.5">
                <Label className="text-xs">Tags (comma-separated)</Label>
                <Input value={form.tags} onChange={(e) => set("tags")(e.target.value)} placeholder="crowd-pleaser, singalong, 80s" />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeader icon={<FileText className="w-4 h-4" />} title="Resources and stage note" description="Attach the sheet music and record the one thing you need to remember live." />
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Stage Tip / Performance Note</Label>
                <Textarea
                  value={form.performanceNote}
                  onChange={(e) => set("performanceNote")(e.target.value)}
                  placeholder="Key things to remember when playing this live…"
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  Ultimate Guitar URL <ExternalLink className="w-3 h-3 text-muted-foreground" />
                </Label>
                <Input value={form.ultimateGuitarUrl} onChange={(e) => set("ultimateGuitarUrl")(e.target.value)} placeholder="https://tabs.ultimate-guitar.com/tab/…" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Sheet Music / Tab PDF + Smart Import (optional)</Label>
                {pdfFile ? (
                  <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    <div className="text-sm flex-1 min-w-0">
                      <div className="truncate font-medium">{pdfFile.name}</div>
                      <div className="text-xs text-muted-foreground">{formatBytes(pdfFile.size)} · will upload when you save{analyzingPdf ? " · analyzing…" : smartImport ? " · suggestions ready" : ""}</div>
                    </div>
                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => { setPdfFile(null); setSmartImport(null); }}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 border border-dashed border-border rounded-lg px-3 py-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                    <Upload className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Attach a PDF under 20 MB to auto-fill song details</span>
                    <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => handlePdfSelection(e.target.files?.[0])} />
                  </label>
                )}
                <p className="text-xs text-muted-foreground">Text-based PDFs can auto-fill title, artist, key, capo, chords, tempo, tags, and stage notes. Scanned PDFs can still be attached and filled manually.</p>
              </div>
            </div>
          </section>

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-3 border-t border-border sticky bottom-0 bg-background/95 backdrop-blur py-3">
            <Button variant="outline" onClick={onClose} disabled={saving} className="sm:w-32">Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !!duplicateInfo.exact} className="flex-1 gap-1.5" data-testid="button-save-song">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Saving…" : "Add Song"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
