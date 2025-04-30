import { pgTable, text, serial, integer, boolean, timestamp, json, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  host: text("host").notNull(),
  port: integer("port").notNull(),
  checkInterval: integer("check_interval").notNull(),
  positionX: integer("position_x").notNull(),
  positionY: integer("position_y").notNull(),
  status: text("status").default("unknown"),
  responseTime: integer("response_time"),
  lastChecked: timestamp("last_checked"),
  agentId: integer("agent_id"),
  monitorType: text("monitor_type").default("direct"),
});

export const insertServiceSchema = createInsertSchema(services).omit({
  id: true,
});

export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof services.$inferSelect;

export const connections = pgTable("connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  sourceId: integer("source_id").notNull(),
  targetId: integer("target_id").notNull(),
  status: text("status").default("unknown"),
});

export const insertConnectionSchema = createInsertSchema(connections).omit({
  id: true,
});

export type InsertConnection = z.infer<typeof insertConnectionSchema>;
export type Connection = typeof connections.$inferSelect;

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  serviceId: integer("service_id").notNull(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  acknowledged: boolean("acknowledged").default(false),
});

export const insertAlertSchema = createInsertSchema(alerts).omit({
  id: true,
});

export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;

// Ajan yapısı 
export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  apiKey: text("api_key").notNull().unique(),
  description: text("description"),
  serverInfo: json("server_info").default({}),
  status: text("status").default("inactive"),
  lastSeen: timestamp("last_seen"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  apiKey: true,
  lastSeen: true,
  createdAt: true,
});

export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;

// Kullanıcı ayarları
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  theme: text("theme").default("light"),
  enableEmailAlerts: boolean("enable_email_alerts").default(false),
  emailAddress: text("email_address"),
  enableTelegramAlerts: boolean("enable_telegram_alerts").default(false),
  telegramChatId: text("telegram_chat_id"),
  alertFrequency: text("alert_frequency").default("immediate"), // immediate, hourly, daily
  customSettings: json("custom_settings").default({}),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;

// PatrolD Paylaşılabilir haritalar
export const sharedMaps = pgTable("shared_maps", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  isPublished: boolean("is_published").default(false),
  isPasswordProtected: boolean("is_password_protected").default(false),
  password: text("password"), // Şifrelenmiş parola (korumalıysa)
  shareKey: text("share_key").notNull().unique(), // URL için benzersiz anahtar
  viewCount: integer("view_count").default(0),
  mapData: jsonb("map_data").notNull(), // Servisler, bağlantılar ve pozisyonlar
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSharedMapSchema = createInsertSchema(sharedMaps).omit({
  id: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSharedMap = z.infer<typeof insertSharedMapSchema>;
export type SharedMap = typeof sharedMaps.$inferSelect;
