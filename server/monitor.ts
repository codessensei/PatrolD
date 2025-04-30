import axios from "axios";
import { IStorage } from "./storage";
import { Service, Connection, Alert, InsertServiceMetrics } from "@shared/schema";
import TelegramService from "./telegram-service";
import https from "https";
import dns from "dns";
import { promisify } from "util";
import net from "net";

// Telegram servisini tanımla
let telegramService: TelegramService | null = null;

// Helper function to get all services from all users
async function getAllServices(storage: IStorage): Promise<Service[]> {
  // Get all user IDs (without exposing the users collection directly)
  const services: Service[] = [];
  
  // Fetch services for each user from the storage
  // This is a placeholder implementation that would work better with a database
  // For now, we'll use a simple approach that works with our MemStorage
  if ((storage as any).users && typeof (storage as any).users.values === 'function') {
    const allUserServices = await Promise.all(
      Array.from((storage as any).users.values()).map((user: any) => 
        storage.getServicesByUserId(user.id)
      )
    );
    
    // Flatten the array of arrays
    return allUserServices.flat();
  }
  
  return services;
}

// Timeout for HTTP requests in ms
const REQUEST_TIMEOUT = 5000;

// DNS lookup promise
const dnsLookup = promisify(dns.lookup);

// Helper functions for advanced metrics
async function measureDnsResolutionTime(hostname: string): Promise<number | null> {
  try {
    const startTime = Date.now();
    await dnsLookup(hostname);
    return Date.now() - startTime;
  } catch (error) {
    console.error(`DNS resolution error for ${hostname}:`, error);
    return null;
  }
}

async function checkTcpConnection(host: string, port: number, timeout = 2000): Promise<{ latency: number | null, status: string }> {
  return new Promise(resolve => {
    const startTime = Date.now();
    const socket = new net.Socket();
    let resolved = false;
    
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      if (resolved) return;
      resolved = true;
      const latency = Date.now() - startTime;
      socket.destroy();
      resolve({ latency, status: 'online' });
    });
    
    socket.on('timeout', () => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve({ latency: null, status: 'degraded' });
    });
    
    socket.on('error', () => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve({ latency: null, status: 'offline' });
    });
    
    socket.connect(port, host);
  });
}

