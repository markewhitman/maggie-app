export interface PerformanceControlSettings {
  enabled: boolean;
}

const SETTINGS_KEY = "maggie_performance_controls";

const DEFAULT_SETTINGS: PerformanceControlSettings = {
  enabled: true,
};

function readSettings(): PerformanceControlSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeSettings(settings: PerformanceControlSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore localStorage restrictions in private mode.
  }
}

export const performanceControlsStore = {
  get(): PerformanceControlSettings {
    return readSettings();
  },
  save(settings: PerformanceControlSettings) {
    writeSettings(settings);
  },
  setEnabled(enabled: boolean) {
    writeSettings({ ...readSettings(), enabled });
  },
  isEnabled(): boolean {
    return readSettings().enabled;
  },
};

export function shouldIgnorePerformanceShortcut(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName?.toLowerCase();
  if (["input", "textarea", "select", "option"].includes(tag)) return true;
  if (element.isContentEditable) return true;
  if (element.closest?.('[contenteditable="true"], input, textarea, select, [role="textbox"]')) return true;
  return false;
}

export const STAGE_SHORTCUTS = [
  { keys: "D / Enter", action: "Mark current song Done" },
  { keys: "S", action: "Skip current song" },
  { keys: "U", action: "Undo current song" },
  { keys: "M", action: "Open sheet music for current song" },
  { keys: "N", action: "Open performance note" },
  { keys: "P", action: "Open Performance Mode" },
  { keys: "R", action: "Open audience requests" },
  { keys: "W", action: "Open show recap / wrap-up" },
  { keys: "L", action: "Show/hide full set in Performance Mode" },
  { keys: "?", action: "Show shortcuts" },
  { keys: "Esc", action: "Close overlay" },
] as const;

export const PDF_SHORTCUTS = [
  { keys: "→ / PageDown / Space", action: "Next PDF page" },
  { keys: "← / PageUp", action: "Previous PDF page" },
  { keys: "F", action: "Toggle Fit page / Fit width" },
  { keys: "V", action: "Toggle Page / Scroll view" },
  { keys: "N", action: "Toggle annotation Notes mode" },
  { keys: "Z", action: "Undo last note stroke on current page" },
  { keys: "?", action: "Show shortcuts" },
  { keys: "Esc", action: "Close sheet music" },
] as const;
