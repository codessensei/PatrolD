import { 
  User, InsertUser, 
  Service, InsertService, 
  Connection, InsertConnection,
  Alert, InsertAlert,
  Agent, InsertAgent,
  UserSettings, InsertUserSettings,
  SharedMap, InsertSharedMap,
  ServiceMap, InsertServiceMap,
  ServiceMapItem, AgentMapItem
} from "@shared/schema";
import session from "express-session";

// Define our session store type to avoid SessionStore errors
export type SessionStore = session.Store;

// Storage interface for all our data
export interface IStorage {
  // User
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<User>): Promise<User | undefined>;

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