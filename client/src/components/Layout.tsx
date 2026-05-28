import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Music, ListMusic, Mic2, MapPin, Settings, Moon, Sun, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";

const NAV_ITEMS = [
  { href: "/", label: "Songs", icon: Music },
  { href: "/setlists", label: "Setlists", icon: ListMusic },
  { href: "/stage", label: "Stage", icon: Mic2 },
  { href: "/audience", label: "Audience", icon: Users },
  { href: "/venues", label: "Venues", icon: MapPin },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-label="Maggie" className="text-primary">
              <circle cx="14" cy="14" r="13" stroke="currentColor" strokeWidth="2"/>
              <path d="M7 19 L10 9 L14 16 L18 9 L21 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="14" cy="6" r="1.5" fill="currentColor"/>
            </svg>
            <span className="font-display font-bold text-lg italic text-primary tracking-tight">Maggie</span>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = location === href || (href !== "/" && location.startsWith(href));
              return (
                <Link key={href} href={href}>
                  <button
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                    data-testid={`nav-${label.toLowerCase()}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                </Link>
              );
            })}
          </nav>

          {/* Theme toggle */}
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="shrink-0 w-8 h-8">
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
