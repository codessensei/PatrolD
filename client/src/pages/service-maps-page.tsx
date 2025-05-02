import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Globe, Map, Share, ExternalLink, User, Check, Lock } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "../lib/queryClient";
import { ServiceMap, InsertServiceMap, InsertSharedMap, SharedMap } from "@shared/schema";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocation } from "wouter";

// Type for map items
interface MapItems {
  serviceItems: any[];
  agentItems: any[];
}

// Custom hook for fetching map items
function useMapItems(maps: ServiceMap[]) {
  const [mapItems, setMapItems] = useState<Record<number, MapItems>>({});
  
  useEffect(() => {
    const fetchItems = async () => {
      const newMapItems: Record<number, MapItems> = {};
      
      for (const map of maps) {
        try {
          const response = await fetch(`/api/service-maps/${map.id}/items`);
          if (response.ok) {
            const data = await response.json();
            newMapItems[map.id] = data;
          }
        } catch (error) {
          console.error(`Error fetching items for map ${map.id}:`, error);
        }
      }
      
      setMapItems(newMapItems);
    };
    
    if (maps && maps.length > 0) {
      fetchItems();
    }
  }, [maps]);
  
  return mapItems;
}

export default function ServiceMapsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [selectedMapForShare, setSelectedMapForShare] = useState<ServiceMap | null>(null);
  const [_, setLocation] = useLocation();
  const [newMap, setNewMap] = useState({
    name: "",
    description: "",
    isDefault: false,
    icon: "map",
    color: "#4f46e5"
  });
  
  const [newShare, setNewShare] = useState({
    title: "",
    description: "",
    isPublished: false,
    isPasswordProtected: false,
    password: "",
    serviceMapId: 0
  });

  // Fetch service maps
  const { data: serviceMaps = [], isLoading } = useQuery<ServiceMap[]>({
    queryKey: ["/api/service-maps"],
    enabled: !!user,
  });
  
  // Fetch shared maps
  const { data: sharedMaps = [], isLoading: isLoadingSharedMaps } = useQuery<SharedMap[]>({
    queryKey: ["/api/shared-maps"],
    enabled: !!user,
  });
  
  // Determine default tab based on URL hash
  const [activeTab, setActiveTab] = useState<string>(() => {
    // Check if URL contains #shared-maps
    if (typeof window !== 'undefined' && window.location.hash === '#shared-maps') {
      return 'shared-maps';
    }
    return 'service-maps';
  });
  
  // Use our custom hook to fetch map items
  const mapItems = useMapItems(serviceMaps);

  // Create new service map
  const createMapMutation = useMutation({
    mutationFn: async (data: Partial<InsertServiceMap>) => {
      const response = await apiRequest("POST", "/api/service-maps", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-maps"] });
      setIsCreateDialogOpen(false);
      setNewMap({
        name: "",
        description: "",
        isDefault: false,
        icon: "map",
        color: "#4f46e5"
      });
      toast({
        title: "Map created",
        description: "Your new service map has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create map",
        description: error.message || "An error occurred while creating the map.",
        variant: "destructive",
      });
    },
  });

  // Delete service map
  const deleteMapMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/service-maps/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-maps"] });
      toast({
        title: "Map deleted",
        description: "The service map has been deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete map",
        description: error.message || "An error occurred while deleting the map.",
        variant: "destructive",
      });
    },
  });

  // Set default map
  const setDefaultMapMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PUT", `/api/service-maps/${id}/default`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-maps"] });
      toast({
        title: "Default map updated",
        description: "Your default service map has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update default map",
        description: error.message || "An error occurred while updating the default map.",
        variant: "destructive",
      });
    },
  });

  // Go to map details
  const goToMap = (id: number) => {
    setLocation(`/service-maps/${id}`);
  };

  // Create new map
  const handleCreateMap = () => {
    createMapMutation.mutate(newMap);
  };
  
  // Create shared map
  const createShareMutation = useMutation({
    mutationFn: async (data: Partial<InsertSharedMap>) => {
      const response = await apiRequest("POST", "/api/shared-maps", data);
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shared-maps"] });
      setIsShareDialogOpen(false);
      setSelectedMapForShare(null);
      setNewShare({
        title: "",
        description: "",
        isPublished: false,
        isPasswordProtected: false,
        password: "",
        serviceMapId: 0
      });
      toast({
        title: "Map shared",
        description: "Your map has been shared successfully. You can view it in the Shared Maps section.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to share map",
        description: error.message || "An error occurred while sharing the map.",
        variant: "destructive",
      });
    },
  });
  
  // Delete shared map
  const deleteSharedMapMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/shared-maps/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shared-maps"] });
      toast({
        title: "Shared map deleted",
        description: "The shared map has been deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete shared map",
        description: error.message || "An error occurred while deleting the shared map.",
        variant: "destructive",
      });
    },
  });
  
  // Open share dialog for a specific map
  const openShareDialog = (map: ServiceMap) => {
    setSelectedMapForShare(map);
    setNewShare({
      title: `${map.name} - Shared Map`,
      description: map.description || "",
      isPublished: false,
      isPasswordProtected: false,
      password: "",
      serviceMapId: map.id
    });
    setIsShareDialogOpen(true);
  };
  
  // Handle share map
  const handleShareMap = () => {
    if (!selectedMapForShare) return;
    
    const { serviceMapId, ...shareData } = newShare;
    
    createShareMutation.mutate({
      ...shareData,
      mapData: { serviceMapId: selectedMapForShare.id }
    });
  };
  
  // View shared map
  const viewSharedMap = (shareKey: string) => {
    window.open(`/view-map/${shareKey}`, '_blank');
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 md:ml-64 relative">
        <Topbar 
          title="Service Maps" 
        />
        
        <div className="p-4 md:p-8 relative">
          {/* Dashboard Header */}
          <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold glow-text animate-gradient-text mb-2 tracking-tight">
                Service Maps
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-lg">
                Organize your services and agents into different project maps
              </p>
            </div>
            
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="glass-button flex items-center gap-2 font-medium mt-4 md:mt-0">
                  <Plus size={16} />
                  Create New Map
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create New Service Map</DialogTitle>
                  <DialogDescription>
                    Create a new map to organize your services and agents by project
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="Enter a name for your map"
                      value={newMap.name}
                      onChange={(e) => setNewMap({ ...newMap, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Input
                      id="description"
                      placeholder="Enter a description"
                      value={newMap.description || ""}
                      onChange={(e) => setNewMap({ ...newMap, description: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isDefault"
                      checked={newMap.isDefault}
                      onCheckedChange={(checked) => setNewMap({ ...newMap, isDefault: checked })}
                    />
                    <Label htmlFor="isDefault">Set as default map</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" onClick={handleCreateMap} disabled={!newMap.name}>
                    Create Map
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            {/* Share Dialog */}
            <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
              <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                  <DialogTitle>Share Service Map</DialogTitle>
                  <DialogDescription>
                    Share your service map with others to display the service status and connections
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="shareTitle">Title</Label>
                      <Input
                        id="shareTitle"
                        placeholder="Enter a title for the shared map"
                        value={newShare.title}
                        onChange={(e) => setNewShare({ ...newShare, title: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shareDescription">Description (optional)</Label>
                      <Input
                        id="shareDescription"
                        placeholder="Enter a description"
                        value={newShare.description || ""}
                        onChange={(e) => setNewShare({ ...newShare, description: e.target.value })}
                      />
                    </div>
                  </div>
                  
                  <div className="flex flex-col space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isPublished"
                        checked={newShare.isPublished}
                        onCheckedChange={(checked) => setNewShare({ ...newShare, isPublished: checked })}
                      />
                      <Label htmlFor="isPublished" className="font-medium">Publish map publicly</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      When published, this map will be listed in the public maps directory.
                    </p>
                  </div>
                  
                  <div className="flex flex-col space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isPasswordProtected"
                        checked={newShare.isPasswordProtected}
                        onCheckedChange={(checked) => setNewShare({ ...newShare, isPasswordProtected: checked })}
                      />
                      <Label htmlFor="isPasswordProtected" className="font-medium">Password protect</Label>
                    </div>
                    
                    {newShare.isPasswordProtected && (
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="Enter a password"
                          value={newShare.password || ""}
                          onChange={(e) => setNewShare({ ...newShare, password: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsShareDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    onClick={handleShareMap} 
                    disabled={!newShare.title}
                    className="gap-1"
                  >
                    <Share size={14} />
                    Share Map
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          
          {/* Tabs Navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="service-maps">Service Maps</TabsTrigger>
              <TabsTrigger value="shared-maps">Shared Maps</TabsTrigger>
            </TabsList>
            
            {/* Service Maps Tab */}
            <TabsContent value="service-maps" className="mt-6">
              <div className="glass-card p-6">
                {isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                      <Card key={i} className="animate-pulse">
                        <CardHeader className="bg-muted/30 h-32"></CardHeader>
                        <CardContent className="pt-6 space-y-3">
                          <div className="h-4 bg-muted/50 rounded"></div>
                          <div className="h-3 bg-muted/30 rounded w-3/4"></div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : serviceMaps && serviceMaps.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {serviceMaps.map((map) => (
                      <Card key={map.id} className="overflow-hidden group hover-card-effect">
                        <CardHeader className={`relative pb-4`} style={{ background: `${map.color}10` }}>
                          <div className="absolute top-3 right-3 flex gap-1">
                            {!!map.isDefault && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="p-1.5 rounded-full bg-background/80 text-green-600 dark:text-green-400">
                                      <Check size={14} />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Default Map</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <div className="flex items-center mb-2">
                            <div className="w-10 h-10 rounded-md flex items-center justify-center mr-3" 
                              style={{ background: `${map.color || '#4f46e5'}20` }}>
                              <Map className="h-5 w-5" style={{ color: map.color || '#4f46e5' }} />
                            </div>
                            <CardTitle className="text-xl">{map.name}</CardTitle>
                          </div>
                          {map.description && (
                            <CardDescription className="text-sm">
                              {map.description}
                            </CardDescription>
                          )}
                          
                          <div className="flex gap-2 mt-4">
                            {mapItems[map.id]?.serviceItems && (
                              <Badge variant="secondary" className="flex items-center gap-1.5">
                                <Globe className="h-3 w-3" />
                                {mapItems[map.id].serviceItems.length} services
                              </Badge>
                            )}
                            
                            {mapItems[map.id]?.agentItems && (
                              <Badge variant="outline" className="flex items-center gap-1.5">
                                <User className="h-3 w-3" />
                                {mapItems[map.id].agentItems.length} agents
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="pt-4 pb-2">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-3">
                              <Button 
                                onClick={() => goToMap(map.id)}
                                variant="default" 
                                className="w-full" 
                                size="sm"
                              >
                                View Map
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="pt-0">
                          <div className="flex w-full justify-between text-sm">
                            <div className="flex gap-3">
                              {!map.isDefault && (
                                <button 
                                  onClick={() => setDefaultMapMutation.mutate(map.id)}
                                  className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors flex items-center gap-1"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  <span>Set default</span>
                                </button>
                              )}
                            </div>
                            <div className="flex gap-3">
                              <button 
                                onClick={() => openShareDialog(map)}
                                className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors flex items-center gap-1"
                              >
                                <Share className="h-3.5 w-3.5" />
                                <span>Share</span>
                              </button>
                              
                              {serviceMaps.length > 1 && !map.isDefault && (
                                <button 
                                  onClick={() => deleteMapMutation.mutate(map.id)}
                                  className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors flex items-center gap-1"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center my-12">
                    <div className="mx-auto w-16 h-16 bg-muted/30 flex items-center justify-center rounded-full mb-4">
                      <Map className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-medium mb-2">No service maps yet</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      Create a service map to organize your services and agents into different project views
                    </p>
                    <Button 
                      onClick={() => setIsCreateDialogOpen(true)}
                      className="glass-button gap-1"
                    >
                      <Plus size={16} />
                      Create Your First Map
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
            
            {/* Shared Maps Tab */}
            <TabsContent value="shared-maps" className="mt-6">
              <div className="glass-card p-6">
                {isLoadingSharedMaps ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                      <Card key={i} className="animate-pulse">
                        <CardHeader className="bg-muted/30 h-32"></CardHeader>
                        <CardContent className="pt-6 space-y-3">
                          <div className="h-4 bg-muted/50 rounded"></div>
                          <div className="h-3 bg-muted/30 rounded w-3/4"></div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : sharedMaps && sharedMaps.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sharedMaps.map((map) => (
                      <Card key={map.id} className="overflow-hidden group hover-card-effect">
                        <CardHeader className="relative pb-4 bg-gradient-to-br from-slate-200/10 to-slate-300/10 dark:from-slate-800/10 dark:to-slate-900/10">
                          <div className="absolute top-3 right-3 flex gap-1">
                            {map.isPublished && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="p-1.5 rounded-full bg-background/80 text-green-600 dark:text-green-400">
                                      <Globe size={14} />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Public Map</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {map.isPasswordProtected && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="p-1.5 rounded-full bg-background/80 text-amber-600 dark:text-amber-400">
                                      <Lock size={14} />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Password Protected</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <div className="flex items-center mb-2">
                            <div className="w-10 h-10 rounded-md flex items-center justify-center mr-3 bg-slate-200/20 dark:bg-slate-800/20">
                              <Share size={18} className="text-primary" />
                            </div>
                            <CardTitle className="text-xl">{map.title}</CardTitle>
                          </div>
                          {map.description && (
                            <CardDescription className="text-sm">
                              {map.description}
                            </CardDescription>
                          )}
                          
                          <div className="flex gap-2 mt-4">
                            <Badge variant="secondary" className="flex items-center gap-1.5">
                              <Share className="h-3 w-3" />
                              Share key: {map.shareKey.substring(0, 6)}...
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-4 pb-2">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-3">
                              <Button 
                                onClick={() => viewSharedMap(map.shareKey)}
                                variant="default" 
                                className="w-full flex items-center gap-2" 
                                size="sm"
                              >
                                <ExternalLink size={14} />
                                View Shared Map
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="pt-0">
                          <div className="flex w-full justify-end text-sm">
                            <button 
                              onClick={() => deleteSharedMapMutation.mutate(map.id)}
                              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors flex items-center gap-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center my-12">
                    <div className="mx-auto w-16 h-16 bg-muted/30 flex items-center justify-center rounded-full mb-4">
                      <Share className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-medium mb-2">No shared maps yet</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      Share your service maps with others by going to a map and clicking the "Share" button
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}