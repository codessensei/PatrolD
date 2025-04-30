import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { Eye, Lock, Share2, Trash2, ListX, PlusCircle, CheckCircle2, Copy, Globe, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Layout from "@/components/layout";

interface SharedMap {
  id: number;
  userId: number;
  title: string;
  description: string | null;
  isPublished: boolean;
  isPasswordProtected: boolean;
  password: string | null;
  shareKey: string;
  viewCount: number;
  mapData: any;
  createdAt: string;
  updatedAt: string;
}

// Form validation schema
const createMapSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters long" }),
  description: z.string().optional(),
  password: z.string().optional(),
  isPasswordProtected: z.boolean().default(false),
  isPublished: z.boolean().default(true),
});

type CreateMapFormData = z.infer<typeof createMapSchema>;

const SharedMapsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedMap, setSelectedMap] = useState<SharedMap | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [publicShareUrl, setPublicShareUrl] = useState("");
  const [copiedText, setCopiedText] = useState<string | null>(null);
  
  const { register, handleSubmit, watch, reset, setValue, formState: { errors, isSubmitting } } = useForm<CreateMapFormData>({
    defaultValues: {
      title: "",
      description: "",
      password: "",
      isPasswordProtected: false,
      isPublished: false
    }
  });
  
  const isPasswordProtected = watch("isPasswordProtected");
  
  // Fetch user's shared maps
  const {
    data: sharedMaps,
    isLoading,
    error
  } = useQuery<SharedMap[]>({
    queryKey: ["/api/shared-maps"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/shared-maps");
      return response.json();
    }
  });
  
  // Create new map mutation
  const createMapMutation = useMutation({
    mutationFn: async (data: any) => {
      const services = await queryClient.fetchQuery({
        queryKey: ["/api/services"],
        queryFn: async () => {
          const response = await apiRequest("GET", "/api/services");
          return response.json();
        }
      });
      
      const connections = await queryClient.fetchQuery({
        queryKey: ["/api/connections"],
        queryFn: async () => {
          const response = await apiRequest("GET", "/api/connections");
          return response.json();
        }
      });
      
      // Create map data with current services and connections
      const mapData = {
        services: services,
        connections: connections
      };
      
      // Prepare final data for API
      const finalData = {
        ...data,
        mapData
      };
      
      // If not password protected, remove password field
      if (!finalData.isPasswordProtected) {
        delete finalData.password;
      }
      
      const response = await apiRequest("POST", "/api/shared-maps", finalData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Map created successfully",
        variant: "default"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/shared-maps"] });
      setIsCreateDialogOpen(false);
      reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create map",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Delete map mutation
  const deleteMapMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/shared-maps/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Map deleted successfully",
        variant: "default"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/shared-maps"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete map",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Publish map mutation
  const publishMapMutation = useMutation({
    mutationFn: async ({ id, publish }: { id: number; publish: boolean }) => {
      const response = await apiRequest("PUT", `/api/shared-maps/${id}/publish`, { publish });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Map publishing status updated",
        variant: "default"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/shared-maps"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update publishing status",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const onSubmit = (data: CreateMapFormData) => {
    createMapMutation.mutate(data);
  };
  
  const handlePublish = (id: number, publish: boolean) => {
    publishMapMutation.mutate({ id, publish });
  };
  
  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this map? This action cannot be undone.")) {
      deleteMapMutation.mutate(id);
    }
  };
  
  const handleShare = (map: SharedMap) => {
    setSelectedMap(map);
    const host = window.location.host;
    const protocol = window.location.protocol;
    setPublicShareUrl(`${protocol}//${host}/map/${map.shareKey}`);
    setIsShareDialogOpen(true);
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied!",
        description: "Share link copied to clipboard",
        variant: "default"
      });
    });
  };
  
  return (
    <Layout>
      <div className="container mx-auto p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold">PatrolD - Shared Maps</h1>
            <p className="text-muted-foreground">Create and manage shareable service maps</p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Map
          </Button>
        </div>
      
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="shadow-md">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-3 w-full mb-2" />
                <Skeleton className="h-3 w-5/6" />
              </CardContent>
              <CardFooter className="flex justify-between">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center p-10 border rounded-lg bg-background">
          <X className="h-16 w-16 text-destructive mb-4" />
          <h3 className="text-lg font-semibold">Error Loading Maps</h3>
          <p className="text-center text-muted-foreground mt-2">
            We couldn't load your shared maps. Please try again later.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/shared-maps"] })}>
            Retry
          </Button>
        </div>
      ) : sharedMaps?.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-10 border rounded-lg bg-background">
          <ListX className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No Maps Yet</h3>
          <p className="text-center text-muted-foreground mt-2">
            You haven't created any shared maps yet. Create one to share your service topology.
          </p>
          <Button className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
            Create Your First Map
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {sharedMaps?.map((map) => (
            <Card key={map.id} className={cn("shadow-md transition-all duration-200", 
              map.isPublished ? "border-green-500/20" : "")}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle>{map.title}</CardTitle>
                  <div className="flex space-x-1">
                    {map.isPasswordProtected && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20">
                            <Lock className="h-3 w-3 mr-1" />
                            Protected
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>Password protected map</TooltipContent>
                      </Tooltip>
                    )}
                    {map.isPublished ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="bg-green-500/10 text-green-500 hover:bg-green-500/20">
                            <Globe className="h-3 w-3 mr-1" />
                            Published
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>This map is publicly accessible</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="bg-gray-500/10 text-gray-500">
                            Private
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>Only you can see this map</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
                <CardDescription className="line-clamp-2">
                  {map.description || "No description provided"}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="flex items-center text-xs text-muted-foreground">
                  <Eye className="h-3 w-3 mr-1" /> {map.viewCount} views
                  <span className="mx-2">•</span>
                  Created {new Date(map.createdAt).toLocaleDateString()}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between pt-2">
                <Button
                  variant={map.isPublished ? "destructive" : "default"}
                  size="sm"
                  onClick={() => handlePublish(map.id, !map.isPublished)}
                >
                  {map.isPublished ? "Unpublish" : "Publish"}
                </Button>
                
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleShare(map)}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(map.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Create Map Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Map</DialogTitle>
            <DialogDescription>
              Create a shareable map from your current services and connections.
              You can publish it later.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="My Service Map"
                  {...register("title", { required: "Title is required" })}
                />
                {errors.title && (
                  <p className="text-sm text-destructive">{errors.title.message}</p>
                )}
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what this map represents..."
                  {...register("description")}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="isPublished"
                  checked={watch("isPublished")}
                  onCheckedChange={(checked) => setValue("isPublished", checked)}
                />
                <Label htmlFor="isPublished">Publish immediately</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="isPasswordProtected"
                  checked={isPasswordProtected}
                  onCheckedChange={(checked) => setValue("isPasswordProtected", checked)}
                />
                <Label htmlFor="isPasswordProtected">Password protect</Label>
              </div>
              
              {isPasswordProtected && (
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    {...register("password", {
                      required: isPasswordProtected ? "Password is required" : false,
                      minLength: {
                        value: 4,
                        message: "Password must be at least 4 characters"
                      }
                    })}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password.message}</p>
                  )}
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Map"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Share Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Share Map</DialogTitle>
            <DialogDescription>
              {selectedMap?.isPublished
                ? "Your map is published. Share the link below with others."
                : "This map is not published yet. Publish it to make it accessible with this link."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Public Share Link</Label>
              <div className="flex items-center">
                <Input
                  value={publicShareUrl}
                  readOnly
                  className={selectedMap?.isPublished ? "" : "opacity-50"}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="ml-2"
                  onClick={() => copyToClipboard(publicShareUrl)}
                  disabled={!selectedMap?.isPublished}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {!selectedMap?.isPublished && (
                <p className="text-sm text-muted-foreground mt-1">
                  This link will be active once you publish the map.
                </p>
              )}
            </div>
            
            {selectedMap?.isPasswordProtected && (
              <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md flex items-start border border-amber-200 dark:border-amber-800">
                <Lock className="h-5 w-5 text-amber-500 mr-2 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Password Protected</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">Viewers will need to enter a password to access this map.</p>
                </div>
              </div>
            )}
            
            {!selectedMap?.isPublished && (
              <Button
                onClick={() => {
                  if (selectedMap) {
                    handlePublish(selectedMap.id, true);
                    setIsShareDialogOpen(false);
                  }
                }}
              >
                Publish Now
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SharedMapsPage;