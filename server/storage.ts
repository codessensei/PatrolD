import { 
  User, InsertUser, 
  Service, InsertService, 
  Connection, InsertConnection,
  Alert, InsertAlert,
  Agent, InsertAgent,
  UserSettings, InsertUserSettings,
  SharedMap, InsertSharedMap,
  ServiceMetrics, InsertServiceMetrics
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

// Create a memory store
const MemoryStoreConstructor = createMemoryStore(session);

// Define our session store type to avoid SessionStore errors
type SessionStore = session.Store;

// Storage interface for all our data
export interface IStorage {
  // User
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Service
  getServiceById(id: number): Promise<Service | undefined>;
  getServicesByUserId(userId: number): Promise<Service[]>;
  createService(service: InsertService): Promise<Service>;
  updateService(service: Service): Promise<Service>;
  deleteService(id: number): Promise<void>;
  updateServiceStatus(id: number, status: string, responseTime?: number): Promise<Service>;
  
  // Service Metrics
  getServiceMetrics(serviceId: number, timespan?: string): Promise<ServiceMetrics[]>;
  addServiceMetric(metric: InsertServiceMetrics): Promise<ServiceMetrics>;
  updateServiceAggregateMetrics(serviceId: number): Promise<Service>;

  // Connection
  getConnectionById(id: number): Promise<Connection | undefined>;
  getConnectionsByUserId(userId: number): Promise<Connection[]>;
  createConnection(connection: InsertConnection): Promise<Connection>;
  deleteConnection(id: number): Promise<void>;
  updateConnectionStatus(id: number, status: string): Promise<Connection>;

  // Alert
  getAlertById(id: number): Promise<Alert | undefined>;
  getAlertsByUserId(userId: number): Promise<Alert[]>;
  getRecentAlertsByUserId(userId: number, limit: number): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  acknowledgeAlert(id: number): Promise<Alert>;

  // Agent
  getAgentById(id: number): Promise<Agent | undefined>;
  getAgentByApiKey(apiKey: string): Promise<Agent | undefined>;
  getAgentsByUserId(userId: number): Promise<Agent[]>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(agent: Agent): Promise<Agent>;
  deleteAgent(id: number): Promise<void>;
  updateAgentStatus(id: number, status: string, serverInfo?: any): Promise<Agent>;
  
  // User Settings
  getUserSettings(userId: number): Promise<UserSettings | undefined>;
  updateUserSettings(settings: Partial<UserSettings> & { userId: number }): Promise<UserSettings>;
  
  // Shared Maps
  getSharedMapById(id: number): Promise<SharedMap | undefined>;
  getSharedMapByShareKey(shareKey: string): Promise<SharedMap | undefined>;
  getSharedMapsByUserId(userId: number): Promise<SharedMap[]>;
  getPublishedSharedMaps(): Promise<SharedMap[]>;
  createSharedMap(map: InsertSharedMap): Promise<SharedMap>;
  updateSharedMap(id: number, data: Partial<SharedMap>): Promise<SharedMap>;
  deleteSharedMap(id: number): Promise<void>;
  incrementSharedMapViewCount(id: number): Promise<SharedMap>;
  
  // Session store
  sessionStore: SessionStore;
  
  // Access to users collection for monitoring
  users: Map<number, User>;
}

export class MemStorage implements IStorage {
  users: Map<number, User>; // Changed from private to public to match interface
  private services: Map<number, Service>;
  private connections: Map<number, Connection>;
  private alerts: Map<number, Alert>;
  private agents: Map<number, Agent>;
  private userSettings: Map<number, UserSettings>;
  private sharedMaps: Map<number, SharedMap>;
  private serviceMetrics: Map<number, ServiceMetrics>;
  
  sessionStore: SessionStore;
  private userId: number = 1;
  private serviceId: number = 1;
  private connectionId: number = 1;
  private alertId: number = 1;
  private agentId: number = 1;
  private userSettingsId: number = 1;
  private sharedMapId: number = 1;
  private serviceMetricsId: number = 1;

  constructor() {
    this.users = new Map();
    this.services = new Map();
    this.connections = new Map();
    this.alerts = new Map();
    this.agents = new Map();
    this.userSettings = new Map();
    this.sharedMaps = new Map();
    this.serviceMetrics = new Map();
    this.sessionStore = new MemoryStoreConstructor({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Service methods
  async getServiceById(id: number): Promise<Service | undefined> {
    return this.services.get(id);
  }

  async getServicesByUserId(userId: number): Promise<Service[]> {
    return Array.from(this.services.values()).filter(
      service => service.userId === userId
    );
  }

  async createService(insertService: InsertService): Promise<Service> {
    const id = this.serviceId++;
    const service: Service = { 
      ...insertService, 
      id,
      status: "unknown",
      lastChecked: new Date(),
      monitorType: insertService.monitorType || "direct",
      agentId: insertService.agentId || null,
      responseTime: null
    };
    this.services.set(id, service);
    return service;
  }

  async updateService(service: Service): Promise<Service> {
    this.services.set(service.id, service);
    return service;
  }

  async deleteService(id: number): Promise<void> {
    // Delete service
    this.services.delete(id);
    
    // Delete associated connections
    const connectionsToDelete = Array.from(this.connections.values()).filter(
      conn => conn.sourceId === id || conn.targetId === id
    );
    
    for (const conn of connectionsToDelete) {
      this.connections.delete(conn.id);
    }
    
    // Delete associated alerts
    const alertsToDelete = Array.from(this.alerts.values()).filter(
      alert => alert.serviceId === id
    );
    
    for (const alert of alertsToDelete) {
      this.alerts.delete(alert.id);
    }
  }

  async updateServiceStatus(id: number, status: string, responseTime?: number): Promise<Service> {
    const service = await this.getServiceById(id);
    if (!service) throw new Error(`Service with id ${id} not found`);
    
    const oldStatus = service.status;
    const newService: Service = {
      ...service,
      status,
      responseTime: responseTime ?? service.responseTime,
      lastChecked: new Date()
    };
    
    this.services.set(id, newService);
    
    // Create an alert if the service status changed to offline
    if (oldStatus !== "offline" && status === "offline") {
      await this.createAlert({
        userId: service.userId,
        serviceId: id,
        type: "status_change",
        message: `Service ${service.name} is offline`,
        timestamp: new Date(),
        acknowledged: false
      });
    }
    
    // Create an alert if the service recovered
    if (oldStatus === "offline" && status === "online") {
      await this.createAlert({
        userId: service.userId,
        serviceId: id,
        type: "recovery",
        message: `Service ${service.name} is now online`,
        timestamp: new Date(),
        acknowledged: false
      });
    }
    
    return newService;
  }

  // Connection methods
  async getConnectionById(id: number): Promise<Connection | undefined> {
    return this.connections.get(id);
  }

  async getConnectionsByUserId(userId: number): Promise<Connection[]> {
    return Array.from(this.connections.values()).filter(
      connection => connection.userId === userId
    );
  }

  async createConnection(insertConnection: InsertConnection): Promise<Connection> {
    const id = this.connectionId++;
    const connection: Connection = { 
      ...insertConnection, 
      id,
      status: "unknown" 
    };
    this.connections.set(id, connection);
    return connection;
  }

  async deleteConnection(id: number): Promise<void> {
    this.connections.delete(id);
  }

  async updateConnectionStatus(id: number, status: string): Promise<Connection> {
    const connection = await this.getConnectionById(id);
    if (!connection) throw new Error(`Connection with id ${id} not found`);
    
    const updatedConnection: Connection = { ...connection, status };
    this.connections.set(id, updatedConnection);
    return updatedConnection;
  }

  // Alert methods
  async getAlertById(id: number): Promise<Alert | undefined> {
    return this.alerts.get(id);
  }

  async getAlertsByUserId(userId: number): Promise<Alert[]> {
    return Array.from(this.alerts.values())
      .filter(alert => alert.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getRecentAlertsByUserId(userId: number, limit: number): Promise<Alert[]> {
    return Array.from(this.alerts.values())
      .filter(alert => alert.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async createAlert(insertAlert: InsertAlert): Promise<Alert> {
    const id = this.alertId++;
    const alert: Alert = { 
      ...insertAlert, 
      id,
      timestamp: insertAlert.timestamp || new Date(),
      acknowledged: insertAlert.acknowledged ?? false
    };
    this.alerts.set(id, alert);
    return alert;
  }

  async acknowledgeAlert(id: number): Promise<Alert> {
    const alert = await this.getAlertById(id);
    if (!alert) throw new Error(`Alert with id ${id} not found`);
    
    const updatedAlert: Alert = { ...alert, acknowledged: true };
    this.alerts.set(id, updatedAlert);
    return updatedAlert;
  }

  // Agent methods
  async getAgentById(id: number): Promise<Agent | undefined> {
    return this.agents.get(id);
  }

  async getAgentByApiKey(apiKey: string): Promise<Agent | undefined> {
    return Array.from(this.agents.values()).find(
      agent => agent.apiKey === apiKey
    );
  }

  async getAgentsByUserId(userId: number): Promise<Agent[]> {
    return Array.from(this.agents.values()).filter(
      agent => agent.userId === userId
    );
  }

  async createAgent(insertAgent: InsertAgent): Promise<Agent> {
    const id = this.agentId++;
    // Generate a unique API key (combination of user id, agent id, and random string)
    const apiKey = `agt_${Math.random().toString(36).substring(2, 15)}_${new Date().getTime().toString(36)}`;
    
    const agent: Agent = { 
      ...insertAgent, 
      id, 
      apiKey,
      status: "inactive",
      description: insertAgent.description || null,
      serverInfo: null,
      lastSeen: null,
      createdAt: new Date()
    };
    
    this.agents.set(id, agent);
    return agent;
  }

  async updateAgent(agent: Agent): Promise<Agent> {
    this.agents.set(agent.id, agent);
    return agent;
  }

  async deleteAgent(id: number): Promise<void> {
    this.agents.delete(id);
  }

  async updateAgentStatus(id: number, status: string, serverInfo?: any): Promise<Agent> {
    const agent = await this.getAgentById(id);
    if (!agent) throw new Error(`Agent with id ${id} not found`);
    
    const updatedAgent: Agent = { 
      ...agent, 
      status,
      serverInfo: serverInfo ? serverInfo : agent.serverInfo,
      lastSeen: new Date()
    };
    
    this.agents.set(id, updatedAgent);
    return updatedAgent;
  }

  // User Settings methods
  async getUserSettings(userId: number): Promise<UserSettings | undefined> {
    return Array.from(this.userSettings.values()).find(
      settings => settings.userId === userId
    );
  }

  async updateUserSettings(settings: Partial<UserSettings> & { userId: number }): Promise<UserSettings> {
    const existingSettings = await this.getUserSettings(settings.userId);
    
    if (existingSettings) {
      // Update existing settings
      const updatedSettings: UserSettings = {
        ...existingSettings,
        ...settings,
        updatedAt: new Date()
      };
      
      this.userSettings.set(existingSettings.id, updatedSettings);
      return updatedSettings;
    } else {
      // Create new settings
      const id = this.userSettingsId++;
      const newSettings: UserSettings = {
        id,
        userId: settings.userId,
        theme: settings.theme || "light",
        enableEmailAlerts: settings.enableEmailAlerts || false,
        emailAddress: settings.emailAddress || null,
        enableTelegramAlerts: settings.enableTelegramAlerts || false,
        telegramChatId: settings.telegramChatId || null,
        alertFrequency: settings.alertFrequency || "immediate",
        customSettings: settings.customSettings || {},
        updatedAt: new Date()
      };
      
      this.userSettings.set(id, newSettings);
      return newSettings;
    }
  }
  
  // Shared Maps methods
  async getSharedMapById(id: number): Promise<SharedMap | undefined> {
    return this.sharedMaps.get(id);
  }

  async getSharedMapByShareKey(shareKey: string): Promise<SharedMap | undefined> {
    return Array.from(this.sharedMaps.values()).find(
      map => map.shareKey === shareKey
    );
  }

  async getSharedMapsByUserId(userId: number): Promise<SharedMap[]> {
    return Array.from(this.sharedMaps.values()).filter(
      map => map.userId === userId
    );
  }

  async getPublishedSharedMaps(): Promise<SharedMap[]> {
    return Array.from(this.sharedMaps.values()).filter(
      map => map.isPublished
    );
  }

  async createSharedMap(insertMap: InsertSharedMap): Promise<SharedMap> {
    const id = this.sharedMapId++;
    
    // Generate a unique share key
    const shareKey = `map_${Math.random().toString(36).substring(2, 10)}_${new Date().getTime().toString(36)}`;
    
    const map: SharedMap = {
      ...insertMap,
      id,
      shareKey,
      viewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.sharedMaps.set(id, map);
    return map;
  }

  async updateSharedMap(id: number, data: Partial<SharedMap>): Promise<SharedMap> {
    const map = await this.getSharedMapById(id);
    if (!map) throw new Error(`Shared map with id ${id} not found`);
    
    const updatedMap: SharedMap = {
      ...map,
      ...data,
      updatedAt: new Date()
    };
    
    this.sharedMaps.set(id, updatedMap);
    return updatedMap;
  }

  async deleteSharedMap(id: number): Promise<void> {
    this.sharedMaps.delete(id);
  }

  async incrementSharedMapViewCount(id: number): Promise<SharedMap> {
    const map = await this.getSharedMapById(id);
    if (!map) throw new Error(`Shared map with id ${id} not found`);
    
    const updatedMap: SharedMap = {
      ...map,
      viewCount: (map.viewCount || 0) + 1
    };
    
    this.sharedMaps.set(id, updatedMap);
    return updatedMap;
  }

  // Service Metrics methods
  async getServiceMetrics(serviceId: number, timespan?: string): Promise<ServiceMetrics[]> {
    // Get all metrics for the specified service
    const allMetrics = Array.from(this.serviceMetrics.values())
      .filter(metric => metric.serviceId === serviceId);
    
    if (!timespan) {
      // Return all metrics, sorted by timestamp (newest first)
      return allMetrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    
    // Filter by timespan
    const now = new Date();
    let startDate: Date;
    
    switch (timespan) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '6h':
        startDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default to 24h
    }
    
    return allMetrics
      .filter(metric => metric.timestamp >= startDate && metric.timestamp <= now)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async addServiceMetric(metric: InsertServiceMetrics): Promise<ServiceMetrics> {
    const id = this.serviceMetricsId++;
    const newMetric: ServiceMetrics = {
      ...metric,
      id,
      timestamp: metric.timestamp || new Date()
    };
    
    this.serviceMetrics.set(id, newMetric);
    
    // Update the service aggregate metrics whenever we add a new metric
    await this.updateServiceAggregateMetrics(metric.serviceId);
    
    return newMetric;
  }

  async updateServiceAggregateMetrics(serviceId: number): Promise<Service> {
    const service = await this.getServiceById(serviceId);
    if (!service) throw new Error(`Service with id ${serviceId} not found`);
    
    // Get metrics from the last 24 hours
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const metrics = Array.from(this.serviceMetrics.values())
      .filter(metric => 
        metric.serviceId === serviceId && 
        metric.timestamp >= yesterday && 
        metric.timestamp <= now
      );
    
    if (!metrics.length) {
      // No recent metrics available, just return the service unchanged
      return service;
    }
    
    // Calculate aggregate metrics
    const responseTimes = metrics
      .map(m => m.responseTime)
      .filter(rt => rt !== null && rt !== undefined) as number[];
    
    const latencies = metrics
      .map(m => m.latency)
      .filter(l => l !== null && l !== undefined) as number[];
    
    const packetLosses = metrics
      .map(m => m.packetLoss)
      .filter(pl => pl !== null && pl !== undefined) as number[];
    
    // Calculate average response time
    const avgResponseTime = responseTimes.length 
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : null;
    
    // Calculate max and min response times
    const maxResponseTime = responseTimes.length ? Math.max(...responseTimes) : null;
    const minResponseTime = responseTimes.length ? Math.min(...responseTimes) : null;
    
    // Calculate average latency
    const avgLatency = latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;
    
    // Calculate average packet loss
    const avgPacketLoss = packetLosses.length
      ? Number((packetLosses.reduce((a, b) => a + b, 0) / packetLosses.length).toFixed(2))
      : null;
    
    // Calculate availability (percentage of online checks)
    const totalChecks = metrics.length;
    const onlineChecks = metrics.filter(m => m.status === 'online').length;
    const availability = totalChecks ? Number(((onlineChecks / totalChecks) * 100).toFixed(2)) : null;
    
    // Update service with aggregate metrics
    const updatedService: Service = {
      ...service,
      avgResponseTime24h: avgResponseTime,
      maxResponseTime24h: maxResponseTime,
      minResponseTime24h: minResponseTime,
      avgLatency24h: avgLatency,
      packetLoss24h: avgPacketLoss,
      availability24h: availability
    };
    
    this.services.set(serviceId, updatedService);
    return updatedService;
  }
}

// Export the database storage instance
import { DatabaseStorage } from "./database-storage";
export const storage = new DatabaseStorage();
