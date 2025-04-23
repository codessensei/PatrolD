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
import { CheckCircle2, AlertTriangle, AlertCircle, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

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
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar />
      
      <main className="flex-1 md:ml-64">
        <Topbar 
          title="Service Monitor" 
          onSearch={setSearchQuery} 
        />
        
        <div className="p-4 md:p-6">
          {/* Dashboard Header */}
          <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Service Mesh View</h2>
              <p className="text-gray-600 mt-1">Monitor your services and manage connections</p>
            </div>
            
            <div className="mt-4 md:mt-0 flex flex-wrap gap-3">
              <Button 
                variant="default" 
                className="inline-flex items-center"
                onClick={() => setIsAddServiceModalOpen(true)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Service
              </Button>
              
              <select 
                className="appearance-none bg-white pl-3 pr-8 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              >
                <option>Last 24 hours</option>
                <option>Last 7 days</option>
                <option>Last 30 days</option>
                <option>Custom range</option>
              </select>
              
              <Button variant="outline" className="inline-flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </Button>
            </div>
          </div>
          
          {/* Status Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatusCard
              title="Active Services"
              value={onlineServices}
              icon={<CheckCircle2 className="h-6 w-6" />}
              iconBg="bg-green-100"
              iconColor="text-green-500"
              borderColor="border-green-500"
              trend={{
                value: "+2",
                label: "services",
                timeframe: "last 24h",
                isPositive: true
              }}
              isLoading={isLoadingStats}
            />
            
            <StatusCard
              title="Offline Services"
              value={offlineServices}
              icon={<AlertCircle className="h-6 w-6" />}
              iconBg="bg-red-100"
              iconColor="text-red-500"
              borderColor="border-red-500"
              trend={{
                value: "+1",
                label: "service",
                timeframe: "last 2h",
                isPositive: false
              }}
              isLoading={isLoadingStats}
            />
            
            <StatusCard
              title="Warnings"
              value={degradedServices}
              icon={<AlertTriangle className="h-6 w-6" />}
              iconBg="bg-yellow-100"
              iconColor="text-yellow-500"
              borderColor="border-yellow-500"
              trend={{
                value: "-3",
                label: "warnings",
                timeframe: "",
                isPositive: true
              }}
              isLoading={isLoadingStats}
            />
            
            <StatusCard
              title="Avg Response Time"
              value={`${avgResponseTime}ms`}
              icon={<Clock className="h-6 w-6" />}
              iconBg="bg-blue-100"
              iconColor="text-blue-500"
              borderColor="border-blue-500"
              trend={{
                value: "-18ms",
                label: "faster",
                timeframe: "",
                isPositive: true
              }}
              isLoading={isLoadingStats}
            />
          </div>
          
          {/* Service Canvas */}
          <ServiceCanvas 
            services={filteredServices} 
            connections={connections}
            isLoading={isLoadingServices || isLoadingConnections}
            onAddService={() => setIsAddServiceModalOpen(true)}
          />
          
          {/* Recent Alerts and Stats */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium">Recent Alerts</CardTitle>
                <Button variant="link" className="text-sm p-0">View All</Button>
              </CardHeader>
              <CardContent className="divide-y divide-gray-200">
                {isLoadingAlerts ? (
                  <div className="py-6 text-center text-gray-500">Loading alerts...</div>
                ) : recentAlerts.length > 0 ? (
                  recentAlerts.map(alert => (
                    <AlertItem 
                      key={alert.id}
                      alert={alert}
                      service={services.find(s => s.id === alert.serviceId)}
                    />
                  ))
                ) : (
                  <div className="py-6 text-center text-gray-500">No alerts found</div>
                )}
              </CardContent>
            </Card>
            
            <StatsPanel 
              services={services}
              isLoading={isLoadingServices}
            />
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
