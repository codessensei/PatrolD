import { Express, Request, Response } from "express";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { IStorage } from "./storage-types";
import { Pool } from "@neondatabase/serverless";
import { checkDatabaseConnection } from "./db";
import TelegramBot from "node-telegram-bot-api";

const scryptAsync = promisify(scrypt);

// Config dosyasının yolu
const CONFIG_FILE_PATH = path.join(process.cwd(), "config.json");

// Veritabanı konfigürasyon şeması
const dbConfigSchema = z.object({
  host: z.string().min(1),
  port: z.string().min(1).or(z.number()),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string(),
  ssl: z.boolean().default(false)
});

// Telegram konfigürasyon şeması
const telegramConfigSchema = z.object({
  botToken: z.string().min(1)
});

// Admin kullanıcı şeması
const adminConfigSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  email: z.string().email().optional().or(z.literal("")),
  terms: z.boolean()
});

// Tam konfigürasyon şeması
const setupConfigSchema = z.object({
  database: dbConfigSchema,
  telegram: telegramConfigSchema,
  admin: adminConfigSchema
});

// Konfigürasyon tipi
type DbConfig = z.infer<typeof dbConfigSchema>;
type TelegramConfig = z.infer<typeof telegramConfigSchema>;
type AdminConfig = z.infer<typeof adminConfigSchema>;
type SetupConfig = z.infer<typeof setupConfigSchema>;

// Şifre hash fonksiyonu
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Config dosyasını oku
function readConfig(): null | any {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const configData = fs.readFileSync(CONFIG_FILE_PATH, "utf8");
      return JSON.parse(configData);
    }
  } catch (error) {
    console.error("Config dosyası okunamadı:", error);
  }
  return null;
}

// Config dosyasını yaz
function writeConfig(config: any): boolean {
  try {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("Config dosyası yazılamadı:", error);
    return false;
  }
}

// Veritabanı bağlantısını test et
async function testDbConnection(config: DbConfig) {
  try {
    const { host, port, database, username, password, ssl } = config;
    
    // Bağlantı URL'ini oluştur
    const portNumber = typeof port === "string" ? parseInt(port, 10) : port;
    const sslParam = ssl ? "?sslmode=require" : "";
    const connectionString = `postgresql://${username}:${password}@${host}:${portNumber}/${database}${sslParam}`;
    
    console.log(`Veritabanı bağlantısı test ediliyor: ${host}:${portNumber}/${database}`);
    
    // Neon veritabanı bağlantısı mı kontrol et
    const isNeonDb = host.includes('neon.tech');
    
    // Test bağlantısı kur - SSL seçeneğini doğru şekilde yönet
    const poolOptions = { 
      connectionString, 
      ssl: ssl || isNeonDb ? { rejectUnauthorized: false } : undefined 
    };
    
    // Pool nesnesini oluştur
    const pool = new Pool(poolOptions);
    
    // Bağlantıyı test et
    const client = await pool.connect();
    
    // Versiyon kontrolü
    const versionResult = await client.query('SELECT version()');
    const version = versionResult.rows[0].version;
    
    // Tabloları listele
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    
    const tables = tablesResult.rows.map(row => row.table_name);
    
    // Bağlantıyı kapat
    client.release();
    await pool.end();
    
    return {
      success: true,
      version,
      tables,
      message: "Veritabanı bağlantısı başarılı"
    };
  } catch (error) {
    console.error("Veritabanı bağlantı hatası:", error);
    // Get detailed error message
    let errorMessage = "Bilinmeyen hata";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      errorMessage = JSON.stringify(error);
    } else {
      errorMessage = String(error);
    }
    
    return {
      success: false,
      message: `Veritabanı bağlantı hatası: ${errorMessage}`,
      error: errorMessage
    };
  }
}

// Telegram Bot Token doğrula
async function testTelegramToken(token: string) {
  try {
    console.log("Telegram bot token doğrulanıyor...");
    
    // Bot nesnesini oluştur - polling olmadan
    const bot = new TelegramBot(token, { polling: false });
    
    // getMe metodu ile token kontrolü
    const botInfo = await bot.getMe();
    
    console.log(`Telegram bot bilgisi alındı: ${botInfo.first_name} (@${botInfo.username})`);
    
    return {
      success: true,
      botName: botInfo.first_name,
      botUsername: botInfo.username,
      message: "Telegram bot token geçerli"
    };
  } catch (error) {
    console.error("Telegram token hatası:", error);
    // Get detailed error message
    let errorMessage = "Bilinmeyen hata";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      errorMessage = JSON.stringify(error);
    } else {
      errorMessage = String(error);
    }
    
    return {
      success: false,
      message: `Telegram token hatası: ${errorMessage}`,
      error: errorMessage
    };
  }
}

