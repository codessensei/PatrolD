import { 
  User, InsertUser, users,
  Service, InsertService, services,
  Connection, InsertConnection, connections,
  Alert, InsertAlert, alerts,
  Agent, InsertAgent, agents,
  UserSettings, InsertUserSettings, userSettings,
  SharedMap, InsertSharedMap, sharedMaps
} from "@shared/schema";
import { IStorage } from "./storage";
import { db, pool } from "./db";
import { eq, desc, and, lte, gte } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import session from "express-session";

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
    const [createdAgent] = await db.insert(agents).values(agent).returning();
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
    const [map] = await db
      .update(sharedMaps)
      .set({
        viewCount: (currentMap: any) => `${currentMap.view_count} + 1`
      })
      .where(eq(sharedMaps.id, id))
      .returning();
    return map;
  }
}