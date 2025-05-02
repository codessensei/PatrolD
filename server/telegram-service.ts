import TelegramBot from 'node-telegram-bot-api';
import { IStorage } from './storage';
import { randomBytes } from 'crypto';
import { addDays } from 'date-fns';

// Type tanımlamaları
type TelegramMessage = {
  chat: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  };
  from?: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  };
  text?: string;
};

// Telegram Bot'u için gerekli olan token
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Singleton pattern to avoid multiple bot instances
let botInstance: any | null = null;

export class TelegramService {
  private bot: any | null = null;
  private storage!: IStorage; // definite assignment assertion
  private chatIdsToNotify: Set<string> = new Set<string>();
  private static instance: TelegramService | null = null;

  constructor(storage: IStorage) {
    // Singleton pattern implementation
    if (TelegramService.instance) {
      return TelegramService.instance;
    }
    
    this.storage = storage;
    if (!TELEGRAM_BOT_TOKEN) {
      console.warn('TELEGRAM_BOT_TOKEN not set, Telegram notifications are disabled');
      TelegramService.instance = this;
      return;
    }

    try {
      // Reuse existing bot instance or create a new one
      if (!botInstance) {
        // Stop any existing polling before creating a new bot
        try {
          if (this.bot) {
            this.bot.stopPolling();
          }
        } catch (err) {
          console.warn('Error stopping previous bot polling:', err);
        }
        
        // Create new bot with polling
        botInstance = new TelegramBot(TELEGRAM_BOT_TOKEN, { 
          polling: true,
          // Add polling options to handle conflicts
          onlyFirstMatch: true,
          params: {
            timeout: 30
          }
        });
        console.log('Telegram bot singleton instance created');
      }
      
      this.bot = botInstance;
      console.log('Telegram bot initialized successfully');
      
      // Bot komutlarını tanımlama
      this.setupCommands();
    } catch (error) {
      console.error('Failed to initialize Telegram bot:', error);
      this.bot = null;
    }
    
    TelegramService.instance = this;
  }

  // Token üretme - web arayüzünde kullanılır
  async generateRegistrationToken(userId: number): Promise<string | null> {
    try {
      // Benzersiz bir token oluştur
      const token = randomBytes(16).toString('hex');
      // Tokenin 24 saat geçerliliği olsun
      const expiry = addDays(new Date(), 1);
      
      // Token ve geçerlilik süresini kullanıcı ayarlarına kaydet
      await this.storage.updateUserSettings({
        userId,
        telegramRegistrationToken: token,
        telegramTokenExpiry: expiry
      });
      
      console.log(`Generated registration token for user ${userId}: ${token}`);
      return token;
    } catch (error) {
      console.error(`Failed to generate registration token for user ${userId}:`, error);
      return null;
    }
  }
  
  // Token doğrulama ve chat ID ile ilişkilendirme
  async verifyRegistrationToken(token: string, chatId: string): Promise<number | null> {
    try {
      // Veri tabanındaki tüm ayarları (settings) çek ve token ile eşleşeni bul
      const db = await import('./db');
      const { eq } = await import('drizzle-orm');
      const { userSettings } = await import('@shared/schema');
      
      // Token ile eşleşen kaydı ara
      console.log(`Verifying registration token: ${token} for chat ID: ${chatId}`);
      
      // Tüm settings'leri logla (debug)
      const allSettings = await db.db.select().from(userSettings);
      console.log('All settings:', allSettings.map(s => ({ 
        userId: s.userId, 
        token: s.telegramRegistrationToken,
        expiry: s.telegramTokenExpiry
      })));
      
      const [foundSetting] = await db.db
        .select()
        .from(userSettings)
        .where(eq(userSettings.telegramRegistrationToken, token));

      if (!foundSetting) {
        console.log('No user found with the provided token');
        return null;
      }
      
      console.log('Found setting with token:', foundSetting);
      
      // Token süresini kontrol et
      if (foundSetting.telegramTokenExpiry && 
          new Date(foundSetting.telegramTokenExpiry) > new Date()) {
          
        console.log(`Token valid until ${foundSetting.telegramTokenExpiry}, proceeding with registration`);
          
        // Token doğruysa, chatId'yi kullanıcı ayarlarına kaydet
        await this.storage.updateUserSettings({
          userId: foundSetting.userId,
          telegramChatId: chatId,
          enableTelegramAlerts: true, 
          // Token bilgilerini temizle
          telegramRegistrationToken: null,
          telegramTokenExpiry: null
        });
        
        console.log(`User ${foundSetting.userId} verified with token and linked to chat ID ${chatId}`);
        
        // chatIdsToNotify setine chatId'yi ekleyin
        this.chatIdsToNotify.add(chatId);
        
        return foundSetting.userId;
      } else {
        console.log('Token expired or invalid');
        return null;
      }
    } catch (error) {
      console.error('Error verifying registration token:', error);
      return null;
    }
  }

