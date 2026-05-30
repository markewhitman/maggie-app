import { useMemo, useState, type ReactNode } from "react";
import type { Setlist, Song } from "@/lib/data";
import { formatDurationLong } from "@/lib/data";
import {
  analyzeSetlistReadiness,
  markBackupExported,
  readinessToneClasses,
  type ReadinessIssue,
  type SetlistReadinessSummary,
} from "@/lib/setlistReadiness";
import { createMaggieBackup, downloadBackup } from "@/lib/backup";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Loader2,
  Music2,
  QrCode,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";

function issueTone(issue: ReadinessIssue): string {
  if (issue.severity === "critical") {
    return "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-200";
  }
  if (issue.severity === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-200";
  }
  return "border-border bg-muted/35 text-foreground";
}

function IssueIcon({ severity }: { severity: ReadinessIssue["severity"] }) {
  if (severity === "critical") return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
  if (severity === "warning") return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
  return <Sparkles className="w-4 h-4 text-primary" />;
}

function ReadinessScore({ summary }: { summary: SetlistReadinessSummary }) {
  const toneClass = readinessToneClasses(summary.tone);
  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] opacity-75">
            Set confidence
          </div>
          <div className="font-display text-2xl font-bold italic leading-tight">
            {summary.label}
          </div>
          <div className="mt-1 text-xs opacity-80">
            {summary.score}/100 readiness score
          </div>
        </div>
        <div className="w-16 h-16 rounded-full border-4 border-current/30 bg-background/60 flex items-center justify-center shrink-0">
          <span className="font-mono text-xl font-black">{summary.score}</span>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-semibold text-sm">{value}</div>
      {detail && <div className="mt-0.5 text-[11px] text-muted-foreground">{detail}</div>}
    </div>
  );
}

export function PreGigReadinessDialog({
  open,
  onClose,
  setlist,
  songs,
  onLoadTonight,
  loadLabel = "Load Tonight",
}: {
  open: boolean;
  onClose: () => void;
  setlist: Setlist;
  songs: Song[];
  onLoadTonight?: () => Promise<void> | void;
  loadLabel?: string;
}) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [loadingSet, setLoadingSet] = useState(false);
  const summary = useMemo(
    () => analyzeSetlistReadiness(setlist, songs),
    [setlist, songs],
  );

  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const backup = await createMaggieBackup();
      const filename = downloadBackup(backup);
      markBackupExported(new Date(backup.exportedAt));
      toast({ title: "Backup exported", description: filename });
    } catch (err: any) {
      toast({
        title: "Backup failed",
        description: err?.message ?? "Could not export backup.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleLoad = async () => {
    if (!onLoadTonight) return;
    setLoadingSet(true);
    try {
      await onLoadTonight();
      onClose();
    } finally {
      setLoadingSet(false);
    }
  };

  const critical = summary.issues.filter((issue) => issue.severity === "critical");
  const warnings = summary.issues.filter((issue) => issue.severity === "warning");
  const info = summary.issues.filter((issue) => issue.severity === "info");
  const orderedIssues = [...critical, ...warnings, ...info];

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display italic flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> Ready for tonight
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="font-display text-xl font-bold italic leading-tight">
              {setlist.name}
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {setlist.gigDate && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {setlist.gigDate}
                </span>
              )}
              {setlist.gigStartTime && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Starts {setlist.gigStartTime}
                </span>
              )}
              <span>{summary.totalSongs} songs</span>
            </div>
          </div>

          <ReadinessScore summary={summary} />

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <MetricCard
              icon={<Music2 className="w-3 h-3" />}
              label="Songs"
              value={`${summary.resolvedSongs.length}/${summary.totalSongs} found`}
              detail={summary.missingSongIds.length ? `${summary.missingSongIds.length} missing` : "Library matched"}
            />
            <MetricCard
              icon={<Clock className="w-3 h-3" />}
              label="Runtime"
              value={`~${formatDurationLong(summary.totalRuntimeSeconds)}`}
              detail={summary.estimatedSongs ? `${summary.estimatedSongs} estimated` : "All durations set"}
            />
            <MetricCard
              icon={<FileText className="w-3 h-3" />}
              label="Sheet PDFs"
              value={`${summary.resolvedSongs.length - summary.missingPdfSongs.length}/${summary.resolvedSongs.length}`}
              detail={summary.missingPdfSongs.length ? `${summary.missingPdfSongs.length} missing` : "Ready"}
            />
            <MetricCard
              icon={<QrCode className="w-3 h-3" />}
              label="Audience QR"
              value={setlist.audienceSlug ? "Scoped link" : "Needs check"}
              detail={setlist.requestsEnabled === false ? "Requests off" : "Requests on"}
            />
          </div>

          <div className="rounded-xl border border-border bg-muted/25 p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <Download className="w-4 h-4 text-primary mt-0.5" />
              <div>
                <div className="font-semibold text-sm">Backup status</div>
                <div className="text-xs text-muted-foreground">
                  {summary.backupLabel}. Backup includes song data, notes, requests, PDF links, and annotation overlays.
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportBackup}
              disabled={exporting}
              className="gap-1.5 shrink-0"
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {exporting ? "Exporting…" : "Export backup"}
            </Button>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Readiness checklist
            </div>
            {orderedIssues.length === 0 ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900/60 dark:bg-green-950/25 dark:text-green-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5" />
                <div>
                  <div className="font-semibold">No prep issues found.</div>
                  <div className="text-xs opacity-80 mt-0.5">
                    This set has songs, durations, PDFs, request link, and no review flags.
                  </div>
                </div>
              </div>
            ) : (
              orderedIssues.map((issue) => (
                <div key={issue.key} className={`rounded-xl border p-3 ${issueTone(issue)}`}>
                  <div className="flex items-start gap-2">
                    <IssueIcon severity={issue.severity} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold text-sm">{issue.title}</div>
                        {issue.count !== undefined && (
                          <Badge variant="outline" className="text-[10px]">
                            {issue.count}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs opacity-85">{issue.description}</div>
                      {issue.songTitles && issue.songTitles.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {issue.songTitles.map((title) => (
                            <span key={title} className="rounded-full bg-background/60 border border-current/15 px-2 py-0.5 text-[11px]">
                              {title}
                            </span>
                          ))}
                        </div>
                      )}
                      {issue.action && (
                        <div className="mt-2 text-[11px] font-medium opacity-90">
                          Suggested fix: {issue.action}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
            {onLoadTonight && (
              <Button type="button" onClick={handleLoad} disabled={loadingSet} className="gap-1.5">
                {loadingSet ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {summary.status === "ready" ? loadLabel : `${loadLabel} anyway`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
