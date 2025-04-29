import axios from "axios";
import { IStorage } from "./storage";
import { Service, Connection, Alert } from "@shared/schema";
import TelegramService from "./telegram-service";

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
        
        // Ajanın son görülme zamanını kontrol et - Zabbix tarzı daha uzun timeout
        const agentTimeout = 30 * 1000; // 30 saniye timeout (Zabbix tarzı)
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
    // Önceki durumu sakla
    const previousStatus = service.status || 'unknown';
    
    // Check if this service is monitored by an agent
    if (service.monitorType === "agent" && service.agentId) {
      // For agent-monitored services, we don't actively check
      // The agent will push status updates via the API
      // We only check if the agent itself is active
      const agent = await storage.getAgentById(service.agentId);
      
      // Zabbix tarzı heartbeat kontrolü yapıyoruz
      // Artık 30 saniye içinde heartbeat göndermeyen agentları inactive olarak işaretle
      const agentTimeout = 30 * 1000; // 30 saniye timeout (Zabbix tarzı)
      
      // Agent inaktif mi kontrol et
      const agentInactive = 
        !agent || 
        !agent.lastSeen || 
        (Date.now() - agent.lastSeen.getTime() > agentTimeout);
      
      // Agent'ın durumunu kontrol et
      if (agentInactive) {
        // Agent inactive olarak işaretle
        if (agent && agent.status !== "inactive") {
          console.log(`Agent ${agent.id} (${agent.name}) marked as inactive - has not reported in over 3 seconds`);
          await storage.updateAgentStatus(agent.id, "inactive");
          
          // Agent inactive olduğunda bağlı tüm servisleri de unknown olarak işaretle
          const agentServices = await storage.getServicesByUserId(agent.userId);
          const linkedServices = agentServices.filter(s => s.agentId === agent.id && s.monitorType === "agent");
          
          for (const linkedService of linkedServices) {
            if (linkedService.status !== "unknown") {
              console.log(`Service ${linkedService.id} (${linkedService.name}) marked as unknown because agent ${agent.id} is inactive`);
              
              // Servis durumu null olabilir, bu durumda "unknown" varsayalım
              const currentStatus = linkedService.status || "unknown";
              
              // Önce durumu güncelleyelim
              await storage.updateServiceStatus(linkedService.id, "unknown");
              
              // Sonra alert oluşturalım
              if (currentStatus !== "unknown") {
                await createStatusChangeAlert(storage, linkedService, currentStatus, "unknown");
              }
            }
          }
        }
        
        // Bu servisin durumunu güncelle
        if (service.status !== "unknown") {
          await storage.updateServiceStatus(service.id, "unknown");
          
          // Durum "unknown" olarak değiştiyse bildirim gönder
          if (previousStatus !== "unknown") {
            await createStatusChangeAlert(storage, service, previousStatus, "unknown");
          }
        }
      } else if (agent && agent.status !== "active") {
        // Agent aktif değilse aktife çevir
        console.log(`Agent ${agent.id} (${agent.name}) is reporting but not marked as active - updating status`);
        await storage.updateAgentStatus(agent.id, "active");
      }
      
      return;
    }
    
    // For directly monitored services, proceed with HTTP check
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
      
      // Durumu güncelle
      await storage.updateServiceStatus(service.id, status, responseTime);
      
      // Durum değiştiyse bildirim gönder
      if (previousStatus !== status) {
        await createStatusChangeAlert(storage, service, previousStatus, status);
      }
      
    } catch (error) {
      // Request failed or timed out
      const newStatus = "offline";
      await storage.updateServiceStatus(service.id, newStatus);
      
      // Durum "offline" olarak değiştiyse bildirim gönder
      if (previousStatus !== newStatus) {
        await createStatusChangeAlert(storage, service, previousStatus, newStatus);
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