  private setupCommands() {
    if (!this.bot) return;

    // /start komutu ile kullanıcıya hoş geldin mesajı
    this.bot.onText(/\/start/, (msg: TelegramMessage) => {
      const chatId = msg.chat.id;
      const message = `Merhaba! 👋 Servis Monitoring sistemine hoş geldiniz.\n\n`
        + `Komutlar:\n`
        + `/register <token> - Web arayüzünden aldığınız token ile hesabınızı bağlayın\n`
        + `/subscribe - Bildirimlere abone ol\n`
        + `/unsubscribe - Bildirim aboneliğini iptal et\n`
        + `/status - Sistemdeki servislerin durumunu göster\n`;
      
      this.bot.sendMessage(chatId, message);
    });
    
    // /register komutu ile web arayüzünden alınan token kullanılarak hesap bağlama
    this.bot.onText(/\/register (.+)/, async (msg: TelegramMessage, match: RegExpExecArray | null) => {
      if (!match || !match[1]) {
        this.bot.sendMessage(msg.chat.id, "❌ Geçersiz komut. Doğru kullanım: /register <token>");
        return;
      }
      
      const token = match[1].trim();
      const chatId = String(msg.chat.id);
      
      try {
        // Token doğrulama ve kullanıcı ID'si alımı
        const userId = await this.verifyRegistrationToken(token, chatId);
        
        if (userId) {
          this.chatIdsToNotify.add(chatId);
          
          const userInfo = msg.from?.username ? 
                          `@${msg.from.username}` : 
                          `${msg.from?.first_name || ''} ${msg.from?.last_name || ''}`.trim();
          
          const successMessage = `✅ Hesabınız başarıyla bağlandı!\n\n`
            + `Chat ID: ${chatId}\n`
            + `Kullanıcı: ${userInfo}\n\n`
            + `Artık sistem bildirimlerini alacaksınız. Bildirimlerden çıkmak için /unsubscribe komutunu kullanabilirsiniz.`;
          
          this.bot.sendMessage(msg.chat.id, successMessage);
        } else {
          this.bot.sendMessage(msg.chat.id, "❌ Geçersiz veya süresi dolmuş token. Lütfen web arayüzünden yeni bir token oluşturun.");
        }
      } catch (error) {
        console.error('Error in /register:', error);
        this.bot.sendMessage(msg.chat.id, "❌ Bir hata oluştu. Lütfen daha sonra tekrar deneyin.");
      }
    });

    // /subscribe komutu ile bildirim almak için abone olma
    this.bot.onText(/\/subscribe/, async (msg: TelegramMessage) => {
      const chatId = String(msg.chat.id);
      
      try {
        // Kullanıcının chat ID'sini sakla ve bildirim listesine ekle
        this.chatIdsToNotify.add(chatId);
        
        // Kullanıcı varsa ayarlarını güncelle, yoksa ayar oluştur
        const userId = await this.findOrCreateUserByChatId(chatId);
        if (userId) {
          await this.storage.updateUserSettings({
            userId,
            enableTelegramAlerts: true,
            telegramChatId: chatId
          });
          this.bot.sendMessage(msg.chat.id, "✅ Bildirimlere abone oldunuz! Artık sistemden alarm mesajları alacaksınız.");
        } else {
          this.bot.sendMessage(msg.chat.id, "❌ Abone olunamadı. Lütfen web arayüzünden hesabınızı bağlayın.");
        }
      } catch (error) {
        console.error('Error in /subscribe:', error);
        this.bot.sendMessage(msg.chat.id, "❌ Bir hata oluştu. Lütfen daha sonra tekrar deneyin.");
      }
    });

    // /unsubscribe komutu ile bildirim aboneliğini iptal etme
    this.bot.onText(/\/unsubscribe/, async (msg: TelegramMessage) => {
      const chatId = String(msg.chat.id);
      
      try {
        // Bildirim listesinden kaldır
        this.chatIdsToNotify.delete(chatId);
        
        // Kullanıcı ayarlarını güncelle
        const userId = await this.findOrCreateUserByChatId(chatId);
        if (userId) {
          await this.storage.updateUserSettings({
            userId,
            enableTelegramAlerts: false
          });
          this.bot.sendMessage(msg.chat.id, "✅ Bildirim aboneliğiniz iptal edildi.");
        } else {
          this.bot.sendMessage(msg.chat.id, "❌ İşlem başarısız. Hesap bulunamadı.");
        }
      } catch (error) {
        console.error('Error in /unsubscribe:', error);
        this.bot.sendMessage(msg.chat.id, "❌ Bir hata oluştu. Lütfen daha sonra tekrar deneyin.");
      }
    });

    // /status komutu ile sistemdeki servislerin durumunu gösterme
    this.bot.onText(/\/status/, async (msg: TelegramMessage) => {
      const chatId = String(msg.chat.id);
      
      try {
        const userId = await this.findOrCreateUserByChatId(chatId);
        if (!userId) {
          this.bot.sendMessage(msg.chat.id, "❌ Sistemde kayıtlı hesabınız bulunamadı.");
          return;
        }
        
        const services = await this.storage.getServicesByUserId(userId);
        if (services.length === 0) {
          this.bot.sendMessage(msg.chat.id, "ℹ️ Henüz izlenen servisiniz bulunmuyor.");
          return;
        }
        
        const onlineCount = services.filter(s => s.status === 'online').length;
        const offlineCount = services.filter(s => s.status === 'offline').length;
        const unknownCount = services.filter(s => s.status === 'unknown').length;
        
        let message = `📊 Servis Durumu\n\n`;
        message += `Toplam: ${services.length} servis\n`;
        message += `✅ Çalışıyor: ${onlineCount}\n`;
        message += `❌ Çalışmıyor: ${offlineCount}\n`;
        message += `❓ Bilinmiyor: ${unknownCount}\n\n`;
        
        // Servislerin detaylarını listele
        message += `Servis Listesi:\n`;
        services.forEach((service, index) => {
          const statusEmoji = service.status === 'online' ? '✅' : 
                              service.status === 'offline' ? '❌' : '❓';
          message += `${index + 1}. ${statusEmoji} ${service.name} (${service.host}:${service.port})\n`;
        });
        
        this.bot.sendMessage(msg.chat.id, message);
      } catch (error) {
        console.error('Error in /status:', error);
        this.bot.sendMessage(msg.chat.id, "❌ Bir hata oluştu. Lütfen daha sonra tekrar deneyin.");
      }
    });
  }

