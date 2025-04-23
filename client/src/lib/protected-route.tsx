import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  console.log("ProtectedRoute rendering for path:", path);
  const { user, isLoading, error } = useAuth();
  
  console.log("ProtectedRoute auth state:", { user, isLoading, error });

  if (isLoading) {
    console.log("ProtectedRoute: Auth is loading, showing spinner");
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!user) {
    console.log("ProtectedRoute: No user, redirecting to /auth");
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  console.log("ProtectedRoute: User authenticated, rendering component");
  return <Route path={path} component={Component} />;
}
