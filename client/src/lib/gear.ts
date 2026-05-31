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
  controls: GearControl[];
  createdAt: string;
  updatedAt: string;
}

const GEAR_KEY = "maggie_gear_items_v1";
const PRESET_KEY = "maggie_gear_presets_v1";

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
  },

  exportAll(): { items: GearItem[]; presets: GearPreset[] } {
    return { items: this.getItems(), presets: this.getPresets() };
  },
};
