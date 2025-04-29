import { Alert, Service } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, CheckCircle, RefreshCw, Clock, Server } from "lucide-react";
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

  // Get alert icon and color based on type
  const getAlertIcon = () => {
    switch (alert.type) {
      case "status_change":
        return <AlertCircle className="h-5 w-5" />;
      case "degraded":
        return <AlertTriangle className="h-5 w-5" />;
      case "recovery":
        return <CheckCircle className="h-5 w-5" />;
      default:
        return <AlertTriangle className="h-5 w-5" />;
    }
  };

  const getAlertColor = () => {
    switch (alert.type) {
      case "status_change":
        return "text-red-500 bg-red-400/10";
      case "degraded":
        return "text-amber-500 bg-amber-400/10";
      case "recovery":
        return "text-emerald-500 bg-emerald-400/10";
      default:
        return "text-slate-500 bg-slate-400/10";
    }
  };

  const getAlertGlow = () => {
    switch (alert.type) {
      case "status_change":
        return "shadow-red-500/20";
      case "degraded":
        return "shadow-amber-500/20";
      case "recovery":
        return "shadow-emerald-500/20";
      default:
        return "shadow-slate-500/10";
    }
  };

  // Handle restart button click
  const handleRestart = () => {
    console.log(`Restart service ${service?.id}`);
  };

  return (
    <div className={cn(
      "rounded-xl backdrop-blur-sm transition-all duration-300 overflow-hidden",
      alert.acknowledged 
        ? "bg-white/20 dark:bg-slate-800/10 opacity-60" 
        : "bg-white/30 dark:bg-slate-800/20 hover:bg-white/40 dark:hover:bg-slate-800/30 shadow-md hover:shadow-lg",
      getAlertGlow()
    )}>
      <div className="p-4">
        <div className="flex gap-4">
          <div className={cn(
            "flex-shrink-0 rounded-full w-10 h-10 flex items-center justify-center",
            getAlertColor()
          )}>
            {getAlertIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-1">
              <h4 className={cn(
                "font-medium truncate",
                alert.acknowledged ? "text-slate-500 dark:text-slate-400" : "text-slate-900 dark:text-white"
              )}>
                {service?.name || "Unknown Service"}
              </h4>
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 ml-2">
                <Clock className="h-3 w-3" />
                {timeAgo}
              </div>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">
              {alert.message}
            </p>
            
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <Server className="h-3 w-3" />
              <span>
                {service ? `${service.host}:${service.port}` : "Service details not available"}
              </span>
            </div>
            
            {!alert.acknowledged && (
              <div className="mt-3 flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="glass-button text-xs h-8"
                  onClick={() => acknowledgeAlertMutation.mutate(alert.id)}
                  disabled={acknowledgeAlertMutation.isPending}
                >
                  {acknowledgeAlertMutation.isPending ? (
                    <div className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full mr-1"></div>
                  ) : null}
                  Acknowledge
                </Button>
                
                {alert.type === "status_change" && (
                  <Button 
                    size="sm"
                    className="glass-button text-xs h-8 bg-blue-500/20 hover:bg-blue-500/30"
                    onClick={handleRestart}
                  >
                    <RefreshCw className="h-3 w-3 mr-1.5" />
                    Restart
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
