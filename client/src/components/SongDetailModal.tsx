import { useState, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import type { Song, PerformanceNote } from "@/lib/data";
import { perfNotesStore, songsStore } from "@/lib/data";
import { uploadPdf, deleteAsset } from "@/lib/github";
import { useGithub } from "@/lib/GithubContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StrumPattern } from "@/components/StrumPattern";
import { useToast } from "@/hooks/use-toast";
import {
  ExternalLink, Upload, Trash2, FileText, ChevronLeft, ChevronRight,
  Music, Guitar, Star, Clock, Loader2, AlertCircle, Info, X
} from "lucide-react";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

interface Props {
  song: Song;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

const DIFF_COLORS: Record<string, string> = {
  Beginner: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  Intermediate: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Advanced: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

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

export function SongDetailModal({ song: initialSong, onClose, onDelete }: Props) {
  const [song, setSong] = useState<Song>(initialSong);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { pat, config, isConfigured } = useGithub();
  const { toast } = useToast();

  const perfHistory = perfNotesStore.getForSong(song.id);

  const refreshSong = () => {
    const updated = songsStore.getAll().find((s) => s.id === song.id);
    if (updated) setSong(updated);
  };

  const handleUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith(".pdf") && file.type !== "application/pdf") {
      toast({ title: "PDF files only", variant: "destructive" });
      return;
    }
    if (!isConfigured || !config) {
      toast({
        title: "GitHub not configured",
        description: "Go to Settings to set up your GitHub repo and token.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const asset = await uploadPdf(config.owner, config.repo, pat, file, song.id);
      songsStore.updatePdf(song.id, asset.browser_download_url, asset.id, file.name);
      refreshSong();
      toast({ title: "PDF uploaded!", description: file.name });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [pat, config, isConfigured, song.id]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleDeletePdf = async () => {
    if (!isConfigured || !config || !song.pdfAssetId) {
      songsStore.removePdf(song.id);
      refreshSong();
      return;
    }
    try {
      await deleteAsset(config.owner, config.repo, pat, song.pdfAssetId);
      songsStore.removePdf(song.id);
      refreshSong();
      toast({ title: "PDF removed" });
    } catch {
      // Still remove locally even if GitHub delete fails
      songsStore.removePdf(song.id);
      refreshSong();
    }
  };

  const avgCrowd = perfHistory.length
    ? Math.round((perfHistory.reduce((a, n) => a + n.crowdReaction, 0) / perfHistory.length) * 10) / 10
    : null;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Amber top bar */}
        <div className="capo-badge-bar bg-primary/10 border-b border-primary/20 px-6 py-3 flex items-center gap-3">
          <span className="font-display font-bold text-lg italic">{song.title}</span>
          <span className="text-muted-foreground text-sm">— {song.artist}</span>
          {song.capo && song.capo !== "No capo" && (
            <Badge className="capo-badge ml-auto">{song.capo}</Badge>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${DIFF_COLORS[song.difficulty]}`}>
            {song.difficulty}
          </span>
          {onDelete && song.userAdded && (
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-destructive ml-1"
              onClick={() => onDelete(song.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="w-full rounded-none border-b bg-transparent justify-start px-6 h-10 gap-1">
            <TabsTrigger value="info" className="text-xs gap-1.5"><Info className="w-3 h-3" />Details</TabsTrigger>
            <TabsTrigger value="pdf" className="text-xs gap-1.5"><FileText className="w-3 h-3" />Sheet Music</TabsTrigger>
            <TabsTrigger value="history" className="text-xs gap-1.5"><Star className="w-3 h-3" />Performance History</TabsTrigger>
          </TabsList>

          {/* ── INFO TAB ── */}
          <TabsContent value="info" className="p-6 space-y-5 mt-0">
            {/* Key + Chords row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-xl p-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Key</div>
                <div className="font-medium text-sm leading-snug">{song.key}</div>
              </div>
              <div className="bg-muted/50 rounded-xl p-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Tempo
                </div>
                <div className="font-medium text-sm">{song.tempo} BPM · {song.tempoFeel}</div>
              </div>
            </div>

            {/* Chords */}
            <div className="bg-muted/50 rounded-xl p-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <Guitar className="w-3 h-3" /> Chords
              </div>
              <div className="font-medium text-sm leading-relaxed">{song.chords}</div>
            </div>

            {/* Strumming */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Strumming</div>
              <StrumPattern pattern={song.strumming} />
              <div className="text-xs text-muted-foreground mt-1.5 leading-snug">{song.strumming}</div>
            </div>

            {/* Stage tip */}
            {song.performanceNote && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-3">
                <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1.5">Stage Tip</div>
                <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-100">{song.performanceNote}</p>
              </div>
            )}

            {/* Tags */}
            {song.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {song.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs capitalize">{tag.replace(/-/g, " ")}</Badge>
                ))}
              </div>
            )}

            {/* UG link */}
            <a
              href={song.ultimateGuitarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              Open on Ultimate Guitar
            </a>
          </TabsContent>

          {/* ── PDF TAB ── */}
          <TabsContent value="pdf" className="p-6 mt-0 space-y-4">
            {song.pdfUrl ? (
              <>
                {/* PDF toolbar */}
                <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7"
                      disabled={pageNumber <= 1}
                      onClick={() => setPageNumber((p) => p - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {pageNumber} / {numPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7"
                      disabled={pageNumber >= numPages}
                      onClick={() => setPageNumber((p) => p + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground truncate max-w-[140px]">{song.pdfFilename}</span>
                    <a
                      href={song.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary"
                      title="Open PDF in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 text-destructive"
                      onClick={handleDeletePdf}
                      title="Remove PDF"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* PDF viewer */}
                <div className="border border-border rounded-xl overflow-hidden bg-muted/30 flex flex-col items-center min-h-[400px] relative">
                  {pdfLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  )}
                  {pdfError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground p-6 text-center">
                      <AlertCircle className="w-8 h-8 text-destructive" />
                      <p className="text-sm">{pdfError}</p>
                      <p className="text-xs">Try opening the PDF directly ↗</p>
                      <a href={song.pdfUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <ExternalLink className="w-3.5 h-3.5" /> Open PDF
                        </Button>
                      </a>
                    </div>
                  )}
                  <Document
                    file={song.pdfUrl}
                    onLoadSuccess={({ numPages }) => { setNumPages(numPages); setPdfLoading(false); }}
                    onLoadError={(err) => { setPdfError("Could not load PDF inline. " + err.message); setPdfLoading(false); }}
                    loading=""
                    className="w-full"
                  >
                    <Page
                      pageNumber={pageNumber}
                      width={580}
                      className="mx-auto"
                      loading={<div className="h-[400px]" />}
                    />
                  </Document>
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
                {!isConfigured && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    GitHub not configured — go to Settings to enable PDF storage
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading || !isConfigured}
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
                      Open on UG to download
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
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
