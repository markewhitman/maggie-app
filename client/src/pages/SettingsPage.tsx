import { Github, CheckCircle2, Wifi, FileText, Database } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="font-display font-bold text-xl italic mb-0.5">Settings</h1>
        <p className="text-muted-foreground text-sm">App configuration and sync status</p>
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
