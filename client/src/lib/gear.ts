export type GearCategory =
  | "guitar"
  | "amp"
  | "pedal"
  | "vocal"
  | "pa"
  | "mixer"
  | "monitor"
  | "microphone"
  | "di"
  | "lighting"
  | "other";

export type GearControlType = "dial" | "slider" | "toggle";
export type DiagramItemKind = "performer" | "mic" | "speaker" | "monitor" | "mixer" | "pedalboard" | "amp" | "power" | "stand" | "other";

export interface GearPhoto {
  id: string;
  dataUrl: string;
  caption?: string;
  createdAt: string;
}

export interface GearControl {
  id: string;
  type: GearControlType;
  label: string;
  value: number | boolean;
  min?: number;
  max?: number;
  unit?: string;
}

export interface GearItem {
  id: string;
  name: string;
  category: GearCategory;
  brandModel?: string;
  notes?: string;
  tags: string[];
  photo?: GearPhoto;
  createdAt: string;
  updatedAt: string;
}

export interface GearPreset {
  id: string;
  gearId: string;
  name: string;
  venueId?: string;
  situation?: string;
  notes?: string;
  photo?: GearPhoto;
  controls: GearControl[];
  createdAt: string;
  updatedAt: string;
}

export interface SetupDiagramItem {
  id: string;
  kind: DiagramItemKind;
  label: string;
  x: number;
  y: number;
  rotation?: number;
}

export interface SetupDiagram {
  id: string;
  venueId: string;
  name: string;
  notes?: string;
  isDefault?: boolean;
  items: SetupDiagramItem[];
  createdAt: string;
  updatedAt: string;
}

const GEAR_KEY = "maggie_gear_items_v1";
const PRESET_KEY = "maggie_gear_presets_v1";
const VENUE_DEFAULTS_KEY = "maggie_gear_venue_default_presets_v1";
const PACK_CHECK_KEY = "maggie_gear_pack_check_v1";
const DIAGRAM_KEY = "maggie_gear_setup_diagrams_v1";

