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
import { lazy, Suspense } from "react";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "./hooks/use-auth";
import { ThemeProvider, ThemeToggleProvider } from "@/components/theme-provider";
import { Loader2 } from "lucide-react";

// Lazy load shared maps pages
const SharedMapsPage = lazy(() => import("./pages/shared-maps-page"));
const ViewSharedMapPage = lazy(() => import("./pages/view-shared-map-page"));

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={DashboardPage} />
      <ProtectedRoute path="/services" component={ServicesPage} />
      <ProtectedRoute path="/alerts" component={AlertsPage} />
      <ProtectedRoute path="/agents" component={AgentsPage} />
      <ProtectedRoute path="/history" component={HistoryPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <ProtectedRoute path="/shared-maps" component={() => (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
          <SharedMapsPage />
        </Suspense>
      )} />
      <Route path="/shared-map/:shareKey" component={() => (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
          <ViewSharedMapPage />
        </Suspense>
      )} />
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
