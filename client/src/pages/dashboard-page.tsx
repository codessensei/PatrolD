import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import StatusCard from "@/components/dashboard/status-card";
import ServiceCanvas from "@/components/dashboard/service-canvas";
import AlertItem from "@/components/dashboard/alert-item";
import StatsPanel from "@/components/dashboard/stats-panel";
import AddServiceModal from "@/components/modals/add-service-modal";
import { Alert, Connection, Service } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, AlertTriangle, AlertCircle, Clock, PlusCircle, 
  RefreshCw, ArrowDown, Calendar, Network, Activity, Filter
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { user } = useAuth();
  const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch data
  const { data: services = [], isLoading: isLoadingServices } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  const { data: connections = [], isLoading: isLoadingConnections } = useQuery<Connection[]>({
    queryKey: ["/api/connections"],
  });

  const { data: alerts = [], isLoading: isLoadingAlerts } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
  });

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["/api/stats"],
  });

  // Derived stats
  const onlineServices = services.filter(s => s.status === "online").length;
  const offlineServices = services.filter(s => s.status === "offline").length;
  const degradedServices = services.filter(s => s.status === "degraded").length;
  const avgResponseTime = stats?.avgResponseTime || 0;

  // Search filter
  const filteredServices = searchQuery
    ? services.filter(s => 
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
              <p className="text-slate-600 dark:text-slate-400 text-lg">
                Monitor your services and visualize connections
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
              
              <Button variant="outline" className="glass-button flex items-center gap-2 font-medium">
                <RefreshCw className="h-4 w-4" />
                Refresh
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
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{avgResponseTime}ms</p>
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
