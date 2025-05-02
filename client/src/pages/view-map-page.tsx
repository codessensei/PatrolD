import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, AlertTriangle, Clock, Eye, Server, Network } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import ServiceCanvas from "@/components/dashboard/service-canvas";

export default function ViewMapPage() {
  const [password, setPassword] = useState("");
  const { shareKey } = useParams();
  const [, setLocation] = useLocation();
  const [isPasswordError, setIsPasswordError] = useState(false);

  const { 
    data: mapData, 
    isLoading, 
    isError, 
    error,
    refetch 
  } = useQuery({
    queryKey: ["/api/view-map", shareKey],
    queryFn: async () => {
      if (!shareKey) {
        throw new Error("Missing share key");
      }
      
      console.log("Fetching map data for shareKey:", shareKey);
      const url = password 
        ? `/api/view-map/${shareKey}?password=${encodeURIComponent(password)}` 
        : `/api/view-map/${shareKey}`;
      
      try {
        const response = await apiRequest("GET", url);
        const data = await response.json();
        console.log("Map data received:", data);
        return data;
      } catch (err) {
        console.error("Error fetching map data:", err);
        throw err;
      }
    },
    retry: false,
    enabled: !!shareKey
  });

  const isPasswordProtected = useMemo(() => {
    return mapData?.isPasswordProtected && !mapData?.mapData;
  }, [mapData]);

  const handleSubmitPassword = () => {
    setIsPasswordError(false);
    refetch();
  };

  useEffect(() => {
    // Handle password error
    if (mapData?.error === "Invalid password") {
      setIsPasswordError(true);
    }
  }, [mapData]);

  if (isLoading) {
    return (
      <div className="container py-12">
        <Card className="max-w-3xl mx-auto animate-pulse">
          <CardHeader className="bg-muted/30 h-32"></CardHeader>
          <CardContent className="h-[400px] flex items-center justify-center">
            <div className="space-y-4 w-full">
              <div className="h-5 bg-muted/50 rounded w-3/4 mx-auto"></div>
              <div className="h-4 bg-muted/30 rounded w-1/2 mx-auto"></div>
              <div className="h-24 bg-muted/20 rounded-lg w-full mt-8"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container py-12">
        <Alert variant="destructive" className="max-w-3xl mx-auto">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {(error as any)?.message || "Failed to load the shared map. It may have been deleted or the link is invalid."}
          </AlertDescription>
        </Alert>
        <div className="mt-6 text-center">
          <Button variant="outline" onClick={() => setLocation("/")}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!mapData) {
    return (
      <div className="container py-12">
        <Alert className="max-w-3xl mx-auto">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>
            The shared map could not be found. It may have been deleted or the link is invalid.
          </AlertDescription>
        </Alert>
        <div className="mt-6 text-center">
          <Button variant="outline" onClick={() => setLocation("/")}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (isPasswordProtected) {
    return (
      <div className="container py-12">
        <Card className="max-w-md mx-auto border-primary/20">
          <CardHeader className="bg-gradient-to-r from-primary/20 to-primary/5 pb-6">
            <div className="mx-auto bg-background/80 p-3 w-14 h-14 flex items-center justify-center rounded-full mb-3">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-center text-xl">{mapData.title}</CardTitle>
            <CardDescription className="text-center">
              {mapData.description || "No description provided"}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="text-center text-sm text-muted-foreground mb-2">
              <p>This map is password protected</p>
              <div className="flex justify-center items-center gap-1 mt-1">
                <Eye className="h-3 w-3" />
                <span>{mapData.viewCount || 0} views</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">
                  Enter Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter map password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={isPasswordError ? "border-destructive" : ""}
                />
                {isPasswordError && (
                  <p className="text-xs text-destructive">Incorrect password</p>
                )}
              </div>
              <Button className="w-full" onClick={handleSubmitPassword}>
                View Map
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t pt-4 text-xs text-muted-foreground">
            <div>Created: {format(new Date(mapData.createdAt), "MMM d, yyyy")}</div>
            <div>Updated: {format(new Date(mapData.updatedAt), "MMM d, yyyy")}</div>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Successfully loaded map with data
  return (
    <div className="w-full min-h-screen overflow-hidden animate-fadeIn flex flex-col">
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 shadow-sm">
        <div className="container mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold">{mapData.title}</h1>
            <p className="text-muted-foreground">
              {mapData.description || "No description provided"}
            </p>
          </div>
          <div className="flex items-center space-x-6 text-sm">
            <div className="flex items-center">
              <Server className="mr-1.5 h-4 w-4 text-muted-foreground" />
              <span>{mapData.mapData?.services?.length || 0} Services</span>
            </div>
            <div className="flex items-center">
              <Network className="mr-1.5 h-4 w-4 text-muted-foreground" />
              <span>{mapData.mapData?.connections?.length || 0} Connections</span>
            </div>
            <div className="flex items-center">
              <Eye className="mr-1.5 h-4 w-4 text-muted-foreground" />
              <span>{mapData.viewCount} Views</span>
            </div>
            <div className="flex items-center">
              <Clock className="mr-1.5 h-4 w-4 text-muted-foreground" />
              <span>{format(new Date(mapData.updatedAt), "MMM d, yyyy")}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Render service map visualization using ServiceCanvas - Full screen */}
      <div className="flex-grow relative h-[calc(100vh-12rem)] w-full overflow-hidden">
        {mapData?.mapData?.services && mapData?.mapData?.connections && (
          <ServiceCanvas 
            services={mapData.mapData.services} 
            connections={mapData.mapData.connections}
            agents={[]}
            onAddService={() => {}} // Empty function since this is view-only mode
            isLoading={false}
          />
        )}
      </div>
      
      <div className="py-3 bg-background w-full border-t border-border/30">
        <div className="container mx-auto flex justify-center">
          <Button variant="outline" onClick={() => setLocation("/")}>
            Return to Dashboard
          </Button>
        </div>
      </div>
      
      {/* Services and connections sections moved below map */}
      <div className="container mx-auto py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Services</CardTitle>
              <CardDescription>
                Services included in this network map
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mapData.mapData?.services?.length > 0 ? (
                <div className="space-y-4">
                  {mapData.mapData.services.map((service: any) => (
                    <div key={service.id} className="flex items-center justify-between border-b pb-3">
                      <div>
                        <div className="font-medium">{service.name}</div>
                        <div className="text-sm text-muted-foreground">{service.host}:{service.port}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`px-2 py-1 rounded-full text-xs ${
                          service.status === "online" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                          service.status === "offline" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" :
                          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                        }`}>
                          {service.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No services in this map
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Connections</CardTitle>
              <CardDescription>
                Connections between services
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mapData.mapData?.connections?.length > 0 ? (
                <div className="space-y-4">
                  {mapData.mapData.connections.map((connection: any) => {
                    const source = mapData.mapData.services.find((s: any) => s.id === connection.sourceId);
                    const target = mapData.mapData.services.find((s: any) => s.id === connection.targetId);
                    
                    return (
                      <div key={connection.id} className="flex items-center justify-between border-b pb-3">
                        <div>
                          <div className="font-medium">
                            {source?.name || 'Unknown'} → {target?.name || 'Unknown'}
                          </div>
                          <div className="text-sm text-muted-foreground">Connection ID: {connection.id}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`px-2 py-1 rounded-full text-xs ${
                            connection.status === "online" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                            connection.status === "offline" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" :
                            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                          }`}>
                            {connection.status}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No connections in this map
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}