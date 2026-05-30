import { useState } from "react";
import { Github, CheckCircle2, Wifi, FileText, Database, Download, Loader2, ShieldCheck, Moon, Sun, Palette as PaletteIcon, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { createMaggieBackup, downloadBackup } from "@/lib/backup";
import { PALETTES, useTheme } from "@/components/ThemeProvider";
import { PDF_SHORTCUTS, STAGE_SHORTCUTS, performanceControlsStore } from "@/lib/performanceControls";

export default function SettingsPage() {
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();
  const { theme, palette, setTheme, setPalette } = useTheme();
  const [performanceControlsEnabled, setPerformanceControlsEnabled] = useState(() =>
    performanceControlsStore.isEnabled(),
  );

  const togglePerformanceControls = () => {
    const next = !performanceControlsEnabled;
    performanceControlsStore.setEnabled(next);
    setPerformanceControlsEnabled(next);
    toast({
      title: next ? "Performance controls enabled" : "Performance controls disabled",
      description: next
        ? "Keyboard and Bluetooth pedal shortcuts are active in Stage and PDFs."
        : "Stage and PDF shortcut keys are turned off on this device.",
    });
  };

  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const backup = await createMaggieBackup();
      const filename = downloadBackup(backup);
      toast({ title: "Backup exported", description: filename });
    } catch (err: any) {
      toast({
        title: "Backup failed",
        description: err?.message ?? "Could not export your Maggie backup.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="font-display font-bold text-xl italic mb-0.5">Settings</h1>
        <p className="text-muted-foreground text-sm">App configuration and sync status</p>
      </div>

      {/* Appearance */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4 space-y-4">
        <div className="flex items-center gap-3">
          <PaletteIcon className="w-5 h-5 text-primary" />
          <div>
            <div className="font-semibold text-sm">Appearance</div>
            <div className="text-xs text-muted-foreground">Choose light/dark mode and a performance-friendly color palette</div>
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Mode</div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={theme === "light" ? "default" : "outline"}
              className="justify-start gap-2"
              onClick={() => setTheme("light")}
            >
              <Sun className="w-4 h-4" /> Light
            </Button>
            <Button
              type="button"
              variant={theme === "dark" ? "default" : "outline"}
              className="justify-start gap-2"
              onClick={() => setTheme("dark")}
            >
              <Moon className="w-4 h-4" /> Dark
            </Button>
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Color palette</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {PALETTES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setPalette(option.id)}
                className={`text-left rounded-xl border p-3 transition-colors ${
                  palette === option.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-muted/20 hover:border-primary/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-sm">{option.name}</div>
                  <div className="flex -space-x-1">
                    {option.swatches.map((swatch) => (
                      <span
                        key={swatch}
                        className="w-5 h-5 rounded-full border border-background shadow-sm"
                        style={{ background: swatch }}
                      />
                    ))}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1 leading-snug">
                  {option.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Performance controls */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4 space-y-4">
        <div className="flex items-start gap-3">
          <Keyboard className="w-5 h-5 text-primary mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm">Performance Controls</div>
            <div className="text-xs text-muted-foreground">Keyboard and Bluetooth page-turner shortcuts for Stage and sheet music</div>
          </div>
          <Button
            type="button"
            variant={performanceControlsEnabled ? "default" : "outline"}
            size="sm"
            onClick={togglePerformanceControls}
          >
            {performanceControlsEnabled ? "Enabled" : "Off"}
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-muted/25 p-3">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Stage / Performance</div>
            <div className="space-y-1.5">
              {STAGE_SHORTCUTS.slice(0, 8).map((shortcut) => (
                <div key={shortcut.keys} className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-bold text-primary whitespace-nowrap">{shortcut.keys}</span>
                  <span className="text-muted-foreground text-right">{shortcut.action}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/25 p-3">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">PDF / Sheet Music</div>
            <div className="space-y-1.5">
              {PDF_SHORTCUTS.slice(0, 8).map((shortcut) => (
                <div key={shortcut.keys} className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-bold text-primary whitespace-nowrap">{shortcut.keys}</span>
                  <span className="text-muted-foreground text-right">{shortcut.action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Bluetooth pedals usually act like small keyboards. Set the pedal to send Arrow, PageDown, PageUp, or Space and Maggie will respond without additional pairing code.
        </p>
      </div>

      {/* PDF Storage */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-primary" />
          <div>
            <div className="font-semibold text-sm">Sheet Music Storage</div>
            <div className="text-xs text-muted-foreground">PDFs stored in Supabase — no login required</div>
          </div>
          <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/40 rounded-full px-2.5 py-0.5">
            <CheckCircle2 className="w-3 h-3" /> Active
          </span>
        </div>
        <div className="bg-muted/50 rounded-xl p-3 space-y-1.5 text-xs text-muted-foreground leading-relaxed">
          <p>PDFs are stored in Supabase Storage and are automatically available on all your devices. To add sheet music to a song:</p>
          <ol className="list-decimal ml-4 space-y-1 mt-1">
            <li>Open any song card and tap <strong>Sheet Music</strong></li>
            <li>Drag and drop a PDF, or tap <strong>Choose PDF</strong></li>
            <li>The PDF uploads instantly and is linked to that song</li>
          </ol>
        </div>
      </div>

      {/* Cross-device sync */}
      <div className="bg-card border border-border rounded-xl p-5 mt-4 space-y-3">
        <div className="flex items-center gap-3">
          <Wifi className="w-5 h-5 text-green-600" />
          <div>
            <div className="font-semibold text-sm">Cross-Device Sync</div>
            <div className="text-xs text-muted-foreground">Songs, setlists, venues, session &amp; PDFs via Supabase</div>
          </div>
          <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/40 rounded-full px-2.5 py-0.5">
            <CheckCircle2 className="w-3 h-3" /> Active
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          All devices — phone, laptop, tablet — share the same data automatically. Refresh any page to pull the latest from the cloud.
        </p>
      </div>


      {/* Backup / export */}
      <div className="bg-card border border-border rounded-xl p-5 mt-4 space-y-3">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <div>
            <div className="font-semibold text-sm">Backup &amp; Export</div>
            <div className="text-xs text-muted-foreground">Download a JSON backup of songs, setlists, venues, notes, requests, and PDF links</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          This creates a portable backup file for safekeeping. It includes song metadata and public PDF URLs, but not the PDF files themselves.
        </p>
        <Button onClick={handleExportBackup} disabled={exporting} className="gap-1.5">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? "Exporting…" : "Export Backup"}
        </Button>
      </div>

      {/* Database info */}
      <div className="bg-card border border-border rounded-xl p-5 mt-4 space-y-3">
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5" />
          <div>
            <div className="font-semibold text-sm">Cloud Database</div>
            <div className="text-xs text-muted-foreground">Supabase — Whitman's project</div>
          </div>
        </div>
        <div className="bg-muted rounded-lg p-3 text-xs font-mono text-muted-foreground space-y-0.5">
          <div>Project: bephofcynjspsulmuikh</div>
          <div>Tables: songs · setlists · venues · perf_notes · active_sessions</div>
          <div>Storage: pdfs bucket (public, up to 20 MB per file)</div>
        </div>
      </div>

      {/* GitHub Pages deployment */}
      <div className="bg-card border border-border rounded-xl p-5 mt-4 space-y-3">
        <div className="flex items-center gap-3">
          <Github className="w-5 h-5" />
          <div>
            <div className="font-semibold text-sm">GitHub Pages Deployment</div>
            <div className="text-xs text-muted-foreground">Live at markewhitman.github.io/maggie-app</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Run the command below from your project folder to push any updates live.
        </p>
        <div className="bg-muted rounded-lg p-3 font-mono text-xs space-y-1">
          <div className="text-muted-foreground"># Deploy to GitHub Pages:</div>
          <div>npm run deploy</div>
        </div>
      </div>
    </div>
  );
}
