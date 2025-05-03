import TelegramBot from 'node-telegram-bot-api';
import type { IStorage } from './storage-types';
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

// Singleton pattern: global module level variables
let globalBotInstance: any | null = null;
let globalServiceInstance: TelegramService | null = null;

class TelegramService {
  private bot: any | null = null;
  private storage!: IStorage;
  private chatIdsToNotify: Set<string> = new Set<string>();

  constructor(storage: IStorage) {
    // Singleton enforcement
    if (globalServiceInstance) {
      console.log('Reusing existing TelegramService instance');
      return globalServiceInstance;
    }
    
    this.storage = storage;
    
    // Önce token kontrolü yap
    if (!TELEGRAM_BOT_TOKEN) {
      console.warn('TELEGRAM_BOT_TOKEN not set, Telegram notifications are disabled');
      globalServiceInstance = this;
      return;
    }
    
    // Çalışan bir bot instance varsa kapatalım
    if (globalBotInstance) {
      try {
        console.log('Reusing existing bot instance, not creating a new one');
        this.bot = globalBotInstance;
        
        // Komutları tanımla
        this.setupCommands();
        
        console.log('Telegram bot reused successfully');
        return;
      } catch (err) {
        console.warn('Error reusing previous bot instance:', err);
        // Continue to create a new instance
      }
    }
    
    try {
      console.log('Creating new Telegram bot instance');
      // Yeni botu başlat - This time with polling disabled by default
      globalBotInstance = new TelegramBot(TELEGRAM_BOT_TOKEN, { 
        polling: false // Başlangıçta polling'i devre dışı bırak
      });
      
      // Servisi globalBotInstance'a bağla
      this.bot = globalBotInstance;
      console.log('Telegram bot singleton instance created');
      
      // Komutları tanımla
      this.setupCommands();
      
      // Start polling with our single instance
      // Using a try/catch to handle potential polling conflicts
      try {
        this.bot.startPolling({
          restart: false,
          interval: 3000, // Slightly longer interval
          limit: 100,
          timeout: 10
        });
        console.log('Telegram bot polling started successfully');
      } catch (error: any) {
        // If we get a conflict error, we can safely ignore it
        if (error && error.code === 'ETELEGRAM' && error.message.includes('terminated by other getUpdates request')) {
          console.log('Another bot instance is already polling, skipping polling start');
        } else {
          // Log other errors
          console.error('Failed to start polling:', error);
        }
      }
    } catch (error) {
      console.error('Failed to initialize Telegram bot:', error);
      this.bot = null;
      globalBotInstance = null;
    }
    
    // Servisi singleton olarak ayarla
    globalServiceInstance = this;
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
        
        const onlineCount = services.filter((s: any) => s.status === 'online').length;
        const offlineCount = services.filter((s: any) => s.status === 'offline').length;
        const unknownCount = services.filter((s: any) => s.status === 'unknown').length;
        
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
    if (!this.bot) {
      console.error("Bot instance is not initialized");
      return false;
    }
    
    try {
      console.log(`Attempting to send notification to user ${userId}`);
      
      // Kullanıcının Telegram Chat ID'sini bul
      const settings = await this.storage.getUserSettings(userId);
      console.log(`User settings:`, settings ? {
        userId: settings.userId,
        enableTelegramAlerts: settings.enableTelegramAlerts,
        telegramChatId: settings.telegramChatId
      } : "No settings found");
      
      if (settings && settings.telegramChatId) {
        // Bildirim özelliği kapalıysa otomatik olarak aç
        if (!settings.enableTelegramAlerts) {
          console.log(`Enabling Telegram alerts for user ${userId}`);
          await this.storage.updateUserSettings({
            userId,
            enableTelegramAlerts: true
          });
        }
        
        // Her ihtimale karşı chatId'yi chat idsToNotify listesine ekle
        this.chatIdsToNotify.add(settings.telegramChatId);
        
        // Mesajı gönder
        console.log(`Sending Telegram message to chat ID: ${settings.telegramChatId}`);
        console.log(`Message content: ${message}`);
        await this.bot.sendMessage(settings.telegramChatId, message);
        console.log(`Telegram notification successfully sent to user ${userId}`);
        return true;
      } else if (settings) {
        // Chat ID yoksa ama ayarlar varsa - bu durumda admin hesabına ata
        console.log(`User ${userId} has settings but no telegramChatId, updating settings with default chat ID`);
        
        // chatIdsToNotify setinden ilk chat ID'yi al ve kullan
        if (this.chatIdsToNotify.size > 0) {
          const chatId = Array.from(this.chatIdsToNotify)[0];
          
          // Ayarları güncelle
          await this.storage.updateUserSettings({
            userId,
            telegramChatId: chatId,
            enableTelegramAlerts: true
          });
          
          // Mesajı gönder
          console.log(`Sending Telegram message to fallback chat ID: ${chatId}`);
          await this.bot.sendMessage(chatId, message);
          console.log(`Telegram notification sent to fallback chat ID for user ${userId}`);
          return true;
        } else {
          console.error(`No chat IDs in the notification list for user ${userId}`);
        }
      } else {
        console.error(`No user settings found for user ${userId}`);
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
      console.log(`Looking for user settings with chatId: ${chatId}`);
      
      // İyileştirilmiş basit yaklaşım:
      // Bu demo sistemde her zaman ID=1 olan ana kullanıcı var.
      // Tüm Telegram bildirimlerini bu kullanıcıya yönlendirelim.
      
      const userId = 1; // Sistemdeki birincil kullanıcının ID'si her zaman 1'dir
      
      // Önce kullanıcı ayarlarını alalım
      const settings = await this.storage.getUserSettings(userId);
      
      try {
        // Kullanıcı ayarlarını chat ID ile güncelle
        await this.storage.updateUserSettings({
          userId: userId,
          telegramChatId: chatId,
          enableTelegramAlerts: true
        });
        
        console.log(`[FORCED_LINK] Chat ID ${chatId} is now linked to user ${userId} for notifications`);
        
        // Bildirim listesine ekle
        this.chatIdsToNotify.add(chatId);
        
        // Kullanıcı ID'sini döndür
        return userId;
      } catch (storageError) {
        console.error('Error updating user settings:', storageError);
      }
      
      return null;
    } catch (error) {
      console.error('Error in findOrCreateUserByChatId:', error);
      return null;
    }
  }
  
  // Durum emojileri için yardımcı fonksiyon
  private getStatusEmoji(status: string): string {
    return status === 'online' ? '✅' : 
           status === 'offline' ? '❌' : 
           status === 'degraded' ? '⚠️' : '❓';
  }
}

// Modül dışa aktarımı
export { TelegramService };