async function checkTlsCertificate(host: string, port: number = 443): Promise<{ expiryDays: number | null, handshakeTime: number | null }> {
  return new Promise(resolve => {
    const startTime = Date.now();
    const req = https.request({
      host,
      port,
      method: 'HEAD',
      rejectUnauthorized: false,
    }, (res) => {
      try {
        // Type assertion to access TLS-specific properties safely
        const tlsSocket = res.socket as any;
        const cert = tlsSocket.getPeerCertificate ? tlsSocket.getPeerCertificate() : null;
        
        if (!cert || !cert.valid_to) {
          resolve({ expiryDays: null, handshakeTime: null });
          return;
        }
        
        const expiryDate = new Date(cert.valid_to);
        const currentDate = new Date();
        const diffTime = Math.abs(expiryDate.getTime() - currentDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const handshakeTime = Date.now() - startTime;
        
        resolve({ expiryDays: diffDays, handshakeTime });
      } catch (error) {
        console.error(`Certificate check error for ${host}:`, error);
        resolve({ expiryDays: null, handshakeTime: null });
      }
    });
    
    req.on('error', (err) => {
      console.error(`TLS request error for ${host}:${port}:`, err.message);
      resolve({ expiryDays: null, handshakeTime: null });
    });
    
    req.on('timeout', () => {
      req.destroy();
      console.error(`TLS request timeout for ${host}:${port}`);
      resolve({ expiryDays: null, handshakeTime: null });
    });
    
    req.setTimeout(3000);
    req.end();
  });
}

export function setupMonitoring(storage: IStorage) {
  // Telegram servisi oluştur
  telegramService = new TelegramService(storage);
  console.log("Telegram notification service initialized");
  
  // Start monitoring process
  startMonitoring(storage);
}

// Telegram servisine erişim için dışa aktarılmış fonksiyon
export function getTelegramService(): TelegramService | null {
  return telegramService;
}

async function startMonitoring(storage: IStorage) {
  console.log("Starting service monitoring...");
  
  // Check all services periodically
  setInterval(async () => {
    await checkServices(storage);
  }, 30000); // Check every 30 seconds
  
  // Özel olarak ajanların durumunu daha sık kontrol et (10 saniye)
  setInterval(async () => {
    await checkAgentStatus(storage);
  }, 10000); // Her 10 saniyede bir ajan durumunu kontrol et
  
  // Initial checks
  await checkServices(storage);
  await checkAgentStatus(storage);
}

// Agent durumlarını özel olarak kontrol eden fonksiyon
async function checkAgentStatus(storage: IStorage) {
  try {
    console.log("Running agent status check...");
    
    // Tüm kullanıcılardan tüm ajanları al
    const agents = [];
    
    if ((storage as any).users && typeof (storage as any).users.values === 'function') {
      const allUsersAgents = await Promise.all(
        Array.from((storage as any).users.values()).map((user: any) => 
          storage.getAgentsByUserId(user.id)
        )
      );
      
      const allAgents = allUsersAgents.flat();
      
      // Her bir ajanın durumunu kontrol et
      for (const agent of allAgents) {
        if (!agent) continue;
        
        // Daha hızlı bir timeout ile gerçek zamanlı izleme
        const agentTimeout = 3 * 1000; // 3 saniye timeout (hızlı tepki için)
        const agentInactive = 
          !agent.lastSeen || 
          (Date.now() - agent.lastSeen.getTime() > agentTimeout);
        
        // Eğer ajan aktif olarak işaretlenmişse fakat timeout süresini aştıysa inactive yap
        if (agent.status === "active" && agentInactive) {
          console.log(`Agent ${agent.id} (${agent.name}) marked as inactive - has not reported in over 3 seconds`);
          await storage.updateAgentStatus(agent.id, "inactive");
          
          // Bu ajana bağlı tüm servisleri unknown olarak işaretle
          const services = await storage.getServicesByUserId(agent.userId);
          const linkedServices = services.filter(s => s.agentId === agent.id && s.monitorType === "agent");
          
          for (const service of linkedServices) {
            if (service.status !== "unknown") {
              console.log(`Service ${service.id} (${service.name}) marked as unknown because agent ${agent.id} is inactive`);
              
              // Servis durumu null olabilir, bu durumda "unknown" varsayalım
              const currentStatus = service.status || "unknown";
              
              // Durumu güncelle
              await storage.updateServiceStatus(service.id, "unknown");
              
              // Alert oluştur
              if (currentStatus !== "unknown") {
                await createStatusChangeAlert(storage, service, currentStatus, "unknown");
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error checking agent status:", error);
  }
}

async function checkServices(storage: IStorage) {
  try {
    // Get all services - directly query for all services
    // This avoids the need to access storage.users directly
    const services = await getAllServices(storage);
    
    if (services.length === 0) return;
    
    // Group services by check interval
    const servicesByInterval = services.reduce((acc: Record<number, Service[]>, service: Service) => {
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
    // Store previous status
    const previousStatus = service.status || 'unknown';
    
    // Check if this service is monitored by an agent
    if (service.monitorType === "agent" && service.agentId) {
      // For agent-monitored services, we don't actively check
      // The agent will push status updates via the API
      // We only check if the agent itself is active
      const agent = await storage.getAgentById(service.agentId);
      
      // Use a faster timeout for real-time monitoring
      const agentTimeout = 3 * 1000; // 3 second timeout for quick response
      
      // Check if agent is inactive
      const agentInactive = 
        !agent || 
        !agent.lastSeen || 
        (Date.now() - agent.lastSeen.getTime() > agentTimeout);
      
      // Check agent status
      if (agentInactive) {
        // Mark agent as inactive
        if (agent && agent.status !== "inactive") {
          console.log(`Agent ${agent.id} (${agent.name}) marked as inactive - has not reported in over 3 seconds`);
          await storage.updateAgentStatus(agent.id, "inactive");
          
          // Mark all services linked to this agent as unknown
          const agentServices = await storage.getServicesByUserId(agent.userId);
          const linkedServices = agentServices.filter(s => s.agentId === agent.id && s.monitorType === "agent");
          
          for (const linkedService of linkedServices) {
            if (linkedService.status !== "unknown") {
              console.log(`Service ${linkedService.id} (${linkedService.name}) marked as unknown because agent ${agent.id} is inactive`);
              
              // Service status might be null, default to "unknown"
              const currentStatus = linkedService.status || "unknown";
              
              // First update the status
              await storage.updateServiceStatus(linkedService.id, "unknown");
              
              // Then create an alert
              if (currentStatus !== "unknown") {
                await createStatusChangeAlert(storage, linkedService, currentStatus, "unknown");
              }
            }
          }
        }
        
        // Update this service's status
        if (service.status !== "unknown") {
          await storage.updateServiceStatus(service.id, "unknown");
          
          // Send notification if status changed to "unknown"
          if (previousStatus !== "unknown") {
            await createStatusChangeAlert(storage, service, previousStatus, "unknown");
          }
        }
      } else if (agent && agent.status !== "active") {
        // Mark agent as active if it's reporting but not marked as active
        console.log(`Agent ${agent.id} (${agent.name}) is reporting but not marked as active - updating status`);
        await storage.updateAgentStatus(agent.id, "active");
      }
      
      return;
    }
    
    // For directly monitored services, proceed with enhanced health checks
    const url = buildServiceUrl(service);
    const metrics: InsertServiceMetrics = {
      serviceId: service.id,
      status: 'unknown',
      timestamp: new Date(),
      responseTime: null,
      latency: null,
      packetLoss: null,
      jitter: null,
      bandwidth: null,
      dnsResolutionTime: null,
      tlsHandshakeTime: null,
      certificateExpiryDays: null
    };
    
    // Start collecting metrics
    let status = "unknown";
    
    // 1. DNS Resolution Time Check
    const dnsResolutionTime = await measureDnsResolutionTime(service.host);
    metrics.dnsResolutionTime = dnsResolutionTime;
    
    // If DNS resolution failed, mark as offline
    if (dnsResolutionTime === null) {
      status = "offline";
      metrics.status = status;
      
      // Record metrics and update service status
      await storage.addServiceMetric(metrics);
      await storage.updateServiceStatus(service.id, status);
      
      // Send alert if status changed
      if (previousStatus !== status) {
        await createStatusChangeAlert(storage, service, previousStatus, status);
      }
      
      return;
    }
    
    // 2. TCP Connection Check
    const tcpCheck = await checkTcpConnection(service.host, service.port);
    metrics.latency = tcpCheck.latency;
    
    // If TCP connection failed, mark as offline
    if (tcpCheck.status === "offline") {
      status = "offline";
      metrics.status = status;
      
      // Record metrics and update service status
      await storage.addServiceMetric(metrics);
      await storage.updateServiceStatus(service.id, status);
      
      // Send alert if status changed
      if (previousStatus !== status) {
        await createStatusChangeAlert(storage, service, previousStatus, status);
      }
      
      return;
    }
    
    // 3. For HTTPS services, check TLS certificate
    if (service.port === 443) {
      const certCheck = await checkTlsCertificate(service.host, service.port);
      metrics.tlsHandshakeTime = certCheck.handshakeTime;
      metrics.certificateExpiryDays = certCheck.expiryDays;
      
      // Check if certificate is expiring soon (if threshold is set)
      if (certCheck.expiryDays !== null && 
          service.certExpiryThreshold !== null && 
          certCheck.expiryDays <= service.certExpiryThreshold) {
        // Create an alert for certificate expiry
        await storage.createAlert({
          userId: service.userId,
          serviceId: service.id,
          type: "cert_expiry",
          message: `Certificate for ${service.name} expires in ${certCheck.expiryDays} days`,
          timestamp: new Date(),
          acknowledged: false
        });
      }
    }
    
    // 4. HTTP Check (final check)
    const startTime = Date.now();
    try {
      const response = await axios.get(url, { 
        timeout: REQUEST_TIMEOUT,
        validateStatus: () => true // Accept any status code
      });
      
      const responseTime = Date.now() - startTime;
      metrics.responseTime = responseTime;
      
      // Determine status based on response and thresholds
      status = "online";
      
      // Check against response time threshold if set
      if (service.responseTimeThreshold !== null && 
          responseTime > service.responseTimeThreshold) {
        status = "degraded";
      } 
      // Check HTTP status codes
      else if (response.status >= 400) {
        status = "offline";
      } else if (response.status >= 300) {
        status = "degraded";
      }
      
      // Add status to metrics
      metrics.status = status;
      
      // Record metrics
      await storage.addServiceMetric(metrics);
      
      // Update service status with response time
      await storage.updateServiceStatus(service.id, status, responseTime);
      
      // Send alert if status changed
      if (previousStatus !== status) {
        await createStatusChangeAlert(storage, service, previousStatus, status);
      }
      
    } catch (error) {
      // Request failed or timed out
      status = "offline";
      metrics.status = status;
      
      // Record metrics
      await storage.addServiceMetric(metrics);
      
      // Update service status
      await storage.updateServiceStatus(service.id, status);
      
      // Send alert if status changed
      if (previousStatus !== status) {
        await createStatusChangeAlert(storage, service, previousStatus, status);
      }
    }
  } catch (error) {
    console.error(`Error checking service ${service.id}:`, error);
  }
}

// Servis durum değişikliği için uyarı oluştur ve bildirim gönder
export async function createStatusChangeAlert(storage: IStorage, service: Service, oldStatus: string, newStatus: string) {
  try {
    // Duruma göre alert tipini belirle
    let alertType = 'status_change';
    let message = `Service ${service.name} changed status from ${oldStatus} to ${newStatus}`;
    
    if (newStatus === 'offline') {
      alertType = 'outage';
      message = `Service ${service.name} is down`;
    } else if (newStatus === 'online' && (oldStatus === 'offline' || oldStatus === 'unknown')) {
      alertType = 'recovery';
      message = `Service ${service.name} is back online`;
    } else if (newStatus === 'degraded') {
      alertType = 'degraded';
      message = `Service ${service.name} is experiencing performance issues`;
    }
    
    // Alert oluştur
    const alert = await storage.createAlert({
      userId: service.userId,
      serviceId: service.id,
      type: alertType,
      message: message,
      timestamp: new Date()
    });
    
    // Telegram üzerinden bildirim gönder
    if (telegramService) {
      try {
        const statusEmoji = 
          newStatus === 'online' ? '✅' : 
          newStatus === 'offline' ? '❌' : 
          newStatus === 'degraded' ? '⚠️' : '❓';
          
        const oldStatusEmoji = 
          oldStatus === 'online' ? '✅' : 
          oldStatus === 'offline' ? '❌' : 
          oldStatus === 'degraded' ? '⚠️' : '❓';
          
        const message = 
          `${statusEmoji} SERVİS DURUM DEĞİŞİKLİĞİ\n\n` +
          `${service.name} (${service.host}:${service.port})\n` +
          `${oldStatusEmoji} ${oldStatus.toUpperCase()} → ${statusEmoji} ${newStatus.toUpperCase()}\n\n` +
          `Zaman: ${new Date().toLocaleString()}`;
        
        await telegramService.sendNotification(service.userId, message);
      } catch (error) {
        console.error(`Error sending Telegram notification for service ${service.id}:`, error);
      }
    }
    
    return alert;
  } catch (error) {
    console.error(`Error creating status change alert for service ${service.id}:`, error);
    return null;
  }
}

function buildServiceUrl(service: Service): string {
  const protocol = service.port === 443 ? "https" : "http";
  return `${protocol}://${service.host}:${service.port}`;
}

// Helper function to get all connections from all users
async function getAllConnections(storage: IStorage): Promise<Connection[]> {
  const connections: Connection[] = [];
  
  // Using the same approach as getAllServices
  if ((storage as any).users && typeof (storage as any).users.values === 'function') {
    const allUserConnections = await Promise.all(
      Array.from((storage as any).users.values()).map((user: any) => 
        storage.getConnectionsByUserId(user.id)
      )
    );
    
    return allUserConnections.flat();
  }
  
  return connections;
}

async function updateConnections(storage: IStorage) {
  try {
    // Get all connections using the helper
    const connections = await getAllConnections(storage);
    
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
