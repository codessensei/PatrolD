import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import StatusCard from "@/components/dashboard/status-card";
import ServiceCanvas from "@/components/dashboard/service-canvas";
import AlertItem from "@/components/dashboard/alert-item";
import StatsPanel from "@/components/dashboard/stats-panel";
import AddServiceModal from "@/components/modals/add-service-modal";
import { Alert, Connection, Service, ServiceMap } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, AlertTriangle, AlertCircle, Clock, PlusCircle, 
  RefreshCw, ArrowDown, Calendar, Network, Activity, Filter,
  Map, ChevronDown, ChevronRight, ExternalLink
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function DashboardPage() {
  const { user } = useAuth();
  const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null);

  // Get service maps
  const { data: serviceMaps = [], isLoading: isLoadingMaps } = useQuery<ServiceMap[]>({
    queryKey: ["/api/service-maps"],
    enabled: !!user,
  });

  // Fetch the default map on initial load
  const { data: defaultMap } = useQuery<ServiceMap>({
    queryKey: ["/api/service-maps/default"],
    enabled: !!user && !selectedMapId,
  });
  
  // Handle default map loading
  useEffect(() => {
    if (defaultMap && !selectedMapId) {
      setSelectedMapId(defaultMap.id);
    }
  }, [defaultMap, selectedMapId]);

  // If a specific map is selected, get its services and items
  const { data: selectedMap } = useQuery<any>({
    queryKey: [`/api/service-maps/${selectedMapId}`],
    enabled: !!selectedMapId && !!user,
  });

  // Get all services (for filtering)
  const { data: allServices = [], isLoading: isLoadingServices } = useQuery<Service[]>({
    queryKey: ["/api/services"],
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
  });

  // Fetch connections with polling
  const { data: connections = [], isLoading: isLoadingConnections } = useQuery<Connection[]>({
    queryKey: ["/api/connections"],
    refetchInterval: 5000,
  });

  // Get alerts with polling
  const { data: alerts = [], isLoading: isLoadingAlerts } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    refetchInterval: 5000,
  });

  // Get stats with polling
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["/api/stats"],
    refetchInterval: 5000,
  });
  
  // Determine which services to display based on the selected map
  const services = useMemo(() => {
    if (selectedMap && selectedMap.serviceItems && selectedMap.serviceItems.length > 0) {
      // If a map is selected, show only services in that map
      const serviceIds = selectedMap.serviceItems.map((item: {serviceId: number}) => item.serviceId);
      return allServices.filter((service: Service) => serviceIds.includes(service.id));
    }
    // Otherwise, show all services
    return allServices;
  }, [selectedMap, allServices]);
  
  // Manual refresh handler
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/services"] });
    queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
    queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
    queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
  };

  // Derived stats
  const onlineServices = services.filter((s: Service) => s.status === "online").length;
  const offlineServices = services.filter((s: Service) => s.status === "offline").length;
  const degradedServices = services.filter((s: Service) => s.status === "degraded").length;
  // Type-safe way to handle stats
  const avgResponseTime = stats && 
    typeof stats === 'object' && 
    stats !== null &&
    'avgResponseTime' in stats &&
    typeof stats.avgResponseTime === 'number' ? stats.avgResponseTime : null;

  // Search filter
  const filteredServices = searchQuery
    ? services.filter((s: Service) => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.host.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : services;

  // Recent alerts
  const recentAlerts = alerts.slice(0, 5);

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 md:ml-64 relative">
        <Topbar 
          title="Service Monitor" 
          onSearch={setSearchQuery} 
        />
        
        <div className="p-4 md:p-8 relative">
          {/* Dashboard Header */}
          <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold glow-text animate-gradient-text mb-2 tracking-tight">
                Service Mesh View
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-lg flex items-center">
                <span>Monitor your services and visualize connections</span>
                
                {/* Map Selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="link" className="ml-2 p-1 h-auto text-blue-500 dark:text-blue-400 hover:no-underline hover:text-blue-600 dark:hover:text-blue-300">
                      <Map className="h-4 w-4 mr-1" />
                      <span className="underline underline-offset-4">Service Maps</span>
                      <ChevronDown className="h-3 w-3 ml-1 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Available Maps</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    {isLoadingMaps ? (
                      <div className="py-2 px-2 text-center text-sm text-muted-foreground">
                        Loading maps...
                      </div>
                    ) : serviceMaps.length > 0 ? (
                      <>
                        {serviceMaps.map(map => (
                          <DropdownMenuItem key={map.id} onClick={() => setSelectedMapId(map.id)}>
                            <div className="flex items-center w-full">
                              <div 
                                className="w-2 h-2 rounded-full mr-2" 
                                style={{ backgroundColor: map.color || '#4f46e5' }}
                              />
                              <span>{map.name}</span>
                              {map.isDefault && (
                                <span className="ml-2 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5">
                                  Default
                                </span>
                              )}
                              {selectedMapId === map.id && (
                                <CheckCircle2 className="h-4 w-4 ml-auto text-green-500" />
                              )}
                            </div>
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                      </>
                    ) : (
                      <div className="py-2 px-2 text-center text-sm text-muted-foreground">
                        No maps created yet
                      </div>
                    )}
                    
                    <DropdownMenuItem onClick={() => setLocation('/service-maps')}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Manage Service Maps
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </p>
            </div>
            
            <div className="mt-4 md:mt-0 flex flex-wrap gap-3">
              <Button 
                className="glass-button flex items-center gap-2 font-medium"
                onClick={() => setIsAddServiceModalOpen(true)}
              >
                <PlusCircle className="h-4 w-4" />
                Add Service
              </Button>
              
              <div className="relative">
                <Button 
                  variant="outline" 
                  className="glass-button flex items-center gap-2 pr-8 font-medium"
                >
                  <Calendar className="h-4 w-4" />
                  Last 24 hours
                  <ArrowDown className="h-3 w-3 absolute right-3" />
                </Button>
              </div>
              
              <Button 
                variant="outline" 
                className="glass-button flex items-center gap-2 font-medium"
                onClick={handleRefresh}
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingServices || isLoadingConnections ? "animate-spin" : ""}`} />
                {isLoadingServices || isLoadingConnections ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>
          
          {/* Status Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Active Services Card */}
            <div className="glass-card hover-card-effect">
              <div className="p-6 flex flex-col h-full relative overflow-hidden">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-green-400/20 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Active Services</h3>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{onlineServices}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs font-medium text-green-500 mt-auto">
                  <span className="inline-block px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30">
                    +2
                  </span>
                  <span>services in last 24h</span>
                </div>
                
                <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-green-500/10 rounded-full blur-2xl"></div>
              </div>
            </div>

            {/* Offline Services Card */}
            <div className="glass-card hover-card-effect">
              <div className="p-6 flex flex-col h-full relative overflow-hidden">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-red-400/20 flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Offline Services</h3>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{offlineServices}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs font-medium text-red-500 mt-auto">
                  <span className="inline-block px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30">
                    +1
                  </span>
                  <span>service in last 2h</span>
                </div>
                
                <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-red-500/10 rounded-full blur-2xl"></div>
              </div>
            </div>

            {/* Warnings Card */}
            <div className="glass-card hover-card-effect">
              <div className="p-6 flex flex-col h-full relative overflow-hidden">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-amber-400/20 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Warnings</h3>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{degradedServices}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs font-medium text-green-500 mt-auto">
                  <span className="inline-block px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30">
                    -3
                  </span>
                  <span>warnings resolved</span>
                </div>
                
                <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl"></div>
              </div>
            </div>

            {/* Response Time Card */}
            <div className="glass-card hover-card-effect">
              <div className="p-6 flex flex-col h-full relative overflow-hidden">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-blue-400/20 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Avg Response</h3>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{typeof avgResponseTime === 'number' ? `${avgResponseTime}ms` : '---'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs font-medium text-green-500 mt-auto">
                  <span className="inline-block px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30">
                    -18ms
                  </span>
                  <span>faster than before</span>
                </div>
                
                <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl"></div>
              </div>
            </div>
          </div>
          
          {/* Service Canvas with Glassmorphism */}
          <div className="glass-card mb-8 p-1">
            <div className="rounded-lg overflow-hidden">
              <ServiceCanvas 
                services={filteredServices} 
                connections={connections}
                isLoading={isLoadingServices || isLoadingConnections}
                onAddService={() => setIsAddServiceModalOpen(true)}
              />
            </div>
          </div>
          
          {/* Recent Alerts and Stats with Glassmorphism */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass-card hover-card-effect lg:col-span-2">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-indigo-500" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Alerts</h3>
                  </div>
                  <Button variant="ghost" className="text-sm p-2 rounded-lg hover:bg-white/20 dark:hover:bg-slate-800/40">
                    View All
                  </Button>
                </div>
                
                <div className="space-y-4">
                  {isLoadingAlerts ? (
                    <div className="py-10 text-center text-slate-500 dark:text-slate-400">
                      <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full mb-2"></div>
                      <p>Loading alerts...</p>
                    </div>
                  ) : recentAlerts.length > 0 ? (
                    recentAlerts.map(alert => (
                      <AlertItem 
                        key={alert.id}
                        alert={alert}
                        service={services.find(s => s.id === alert.serviceId)}
                      />
                    ))
                  ) : (
                    <div className="py-10 text-center text-slate-500 dark:text-slate-400">
                      <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p>No alerts found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="glass-card hover-card-effect">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Network className="h-5 w-5 text-indigo-500" />
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Service Stats</h3>
                </div>
                <StatsPanel 
                  services={services}
                  isLoading={isLoadingServices}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <AddServiceModal 
        isOpen={isAddServiceModalOpen}
        onClose={() => setIsAddServiceModalOpen(false)}
        existingServices={services}
      />
    </div>
  );
}
