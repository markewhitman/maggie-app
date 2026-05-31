import { useEffect, useMemo, useState, type PointerEvent } from "react";
import {
  Cable,
  CheckSquare,
  CircleGauge,
  ClipboardList,
  Copy,
  Edit3,
  FileText,
  Filter,
  MapPin,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Settings2,
  Share2,
  Star,
  SlidersHorizontal,
  ToggleLeft,
  Trash2,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  type GearPhoto,
  type GearPreset,
  type SetupDiagram,
  type SetupDiagramItem,
  type DiagramItemKind,
  type PackChecklistState,
  type VenueDefaultPresetMap,
} from "@/lib/gear";
import { sbVenues, type SbVenue } from "@/lib/supabase";
import type { Venue } from "@/lib/data";

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const DIAGRAM_ITEM_OPTIONS: { kind: DiagramItemKind; label: string; icon: string }[] = [
  { kind: "performer", label: "Performer", icon: "🎤" },
  { kind: "mic", label: "Mic", icon: "🎙️" },
  { kind: "speaker", label: "Speaker", icon: "🔊" },
  { kind: "monitor", label: "Monitor", icon: "▰" },
  { kind: "mixer", label: "Mixer", icon: "🎚️" },
  { kind: "pedalboard", label: "Pedalboard", icon: "▤" },
  { kind: "amp", label: "Amp", icon: "▣" },
  { kind: "power", label: "Power", icon: "⚡" },
  { kind: "stand", label: "Stand", icon: "⌁" },
  { kind: "other", label: "Other", icon: "•" },
];

function diagramKindLabel(kind: DiagramItemKind): string {
  return DIAGRAM_ITEM_OPTIONS.find((item) => item.kind === kind)?.label ?? "Item";
}

function diagramKindIcon(kind: DiagramItemKind): string {
  return DIAGRAM_ITEM_OPTIONS.find((item) => item.kind === kind)?.icon ?? "•";
}

async function imageFileToPhoto(file: File, existingCaption = ""): Promise<GearPhoto> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const resized = await new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const max = 1100;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      if (scale >= 1) {
        resolve(raw);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(raw);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };
    img.onerror = () => resolve(raw);
    img.src = raw;
  });

  return {
    id: uid(),
    dataUrl: resized,
    caption: existingCaption || file.name.replace(/\.[^.]+$/, ""),
    createdAt: new Date().toISOString(),
  };
}

function PhotoField({
  label,
  photo,
  onChange,
}: {
  label: string;
  photo?: GearPhoto;
  onChange: (photo?: GearPhoto) => void;
}) {
  const [busy, setBusy] = useState(false);

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    setBusy(true);
    try {
      onChange(await imageFileToPhoto(file, photo?.caption));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label className="text-xs">{label}</Label>
          <p className="text-[11px] text-muted-foreground">Stored locally as a compressed setup reference image.</p>
        </div>
        {photo && <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => onChange(undefined)}>Remove</Button>}
      </div>
      {photo ? (
        <div className="grid sm:grid-cols-[140px_1fr] gap-3 items-start">
          <img src={photo.dataUrl} alt={photo.caption || label} className="h-28 w-full rounded-lg object-cover border border-border" />
          <div className="space-y-2">
            <Input value={photo.caption ?? ""} onChange={(e) => onChange({ ...photo, caption: e.target.value })} placeholder="Photo caption" />
            <Input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0])} disabled={busy} />
          </div>
        </div>
      ) : (
        <Input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0])} disabled={busy} />
      )}
    </div>
  );
}

function PhotoCard({ photo, label }: { photo?: GearPhoto; label?: string }) {
  if (!photo) return null;
  return (
    <figure className="rounded-xl border border-border bg-muted/20 overflow-hidden">
      <img src={photo.dataUrl} alt={photo.caption || label || "Gear photo"} className="h-40 w-full object-cover" />
      {(photo.caption || label) && <figcaption className="px-3 py-2 text-xs text-muted-foreground">{photo.caption || label}</figcaption>}
    </figure>
  );
}

