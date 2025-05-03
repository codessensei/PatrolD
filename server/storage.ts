import { 
  User, InsertUser, 
  Service, InsertService, 
  Connection, InsertConnection,
  Alert, InsertAlert,
  Agent, InsertAgent,
  UserSettings, InsertUserSettings,
  SharedMap, InsertSharedMap
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
  
  // Shared Maps (PatrolD)
  getSharedMapById(id: number): Promise<SharedMap | undefined>;
  getSharedMapByShareKey(shareKey: string): Promise<SharedMap | undefined>;
  getSharedMapsByUserId(userId: number): Promise<SharedMap[]>;
  getPublishedSharedMaps(): Promise<SharedMap[]>;
  createSharedMap(map: InsertSharedMap): Promise<SharedMap>;
  updateSharedMap(id: number, data: Partial<SharedMap>): Promise<SharedMap>;
  deleteSharedMap(id: number): Promise<void>;
  incrementSharedMapViewCount(id: number): Promise<SharedMap>;
  
  // Service Maps (Different project topologies)
  getServiceMapById(id: number): Promise<ServiceMap | undefined>;
  getServiceMapsByUserId(userId: number): Promise<ServiceMap[]>;
  getDefaultServiceMap(userId: number): Promise<ServiceMap | undefined>;
  createServiceMap(map: InsertServiceMap): Promise<ServiceMap>;
  updateServiceMap(id: number, data: Partial<ServiceMap>): Promise<ServiceMap>;
  deleteServiceMap(id: number): Promise<void>;
  setDefaultServiceMap(id: number): Promise<ServiceMap>;
  
  // Service Map Items
  getServiceMapItems(mapId: number): Promise<ServiceMapItem[]>;
  addServiceToMap(mapId: number, serviceId: number, position?: { x: number, y: number }): Promise<ServiceMapItem>;
  removeServiceFromMap(mapId: number, serviceId: number): Promise<void>;
  updateServiceMapItemPosition(id: number, position: { x: number, y: number }): Promise<ServiceMapItem>;
  
  // Agent Map Items
  getAgentMapItems(mapId: number): Promise<AgentMapItem[]>;
  addAgentToMap(mapId: number, agentId: number, position?: { x: number, y: number }): Promise<AgentMapItem>;
  removeAgentFromMap(mapId: number, agentId: number): Promise<void>;
  
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
  
  sessionStore: SessionStore;
  private userId: number = 1;
  private serviceId: number = 1;
  private connectionId: number = 1;
  private alertId: number = 1;
  private agentId: number = 1;
  private userSettingsId: number = 1;

  constructor() {
    this.users = new Map();
    this.services = new Map();
    this.connections = new Map();
    this.alerts = new Map();
    this.agents = new Map();
    this.userSettings = new Map();
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
  
  // Shared Maps (PatrolD) methods
  private sharedMaps: Map<number, SharedMap> = new Map();
  private sharedMapId: number = 1;
  
  // Service Maps (Different project topologies)
  private serviceMaps: Map<number, ServiceMap> = new Map();
  private serviceMapId: number = 1;
  private serviceMapItems: Map<number, ServiceMapItem> = new Map();
  private serviceMapItemId: number = 1;
  private agentMapItems: Map<number, AgentMapItem> = new Map();
  private agentMapItemId: number = 1;
  
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
      viewCount: map.viewCount + 1
    };
    
    this.sharedMaps.set(id, updatedMap);
    return updatedMap;
  }

  // Service Maps methods
  async getServiceMapById(id: number): Promise<ServiceMap | undefined> {
    return this.serviceMaps.get(id);
  }

  async getServiceMapsByUserId(userId: number): Promise<ServiceMap[]> {
    return Array.from(this.serviceMaps.values()).filter(
      map => map.userId === userId
    );
  }

  async getDefaultServiceMap(userId: number): Promise<ServiceMap | undefined> {
    return Array.from(this.serviceMaps.values()).find(
      map => map.userId === userId && map.isDefault
    );
  }

  async createServiceMap(insertMap: InsertServiceMap): Promise<ServiceMap> {
    const id = this.serviceMapId++;
    
    // Check if this is the first map for this user
    const userMaps = await this.getServiceMapsByUserId(insertMap.userId);
    const isFirst = userMaps.length === 0;
    
    const map: ServiceMap = {
      ...insertMap,
      id,
      // If this is the first map or explicitly set as default
      isDefault: isFirst || insertMap.isDefault || false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // If this map is default, make sure no other maps are default
    if (map.isDefault) {
      for (const existingMap of userMaps) {
        if (existingMap.isDefault) {
          existingMap.isDefault = false;
          this.serviceMaps.set(existingMap.id, existingMap);
        }
      }
    }
    
    // Create an empty map (no automatic service/agent assignment)
    this.serviceMaps.set(id, map);
    return map;
  }

  async updateServiceMap(id: number, data: Partial<ServiceMap>): Promise<ServiceMap> {
    const map = await this.getServiceMapById(id);
    if (!map) throw new Error(`Service map with id ${id} not found`);
    
    const updatedMap: ServiceMap = {
      ...map,
      ...data,
      updatedAt: new Date()
    };
    
    this.serviceMaps.set(id, updatedMap);
    return updatedMap;
  }

  async deleteServiceMap(id: number): Promise<void> {
    const map = await this.getServiceMapById(id);
    if (!map) return;
    
    // If this was the default map, set another map as default if available
    if (map.isDefault) {
      const userMaps = await this.getServiceMapsByUserId(map.userId);
      const otherMap = userMaps.find(m => m.id !== id);
      if (otherMap) {
        otherMap.isDefault = true;
        this.serviceMaps.set(otherMap.id, otherMap);
      }
    }
    
    // Delete all map items
    const serviceItems = await this.getServiceMapItems(id);
    for (const item of serviceItems) {
      this.serviceMapItems.delete(item.id);
    }
    
    const agentItems = await this.getAgentMapItems(id);
    for (const item of agentItems) {
      this.agentMapItems.delete(item.id);
    }
    
    // Delete the map
    this.serviceMaps.delete(id);
  }

  async setDefaultServiceMap(id: number): Promise<ServiceMap> {
    const map = await this.getServiceMapById(id);
    if (!map) throw new Error(`Service map with id ${id} not found`);
    
    // Get all maps for this user and unset default
    const userMaps = await this.getServiceMapsByUserId(map.userId);
    for (const existingMap of userMaps) {
      if (existingMap.id !== id && existingMap.isDefault) {
        existingMap.isDefault = false;
        this.serviceMaps.set(existingMap.id, existingMap);
      }
    }
    
    // Set this map as default
    map.isDefault = true;
    this.serviceMaps.set(id, map);
    return map;
  }

  // Service Map Items methods
  async getServiceMapItems(mapId: number): Promise<ServiceMapItem[]> {
    return Array.from(this.serviceMapItems.values()).filter(
      item => item.mapId === mapId
    );
  }

  async addServiceToMap(mapId: number, serviceId: number, position?: { x: number, y: number }): Promise<ServiceMapItem> {
    // Check if service already exists in this map
    const existing = Array.from(this.serviceMapItems.values()).find(
      item => item.mapId === mapId && item.serviceId === serviceId
    );
    
    if (existing) {
      return existing;
    }
    
    const id = this.serviceMapItemId++;
    const item: ServiceMapItem = {
      id,
      mapId,
      serviceId,
      positionX: position?.x || 0,
      positionY: position?.y || 0,
      createdAt: new Date()
    };
    
    this.serviceMapItems.set(id, item);
    return item;
  }

  async removeServiceFromMap(mapId: number, serviceId: number): Promise<void> {
    const items = Array.from(this.serviceMapItems.values());
    const item = items.find(i => i.mapId === mapId && i.serviceId === serviceId);
    
    if (item) {
      this.serviceMapItems.delete(item.id);
    }
  }

  async updateServiceMapItemPosition(id: number, position: { x: number, y: number }): Promise<ServiceMapItem> {
    const item = this.serviceMapItems.get(id);
    if (!item) throw new Error(`Service map item with id ${id} not found`);
    
    const updatedItem: ServiceMapItem = {
      ...item,
      positionX: position.x,
      positionY: position.y
    };
    
    this.serviceMapItems.set(id, updatedItem);
    return updatedItem;
  }

  // Agent Map Items methods
  async getAgentMapItems(mapId: number): Promise<AgentMapItem[]> {
    return Array.from(this.agentMapItems.values()).filter(
      item => item.mapId === mapId
    );
  }

  async addAgentToMap(mapId: number, agentId: number, position?: { x: number, y: number }): Promise<AgentMapItem> {
    // Check if agent already exists in this map
    const existing = Array.from(this.agentMapItems.values()).find(
      item => item.mapId === mapId && item.agentId === agentId
    );
    
    if (existing) {
      return existing;
    }
    
    const id = this.agentMapItemId++;
    const item: AgentMapItem = {
      id,
      mapId,
      agentId,
      positionX: position?.x || 0,
      positionY: position?.y || 0,
      createdAt: new Date()
    };
    
    this.agentMapItems.set(id, item);
    return item;
  }

  async removeAgentFromMap(mapId: number, agentId: number): Promise<void> {
    const items = Array.from(this.agentMapItems.values());
    const item = items.find(i => i.mapId === mapId && i.agentId === agentId);
    
    if (item) {
      this.agentMapItems.delete(item.id);
    }
  }
}

// Export the database storage instance
import { DatabaseStorage } from "./database-storage";
export const storage = new DatabaseStorage();
