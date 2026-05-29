import { QRCodeSVG as QRCode } from "qrcode.react";
import { Copy, ExternalLink, QrCode, Share2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface AudienceShareDialogProps {
  open: boolean;
  onClose: () => void;
  url: string;
  setlistName?: string;
  subtitle?: string;
  songCount?: number;
  source?: "stage" | "setlist" | "audience";
}

export function AudienceShareDialog({
  open,
  onClose,
  url,
  setlistName,
  subtitle,
  songCount,
  source = "setlist",
}: AudienceShareDialogProps) {
  const { toast } = useToast();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Audience link copied",
        description: setlistName
          ? `This link is for ${setlistName}.`
          : "Share this link or QR code with the audience.",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Select the link manually and copy it.",
        variant: "destructive",
      });
    }
  };

  const shareLink = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: setlistName
            ? `Request a song for ${setlistName}`
            : "Request a song",
          text: setlistName
            ? `Request a song for ${setlistName}`
            : "Request a song from tonight's set",
          url,
        });
        return;
      } catch {
        // User cancelled native sharing; fall through to copy.
      }
    }
    await copyLink();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display italic flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" /> Audience Request QR
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Requests are scoped to
            </div>
            <div className="mt-1 font-display text-xl font-bold italic leading-tight">
              {setlistName ?? "Current active set"}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {subtitle && <span>{subtitle}</span>}
              {typeof songCount === "number" && (
                <Badge variant="outline" className="text-[10px]">
                  {songCount} song{songCount === 1 ? "" : "s"}
                </Badge>
              )}
              {source === "stage" && (
                <Badge className="text-[10px] bg-primary text-primary-foreground">
                  Loaded in Stage
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center rounded-2xl border border-border bg-white p-5 shadow-sm">
            <QRCode value={url} size={220} level="M" includeMargin />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Shareable link
            </label>
            <div className="flex gap-2">
              <Input value={url} readOnly className="text-xs" />
              <Button variant="outline" size="icon" onClick={copyLink} title="Copy link">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button onClick={shareLink} className="gap-2">
              <Share2 className="w-4 h-4" /> Share
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="w-4 h-4" /> Preview
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            Use this QR/link for this specific set. Guests will see which set
            they are requesting for before they submit a song.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
