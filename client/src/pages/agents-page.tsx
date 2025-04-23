import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Download, Upload, Cpu, Server, RefreshCw, Copy, Globe } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Agent } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Define form schema for creating a new agent
const formSchema = z.object({
  name: z.string().min(3, {
    message: "Agent name must be at least 3 characters.",
  }),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function AgentsPage() {
  const { user } = useAuth();
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [copiedApiKey, setCopiedApiKey] = useState<string | null>(null);
  
  // Form for creating a new agent
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Query to get all agents
  const { data: agents, isLoading: isLoadingAgents } = useQuery({
    queryKey: ["/api/agents"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/agents");
      const data = await res.json();
      return data as Agent[];
    },
  });

  // Mutation to create a new agent
  const createAgentMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("POST", "/api/agents", data);
      const newAgent = await res.json();
      return newAgent as Agent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      form.reset();
      setOpenCreateDialog(false);
    },
  });

  // Mutation to refresh an agent's status
  const refreshAgentMutation = useMutation({
    mutationFn: async (agentId: number) => {
      const res = await apiRequest("PUT", `/api/agents/${agentId}/refresh`);
      const updatedAgent = await res.json();
      return updatedAgent as Agent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    },
  });

  // Function to copy API key to clipboard
  const copyApiKey = (apiKey: string) => {
    navigator.clipboard.writeText(apiKey);
    setCopiedApiKey(apiKey);
    setTimeout(() => setCopiedApiKey(null), 2000);
  };

  // Function to handle form submission
  const onSubmit = (data: FormValues) => {
    createAgentMutation.mutate(data);
  };

  // Function to download agent script
  const downloadAgentScript = (agent: Agent) => {
    // Create the agent script content
    const scriptContent = `#!/usr/bin/env node
/**
 * UptimeMonitor Agent Script
 * Version: 1.0.0
 * Agent ID: ${agent.id}
 * Agent Name: ${agent.name}
 * 
 * This script sends heartbeat signals and server stats to your UptimeMonitor instance.
 * It helps you monitor remote servers from your central dashboard.
 */
const https = require('https');
const os = require('os');
const fs = require('fs');
const child_process = require('child_process');

// Agent configuration
const API_KEY = "${agent.apiKey}";
const MONITOR_URL = window.location.origin; // Replace with your actual UptimeMonitor URL
const HEARTBEAT_INTERVAL = 30000; // milliseconds (30 seconds)

// Function to get system info
function getSystemInfo() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memUsage = ((totalMem - freeMem) / totalMem * 100).toFixed(2);
  
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    osType: os.type(),
    osRelease: os.release(),
    uptime: os.uptime(),
    cpuLoad: os.loadavg(),
    cpuCount: os.cpus().length,
    totalMemory: totalMem,
    freeMemory: freeMem,
    memoryUsage: memUsage + '%',
    timestamp: new Date().toISOString()
  };
}

// Function to check a service status
function checkService(serviceName) {
  try {
    // This is a simple implementation and may need to be adjusted for specific services
    const result = child_process.execSync(\`systemctl status \${serviceName}\`).toString();
    const isActive = result.includes('Active: active');
    return {
      name: serviceName,
      status: isActive ? 'online' : 'offline',
      lastChecked: new Date().toISOString()
    };
  } catch (err) {
    return {
      name: serviceName,
      status: 'unknown',
      error: err.message,
      lastChecked: new Date().toISOString()
    };
  }
}

// Function to report data to UptimeMonitor
function reportToServer() {
  const systemInfo = getSystemInfo();
  
  // You can add specific service checks here
  const services = [
    // Example: checking nginx status
    // checkService('nginx'),
    // Add more services as needed
  ];
  
  const data = JSON.stringify({
    apiKey: API_KEY,
    serverInfo: systemInfo,
    services: services
  });
  
  const options = {
    hostname: new URL(MONITOR_URL).hostname,
    port: 443,
    path: '/api/agents/heartbeat',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };
  
  const req = https.request(options, (res) => {
    let responseData = '';
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      console.log(\`[UptimeMonitor Agent] Heartbeat sent. Status: \${res.statusCode}\`);
      if (res.statusCode !== 200) {
        console.error(\`[UptimeMonitor Agent] Error: \${responseData}\`);
      }
    });
  });
  
  req.on('error', (error) => {
    console.error(\`[UptimeMonitor Agent] Error: \${error.message}\`);
  });
  
  req.write(data);
  req.end();
}

// Main execution
console.log(\`[UptimeMonitor Agent] Started for \${agent.name}\`);
console.log(\`[UptimeMonitor Agent] Sending heartbeats every \${HEARTBEAT_INTERVAL/1000} seconds\`);

// Send initial heartbeat
reportToServer();

// Set up regular heartbeat interval
setInterval(reportToServer, HEARTBEAT_INTERVAL);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('[UptimeMonitor Agent] Shutting down...');
  process.exit(0);
});
`;

    // Create a blob with the script content
    const blob = new Blob([scriptContent], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    
    // Create a link element and trigger the download
    const a = document.createElement('a');
    a.href = url;
    a.download = `uptime-monitor-agent-${agent.id}.js`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <div className="md:ml-64 min-h-screen">
        <Topbar title="Agents" />
        
        <main className="p-4 md:p-6 max-w-7xl mx-auto">
          <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Agent Management</h1>
              <p className="text-gray-600 dark:text-gray-400">Deploy and manage monitoring agents on your servers</p>
            </div>
            
            <Dialog open={openCreateDialog} onOpenChange={setOpenCreateDialog}>
              <DialogTrigger asChild>
                <Button className="mt-4 md:mt-0 flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Create New Agent
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Create New Agent</DialogTitle>
                  <DialogDescription>
                    Create a new monitoring agent to deploy on your servers.
                  </DialogDescription>
                </DialogHeader>
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Agent Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Production Server" {...field} />
                          </FormControl>
                          <FormDescription>
                            Give your agent a descriptive name
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Main production web server hosted on AWS" {...field} />
                          </FormControl>
                          <FormDescription>
                            Add notes about this server's role or location
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <DialogFooter>
                      <Button type="submit" disabled={createAgentMutation.isPending}>
                        {createAgentMutation.isPending ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create Agent"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          
          {isLoadingAgents ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="h-24 bg-gray-100 dark:bg-gray-800"></CardHeader>
                  <CardContent className="py-6">
                    <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded mb-4 w-3/4"></div>
                    <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-1/2"></div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded w-1/4"></div>
                    <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded w-1/4"></div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : agents && agents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agents.map((agent) => (
                <Card key={agent.id} className={cn(
                  "border-l-4",
                  agent.status === "active" ? "border-l-green-500" : 
                  agent.status === "inactive" ? "border-l-gray-400" : "border-l-yellow-500"
                )}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{agent.name}</span>
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full",
                        agent.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : 
                        agent.status === "inactive" ? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300" : 
                        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
                      )}>
                        {agent.status === "active" ? "Active" : 
                         agent.status === "inactive" ? "Inactive" : "Connecting"}
                      </span>
                    </CardTitle>
                    <CardDescription>
                      {agent.description || "No description provided"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <Label className="text-xs text-gray-500 dark:text-gray-400">API KEY</Label>
                      <div className="relative">
                        <Input 
                          type="text" 
                          value={agent.apiKey} 
                          readOnly 
                          className="pr-10 text-sm font-mono bg-gray-50 dark:bg-gray-800"
                        />
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="absolute right-0 top-0"
                                onClick={() => copyApiKey(agent.apiKey)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {copiedApiKey === agent.apiKey ? "Copied!" : "Copy API Key"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    
                    {agent.lastSeen && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Last seen: {new Date(agent.lastSeen).toLocaleString()}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs"
                      onClick={() => downloadAgentScript(agent)}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download Script
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs"
                      onClick={() => refreshAgentMutation.mutate(agent.id)}
                    >
                      <RefreshCw className={cn(
                        "h-3 w-3 mr-1",
                        refreshAgentMutation.isPending && selectedAgentId === agent.id ? "animate-spin" : ""
                      )} />
                      Refresh
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Agents Found</CardTitle>
                <CardDescription>
                  You haven't created any monitoring agents yet.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Server className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
                <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300">Get Started with Agents</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mt-2 text-center">
                  Agents allow you to monitor servers from anywhere. Create your first agent and deploy it to start collecting metrics.
                </p>
                <Button className="mt-6" onClick={() => setOpenCreateDialog(true)}>
                  <Server className="h-4 w-4 mr-2" />
                  Create Your First Agent
                </Button>
              </CardContent>
            </Card>
          )}
          
          <div className="mt-12">
            <h2 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-100">How Agents Work</h2>
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex flex-col items-center text-center">
                    <div className="bg-primary/10 rounded-full p-3 mb-4">
                      <Download className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-medium mb-2">1. Deploy the Agent</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Download the agent script and run it on your server with Node.js
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-center text-center">
                    <div className="bg-primary/10 rounded-full p-3 mb-4">
                      <Cpu className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-medium mb-2">2. Collect Metrics</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      The agent collects system metrics and monitors services
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-center text-center">
                    <div className="bg-primary/10 rounded-full p-3 mb-4">
                      <Globe className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-medium mb-2">3. View in Dashboard</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Monitor all your servers from one central dashboard
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}