export const GEAR_CATEGORIES: { value: GearCategory; label: string }[] = [
  { value: "guitar", label: "Guitar" },
  { value: "amp", label: "Amp" },
  { value: "pedal", label: "Pedal" },
  { value: "vocal", label: "Vocal processor" },
  { value: "pa", label: "PA speaker" },
  { value: "mixer", label: "Mixer" },
  { value: "monitor", label: "Monitor" },
  { value: "microphone", label: "Microphone" },
  { value: "di", label: "DI / interface" },
  { value: "lighting", label: "Lighting" },
  { value: "other", label: "Other" },
];

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function parseTags(value: string): string[] {
  return value
    .split(/[,#]/)
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .filter((tag, index, all) => all.indexOf(tag) === index);
}

export function categoryLabel(category: GearCategory): string {
  return GEAR_CATEGORIES.find((item) => item.value === category)?.label ?? "Other";
}

export type VenueDefaultPresetMap = Record<string, string>;
export type PackChecklistState = Record<string, Record<string, boolean>>;

export const gearStore = {
  getItems(): GearItem[] {
    return read<GearItem[]>(GEAR_KEY, []);
  },

  getPresets(): GearPreset[] {
    return read<GearPreset[]>(PRESET_KEY, []);
  },

  saveItem(data: Omit<GearItem, "id" | "createdAt" | "updatedAt"> & { id?: string; createdAt?: string }): GearItem {
    const now = new Date().toISOString();
    const item: GearItem = {
      ...data,
      id: data.id ?? uid(),
      createdAt: data.createdAt ?? now,
      updatedAt: now,
    };
    const items = this.getItems();
    const idx = items.findIndex((existing) => existing.id === item.id);
    if (idx >= 0) items[idx] = item;
    else items.unshift(item);
    write(GEAR_KEY, items);
    return item;
  },

  deleteItem(id: string): void {
    write(GEAR_KEY, this.getItems().filter((item) => item.id !== id));
    write(PRESET_KEY, this.getPresets().filter((preset) => preset.gearId !== id));
  },

  savePreset(data: Omit<GearPreset, "id" | "createdAt" | "updatedAt"> & { id?: string; createdAt?: string }): GearPreset {
    const now = new Date().toISOString();
    const preset: GearPreset = {
      ...data,
      id: data.id ?? uid(),
      createdAt: data.createdAt ?? now,
      updatedAt: now,
    };
    const presets = this.getPresets();
    const idx = presets.findIndex((existing) => existing.id === preset.id);
    if (idx >= 0) presets[idx] = preset;
    else presets.unshift(preset);
    write(PRESET_KEY, presets);
    return preset;
  },

  deletePreset(id: string): void {
    write(PRESET_KEY, this.getPresets().filter((preset) => preset.id !== id));
    const defaults = this.getVenueDefaults();
    const changed = Object.fromEntries(Object.entries(defaults).filter(([, presetId]) => presetId !== id));
    write(VENUE_DEFAULTS_KEY, changed);
  },

  getVenueDefaults(): VenueDefaultPresetMap {
    return read<VenueDefaultPresetMap>(VENUE_DEFAULTS_KEY, {});
  },

  setVenueDefault(venueId: string, presetId?: string): void {
    const defaults = this.getVenueDefaults();
    if (!presetId) delete defaults[venueId];
    else defaults[venueId] = presetId;
    write(VENUE_DEFAULTS_KEY, defaults);
  },

  getPackChecklist(): PackChecklistState {
    return read<PackChecklistState>(PACK_CHECK_KEY, {});
  },

  setPackChecked(venueId: string, gearId: string, checked: boolean): void {
    const state = this.getPackChecklist();
    state[venueId] = { ...(state[venueId] ?? {}), [gearId]: checked };
    write(PACK_CHECK_KEY, state);
  },

  resetPackChecklist(venueId: string): void {
    const state = this.getPackChecklist();
    delete state[venueId];
    write(PACK_CHECK_KEY, state);
  },

  getDiagrams(): SetupDiagram[] {
    return read<SetupDiagram[]>(DIAGRAM_KEY, []);
  },

  getDiagramsForVenue(venueId: string): SetupDiagram[] {
    return this.getDiagrams().filter((diagram) => diagram.venueId === venueId);
  },

  saveDiagram(data: Omit<SetupDiagram, "id" | "createdAt" | "updatedAt"> & { id?: string; createdAt?: string }): SetupDiagram {
    const now = new Date().toISOString();
    const diagram: SetupDiagram = {
      ...data,
      id: data.id ?? uid(),
      createdAt: data.createdAt ?? now,
      updatedAt: now,
    };
    const diagrams = this.getDiagrams();
    const idx = diagrams.findIndex((existing) => existing.id === diagram.id);
    const next = idx >= 0 ? diagrams.map((existing) => existing.id === diagram.id ? diagram : existing) : [diagram, ...diagrams];
    write(DIAGRAM_KEY, diagram.isDefault ? next.map((item) => item.venueId === diagram.venueId ? { ...item, isDefault: item.id === diagram.id } : item) : next);
    return diagram;
  },

  deleteDiagram(id: string): void {
    write(DIAGRAM_KEY, this.getDiagrams().filter((diagram) => diagram.id !== id));
  },

  setDefaultDiagram(venueId: string, diagramId: string): void {
    write(DIAGRAM_KEY, this.getDiagrams().map((diagram) => diagram.venueId === venueId ? { ...diagram, isDefault: diagram.id === diagramId, updatedAt: new Date().toISOString() } : diagram));
  },

  exportAll(): { items: GearItem[]; presets: GearPreset[]; venueDefaults: VenueDefaultPresetMap; packChecklist: PackChecklistState; diagrams: SetupDiagram[] } {
    return {
      items: this.getItems(),
      presets: this.getPresets(),
      venueDefaults: this.getVenueDefaults(),
      packChecklist: this.getPackChecklist(),
      diagrams: this.getDiagrams(),
    };
  },
};
