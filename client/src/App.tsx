import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import ServicesPage from "@/pages/services-page";
import AlertsPage from "@/pages/alerts-page";
import HistoryPage from "@/pages/history-page";
import SettingsPage from "@/pages/settings-page";
import AgentsPage from "@/pages/agents-page";
import SharedMapsPage from "@/pages/shared-maps-page";
import ViewMapPage from "@/pages/view-map-page";
import ServiceMapsPage from "@/pages/service-maps-page";
import ServiceMapDetailPage from "@/pages/service-map-detail-page";
import SetupWizard from "@/pages/setup-wizard";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "./hooks/use-auth";
import { ThemeProvider, ThemeToggleProvider } from "@/components/theme-provider";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={DashboardPage} />
      <ProtectedRoute path="/services" component={ServicesPage} />
      <ProtectedRoute path="/alerts" component={AlertsPage} />
      <ProtectedRoute path="/agents" component={AgentsPage} />
      <ProtectedRoute path="/history" component={HistoryPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <Route path="/shared-maps">
        {() => {
          // Redirect from /shared-maps to /service-maps with 'shared-maps' tab pre-selected
          console.log("Redirecting from /shared-maps to /service-maps");
          window.location.href = "/service-maps#shared-maps";
          return null;
        }}
      </Route>
      <ProtectedRoute path="/service-maps" component={ServiceMapsPage} />
      <ProtectedRoute path="/service-maps/:id" component={ServiceMapDetailPage} />
      <Route path="/view-map/:shareKey">
        {(params) => {
          console.log("View map route accessed with params:", params);
          return <ViewMapPage />;
        }}
      </Route>
      <Route path="/setup" component={SetupWizard} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  console.log("App component rendering");
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ThemeToggleProvider>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </AuthProvider>
        </ThemeToggleProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
