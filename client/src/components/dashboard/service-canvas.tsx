import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Service, Connection } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { 
  ZoomIn, 
  ZoomOut, 
  RefreshCw, 
  Maximize, 
  Plus,
  Server 
} from "lucide-react";

interface ServiceCanvasProps {
  services: Service[];
  connections: Connection[];
  isLoading?: boolean;
  onAddService: () => void;
}

interface Position {
  x: number;
  y: number;
}

export default function ServiceCanvas({ 
  services, 
  connections,
  isLoading = false,
  onAddService 
}: ServiceCanvasProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [draggingService, setDraggingService] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [servicePositions, setServicePositions] = useState<Record<number, Position>>({});

  // Initialize service positions based on their stored positions
  useEffect(() => {
    const positions: Record<number, Position> = {};
    services.forEach(service => {
      positions[service.id] = { 
        x: service.positionX, 
        y: service.positionY 
      };
    });
    setServicePositions(positions);
  }, [services]);

  // Mutation to update service position
  const updateServicePosition = useMutation({
    mutationFn: async (data: { id: number, x: number, y: number }) => {
      const { id, x, y } = data;
      await apiRequest("PUT", `/api/services/${id}`, { positionX: x, positionY: y });
    },
    onError: (error) => {
      toast({
        title: "Failed to save position",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle service drag start
  const handleDragStart = (
    e: React.MouseEvent<HTMLDivElement>,
    serviceId: number
  ) => {
    if (!canvasRef.current) return;
    
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const servicePosition = servicePositions[serviceId] || { x: 0, y: 0 };
    
    // Calculate offset from the mouse position to the service's origin
    const offsetX = e.clientX - canvasRect.left - servicePosition.x;
    const offsetY = e.clientY - canvasRect.top - servicePosition.y;
    
    setDragOffset({ x: offsetX, y: offsetY });
    setDraggingService(serviceId);
    
    // Prevent text selection during drag
    e.preventDefault();
  };

  // Handle service drag
  const handleDrag = useCallback((e: MouseEvent) => {
    if (draggingService === null || !canvasRef.current) return;
    
    const canvasRect = canvasRef.current.getBoundingClientRect();
    
    // Calculate new position based on mouse position minus the drag offset
    let newX = e.clientX - canvasRect.left - dragOffset.x;
    let newY = e.clientY - canvasRect.top - dragOffset.y;
    
    // Ensure service stays within canvas bounds
    newX = Math.max(0, Math.min(newX, canvasRect.width - 160)); // Assuming service width is 160px
    newY = Math.max(0, Math.min(newY, canvasRect.height - 120)); // Assuming service height is ~120px
    
    // Update position state
    setServicePositions(prev => ({
      ...prev,
      [draggingService]: { x: newX, y: newY }
    }));
    
  }, [draggingService, dragOffset]);

  // Handle service drag end
  const handleDragEnd = useCallback(() => {
    if (draggingService !== null) {
      const position = servicePositions[draggingService];
      if (position) {
        // Save position to server
        updateServicePosition.mutate({
          id: draggingService,
          x: position.x,
          y: position.y
        });
      }
      setDraggingService(null);
    }
  }, [draggingService, servicePositions, updateServicePosition]);

  // Set up global event listeners for drag
  useEffect(() => {
    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', handleDragEnd);
    
    return () => {
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [handleDrag, handleDragEnd]);

  // Zoom functions
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.1, 2));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 0.5));
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/services"] });
    queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
  };

  const handleFullscreen = () => {
    if (canvasRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        canvasRef.current.requestFullscreen();
      }
    }
  };

  // Function to get connection color based on status
  const getConnectionColor = (status: string | null) => {
    if (!status) return "#9CA3AF"; // gray for null
    
    switch (status) {
      case "online": return "#10B981"; // green
      case "degraded": return "#F59E0B"; // yellow
      case "offline": return "#EF4444"; // red
      default: return "#9CA3AF"; // gray
    }
  };

  // Function to get status badge color
  const getStatusBadgeClass = (status: string | null) => {
    if (!status) return "bg-gray-100 text-gray-800";
    
    switch (status) {
      case "online": return "bg-green-100 text-green-800";
      case "degraded": return "bg-yellow-100 text-yellow-800";
      case "offline": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Function to get status indicator color
  const getStatusIndicatorClass = (status: string | null) => {
    if (!status) return "bg-gray-500";
    
    switch (status) {
      case "online": return "bg-green-500";
      case "degraded": return "bg-yellow-500";
      case "offline": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <CardTitle className="text-base font-medium">Service Map</CardTitle>
          <div className="flex items-center space-x-2">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </CardHeader>
        <div className="h-[600px] bg-gray-50 flex items-center justify-center">
          <Skeleton className="h-40 w-40 rounded-md" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between py-4">
        <CardTitle className="text-base font-medium">Service Map</CardTitle>
        
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" onClick={handleZoomIn}>
            <ZoomIn className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleZoomOut}>
            <ZoomOut className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleFullscreen}>
            <Maximize className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>
      
      {/* Service Canvas Area */}
      <div 
        ref={canvasRef}
        className="relative h-[600px] overflow-auto canvas-grid p-4"
        style={{
          backgroundSize: "20px 20px",
          backgroundImage: `
            linear-gradient(to right, rgba(203, 213, 225, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(203, 213, 225, 0.1) 1px, transparent 1px)
          `,
          transform: `scale(${zoom})`,
          transformOrigin: "top left"
        }}
      >
        {/* SVG for Connection Lines */}
        <svg ref={svgRef} className="absolute top-0 left-0 w-full h-full pointer-events-none">
          {connections.map(connection => {
            const source = servicePositions[connection.sourceId];
            const target = servicePositions[connection.targetId];
            
            if (!source || !target) return null;
            
            // Calculate center positions for source and target
            const sourceX = source.x + 80; // Half of service width (160px)
            const sourceY = source.y + 60; // Half of service height (~120px)
            const targetX = target.x + 80;
            const targetY = target.y + 60;
            
            return (
              <line 
                key={connection.id}
                x1={sourceX} 
                y1={sourceY} 
                x2={targetX} 
                y2={targetY}
                className="connection-line" 
                stroke={getConnectionColor(connection.status)}
                strokeWidth={2}
              />
            );
          })}
        </svg>

        {/* Service Nodes */}
        {services.map(service => {
          const position = servicePositions[service.id] || { x: 0, y: 0 };
          
          return (
            <div 
              key={service.id}
              className="service-node absolute bg-card dark:bg-card rounded-xl shadow-lg border-2 overflow-hidden transition-all duration-200 hover:shadow-xl"
              style={{
                width: "180px",
                left: `${position.x}px`,
                top: `${position.y}px`,
                zIndex: draggingService === service.id ? 100 : 1,
                cursor: draggingService === service.id ? "grabbing" : "grab",
                borderColor: service.status === "online" ? "rgb(16, 185, 129)" : 
                             service.status === "offline" ? "rgb(239, 68, 68)" : 
                             service.status === "degraded" ? "rgb(245, 158, 11)" : "rgb(156, 163, 175)"
              }}
              onMouseDown={(e) => handleDragStart(e, service.id)}
            >
              <div className={cn(
                "px-4 py-2 flex items-center justify-between",
                service.status === "online" ? "bg-gradient-to-r from-green-500 to-green-600" : 
                service.status === "offline" ? "bg-gradient-to-r from-red-500 to-red-600" : 
                service.status === "degraded" ? "bg-gradient-to-r from-yellow-500 to-yellow-600" : 
                "bg-gradient-to-r from-gray-500 to-gray-600"
              )}>
                <span className="text-white font-medium truncate">{service.type}</span>
                <span className={cn(
                  "w-3 h-3 rounded-full",
                  service.status === "online" ? "bg-green-300" : 
                  service.status === "offline" ? "bg-red-300" : 
                  service.status === "degraded" ? "bg-yellow-300" : "bg-gray-300"
                )}></span>
              </div>
              <div className="p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-bold text-foreground">{service.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{service.host}:{service.port}</p>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className={cn(
                    "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                    service.status === "online" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : 
                    service.status === "offline" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100" : 
                    service.status === "degraded" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100" : 
                    "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                  )}>
                    {service.status === "online" ? "Online" : 
                     service.status === "offline" ? "Offline" : 
                     service.status === "degraded" ? "Degraded" : "Unknown"}
                  </span>
                  <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                    {service.responseTime 
                      ? `${service.responseTime}ms` 
                      : service.status === "offline" 
                        ? "Timeout" 
                        : "-"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Add New Service Button */}
        <div 
          className="service-node absolute bg-card dark:bg-card rounded-xl border-2 border-dashed border-primary p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-accent transition-all duration-200 shadow-md hover:shadow-lg"
          style={{
            width: "180px",
            left: "380px",
            top: "520px",
          }}
          onClick={onAddService}
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Plus className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm font-medium text-primary">Add New Service</p>
        </div>
      </div>
    </Card>
  );
}
