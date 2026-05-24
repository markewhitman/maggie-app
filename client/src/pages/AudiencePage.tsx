import { useState, useMemo } from "react";
import { QRCodeSVG as QRCode } from "qrcode.react";
import { songsStore, type Song } from "@/lib/data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Music, Heart, Check, ExternalLink } from "lucide-react";

interface Request {
  songId: string;
  timestamp: number;
}

export default function AudiencePage() {
  const songs = useMemo(() => songsStore.getAll(), []);
  const [search, setSearch] = useState("");
  const [requests, setRequests] = useState<Request[]>([]);
  const [showQR, setShowQR] = useState(false);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q
      ? songs.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.artist.toLowerCase().includes(q)
        )
      : songs;
  }, [songs, search]);

  const requestSong = (song: Song) => {
    const alreadyRequested = requests.some((r) => r.songId === song.id);
    if (alreadyRequested) {
      toast({ title: "Already requested!", description: `${song.title} is in the queue` });
      return;
    }
    setRequests((prev) => [...prev, { songId: song.id, timestamp: Date.now() }]);
    toast({ title: "Request sent! 🎵", description: `${song.title} has been requested` });
  };

  const isRequested = (id: string) => requests.some((r) => r.songId === id);

  const qrUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none" className="text-primary">
            <circle cx="14" cy="14" r="13" stroke="currentColor" strokeWidth="2"/>
            <path d="M7 19 L10 9 L14 16 L18 9 L21 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="font-display font-bold italic text-primary">Maggie</span>
        </div>
        <div className="flex items-center gap-2">
          {requests.length > 0 && (
            <Badge className="bg-primary/20 text-primary border-0 text-xs">
              {requests.length} requested
            </Badge>
          )}
          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setShowQR((p) => !p)}>
            {showQR ? "Hide QR" : "Share QR"}
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* QR code */}
        {showQR && (
          <div className="flex flex-col items-center py-6 mb-4 bg-card border border-border rounded-xl">
            <QRCode value={qrUrl} size={180} />
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Scan to open on your phone and request songs
            </p>
          </div>
        )}

        {/* Welcome */}
        <div className="text-center py-4 mb-4">
          <h1 className="font-display font-bold text-2xl italic text-primary mb-1">Request a Song</h1>
          <p className="text-sm text-muted-foreground">Tap any song to send a request</p>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search songs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Song list */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Music className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No songs match "{search}"</p>
            </div>
          ) : (
            filtered.map((song) => {
              const requested = isRequested(song.id);
              return (
                <button
                  key={song.id}
                  className={`audience-card w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    requested
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/40 active:scale-[0.98]"
                  }`}
                  onClick={() => requestSong(song)}
                  data-testid={`audience-song-${song.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{song.title}</div>
                    <div className="text-xs text-muted-foreground">{song.artist} · {song.year}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {song.capo && song.capo !== "No capo" && (
                      <Badge className="capo-badge text-[10px]">{song.capo}</Badge>
                    )}
                    {requested ? (
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                        <Heart className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="text-center py-8 text-xs text-muted-foreground">
          {songs.length} songs available · Tap to request
        </div>
      </div>
    </div>
  );
}
