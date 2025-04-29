import TelegramBot from 'node-telegram-bot-api';
import { IStorage } from './storage';

// Type tanımlamaları
type TelegramMessage = {
  chat: {
    id: number;
  };
  text?: string;
};

// Telegram Bot'u için gerekli olan token
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export class TelegramService {
  private bot: any | null = null;
  private storage: IStorage;
  private chatIdsToNotify: Set<string> = new Set();

  constructor(storage: IStorage) {
    this.storage = storage;
    if (!TELEGRAM_BOT_TOKEN) {
      console.warn('TELEGRAM_BOT_TOKEN not set, Telegram notifications are disabled');
      return;
    }

    try {
      this.bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
      console.log('Telegram bot initialized successfully');
      
      // Bot komutlarını tanımlama
      this.setupCommands();
    } catch (error) {
      console.error('Failed to initialize Telegram bot:', error);
      this.bot = null;
    }
  }

  private setupCommands() {
    if (!this.bot) return;

    // /start komutu ile kullanıcıya hoş geldin mesajı
    this.bot.onText(/\/start/, (msg: TelegramMessage) => {
      const chatId = msg.chat.id;
      const message = `Merhaba! 👋 Servis Monitoring sistemine hoş geldiniz.\n\n`
        + `Komutlar:\n`
        + `/subscribe - Bildirimlere abone ol\n`
        + `/unsubscribe - Bildirim aboneliğini iptal et\n`
        + `/status - Sistemdeki servislerin durumunu göster\n`;
      
      this.bot.sendMessage(chatId, message);
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
      // Tüm kullanıcıları getir ve ayarlarına göre filtreleme yap
      const allUsers = Array.from(this.storage.users.values());
      
      for (const user of allUsers) {
        const settings = await this.storage.getUserSettings(user.id);
        if (settings && settings.telegramChatId === chatId) {
          return user.id;
        }
      }
      
      // Eşleşen hesap bulunamadı
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