import type { CSSProperties, ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Music,
  ListMusic,
  Mic2,
  MapPin,
  Settings,
  Moon,
  Sun,
  Users,
  BarChart3,
  Wrench,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";

const NAV_GROUPS = [
  {
    label: "Build",
    items: [
      { href: "/", label: "Songs", icon: Music, tone: "188 78% 37%", toneFg: "0 0% 100%", help: "Song library" },
      { href: "/setlists", label: "Setlists", icon: ListMusic, tone: "222 76% 55%", toneFg: "0 0% 100%", help: "Build sets" },
    ],
  },
  {
    label: "Live",
    items: [
      { href: "/stage", label: "Stage", icon: Mic2, tone: "39 96% 52%", toneFg: "220 24% 7%", help: "Performer tools" },
      { href: "/audience", label: "Audience", icon: Users, tone: "329 78% 54%", toneFg: "0 0% 100%", help: "Request link" },
    ],
  },
  {
    label: "Memory",
    items: [
      { href: "/venues", label: "Venues", icon: MapPin, tone: "145 48% 38%", toneFg: "0 0% 100%", help: "Places" },
      { href: "/history", label: "History", icon: BarChart3, tone: "263 70% 56%", toneFg: "0 0% 100%", help: "Show recaps" },
      { href: "/gear", label: "Gear", icon: Wrench, tone: "24 94% 52%", toneFg: "0 0% 100%", help: "Setup memory" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/settings", label: "Settings", icon: Settings, tone: "215 16% 42%", toneFg: "0 0% 100%", help: "Preferences" },
    ],
  },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { theme, toggleTheme, visualMode } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 min-h-16 flex items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0 py-2">
            <svg width="32" height="32" viewBox="0 0 28 28" fill="none" aria-label="Maggie" className="text-primary">
              <circle cx="14" cy="14" r="13" stroke="currentColor" strokeWidth="2"/>
              <path d="M7 19 L10 9 L14 16 L18 9 L21 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="14" cy="6" r="1.5" fill="currentColor"/>
            </svg>
            <div className="leading-tight hidden xs:block">
              <span className="font-display font-bold text-lg italic text-primary tracking-tight block">Maggie</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Gig cockpit
              </span>
            </div>
          </div>

          {/* Nav */}
          <nav className="feature-nav" aria-label="Primary app navigation">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="feature-nav-group" aria-label={group.label}>
                <span className="feature-nav-group-label">{group.label}</span>
                <div className="feature-nav-group-items">
                  {group.items.map(({ href, label, icon: Icon, tone, toneFg, help }) => {
                    const active = location === href || (href !== "/" && location.startsWith(href));
                    return (
                      <Link key={href} href={href}>
                        <button
                          className={`feature-nav-item ${active ? "is-active" : ""}`}
                          style={{
                            "--nav-color": tone,
                            "--nav-fg": toneFg,
                          } as CSSProperties}
                          title={`${label} — ${help}`}
                          aria-current={active ? "page" : undefined}
                          data-testid={`nav-${label.toLowerCase()}`}
                        >
                          <span className="feature-nav-icon" aria-hidden="true">
                            <Icon className="w-4 h-4" />
                          </span>
                          <span className="feature-nav-label">{label}</span>
                        </button>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className={`shrink-0 w-10 h-10 ${visualMode === "clear" ? "ring-1 ring-border" : ""}`}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-6">{children}</main>
    </div>
  );
}
