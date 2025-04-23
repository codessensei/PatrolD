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
  const getConnectionColor = (status: string) => {
    switch (status) {
      case "online": return "#10B981"; // green
      case "degraded": return "#F59E0B"; // yellow
      case "offline": return "#EF4444"; // red
      default: return "#9CA3AF"; // gray
    }
  };

  // Function to get status badge color
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "online": return "bg-green-100 text-green-800";
      case "degraded": return "bg-yellow-100 text-yellow-800";
      case "offline": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Function to get status indicator color
  const getStatusIndicatorClass = (status: string) => {
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
              className="service-node absolute bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden"
              style={{
                width: "160px",
                left: `${position.x}px`,
                top: `${position.y}px`,
                zIndex: draggingService === service.id ? 100 : 1,
                cursor: draggingService === service.id ? "grabbing" : "grab"
              }}
              onMouseDown={(e) => handleDragStart(e, service.id)}
            >
              <div className="bg-primary-500 text-white text-xs font-medium px-3 py-1">
                {service.type}
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{service.name}</span>
                  <span className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                    getStatusBadgeClass(service.status)
                  )}>
                    <span className={cn(
                      "w-2 h-2 rounded-full mr-1",
                      getStatusIndicatorClass(service.status)
                    )}></span>
                    {service.status === "online" ? "Online" : 
                     service.status === "offline" ? "Offline" : 
                     service.status === "degraded" ? "Degraded" : "Unknown"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{service.host}:{service.port}</span>
                  <span>
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
          className="service-node absolute bg-gray-50 rounded-lg border border-dashed border-gray-300 p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
          style={{
            width: "160px",
            left: "380px",
            top: "520px",
          }}
          onClick={onAddService}
        >
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center mb-2">
            <Plus className="h-5 w-5 text-gray-500" />
          </div>
          <p className="text-sm text-gray-500 font-medium">Add New Service</p>
        </div>
      </div>
    </Card>
  );
}
