import { 
  User, InsertUser, 
  Service, InsertService, 
  Connection, InsertConnection,
  Alert, InsertAlert
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

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

  // Session store
  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private services: Map<number, Service>;
  private connections: Map<number, Connection>;
  private alerts: Map<number, Alert>;
  
  sessionStore: session.SessionStore;
  private userId: number = 1;
  private serviceId: number = 1;
  private connectionId: number = 1;
  private alertId: number = 1;

  constructor() {
    this.users = new Map();
    this.services = new Map();
    this.connections = new Map();
    this.alerts = new Map();
    this.sessionStore = new MemoryStore({
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
      lastChecked: new Date()
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
    const connection: Connection = { ...insertConnection, id };
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
    const alert: Alert = { ...insertAlert, id };
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
}

export const storage = new MemStorage();
