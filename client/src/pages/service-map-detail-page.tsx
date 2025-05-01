import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "../lib/queryClient";
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
import { 
  Plus, 
  Pencil, 
  Trash2, 
  ArrowLeft, 
  Server, 
  Cpu, 
  Check, 
  Clipboard, 
  Share,
  Divide 
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ServiceCanvas from "@/components/dashboard/service-canvas";
import { ServiceMap, Service, Agent } from "@shared/schema";

export default function ServiceMapDetailPage() {
  const { id } = useParams();
  const mapId = parseInt(id as string);
  const { user } = useAuth();
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  const [isAddServiceDialogOpen, setIsAddServiceDialogOpen] = useState(false);
  const [isAddAgentDialogOpen, setIsAddAgentDialogOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<number | undefined>(undefined);
  const [selectedAgentId, setSelectedAgentId] = useState<number | undefined>(undefined);

  // Harita detaylarını getir
  const { data: map, isLoading: isMapLoading } = useQuery<ServiceMap>({
    queryKey: [`/api/service-maps/${mapId}`],
    enabled: !!user && !!mapId,
  });

  // Haritadaki servisleri getir
  const { data: mapServices, isLoading: isServicesLoading } = useQuery<Service[]>({
    queryKey: [`/api/service-maps/${mapId}/services`],
    enabled: !!user && !!mapId,
  });

  // Haritada olmayan servisleri getir
  const { data: availableServices, isLoading: isAvailableServicesLoading } = useQuery<Service[]>({
    queryKey: [`/api/service-maps/${mapId}/available-services`],
    enabled: !!user && !!mapId && isAddServiceDialogOpen,
  });

  // Kullanıcının tüm ajanlarını getir
  const { data: availableAgents, isLoading: isAvailableAgentsLoading } = useQuery<Agent[]>({
    queryKey: [`/api/agents`],
    enabled: !!user && isAddAgentDialogOpen,
  });

  // Haritadaki ajanları getir
  const { data: mapAgents, isLoading: isAgentsLoading } = useQuery<Agent[]>({
    queryKey: [`/api/service-maps/${mapId}/agents`],
    enabled: !!user && !!mapId,
  });

  // Servis ekle
  const addServiceMutation = useMutation({
    mutationFn: async (serviceId: number) => {
      await apiRequest("POST", `/api/service-maps/${mapId}/services`, { serviceId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/service-maps/${mapId}/services`] });
      queryClient.invalidateQueries({ queryKey: [`/api/service-maps/${mapId}/available-services`] });
      setIsAddServiceDialogOpen(false);
      setSelectedServiceId(undefined);
      toast({
        title: "Service added",
        description: "Service has been added to the map.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add service",
        description: error.message || "An error occurred while adding the service.",
        variant: "destructive",
      });
    },
  });

  // Servis kaldır
  const removeServiceMutation = useMutation({
    mutationFn: async (serviceId: number) => {
      await apiRequest("DELETE", `/api/service-maps/${mapId}/services/${serviceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/service-maps/${mapId}/services`] });
      queryClient.invalidateQueries({ queryKey: [`/api/service-maps/${mapId}/available-services`] });
      toast({
        title: "Service removed",
        description: "Service has been removed from the map.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove service",
        description: error.message || "An error occurred while removing the service.",
        variant: "destructive",
      });
    },
  });

  // Ajan ekle
  const addAgentMutation = useMutation({
    mutationFn: async (agentId: number) => {
      await apiRequest("POST", `/api/service-maps/${mapId}/agents`, { agentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/service-maps/${mapId}/agents`] });
      setIsAddAgentDialogOpen(false);
      setSelectedAgentId(undefined);
      toast({
        title: "Agent added",
        description: "Agent has been added to the map.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add agent",
        description: error.message || "An error occurred while adding the agent.",
        variant: "destructive",
      });
    },
  });

  // Ajan kaldır
  const removeAgentMutation = useMutation({
    mutationFn: async (agentId: number) => {
      await apiRequest("DELETE", `/api/service-maps/${mapId}/agents/${agentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/service-maps/${mapId}/agents`] });
      toast({
        title: "Agent removed",
        description: "Agent has been removed from the map.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove agent",
        description: error.message || "An error occurred while removing the agent.",
        variant: "destructive",
      });
    },
  });

  const handleAddService = () => {
    if (selectedServiceId) {
      addServiceMutation.mutate(selectedServiceId);
    } else {
      toast({
        title: "No service selected",
        description: "Please select a service to add to the map.",
        variant: "destructive",
      });
    }
  };

  const handleAddAgent = () => {
    if (selectedAgentId) {
      addAgentMutation.mutate(selectedAgentId);
    } else {
      toast({
        title: "No agent selected",
        description: "Please select an agent to add to the map.",
        variant: "destructive",
      });
    }
  };

  const isLoading = isMapLoading || isServicesLoading || isAgentsLoading;

  const handleBackToMaps = () => {
    setLocation("/service-maps");
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 md:ml-64 relative">
        <Topbar title={map ? map.name : "Service Map"} />
        
        <div className="relative">
          {isLoading && (
            <div className="p-4 md:p-8 space-y-6">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={handleBackToMaps}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <Skeleton className="h-8 w-64" />
              </div>
              <Skeleton className="h-[600px] w-full" />
            </div>
          )}

          {!isLoading && !map && (
            <div className="p-4 md:p-8">
              <div className="flex items-center gap-2 mb-6">
                <Button variant="ghost" size="icon" onClick={handleBackToMaps}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-3xl font-bold tracking-tight">Map not found</h1>
              </div>
              <Card>
                <CardContent className="py-12 text-center">
                  <Divide className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-lg font-medium mb-2">Map not found</h3>
                  <p className="text-muted-foreground max-w-md mx-auto mb-6">
                    The service map you're looking for does not exist or you don't have permission to view it.
                  </p>
                  <Button onClick={handleBackToMaps}>
                    Back to Maps
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {!isLoading && map && (
            <div className="p-4 md:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={handleBackToMaps}>
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <h1 className="text-3xl font-bold tracking-tight">{map.name}</h1>
                  {map.isDefault && (
                    <Badge variant="outline" className="ml-2 gap-1">
                      <Check size={12} className="opacity-70" />
                      <span className="text-xs">Default</span>
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Dialog open={isAddServiceDialogOpen} onOpenChange={setIsAddServiceDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex items-center gap-2">
                        <Server size={14} />
                        Add Service
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Service to Map</DialogTitle>
                        <DialogDescription>
                          Select a service to add to this map
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="my-4 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="service-select">Select Service</Label>
                          <Select onValueChange={(value) => setSelectedServiceId(Number(value))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a service" />
                            </SelectTrigger>
                            <SelectContent>
                              {isAvailableServicesLoading ? (
                                <SelectItem value="loading" disabled>Loading...</SelectItem>
                              ) : availableServices && availableServices.length > 0 ? (
                                availableServices.map((service) => (
                                  <SelectItem key={service.id} value={service.id.toString()}>
                                    {service.name} - {service.type}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="none" disabled>No services available</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <DialogFooter>
                        <Button 
                          variant="outline" 
                          onClick={() => setIsAddServiceDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleAddService} 
                          disabled={!selectedServiceId || addServiceMutation.isPending}
                        >
                          Add to Map
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={isAddAgentDialogOpen} onOpenChange={setIsAddAgentDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex items-center gap-2">
                        <Cpu size={14} />
                        Add Agent
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Agent to Map</DialogTitle>
                        <DialogDescription>
                          Select an agent to add to this map
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="my-4 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="agent-select">Select Agent</Label>
                          <Select onValueChange={(value) => setSelectedAgentId(Number(value))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select an agent" />
                            </SelectTrigger>
                            <SelectContent>
                              {isAvailableAgentsLoading ? (
                                <SelectItem value="loading" disabled>Loading...</SelectItem>
                              ) : availableAgents && availableAgents.length > 0 ? (
                                availableAgents.map((agent) => (
                                  <SelectItem key={agent.id} value={agent.id.toString()}>
                                    {agent.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="none" disabled>No agents available</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <DialogFooter>
                        <Button 
                          variant="outline" 
                          onClick={() => setIsAddAgentDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleAddAgent} 
                          disabled={!selectedAgentId || addAgentMutation.isPending}
                        >
                          Add to Map
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2"
                    onClick={() => {
                      // Harita paylaşma işlevi
                      toast({
                        title: "Coming soon",
                        description: "Map sharing feature will be available soon.",
                      });
                    }}
                  >
                    <Share size={14} />
                    Share Map
                  </Button>
                </div>
              </div>

              <ServiceCanvas
                services={mapServices || []}
                agents={mapAgents || []}
                connections={[]} // Connections will be fetched in the ServiceCanvas component
                isLoading={isLoading}
                onAddService={() => setIsAddServiceDialogOpen(true)}
              />

              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg">Services</CardTitle>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 gap-1"
                        onClick={() => setIsAddServiceDialogOpen(true)}
                      >
                        <Plus size={14} />
                        Add
                      </Button>
                    </div>
                    <CardDescription>
                      Services included in this map
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isServicesLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : mapServices && mapServices.length > 0 ? (
                      <div className="space-y-3">
                        {mapServices.map((service) => (
                          <div 
                            key={service.id} 
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div>
                              <div className="font-medium">{service.name}</div>
                              <div className="text-sm text-muted-foreground">{service.type} - {service.host}:{service.port}</div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeServiceMutation.mutate(service.id)}
                            >
                              <Trash2 size={16} className="text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No services in this map. Add services to get started.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg">Agents</CardTitle>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 gap-1"
                        onClick={() => setIsAddAgentDialogOpen(true)}
                      >
                        <Plus size={14} />
                        Add
                      </Button>
                    </div>
                    <CardDescription>
                      Agents included in this map
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isAgentsLoading ? (
                      <div className="space-y-3">
                        {[1, 2].map((i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : mapAgents && mapAgents.length > 0 ? (
                      <div className="space-y-3">
                        {mapAgents.map((agent) => (
                          <div 
                            key={agent.id} 
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div>
                              <div className="font-medium">{agent.name}</div>
                              <div className="text-sm text-muted-foreground">
                                Status: {agent.status}
                                {agent.lastSeen && (
                                  <span className="ml-2">
                                    Last seen: {new Date(agent.lastSeen).toLocaleTimeString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeAgentMutation.mutate(agent.id)}
                            >
                              <Trash2 size={16} className="text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No agents in this map. Add agents to get started.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}