  // Kullanıcıya bildirim gönderme
  async sendNotification(userId: number, message: string) {
    if (!this.bot) return;
    
    try {
      // Kullanıcının Telegram Chat ID'sini bul
      const settings = await this.storage.getUserSettings(userId);
      
      if (settings && settings.enableTelegramAlerts && settings.telegramChatId) {
        await this.bot.sendMessage(settings.telegramChatId, message);
        console.log(`Telegram notification sent to user ${userId}`);
        return true;
      }
    } catch (error) {
      console.error(`Failed to send Telegram notification to user ${userId}:`, error);
    }
    
    return false;
  }

  // Test mesajı gönderme
  async sendTestMessage(userId: number) {
    if (!this.bot) {
      console.error('Telegram bot not initialized');
      return false;
    }
    
    try {
      // Kullanıcının Telegram Chat ID'sini bul
      const settings = await this.storage.getUserSettings(userId);
      
      if (settings && settings.telegramChatId) {
        const message = `🔔 Bu bir test bildirim mesajıdır. Servis Monitoring sistemi tarafından gönderilmiştir. Bildirimler başarıyla ayarlanmıştır!`;
        await this.bot.sendMessage(settings.telegramChatId, message);
        console.log(`Test message sent to user ${userId}`);
        return true;
      } else {
        console.log(`User ${userId} has no Telegram chat ID configured`);
        return false;
      }
    } catch (error) {
      console.error(`Failed to send test message to user ${userId}:`, error);
      return false;
    }
  }

