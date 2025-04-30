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

  // Initialize service positions based on their stored positions with a smart layout
  useEffect(() => {
    const positions: Record<number, Position> = {};
    
    // Initial grid layout for better organization
    const gridCols = 4; // Define how many columns to use in the grid
    const itemWidth = 220; // Width of a service node + margin
    const itemHeight = 200; // Height of a service node + margin
    
    // Use stored positions if available or create a balanced grid layout
    services.forEach((service, index) => {
      // Check if the service already has a position stored
      if (service.positionX !== 0 || service.positionY !== 0) {
        // Use stored positions
        positions[service.id] = { 
          x: service.positionX, 
          y: service.positionY 
        };
      } else {
        // Calculate a grid position
        const col = index % gridCols;
        const row = Math.floor(index / gridCols);
        
        // Add some variation to make it look more natural
        const offsetX = Math.random() * 20 - 10;
        const offsetY = Math.random() * 20 - 10;
        
        positions[service.id] = {
          x: 50 + (col * itemWidth) + offsetX,
          y: 50 + (row * itemHeight) + offsetY
        };
      }
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
      <div className="relative h-[600px] overflow-hidden">
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
        
        <div 
          ref={canvasRef}
          className="relative h-full w-full overflow-auto canvas-grid p-4"
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
          {/* SVG for Connection Lines */}
          <svg ref={svgRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 15 }}>
            {/* Background gradient for connections */}
            <defs>
              <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            
            {connections.map(connection => {
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
              const lineLength = Math.sqrt(dx * dx + dy * dy);
              
              // Generate unique ID for this connection
              const connectionColor = getConnectionColor(connection.status);
              const glowColor = connection.status === "online" ? 
                               "rgba(16, 185, 129, 0.5)" : 
                               connection.status === "offline" ? 
                               "rgba(239, 68, 68, 0.5)" : 
                               connection.status === "degraded" ? 
                               "rgba(245, 158, 11, 0.5)" : 
                               "rgba(156, 163, 175, 0.3)";
              const animationId = `flow-${connection.id}`;
              
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
                  {/* Defs for the animated flow effect */}
                  <defs>
                    <linearGradient id={animationId} gradientUnits="userSpaceOnUse" x1={sourceX} y1={sourceY} x2={targetX} y2={targetY}>
                      <stop offset="0%" stopColor="rgba(255, 255, 255, 0)" />
                      <stop offset="50%" stopColor={connectionColor} />
                      <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
                    </linearGradient>
                    
                    {/* Dash array animation definition */}
                    <linearGradient id={`pulse-${animationId}`}>
                      <stop offset="0%" stopColor={connectionColor}>
                        <animate 
                          attributeName="offset" 
                          values="0;1" 
                          dur="4s" 
                          repeatCount="indefinite" 
                        />
                      </stop>
                      <stop offset="50%" stopColor="white">
                        <animate 
                          attributeName="offset" 
                          values="0;1" 
                          dur="4s" 
                          repeatCount="indefinite" 
                        />
                      </stop>
                      <stop offset="100%" stopColor={connectionColor}>
                        <animate 
                          attributeName="offset" 
                          values="0;1" 
                          dur="4s" 
                          repeatCount="indefinite" 
                        />
                      </stop>
                    </linearGradient>
                  </defs>
                  
                  {/* Base connection curve with subtle glow effect */}
                  <path 
                    d={path}
                    fill="none"
                    stroke={connectionColor}
                    strokeWidth={connection.status === "online" ? 3 : 2}
                    strokeOpacity={connection.status === "online" ? 0.8 : 0.5}
                    filter={connection.status === "online" ? "url(#glow)" : ""}
                  />
                  
                  {/* Add animated flow effect for online connections */}
                  {connection.status === "online" && (
                    <>
                      {/* Data flow dots animation */}
                      {Array.from({ length: 5 }).map((_, i) => (
                        <circle 
                          key={i} 
                          r={2.5}
                          fill={connectionColor}
                          filter="url(#glow)">
                          <animateMotion
                            path={path}
                            dur={`${2 + i * 0.5}s`}
                            repeatCount="indefinite"
                            rotate="auto"
                          />
                        </circle>
                      ))}
                      
                      {/* Dynamic pulse effect along the curve */}
                      <path 
                        d={path}
                        fill="none"
                        stroke={`url(#pulse-${animationId})`}
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        strokeLinecap="round"
                        opacity={0.7}
                      />
                    </>
                  )}
                  
                  {/* Elegant direction indicator */}
                  <polygon 
                    points="0,-5 10,0 0,5" 
                    fill={connectionColor} 
                    transform={`translate(${targetX - dx * 0.1}, ${targetY - dy * 0.1}) rotate(${Math.atan2(dy, dx) * 180 / Math.PI})`}
                    opacity={0.9}
                    filter={connection.status === "online" ? "url(#glow)" : ""}
                  />
                </g>
              );
            })}
            
            {/* Agent-Service Connections */}
            {agents.map(agent => {
              const position = agentPositions[agent.id] || { x: 100, y: 100 };
              const agentServices = services.filter(s => s.agentId === agent.id && s.monitorType === "agent");
              
              return (
                <g key={`agent-connections-${agent.id}`}>
                  {agentServices.map(service => {
                    const servicePos = servicePositions[service.id];
                    if (!servicePos) return null;
                    
                    // Calculate positions for curved path
                    const x1 = position.x + 100;
                    const y1 = position.y + 60;
                    const x2 = servicePos.x + 90;
                    const y2 = servicePos.y + 50;
                    
                    // Calculate control points for bezier curve
                    const dx = x2 - x1;
                    const dy = y2 - y1;
                    const midX = (x1 + x2) / 2;
                    const midY = (y1 + y2) / 2;
                    
                    // Offset control point to create a nice curve
                    const offsetX = -dy * 0.2; // Perpendicular to the line
                    const offsetY = dx * 0.2;
                    
                    // Create the path for a bezier curve
                    const path = `M${x1},${y1} Q${midX + offsetX},${midY + offsetY} ${x2},${y2}`;
                    
                    // Dynamic color based on agent and service status
                    const connectionColor = agent.status === "active" ? getConnectionColor(service.status) : "#9CA3AF";
                    
                    // Unique ID for this connection's animation
                    const animationId = `agent-service-${agent.id}-${service.id}`;
                    
                    return (
                      <g key={`agent-service-${agent.id}-${service.id}`}>
                        <defs>
                          <linearGradient id={`agent-pulse-${animationId}`}>
                            <stop offset="0%" stopColor={connectionColor}>
                              <animate 
                                attributeName="offset" 
                                values="0;1" 
                                dur="3s" 
                                repeatCount="indefinite" 
                              />
                            </stop>
                            <stop offset="25%" stopColor="white">
                              <animate 
                                attributeName="offset" 
                                values="0;1" 
                                dur="3s" 
                                repeatCount="indefinite" 
                              />
                            </stop>
                            <stop offset="50%" stopColor={connectionColor}>
                              <animate 
                                attributeName="offset" 
                                values="0;1" 
                                dur="3s" 
                                repeatCount="indefinite" 
                              />
                            </stop>
                          </linearGradient>
                        </defs>
                        
                        {/* Base curve path */}
                        <path 
                          d={path}
                          fill="none"
                          stroke={connectionColor}
                          strokeWidth={1.5}
                          strokeDasharray="4 2"
                          opacity={0.8}
                        />
                        
                        {/* Animated overlay for active agents */}
                        {agent.status === "active" && (
                          <>
                            {/* Flowing dots */}
                            {Array.from({ length: 3 }).map((_, i) => (
                              <circle 
                                key={i} 
                                r={1.5}
                                fill={connectionColor}
                                opacity={0.8}>
                                <animateMotion
                                  path={path}
                                  dur={`${3 + i * 0.8}s`}
                                  repeatCount="indefinite"
                                  rotate="auto"
                                />
                              </circle>
                            ))}
                            
                            {/* Pulsing line effect */}
                            <path 
                              d={path}
                              fill="none"
                              stroke={`url(#agent-pulse-${animationId})`}
                              strokeWidth={2}
                              strokeDasharray="3 5"
                              opacity={0.6}
                            />
                          </>
                        )}
                        
                        {/* Direction indicator */}
                        <polygon 
                          points="0,-3 6,0 0,3" 
                          fill={connectionColor} 
                          opacity={0.8}
                          transform={`translate(${x2 - dx * 0.05}, ${y2 - dy * 0.05}) rotate(${Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI})`}
                        />
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>

          {/* Service Nodes with Animated Entrance */}
          {services.map((service, index) => {
            const position = servicePositions[service.id] || { x: 0, y: 0 };
            
            return (
              <div 
                key={service.id}
                className="service-node absolute bg-card dark:bg-card rounded-xl shadow-lg border-2 overflow-hidden hover:shadow-xl"
                style={{
                  width: "180px",
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                  zIndex: draggingService === service.id ? 100 : 20,
                  cursor: draggingService === service.id ? "grabbing" : "grab",
                  borderColor: service.status === "online" ? "rgb(16, 185, 129)" : 
                               service.status === "offline" ? "rgb(239, 68, 68)" : 
                               service.status === "degraded" ? "rgb(245, 158, 11)" : "rgb(156, 163, 175)",
                  boxShadow: service.status === "online" ? "0 4px 20px rgba(16, 185, 129, 0.2)" : 
                             service.status === "offline" ? "0 4px 20px rgba(239, 68, 68, 0.2)" : 
                             service.status === "degraded" ? "0 4px 20px rgba(245, 158, 11, 0.2)" : 
                             "0 4px 12px rgba(0, 0, 0, 0.1)",
                  animation: `fadeIn 0.5s ease-out forwards, slideIn 0.5s ease-out forwards, pulse 2s infinite ${service.status === "online" ? "alternate" : ""}`,
                  animationDelay: `${index * 0.1}s`,
                  opacity: 0, // Start with opacity 0 for fadeIn animation
                  transform: `translateY(20px) scale(0.95)` // Start position for slideIn animation
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
                <div className="p-4 relative overflow-hidden">
                  {/* Background glow effect based on status */}
                  {service.status === "online" && (
                    <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-green-500/10 rounded-full blur-2xl"></div>
                  )}
                  {service.status === "degraded" && (
                    <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-yellow-500/10 rounded-full blur-2xl"></div>
                  )}
                  {service.status === "offline" && (
                    <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-red-500/10 rounded-full blur-2xl"></div>
                  )}
                  
                  <div className="mb-3 relative">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      {service.name}
                      {service.status === "online" && (
                        <span className="relative flex h-2 w-2">
                          <span className="absolute animate-ping h-full w-full rounded-full bg-green-400 opacity-50"></span>
                          <span className="relative rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/70">
                        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                      </svg>
                      {service.host}:{service.port}
                    </p>
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
                    
                    <span className={cn(
                      "text-xs font-mono px-2 py-1 rounded flex items-center gap-1",
                      service.status === "online" ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-200" : 
                      service.status === "offline" ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200" : 
                      "bg-muted"
                    )}>
                      {service.status === "online" && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                      )}
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

          {/* Agent Nodes with Animated Entrance */}
          {agents.map((agent, index) => {
            const position = agentPositions[agent.id] || { x: 100, y: 100 };
            
            // Find services monitored by this agent
            const agentServices = services.filter(s => s.agentId === agent.id && s.monitorType === "agent");
            
            return (
              <div
                key={`agent-${agent.id}`}
                className="agent-node absolute bg-card dark:bg-card rounded-xl shadow-lg border-2 overflow-hidden hover:shadow-xl"
                style={{
                  width: "200px",
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                  zIndex: draggingAgent === agent.id ? 100 : 30,
                  cursor: draggingAgent === agent.id ? "grabbing" : "grab",
                  borderColor: agent.status === "active" ? "rgb(59, 130, 246)" : 
                              agent.status === "inactive" ? "rgb(156, 163, 175)" : 
                              "rgb(245, 158, 11)",
                  boxShadow: agent.status === "active" ? "0 4px 20px rgba(59, 130, 246, 0.2)" : 
                             agent.status === "inactive" ? "0 4px 12px rgba(0, 0, 0, 0.1)" : 
                             "0 4px 20px rgba(245, 158, 11, 0.2)",
                  animation: `fadeIn 0.5s ease-out forwards, slideIn 0.5s ease-out forwards`,
                  animationDelay: `${0.5 + (index * 0.15)}s`, // Agents come in after services
                  opacity: 0, // Start with opacity 0 for fadeIn animation
                  transform: `translateY(20px) scale(0.95)` // Start position for slideIn animation
                }}
                onMouseDown={(e) => handleAgentDragStart(e, agent.id)}
              >
                <div className={cn(
                  "px-4 py-3 flex items-center justify-between",
                  agent.status === "active" ? "bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-600" : 
                  agent.status === "inactive" ? "bg-gradient-to-r from-gray-500 to-gray-600" : 
                  "bg-gradient-to-r from-yellow-500 to-yellow-600"
                )}>
                  <div className="flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-white" />
                    <span className="text-white font-medium truncate">Agent</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-xs text-white/80 mr-2">
                      {agent.status === "active" ? "Online" : 
                      agent.status === "inactive" ? "Offline" : 
                      "Connecting"}
                    </span>
                    <span className={cn(
                      "w-3 h-3 rounded-full flex-shrink-0",
                      agent.status === "active" ? "bg-green-300 animate-pulse" : 
                      agent.status === "inactive" ? "bg-gray-300" : 
                      "bg-yellow-300"
                    )}></span>
                  </div>
                </div>
                
                <div className="p-4 pb-3 relative overflow-hidden">
                  {/* Background glow effect for active agents */}
                  {agent.status === "active" && (
                    <div className="absolute -top-6 -right-6 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl"></div>
                  )}
                  
                  <div className="mb-3 relative">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      {agent.name}
                      {agent.status === "active" && (
                        <span className="relative flex h-2 w-2">
                          <span className="absolute animate-ping h-full w-full rounded-full bg-blue-400 opacity-50"></span>
                          <span className="relative rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/70">
                        <path d="M9 2 L15 2 L 12 6 Z" />
                        <path d="M12 6 L12 14" />
                        <circle cx="12" cy="18" r="4" />
                      </svg>
                      {agent.status === "active" ? "Active" : 
                       agent.status === "inactive" ? "Inactive" : 
                       "Connecting"}
                    </p>
                  </div>
                  
                  <div className="mt-3 pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-xs inline-flex items-center gap-1",
                        agent.status === "active" ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"
                      )}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                          <path d="M2 12C2 12 5 5 12 5C19 5 22 12 22 12C22 12 19 19 12 19C5 19 2 12 2 12Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        Monitoring:
                      </span>
                      <span className={cn(
                        "text-xs font-medium px-1.5 py-0.5 rounded-md bg-muted",
                        agent.status === "active" ? "text-blue-600 dark:text-blue-400" : ""
                      )}>
                        {agentServices.length} services
                      </span>
                    </div>
                    
                    {agent.status === "active" && agent.lastSeen && (
                      <div className="text-xs mt-1.5 flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        Last seen: {new Date(agent.lastSeen).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add New Service Button with Animation */}
          <div 
            className="service-node absolute bg-card dark:bg-card rounded-xl border-2 border-dashed border-primary p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-accent/10 hover:border-accent shadow-md hover:shadow-lg"
            style={{
              width: "180px",
              left: "380px",
              top: "520px",
              zIndex: 5,
              animation: "fadeIn 0.5s ease-out forwards, slideIn 0.5s ease-out forwards, pulse 3s infinite alternate",
              animationDelay: `${services.length * 0.1 + 0.3}s`, // Show after all services are animated
              opacity: 0, // Start with opacity 0 for fadeIn animation
              transform: "translateY(20px) scale(0.95)" // Start position for slideIn animation
            }}
            onClick={onAddService}
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Plus className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-primary">Add New Service</p>
          </div>
        </div>
      </div>
    </Card>
  );
}