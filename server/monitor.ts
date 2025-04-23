import axios from "axios";
import { IStorage } from "./storage";
import { Service } from "@shared/schema";

// Timeout for HTTP requests in ms
const REQUEST_TIMEOUT = 5000;

export function setupMonitoring(storage: IStorage) {
  // Start monitoring process
  startMonitoring(storage);
}

async function startMonitoring(storage: IStorage) {
  console.log("Starting service monitoring...");
  
  // Check all services periodically
  setInterval(async () => {
    await checkServices(storage);
  }, 30000); // Check every 30 seconds
  
  // Initial check
  await checkServices(storage);
}

async function checkServices(storage: IStorage) {
  try {
    // Get all services
    const services = Array.from(new Set(
      (await Promise.all(
        Array.from(storage.users.values()).map(user => 
          storage.getServicesByUserId(user.id)
        )
      )).flat()
    ));
    
    if (services.length === 0) return;
    
    // Group services by check interval
    const servicesByInterval = services.reduce((acc, service) => {
      const interval = service.checkInterval;
      if (!acc[interval]) acc[interval] = [];
      acc[interval].push(service);
      return acc;
    }, {} as Record<number, Service[]>);
    
    // Check services that need to be checked
    for (const [intervalStr, servicesGroup] of Object.entries(servicesByInterval)) {
      const interval = parseInt(intervalStr);
      for (const service of servicesGroup) {
        const lastChecked = service.lastChecked?.getTime() || 0;
        const now = Date.now();
        
        // Check if it's time to check this service
        if (now - lastChecked >= interval * 1000) {
          await checkService(storage, service);
        }
      }
    }
    
    // Update connection statuses
    await updateConnections(storage);
    
  } catch (error) {
    console.error("Error in monitoring routine:", error);
  }
}

async function checkService(storage: IStorage, service: Service) {
  try {
    const url = buildServiceUrl(service);
    const startTime = Date.now();
    
    try {
      const response = await axios.get(url, { 
        timeout: REQUEST_TIMEOUT,
        validateStatus: () => true // Accept any status code
      });
      
      const responseTime = Date.now() - startTime;
      
      // Determine status based on response
      let status = "online";
      if (response.status >= 400) {
        status = "offline";
      } else if (response.status >= 300 || responseTime > 1000) {
        status = "degraded";
      }
      
      await storage.updateServiceStatus(service.id, status, responseTime);
      
    } catch (error) {
      // Request failed or timed out
      await storage.updateServiceStatus(service.id, "offline");
    }
  } catch (error) {
    console.error(`Error checking service ${service.id}:`, error);
  }
}

function buildServiceUrl(service: Service): string {
  const protocol = service.port === 443 ? "https" : "http";
  return `${protocol}://${service.host}:${service.port}`;
}

async function updateConnections(storage: IStorage) {
  try {
    const connections = Array.from(new Set(
      (await Promise.all(
        Array.from(storage.users.values()).map(user => 
          storage.getConnectionsByUserId(user.id)
        )
      )).flat()
    ));
    
    for (const connection of connections) {
      const source = await storage.getServiceById(connection.sourceId);
      const target = await storage.getServiceById(connection.targetId);
      
      if (!source || !target) {
        // One of the services was deleted, remove the connection
        await storage.deleteConnection(connection.id);
        continue;
      }
      
      // Determine connection status based on service statuses
      let status = "unknown";
      
      if (source.status === "online" && target.status === "online") {
        status = "online";
      } else if (source.status === "offline" || target.status === "offline") {
        status = "offline";
      } else if (source.status === "degraded" || target.status === "degraded") {
        status = "degraded";
      }
      
      // Update connection status
      await storage.updateConnectionStatus(connection.id, status);
    }
  } catch (error) {
    console.error("Error updating connections:", error);
  }
}
