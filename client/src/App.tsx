import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/ThemeProvider";
import { GithubProvider } from "@/lib/GithubContext";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import SetlistPage from "@/pages/SetlistPage";
import StagePage from "@/pages/StagePage";
import AudiencePage from "@/pages/AudiencePage";
import VenuesPage from "@/pages/VenuesPage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/not-found";

function AppRoutes() {
  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route>
          <Layout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/setlists" component={SetlistPage} />
              <Route path="/stage" component={StagePage} />
              <Route path="/audience" component={AudiencePage} />
              <Route path="/venues" component={VenuesPage} />
              <Route path="/settings" component={SettingsPage} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        </Route>
      </Switch>
    </Router>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <GithubProvider>
          <AppRoutes />
          <Toaster />
        </GithubProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
