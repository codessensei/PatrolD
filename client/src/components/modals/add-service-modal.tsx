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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Check, Server, Globe, Clock, Link as LinkIcon, Save } from "lucide-react";

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
  const [step, setStep] = useState<number>(1);
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
      setStep(1);
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
    setStep(1);
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

  const nextStep = () => {
    // Validate current step before proceeding
    if (step === 1) {
      // Basic info validation
      const nameValue = form.getValues("name");
      const typeValue = form.getValues("type");
      
      if (!nameValue || !typeValue) {
        toast({
          title: "Missing information",
          description: "Please provide service name and type",
          variant: "destructive",
        });
        return;
      }
    } else if (step === 2) {
      // Connection info validation
      const hostValue = form.getValues("host");
      const portValue = form.getValues("port");
      
      if (!hostValue || !portValue) {
        toast({
          title: "Missing information",
          description: "Please provide host and port",
          variant: "destructive",
        });
        return;
      }
    } else if (step === 3) {
      // Monitoring method validation
      const monitorTypeValue = form.getValues("monitorType");
      const agentIdValue = form.getValues("agentId");
      
      if (monitorTypeValue === "agent" && !agentIdValue) {
        toast({
          title: "Agent required",
          description: "Please select an agent for agent-based monitoring",
          variant: "destructive",
        });
        return;
      }
    }
    
    setStep(prev => Math.min(prev + 1, 4));
  };

  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };
  
  // Render different content based on current step
  const renderStepContent = () => {
    switch(step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-4">
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">1</div>
                <h3 className="font-medium text-lg">Basic Information</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Start by providing basic details about your service.
              </p>
            </div>
            
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
          </div>
        );
        
      case 2:
        return (
          <div className="space-y-4">
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-4">
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">2</div>
                <h3 className="font-medium text-lg">Connection Details</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Provide information about how to reach your service.
              </p>
            </div>
            
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
          </div>
        );
        
      case 3:
        return (
          <div className="space-y-4">
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-4">
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">3</div>
                <h3 className="font-medium text-lg">Monitoring Method</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Choose how you want to monitor this service.
              </p>
            </div>
            
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
                      <TabsTrigger value="direct" className="flex items-center justify-center gap-2">
                        <Globe className="h-4 w-4" />
                        <span>Direct</span>
                      </TabsTrigger>
                      <TabsTrigger value="agent" className="flex items-center justify-center gap-2">
                        <Server className="h-4 w-4" />
                        <span>Agent</span>
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="direct" className="p-4 border rounded-md mt-2">
                      <div className="flex items-start">
                        <Globe className="h-5 w-5 mr-2 mt-0.5 text-blue-500" />
                        <div>
                          <h3 className="font-medium text-sm">Direct Monitoring</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Service will be monitored directly from the PatrolD server. 
                            Use this option for public or directly accessible services.
                          </p>
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="agent" className="p-4 border rounded-md mt-2">
                      <div className="flex items-start mb-4">
                        <Server className="h-5 w-5 mr-2 mt-0.5 text-indigo-500" />
                        <div>
                          <h3 className="font-medium text-sm">Agent Monitoring</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Service will be monitored from an agent's location.
                            Great for internal or private services.
                          </p>
                        </div>
                      </div>
                      
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
        );
        
      case 4:
        return (
          <div className="space-y-4">
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-4">
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">4</div>
                <h3 className="font-medium text-lg">Service Connections</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Define how this service connects with other services.
              </p>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-md border mb-4">
              <div className="flex items-center gap-2 mb-2">
                <LinkIcon className="h-4 w-4 text-primary" />
                <Label className="font-medium">Service Connections</Label>
              </div>
              <div className="p-3 bg-white rounded-md border border-gray-200 max-h-[200px] overflow-y-auto mt-1">
                {existingServices.length > 0 ? (
                  <div className="space-y-2">
                    {existingServices.map(service => (
                      <div key={service.id} className="flex items-center p-2 hover:bg-slate-50 rounded-md">
                        <Checkbox 
                          id={`service-${service.id}`}
                          checked={selectedConnections.includes(service.id)}
                          onCheckedChange={(checked) => 
                            handleConnectionToggle(service.id, checked as boolean)
                          }
                        />
                        <Label 
                          htmlFor={`service-${service.id}`}
                          className="ml-2 text-sm font-normal cursor-pointer flex-1"
                        >
                          {service.name}
                        </Label>
                        <span className="text-xs px-2 py-1 rounded-full bg-slate-200 text-slate-700">
                          {service.type}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 text-center py-4 flex flex-col items-center">
                    <LinkIcon className="h-8 w-8 mb-2 text-gray-300" />
                    <p>No existing services available</p>
                    <p className="text-xs mt-1">
                      Add more services to create connections
                    </p>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Select services that will connect to your new {form.getValues("name")} service
              </p>
            </div>
            
            <Card className="mt-6 border-dashed border-green-300 bg-green-50">
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  Service Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="py-0 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium">Name:</div>
                  <div>{form.getValues("name")}</div>
                  
                  <div className="font-medium">Type:</div>
                  <div>{form.getValues("type")}</div>
                  
                  <div className="font-medium">Host:</div>
                  <div>{form.getValues("host")}</div>
                  
                  <div className="font-medium">Port:</div>
                  <div>{form.getValues("port")}</div>
                  
                  <div className="font-medium">Check Interval:</div>
                  <div>
                    {checkIntervalOptions.find(opt => parseInt(opt.value) === form.getValues("checkInterval"))?.label || `${form.getValues("checkInterval")} seconds`}
                  </div>
                  
                  <div className="font-medium">Monitoring:</div>
                  <div className="capitalize">
                    {form.getValues("monitorType")}
                    {form.getValues("monitorType") === "agent" && agents && (
                      <span> ({agents.find(a => a.id === form.getValues("agentId"))?.name || "Unknown agent"})</span>
                    )}
                  </div>
                  
                  <div className="font-medium">Connections:</div>
                  <div>{selectedConnections.length} connected services</div>
                </div>
              </CardContent>
            </Card>
          </div>
        );
        
      default:
        return null;
    }
  };

  const renderProgressIndicator = () => {
    return (
      <div className="flex justify-between items-center mb-6 mt-4">
        {[1, 2, 3, 4].map((stepNumber) => (
          <div key={stepNumber} className="flex items-center">
            <div 
              className={`rounded-full h-8 w-8 flex items-center justify-center font-medium text-sm
                ${step === stepNumber 
                  ? 'bg-primary text-primary-foreground' 
                  : step > stepNumber 
                    ? 'bg-primary/20 text-primary' 
                    : 'bg-muted text-muted-foreground'
                }`}
            >
              {stepNumber}
            </div>
            {stepNumber < 4 && (
              <div 
                className={`h-0.5 w-10 mx-1 
                  ${step > stepNumber ? 'bg-primary' : 'bg-muted'}`}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Add New Service</DialogTitle>
        </DialogHeader>
        
        {renderProgressIndicator()}
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {renderStepContent()}
            
            <DialogFooter className="pt-4 flex justify-between w-full">
              <div>
                {step > 1 && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={prevStep}
                    disabled={createServiceMutation.isPending}
                    className="flex items-center gap-1"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleClose}
                  disabled={createServiceMutation.isPending}
                >
                  Cancel
                </Button>
                
                {step < 4 ? (
                  <Button 
                    type="button"
                    onClick={nextStep}
                    className="flex items-center gap-1"
                  >
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button 
                    type="submit"
                    disabled={createServiceMutation.isPending}
                    className="flex items-center gap-1"
                  >
                    {createServiceMutation.isPending ? "Creating..." : (
                      <>
                        <Save className="h-4 w-4" />
                        Create Service
                      </>
                    )}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
