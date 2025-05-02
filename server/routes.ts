import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { setupMonitoring, getTelegramService, createStatusChangeAlert } from "./monitor";
import { z } from "zod";
import { 
  insertConnectionSchema, 
  insertServiceSchema, 
  insertAgentSchema,
  insertServiceMapSchema,
  insertServiceMapItemSchema,
  insertAgentMapItemSchema
} from "@shared/schema";
import { randomBytes } from "crypto";
import * as fs from 'fs';
import * as path from 'path';

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);

  // Setup monitoring
  setupMonitoring(storage);

  // API Routes
  // Services
  app.get("/api/services", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const services = await storage.getServicesByUserId(req.user!.id);
    res.status(200).json(services);
  });

  app.post("/api/services", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const data = insertServiceSchema.parse({
        ...req.body,
        userId: req.user!.id
      });
      
      const service = await storage.createService(data);
      res.status(201).json(service);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create service" });
    }
  });

  app.put("/api/services/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const serviceId = parseInt(req.params.id);
    if (isNaN(serviceId)) {
      return res.status(400).json({ error: "Invalid service ID" });
    }
    
    const service = await storage.getServiceById(serviceId);
    if (!service || service.userId !== req.user!.id) {
      return res.status(404).json({ error: "Service not found" });
    }
    
    try {
      const updatedService = await storage.updateService({
        ...service,
        ...req.body
      });
      res.status(200).json(updatedService);
    } catch (error) {
      res.status(500).json({ error: "Failed to update service" });
    }
  });

  app.delete("/api/services/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const serviceId = parseInt(req.params.id);
    if (isNaN(serviceId)) {
      return res.status(400).json({ error: "Invalid service ID" });
    }
    
    const service = await storage.getServiceById(serviceId);
    if (!service || service.userId !== req.user!.id) {
      return res.status(404).json({ error: "Service not found" });
    }
    
    await storage.deleteService(serviceId);
    res.status(204).send();
  });

  // Connections
  app.get("/api/connections", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const connections = await storage.getConnectionsByUserId(req.user!.id);
    res.status(200).json(connections);
  });

  app.post("/api/connections", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const data = insertConnectionSchema.parse({
        ...req.body,
        userId: req.user!.id
      });
      
      // Check if services belong to user
      const sourceService = await storage.getServiceById(data.sourceId);
      const targetService = await storage.getServiceById(data.targetId);
      
      if (!sourceService || sourceService.userId !== req.user!.id ||
          !targetService || targetService.userId !== req.user!.id) {
        return res.status(404).json({ error: "Service not found" });
      }
      
      const connection = await storage.createConnection(data);
      res.status(201).json(connection);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create connection" });
    }
  });

  app.delete("/api/connections/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const connectionId = parseInt(req.params.id);
    if (isNaN(connectionId)) {
      return res.status(400).json({ error: "Invalid connection ID" });
    }
    
    const connection = await storage.getConnectionById(connectionId);
    if (!connection || connection.userId !== req.user!.id) {
      return res.status(404).json({ error: "Connection not found" });
    }
    
    await storage.deleteConnection(connectionId);
    res.status(204).send();
  });

  // Alerts
  app.get("/api/alerts", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const alerts = await storage.getAlertsByUserId(req.user!.id);
    res.status(200).json(alerts);
  });

  app.put("/api/alerts/:id/acknowledge", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const alertId = parseInt(req.params.id);
    if (isNaN(alertId)) {
      return res.status(400).json({ error: "Invalid alert ID" });
    }
    
    const alert = await storage.getAlertById(alertId);
    if (!alert || alert.userId !== req.user!.id) {
      return res.status(404).json({ error: "Alert not found" });
    }
    
    const updatedAlert = await storage.acknowledgeAlert(alertId);
    res.status(200).json(updatedAlert);
  });

  // Agents
  app.get("/api/agents", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const agents = await storage.getAgentsByUserId(req.user!.id);
    res.status(200).json(agents);
  });

  app.post("/api/agents", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      // Generate a unique API key for the agent
      // Format: agt_[random 10 chars]_[random 8 chars]
      const prefix = 'agt_';
      const part1 = randomBytes(5).toString('hex');
      const part2 = randomBytes(4).toString('hex');
      const apiKey = `${prefix}${part1}_${part2}`;
      
      const data = {
        ...req.body,
        userId: req.user!.id,
        apiKey,
        status: "inactive"
      };
      
      console.log("Creating agent with data:", JSON.stringify(data));
      
      const agent = await storage.createAgent(data);
      res.status(201).json(agent);
    } catch (error) {
      console.error("Failed to create agent:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create agent" });
    }
  });

  app.put("/api/agents/:id/refresh", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const agentId = parseInt(req.params.id);
    if (isNaN(agentId)) {
      return res.status(400).json({ error: "Invalid agent ID" });
    }
    
    const agent = await storage.getAgentById(agentId);
    if (!agent || agent.userId !== req.user!.id) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Check if forceInactive flag is set
    const { forceInactive } = req.body;
    
    if (forceInactive && agent.status === "active") {
      // Force agent to inactive status when requested by UI refresh button
      const updatedAgent = await storage.updateAgentStatus(agent.id, "inactive");
      
      // Update any services monitored by this agent
      const services = await storage.getServicesByUserId(agent.userId);
      const linkedServices = services.filter(s => s.agentId === agent.id && s.monitorType === "agent");
      
      for (const service of linkedServices) {
        if (service.status !== "unknown") {
          console.log(`Service ${service.id} (${service.name}) marked as unknown because agent was force-refreshed`);
          
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
      
      return res.status(200).json(updatedAgent);
    }
    
    // If not forcing inactive, just return the current agent
    res.status(200).json(agent);
  });
  
  // Agent silme endpoint'i
  app.delete("/api/agents/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const agentId = parseInt(req.params.id);
    if (isNaN(agentId)) {
      return res.status(400).json({ error: "Invalid agent ID" });
    }
    
    const agent = await storage.getAgentById(agentId);
    if (!agent || agent.userId !== req.user!.id) {
      return res.status(404).json({ error: "Agent not found" });
    }
    
    try {
      // Bu agent'a bağlı tüm servisleri güncelle
      const services = await storage.getServicesByUserId(req.user!.id);
      const linkedServices = services.filter(s => s.agentId === agentId);
      
      // Bağlı servislerin agent'ını kaldır ve durumunu unknown olarak işaretle
      for (const service of linkedServices) {
        const currentStatus = service.status || "unknown";
        
        // Servisi direk monitörleme moduna geçir
        await storage.updateService({
          ...service,
          agentId: null,
          monitorType: "direct"
        });
        
        // Durumu unknown olarak güncelle
        await storage.updateServiceStatus(service.id, "unknown");
        
        // Bildirim gönder
        if (currentStatus !== "unknown") {
          const alert = await storage.createAlert({
            userId: req.user!.id,
            serviceId: service.id,
            type: "status_change",
            message: `Service ${service.name} is no longer monitored by agent (agent deleted)`,
            timestamp: new Date()
          });
        }
      }
      
      // Agent'ı sil
      await storage.deleteAgent(agentId);
      
      res.status(200).json({ success: true, message: "Agent deleted successfully" });
    } catch (error) {
      console.error("Error deleting agent:", error);
      res.status(500).json({ error: "Failed to delete agent" });
    }
  });
  
  // Endpoint to serve agent script templates
  app.get("/api/agents/:id/script/:type", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const agentId = parseInt(req.params.id);
    if (isNaN(agentId)) {
      return res.status(400).json({ error: "Invalid agent ID" });
    }
    
    const agent = await storage.getAgentById(agentId);
    if (!agent || agent.userId !== req.user!.id) {
      return res.status(404).json({ error: "Agent not found" });
    }
    
    const scriptType = req.params.type;
    let filePath;
    let contentType;
    
    // Determine which script to serve
    switch (scriptType) {
      case 'node':
        filePath = 'server/agent-templates/node-agent.js';
        contentType = 'application/javascript';
        break;
      case 'python':
        filePath = 'server/agent-templates/python-agent.py';
        contentType = 'text/plain';
        break;
      case 'bash':
        filePath = 'server/agent-templates/bash-agent.sh';
        contentType = 'text/plain';
        break;
      case 'deb':
        filePath = 'patrold_1.0.0_all.deb';
        contentType = 'application/vnd.debian.binary-package';
        break;
      default:
        return res.status(400).json({ error: "Invalid script type" });
    }
    
    try {
      // Set filename for download
      const filename = filePath.split('/').pop();
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // Handle differently for binary files (deb package)
      if (scriptType === 'deb') {
        // Read and send as binary
        const fileBuffer = fs.readFileSync(filePath);
        return res.send(fileBuffer);
      }
      
      // For script files, read as text and process templates
      let script = fs.readFileSync(filePath, 'utf8');
      
      // Get the application base URL
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const baseUrl = `${protocol}://${req.headers.host}`;
      
      // Replace placeholders with actual values
      script = script.replace(/["']?{{API_KEY}}["']?/g, `"${agent.apiKey}"`);
      
      // Python script'inde hata vermesin diye tek tırnak kullanıyoruz
      if (scriptType === 'python') {
        script = script.replace(/["']?{{API_BASE_URL}}["']?/g, `'${baseUrl}'`);
      } else {
        script = script.replace(/["']?{{API_BASE_URL}}["']?/g, `"${baseUrl}"`);
      }
      
      // Double check that the API_KEY is actually replaced
      if (script.includes("{{API_KEY}}")) {
        console.log("Warning: API_KEY placeholder not replaced in script");
      }
      
      res.send(script);
    } catch (error) {
      console.error(`Error serving agent script template: ${error}`);
      res.status(500).json({ error: "Failed to generate agent script" });
    }
  });



  app.post("/api/agents/heartbeat", async (req, res) => {
    const { apiKey, serverInfo } = req.body;
    
    if (!apiKey) {
      return res.status(401).json({ error: "API key required" });
    }
    
    const agent = await storage.getAgentByApiKey(apiKey);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    
    try {
      // Ajanın durumunu her kalp atışında güncelle
      // Bu, aktif olduğunu belirtir
      console.log(`Received heartbeat from agent ${agent.id} (${agent.name}), marking as active`);
      const updatedAgent = await storage.updateAgentStatus(agent.id, "active", serverInfo);
      
      // Eğer ajan inactive durumdayken tekrar active olursa
      // ve buna bağlı servisler unknown durumdaysa onları yeniden kontrol et
      if (agent.status === "inactive") {
        console.log(`Agent ${agent.id} is now active after being inactive`);
        
        // Bu ajana bağlı tüm servisleri bul
        const services = await storage.getServicesByUserId(agent.userId);
        const linkedServices = services.filter(s => s.agentId === agent.id && s.monitorType === "agent" && s.status === "unknown");
        
        // Unknown olan servislerin durumunu tekrar kontrol etmek üzere işaretle
        if (linkedServices.length > 0) {
          console.log(`Resetting status of ${linkedServices.length} services associated with now-active agent`);
          
          for (const service of linkedServices) {
            // Geçici olarak durumu "checking" olarak işaretle
            // Diğer kontroller gerçek durumu belirleyecek
            console.log(`Marking service ${service.id} (${service.name}) for re-check`);
            await storage.updateServiceStatus(service.id, "checking");
          }
        }
      }
      
      // Get services assigned to this agent
      const services = await storage.getServicesByUserId(agent.userId);
      const agentServices = services.filter(
        service => service.agentId === agent.id && service.monitorType === "agent"
      );
      
      // Simplify service objects to include only what the agent needs
      const serviceList = agentServices.map(service => ({
        host: service.host,
        port: service.port,
        id: service.id,
        name: service.name
      }));
      
      res.status(200).json({ 
        status: "ok", 
        agentId: agent.id,
        services: serviceList 
      });
    } catch (error) {
      console.error("Failed to update agent status:", error);
      res.status(500).json({ error: "Failed to update agent status" });
    }
  });
  
  // Endpoint for agents to report service status
  app.post("/api/agents/service-check", async (req, res) => {
    const { apiKey, host, port, status, responseTime } = req.body;
    
    if (!apiKey) {
      return res.status(401).json({ error: "API key required" });
    }
    
    const agent = await storage.getAgentByApiKey(apiKey);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    
    try {
      // Find services that are monitored by this agent
      const services = await storage.getServicesByUserId(agent.userId);
      // Log what agent is reporting for debugging
      console.log(`Agent ${agent.id} (${agent.name}) reporting status for ${host}:${port}: ${status}`);
      
      // Find matching services for this agent
      const matchingServices = services.filter(
        service => 
          service.agentId === agent.id && 
          service.monitorType === "agent" &&
          service.host === host &&
          service.port === port
      );
      
      // Log all matching services
      console.log(`Found ${matchingServices.length} services monitored by agent ${agent.id} for ${host}:${port}`);
      matchingServices.forEach(svc => {
        console.log(`- Service ${svc.id}: ${svc.name} (${svc.host}:${svc.port}) - Current status: ${svc.status}`);
      });
      
      if (matchingServices.length === 0) {
        // If no exact matches, maybe the agent is reporting a service it wasn't asked to monitor
        // For backwards compatibility, we'll update all agent services
        const allAgentServices = services.filter(
          service => service.agentId === agent.id && service.monitorType === "agent"
        );
        
        if (allAgentServices.length > 0) {
          console.log(`No exact match found for ${host}:${port}, updating all ${allAgentServices.length} agent services`);
          
          await Promise.all(
            allAgentServices.map(service => 
              storage.updateServiceStatus(service.id, status, responseTime)
            )
          );
          
          return res.status(200).json({ 
            status: "ok", 
            servicesUpdated: allAgentServices.length,
            message: "Updated all agent services (no exact match found)"
          });
        }
        
        return res.status(404).json({ 
          error: "No matching service found",
          message: `No service found for host ${host}:${port} monitored by this agent`
        });
      }
      
      // Update matching services
      await Promise.all(
        matchingServices.map(service => 
          storage.updateServiceStatus(service.id, status, responseTime)
        )
      );
      
      return res.status(200).json({ 
        status: "ok", 
        servicesUpdated: matchingServices.length 
      });
    } catch (error) {
      console.error("Error updating service status from agent:", error);
      return res.status(500).json({ error: "Failed to update service status" });
    }
  });

  // Telegram API endpoints
  app.post("/api/telegram/test", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const telegramService = getTelegramService();
    if (!telegramService) {
      return res.status(500).json({ 
        success: false, 
        error: "Telegram servisi başlatılamadı" 
      });
    }
    
    try {
      const result = await telegramService.sendTestMessage(req.user!.id);
      
      if (result) {
        res.status(200).json({ 
          success: true, 
          message: "Test mesajı başarıyla gönderildi" 
        });
      } else {
        res.status(400).json({ 
          success: false, 
          message: "Mesaj gönderilemedi. Telegram ayarlarınızı kontrol edin." 
        });
      }
    } catch (error) {
      console.error("Test mesajı gönderilirken hata oluştu:", error);
      res.status(500).json({ 
        success: false, 
        error: "Test mesajı gönderilirken bir hata oluştu" 
      });
    }
  });
  
  // Telegram ayarlarını güncelleme
  app.post("/api/telegram/settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const { chatId, enableAlerts } = req.body;
    
    try {
      // Kullanıcı ayarlarını güncelle
      const settings = await storage.updateUserSettings({
        userId: req.user!.id,
        enableTelegramAlerts: enableAlerts === true,
        telegramChatId: chatId
      });
      
      res.status(200).json({ 
        success: true, 
        settings
      });
    } catch (error) {
      console.error("Telegram ayarları güncellenirken hata oluştu:", error);
      res.status(500).json({ 
        success: false, 
        error: "Telegram ayarları güncellenirken bir hata oluştu" 
      });
    }
  });
  
  // Telegram ayarlarını getirme
  app.get("/api/telegram/settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const settings = await storage.getUserSettings(req.user!.id);
      
      res.status(200).json({
        enableTelegramAlerts: settings?.enableTelegramAlerts || false,
        telegramChatId: settings?.telegramChatId || null
      });
    } catch (error) {
      console.error("Telegram ayarları alınırken hata oluştu:", error);
      res.status(500).json({ 
        success: false, 
        error: "Telegram ayarları alınırken bir hata oluştu" 
      });
    }
  });

  // Stats
  app.get("/api/stats", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const services = await storage.getServicesByUserId(req.user!.id);
    
    const totalServices = services.length;
    const onlineServices = services.filter(s => s.status === "online").length;
    const offlineServices = services.filter(s => s.status === "offline").length;
    const degradedServices = services.filter(s => s.status === "degraded").length;
    
    const responseTimesMs = services
      .filter(s => s.responseTime != null)
      .map(s => s.responseTime!) || [];
    
    const avgResponseTime = responseTimesMs.length > 0
      ? Math.floor(responseTimesMs.reduce((acc, time) => acc + time, 0) / responseTimesMs.length)
      : null;
    
    const alerts = await storage.getRecentAlertsByUserId(req.user!.id, 10);
    
    res.status(200).json({
      totalServices,
      onlineServices,
      offlineServices,
      degradedServices,
      avgResponseTime,
      alerts
    });
  });

  // Service Maps (Project Topologies)
  app.get("/api/service-maps", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const maps = await storage.getServiceMapsByUserId(req.user!.id);
    res.status(200).json(maps);
  });

  app.get("/api/service-maps/default", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const map = await storage.getDefaultServiceMap(req.user!.id);
    if (!map) {
      return res.status(404).json({ error: "No default service map found" });
    }
    
    res.status(200).json(map);
  });

  app.get("/api/service-maps/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const mapId = parseInt(req.params.id);
    if (isNaN(mapId)) {
      return res.status(400).json({ error: "Invalid map ID" });
    }
    
    const map = await storage.getServiceMapById(mapId);
    if (!map || map.userId !== req.user!.id) {
      return res.status(404).json({ error: "Service map not found" });
    }
    
    // Get items associated with this map
    const serviceItems = await storage.getServiceMapItems(mapId);
    const agentItems = await storage.getAgentMapItems(mapId);
    
    // Return the map with its items
    res.status(200).json({
      ...map,
      serviceItems,
      agentItems
    });
  });
  
  // Get services in a map
  app.get("/api/service-maps/:id/services", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const mapId = parseInt(req.params.id);
    if (isNaN(mapId)) {
      return res.status(400).json({ error: "Invalid map ID" });
    }
    
    const map = await storage.getServiceMapById(mapId);
    if (!map || map.userId !== req.user!.id) {
      return res.status(404).json({ error: "Service map not found" });
    }
    
    // Get services in this map
    const serviceItems = await storage.getServiceMapItems(mapId);
    if (serviceItems.length === 0) {
      return res.status(200).json([]);
    }
    
    // Get the service details
    const serviceIds = serviceItems.map(item => item.serviceId);
    const allServices = await storage.getServicesByUserId(req.user!.id);
    const mapServices = allServices.filter(service => serviceIds.includes(service.id));
    
    res.status(200).json(mapServices);
  });
  
  // Get agents in a map
  app.get("/api/service-maps/:id/agents", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const mapId = parseInt(req.params.id);
    if (isNaN(mapId)) {
      return res.status(400).json({ error: "Invalid map ID" });
    }
    
    const map = await storage.getServiceMapById(mapId);
    if (!map || map.userId !== req.user!.id) {
      return res.status(404).json({ error: "Service map not found" });
    }
    
    // Get agents in this map
    const agentItems = await storage.getAgentMapItems(mapId);
    if (agentItems.length === 0) {
      return res.status(200).json([]);
    }
    
    // Get the agent details
    const agentIds = agentItems.map(item => item.agentId);
    const allAgents = await storage.getAgentsByUserId(req.user!.id);
    const mapAgents = allAgents.filter(agent => agentIds.includes(agent.id));
    
    res.status(200).json(mapAgents);
  });
  
  // We'll use the existing endpoint at line ~800 instead

  app.post("/api/service-maps", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const data = insertServiceMapSchema.parse({
        ...req.body,
        userId: req.user!.id
      });
      
      const map = await storage.createServiceMap(data);
      res.status(201).json(map);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Failed to create service map:", error);
      res.status(500).json({ error: "Failed to create service map" });
    }
  });

  app.put("/api/service-maps/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const mapId = parseInt(req.params.id);
    if (isNaN(mapId)) {
      return res.status(400).json({ error: "Invalid map ID" });
    }
    
    const map = await storage.getServiceMapById(mapId);
    if (!map || map.userId !== req.user!.id) {
      return res.status(404).json({ error: "Service map not found" });
    }
    
    try {
      const updatedMap = await storage.updateServiceMap(mapId, req.body);
      res.status(200).json(updatedMap);
    } catch (error) {
      console.error("Failed to update service map:", error);
      res.status(500).json({ error: "Failed to update service map" });
    }
  });

  app.put("/api/service-maps/:id/set-default", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const mapId = parseInt(req.params.id);
    if (isNaN(mapId)) {
      return res.status(400).json({ error: "Invalid map ID" });
    }
    
    const map = await storage.getServiceMapById(mapId);
    if (!map || map.userId !== req.user!.id) {
      return res.status(404).json({ error: "Service map not found" });
    }
    
    try {
      const updatedMap = await storage.setDefaultServiceMap(mapId);
      res.status(200).json(updatedMap);
    } catch (error) {
      console.error("Failed to set map as default:", error);
      res.status(500).json({ error: "Failed to set map as default" });
    }
  });

  app.delete("/api/service-maps/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const mapId = parseInt(req.params.id);
    if (isNaN(mapId)) {
      return res.status(400).json({ error: "Invalid map ID" });
    }
    
    const map = await storage.getServiceMapById(mapId);
    if (!map || map.userId !== req.user!.id) {
      return res.status(404).json({ error: "Service map not found" });
    }
    
    await storage.deleteServiceMap(mapId);
    res.status(204).send();
  });

  // Service Map Items
  app.get("/api/service-maps/:id/items", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const mapId = parseInt(req.params.id);
    if (isNaN(mapId)) {
      return res.status(400).json({ error: "Invalid map ID" });
    }
    
    const map = await storage.getServiceMapById(mapId);
    if (!map || map.userId !== req.user!.id) {
      return res.status(404).json({ error: "Service map not found" });
    }
    
    const serviceItems = await storage.getServiceMapItems(mapId);
    const agentItems = await storage.getAgentMapItems(mapId);
    
    res.status(200).json({
      serviceItems,
      agentItems
    });
  });
  
  // Get available services that are not in the map already
  app.get("/api/service-maps/:id/available-services", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const mapId = parseInt(req.params.id);
    if (isNaN(mapId)) {
      return res.status(400).json({ error: "Invalid map ID" });
    }
    
    const map = await storage.getServiceMapById(mapId);
    if (!map || map.userId !== req.user!.id) {
      return res.status(404).json({ error: "Service map not found" });
    }
    
    // Get services in this map
    const serviceItems = await storage.getServiceMapItems(mapId);
    const serviceIds = serviceItems.map(item => item.serviceId);
    
    // Get all user services
    const allServices = await storage.getServicesByUserId(req.user!.id);
    
    // Filter out services already in the map
    const availableServices = allServices.filter(service => !serviceIds.includes(service.id));
    
    res.status(200).json(availableServices);
  });

  app.post("/api/service-maps/:id/services/:serviceId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const mapId = parseInt(req.params.id);
    const serviceId = parseInt(req.params.serviceId);
    
    if (isNaN(mapId) || isNaN(serviceId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const map = await storage.getServiceMapById(mapId);
    const service = await storage.getServiceById(serviceId);
    
    if (!map || !service || map.userId !== req.user!.id || service.userId !== req.user!.id) {
      return res.status(404).json({ error: "Map or service not found" });
    }
    
    try {
      // Check if a position was provided
      const position = req.body.position ? { 
        x: req.body.position.x, 
        y: req.body.position.y 
      } : undefined;
      
      const item = await storage.addServiceToMap(mapId, serviceId, position);
      res.status(201).json(item);
    } catch (error) {
      console.error("Failed to add service to map:", error);
      res.status(500).json({ error: "Failed to add service to map" });
    }
  });

  app.delete("/api/service-maps/:id/services/:serviceId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const mapId = parseInt(req.params.id);
    const serviceId = parseInt(req.params.serviceId);
    
    if (isNaN(mapId) || isNaN(serviceId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const map = await storage.getServiceMapById(mapId);
    if (!map || map.userId !== req.user!.id) {
      return res.status(404).json({ error: "Map not found" });
    }
    
    await storage.removeServiceFromMap(mapId, serviceId);
    res.status(204).send();
  });

  app.put("/api/service-maps/:id/items/:itemId/position", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const mapId = parseInt(req.params.id);
    const itemId = parseInt(req.params.itemId);
    
    if (isNaN(mapId) || isNaN(itemId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const map = await storage.getServiceMapById(mapId);
    if (!map || map.userId !== req.user!.id) {
      return res.status(404).json({ error: "Map not found" });
    }
    
    if (!req.body.position || typeof req.body.position.x !== 'number' || typeof req.body.position.y !== 'number') {
      return res.status(400).json({ error: "Position must include x and y coordinates" });
    }
    
    try {
      const item = await storage.updateServiceMapItemPosition(itemId, {
        x: req.body.position.x,
        y: req.body.position.y
      });
      res.status(200).json(item);
    } catch (error) {
      console.error("Failed to update item position:", error);
      res.status(500).json({ error: "Failed to update item position" });
    }
  });

  // Agent Map Items
  app.post("/api/service-maps/:id/agents/:agentId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const mapId = parseInt(req.params.id);
    const agentId = parseInt(req.params.agentId);
    
    if (isNaN(mapId) || isNaN(agentId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const map = await storage.getServiceMapById(mapId);
    const agent = await storage.getAgentById(agentId);
    
    if (!map || !agent || map.userId !== req.user!.id || agent.userId !== req.user!.id) {
      return res.status(404).json({ error: "Map or agent not found" });
    }
    
    try {
      // Check if a position was provided
      const position = req.body.position ? { 
        x: req.body.position.x, 
        y: req.body.position.y 
      } : undefined;
      
      const item = await storage.addAgentToMap(mapId, agentId, position);
      res.status(201).json(item);
    } catch (error) {
      console.error("Failed to add agent to map:", error);
      res.status(500).json({ error: "Failed to add agent to map" });
    }
  });

  app.delete("/api/service-maps/:id/agents/:agentId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const mapId = parseInt(req.params.id);
    const agentId = parseInt(req.params.agentId);
    
    if (isNaN(mapId) || isNaN(agentId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const map = await storage.getServiceMapById(mapId);
    if (!map || map.userId !== req.user!.id) {
      return res.status(404).json({ error: "Map not found" });
    }
    
    await storage.removeAgentFromMap(mapId, agentId);
    res.status(204).send();
  });

  // Shared Maps (PatrolD)
  app.get("/api/shared-maps", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const maps = await storage.getSharedMapsByUserId(req.user!.id);
    res.status(200).json(maps);
  });
  
  app.get("/api/shared-maps/public", async (req, res) => {
    // This endpoint is public and doesn't require authentication
    const maps = await storage.getPublishedSharedMaps();
    res.status(200).json(maps);
  });
  
  app.get("/api/shared-maps/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const mapId = parseInt(req.params.id);
    if (isNaN(mapId)) {
      return res.status(400).json({ error: "Invalid map ID" });
    }
    
    const map = await storage.getSharedMapById(mapId);
    if (!map || map.userId !== req.user!.id) {
      return res.status(404).json({ error: "Shared map not found" });
    }
    
    res.status(200).json(map);
  });
  
  app.post("/api/shared-maps", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      let services: any[] = [];
      let connections: any[] = [];
      let mapData: any = {};
      
      // Check if a specific service map ID was provided
      if (req.body.serviceMapId && req.body.serviceMapId !== "all") {
        const serviceMapId = parseInt(req.body.serviceMapId);
        
        // Validate that the service map belongs to the user
        const serviceMap = await storage.getServiceMapById(serviceMapId);
        if (!serviceMap || serviceMap.userId !== req.user!.id) {
          return res.status(404).json({ error: "Service map not found" });
        }
        
        // Get services and their positions from the service map
        const serviceItems = await storage.getServiceMapItems(serviceMapId);
        if (serviceItems && serviceItems.length > 0) {
          // Get the actual service objects
          const serviceIds = serviceItems.map(item => item.serviceId);
          services = (await storage.getServicesByUserId(req.user!.id))
            .filter(service => serviceIds.includes(service.id));
            
          // Get connections between these services
          connections = (await storage.getConnectionsByUserId(req.user!.id))
            .filter(conn => 
              serviceIds.includes(conn.sourceId) && 
              serviceIds.includes(conn.targetId)
            );
        }
        
        // Include the service map layout information
        mapData = {
          services,
          connections,
          serviceMap,
          serviceItems
        };
      } else {
        // Get all user's services and connections
        services = await storage.getServicesByUserId(req.user!.id);
        connections = await storage.getConnectionsByUserId(req.user!.id);
        
        // Create a simple map data object
        mapData = {
          services,
          connections
        };
      }
      
      // Generate a unique share key
      const shareKey = `sm-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      
      // Create the shared map
      const map = await storage.createSharedMap({
        userId: req.user!.id,
        title: req.body.title,
        description: req.body.description || null,
        isPublished: req.body.isPublished || false,
        isPasswordProtected: req.body.isPasswordProtected || false,
        password: req.body.password || null,
        shareKey,
        mapData
      });
      
      res.status(201).json(map);
    } catch (error) {
      console.error("Failed to create shared map:", error);
      res.status(500).json({ error: "Failed to create shared map" });
    }
  });
  
  app.put("/api/shared-maps/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const mapId = parseInt(req.params.id);
    if (isNaN(mapId)) {
      return res.status(400).json({ error: "Invalid map ID" });
    }
    
    const map = await storage.getSharedMapById(mapId);
    if (!map || map.userId !== req.user!.id) {
      return res.status(404).json({ error: "Shared map not found" });
    }
    
    try {
      const updatedMap = await storage.updateSharedMap(mapId, {
        title: req.body.title || map.title,
        description: req.body.description !== undefined ? req.body.description : map.description,
        isPublished: req.body.isPublished !== undefined ? req.body.isPublished : map.isPublished,
        isPasswordProtected: req.body.isPasswordProtected !== undefined ? req.body.isPasswordProtected : map.isPasswordProtected,
        password: req.body.password !== undefined ? req.body.password : map.password,
        mapData: req.body.mapData || map.mapData
      });
      
      res.status(200).json(updatedMap);
    } catch (error) {
      console.error("Failed to update shared map:", error);
      res.status(500).json({ error: "Failed to update shared map" });
    }
  });
  
  app.delete("/api/shared-maps/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const mapId = parseInt(req.params.id);
    if (isNaN(mapId)) {
      return res.status(400).json({ error: "Invalid map ID" });
    }
    
    const map = await storage.getSharedMapById(mapId);
    if (!map || map.userId !== req.user!.id) {
      return res.status(404).json({ error: "Shared map not found" });
    }
    
    await storage.deleteSharedMap(mapId);
    res.status(204).send();
  });
  
  // Public endpoint to view a shared map via its share key
  app.get("/api/view-map/:shareKey", async (req, res) => {
    const shareKey = req.params.shareKey;
    
    const map = await storage.getSharedMapByShareKey(shareKey);
    if (!map) {
      return res.status(404).json({ error: "Shared map not found" });
    }
    
    // If the map is password protected and no password provided, return limited data
    if (map.isPasswordProtected && !req.query.password) {
      return res.status(200).json({
        id: map.id,
        title: map.title,
        description: map.description,
        isPasswordProtected: true,
        viewCount: map.viewCount,
        createdAt: map.createdAt,
        updatedAt: map.updatedAt,
        isPublished: map.isPublished
      });
    }
    
    // If the map is password protected, verify the password
    if (map.isPasswordProtected && req.query.password !== map.password) {
      return res.status(401).json({ error: "Invalid password" });
    }
    
    // Increment the view count
    const updatedMap = await storage.incrementSharedMapViewCount(map.id);
    
    // Determine what type of map data we have
    try {
      let services = [];
      let connections = [];
            
      if (map.mapData && typeof map.mapData === 'object') {
        // Type assertion for mapData
        type MapDataWithServices = { services: any[], connections: any[] };
        type MapDataWithServiceMapId = { serviceMapId: number };
        
        // If mapData already contains services and connections arrays
        if (Array.isArray((map.mapData as MapDataWithServices).services) && 
            Array.isArray((map.mapData as MapDataWithServices).connections)) {
          console.log("Using embedded services and connections from mapData");
          services = (map.mapData as MapDataWithServices).services;
          connections = (map.mapData as MapDataWithServices).connections;
        } 
        // If mapData contains a serviceMapId reference
        else if ((map.mapData as MapDataWithServiceMapId).serviceMapId) {
          console.log("Using referenced serviceMap data with ID:", (map.mapData as MapDataWithServiceMapId).serviceMapId);
          const serviceMap = await storage.getServiceMapById((map.mapData as MapDataWithServiceMapId).serviceMapId);
          if (!serviceMap) {
            return res.status(404).json({ error: "Original service map not found" });
          }
          
          // Get all services for this map
          const serviceItems = await storage.getServiceMapItems(serviceMap.id);
          
          // Get all service details
          for (const item of serviceItems) {
            const service = await storage.getServiceById(item.serviceId);
            if (service) {
              services.push({
                ...service,
                position: {
                  x: item.positionX,
                  y: item.positionY
                }
              });
            }
          }
          
          // Get all connections for the user
          const allConnections = await storage.getConnectionsByUserId(serviceMap.userId);
          
          // Filter connections that are between services in this map
          const serviceIds = services.map(s => s.id);
          connections = allConnections.filter(
            c => serviceIds.includes(c.sourceId) && serviceIds.includes(c.targetId)
          );
        } else {
          console.log("Using direct mapData object:", Object.keys(map.mapData));
          // Use type casting for typesafety
          const mapDataObj = map.mapData as Record<string, any>;
          if (mapDataObj.services) services = mapDataObj.services;
          if (mapDataObj.connections) connections = mapDataObj.connections;
        }
      } else {
        return res.status(404).json({ error: "Invalid map data format" });
      }
      
      // Return the full map data with services and connections
      res.status(200).json({
        ...updatedMap,
        mapData: {
          services,
          connections
        }
      });
    } catch (error) {
      console.error("Error processing view-map request:", error);
      res.status(500).json({ error: "Failed to process shared map data" });
    }
  });

  // Add a catch-all GET route for SPA client-side routing
  // This needs to come AFTER all other defined API routes
  app.get('/view-map*', (req, res) => {
    // For any client-side route like /view-map/:shareKey, serve the index.html
    res.sendFile(path.resolve(process.cwd(), './client/index.html'));
  });
  
  // Add all other valid routes for SPA
  const spaRoutes = ['/service-maps*', '/services*', '/agents*', '/alerts*', '/history*', '/settings*'];
  spaRoutes.forEach(route => {
    app.get(route, (req, res) => {
      res.sendFile(path.resolve(process.cwd(), './client/index.html'));
    });
  });
  
  const httpServer = createServer(app);
  return httpServer;
}
