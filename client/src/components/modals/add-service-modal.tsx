import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Service, Agent } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AddServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingServices: Service[];
}

const serviceTypeOptions = [
  "Web Server",
  "Database",
  "API Gateway",
  "Authentication",
  "Cache",
  "Load Balancer",
  "Microservice",
  "Custom Endpoint"
];

const checkIntervalOptions = [
  { value: "30", label: "30 seconds" },
  { value: "60", label: "1 minute" },
  { value: "300", label: "5 minutes" },
  { value: "600", label: "10 minutes" },
  { value: "1800", label: "30 minutes" }
];

const formSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  type: z.string().min(1, "Service type is required"),
  host: z.string().min(1, "Host/endpoint is required"),
  port: z.coerce.number().int().min(1, "Port must be a positive number"),
  checkInterval: z.coerce.number().int().min(1, "Check interval is required"),
  connections: z.array(z.number()).optional(),
  monitorType: z.enum(["direct", "agent"]).default("direct"),
  agentId: z.number().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

export default function AddServiceModal({ 
  isOpen, 
  onClose,
  existingServices
}: AddServiceModalProps) {
  const { toast } = useToast();
  const [selectedConnections, setSelectedConnections] = useState<number[]>([]);
  const [monitorType, setMonitorType] = useState<"direct" | "agent">("direct");
  
  // Fetch agents for the monitoring tab
  const { data: agents, isLoading: isLoadingAgents } = useQuery({
    queryKey: ["/api/agents"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/agents");
      const data = await res.json();
      return data as Agent[];
    },
  });
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "Web Server",
      host: "",
      port: 80,
      checkInterval: 60,
      connections: [],
      monitorType: "direct",
      agentId: null
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      // First create the service
      const serviceResponse = await apiRequest("POST", "/api/services", {
        name: data.name,
        type: data.type,
        host: data.host,
        port: data.port,
        checkInterval: data.checkInterval,
        positionX: Math.floor(Math.random() * 500), // Random initial position
        positionY: Math.floor(Math.random() * 400),
        monitorType: data.monitorType,
        agentId: data.monitorType === "agent" ? data.agentId : null,
      });
      
      const newService = await serviceResponse.json();
      
      // Then create connections if any
      if (data.connections && data.connections.length > 0) {
        await Promise.all(
          data.connections.map(sourceId => 
            apiRequest("POST", "/api/connections", {
              sourceId,
              targetId: newService.id,
            })
          )
        );
      }
      
      return newService;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
      toast({
        title: "Service created",
        description: "The service was added successfully",
      });
      onClose();
      form.reset();
      setSelectedConnections([]);
    },
    onError: (error) => {
      toast({
        title: "Failed to create service",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    // Add selected connections to form data
    data.connections = selectedConnections;
    
    // Validate that an agent is selected if using agent monitoring
    if (data.monitorType === "agent" && !data.agentId) {
      toast({
        title: "Agent required",
        description: "Please select an agent for agent-based monitoring",
        variant: "destructive",
      });
      return;
    }
    
    createServiceMutation.mutate(data);
  };
  
  // Reset form and state on close
  const handleClose = () => {
    form.reset();
    setSelectedConnections([]);
    setMonitorType("direct");
    onClose();
  };

  const handleConnectionToggle = (serviceId: number, checked: boolean) => {
    setSelectedConnections(prev => {
      if (checked) {
        return [...prev, serviceId];
      } else {
        return prev.filter(id => id !== serviceId);
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Add New Service</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Type</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select service type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {serviceTypeOptions.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Frontend API" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="host"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Host/Endpoint</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. api.example.com or 10.0.1.5" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="port"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Port</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. 80, 443, 3000" type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="checkInterval"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Check Interval</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    defaultValue={field.value.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select check interval" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {checkIntervalOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="my-4">
              <FormLabel className="mb-2">Monitoring Method</FormLabel>
              <FormField
                control={form.control}
                name="monitorType"
                render={({ field }) => (
                  <FormItem>
                    <Tabs 
                      defaultValue="direct" 
                      className="w-full"
                      onValueChange={(value) => {
                        field.onChange(value);
                        setMonitorType(value as "direct" | "agent");
                        if (value === "direct") {
                          form.setValue("agentId", null);
                        }
                      }}
                      value={field.value}
                    >
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="direct">Direct Monitoring</TabsTrigger>
                        <TabsTrigger value="agent">Agent Monitoring</TabsTrigger>
                      </TabsList>
                      <TabsContent value="direct" className="p-3 border rounded-md mt-2">
                        <p className="text-sm text-gray-500">
                          Service will be monitored directly from the server. Use this option for public or directly accessible services.
                        </p>
                      </TabsContent>
                      <TabsContent value="agent" className="p-3 border rounded-md mt-2">
                        <FormField
                          control={form.control}
                          name="agentId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Select Agent</FormLabel>
                              <Select
                                onValueChange={(value) => field.onChange(parseInt(value))}
                                value={field.value?.toString() || ""}
                                disabled={isLoadingAgents || !agents?.length}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select an agent" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {isLoadingAgents ? (
                                    <SelectItem value="loading" disabled>Loading agents...</SelectItem>
                                  ) : agents?.length ? (
                                    agents.map(agent => (
                                      <SelectItem key={agent.id} value={agent.id.toString()}>
                                        {agent.name} {agent.status === "active" ? "(Active)" : "(Inactive)"}
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <SelectItem value="none" disabled>No agents available</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Service will be monitored from the selected agent's location. Good for internal or private services.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TabsContent>
                    </Tabs>
                  </FormItem>
                )}
              />
            </div>
            
            <div>
              <Label>Connections</Label>
              <div className="p-3 bg-gray-50 rounded-md border border-gray-200 max-h-40 overflow-y-auto mt-1">
                {existingServices.length > 0 ? (
                  <div className="space-y-2">
                    {existingServices.map(service => (
                      <div key={service.id} className="flex items-center">
                        <Checkbox 
                          id={`service-${service.id}`}
                          checked={selectedConnections.includes(service.id)}
                          onCheckedChange={(checked) => 
                            handleConnectionToggle(service.id, checked as boolean)
                          }
                        />
                        <Label 
                          htmlFor={`service-${service.id}`}
                          className="ml-2 text-sm font-normal cursor-pointer"
                        >
                          {service.name} ({service.type})
                        </Label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-2">
                    No existing services available
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Select services that should connect to this new service
              </p>
            </div>
            
            <DialogFooter className="pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                disabled={createServiceMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createServiceMutation.isPending}
              >
                {createServiceMutation.isPending ? "Adding..." : "Add Service"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
