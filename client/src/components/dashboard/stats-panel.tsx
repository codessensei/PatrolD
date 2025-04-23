import { Service } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Server } from "lucide-react";

interface StatsPanelProps {
  services: Service[];
  isLoading?: boolean;
}

export default function StatsPanel({ services, isLoading = false }: StatsPanelProps) {
  // Calculate stats
  const totalServices = services.length;
  const onlinePercentage = totalServices > 0 
    ? Math.round((services.filter(s => s.status === "online").length / totalServices) * 100) 
    : 0;
  
  const avgResponseTime = services.length > 0 
    ? Math.round(
        services
          .filter(s => s.responseTime !== undefined && s.responseTime !== null)
          .reduce((sum, s) => sum + (s.responseTime || 0), 0) / 
        services.filter(s => s.responseTime !== undefined && s.responseTime !== null).length
      )
    : 0;
  
  const errorRate = totalServices > 0 
    ? Math.round((services.filter(s => s.status === "offline").length / totalServices) * 100) 
    : 0;
  
  // Top traffic services (we're simulating this based on response time for now)
  const topServices = [...services]
    .sort((a, b) => (b.responseTime || 0) - (a.responseTime || 0))
    .slice(0, 3);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Quick Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="h-2.5 w-full mb-6" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="h-2.5 w-full mb-6" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="h-2.5 w-full mb-6" />
            </div>

            <Skeleton className="h-4 w-32 mb-3 mt-6" />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Skeleton className="w-8 h-8 rounded-md mr-3" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Skeleton className="w-8 h-8 rounded-md mr-3" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Quick Stats</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-500">Overall Uptime</span>
              <span className="text-sm font-medium text-gray-900">{onlinePercentage}%</span>
            </div>
            <Progress value={onlinePercentage} className="h-2.5 mb-6" indicatorClassName="bg-green-500" />
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-500">Avg Response Time</span>
              <span className="text-sm font-medium text-gray-900">{avgResponseTime}ms</span>
            </div>
            <Progress value={avgResponseTime > 1000 ? 100 : (avgResponseTime / 10)} className="h-2.5 mb-6" indicatorClassName="bg-blue-500" />
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-500">Error Rate</span>
              <span className="text-sm font-medium text-gray-900">{errorRate}%</span>
            </div>
            <Progress value={errorRate} className="h-2.5 mb-6" indicatorClassName="bg-red-500" />
          </div>
          
          <h4 className="text-sm font-medium text-gray-700 mb-3 mt-6">Highest Traffic</h4>
          <div className="space-y-3">
            {topServices.map(service => (
              <div key={service.id} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-md bg-primary-100 flex items-center justify-center mr-3">
                    <Server className="h-4 w-4 text-primary-500" />
                  </div>
                  <span className="text-sm text-gray-700">{service.name}</span>
                </div>
                <span className="text-sm text-gray-500">
                  {Math.floor(Math.random() * 5) + 1}.{Math.floor(Math.random() * 9)}K req/min
                </span>
              </div>
            ))}
            
            {topServices.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-2">No services available</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