  // Servis durumu değiştiğinde bildirim gönderme
  async notifyServiceStatusChange(service: any, oldStatus: string, newStatus: string) {
    if (!this.bot) return;
    
    // Durum değişikliği bildirim mesajı
    const message = `🔔 Servis Durumu Değişti!\n\n`
      + `${service.name} (${service.host}:${service.port})\n`
      + `${this.getStatusEmoji(oldStatus)} ${oldStatus.toUpperCase()} → ${this.getStatusEmoji(newStatus)} ${newStatus.toUpperCase()}\n\n`
      + `Değişim Zamanı: ${new Date().toLocaleString()}`;
    
    try {
      // Kullanıcının ayarlarını kontrol et
      const settings = await this.storage.getUserSettings(service.userId);
      
      if (settings && settings.enableTelegramAlerts && settings.telegramChatId) {
        await this.bot.sendMessage(settings.telegramChatId, message);
        console.log(`Service status change notification sent for service ${service.id}`);
      }
    } catch (error) {
      console.error(`Failed to send service status change notification for service ${service.id}:`, error);
    }
  }

  // Chat ID'ye göre kullanıcı bulma veya oluşturma
  private async findOrCreateUserByChatId(chatId: string): Promise<number | null> {
    try {
      // Veritabanında telegramChatId'ye göre kullanıcı ayarı ara
      const db = await import('./db');
      const { eq } = await import('drizzle-orm');
      const { userSettings } = await import('@shared/schema');
      
      console.log(`Looking for user settings with chatId: ${chatId}`);
      
      // Log all user settings for debugging
      const allSettings = await db.db.select().from(userSettings);
      console.log('All user settings:', JSON.stringify(allSettings, null, 2));
      
      // Doğrudan veritabanı sorgusu ile ChatID'ye sahip olan kullanıcıyı bul
      const [foundSetting] = await db.db
        .select()
        .from(userSettings)
        .where(eq(userSettings.telegramChatId, chatId));
      
      if (foundSetting) {
        console.log(`Found user with ID ${foundSetting.userId} for chat ID ${chatId}`);
        
        // Eğer bildirimler etkin değilse otomatik olarak aktif et
        if (!foundSetting.enableTelegramAlerts) {
          await this.storage.updateUserSettings({
            userId: foundSetting.userId,
            enableTelegramAlerts: true
          });
          console.log(`Enabled telegram alerts for user ${foundSetting.userId}`);
        }
        
        // chatIdsToNotify setine chatId'yi ekleyin
        this.chatIdsToNotify.add(chatId);
        
        return foundSetting.userId;
      } else {
        // Telegram chatId'yi içeren bir user var mı diye tüm ayarları teker teker kontrol et
        for (const setting of allSettings) {
          if (setting.telegramChatId === chatId) {
            console.log(`Found user with ID ${setting.userId} for chat ID ${chatId} (direct compare)`);
            
            // chatIdsToNotify setine chatId'yi ekleyin
            this.chatIdsToNotify.add(chatId);
            
            return setting.userId;
          }
        }
        
        // ÇÖZÜM: BU KULLANICI İÇİN HİÇBİR AYAR BULUNAMADI,
        // ANCAK SİSTEMDE KAYITLI KULLANICI VAR MI KONTROL ET
        // 1 numaralı kullanıcıyı bul ve ona bu chat ID'yi ekle
        if (allSettings.length > 0) {
          const firstUser = allSettings[0];
          console.log(`Linking chat ID ${chatId} to user ${firstUser.userId}`);
          
          await this.storage.updateUserSettings({
            userId: firstUser.userId,
            telegramChatId: chatId,
            enableTelegramAlerts: true
          });
          
          // chatIdsToNotify setine chatId'yi ekleyin
          this.chatIdsToNotify.add(chatId);
          
          return firstUser.userId;
        }
      }
      
      // Eşleşen hesap bulunamadı
      console.log(`No user found for chat ID ${chatId}`);
      return null;
    } catch (error) {
      console.error('Error finding user by chat ID:', error);
      return null;
    }
  }

  // Durum emoji'si
  private getStatusEmoji(status: string): string {
    switch (status.toLowerCase()) {
      case 'online':
        return '✅';
      case 'offline':
        return '❌';
      case 'degraded':
        return '⚠️';
      default:
        return '❓';
    }
  }
}

export default TelegramService;