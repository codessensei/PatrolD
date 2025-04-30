import { useState } from "react";
import { Plus, Pencil, Trash2, Globe, Map, Share, ExternalLink, User, Check, Lock } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "../lib/queryClient";

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

// ServiceMap türünü tanımlayalım
type ServiceMap = {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  isDefault: boolean;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
};

export default function ServiceMapsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [_, setLocation] = useLocation();
  const [newMap, setNewMap] = useState({
    name: "",
    description: "",
    isDefault: false,
    icon: "map",
    color: "#4f46e5"
  });

  // Kullanıcının haritalarını getir
  const { data: serviceMaps, isLoading } = useQuery<ServiceMap[]>({
    queryKey: ["/api/service-maps"],
    enabled: !!user,
  });

  // Yeni harita oluştur
  const createMapMutation = useMutation({
    mutationFn: async (data: any) => {
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

  // Harita sil
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

  // Haritayı varsayılan olarak işaretle
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

  // Haritaya git
  const goToMap = (id: number) => {
    setLocation(`/service-maps/${id}`);
  };

  // Yeni harita oluştur
  const handleCreateMap = () => {
    createMapMutation.mutate(newMap);
  };

  return (
    <div className="container py-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Service Maps</h1>
          <p className="text-muted-foreground mt-1">
            Organize your services and agents into different project maps
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
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
      </div>
      
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
            <Card key={map.id} className="overflow-hidden group">
              <CardHeader className={`relative pb-4`} style={{ background: `${map.color}10` }}>
                <div className="absolute top-3 right-3 flex gap-1">
                  {map.isDefault && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="p-1.5 rounded-full bg-background/80 text-green-600 dark:text-green-400">
                            <Check size={14} />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          Default Map
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>

                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center`} style={{ background: map.color }}>
                    <Map className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{map.name}</CardTitle>
                    <CardDescription>
                      {map.description || "No description"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex justify-between items-center mb-3">
                  <Badge variant="outline" className="gap-1">
                    <User size={12} className="opacity-70" />
                    <span className="text-xs">Creator</span>
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Created {new Date(map.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t p-4">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 h-8"
                    onClick={() => goToMap(map.id)}
                  >
                    <Map size={14} />
                    View
                  </Button>
                  {!map.isDefault && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 h-8"
                      onClick={() => setDefaultMapMutation.mutate(map.id)}
                    >
                      <Check size={14} />
                      Set Default
                    </Button>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1 h-8"
                  onClick={() => deleteMapMutation.mutate(map.id)}
                  disabled={map.isDefault}
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
          <Map className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-medium mb-2">No Service Maps Yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Create service maps to organize your services and agents by project.
            Each map can contain different services and agents.
          </p>
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            className="mx-auto"
          >
            Create Your First Map
          </Button>
        </div>
      )}
    </div>
  );
}