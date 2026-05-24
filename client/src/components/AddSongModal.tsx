import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { songsStore, type Song } from "@/lib/data";
import { uploadPdf } from "@/lib/github";
import { useGithub } from "@/lib/GithubContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X, FileText, ExternalLink } from "lucide-react";

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

function slugify(title: string, artist: string): string {
  return `${artist}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function AddSongModal({ onClose, onSaved }: Props) {
  const { pat, config, isConfigured } = useGithub();
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

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
    difficulty: "Intermediate" as Song["difficulty"],
    tags: "",
    performanceNote: "",
    ultimateGuitarUrl: "",
  });

  const set = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim() || !form.artist.trim()) {
      toast({ title: "Title and Artist are required", variant: "destructive" });
      return;
    }

    setSaving(true);

    let pdfUrl: string | undefined;
    let pdfAssetId: number | undefined;
    let pdfFilename: string | undefined;

    if (pdfFile && isConfigured && config) {
      try {
        const id = slugify(form.title, form.artist);
        const asset = await uploadPdf(config.owner, config.repo, pat, pdfFile, id);
        pdfUrl = asset.browser_download_url;
        pdfAssetId = asset.id;
        pdfFilename = pdfFile.name;
      } catch (err: any) {
        toast({ title: "PDF upload failed", description: err.message, variant: "destructive" });
      }
    }

    const song: Song = {
      id: slugify(form.title, form.artist) || `song-${Date.now()}`,
      title: form.title.trim(),
      artist: form.artist.trim(),
      year: parseInt(form.year) || new Date().getFullYear(),
      key: form.key.trim() || "Unknown",
      capo: form.capo.trim() || "No capo",
      chords: form.chords.trim(),
      strumming: form.strumming.trim(),
      guitarType: form.guitarType,
      tempo: parseInt(form.tempo) || 120,
      tempoFeel: form.tempoFeel,
      mood: form.mood.trim(),
      genre: form.genre.trim(),
      difficulty: form.difficulty,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      performanceNote: form.performanceNote.trim(),
      ultimateGuitarUrl: form.ultimateGuitarUrl.trim(),
      setPosition: 99,
      userAdded: true,
      pdfUrl,
      pdfAssetId,
      pdfFilename,
    };

    songsStore.upsert(song);
    toast({ title: "Song added!", description: form.title });
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display italic">Add New Song</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Row 1: Title + Artist */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Title *</Label>
              <Input value={form.title} onChange={(e) => set("title")(e.target.value)} placeholder="Mr. Brightside" data-testid="input-song-title" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Artist *</Label>
              <Input value={form.artist} onChange={(e) => set("artist")(e.target.value)} placeholder="The Killers" data-testid="input-song-artist" />
            </div>
          </div>

          {/* Row 2: Year + Genre */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Year</Label>
              <Input value={form.year} onChange={(e) => set("year")(e.target.value)} placeholder="2003" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Genre</Label>
              <Input value={form.genre} onChange={(e) => set("genre")(e.target.value)} placeholder="Indie Rock" />
            </div>
          </div>

          {/* Key + Capo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Key</Label>
              <Input value={form.key} onChange={(e) => set("key")(e.target.value)} placeholder="C major" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Capo</Label>
              <Input value={form.capo} onChange={(e) => set("capo")(e.target.value)} placeholder="Capo 2 or No capo" />
            </div>
          </div>

          {/* Chords */}
          <div className="space-y-1.5">
            <Label className="text-xs">Chords</Label>
            <Input value={form.chords} onChange={(e) => set("chords")(e.target.value)} placeholder="C, G, Am, F" />
          </div>

          {/* Strumming */}
          <div className="space-y-1.5">
            <Label className="text-xs">Strumming Pattern</Label>
            <Input value={form.strumming} onChange={(e) => set("strumming")(e.target.value)} placeholder="D DU UDU" />
          </div>

          {/* Tempo + Guitar type + Difficulty */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tempo (BPM)</Label>
              <Input value={form.tempo} onChange={(e) => set("tempo")(e.target.value)} placeholder="120" />
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
          </div>

          {/* Tempo feel + Mood */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tempo Feel</Label>
              <Select value={form.tempoFeel} onValueChange={(v) => set("tempoFeel")(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Slow", "Slow-Mid", "Mid-Tempo", "Up-Tempo", "Very Fast", "Ballad", "Driving"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mood</Label>
              <Input value={form.mood} onChange={(e) => set("mood")(e.target.value)} placeholder="nostalgic, joyful" />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label className="text-xs">Tags (comma-separated)</Label>
            <Input value={form.tags} onChange={(e) => set("tags")(e.target.value)} placeholder="crowd-pleaser, singalong, 80s" />
          </div>

          {/* Performance note */}
          <div className="space-y-1.5">
            <Label className="text-xs">Stage Tip / Performance Note</Label>
            <Textarea
              value={form.performanceNote}
              onChange={(e) => set("performanceNote")(e.target.value)}
              placeholder="Key things to remember when playing this live…"
              rows={2}
            />
          </div>

          {/* UG URL */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              Ultimate Guitar URL <ExternalLink className="w-3 h-3 text-muted-foreground" />
            </Label>
            <Input
              value={form.ultimateGuitarUrl}
              onChange={(e) => set("ultimateGuitarUrl")(e.target.value)}
              placeholder="https://tabs.ultimate-guitar.com/tab/…"
            />
          </div>

          {/* PDF upload */}
          <div className="space-y-1.5">
            <Label className="text-xs">Sheet Music / Tab PDF (optional)</Label>
            {pdfFile ? (
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm flex-1 truncate">{pdfFile.name}</span>
                <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => setPdfFile(null)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <label className="flex items-center gap-2 border border-dashed border-border rounded-lg px-3 py-2.5 cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Attach a PDF</span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
            {!isConfigured && pdfFile && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                GitHub not configured — PDF will be saved locally only (no cloud storage)
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1 gap-1.5" data-testid="button-save-song">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Saving…" : "Add Song"}
            </Button>
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
