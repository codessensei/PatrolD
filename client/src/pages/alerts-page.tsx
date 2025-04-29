import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Bell, BellOff, Check, Clock, History, Search, Wrench } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

type Alert = {
  id: number;
  userId: number;
  serviceId: number;
  type: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
};

export default function AlertsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState({
    outage: true,
    recovery: true,
    degraded: true,
    status_change: true,
    acknowledged: false
  });

  // Alert verilerini almak için sorgu
  const { data: alerts = [], isLoading, error } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    refetchInterval: 30000, // 30 saniyede bir yenile
  });

  // Alert'i kabul etmek için mutasyon
  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: number) => {
      const response = await apiRequest("PUT", `/api/alerts/${alertId}/acknowledge`);
      return await response.json();
    },
    onSuccess: () => {
      // Başarılı mutasyondan sonra verileri yeniden getir
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
    }
  });

  // Filtreleme ve arama
  const filteredAlerts = alerts
    .filter(alert => {
      if (searchTerm && !alert.message.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      if (!filter[alert.type as keyof typeof filter]) {
        return false;
      }
      
      if (!filter.acknowledged && alert.acknowledged) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Alert tipi badge'leri için renk ve ikon belirleme
  const getAlertTypeInfo = (type: string) => {
    switch (type) {
      case 'outage':
        return { color: 'text-red-600 bg-red-100 border-red-200', icon: <AlertTriangle className="h-3.5 w-3.5" /> };
      case 'recovery':
        return { color: 'text-green-600 bg-green-100 border-green-200', icon: <Check className="h-3.5 w-3.5" /> };
      case 'degraded':
        return { color: 'text-amber-600 bg-amber-100 border-amber-200', icon: <Wrench className="h-3.5 w-3.5" /> };
      case 'status_change':
        return { color: 'text-blue-600 bg-blue-100 border-blue-200', icon: <History className="h-3.5 w-3.5" /> };
      default:
        return { color: 'text-gray-600 bg-gray-100 border-gray-200', icon: <Bell className="h-3.5 w-3.5" /> };
    }
  };

  // Tarih ve saati formatla
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('tr-TR', { 
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar />
      
      <div className="md:ml-64 min-h-screen">
        <Topbar title="Alerts" />
        
        <main className="p-4 md:p-6 max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Service Alerts</h1>
            <p className="text-slate-600 dark:text-slate-400">Monitor and manage alerts from your services</p>
          </div>
          
          <div className="grid grid-cols-1 gap-6 mb-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Alert Filters</CardTitle>
                <CardDescription>Customize which alerts you want to see</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[240px]">
                    <Label htmlFor="search" className="text-xs font-medium mb-1.5 block">Search Alerts</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                      <Input 
                        id="search"
                        placeholder="Search by message..." 
                        className="pl-9" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-[240px]">
                    <Label className="text-xs font-medium mb-1.5 block">Alert Types</Label>
                    <div className="flex flex-wrap gap-3">
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id="filter-outage" 
                          checked={filter.outage}
                          onCheckedChange={(checked) => setFilter({...filter, outage: checked === true})}
                        />
                        <Label htmlFor="filter-outage" className="text-sm flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                          Outages
                        </Label>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id="filter-recovery" 
                          checked={filter.recovery}
                          onCheckedChange={(checked) => setFilter({...filter, recovery: checked === true})}
                        />
                        <Label htmlFor="filter-recovery" className="text-sm flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5 text-green-500" />
                          Recoveries
                        </Label>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id="filter-degraded" 
                          checked={filter.degraded}
                          onCheckedChange={(checked) => setFilter({...filter, degraded: checked === true})}
                        />
                        <Label htmlFor="filter-degraded" className="text-sm flex items-center gap-1.5">
                          <Wrench className="h-3.5 w-3.5 text-amber-500" />
                          Degraded
                        </Label>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id="filter-status-change" 
                          checked={filter.status_change}
                          onCheckedChange={(checked) => setFilter({...filter, status_change: checked === true})}
                        />
                        <Label htmlFor="filter-status-change" className="text-sm flex items-center gap-1.5">
                          <History className="h-3.5 w-3.5 text-blue-500" />
                          Status Changes
                        </Label>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id="filter-acknowledged" 
                          checked={filter.acknowledged}
                          onCheckedChange={(checked) => setFilter({...filter, acknowledged: checked === true})}
                        />
                        <Label htmlFor="filter-acknowledged" className="text-sm flex items-center gap-1.5">
                          <BellOff className="h-3.5 w-3.5 text-slate-500" />
                          Show Acknowledged
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Service Alerts</CardTitle>
                <CardDescription>
                  {isLoading ? 'Loading alerts...' : 
                    `Showing ${filteredAlerts.length} of ${alerts.length} alerts`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center items-center h-60">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center h-60 text-center">
                    <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
                    <h3 className="text-lg font-medium text-red-800 dark:text-red-400">Error Loading Alerts</h3>
                    <p className="text-slate-600 dark:text-slate-400 max-w-md mt-2">
                      There was a problem loading your alerts. Please try again.
                    </p>
                  </div>
                ) : filteredAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-60 text-center">
                    <Bell className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
                    <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">No Alerts Found</h3>
                    <p className="text-slate-500 dark:text-slate-400 max-w-md mt-2">
                      {searchTerm || Object.values(filter).some(f => !f) 
                        ? "Try adjusting your filters to see more alerts."
                        : "You don't have any alerts yet. Alerts will appear here when your services change status."}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredAlerts.map((alert) => {
                      const { color, icon } = getAlertTypeInfo(alert.type);
                      return (
                        <div 
                          key={alert.id}
                          className={cn(
                            "py-4 px-1 flex items-start gap-4",
                            alert.acknowledged && "opacity-60"
                          )}
                        >
                          <div className="flex-shrink-0 mt-1">
                            {icon}
                          </div>
                          <div className="flex-grow">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className={cn("text-xs font-medium", color)}>
                                {alert.type.replace('_', ' ')}
                              </Badge>
                              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(alert.timestamp)}
                              </span>
                            </div>
                            <p className="text-slate-800 dark:text-slate-200 text-sm mb-1.5">
                              {alert.message}
                            </p>
                            {alert.acknowledged ? (
                              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Check className="h-3 w-3" /> Acknowledged
                              </span>
                            ) : (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-xs px-2 h-7 text-slate-600 hover:text-slate-900"
                                onClick={() => acknowledgeMutation.mutate(alert.id)}
                                disabled={acknowledgeMutation.isPending}
                              >
                                {acknowledgeMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <Check className="h-3 w-3 mr-1" />
                                )}
                                Acknowledge
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}