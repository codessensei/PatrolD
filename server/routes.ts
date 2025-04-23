import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { setupMonitoring } from "./monitor";
import { z } from "zod";
import { insertConnectionSchema, insertServiceSchema } from "@shared/schema";

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
