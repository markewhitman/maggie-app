import { useEffect, useMemo, useState } from "react";
import {
  Cable,
  CircleGauge,
  Copy,
  Edit3,
  Filter,
  MapPin,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  ToggleLeft,
  Trash2,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConfirmDialog } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import {
  categoryLabel,
  gearStore,
  GEAR_CATEGORIES,
  parseTags,
  type GearCategory,
  type GearControl,
  type GearControlType,
  type GearItem,
  type GearPreset,
} from "@/lib/gear";
import { sbVenues, type SbVenue } from "@/lib/supabase";
import type { Venue } from "@/lib/data";

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

function venueLabel(venueId: string | undefined, venues: Venue[]): string {
  if (!venueId) return "Any venue";
  const venue = venues.find((v) => v.id === venueId);
  return venue ? `${venue.name}${venue.city ? ` · ${venue.city}` : ""}` : "Saved venue";
}

function controlPercent(control: GearControl): number {
  if (typeof control.value === "boolean") return control.value ? 100 : 0;
  const min = control.min ?? 0;
  const max = control.max ?? 10;
  if (max <= min) return 0;
  return Math.max(0, Math.min(100, ((Number(control.value) - min) / (max - min)) * 100));
}

function controlValueLabel(control: GearControl): string {
  if (typeof control.value === "boolean") return control.value ? "On" : "Off";
  return `${control.value}${control.unit ? ` ${control.unit}` : ""}`;
}

