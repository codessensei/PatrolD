import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// DATABASE_URL'i kontrol et ve gerekirse oluştur
const constructDatabaseUrl = () => {
  // Eğer tam URL zaten varsa, onu kullan
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('://')) {
    return process.env.DATABASE_URL;
  }
  
  // Ayrı bileşenlerden URL oluştur
  const host = process.env.PGHOST || 'localhost';
  const port = process.env.PGPORT || '5432';
  const user = process.env.PGUSER || 'postgres';
  const password = process.env.PGPASSWORD || '';
  const database = process.env.PGDATABASE || 'postgres';
  
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
};

const databaseUrl = constructDatabaseUrl();
console.log("Oluşturulan veritabanı URL'i:", databaseUrl.replace(/\/\/.*:.*@/, '//[credentials_hidden]@'));

export const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle({ client: pool, schema });

// Bağlantı durumunu kontrol etme fonksiyonu
export async function checkDatabaseConnection() {
  try {
    console.log("Veritabanı bağlantısı test ediliyor...");
    console.log("Oluşturulan bağlantı URL:", databaseUrl.replace(/\/\/.*:.*@/, '//[credentials_hidden]@'));
    console.log("Orijinal DATABASE_URL:", process.env.DATABASE_URL);
    console.log("PGHOST:", process.env.PGHOST);
    console.log("PGPORT:", process.env.PGPORT);
    console.log("PGDATABASE:", process.env.PGDATABASE);
    console.log("PGUSER:", process.env.PGUSER?.replace(/./g, '*'));
    
    // Bağlantıyı test et
    const client = await pool.connect();
    
    // PostgreSQL versiyonunu kontrol et
    const versionResult = await client.query('SELECT version()');
    console.log("Veritabanı bağlantısı BAŞARILI");
    console.log("PostgreSQL Versiyonu:", versionResult.rows[0].version);
    
    // Mevcut tabloları listele
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    
    console.log(`Toplam ${tablesResult.rowCount} tablo bulundu:`);
    tablesResult.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.table_name}`);
    });
    
    // Her tablodaki kayıt sayısını getir
    console.log("\nTablolardaki kayıt sayıları:");
    for (const row of tablesResult.rows) {
      const tableName = row.table_name;
      const countResult = await client.query(`SELECT COUNT(*) FROM "${tableName}"`);
      console.log(`  ${tableName}: ${countResult.rows[0].count} kayıt`);
    }
    
    client.release();
    return {
      success: true,
      version: versionResult.rows[0].version,
      tables: tablesResult.rows.map(row => row.table_name),
      message: "Veritabanı bağlantısı başarılı"
    };
  } catch (error) {
    console.error("VERİTABANI BAĞLANTI HATASI:", error);
    return {
      success: false,
      message: `Veritabanı bağlantı hatası: ${error instanceof Error ? error.message : String(error)}`,
      error: error
    };
  }
}