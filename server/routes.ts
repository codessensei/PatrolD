import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { setupMonitoring } from "./monitor";
import { z } from "zod";
import { insertConnectionSchema, insertServiceSchema, insertAgentSchema } from "@shared/schema";
import { randomBytes } from "crypto";
import * as fs from 'fs';

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
      const apiKey = randomBytes(32).toString('hex');
      
      const data = insertAgentSchema.parse({
        ...req.body,
        userId: req.user!.id,
        apiKey,
        status: "inactive",
        createdAt: new Date()
      });
      
      const agent = await storage.createAgent(data);
      res.status(201).json(agent);
    } catch (error) {
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
    
    // Just return the current agent without changes
    res.status(200).json(agent);
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
      default:
        return res.status(400).json({ error: "Invalid script type" });
    }
    
    try {
      // Read the script template
      let script = fs.readFileSync(filePath, 'utf8');
      
      // Get the application base URL
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const baseUrl = `${protocol}://${req.headers.host}`;
      
      // Replace placeholders with actual values
      script = script.replace(/["']?{{API_KEY}}["']?/g, `"${agent.apiKey}"`);
      script = script.replace(/["']?{{API_BASE_URL}}["']?/g, `"${baseUrl}"`);
      
      // Double check that the API_KEY is actually replaced
      if (script.includes("{{API_KEY}}")) {
        console.log("Warning: API_KEY placeholder not replaced in script");
      }
      
      // Set filename for download
      const filename = filePath.split('/').pop();
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      res.send(script);
    } catch (error) {
      console.error(`Error serving agent script template: ${error}`);
      res.status(500).json({ error: "Failed to generate agent script" });
    }
  });

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
    
    await storage.deleteAgent(agentId);
    res.status(204).send();
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
      const updatedAgent = await storage.updateAgentStatus(agent.id, "active", serverInfo);
      
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

  const httpServer = createServer(app);
  return httpServer;
}
