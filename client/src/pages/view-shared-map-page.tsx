import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { Eye, Lock, AlertTriangle, Globe, Loader2 } from "lucide-react";
import { useParams, useLocation } from "wouter";
import { ThemeToggleProvider, ThemeProvider } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SharedMap {
  id: number;
  title: string;
  description: string | null;
  isPasswordProtected: boolean;
  requiresPassword?: boolean;
  viewCount: number;
  shareKey: string;
  mapData?: any;
  createdAt: string;
  updatedAt: string;
}

const ViewSharedMapPage = () => {
  const { shareKey } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Fetch shared map data
  const {
    data: map,
    isLoading,
    error,
    refetch
  } = useQuery<SharedMap>({
    queryKey: ["/api/public/shared-maps", shareKey],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/public/shared-maps/${shareKey}`);
      const data = await response.json();
      
      // If map requires password, open password dialog
      if (data.requiresPassword) {
        setIsPasswordDialogOpen(true);
      }
      
      return data;
    }
  });

  const verifyPassword = async () => {
    if (!password.trim()) {
      return toast({
        title: "Password Required",
        description: "Please enter the password to view this map",
        variant: "destructive"
      });
    }
    
    setIsVerifying(true);
    
    try {
      const response = await apiRequest("POST", `/api/public/shared-maps/${shareKey}/verify-password`, {
        password
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.verified) {
          setIsPasswordDialogOpen(false);
          // Refetch the map with the password verified flag
          refetch();
          toast({
            title: "Success",
            description: "Password verified. Viewing map.",
            variant: "default"
          });
        }
      } else {
        const errorData = await response.json();
        toast({
          title: "Verification Failed",
          description: errorData.error || "Invalid password",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to verify password. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <h2 className="text-xl font-semibold">Loading Shared Map</h2>
        <p className="text-muted-foreground">Please wait while we load the map data...</p>
      </div>
    );
  }

  if (error || !map) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Map Not Found</h2>
        <p className="text-muted-foreground text-center max-w-md mb-6">
          This map may have been deleted or is no longer available.
        </p>
        <Button onClick={() => setLocation("/")}>Return to Dashboard</Button>
      </div>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ThemeToggleProvider>
        <div className="min-h-screen bg-background">
          <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm p-4 sticky top-0 z-10">
            <div className="container mx-auto flex flex-col md:flex-row justify-between items-start md:items-center">
              <div>
                <h1 className="text-2xl font-bold">{map.title}</h1>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <span className="flex items-center">
                    <Eye className="h-3.5 w-3.5 mr-1" /> {map.viewCount} views
                  </span>
                  <span className="flex items-center">
                    <Globe className="h-3.5 w-3.5 mr-1" /> Public Map
                  </span>
                  {map.isPasswordProtected && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20">
                      <Lock className="h-3 w-3 mr-1" />
                      Protected
                    </Badge>
                  )}
                </div>
              </div>
              <div className="mt-4 md:mt-0">
                <Button variant="outline" size="sm" onClick={() => setLocation("/")}>
                  Back to Dashboard
                </Button>
              </div>
            </div>
          </header>

          <main className="container mx-auto p-4">
            {map.description && (
              <Card className="mb-6 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Map Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{map.description}</p>
                </CardContent>
              </Card>
            )}

            {map.mapData ? (
              <div className="bg-card border rounded-lg shadow-md p-4 flex-1 min-h-[500px]">
                {/* Here we would render the actual service map visualization */}
                <div className="text-center p-8 border-2 border-dashed border-border/50 rounded-lg">
                  <p className="text-xl font-medium mb-2">Map Visualization</p>
                  <p className="text-muted-foreground">
                    Service map visualization would be rendered here, based on the map data.
                  </p>
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
                  <h2 className="text-xl font-semibold mb-2">Map Data Not Available</h2>
                  <p className="text-muted-foreground">
                    This map may require a password to view the content. Please verify your access.
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="text-center text-xs text-muted-foreground mt-6">
              Map created on {new Date(map.createdAt).toLocaleDateString()} • Last updated on {new Date(map.updatedAt).toLocaleDateString()}
            </div>
          </main>

          {/* Password Dialog */}
          <Dialog open={isPasswordDialogOpen} onOpenChange={(open) => {
            // If trying to close and map requires password, prevent closing
            if (!open && map.requiresPassword) {
              return;
            }
            setIsPasswordDialogOpen(open);
          }}>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Password Protected Map</DialogTitle>
                <DialogDescription>
                  This map is password protected. Please enter the password to view it.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="off"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        verifyPassword();
                      }
                    }}
                    placeholder="Enter password"
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button onClick={verifyPassword} disabled={isVerifying}>
                  {isVerifying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying
                    </>
                  ) : "Access Map"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </ThemeToggleProvider>
    </ThemeProvider>
  );
};

export default ViewSharedMapPage;