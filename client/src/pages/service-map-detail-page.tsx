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
import { Checkbox } from "@/components/ui/checkbox";
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
  Divide,
  ChevronRight,
  ChevronLeft,
  Globe,
  Database,
  MonitorPlay,
  AlertTriangle,
  FileText,
  Layers
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
  
  // Step-by-step service addition
  const [addServiceStep, setAddServiceStep] = useState(1);
  const [serviceType, setServiceType] = useState<string>("website");
  const [servicePosition, setServicePosition] = useState<{ x: number, y: number } | undefined>();
  const [newServiceData, setNewServiceData] = useState({
    name: "",
    host: "",
    port: "80",
    path: "/",
    protocol: "http",
    interval: "60"
  });

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

  // Add existing service to map
  const addServiceMutation = useMutation({
    mutationFn: async (serviceId: number) => {
      await apiRequest("POST", `/api/service-maps/${mapId}/services`, { serviceId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/service-maps/${mapId}/services`] });
      queryClient.invalidateQueries({ queryKey: [`/api/service-maps/${mapId}/available-services`] });
      resetServiceModal();
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
  
  // Create new service and add to map
  const createServiceMutation = useMutation({
    mutationFn: async (serviceData: any) => {
      // First create a new service
      const response = await apiRequest("POST", "/api/services", {
        ...serviceData,
        type: serviceType
      });
      const service = await response.json();
      
      // Then add it to the map with position if provided
      await apiRequest("POST", `/api/service-maps/${mapId}/services`, { 
        serviceId: service.id,
        position: servicePosition 
      });
      
      return service;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: [`/api/service-maps/${mapId}/services`] });
      queryClient.invalidateQueries({ queryKey: [`/api/service-maps/${mapId}/available-services`] });
      resetServiceModal();
      toast({
        title: "Service created",
        description: "New service has been created and added to the map.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create service",
        description: error.message || "An error occurred while creating the service.",
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

  // Handle service selection from existing services or create new
  const handleAddService = () => {
    if (addServiceStep === 2) {
      // If adding existing service
      if (selectedServiceId) {
        addServiceMutation.mutate(selectedServiceId);
      } else {
        // If no service selected in selection mode
        toast({
          title: "No service selected",
          description: "Please select a service to add to the map.",
          variant: "destructive",
        });
      }
    } else if (addServiceStep === 4) {
      // If creating new service
      if (!newServiceData.name || !newServiceData.host) {
        toast({
          title: "Missing information",
          description: "Please provide at least a name and host for the service.",
          variant: "destructive",
        });
        return;
      }
      
      // Create service with the collected data
      createServiceMutation.mutate({
        name: newServiceData.name,
        host: newServiceData.host,
        port: parseInt(newServiceData.port) || 80,
        path: newServiceData.path,
        protocol: newServiceData.protocol,
        checkInterval: parseInt(newServiceData.interval) || 60
      });
    } else {
      // Unexpected state
      toast({
        title: "Action not available",
        description: "Please complete all steps before adding the service.",
        variant: "destructive",
      });
    }
  };
  
  // Reset service modal state
  const resetServiceModal = () => {
    setAddServiceStep(1);
    setSelectedServiceId(undefined);
    setServiceType("website");
    setServicePosition(undefined);
    setNewServiceData({
      name: "",
      host: "",
      port: "80",
      path: "/",
      protocol: "http",
      interval: "60"
    });
    setIsAddServiceDialogOpen(false);
  };
  
  // Move to next step in add service flow
  const nextServiceStep = () => {
    setAddServiceStep(prev => prev + 1);
  };
  
  // Move to previous step in add service flow
  const prevServiceStep = () => {
    setAddServiceStep(prev => Math.max(1, prev - 1));
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
  
  // Share map functionality
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareData, setShareData] = useState({
    title: "",
    description: "",
    isPublished: true,
    isPasswordProtected: false,
    password: "",
    serviceMapId: ""
  });

  // When clicking on the Share Map button, we open a dialog
  const handleShareMap = () => {
    if (map) {
      setShareData({
        title: map.name,
        description: map.description || "",
        isPublished: true,
        isPasswordProtected: false,
        password: "",
        serviceMapId: mapId.toString()
      });
      setIsShareDialogOpen(true);
    }
  };
  
  // Create new shared map
  const createSharedMapMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/shared-maps", data);
      return await response.json();
    },
    onSuccess: (data) => {
      setIsShareDialogOpen(false);
      toast({
        title: "Map shared successfully",
        description: "Your service map has been shared. You can view it in the Shared Maps section.",
      });
      // Copy to clipboard if available
      if (data.shareKey && navigator.clipboard) {
        const shareUrl = `${window.location.origin}/view-map/${data.shareKey}`;
        navigator.clipboard.writeText(shareUrl)
          .then(() => {
            toast({
              title: "Share link copied!",
              description: "The share link has been copied to your clipboard.",
            });
          });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to share map",
        description: error.message || "An error occurred while sharing the map.",
        variant: "destructive",
      });
    },
  });

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
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2"
                    onClick={handleShareMap}
                  >
                    <Share size={14} />
                    Share Map
                  </Button>
                
                  <Dialog open={isAddServiceDialogOpen} onOpenChange={(open) => {
                    if (!open) resetServiceModal();
                    setIsAddServiceDialogOpen(open);
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex items-center gap-2">
                        <Server size={14} />
                        Add Service
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[550px]">
                      <DialogHeader>
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                            <span className="text-primary font-medium">{addServiceStep}</span>
                          </div>
                          <div>
                            <DialogTitle>
                              {addServiceStep === 1 && "Choose Service Addition Method"}
                              {addServiceStep === 2 && "Select Existing Service"}
                              {addServiceStep === 3 && "Service Configuration"}
                              {addServiceStep === 4 && "Service Location"}
                            </DialogTitle>
                            <DialogDescription>
                              {addServiceStep === 1 && "Choose how you want to add a service to the map"}
                              {addServiceStep === 2 && "Select an existing service to add to this map"}
                              {addServiceStep === 3 && "Configure the service details"}
                              {addServiceStep === 4 && "Specify where to place the service on the map"}
                            </DialogDescription>
                          </div>
                        </div>
                      </DialogHeader>
                      
                      {/* Step 1: Choose addition method */}
                      {addServiceStep === 1 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                          <Card className="cursor-pointer transition-all hover:shadow-md" onClick={() => {
                            setAddServiceStep(2);
                          }}>
                            <CardContent className="p-6 flex flex-col items-center text-center">
                              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                                <Layers className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                              </div>
                              <CardTitle className="text-lg mb-2">Use Existing Service</CardTitle>
                              <p className="text-sm text-muted-foreground">
                                Add a service you've already created to this map
                              </p>
                            </CardContent>
                          </Card>
                          
                          <Card className="cursor-pointer transition-all hover:shadow-md" onClick={() => {
                            setAddServiceStep(3);
                          }}>
                            <CardContent className="p-6 flex flex-col items-center text-center">
                              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                                <Globe className="h-6 w-6 text-green-600 dark:text-green-400" />
                              </div>
                              <CardTitle className="text-lg mb-2">Create New Service</CardTitle>
                              <p className="text-sm text-muted-foreground">
                                Create a new service and add it to this map
                              </p>
                            </CardContent>
                          </Card>
                        </div>
                      )}
                      
                      {/* Step 2: Select existing service */}
                      {addServiceStep === 2 && (
                        <div className="py-4 space-y-4">
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
                      )}
                      
                      {/* Step 3: Configure new service */}
                      {addServiceStep === 3 && (
                        <div className="py-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="service-name">Service Name</Label>
                              <Input 
                                id="service-name" 
                                placeholder="My Website"
                                value={newServiceData.name}
                                onChange={(e) => setNewServiceData({...newServiceData, name: e.target.value})}
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="service-type">Service Type</Label>
                              <Select 
                                onValueChange={(value) => setServiceType(value)}
                                defaultValue={serviceType}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="website">
                                    <div className="flex items-center">
                                      <Globe className="h-4 w-4 mr-2" />
                                      <span>Website</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="database">
                                    <div className="flex items-center">
                                      <Database className="h-4 w-4 mr-2" />
                                      <span>Database</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="api">
                                    <div className="flex items-center">
                                      <FileText className="h-4 w-4 mr-2" />
                                      <span>API Endpoint</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="stream">
                                    <div className="flex items-center">
                                      <MonitorPlay className="h-4 w-4 mr-2" />
                                      <span>Stream/Media</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="custom">
                                    <div className="flex items-center">
                                      <Server className="h-4 w-4 mr-2" />
                                      <span>Custom Service</span>
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="service-host">Host/IP</Label>
                              <Input 
                                id="service-host" 
                                placeholder="example.com"
                                value={newServiceData.host}
                                onChange={(e) => setNewServiceData({...newServiceData, host: e.target.value})}
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="service-port">Port</Label>
                              <Input 
                                id="service-port" 
                                placeholder="80"
                                value={newServiceData.port}
                                onChange={(e) => setNewServiceData({...newServiceData, port: e.target.value})}
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="service-protocol">Protocol</Label>
                              <Select 
                                onValueChange={(value) => setNewServiceData({...newServiceData, protocol: value})}
                                defaultValue={newServiceData.protocol}
                              >
                                <SelectTrigger id="service-protocol">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="http">HTTP</SelectItem>
                                  <SelectItem value="https">HTTPS</SelectItem>
                                  <SelectItem value="tcp">TCP</SelectItem>
                                  <SelectItem value="udp">UDP</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="service-path">Path</Label>
                              <Input 
                                id="service-path" 
                                placeholder="/"
                                value={newServiceData.path}
                                onChange={(e) => setNewServiceData({...newServiceData, path: e.target.value})}
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="service-interval">Check Interval (sec)</Label>
                              <Input 
                                id="service-interval" 
                                type="number"
                                placeholder="60"
                                value={newServiceData.interval}
                                onChange={(e) => setNewServiceData({...newServiceData, interval: e.target.value})}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Step 4: Configure position */}
                      {addServiceStep === 4 && (
                        <div className="py-4 space-y-4">
                          <p className="text-muted-foreground">
                            The service will be added to the map. You can drag it to position it exactly where you want.
                          </p>
                          <div className="bg-secondary/40 dark:bg-secondary/20 rounded-md p-6 flex items-center justify-center">
                            <div className="text-center">
                              <Server className="h-16 w-16 mx-auto mb-4 text-primary/60" />
                              <p className="font-medium">{newServiceData.name || "New Service"}</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                {serviceType} - {newServiceData.host}:{newServiceData.port}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <DialogFooter className="flex items-center justify-between mt-4">
                        <div>
                          {addServiceStep > 1 && (
                            <Button 
                              variant="outline" 
                              onClick={prevServiceStep}
                              className="flex items-center gap-1"
                            >
                              <ChevronLeft className="h-4 w-4" />
                              Back
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            onClick={resetServiceModal}
                          >
                            Cancel
                          </Button>
                          
                          {addServiceStep < 4 ? (
                            <Button 
                              onClick={nextServiceStep}
                              disabled={(addServiceStep === 2 && !selectedServiceId) || 
                                      (addServiceStep === 3 && (!newServiceData.name || !newServiceData.host))}
                              className="flex items-center gap-1"
                            >
                              Next
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button 
                              onClick={handleAddService}
                              disabled={addServiceMutation.isPending}
                            >
                              Add Service
                            </Button>
                          )}
                        </div>
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
                  

                </div>
              </div>

              {/* Share Map Dialog */}
              <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Share Your Service Map</DialogTitle>
                    <DialogDescription>
                      Create a shareable view of this service map
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="share-title">Title</Label>
                      <Input
                        id="share-title"
                        placeholder="Enter a title for your shared map"
                        value={shareData.title}
                        onChange={(e) => setShareData({ ...shareData, title: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="share-description">Description (optional)</Label>
                      <Input
                        id="share-description"
                        placeholder="Enter a description"
                        value={shareData.description}
                        onChange={(e) => setShareData({ ...shareData, description: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="share-publish"
                        checked={shareData.isPublished}
                        onCheckedChange={(checked) => 
                          setShareData({ ...shareData, isPublished: checked === true })
                        }
                      />
                      <Label htmlFor="share-publish">Publish publicly (anyone with the link can access)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="share-password"
                        checked={shareData.isPasswordProtected}
                        onCheckedChange={(checked) => 
                          setShareData({ ...shareData, isPasswordProtected: checked === true })
                        }
                      />
                      <Label htmlFor="share-password">Password protect</Label>
                    </div>
                    {shareData.isPasswordProtected && (
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="Enter a password"
                          value={shareData.password}
                          onChange={(e) => setShareData({ ...shareData, password: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsShareDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => createSharedMapMutation.mutate(shareData)}
                      disabled={createSharedMapMutation.isPending || !shareData.title}
                    >
                      Share Map
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

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