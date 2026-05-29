import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "light" | "dark";
export type Palette =
  | "maggie"
  | "stage"
  | "rosewood"
  | "sage"
  | "ocean"
  | "violet";

export const PALETTES: Array<{
  id: Palette;
  name: string;
  description: string;
  swatches: string[];
}> = [
  {
    id: "maggie",
    name: "Maggie Gold",
    description: "Warm amber, cream, and walnut — the original look.",
    swatches: ["hsl(43 85% 48%)", "hsl(22 70% 50%)", "hsl(42 30% 97%)"],
  },
  {
    id: "stage",
    name: "Stage Light",
    description: "High-contrast amber on black for low-light performance.",
    swatches: ["hsl(39 96% 58%)", "hsl(24 94% 57%)", "hsl(220 24% 8%)"],
  },
  {
    id: "rosewood",
    name: "Rosewood",
    description: "Wine, blush, and mahogany tones.",
    swatches: ["hsl(350 72% 46%)", "hsl(20 75% 55%)", "hsl(14 45% 96%)"],
  },
  {
    id: "sage",
    name: "Sage Folk",
    description: "Soft green, clay, and parchment.",
    swatches: ["hsl(145 36% 38%)", "hsl(30 58% 45%)", "hsl(48 28% 96%)"],
  },
  {
    id: "ocean",
    name: "Ocean Blue",
    description: "Teal, blue, and cool neutral contrast.",
    swatches: ["hsl(197 78% 42%)", "hsl(174 62% 38%)", "hsl(210 40% 97%)"],
  },
  {
    id: "violet",
    name: "Violet Hour",
    description: "Purple, lavender, and late-evening contrast.",
    swatches: ["hsl(263 70% 56%)", "hsl(315 54% 54%)", "hsl(270 36% 97%)"],
  },
];

const THEME_KEY = "maggie_theme_mode";
const PALETTE_KEY = "maggie_color_palette";

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY) as Theme | null;
    if (saved === "light" || saved === "dark") return saved;
  } catch {}
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getInitialPalette(): Palette {
  try {
    const saved = localStorage.getItem(PALETTE_KEY) as Palette | null;
    if (saved && PALETTES.some((p) => p.id === saved)) return saved;
  } catch {}
  return "maggie";
}

const ThemeContext = createContext<{
  theme: Theme;
  palette: Palette;
  setTheme: (theme: Theme) => void;
  setPalette: (palette: Palette) => void;
  toggleTheme: () => void;
}>({
  theme: "light",
  palette: "maggie",
  setTheme: () => {},
  setPalette: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [palette, setPaletteState] = useState<Palette>(getInitialPalette);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.setAttribute("data-palette", palette);
    try {
      localStorage.setItem(THEME_KEY, theme);
      localStorage.setItem(PALETTE_KEY, palette);
    } catch {}
  }, [theme, palette]);

  const value = useMemo(
    () => ({
      theme,
      palette,
      setTheme: setThemeState,
      setPalette: setPaletteState,
      toggleTheme: () =>
        setThemeState((current) => (current === "dark" ? "light" : "dark")),
    }),
    [theme, palette],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
