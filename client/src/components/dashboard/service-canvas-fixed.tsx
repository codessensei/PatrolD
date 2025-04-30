import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Service, Connection, Agent } from "@shared/schema";
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
  Server,
  Cpu,
  PlusCircle
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
  const [agentPositions, setAgentPositions] = useState<Record<number, Position>>({});
  const [draggingAgent, setDraggingAgent] = useState<number | null>(null);
  
  // Query agents
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  // Initialize service positions based on their stored positions
  useEffect(() => {
    const positions: Record<number, Position> = {};
    let needsAutoLayout = false;
    
    services.forEach(service => {
      // Check if service has valid position or if multiple services are at the same position
      if (service.positionX === 0 && service.positionY === 0) {
        needsAutoLayout = true;
      } else if (services.some(s => 
        s.id !== service.id && 
        Math.abs(s.positionX - service.positionX) < 50 && 
        Math.abs(s.positionY - service.positionY) < 50
      )) {
        needsAutoLayout = true;
      }
      
      positions[service.id] = { 
        x: service.positionX, 
        y: service.positionY 
      };
    });
    
    // If services need auto layout, arrange them in a grid
    if (needsAutoLayout) {
      const canvasWidth = canvasRef.current?.clientWidth || 1000;
      const itemsPerRow = Math.max(Math.floor(canvasWidth / 250), 3);
      
      services.forEach((service, index) => {
        const col = index % itemsPerRow;
        const row = Math.floor(index / itemsPerRow);
        
        // Distribute services in a grid with appropriate spacing
        positions[service.id] = { 
          x: 100 + col * 250, 
          y: 100 + row * 200 
        };
        
        // Save the new position to the backend
        updateServicePosition.mutate({
          id: service.id,
          x: positions[service.id].x,
          y: positions[service.id].y
        });
      });
    }
    
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

  // Initialize agent positions with default values
  useEffect(() => {
    // Only initialize positions for agents that don't already have positions
    const positions: Record<number, Position> = { ...agentPositions };
    let updated = false;
    
    agents.forEach((agent, index) => {
      if (!positions[agent.id]) {
        // Arrange agents in a grid layout if no position is provided
        positions[agent.id] = { 
          x: 50 + (index % 3) * 220, 
          y: 50 + Math.floor(index / 3) * 200 
        };
        updated = true;
      }
    });
    
    if (updated) {
      setAgentPositions(positions);
    }
  }, [agents, agentPositions]);

  // Handle service drag start
  const handleDragStart = (
    e: React.MouseEvent<HTMLDivElement>,
    serviceId: number
  ) => {
    if (!canvasRef.current) return;
    
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const servicePosition = servicePositions[serviceId] || { x: 0, y: 0 };
    
    // Calculate offset from the mouse position to the service's origin
    const offsetX = (e.clientX - canvasRect.left) / zoom - servicePosition.x;
    const offsetY = (e.clientY - canvasRect.top) / zoom - servicePosition.y;
    
    setDragOffset({ x: offsetX, y: offsetY });
    setDraggingService(serviceId);
    
    // Prevent text selection during drag
    e.preventDefault();
  };
  
  // Handle agent drag start
  const handleAgentDragStart = (
    e: React.MouseEvent<HTMLDivElement>,
    agentId: number
  ) => {
    if (!canvasRef.current) return;
    
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const agentPosition = agentPositions[agentId] || { x: 0, y: 0 };
    
    // Calculate offset from the mouse position to the agent's origin
    const offsetX = (e.clientX - canvasRect.left) / zoom - agentPosition.x;
    const offsetY = (e.clientY - canvasRect.top) / zoom - agentPosition.y;
    
    setDragOffset({ x: offsetX, y: offsetY });
    setDraggingAgent(agentId);
    
    // Prevent text selection during drag
    e.preventDefault();
  };

  // Handle drag (for both services and agents)
  const handleDrag = useCallback((e: MouseEvent) => {
    if (!canvasRef.current) return;
    
    if (draggingService === null && draggingAgent === null) return;
    
    const canvasRect = canvasRef.current.getBoundingClientRect();
    
    // Get the zoom-adjusted mouse position
    const mouseX = (e.clientX - canvasRect.left) / zoom;
    const mouseY = (e.clientY - canvasRect.top) / zoom;
    
    // Calculate new position based on mouse position minus the drag offset
    let newX = mouseX - dragOffset.x;
    let newY = mouseY - dragOffset.y;
    
    // Ensure element stays within canvas bounds
    const canvasWidth = canvasRect.width / zoom;
    const canvasHeight = canvasRect.height / zoom;
    
    newX = Math.max(0, Math.min(newX, canvasWidth - 180)); // Width of 180px
    newY = Math.max(0, Math.min(newY, canvasHeight - 160)); // Height ~160px
    
    // Update position state based on what's being dragged
    if (draggingService !== null) {
      setServicePositions(prev => ({
        ...prev,
        [draggingService]: { x: newX, y: newY }
      }));
    } else if (draggingAgent !== null) {
      setAgentPositions(prev => ({
        ...prev,
        [draggingAgent]: { x: newX, y: newY }
      }));
    }
    
  }, [draggingService, draggingAgent, dragOffset, zoom]);

  // Handle drag end
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
    
    if (draggingAgent !== null) {
      // In a real app, you might save agent positions too
      // For now, just clear the dragging state
      setDraggingAgent(null);
    }
  }, [draggingService, draggingAgent, servicePositions, updateServicePosition]);

  // Set up global event listeners for drag
  useEffect(() => {
    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', handleDragEnd);
    
    return () => {
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [handleDrag, handleDragEnd]);

  // Zoom functions with improved scaling
  const handleZoomIn = () => {
    setZoom(prev => {
      // Use a faster zoom rate for better scaling experience
      const newZoom = Math.min(prev * 1.2, 3);
      // Round to 2 decimal places to avoid tiny floating point issues
      return Math.round(newZoom * 100) / 100;
    });
  };

  const handleZoomOut = () => {
    setZoom(prev => {
      // Use a proportional decrease for smoother zoom out
      const newZoom = Math.max(prev / 1.2, 0.3);
      // Round to 2 decimal places
      return Math.round(newZoom * 100) / 100;
    });
  };
  
  // Reset zoom to default
  const handleResetZoom = () => {
    setZoom(1);
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
        <div className="flex items-center gap-3">
          <CardTitle className="text-base font-medium">Service Map</CardTitle>
          <span className="text-xs bg-muted px-2 py-1 rounded-md font-mono">
            Zoom: {Math.round(zoom * 100)}%
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" onClick={handleZoomIn} title="Zoom In">
            <ZoomIn className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleZoomOut} title="Zoom Out">
            <ZoomOut className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleResetZoom} title="Reset Zoom">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
              <path d="M12 12h.01" />
            </svg>
          </Button>
          <Button variant="ghost" size="icon" onClick={handleRefresh} title="Refresh Map">
            <RefreshCw className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleFullscreen} title="Fullscreen">
            <Maximize className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>
      
      {/* Service Canvas Area with improved scaling */}
      <div className="relative min-h-[500px] h-[calc(100vh-15rem)] overflow-hidden">
        {/* Zoom indicator overlay */}
        {zoom !== 1 && (
          <div className="absolute bottom-4 right-4 z-30 bg-slate-800/80 dark:bg-slate-900/80 text-white py-1 px-2 rounded-md text-xs font-mono flex items-center gap-2">
            <span>{Math.round(zoom * 100)}%</span>
            <button 
              onClick={handleResetZoom}
              className="text-xs text-slate-300 hover:text-white"
            >
              Reset
            </button>
          </div>
        )}
        
        {/* Add Service Button (Fixed Position) */}
        <button
          onClick={onAddService}
          className="absolute right-4 top-4 z-30 flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-3 py-2 rounded-md shadow-md"
        >
          <PlusCircle className="h-4 w-4" />
          <span className="font-medium text-sm">Add Service</span>
        </button>
        
        <div 
          ref={canvasRef}
          className="relative h-full w-full overflow-auto canvas-grid p-8"
          style={{
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundImage: `
              linear-gradient(to right, rgba(203, 213, 225, 0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(203, 213, 225, 0.1) 1px, transparent 1px)
            `,
            transform: `scale(${zoom})`,
            transformOrigin: "top left"
          }}
        >
          {/* SVG for Service-to-Service Connection Lines with Animation */}
          <svg ref={svgRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 15 }}>
            {/* First render regular service-to-service connections */}
            {connections.map(connection => {
              // Check if both source and target are services without agent monitoring
              const source = servicePositions[connection.sourceId];
              const target = servicePositions[connection.targetId];
              
              if (!source || !target) return null;
              
              // Calculate center positions for source and target
              const sourceX = source.x + 90; // Half of service width
              const sourceY = source.y + 60; // Half of service height
              const targetX = target.x + 90;
              const targetY = target.y + 60;
              
              // Calculate line length for animation
              const dx = targetX - sourceX;
              const dy = targetY - sourceY;
              
              // Get color based on status
              let connectionColor;
              if (connection.status === "online") {
                connectionColor = "#10b981"; // Green
              } else if (connection.status === "offline") {
                connectionColor = "#ef4444"; // Red
              } else if (connection.status === "degraded") {
                connectionColor = "#f59e0b"; // Amber
              } else {
                connectionColor = "#9ca3af"; // Gray
              }
              
              // Use a nice curved path instead of a straight line
              const midX = (sourceX + targetX) / 2;
              const midY = (sourceY + targetY) / 2;
              
              // Offset to create a curved path
              const offsetX = -dy * 0.2; // Perpendicular to the line
              const offsetY = dx * 0.2;
              
              // Create the path for a bezier curve
              const path = `M${sourceX},${sourceY} Q${midX + offsetX},${midY + offsetY} ${targetX},${targetY}`;
              
              return (
                <g key={connection.id}>
                  {/* Base connection line */}
                  <path 
                    d={path}
                    fill="none"
                    stroke={connectionColor}
                    strokeWidth={connection.status === "online" ? 3 : 2}
                    opacity={connection.status === "online" ? 0.8 : 0.5}
                  />
                  
                  {/* Online connection animations - Floating dots */}
                  {connection.status === "online" && (
                    <>
                      {/* Special animated line for online connections */}
                      <path 
                        d={path}
                        fill="none"
                        stroke={connectionColor}
                        strokeWidth={2}
                        strokeDasharray="5,5"
                        opacity={0.7}
                      >
                        <animate 
                          attributeName="stroke-dashoffset" 
                          from="0" 
                          to="10" 
                          dur="1s"
                          repeatCount="indefinite" 
                        />
                      </path>
                      
                      {/* Animated circle flowing along the path */}
                      <circle r="3" fill={connectionColor}>
                        <animateMotion
                          path={path}
                          dur="3s"
                          repeatCount="indefinite"
                        />
                      </circle>
                      
                      <circle r="2" fill={connectionColor}>
                        <animateMotion
                          path={path}
                          dur="4s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    </>
                  )}
                  
                  {/* Degraded connection animations */}
                  {connection.status === "degraded" && (
                    <path 
                      d={path}
                      fill="none"
                      stroke={connectionColor}
                      strokeWidth={2}
                      strokeDasharray="3,6"
                      opacity={0.7}
                    >
                      <animate 
                        attributeName="stroke-dashoffset" 
                        from="0" 
                        to="9" 
                        dur="2s"
                        repeatCount="indefinite" 
                      />
                    </path>
                  )}
                  
                  {/* Direction indicator (arrow) */}
                  <polygon 
                    points="0,-5 10,0 0,5" 
                    fill={connectionColor} 
                    transform={`translate(${targetX - dx * 0.1}, ${targetY - dy * 0.1}) rotate(${Math.atan2(dy, dx) * 180 / Math.PI})`}
                    opacity={0.8}
                  />
                </g>
              );
            })}
            
            {/* Then render connections from Agent to monitored services */}
            {services.map(service => {
              // Skip services that don't have an agent assigned
              if (!service.agentId) return null;
              
              const agent = agents.find(a => a.id === service.agentId);
              if (!agent) return null;
              
              const sourcePos = agentPositions[agent.id];
              const targetPos = servicePositions[service.id];
              
              if (!sourcePos || !targetPos) return null;
              
              // Calculate center positions
              const sourceX = sourcePos.x + 100; // Half of agent width
              const sourceY = sourcePos.y + 60;  // Half of agent height
              const targetX = targetPos.x + 90;  // Half of service width
              const targetY = targetPos.y + 60;  // Half of service height
              
              // Create curved path
              const midX = (sourceX + targetX) / 2;
              const midY = (sourceY + targetY) / 2;
              const offsetX = (targetY - sourceY) * 0.1;
              const offsetY = (sourceX - targetX) * 0.1;
              const path = `M${sourceX},${sourceY} Q${midX + offsetX},${midY + offsetY} ${targetX},${targetY}`;
              
              // Determine color based on agent and service status
              let connectionColor;
              if (agent.status === "active") {
                if (service.status === "online") {
                  connectionColor = "#3b82f6"; // blue
                } else if (service.status === "degraded") {
                  connectionColor = "#f59e0b"; // amber
                } else if (service.status === "offline") {
                  connectionColor = "#ef4444"; // red
                } else {
                  connectionColor = "#9ca3af"; // gray
                }
              } else {
                connectionColor = "#9ca3af"; // gray for inactive agent
              }
              
              return (
                <g key={`agent-${agent.id}-service-${service.id}`}>
                  {/* Base connection line */}
                  <path 
                    d={path}
                    fill="none"
                    stroke={connectionColor}
                    strokeWidth={2}
                    strokeDasharray={agent.status === "active" ? "2,2" : "4,3"}
                    opacity={agent.status === "active" ? 0.8 : 0.5}
                  />
                  
                  {/* Active agent animations */}
                  {agent.status === "active" && (
                    <>
                      {/* Special animated line for active agents */}
                      <path 
                        d={path}
                        fill="none"
                        stroke={connectionColor}
                        strokeWidth={1.5}
                        strokeDasharray="4,4"
                        opacity={0.7}
                      >
                        <animate 
                          attributeName="stroke-dashoffset" 
                          from="0" 
                          to="8" 
                          dur="1.5s"
                          repeatCount="indefinite" 
                        />
                      </path>
                      
                      {/* Animated circle flowing along the path */}
                      <circle r="2.5" fill={connectionColor}>
                        <animateMotion
                          path={path}
                          dur="2.5s"
                          repeatCount="indefinite"
                        />
                      </circle>
                      
                      <circle r="2" fill={connectionColor}>
                        <animateMotion
                          path={path}
                          dur="3.5s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    </>
                  )}
                  
                  {/* Direction indicator */}
                  <polygon 
                    points="0,-4 8,0 0,4" 
                    fill={connectionColor} 
                    transform={`translate(${targetX - (targetX - sourceX) * 0.05}, ${targetY - (targetY - sourceY) * 0.05}) rotate(${Math.atan2(targetY - sourceY, targetX - sourceX) * 180 / Math.PI})`}
                    opacity={0.8}
                  />
                </g>
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
                  zIndex: draggingService === service.id ? 100 : 20,
                  cursor: draggingService === service.id ? "grabbing" : "grab",
                  borderColor: service.status === "online" ? "rgb(16, 185, 129)" : 
                               service.status === "offline" ? "rgb(239, 68, 68)" : 
                               service.status === "degraded" ? "rgb(245, 158, 11)" : "rgb(156, 163, 175)",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)"
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
                  <h3 className="font-medium text-white truncate">{service.name}</h3>
                  <div className={cn(
                    "w-3 h-3 rounded-full",
                    getStatusIndicatorClass(service.status)
                  )} />
                </div>
                
                <div className="p-3 text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground text-xs">Type:</span>
                    <span className="font-medium">{service.type === "http" ? "HTTP" : service.type === "tcp" ? "TCP" : service.type}</span>
                  </div>
                  
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground text-xs">Host:</span>
                    <span className="font-mono text-xs truncate max-w-[100px]">{service.host}</span>
                  </div>
                  
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground text-xs">Port:</span>
                    <span className="font-mono">{service.port}</span>
                  </div>
                  
                  {service.responseTime !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">Response:</span>
                      <span className={cn(
                        "font-mono text-xs",
                        service.responseTime > 500 ? "text-amber-500" : 
                        service.responseTime > 1000 ? "text-red-500" : 
                        "text-green-500"
                      )}>
                        {service.responseTime}ms
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {/* Agent Nodes */}
          {agents.map(agent => {
            const position = agentPositions[agent.id] || { x: 0, y: 0 };
            
            return (
              <div
                key={agent.id}
                className="agent-node absolute bg-slate-800 dark:bg-slate-900 rounded-xl shadow-lg border-2 border-slate-600 overflow-hidden transition-all duration-200 hover:shadow-xl"
                style={{
                  width: "200px",
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                  zIndex: draggingAgent === agent.id ? 100 : 20,
                  cursor: draggingAgent === agent.id ? "grabbing" : "grab"
                }}
                onMouseDown={(e) => handleAgentDragStart(e, agent.id)}
              >
                <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-4 py-2 flex items-center justify-between">
                  <h3 className="font-medium text-white truncate flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    {agent.name}
                  </h3>
                  <div className={cn(
                    "w-3 h-3 rounded-full",
                    agent.status === "active" ? "bg-green-500" : "bg-red-500"
                  )} />
                </div>
                
                <div className="p-3 text-sm text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 text-xs">Status:</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs",
                      agent.status === "active" ? "bg-green-900/50 text-green-500" : "bg-red-900/50 text-red-400"
                    )}>
                      {agent.status === "active" ? "Active" : "Offline"}
                    </span>
                  </div>
                  
                  {agent.serverInfo && typeof agent.serverInfo === 'object' && (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-xs">Host:</span>
                        <span className="font-mono text-xs truncate max-w-[110px]">
                          {agent.serverInfo && 
                           typeof agent.serverInfo === 'object' && 
                           'hostname' in agent.serverInfo && 
                           typeof agent.serverInfo.hostname === 'string'
                            ? agent.serverInfo.hostname
                            : 'Unknown'}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-xs">OS:</span>
                        <span className="font-mono text-xs">
                          {agent.serverInfo && 
                           typeof agent.serverInfo === 'object' && 
                           'platform' in agent.serverInfo &&
                           typeof agent.serverInfo.platform === 'string'
                            ? agent.serverInfo.platform
                            : 'Unknown'}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-xs">CPU Cores:</span>
                        <span className="font-mono text-xs">
                          {agent.serverInfo && 
                           typeof agent.serverInfo === 'object' && 
                           'cpus' in agent.serverInfo &&
                           typeof agent.serverInfo.cpus === 'number'
                            ? String(agent.serverInfo.cpus)
                            : 'N/A'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}