import { Switch, Route, Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/ThemeProvider";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import SetlistPage from "@/pages/SetlistPage";
import StagePage from "@/pages/StagePage";
import AudiencePage from "@/pages/AudiencePage";
import VenuesPage from "@/pages/VenuesPage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/not-found";

function RoutedContent() {
  const [location] = useLocation();
  const normalizedLocation = location === "" ? "/" : location;

  // Public audience routes intentionally bypass the performer/admin Layout and nav.
  // This direct location gate is more reliable with HashRouter/GitHub Pages than
  // relying on a nested catch-all Route inside a Switch.
  if (normalizedLocation === "/audience" || normalizedLocation.startsWith("/audience/")) {
    return <AudiencePage />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/setlists" component={SetlistPage} />
        <Route path="/stage" component={StagePage} />
        <Route path="/venues" component={VenuesPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function AppRoutes() {
  return (
    <Router hook={useHashLocation}>
      <RoutedContent />
    </Router>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppRoutes />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
