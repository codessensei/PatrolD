import { Alert, Service } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AlertItemProps {
  alert: Alert;
  service?: Service;
}

export default function AlertItem({ alert, service }: AlertItemProps) {
  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (alertId: number) => {
      await apiRequest("PUT", `/api/alerts/${alertId}/acknowledge`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
    },
  });

  // Get formatted time
  const timeAgo = alert.timestamp 
    ? formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })
    : "Unknown time";

  // Get alert icon and background color based on type
  const getAlertIcon = () => {
    switch (alert.type) {
      case "status_change":
        return <AlertCircle className="text-lg text-red-500" />;
      case "degraded":
        return <AlertTriangle className="text-lg text-yellow-500" />;
      case "recovery":
        return <CheckCircle className="text-lg text-green-500" />;
      default:
        return <AlertTriangle className="text-lg text-gray-500" />;
    }
  };

  const getAlertBackground = () => {
    switch (alert.type) {
      case "status_change":
        return "bg-red-100";
      case "degraded":
        return "bg-yellow-100";
      case "recovery":
        return "bg-green-100";
      default:
        return "bg-gray-100";
    }
  };

  // Handle restart button click
  const handleRestart = () => {
    // This would typically trigger a service restart API call
    console.log(`Restart service ${service?.id}`);
  };

  return (
    <div className={cn("p-4", alert.acknowledged ? "bg-gray-50/50" : "hover:bg-gray-50")}>
      <div className="flex items-start">
        <div className="flex-shrink-0 mt-0.5">
          <span className={cn(
            "inline-flex items-center justify-center h-8 w-8 rounded-full",
            getAlertBackground()
          )}>
            {getAlertIcon()}
          </span>
        </div>
        <div className="ml-3 flex-1">
          <div className="flex items-center justify-between">
            <p className={cn(
              "text-sm font-medium",
              alert.acknowledged ? "text-gray-500" : "text-gray-900"
            )}>
              {service?.name || "Unknown Service"}: {alert.message}
            </p>
            <p className="text-xs text-gray-500">{timeAgo}</p>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {service ? `${service.host}:${service.port}` : "Service details not available"}
          </p>
          
          {!alert.acknowledged && (
            <div className="mt-2 flex">
              <Button 
                variant="outline" 
                size="sm"
                className="text-xs"
                onClick={() => acknowledgeAlertMutation.mutate(alert.id)}
                disabled={acknowledgeAlertMutation.isPending}
              >
                Acknowledge
              </Button>
              {alert.type === "status_change" && (
                <Button 
                  variant="default" 
                  size="sm"
                  className="ml-2 text-xs"
                  onClick={handleRestart}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Restart
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
