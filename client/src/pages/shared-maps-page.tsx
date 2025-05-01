import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Share, Eye, Lock, Globe, Trash2, Plus, Copy, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

// Type definitions
type SharedMap = {
  id: number;
  userId: number;
  title: string;
  description: string | null;
  isPublished: boolean;
  isPasswordProtected: boolean;
  password: string | null;
  shareKey: string;
  viewCount: number;
  mapData: any; // Service and connections data
  createdAt: string;
  updatedAt: string;
};

export default function SharedMapsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newMap, setNewMap] = useState({
    title: "",
    description: "",
    isPublished: false,
    isPasswordProtected: false,
    password: "",
    serviceMapId: "" // Ekledik - bir harita seçmek için
  });

  // Fetch user's shared maps
  const { data: sharedMaps = [], isLoading } = useQuery<SharedMap[]>({
    queryKey: ["/api/shared-maps"],
    enabled: !!user,
  });

  // Fetch public shared maps
  const { data: publicMaps = [], isLoading: isLoadingPublic } = useQuery<SharedMap[]>({
    queryKey: ["/api/shared-maps/public"],
  });

  // Create a new shared map
  const createMapMutation = useMutation({
    mutationFn: async (mapData: typeof newMap) => {
      const response = await apiRequest("POST", "/api/shared-maps", mapData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shared-maps"] });
      setIsCreateDialogOpen(false);
      setNewMap({
        title: "",
        description: "",
        isPublished: false,
        isPasswordProtected: false,
        password: ""
      });
      toast({
        title: "Success",
        description: "Map created and shared successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to create map: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Delete a shared map
  const deleteMapMutation = useMutation({
    mutationFn: async (mapId: number) => {
      await apiRequest("DELETE", `/api/shared-maps/${mapId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shared-maps"] });
      toast({
        title: "Success",
        description: "Map deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to delete map: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Toggle publish status
  const togglePublishMutation = useMutation({
    mutationFn: async ({ mapId, isPublished }: { mapId: number, isPublished: boolean }) => {
      const response = await apiRequest("PUT", `/api/shared-maps/${mapId}`, {
        isPublished
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shared-maps"] });
      toast({
        title: "Success",
        description: "Map visibility updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to update map: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const handleCreateMap = () => {
    if (!newMap.title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a title for your map",
        variant: "destructive",
      });
      return;
    }

    if (newMap.isPasswordProtected && !newMap.password) {
      toast({
        title: "Error",
        description: "Please provide a password or disable password protection",
        variant: "destructive",
      });
      return;
    }

    createMapMutation.mutate(newMap);
  };

  const copyShareLink = (shareKey: string) => {
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/view-map/${shareKey}`;
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: "Link Copied",
      description: "Share link copied to clipboard",
    });
  };
  
  const openMapInNewTab = (shareKey: string) => {
    window.open(`/view-map/${shareKey}`, '_blank');
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 md:ml-64 relative">
        <Topbar title="Shared Maps" />
        
        <div className="p-4 md:p-8 relative">
          {/* Header */}
          <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold glow-text animate-gradient-text mb-2 tracking-tight">
                Shared Maps
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-lg">
                Create and share visual maps of your services topology
              </p>
            </div>
            
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="glass-button flex items-center gap-2 font-medium mt-4 md:mt-0">
                  <Plus size={16} />
                  Create New Shared Map
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Share Your Service Topology</DialogTitle>
                  <DialogDescription>
                    Create a shareable view of your current services and connections
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      placeholder="Enter a title for your map"
                      value={newMap.title}
                      onChange={(e) => setNewMap({ ...newMap, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Enter a description"
                      className="resize-none"
                      rows={3}
                      value={newMap.description}
                      onChange={(e) => setNewMap({ ...newMap, description: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is-published"
                      checked={newMap.isPublished}
                      onCheckedChange={(checked) => 
                        setNewMap({ ...newMap, isPublished: checked as boolean })
                      }
                    />
                    <label
                      htmlFor="is-published"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Publish to Public Gallery
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is-password-protected"
                      checked={newMap.isPasswordProtected}
                      onCheckedChange={(checked) => 
                        setNewMap({ ...newMap, isPasswordProtected: checked as boolean })
                      }
                    />
                    <label
                      htmlFor="is-password-protected"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Password Protect
                    </label>
                  </div>
                  {newMap.isPasswordProtected && (
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Enter password for protection"
                        value={newMap.password}
                        onChange={(e) => setNewMap({ ...newMap, password: e.target.value })}
                      />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateMap}
                    disabled={createMapMutation.isPending}
                  >
                    {createMapMutation.isPending ? "Creating..." : "Create & Share"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Main Content */}
          <div className="glass-card p-6">
            <Tabs defaultValue="my-maps" className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="my-maps">My Maps</TabsTrigger>
                <TabsTrigger value="public-maps">Public Gallery</TabsTrigger>
              </TabsList>
              
              <TabsContent value="my-maps">
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
                ) : sharedMaps.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sharedMaps.map((map) => (
                      <Card key={map.id} className="overflow-hidden group hover-card-effect">
                        <CardHeader className="relative bg-gradient-to-r from-primary/20 to-primary/5 pb-4">
                          <div className="absolute top-3 right-3 flex gap-1">
                            {map.isPasswordProtected && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="p-1.5 rounded-full bg-background/80 text-primary">
                                      <Lock size={14} />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Password Protected</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {map.isPublished && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="p-1.5 rounded-full bg-background/80 text-primary">
                                      <Globe size={14} />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Publicly Available</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <CardTitle className="text-lg">{map.title}</CardTitle>
                          <CardDescription className="line-clamp-2">
                            {map.description || "No description provided"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <div className="text-sm text-muted-foreground">
                            <div className="flex justify-between">
                              <span>Created</span>
                              <span>
                                {map.createdAt ? format(new Date(map.createdAt), 'MMM d, yyyy') : 'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between mt-1">
                              <span>Views</span>
                              <span className="font-medium">{map.viewCount}</span>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="flex flex-wrap gap-2 justify-between border-t pt-4">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 h-8"
                              onClick={() => copyShareLink(map.shareKey)}
                            >
                              <Copy size={14} />
                              Share
                            </Button>
                            <Button
                              size="sm"
                              variant={map.isPublished ? "default" : "outline"}
                              className="gap-1 h-8"
                              onClick={() => togglePublishMutation.mutate({ 
                                mapId: map.id, 
                                isPublished: !map.isPublished 
                              })}
                            >
                              {map.isPublished ? (
                                <>
                                  <Globe size={14} />
                                  Public
                                </>
                              ) : (
                                <>
                                  <Globe size={14} />
                                  Publish
                                </>
                              )}
                            </Button>
                          </div>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1 h-8"
                            onClick={() => deleteMapMutation.mutate(map.id)}
                          >
                            <Trash2 size={14} />
                            Delete
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-card/50 rounded-lg">
                    <Share className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <h3 className="text-lg font-medium mb-2">No Shared Maps Yet</h3>
                    <p className="text-muted-foreground max-w-md mx-auto mb-6">
                      Share your service topology with others by creating a new map.
                      You can password protect it or make it public.
                    </p>
                    <Button 
                      onClick={() => setIsCreateDialogOpen(true)}
                      className="mx-auto glass-button"
                    >
                      Create Your First Map
                    </Button>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="public-maps">
                {isLoadingPublic ? (
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
                ) : publicMaps.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {publicMaps.map((map) => (
                      <Card key={map.id} className="overflow-hidden hover-card-effect">
                        <CardHeader className="bg-gradient-to-r from-primary/20 to-primary/5 pb-4">
                          <div className="absolute top-3 right-3 flex gap-1">
                            {map.isPasswordProtected && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="p-1.5 rounded-full bg-background/80 text-primary">
                                      <Lock size={14} />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Password Required</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <CardTitle className="text-lg">{map.title}</CardTitle>
                          <CardDescription className="line-clamp-2">
                            {map.description || "No description provided"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <div className="text-sm text-muted-foreground">
                            <div className="flex justify-between">
                              <span>Published</span>
                              <span>
                                {map.createdAt ? format(new Date(map.createdAt), 'MMM d, yyyy') : 'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between mt-1">
                              <span>Views</span>
                              <span className="font-medium">{map.viewCount}</span>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="flex justify-between border-t pt-4">
                          <Button
                            size="sm"
                            variant="default"
                            className="w-full gap-1 h-8"
                            onClick={() => openMapInNewTab(map.shareKey)}
                          >
                            <ExternalLink size={14} />
                            Open in New Tab
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-card/50 rounded-lg">
                    <Globe className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <h3 className="text-lg font-medium mb-2">No Public Maps Available</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      When users publish their maps, they will appear here for everyone to view.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}