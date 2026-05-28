import { useState, useEffect } from "react";
import { sbVenues, getDeviceId, type SbVenue } from "@/lib/supabase";
import type { Venue } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, Pencil, Trash2, Music, RefreshCw, Wifi } from "lucide-react";

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sbToVenue(r: SbVenue): Venue {
  return {
    id: r.id,
    name: r.name,
    city: r.city ?? undefined,
    notes: r.notes ?? undefined,
    gigCount: r.gig_count,
    createdAt: r.created_at,
  };
}

// ─── Venue Form ───────────────────────────────────────────

interface VenueFormProps {
  initial?: Venue;
  onSave: (data: { name: string; city?: string; notes?: string }) => void;
  onCancel: () => void;
  saving?: boolean;
}

function VenueForm({ initial, onSave, onCancel, saving }: VenueFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Venue Name *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="The Burren" autoFocus data-testid="input-venue-name" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">City</Label>
        <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Somerville, MA" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Notes / Vibe</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Outdoor patio, great sound, rowdy Friday crowd…"
          rows={3}
        />
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          onClick={() => {
            if (!name.trim()) return;
            onSave({ name: name.trim(), city: city.trim() || undefined, notes: notes.trim() || undefined });
          }}
          className="flex-1"
          disabled={saving}
          data-testid="button-save-venue"
        >
          {saving ? "Saving…" : initial ? "Save Changes" : "Add Venue"}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────

export default function VenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Venue | null>(null);
  const { toast } = useToast();

  const loadVenues = async () => {
    setLoading(true);
    try {
      const rows = await sbVenues.getAll();
      setVenues(rows.map(sbToVenue));
    } catch (err) {
      console.error(err);
      toast({ title: "Sync error", description: "Could not load venues from cloud.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadVenues(); }, []);

  const handleAdd = async (data: { name: string; city?: string; notes?: string }) => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const newVenue: SbVenue = {
        id: uid(),
        user_id: getDeviceId(),
        name: data.name,
        city: data.city ?? null,
        notes: data.notes ?? null,
        gig_count: 0,
        created_at: now,
      };
      await sbVenues.save(newVenue);
      setVenues((prev) => [sbToVenue(newVenue), ...prev]);
      setShowAdd(false);
      toast({ title: "Venue added!", description: data.name });
    } catch (err) {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (venue: Venue, data: { name: string; city?: string; notes?: string }) => {
    setSaving(true);
    try {
      const updated: SbVenue = {
        id: venue.id,
        user_id: getDeviceId(),
        name: data.name,
        city: data.city ?? null,
        notes: data.notes ?? null,
        gig_count: venue.gigCount,
        created_at: venue.createdAt,
      };
      await sbVenues.update(updated);
      setVenues((prev) => prev.map((v) => v.id === venue.id ? sbToVenue(updated) : v));
      setEditing(null);
      toast({ title: "Venue updated" });
    } catch (err) {
      toast({ title: "Update failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this venue? This cannot be undone.")) return;
    try {
      await sbVenues.delete(id);
      setVenues((prev) => prev.filter((v) => v.id !== id));
      toast({ title: "Venue removed" });
    } catch (err) {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-xl italic mb-0.5">Venues</h1>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground text-sm">{venues.length} saved venue{venues.length !== 1 ? "s" : ""}</p>
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <Wifi className="w-3 h-3" /> Synced
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={loadVenues} title="Refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => setShowAdd(true)} className="gap-1.5" data-testid="button-add-venue">
            <Plus className="w-4 h-4" /> Add Venue
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : venues.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MapPin className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No venues saved yet</p>
          <p className="text-sm mt-1">Add venues here so you can quickly select them when building setlists</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {venues.map((venue) => (
            <div key={venue.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{venue.name}</div>
                  {venue.city && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" /> {venue.city}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setEditing(venue)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleDelete(venue.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              {venue.notes && (
                <p className="text-xs text-muted-foreground leading-relaxed">{venue.notes}</p>
              )}
              <div className="flex items-center gap-1.5">
                <Music className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{venue.gigCount} gig{venue.gigCount !== 1 ? "s" : ""}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display italic">Add Venue</DialogTitle></DialogHeader>
          <VenueForm onSave={handleAdd} onCancel={() => setShowAdd(false)} saving={saving} />
        </DialogContent>
      </Dialog>

      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="font-display italic">Edit Venue</DialogTitle></DialogHeader>
            <VenueForm initial={editing} onSave={(data) => handleEdit(editing, data)} onCancel={() => setEditing(null)} saving={saving} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