function DiagramPreview({ diagram, compact = false }: { diagram?: SetupDiagram; compact?: boolean }) {
  if (!diagram) return null;
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border bg-[linear-gradient(90deg,hsl(var(--muted)/0.35)_1px,transparent_1px),linear-gradient(0deg,hsl(var(--muted)/0.35)_1px,transparent_1px)] bg-[size:24px_24px] ${compact ? "h-56" : "h-72"}`}>
      <div className="absolute left-3 top-3 rounded-full bg-background/90 px-2 py-1 text-[11px] font-semibold shadow-sm border border-border">{diagram.name}</div>
      {diagram.items.map((item) => (
        <div
          key={item.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border border-primary/30 bg-background/90 px-2.5 py-1.5 text-xs shadow-sm min-w-16 text-center"
          style={{ left: `${item.x}%`, top: `${item.y}%`, transform: `translate(-50%, -50%) rotate(${item.rotation ?? 0}deg)` }}
        >
          <div className="text-lg leading-none">{diagramKindIcon(item.kind)}</div>
          <div className="font-semibold truncate max-w-28">{item.label}</div>
        </div>
      ))}
      {diagram.items.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">No layout objects saved.</div>}
    </div>
  );
}

function DiagramForm({
  initial,
  venues,
  preferredVenueId,
  onSave,
  onCancel,
}: {
  initial?: SetupDiagram;
  venues: Venue[];
  preferredVenueId?: string;
  onSave: (diagram: SetupDiagram) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "Main stage setup");
  const [venueId, setVenueId] = useState(initial?.venueId ?? preferredVenueId ?? venues[0]?.id ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [isDefault, setIsDefault] = useState(Boolean(initial?.isDefault));
  const [items, setItems] = useState<SetupDiagramItem[]>(initial?.items ?? []);
  const [dragId, setDragId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initial?.items?.[0]?.id ?? null);
  const selected = items.find((item) => item.id === selectedId);

  const addItem = (kind: DiagramItemKind) => {
    const option = DIAGRAM_ITEM_OPTIONS.find((item) => item.kind === kind);
    const next: SetupDiagramItem = {
      id: uid(),
      kind,
      label: option?.label ?? "Item",
      x: 50,
      y: 50,
      rotation: 0,
    };
    setItems((prev) => [...prev, next]);
    setSelectedId(next.id);
  };

  const moveSelected = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(8, Math.min(92, ((e.clientY - rect.top) / rect.height) * 100));
    setItems((prev) => prev.map((item) => item.id === dragId ? { ...item, x, y } : item));
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Diagram name *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Venue</Label>
          <Select value={venueId} onValueChange={setVenueId}>
            <SelectTrigger><SelectValue placeholder="Choose venue" /></SelectTrigger>
            <SelectContent>{venues.map((venue) => <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Diagram notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Power, doors, reflective walls, where the crowd sits…" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={isDefault} onCheckedChange={(value) => setIsDefault(value === true)} />
        Make this the default diagram for this venue
      </label>

      <div className="rounded-xl border border-border p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Layout objects</div>
            <div className="text-xs text-muted-foreground">Add an object, then drag it into position. Select an object to rename or rotate it.</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DIAGRAM_ITEM_OPTIONS.map((option) => (
              <Button key={option.kind} type="button" variant="outline" size="sm" onClick={() => addItem(option.kind)}>
                <span className="mr-1">{option.icon}</span>{option.label}
              </Button>
            ))}
          </div>
        </div>
        <div
          className="relative h-[360px] rounded-2xl border border-border bg-[linear-gradient(90deg,hsl(var(--muted)/0.45)_1px,transparent_1px),linear-gradient(0deg,hsl(var(--muted)/0.45)_1px,transparent_1px)] bg-[size:24px_24px] overflow-hidden touch-none"
          onPointerMove={moveSelected}
          onPointerUp={() => setDragId(null)}
          onPointerLeave={() => setDragId(null)}
        >
          <div className="absolute left-3 top-3 rounded-full bg-background/95 px-2 py-1 text-[11px] font-semibold shadow-sm border border-border">Stage / room top view</div>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border px-2.5 py-1.5 text-xs shadow-sm min-w-16 text-center bg-background/95 ${selectedId === item.id ? "border-primary ring-2 ring-primary/25" : "border-border"}`}
              style={{ left: `${item.x}%`, top: `${item.y}%`, transform: `translate(-50%, -50%) rotate(${item.rotation ?? 0}deg)` }}
              onPointerDown={(e) => { e.preventDefault(); setSelectedId(item.id); setDragId(item.id); }}
            >
              <div className="text-lg leading-none">{diagramKindIcon(item.kind)}</div>
              <div className="font-semibold truncate max-w-28">{item.label}</div>
            </button>
          ))}
        </div>
        {selected ? (
          <div className="grid sm:grid-cols-[1fr_120px_auto] gap-2 items-center rounded-xl bg-muted/30 p-3">
            <Input value={selected.label} onChange={(e) => setItems((prev) => prev.map((item) => item.id === selected.id ? { ...item, label: e.target.value } : item))} />
            <Input type="number" value={selected.rotation ?? 0} onChange={(e) => setItems((prev) => prev.map((item) => item.id === selected.id ? { ...item, rotation: Number(e.target.value) } : item))} />
            <Button type="button" variant="ghost" className="text-destructive" onClick={() => { setItems((prev) => prev.filter((item) => item.id !== selected.id)); setSelectedId(null); }}>Remove</Button>
          </div>
        ) : (
          <div className="rounded-xl bg-muted/30 p-3 text-sm text-muted-foreground">Select a layout object to edit its label or rotation.</div>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          className="flex-1"
          disabled={!name.trim() || !venueId}
          onClick={() => onSave({
            id: initial?.id ?? uid(),
            venueId,
            name: name.trim(),
            notes: notes.trim() || undefined,
            isDefault,
            items: items.map((item) => ({ ...item, label: item.label.trim() || diagramKindLabel(item.kind) })),
            createdAt: initial?.createdAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })}
        >
          {initial ? "Save diagram" : "Add diagram"}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
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


interface VenueSetupBundle {
  venue: Venue;
  presets: GearPreset[];
  gearItems: GearItem[];
  defaultPreset?: GearPreset;
  diagrams: SetupDiagram[];
  defaultDiagram?: SetupDiagram;
}

function uniqueGearForPresets(presets: GearPreset[], itemById: Map<string, GearItem>): GearItem[] {
  const seen = new Set<string>();
  return presets
    .map((preset) => itemById.get(preset.gearId))
    .filter((item): item is GearItem => Boolean(item))
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}

function setupSheetPlainText(bundle: VenueSetupBundle): string {
  const lines: string[] = [];
  lines.push(`${bundle.venue.name}${bundle.venue.city ? ` · ${bundle.venue.city}` : ""}`);
  lines.push("Maggie setup sheet");
  lines.push("");
  if (bundle.defaultPreset) {
    const gear = bundle.gearItems.find((item) => item.id === bundle.defaultPreset?.gearId);
    lines.push(`Default setup: ${bundle.defaultPreset.name}${gear ? ` (${gear.name})` : ""}`);
    lines.push("");
  }
  if (bundle.venue.notes) {
    lines.push("Venue notes:");
    lines.push(bundle.venue.notes);
    lines.push("");
  }
  if (bundle.defaultDiagram) {
    lines.push(`Default setup diagram: ${bundle.defaultDiagram.name}`);
    if (bundle.defaultDiagram.notes) lines.push(bundle.defaultDiagram.notes);
    bundle.defaultDiagram.items.forEach((item) => lines.push(`- ${diagramKindLabel(item.kind)}: ${item.label} (${Math.round(item.x)}%, ${Math.round(item.y)}%)`));
    lines.push("");
  }
  lines.push("Pack checklist:");
  bundle.gearItems.forEach((item) => {
    lines.push(`- [ ] ${item.name}${item.brandModel ? ` — ${item.brandModel}` : ""} (${categoryLabel(item.category)})`);
    if (item.notes) lines.push(`      ${item.notes}`);
  });
  lines.push("");
  lines.push("Setup presets:");
  bundle.presets.forEach((preset) => {
    const gear = bundle.gearItems.find((item) => item.id === preset.gearId);
    lines.push(`- ${preset.name}${preset.id === bundle.defaultPreset?.id ? " [default]" : ""}`);
    lines.push(`  Gear: ${gear?.name ?? "Unknown gear"}${gear?.brandModel ? ` — ${gear.brandModel}` : ""}`);
    if (preset.situation) lines.push(`  Situation: ${preset.situation}`);
    if (preset.notes) lines.push(`  Notes: ${preset.notes}`);
    if (preset.controls.length) {
      lines.push("  Settings:");
      preset.controls.forEach((control) => lines.push(`    • ${control.label}: ${controlValueLabel(control)}`));
    }
  });
  return lines.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function printPhoto(photo?: GearPhoto, fallback = "Setup photo"): string {
  if (!photo) return "";
  return `<figure class="photo"><img src="${photo.dataUrl}" alt="${escapeHtml(photo.caption || fallback)}" />${photo.caption ? `<figcaption>${escapeHtml(photo.caption)}</figcaption>` : ""}</figure>`;
}

function printDiagram(diagram?: SetupDiagram): string {
  if (!diagram) return "";
  const items = diagram.items.map((item) => `
    <div class="diagram-item" style="left:${item.x}%; top:${item.y}%; transform:translate(-50%,-50%) rotate(${item.rotation ?? 0}deg);">
      <div class="diagram-icon">${escapeHtml(diagramKindIcon(item.kind))}</div>
      <strong>${escapeHtml(item.label)}</strong>
    </div>
  `).join("");
  return `
    <section><h2>Setup diagram</h2>
      ${diagram.notes ? `<p>${escapeHtml(diagram.notes).replace(/\n/g, "<br />")}</p>` : ""}
      <div class="diagram"><span>${escapeHtml(diagram.name)}</span>${items}</div>
    </section>
  `;
}

function printSetupSheet(bundle: VenueSetupBundle): void {
  const defaultText = bundle.defaultPreset ? `<p><strong>Default setup:</strong> ${escapeHtml(bundle.defaultPreset.name)}</p>` : "";
  const venueNotes = bundle.venue.notes ? `<section><h2>Venue notes</h2><p>${escapeHtml(bundle.venue.notes).replace(/\n/g, "<br />")}</p></section>` : "";
  const gearList = bundle.gearItems.map((item) => `
    <li>
      <span class="box"></span>
      <strong>${escapeHtml(item.name)}</strong>${item.brandModel ? ` — ${escapeHtml(item.brandModel)}` : ""}
      <em>${escapeHtml(categoryLabel(item.category))}</em>
      ${item.notes ? `<div class="note">${escapeHtml(item.notes).replace(/\n/g, "<br />")}</div>` : ""}
    </li>
  `).join("");
  const presetCards = bundle.presets.map((preset) => {
    const gear = bundle.gearItems.find((item) => item.id === preset.gearId);
    const controls = preset.controls.map((control) => `<li>${escapeHtml(control.label)}: <strong>${escapeHtml(controlValueLabel(control))}</strong></li>`).join("");
    return `
      <article class="preset">
        <h3>${escapeHtml(preset.name)}${preset.id === bundle.defaultPreset?.id ? " <span>Default</span>" : ""}</h3>
        <p><strong>Gear:</strong> ${escapeHtml(gear?.name ?? "Unknown gear")}${gear?.brandModel ? ` — ${escapeHtml(gear.brandModel)}` : ""}</p>
        ${preset.situation ? `<p><strong>Situation:</strong> ${escapeHtml(preset.situation)}</p>` : ""}
        ${preset.notes ? `<p><strong>Notes:</strong> ${escapeHtml(preset.notes).replace(/\n/g, "<br />")}</p>` : ""}
        ${controls ? `<ul>${controls}</ul>` : ""}
      </article>
    `;
  }).join("");

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(bundle.venue.name)} setup sheet</title>
<style>
  body { font-family: Inter, Arial, sans-serif; color: #171717; margin: 32px; line-height: 1.45; }
  h1 { font-family: Georgia, serif; font-style: italic; margin: 0 0 4px; }
  h2 { margin-top: 28px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  .muted { color: #666; margin-top: 0; }
  .box { display: inline-block; width: 14px; height: 14px; border: 2px solid #333; margin-right: 8px; vertical-align: -2px; }
  .pack li { margin: 9px 0; }
  .pack em { color: #666; font-style: normal; margin-left: 6px; }
  .note { margin-left: 28px; color: #555; font-size: 13px; }
  .preset { border: 1px solid #ddd; border-radius: 12px; padding: 14px; margin: 12px 0; page-break-inside: avoid; }
  .preset h3 { margin: 0 0 6px; }
  .preset span { border: 1px solid #999; border-radius: 999px; padding: 2px 7px; font-size: 11px; text-transform: uppercase; }
  .photo { margin: 10px 0; border: 1px solid #ddd; border-radius: 10px; overflow: hidden; display: inline-block; max-width: 320px; vertical-align: top; }
  .photo img { display: block; max-width: 320px; max-height: 220px; object-fit: cover; }
  .photo figcaption { font-size: 12px; color: #666; padding: 6px 8px; }
  .diagram { position: relative; height: 360px; border: 1px solid #ddd; border-radius: 14px; background-image: linear-gradient(90deg, #eee 1px, transparent 1px), linear-gradient(0deg, #eee 1px, transparent 1px); background-size: 24px 24px; overflow: hidden; page-break-inside: avoid; }
  .diagram > span { position: absolute; left: 12px; top: 10px; font-size: 12px; color: #555; }
  .diagram-item { position: absolute; min-width: 70px; text-align: center; border: 1px solid #999; border-radius: 10px; background: #fff; padding: 7px; font-size: 12px; }
  .diagram-icon { font-size: 20px; line-height: 1; }
  @media print { body { margin: 18mm; } button { display: none; } }
</style>
</head>
<body>
  <button onclick="window.print()">Print</button>
  <h1>${escapeHtml(bundle.venue.name)}</h1>
  <p class="muted">Maggie setup sheet${bundle.venue.city ? ` · ${escapeHtml(bundle.venue.city)}` : ""}</p>
  ${defaultText}
  ${venueNotes}
  ${printDiagram(bundle.defaultDiagram)}
  <section><h2>Pack checklist</h2><ul class="pack">${gearList}</ul></section>
  <section><h2>Setup presets</h2>${presetCards || "<p>No setup presets saved.</p>"}</section>
</body>
</html>`;
  // Avoid `noopener` here. In Chrome, opening about:blank with `noopener` can return
  // `null`, which leaves the new tab/window blank because we cannot write the
  // generated setup-sheet HTML into it.
  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) {
    window.alert("The setup sheet print window was blocked. Please allow popups for Maggie and try again.");
    return;
  }

  win.document.open();
  win.document.write(html);
  win.document.close();

  // Give Chrome/Safari a moment to finish laying out the injected HTML before
  // focusing/printing. This prevents the blank about:blank print window bug.
  window.setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      // Keep the printable setup sheet open even if automatic print fails.
      win.focus();
    }
  }, 250);
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
  const [photo, setPhoto] = useState<GearPhoto | undefined>(initial?.photo);

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
      <PhotoField label="Gear photo" photo={photo} onChange={setPhoto} />
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
              photo,
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
  const [photo, setPhoto] = useState<GearPhoto | undefined>(initial?.photo);
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
      <PhotoField label="Preset or setup photo" photo={photo} onChange={setPhoto} />

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
            photo,
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
  onCopyToVenue,
  onDelete,
}: {
  preset: GearPreset;
  gear?: GearItem;
  venues: Venue[];
  onEdit: () => void;
  onDuplicate: () => void;
  onCopyToVenue: () => void;
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
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Duplicate preset" onClick={onDuplicate}><Copy className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Copy to venue" onClick={onCopyToVenue}><Share2 className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {gear && <Badge variant="secondary">{categoryLabel(gear.category)}</Badge>}
          {preset.situation && <Badge variant="outline">{preset.situation}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <PhotoCard photo={preset.photo} label={preset.name} />
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
  const [diagrams, setDiagrams] = useState<SetupDiagram[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [venueFilter, setVenueFilter] = useState("all");
  const [showGearForm, setShowGearForm] = useState(false);
  const [editingGear, setEditingGear] = useState<GearItem | null>(null);
  const [showPresetForm, setShowPresetForm] = useState(false);
  const [editingPreset, setEditingPreset] = useState<GearPreset | null>(null);
  const [preferredGearId, setPreferredGearId] = useState<string | undefined>();
  const [venueDefaults, setVenueDefaults] = useState<VenueDefaultPresetMap>({});
  const [packState, setPackState] = useState<PackChecklistState>({});
  const [setupSheetVenueId, setSetupSheetVenueId] = useState<string | null>(null);
  const [copyPresetTarget, setCopyPresetTarget] = useState<GearPreset | null>(null);
  const [copyToVenueId, setCopyToVenueId] = useState("any");
  const [showDiagramForm, setShowDiagramForm] = useState(false);
  const [editingDiagram, setEditingDiagram] = useState<SetupDiagram | null>(null);
  const [preferredDiagramVenueId, setPreferredDiagramVenueId] = useState<string | undefined>();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const reload = () => {
    setItems(gearStore.getItems());
    setPresets(gearStore.getPresets());
    setDiagrams(gearStore.getDiagrams());
    setVenueDefaults(gearStore.getVenueDefaults());
    setPackState(gearStore.getPackChecklist());
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
    diagrams.forEach((diagram) => {
      if (!byVenue.has(diagram.venueId)) byVenue.set(diagram.venueId, []);
    });
    return Array.from(byVenue.entries()).map(([venueId, venuePresets]) => {
      const defaultPresetId = venueDefaults[venueId];
      const defaultPreset = venuePresets.find((preset) => preset.id === defaultPresetId);
      const sortedPresets = [...venuePresets].sort((a, b) => {
        if (a.id === defaultPresetId) return -1;
        if (b.id === defaultPresetId) return 1;
        return a.name.localeCompare(b.name);
      });
      const venueDiagrams = diagrams.filter((diagram) => diagram.venueId === venueId);
      return {
        venue: venues.find((venue) => venue.id === venueId),
        presets: sortedPresets,
        defaultPreset,
        gearItems: uniqueGearForPresets(sortedPresets, itemById),
        diagrams: venueDiagrams,
        defaultDiagram: venueDiagrams.find((diagram) => diagram.isDefault) ?? venueDiagrams[0],
      };
    }).filter((group) => group.venue);
  }, [presets, venues, venueDefaults, itemById, diagrams]);

  const activeSetupGroup = useMemo(() => {
    if (!setupSheetVenueId) return null;
    return venueSetupGroups.find((group) => group.venue?.id === setupSheetVenueId) ?? null;
  }, [setupSheetVenueId, venueSetupGroups]);

  const activeSetupBundle = useMemo<VenueSetupBundle | null>(() => {
    if (!activeSetupGroup?.venue) return null;
    return {
      venue: activeSetupGroup.venue,
      presets: activeSetupGroup.presets,
      gearItems: activeSetupGroup.gearItems,
      defaultPreset: activeSetupGroup.defaultPreset,
      diagrams: activeSetupGroup.diagrams,
      defaultDiagram: activeSetupGroup.defaultDiagram,
    };
  }, [activeSetupGroup]);

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

  const handleCopyPresetToVenue = () => {
    if (!copyPresetTarget) return;
    gearStore.savePreset({
      ...copyPresetTarget,
      id: undefined,
      name: copyToVenueId === "any" ? `${copyPresetTarget.name} copy` : `${copyPresetTarget.name} venue copy`,
      venueId: copyToVenueId === "any" ? undefined : copyToVenueId,
      controls: copyPresetTarget.controls.map((control) => ({ ...control, id: uid() })),
      createdAt: undefined,
    });
    reload();
    setCopyPresetTarget(null);
    setCopyToVenueId("any");
    toast({ title: "Preset copied", description: copyToVenueId === "any" ? "Saved as an any-venue preset." : `Copied to ${venueLabel(copyToVenueId, venues)}.` });
  };

  const handleSetVenueDefault = (venueId: string, presetId: string) => {
    gearStore.setVenueDefault(venueId, presetId);
    reload();
    toast({ title: "Default setup saved", description: "This preset will be featured on the setup sheet." });
  };

  const handleTogglePack = (venueId: string, gearId: string, checked: boolean) => {
    gearStore.setPackChecked(venueId, gearId, checked);
    reload();
  };

  const handleResetPack = (venueId: string) => {
    gearStore.resetPackChecklist(venueId);
    reload();
    toast({ title: "Pack checklist reset" });
  };

  const handleCopySetupSheet = async (bundle: VenueSetupBundle) => {
    try {
      await navigator.clipboard.writeText(setupSheetPlainText(bundle));
      toast({ title: "Setup sheet copied", description: "Paste it into a message, notes app, or print document." });
    } catch {
      toast({ title: "Copy failed", description: "Your browser blocked clipboard access.", variant: "destructive" });
    }
  };


  const handleSaveDiagram = (diagram: SetupDiagram) => {
    gearStore.saveDiagram(diagram);
    reload();
    setShowDiagramForm(false);
    setEditingDiagram(null);
    setPreferredDiagramVenueId(undefined);
    toast({ title: "Setup diagram saved", description: diagram.name });
  };

  const handleDeleteDiagram = async (diagram: SetupDiagram) => {
    const ok = await confirm({
      title: "Delete this setup diagram?",
      description: `This removes ${diagram.name} from your venue setup memory.`,
      confirmLabel: "Delete diagram",
      destructive: true,
    });
    if (!ok) return;
    gearStore.deleteDiagram(diagram.id);
    reload();
    toast({ title: "Diagram deleted" });
  };

  const handleSetDefaultDiagram = (venueId: string, diagramId: string) => {
    gearStore.setDefaultDiagram(venueId, diagramId);
    reload();
    toast({ title: "Default diagram saved" });
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
          <Button variant="outline" disabled={venues.length === 0} onClick={() => { setEditingDiagram(null); setPreferredDiagramVenueId(venues[0]?.id); setShowDiagramForm(true); }}>
            <MapPin className="w-4 h-4 mr-1.5" /> Add diagram
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase tracking-wide">Gear items</div><div className="text-2xl font-semibold mt-1">{items.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase tracking-wide">Presets</div><div className="text-2xl font-semibold mt-1">{presets.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase tracking-wide">Photos</div><div className="text-2xl font-semibold mt-1">{items.filter((item) => item.photo).length + presets.filter((preset) => preset.photo).length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase tracking-wide">Diagrams</div><div className="text-2xl font-semibold mt-1">{diagrams.length}</div></CardContent></Card>
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
          <TabsTrigger value="diagrams">Diagrams</TabsTrigger>
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
                onCopyToVenue={() => { setCopyPresetTarget(preset); setCopyToVenueId(preset.venueId ?? "any"); }}
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
                      <PhotoCard photo={item.photo} label={item.name} />
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
            venueSetupGroups.map(({ venue, presets: venuePresets, defaultPreset, gearItems, diagrams: venueDiagrams, defaultDiagram }) => {
              const venueId = venue!.id;
              const checkedMap = packState[venueId] ?? {};
              const packedCount = gearItems.filter((gear) => checkedMap[gear.id]).length;
              return (
                <Card key={venueId}>
                  <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> {venue!.name}</CardTitle>
                        <CardDescription>{venue!.city || "Saved venue"} · {venuePresets.length} setup preset{venuePresets.length === 1 ? "" : "s"} · {gearItems.length} gear item{gearItems.length === 1 ? "" : "s"}</CardDescription>
                        {defaultPreset && <Badge variant="secondary" className="mt-2"><Star className="h-3 w-3 mr-1 fill-current" /> Default: {defaultPreset.name}</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => setSetupSheetVenueId(venueId)}>
                          <ClipboardList className="h-3.5 w-3.5 mr-1.5" /> Setup sheet
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditingDiagram(null); setPreferredDiagramVenueId(venueId); setShowDiagramForm(true); }}>
                          <Plus className="h-3.5 w-3.5 mr-1.5" /> Diagram
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          const bundle: VenueSetupBundle = { venue: venue!, presets: venuePresets, gearItems, defaultPreset, diagrams: venueDiagrams, defaultDiagram };
                          printSetupSheet(bundle);
                        }}>
                          <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {venue!.notes && <p className="text-sm text-muted-foreground">{venue!.notes}</p>}
                    {defaultDiagram && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Default setup diagram</div>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingDiagram(defaultDiagram); setShowDiagramForm(true); }}>Edit diagram</Button>
                        </div>
                        <DiagramPreview diagram={defaultDiagram} compact />
                      </div>
                    )}

                    <div className="rounded-xl border border-border bg-muted/25 p-3">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div>
                          <div className="text-sm font-semibold flex items-center gap-2"><CheckSquare className="h-4 w-4 text-primary" /> Pack checklist</div>
                          <div className="text-xs text-muted-foreground">{packedCount}/{gearItems.length} checked for this venue</div>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => handleResetPack(venueId)}><RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset</Button>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {gearItems.map((gear) => (
                          <label key={gear.id} className="flex items-start gap-2 rounded-lg bg-background/70 border border-border p-2 text-sm cursor-pointer">
                            <Checkbox checked={Boolean(checkedMap[gear.id])} onCheckedChange={(checked) => handleTogglePack(venueId, gear.id, checked === true)} />
                            <span className="min-w-0">
                              <span className="font-medium block truncate">{gear.name}</span>
                              <span className="text-xs text-muted-foreground">{gear.brandModel || categoryLabel(gear.category)}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3">
                      {venuePresets.map((preset) => {
                        const gear = itemById.get(preset.gearId);
                        const isDefault = preset.id === defaultPreset?.id;
                        return (
                          <div key={preset.id} className={`rounded-xl border p-3 space-y-2 ${isDefault ? "border-primary bg-primary/5" : "border-border"}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-semibold text-sm flex items-center gap-1.5">{preset.name}{isDefault && <Star className="h-3.5 w-3.5 text-primary fill-current" />}</div>
                                <div className="text-xs text-muted-foreground">{gear?.name ?? "Unknown gear"}</div>
                              </div>
                              <div className="flex flex-wrap gap-1 justify-end">
                                {preset.situation && <Badge variant="outline">{preset.situation}</Badge>}
                                {!isDefault && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleSetVenueDefault(venueId, preset.id)}>Make default</Button>}
                              </div>
                            </div>
                            <PhotoCard photo={preset.photo} label={preset.name} />
                            {preset.notes && <p className="text-xs text-muted-foreground leading-relaxed">{preset.notes}</p>}
                            <div className="grid sm:grid-cols-2 gap-2">
                              {preset.controls.slice(0, 4).map((control) => <ControlGraphic key={control.id} control={control} />)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="diagrams" className="space-y-3">
          <div className="flex justify-end">
            <Button disabled={venues.length === 0} onClick={() => { setEditingDiagram(null); setPreferredDiagramVenueId(venues[0]?.id); setShowDiagramForm(true); }}>
              <Plus className="h-4 w-4 mr-1.5" /> Add setup diagram
            </Button>
          </div>
          {diagrams.length === 0 ? (
            <Card><CardContent className="py-14 text-center text-muted-foreground"><MapPin className="h-8 w-8 mx-auto mb-3 opacity-50" /><p className="font-medium">No setup diagrams yet</p><p className="text-sm mt-1">Create simple top-down layouts for speaker, mic, power, pedalboard, and mixer placement.</p></CardContent></Card>
          ) : (
            <div className="grid lg:grid-cols-2 gap-3">
              {diagrams.map((diagram) => {
                const venue = venues.find((item) => item.id === diagram.venueId);
                return (
                  <Card key={diagram.id} className={diagram.isDefault ? "border-primary" : undefined}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base flex items-center gap-1.5">{diagram.name}{diagram.isDefault && <Star className="h-4 w-4 text-primary fill-current" />}</CardTitle>
                          <CardDescription>{venue ? venueLabel(venue.id, venues) : "Saved venue"} · {diagram.items.length} object{diagram.items.length === 1 ? "" : "s"}</CardDescription>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingDiagram(diagram); setShowDiagramForm(true); }}><Edit3 className="h-3.5 w-3.5" /></Button>
                          {!diagram.isDefault && <Button variant="ghost" size="icon" className="h-8 w-8" title="Make default" onClick={() => handleSetDefaultDiagram(diagram.venueId, diagram.id)}><Star className="h-3.5 w-3.5" /></Button>}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteDiagram(diagram)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <DiagramPreview diagram={diagram} compact />
                      {diagram.notes && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{diagram.notes}</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
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

      <Dialog open={showDiagramForm} onOpenChange={(open) => { setShowDiagramForm(open); if (!open) { setEditingDiagram(null); setPreferredDiagramVenueId(undefined); } }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display italic">{editingDiagram ? "Edit Setup Diagram" : "Add Setup Diagram"}</DialogTitle></DialogHeader>
          {venues.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Add a venue before creating setup diagrams.</div>
          ) : (
            <DiagramForm
              initial={editingDiagram ?? undefined}
              venues={venues}
              preferredVenueId={preferredDiagramVenueId}
              onSave={handleSaveDiagram}
              onCancel={() => { setShowDiagramForm(false); setEditingDiagram(null); setPreferredDiagramVenueId(undefined); }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(activeSetupBundle)} onOpenChange={(open) => { if (!open) setSetupSheetVenueId(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display italic flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" /> {activeSetupBundle?.venue.name ?? "Venue"} Setup Sheet
            </DialogTitle>
          </DialogHeader>
          {activeSetupBundle && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => handleCopySetupSheet(activeSetupBundle)}>
                  <Copy className="h-4 w-4 mr-1.5" /> Copy sheet
                </Button>
                <Button variant="outline" onClick={() => printSetupSheet(activeSetupBundle)}>
                  <Printer className="h-4 w-4 mr-1.5" /> Print sheet
                </Button>
                <Button variant="ghost" onClick={() => handleResetPack(activeSetupBundle.venue.id)}>
                  <RotateCcw className="h-4 w-4 mr-1.5" /> Reset checklist
                </Button>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Venue summary</CardTitle>
                  <CardDescription>{activeSetupBundle.venue.city || "Saved venue"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {activeSetupBundle.defaultPreset ? (
                    <div className="rounded-lg bg-primary/10 border border-primary/25 p-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Default setup</div>
                      <div className="font-semibold flex items-center gap-1.5"><Star className="h-4 w-4 text-primary fill-current" /> {activeSetupBundle.defaultPreset.name}</div>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-muted/40 border border-dashed border-border p-3 text-muted-foreground">No default setup selected yet. Mark one venue preset as default from the Venue setups tab.</div>
                  )}
                  {activeSetupBundle.venue.notes && <p className="text-muted-foreground whitespace-pre-wrap">{activeSetupBundle.venue.notes}</p>}
                </CardContent>
              </Card>

              {activeSetupBundle.defaultDiagram && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Default setup diagram</CardTitle>
                    <CardDescription>{activeSetupBundle.defaultDiagram.notes || "Top-down placement guide for this venue."}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DiagramPreview diagram={activeSetupBundle.defaultDiagram} />
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><CheckSquare className="h-4 w-4 text-primary" /> Pack checklist</CardTitle>
                  <CardDescription>Check off gear as it is packed for this venue. The checklist is saved on this device.</CardDescription>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-2">
                  {activeSetupBundle.gearItems.map((gear) => {
                    const checked = Boolean(packState[activeSetupBundle.venue.id]?.[gear.id]);
                    return (
                      <label key={gear.id} className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3 cursor-pointer">
                        <Checkbox checked={checked} onCheckedChange={(value) => handleTogglePack(activeSetupBundle.venue.id, gear.id, value === true)} />
                        <span className="min-w-0">
                          <span className="font-semibold block truncate">{gear.name}</span>
                          <span className="text-xs text-muted-foreground">{gear.brandModel || categoryLabel(gear.category)}</span>
                          {gear.notes && <span className="block text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{gear.notes}</span>}
                        </span>
                      </label>
                    );
                  })}
                </CardContent>
              </Card>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Setup presets</h3>
                </div>
                {activeSetupBundle.presets.map((preset) => {
                  const gear = itemById.get(preset.gearId);
                  const isDefault = preset.id === activeSetupBundle.defaultPreset?.id;
                  return (
                    <Card key={preset.id} className={isDefault ? "border-primary" : undefined}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-base flex items-center gap-1.5">{preset.name}{isDefault && <Star className="h-4 w-4 text-primary fill-current" />}</CardTitle>
                            <CardDescription>{gear?.name ?? "Unknown gear"}{gear?.brandModel ? ` · ${gear.brandModel}` : ""}</CardDescription>
                          </div>
                          {!isDefault && <Button size="sm" variant="outline" onClick={() => handleSetVenueDefault(activeSetupBundle.venue.id, preset.id)}>Make default</Button>}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <PhotoCard photo={preset.photo} label={preset.name} />
                        {preset.notes && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{preset.notes}</p>}
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {preset.controls.map((control) => <ControlGraphic key={control.id} control={control} />)}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(copyPresetTarget)} onOpenChange={(open) => { if (!open) { setCopyPresetTarget(null); setCopyToVenueId("any"); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display italic">Copy Preset to Venue</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Preset</div>
              <div className="font-semibold">{copyPresetTarget?.name}</div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Copy to</Label>
              <Select value={copyToVenueId} onValueChange={setCopyToVenueId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any venue</SelectItem>
                  {venues.map((venue) => <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleCopyPresetToVenue}><Share2 className="h-4 w-4 mr-1.5" /> Copy preset</Button>
              <Button variant="outline" onClick={() => { setCopyPresetTarget(null); setCopyToVenueId("any"); }}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