// .env dosyası oluştur
function createEnvFile(config: SetupConfig): boolean {
  try {
    const { database, telegram } = config;
    const { host, port, database: dbName, username, password, ssl } = database;
    
    // DATABASE_URL oluştur
    const sslParam = ssl ? "?sslmode=require" : "";
    const DATABASE_URL = `postgresql://${username}:${password}@${host}:${port}/${dbName}${sslParam}`;
    
    // Rastgele bir SESSION_SECRET oluştur
    const SESSION_SECRET = createHash('sha256')
      .update(Math.random().toString(36) + Date.now().toString(36))
      .digest('hex');
    
    // .env içeriği
    const envContent = `
DATABASE_URL=${DATABASE_URL}
PGHOST=${host}
PGPORT=${port}
PGDATABASE=${dbName}
PGUSER=${username}
PGPASSWORD=${password}
TELEGRAM_BOT_TOKEN=${telegram.botToken}
SESSION_SECRET=${SESSION_SECRET}
PORT=5000
NODE_ENV=production
    `.trim();
    
    fs.writeFileSync('.env', envContent);
    return true;
  } catch (error) {
    console.error(".env dosyası oluşturma hatası:", error);
    return false;
  }
}

// Setup API rotalarını kaydet
export function setupSetupRoutes(app: Express, storage: IStorage) {
  // Kurulum durumunu kontrol et
  app.get("/api/setup/status", (req: Request, res: Response) => {
    const config = readConfig();
    
    // Config dosyası varsa kurulum tamamlanmış demektir
    const isConfigured = config !== null;
    
    res.status(200).json({
      configured: isConfigured
    });
  });
  
  // Veritabanı bağlantısını test et
  app.post("/api/setup/test-db", async (req: Request, res: Response) => {
    try {
      const dbConfig = dbConfigSchema.parse(req.body);
      const result = await testDbConnection(dbConfig);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          message: "Geçersiz veritabanı bilgileri", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: `Veritabanı bağlantı hatası: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });
  
  // Telegram token doğrula
  app.post("/api/setup/test-telegram", async (req: Request, res: Response) => {
    try {
      const { botToken } = telegramConfigSchema.parse(req.body);
      const result = await testTelegramToken(botToken);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          message: "Geçersiz Telegram bot token", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: `Telegram token hatası: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });
  
  // Kurulumu tamamla
  app.post("/api/setup/complete", async (req: Request, res: Response) => {
    try {
      // Tüm yapılandırma verilerini doğrula
      const setupConfig = setupConfigSchema.parse(req.body);
      
      // Şifreyi hashle
      const admin = { 
        ...setupConfig.admin,
        password: await hashPassword(setupConfig.admin.password)
      };
      
      // Config dosyasını oluştur
      const config = {
        ...setupConfig,
        admin,
        configured: true,
        setupDate: new Date().toISOString()
      };
      
      // Config kaydet
      const configSaved = writeConfig(config);
      
      // .env dosyasını oluştur
      const envCreated = createEnvFile(setupConfig);
      
      // Admin kullanıcısını veritabanına kaydet (eğer mümkünse)
      let userCreated = false;
      try {
        // Veritabanı bağlantısını test et
        const dbTest = await testDbConnection(setupConfig.database);
        
        if (dbTest.success) {
          // Kullanıcıyı oluştur veya güncelle
          try {
            const existingUser = await storage.getUserByUsername(setupConfig.admin.username);
            
            if (existingUser) {
              // Kullanıcı zaten var, güncelle
              await storage.updateUser(existingUser.id, {
                password: admin.password,
                email: admin.email || null
              });
            } else {
              // Yeni kullanıcı oluştur
              await storage.createUser({
                username: admin.username,
                password: admin.password,
                email: admin.email || undefined
              });
            }
            
            userCreated = true;
          } catch (error) {
            console.error("Admin kullanıcısı oluşturma hatası:", error);
          }
        }
      } catch (error) {
        console.error("Kurulum sırasında veritabanı hatası:", error);
      }
      
      res.status(200).json({
        success: configSaved && envCreated,
        configSaved,
        envCreated,
        userCreated,
        message: configSaved && envCreated 
          ? "Kurulum başarıyla tamamlandı" 
          : "Kurulum kısmen tamamlandı, bazı dosyalar oluşturulamadı"
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          message: "Geçersiz kurulum bilgileri", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: `Kurulum hatası: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });
}