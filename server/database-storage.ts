import { 
  User, InsertUser, users,
  Service, InsertService, services,
  Connection, InsertConnection, connections,
  Alert, InsertAlert, alerts,
  Agent, InsertAgent, agents,
  UserSettings, InsertUserSettings, userSettings,
  SharedMap, InsertSharedMap, sharedMaps,
  ServiceMap, InsertServiceMap, serviceMaps,
  ServiceMapItem, InsertServiceMapItem, serviceMapItems,
  AgentMapItem, InsertAgentMapItem, agentMapItems
} from "@shared/schema";
import { IStorage } from "./storage";
import { db, pool } from "./db";
import { eq, desc, and, lte, gte, ne } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import session from "express-session";
import { randomBytes } from "crypto";

// Define our session store type to avoid SessionStore errors
type SessionStore = session.Store;
const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  sessionStore: SessionStore;
  users: Map<number, User> = new Map();
  
  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true
    });
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  
  // Service methods
  async getServiceById(id: number): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service;
  }
  
  async getServicesByUserId(userId: number): Promise<Service[]> {
    return await db.select().from(services).where(eq(services.userId, userId));
  }
  
  async createService(service: InsertService): Promise<Service> {
    const [createdService] = await db.insert(services).values(service).returning();
    return createdService;
  }
  
  async updateService(service: Service): Promise<Service> {
    const [updatedService] = await db
      .update(services)
      .set(service)
      .where(eq(services.id, service.id))
      .returning();
    return updatedService;
  }
  
  async deleteService(id: number): Promise<void> {
    await db.delete(services).where(eq(services.id, id));
  }
  
  async updateServiceStatus(id: number, status: string, responseTime?: number): Promise<Service> {
    const now = new Date();
    const [updatedService] = await db
      .update(services)
      .set({ 
        status, 
        responseTime, 
        lastChecked: now
      })
      .where(eq(services.id, id))
      .returning();
    return updatedService;
  }
  
  // Connection methods
  async getConnectionById(id: number): Promise<Connection | undefined> {
    const [connection] = await db.select().from(connections).where(eq(connections.id, id));
    return connection;
  }
  
  async getConnectionsByUserId(userId: number): Promise<Connection[]> {
    return await db.select().from(connections).where(eq(connections.userId, userId));
  }
  
  async createConnection(connection: InsertConnection): Promise<Connection> {
    const [createdConnection] = await db.insert(connections).values(connection).returning();
    return createdConnection;
  }
  
  async deleteConnection(id: number): Promise<void> {
    await db.delete(connections).where(eq(connections.id, id));
  }
  
  async updateConnectionStatus(id: number, status: string): Promise<Connection> {
    const [updatedConnection] = await db
      .update(connections)
      .set({ status })
      .where(eq(connections.id, id))
      .returning();
    return updatedConnection;
  }
  
  // Alert methods
  async getAlertById(id: number): Promise<Alert | undefined> {
    const [alert] = await db.select().from(alerts).where(eq(alerts.id, id));
    return alert;
  }
  
  async getAlertsByUserId(userId: number): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(eq(alerts.userId, userId));
  }
  
  async getRecentAlertsByUserId(userId: number, limit: number): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(eq(alerts.userId, userId))
      .limit(limit);
  }
  
  async createAlert(alert: InsertAlert): Promise<Alert> {
    const [createdAlert] = await db.insert(alerts).values(alert).returning();
    return createdAlert;
  }
  
  async acknowledgeAlert(id: number): Promise<Alert> {
    const [updatedAlert] = await db
      .update(alerts)
      .set({ acknowledged: true })
      .where(eq(alerts.id, id))
      .returning();
    return updatedAlert;
  }
  
  // Agent methods
  async getAgentById(id: number): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent;
  }
  
  async getAgentByApiKey(apiKey: string): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.apiKey, apiKey));
    return agent;
  }
  
  async getAgentsByUserId(userId: number): Promise<Agent[]> {
    return await db.select().from(agents).where(eq(agents.userId, userId));
  }
  
  async createAgent(agent: InsertAgent): Promise<Agent> {
    // Generate a unique API key
    const apiKey = `agent_${randomBytes(8).toString('hex')}`;
    
    // Insert with complete type-safe values
    const [createdAgent] = await db.insert(agents).values({
      name: agent.name,
      userId: agent.userId,
      apiKey,
      description: agent.description,
      status: agent.status,
      serverInfo: agent.serverInfo
    }).returning();
    
    return createdAgent;
  }
  
  async updateAgent(agent: Agent): Promise<Agent> {
    const [updatedAgent] = await db
      .update(agents)
      .set(agent)
      .where(eq(agents.id, agent.id))
      .returning();
    return updatedAgent;
  }
  
  async deleteAgent(id: number): Promise<void> {
    await db.delete(agents).where(eq(agents.id, id));
  }
  
  async updateAgentStatus(id: number, status: string, serverInfo?: any): Promise<Agent> {
    const [updatedAgent] = await db
      .update(agents)
      .set({ 
        status, 
        serverInfo: serverInfo ? JSON.stringify(serverInfo) : undefined,
        lastSeen: new Date()
      })
      .where(eq(agents.id, id))
      .returning();
    return updatedAgent;
  }
  
  // User Settings methods
  async getUserSettings(userId: number): Promise<UserSettings | undefined> {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));
    return settings;
  }
  
  async updateUserSettings(settings: Partial<UserSettings> & { userId: number }): Promise<UserSettings> {
    const { userId, ...updateData } = settings;
    const existingSettings = await this.getUserSettings(userId);
    
    if (existingSettings) {
      const [updatedSettings] = await db
        .update(userSettings)
        .set({ ...updateData })
        .where(eq(userSettings.userId, userId))
        .returning();
      return updatedSettings;
    } else {
      const [newSettings] = await db
        .insert(userSettings)
        .values({ 
          userId,
          ...updateData
        })
        .returning();
      return newSettings;
    }
  }

  // Shared Maps methods
  async getSharedMapById(id: number): Promise<SharedMap | undefined> {
    const [map] = await db.select().from(sharedMaps).where(eq(sharedMaps.id, id));
    return map;
  }

  async getSharedMapByShareKey(shareKey: string): Promise<SharedMap | undefined> {
    const [map] = await db.select().from(sharedMaps).where(eq(sharedMaps.shareKey, shareKey));
    return map;
  }

  async getSharedMapsByUserId(userId: number): Promise<SharedMap[]> {
    return await db.select().from(sharedMaps).where(eq(sharedMaps.userId, userId));
  }

  async getPublishedSharedMaps(): Promise<SharedMap[]> {
    return await db.select().from(sharedMaps).where(eq(sharedMaps.isPublished, true));
  }

  async createSharedMap(map: InsertSharedMap): Promise<SharedMap> {
    // Generate a unique share key if not provided
    if (!map.shareKey || map.shareKey.trim() === '') {
      map = {
        ...map,
        shareKey: `share_${randomBytes(8).toString('hex')}`
      };
    }
    
    const [createdMap] = await db.insert(sharedMaps).values(map).returning();
    return createdMap;
  }

  async updateSharedMap(id: number, data: Partial<SharedMap>): Promise<SharedMap> {
    const [updatedMap] = await db
      .update(sharedMaps)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(sharedMaps.id, id))
      .returning();
    return updatedMap;
  }

  async deleteSharedMap(id: number): Promise<void> {
    await db.delete(sharedMaps).where(eq(sharedMaps.id, id));
  }

  async incrementSharedMapViewCount(id: number): Promise<SharedMap> {
    // First get the current map to get its view count
    const [currentMap] = await db.select().from(sharedMaps).where(eq(sharedMaps.id, id));
    
    if (!currentMap) {
      throw new Error("Shared map not found");
    }
    
    // Now increment the view count using the actual number
    const [map] = await db
      .update(sharedMaps)
      .set({
        viewCount: (currentMap.viewCount || 0) + 1,
        updatedAt: new Date()
      })
      .where(eq(sharedMaps.id, id))
      .returning();
    
    return map;
  }

  // Service Maps methods
  async getServiceMapById(id: number): Promise<ServiceMap | undefined> {
    const [map] = await db.select().from(serviceMaps).where(eq(serviceMaps.id, id));
    return map;
  }

  async getServiceMapsByUserId(userId: number): Promise<ServiceMap[]> {
    return await db.select().from(serviceMaps).where(eq(serviceMaps.userId, userId));
  }

  async getDefaultServiceMap(userId: number): Promise<ServiceMap | undefined> {
    const [map] = await db
      .select()
      .from(serviceMaps)
      .where(and(
        eq(serviceMaps.userId, userId),
        eq(serviceMaps.isDefault, true)
      ));
    return map;
  }

  async createServiceMap(map: InsertServiceMap): Promise<ServiceMap> {
    // Check if this is the first map for this user
    const userMaps = await this.getServiceMapsByUserId(map.userId);
    const isFirst = userMaps.length === 0;

    // If this is the first map or explicitly set to default
    if (isFirst || map.isDefault) {
      // If another map is already default, unset it
      if (!isFirst && map.isDefault) {
        await db
          .update(serviceMaps)
          .set({ isDefault: false })
          .where(and(
            eq(serviceMaps.userId, map.userId),
            eq(serviceMaps.isDefault, true)
          ));
      }
    }

    // Insert new map
    const [createdMap] = await db.insert(serviceMaps).values({
      ...map,
      // If this is the first map, make it default regardless of input
      isDefault: isFirst ? true : map.isDefault
    }).returning();
    
    return createdMap;
  }

  async updateServiceMap(id: number, data: Partial<ServiceMap>): Promise<ServiceMap> {
    // If setting this map as default
    if (data.isDefault) {
      const [existingMap] = await db.select().from(serviceMaps).where(eq(serviceMaps.id, id));
      
      if (existingMap) {
        // Unset default on all other maps for this user
        await db
          .update(serviceMaps)
          .set({ isDefault: false })
          .where(and(
            eq(serviceMaps.userId, existingMap.userId),
            eq(serviceMaps.isDefault, true)
          ));
      }
    }

    // Update the map
    const [updatedMap] = await db
      .update(serviceMaps)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(serviceMaps.id, id))
      .returning();
    
    return updatedMap;
  }

  async deleteServiceMap(id: number): Promise<void> {
    // Check if this is a default map
    const [map] = await db.select().from(serviceMaps).where(eq(serviceMaps.id, id));
    
    if (map?.isDefault) {
      // Find another map to set as default
      const maps = await db
        .select()
        .from(serviceMaps)
        .where(eq(serviceMaps.userId, map.userId));
      
      // Filter out the map being deleted in JavaScript
      const otherMaps = maps.filter(m => m.id !== id);
      const otherMap = otherMaps.length > 0 ? otherMaps[0] : null;
      
      if (otherMap) {
        // Set another map as default
        await db
          .update(serviceMaps)
          .set({ isDefault: true })
          .where(eq(serviceMaps.id, otherMap.id));
      }
    }

    // Delete associated items first
    await db.delete(serviceMapItems).where(eq(serviceMapItems.mapId, id));
    await db.delete(agentMapItems).where(eq(agentMapItems.mapId, id));
    
    // Delete the map
    await db.delete(serviceMaps).where(eq(serviceMaps.id, id));
  }

  async setDefaultServiceMap(id: number): Promise<ServiceMap> {
    // Get the map to set as default
    const [map] = await db.select().from(serviceMaps).where(eq(serviceMaps.id, id));
    if (!map) throw new Error(`Service map with id ${id} not found`);
    
    // Unset default on all other maps for this user
    await db
      .update(serviceMaps)
      .set({ isDefault: false })
      .where(and(
        eq(serviceMaps.userId, map.userId),
        eq(serviceMaps.isDefault, true)
      ));
    
    // Set this map as default
    const [updatedMap] = await db
      .update(serviceMaps)
      .set({ isDefault: true })
      .where(eq(serviceMaps.id, id))
      .returning();
    
    return updatedMap;
  }

  // Service Map Items methods
  async getServiceMapItems(mapId: number): Promise<ServiceMapItem[]> {
    return await db
      .select()
      .from(serviceMapItems)
      .where(eq(serviceMapItems.mapId, mapId));
  }

  async addServiceToMap(mapId: number, serviceId: number, position?: { x: number, y: number }): Promise<ServiceMapItem> {
    // Check if this service is already in the map
    const [existingItem] = await db
      .select()
      .from(serviceMapItems)
      .where(and(
        eq(serviceMapItems.mapId, mapId),
        eq(serviceMapItems.serviceId, serviceId)
      ));
    
    if (existingItem) {
      return existingItem;
    }
    
    // Add service to map
    const [createdItem] = await db
      .insert(serviceMapItems)
      .values({
        mapId,
        serviceId,
        positionX: position?.x || 0,
        positionY: position?.y || 0
      })
      .returning();
    
    return createdItem;
  }

  async removeServiceFromMap(mapId: number, serviceId: number): Promise<void> {
    await db
      .delete(serviceMapItems)
      .where(and(
        eq(serviceMapItems.mapId, mapId),
        eq(serviceMapItems.serviceId, serviceId)
      ));
  }

  async updateServiceMapItemPosition(id: number, position: { x: number, y: number }): Promise<ServiceMapItem> {
    const [updatedItem] = await db
      .update(serviceMapItems)
      .set({
        positionX: position.x,
        positionY: position.y
      })
      .where(eq(serviceMapItems.id, id))
      .returning();
    
    return updatedItem;
  }

  // Agent Map Items methods
  async getAgentMapItems(mapId: number): Promise<AgentMapItem[]> {
    return await db
      .select()
      .from(agentMapItems)
      .where(eq(agentMapItems.mapId, mapId));
  }

  async addAgentToMap(mapId: number, agentId: number, position?: { x: number, y: number }): Promise<AgentMapItem> {
    // Check if this agent is already in the map
    const [existingItem] = await db
      .select()
      .from(agentMapItems)
      .where(and(
        eq(agentMapItems.mapId, mapId),
        eq(agentMapItems.agentId, agentId)
      ));
    
    if (existingItem) {
      return existingItem;
    }
    
    // Add agent to map
    const [createdItem] = await db
      .insert(agentMapItems)
      .values({
        mapId,
        agentId,
        positionX: position?.x || 0,
        positionY: position?.y || 0
      })
      .returning();
    
    return createdItem;
  }

  async removeAgentFromMap(mapId: number, agentId: number): Promise<void> {
    await db
      .delete(agentMapItems)
      .where(and(
        eq(agentMapItems.mapId, mapId),
        eq(agentMapItems.agentId, agentId)
      ));
  }
}