function DialGraphic({ control }: { control: GearControl }) {
  const pct = controlPercent(control);
  const angle = -135 + pct * 2.7;
  return (
    <div className="rounded-xl border border-border bg-muted/25 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-xs font-semibold truncate">{control.label}</div>
        <Badge variant="outline" className="text-[10px]">{controlValueLabel(control)}</Badge>
      </div>
      <div className="flex items-center justify-center">
        <svg width="82" height="82" viewBox="0 0 82 82" className="text-primary">
          <circle cx="41" cy="41" r="30" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="5" />
          <path d="M18 64 A32 32 0 1 1 64 64" fill="none" stroke="hsl(var(--muted))" strokeWidth="5" strokeLinecap="round" />
          <path
            d="M18 64 A32 32 0 1 1 64 64"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${Math.max(1, pct * 1.51)} 151`}
          />
          <line
            x1="41"
            y1="41"
            x2="41"
            y2="18"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            transform={`rotate(${angle} 41 41)`}
          />
          <circle cx="41" cy="41" r="5" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

function SliderGraphic({ control }: { control: GearControl }) {
  const pct = controlPercent(control);
  return (
    <div className="rounded-xl border border-border bg-muted/25 p-3">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-xs font-semibold truncate">{control.label}</div>
        <Badge variant="outline" className="text-[10px]">{controlValueLabel(control)}</Badge>
      </div>
      <div className="relative h-3 rounded-full bg-muted overflow-hidden">
        <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <div className="relative h-6">
        <div
          className="absolute top-1 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-primary bg-background shadow"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ToggleGraphic({ control }: { control: GearControl }) {
  const on = Boolean(control.value);
  return (
    <div className="rounded-xl border border-border bg-muted/25 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold">{control.label}</div>
          <div className="text-[11px] text-muted-foreground">{on ? "Enabled" : "Disabled"}</div>
        </div>
        <div className={`relative h-8 w-14 rounded-full border ${on ? "bg-primary border-primary" : "bg-muted border-border"}`}>
          <div className={`absolute top-0.5 h-7 w-7 rounded-full bg-background shadow transition-transform ${on ? "translate-x-6" : "translate-x-0.5"}`} />
        </div>
      </div>
    </div>
  );
}

function ControlGraphic({ control }: { control: GearControl }) {
  if (control.type === "dial") return <DialGraphic control={control} />;
  if (control.type === "slider") return <SliderGraphic control={control} />;
  return <ToggleGraphic control={control} />;
}

function defaultControlsForCategory(category: GearCategory): GearControl[] {
  if (category === "mixer") {
    return [
      { id: uid(), type: "slider", label: "Vocal level", value: 6, min: 0, max: 10 },
      { id: uid(), type: "slider", label: "Guitar level", value: 5, min: 0, max: 10 },
      { id: uid(), type: "dial", label: "Reverb", value: 3, min: 0, max: 10 },
    ];
  }
  if (category === "amp" || category === "pa" || category === "vocal") {
    return [
      { id: uid(), type: "dial", label: "Volume", value: 5, min: 0, max: 10 },
      { id: uid(), type: "dial", label: "Bass", value: 5, min: 0, max: 10 },
      { id: uid(), type: "dial", label: "Treble", value: 5, min: 0, max: 10 },
    ];
  }
  if (category === "pedal") {
    return [
      { id: uid(), type: "dial", label: "Level", value: 5, min: 0, max: 10 },
      { id: uid(), type: "dial", label: "Tone", value: 5, min: 0, max: 10 },
      { id: uid(), type: "toggle", label: "Enabled", value: true },
    ];
  }
  return [
    { id: uid(), type: "dial", label: "Level", value: 5, min: 0, max: 10 },
    { id: uid(), type: "toggle", label: "Use for this show", value: true },
  ];
}

function GearItemForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: GearItem;
  onSave: (item: GearItem) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<GearCategory>(initial?.category ?? "guitar");
  const [brandModel, setBrandModel] = useState(initial?.brandModel ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? "");

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Gear name *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bose S1 Pro+" autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Category</Label>
          <Select value={category} onValueChange={(value) => setCategory(value as GearCategory)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{GEAR_CATEGORIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Brand / model</Label>
        <Input value={brandModel} onChange={(e) => setBrandModel(e.target.value)} placeholder="Taylor 214ce, Shure Beta 58A…" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Tags</Label>
        <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="solo, outdoor, backup" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Default notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Cable, battery, setup quirks, room notes…" />
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          className="flex-1"
          onClick={() => {
            if (!name.trim()) return;
            onSave({
              id: initial?.id ?? uid(),
              name: name.trim(),
              category,
              brandModel: brandModel.trim() || undefined,
              notes: notes.trim() || undefined,
              tags: parseTags(tags),
              createdAt: initial?.createdAt ?? new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }}
        >
          {initial ? "Save gear" : "Add gear"}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function PresetForm({
  initial,
  gearItems,
  venues,
  preferredGearId,
  onSave,
  onCancel,
}: {
  initial?: GearPreset;
  gearItems: GearItem[];
  venues: Venue[];
  preferredGearId?: string;
  onSave: (preset: GearPreset) => void;
  onCancel: () => void;
}) {
  const initialGear = gearItems.find((item) => item.id === (initial?.gearId ?? preferredGearId)) ?? gearItems[0];
  const [gearId, setGearId] = useState(initial?.gearId ?? preferredGearId ?? gearItems[0]?.id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [venueId, setVenueId] = useState(initial?.venueId ?? "any");
  const [situation, setSituation] = useState(initial?.situation ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [controls, setControls] = useState<GearControl[]>(initial?.controls ?? defaultControlsForCategory(initialGear?.category ?? "other"));

  const selectedGear = gearItems.find((item) => item.id === gearId);

  const updateControl = (id: string, patch: Partial<GearControl>) => {
    setControls((prev) => prev.map((control) => (control.id === id ? { ...control, ...patch } : control)));
  };

  const addControl = (type: GearControlType) => {
    setControls((prev) => [
      ...prev,
      {
        id: uid(),
        type,
        label: type === "dial" ? "New dial" : type === "slider" ? "New slider" : "New toggle",
        value: type === "toggle" ? true : 5,
        min: type === "toggle" ? undefined : 0,
        max: type === "toggle" ? undefined : 10,
      },
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Preset name *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Small indoor bar" autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Gear</Label>
          <Select value={gearId} onValueChange={setGearId}>
            <SelectTrigger><SelectValue placeholder="Choose gear" /></SelectTrigger>
            <SelectContent>{gearItems.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Venue</Label>
          <Select value={venueId} onValueChange={setVenueId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any venue</SelectItem>
              {venues.map((venue) => <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Situation</Label>
          <Input value={situation} onChange={(e) => setSituation(e.target.value)} placeholder="Patio, ceremony, loud room…" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Setup notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="What worked here? Volume, EQ, monitor, placement…" />
      </div>

      <div className="rounded-xl border border-border p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Controls</div>
            <div className="text-xs text-muted-foreground">Add dial, slider, and toggle positions for quick setup recall.</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={() => addControl("dial")}><CircleGauge className="w-3.5 h-3.5 mr-1" /> Dial</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => addControl("slider")}><SlidersHorizontal className="w-3.5 h-3.5 mr-1" /> Slider</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => addControl("toggle")}><ToggleLeft className="w-3.5 h-3.5 mr-1" /> Toggle</Button>
          </div>
        </div>
        {controls.length === 0 ? (
          <div className="text-xs text-muted-foreground rounded-lg bg-muted/40 p-3">No controls yet.</div>
        ) : (
          <div className="space-y-2">
            {controls.map((control) => (
              <div key={control.id} className="rounded-lg bg-muted/35 p-2 space-y-2">
                <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                  <Input className="h-8" value={control.label} onChange={(e) => updateControl(control.id, { label: e.target.value })} />
                  <Select value={control.type} onValueChange={(value) => updateControl(control.id, { type: value as GearControlType, value: value === "toggle" ? true : 5 })}>
                    <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dial">Dial</SelectItem>
                      <SelectItem value="slider">Slider</SelectItem>
                      <SelectItem value="toggle">Toggle</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setControls((prev) => prev.filter((item) => item.id !== control.id))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {control.type === "toggle" ? (
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant={control.value ? "default" : "outline"} onClick={() => updateControl(control.id, { value: true })}>On</Button>
                    <Button type="button" size="sm" variant={!control.value ? "default" : "outline"} onClick={() => updateControl(control.id, { value: false })}>Off</Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <Input className="h-8" type="number" value={Number(control.value)} onChange={(e) => updateControl(control.id, { value: Number(e.target.value) })} />
                    <Input className="h-8" type="number" value={control.min ?? 0} onChange={(e) => updateControl(control.id, { min: Number(e.target.value) })} placeholder="Min" />
                    <Input className="h-8" type="number" value={control.max ?? 10} onChange={(e) => updateControl(control.id, { max: Number(e.target.value) })} placeholder="Max" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          className="flex-1"
          disabled={!gearId || !name.trim()}
          onClick={() => onSave({
            id: initial?.id ?? uid(),
            gearId,
            name: name.trim(),
            venueId: venueId === "any" ? undefined : venueId,
            situation: situation.trim() || undefined,
            notes: notes.trim() || undefined,
            controls: controls.map((control) => ({ ...control, label: control.label.trim() || "Control" })),
            createdAt: initial?.createdAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })}
        >
          {initial ? "Save preset" : "Add preset"}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
      {selectedGear && <p className="text-xs text-muted-foreground">Preset will be saved under {selectedGear.name}.</p>}
    </div>
  );
}

function PresetCard({
  preset,
  gear,
  venues,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  preset: GearPreset;
  gear?: GearItem;
  venues: Venue[];
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">{preset.name}</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
              <span>{gear?.name ?? "Unknown gear"}</span>
              <span>•</span>
              <span>{venueLabel(preset.venueId, venues)}</span>
            </CardDescription>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}><Edit3 className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDuplicate}><Copy className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {gear && <Badge variant="secondary">{categoryLabel(gear.category)}</Badge>}
          {preset.situation && <Badge variant="outline">{preset.situation}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {preset.notes && <p className="text-sm text-muted-foreground leading-relaxed">{preset.notes}</p>}
        {preset.controls.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {preset.controls.map((control) => <ControlGraphic key={control.id} control={control} />)}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No visual settings saved yet.</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function GearPage() {
  const [items, setItems] = useState<GearItem[]>([]);
  const [presets, setPresets] = useState<GearPreset[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [venueFilter, setVenueFilter] = useState("all");
  const [showGearForm, setShowGearForm] = useState(false);
  const [editingGear, setEditingGear] = useState<GearItem | null>(null);
  const [showPresetForm, setShowPresetForm] = useState(false);
  const [editingPreset, setEditingPreset] = useState<GearPreset | null>(null);
  const [preferredGearId, setPreferredGearId] = useState<string | undefined>();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const reload = () => {
    setItems(gearStore.getItems());
    setPresets(gearStore.getPresets());
  };

  useEffect(() => {
    reload();
    sbVenues.getAll().then((rows) => setVenues(rows.map(sbToVenue))).catch(() => setVenues([]));
  }, []);

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      const matchesSearch = !q || [item.name, item.brandModel, item.notes, ...item.tags].filter(Boolean).join(" ").toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [items, search, categoryFilter]);

  const filteredPresets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return presets.filter((preset) => {
      const gear = itemById.get(preset.gearId);
      const matchesVenue = venueFilter === "all" || (venueFilter === "any" ? !preset.venueId : preset.venueId === venueFilter);
      const matchesCategory = categoryFilter === "all" || gear?.category === categoryFilter;
      const haystack = [preset.name, preset.situation, preset.notes, gear?.name, gear?.brandModel, gear?.tags.join(" ")].filter(Boolean).join(" ").toLowerCase();
      const matchesSearch = !q || haystack.includes(q);
      return matchesVenue && matchesCategory && matchesSearch;
    });
  }, [presets, itemById, venueFilter, categoryFilter, search]);

  const venueSetupGroups = useMemo(() => {
    const byVenue = new Map<string, GearPreset[]>();
    presets.filter((preset) => preset.venueId).forEach((preset) => {
      const key = preset.venueId as string;
      byVenue.set(key, [...(byVenue.get(key) ?? []), preset]);
    });
    return Array.from(byVenue.entries()).map(([venueId, venuePresets]) => ({
      venue: venues.find((venue) => venue.id === venueId),
      presets: venuePresets,
    })).filter((group) => group.venue);
  }, [presets, venues]);

  const handleSaveGear = (item: GearItem) => {
    gearStore.saveItem(item);
    reload();
    setShowGearForm(false);
    setEditingGear(null);
    toast({ title: "Gear saved", description: item.name });
  };

  const handleDeleteGear = async (item: GearItem) => {
    const count = presets.filter((preset) => preset.gearId === item.id).length;
    const ok = await confirm({
      title: "Delete this gear item?",
      description: count ? `This will also remove ${count} saved preset${count === 1 ? "" : "s"} for ${item.name}.` : `This removes ${item.name} from the gear library.`,
      confirmLabel: "Delete gear",
      destructive: true,
    });
    if (!ok) return;
    gearStore.deleteItem(item.id);
    reload();
    toast({ title: "Gear deleted" });
  };

  const handleSavePreset = (preset: GearPreset) => {
    gearStore.savePreset(preset);
    reload();
    setShowPresetForm(false);
    setEditingPreset(null);
    setPreferredGearId(undefined);
    toast({ title: "Preset saved", description: preset.name });
  };

  const handleDeletePreset = async (preset: GearPreset) => {
    const ok = await confirm({
      title: "Delete this preset?",
      description: `This removes ${preset.name} from your setup memory.`,
      confirmLabel: "Delete preset",
      destructive: true,
    });
    if (!ok) return;
    gearStore.deletePreset(preset.id);
    reload();
    toast({ title: "Preset deleted" });
  };

  const handleDuplicatePreset = (preset: GearPreset) => {
    gearStore.savePreset({
      ...preset,
      id: undefined,
      name: `${preset.name} copy`,
      controls: preset.controls.map((control) => ({ ...control, id: uid() })),
      createdAt: undefined,
    });
    reload();
    toast({ title: "Preset duplicated" });
  };

  const totalControls = presets.reduce((sum, preset) => sum + preset.controls.length, 0);

  return (
    <div className="space-y-6">
      {ConfirmDialog}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display font-bold text-xl italic mb-0.5">Gear</h1>
          <p className="text-sm text-muted-foreground">Catalog performance gear and remember what settings work at each venue.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { setEditingGear(null); setShowGearForm(true); }}>
            <Plus className="w-4 h-4 mr-1.5" /> Add gear
          </Button>
          <Button disabled={items.length === 0} onClick={() => { setEditingPreset(null); setPreferredGearId(items[0]?.id); setShowPresetForm(true); }}>
            <Settings2 className="w-4 h-4 mr-1.5" /> Add preset
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase tracking-wide">Gear items</div><div className="text-2xl font-semibold mt-1">{items.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase tracking-wide">Presets</div><div className="text-2xl font-semibold mt-1">{presets.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase tracking-wide">Visual controls</div><div className="text-2xl font-semibold mt-1">{totalControls}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase tracking-wide">Venue setups</div><div className="text-2xl font-semibold mt-1">{venueSetupGroups.length}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-2 lg:grid-cols-[1fr_180px_220px]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search gear, presets, venues, notes…" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger><Filter className="w-3.5 h-3.5 mr-2" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {GEAR_CATEGORIES.map((category) => <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={venueFilter} onValueChange={setVenueFilter}>
              <SelectTrigger><MapPin className="w-3.5 h-3.5 mr-2" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All preset venues</SelectItem>
                <SelectItem value="any">Any venue presets</SelectItem>
                {venues.map((venue) => <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="presets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="presets">Setup presets</TabsTrigger>
          <TabsTrigger value="gear">Gear library</TabsTrigger>
          <TabsTrigger value="venues">Venue setups</TabsTrigger>
        </TabsList>

        <TabsContent value="presets" className="space-y-3">
          {items.length === 0 ? (
            <Card><CardContent className="py-14 text-center text-muted-foreground"><Wrench className="h-8 w-8 mx-auto mb-3 opacity-50" /><p className="font-medium">Start by adding gear</p><p className="text-sm mt-1">Then save presets with dial, slider, and toggle positions.</p></CardContent></Card>
          ) : filteredPresets.length === 0 ? (
            <Card><CardContent className="py-14 text-center text-muted-foreground"><Settings2 className="h-8 w-8 mx-auto mb-3 opacity-50" /><p className="font-medium">No presets match</p><p className="text-sm mt-1">Add a setup preset or adjust filters.</p></CardContent></Card>
          ) : (
            filteredPresets.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                gear={itemById.get(preset.gearId)}
                venues={venues}
                onEdit={() => { setEditingPreset(preset); setShowPresetForm(true); }}
                onDuplicate={() => handleDuplicatePreset(preset)}
                onDelete={() => handleDeletePreset(preset)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="gear">
          {filteredItems.length === 0 ? (
            <Card><CardContent className="py-14 text-center text-muted-foreground"><Cable className="h-8 w-8 mx-auto mb-3 opacity-50" /><p className="font-medium">No gear yet</p><p className="text-sm mt-1">Add guitars, speakers, pedals, mics, mixers, and other performance gear.</p></CardContent></Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {filteredItems.map((item) => {
                const itemPresets = presets.filter((preset) => preset.gearId === item.id);
                return (
                  <Card key={item.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">{item.name}</CardTitle>
                          <CardDescription>{item.brandModel || categoryLabel(item.category)}</CardDescription>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingGear(item); setShowGearForm(true); }}><Edit3 className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteGear(item)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <Badge variant="secondary">{categoryLabel(item.category)}</Badge>
                        <Badge variant="outline">{itemPresets.length} preset{itemPresets.length === 1 ? "" : "s"}</Badge>
                        {item.tags.map((tag) => <Badge key={tag} variant="outline">#{tag}</Badge>)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {item.notes && <p className="text-sm text-muted-foreground leading-relaxed">{item.notes}</p>}
                      <Button variant="outline" size="sm" onClick={() => { setEditingPreset(null); setPreferredGearId(item.id); setShowPresetForm(true); }}>
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Add preset for this gear
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="venues" className="space-y-3">
          {venueSetupGroups.length === 0 ? (
            <Card><CardContent className="py-14 text-center text-muted-foreground"><MapPin className="h-8 w-8 mx-auto mb-3 opacity-50" /><p className="font-medium">No venue-specific setups yet</p><p className="text-sm mt-1">Attach presets to venues to build soundcheck memory over time.</p></CardContent></Card>
          ) : (
            venueSetupGroups.map(({ venue, presets: venuePresets }) => (
              <Card key={venue!.id}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> {venue!.name}</CardTitle>
                  <CardDescription>{venue!.city || "Saved venue"} · {venuePresets.length} setup preset{venuePresets.length === 1 ? "" : "s"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {venue!.notes && <p className="text-sm text-muted-foreground">{venue!.notes}</p>}
                  <div className="grid md:grid-cols-2 gap-3">
                    {venuePresets.map((preset) => (
                      <div key={preset.id} className="rounded-xl border border-border p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-sm">{preset.name}</div>
                            <div className="text-xs text-muted-foreground">{itemById.get(preset.gearId)?.name ?? "Unknown gear"}</div>
                          </div>
                          {preset.situation && <Badge variant="outline">{preset.situation}</Badge>}
                        </div>
                        {preset.notes && <p className="text-xs text-muted-foreground leading-relaxed">{preset.notes}</p>}
                        <div className="grid sm:grid-cols-2 gap-2">
                          {preset.controls.slice(0, 4).map((control) => <ControlGraphic key={control.id} control={control} />)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showGearForm} onOpenChange={(open) => { setShowGearForm(open); if (!open) setEditingGear(null); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display italic">{editingGear ? "Edit Gear" : "Add Gear"}</DialogTitle></DialogHeader>
          <GearItemForm initial={editingGear ?? undefined} onSave={handleSaveGear} onCancel={() => { setShowGearForm(false); setEditingGear(null); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={showPresetForm} onOpenChange={(open) => { setShowPresetForm(open); if (!open) { setEditingPreset(null); setPreferredGearId(undefined); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display italic">{editingPreset ? "Edit Setup Preset" : "Add Setup Preset"}</DialogTitle></DialogHeader>
          {items.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Add a gear item before creating presets.</div>
          ) : (
            <PresetForm
              initial={editingPreset ?? undefined}
              gearItems={items}
              venues={venues}
              preferredGearId={preferredGearId}
              onSave={handleSavePreset}
              onCancel={() => { setShowPresetForm(false); setEditingPreset(null); setPreferredGearId(undefined); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
