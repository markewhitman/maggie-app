import { useState } from "react";
import { venuesStore, type Venue } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, Pencil, Trash2, Music } from "lucide-react";

interface VenueFormProps {
  initial?: Venue;
  onSave: (data: { name: string; city?: string; notes?: string }) => void;
  onCancel: () => void;
}

function VenueForm({ initial, onSave, onCancel }: VenueFormProps) {
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
          data-testid="button-save-venue"
        >
          {initial ? "Save Changes" : "Add Venue"}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export default function VenuesPage() {
  const [venues, setVenues] = useState<Venue[]>(() => venuesStore.getAll());
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Venue | null>(null);
  const { toast } = useToast();

  const refresh = () => setVenues(venuesStore.getAll());

  const handleAdd = (data: { name: string; city?: string; notes?: string }) => {
    venuesStore.create(data);
    refresh();
    setShowAdd(false);
    toast({ title: "Venue added!", description: data.name });
  };

  const handleEdit = (venue: Venue, data: { name: string; city?: string; notes?: string }) => {
    venuesStore.update({ ...venue, ...data });
    refresh();
    setEditing(null);
    toast({ title: "Venue updated" });
  };

  const handleDelete = (id: string) => {
    venuesStore.delete(id);
    refresh();
    toast({ title: "Venue removed" });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-xl italic mb-0.5">Venues</h1>
          <p className="text-muted-foreground text-sm">{venues.length} saved venue{venues.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-1.5" data-testid="button-add-venue">
          <Plus className="w-4 h-4" /> Add Venue
        </Button>
      </div>

      {venues.length === 0 ? (
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

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display italic">Add Venue</DialogTitle></DialogHeader>
          <VenueForm onSave={handleAdd} onCancel={() => setShowAdd(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="font-display italic">Edit Venue</DialogTitle></DialogHeader>
            <VenueForm initial={editing} onSave={(data) => handleEdit(editing, data)} onCancel={() => setEditing(null)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
