# PatrolD - Uptime Monitoring Platform

PatrolD, ağ servislerini, sunucuları ve web sitelerini izlemek için geliştirilmiş, modern ve güçlü bir uptime monitoring platformudur. Servis sağlığını takip eder, sorunları proaktif olarak tespit eder ve çeşitli bildirim kanalları üzerinden alarm gönderir.

## Özellikler

- Gerçek zamanlı servis durumu takibi
- Dağıtılmış yapıda agent-temelli monitoring
- Servisler arasındaki bağlantıları görselleştirme
- Akıllı alarm yönetimi ve otomatik bildirimler
- Telegram bot entegrasyonu
- Özelleştirilebilir servis haritaları
- Paylaşılabilir ve şifre korumalı servis haritaları
- Kullanıcı dostu yönetim arayüzü
- PostgreSQL veritabanı desteği
- Docker ve Debian paket desteği

## Sistem Gereksinimleri

- Node.js 20.x veya üstü
- PostgreSQL 14.x veya üstü
- 1GB RAM (minimum)
- 2GB disk alanı

## Kurulum Rehberi

### 1. Sistem Gereksinimlerinin Kurulumu

```bash
# Sistem güncellemesi
sudo apt update
sudo apt upgrade -y

# Gerekli sistem bileşenlerinin kurulumu
sudo apt install -y curl wget git build-essential ufw nginx certbot python3-certbot-nginx

# Node.js 20.x kurulumu
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Yarn kurulumu
npm install -g yarn

# PM2 global kurulumu (Process yönetimi için)
npm install -g pm2
```

### 2. PostgreSQL Kurulumu ve Konfigürasyonu

```bash
# PatrolD için .env dosyasındaki veritabanı bilgilerini doldurabilmek için
# halihazırda bir PostgreSQL veritabanı kurulu olmalıdır
# Veritabanı mevcut değilse kurulum talimatları için 
# PostgreSQL resmi dokümantasyonuna bakabilirsiniz: https://www.postgresql.org/download/
```

### 3. PatrolD Uygulamasını İndirme ve Kurma

```bash
# Uygulamayı indirmek için uygun bir dizin oluşturun
mkdir -p /var/www
cd /var/www

# GitHub'dan uygulamayı klonlayın (kendi GitHub reponuzla değiştirin)
sudo git clone https://github.com/kullanıcıadı/patrold.git

# Dizin izinlerini ayarlayın
sudo chown -R $USER:$USER /var/www/patrold

# Uygulama dizinine girin
cd /var/www/patrold

# Bağımlılıkları yükleyin
npm ci

# Uygulama yapılandırması
cp .env.example .env
```

### 4. Çevre Değişkenlerini Yapılandırma

`.env` dosyasını düzenleyerek PostgreSQL ve diğer yapılandırmaları ekleyin:

```bash
# .env dosyasını düzenleyin
sudo nano .env
```

`.env` dosyasına aşağıdaki değişkenleri ekleyin:

```
DATABASE_URL=postgres://patrold:güçlü_şifre_belirleyin@localhost:5432/patrold
PGHOST=localhost
PGUSER=patrold
PGPASSWORD=güçlü_şifre_belirleyin
PGDATABASE=patrold
PGPORT=5432
TELEGRAM_BOT_TOKEN=bot_token_buraya
SESSION_SECRET=rastgele_güvenli_bir_dize
PORT=5000
```

### 5. Veritabanı Şemasını Oluşturma

```bash
# Veritabanı tablolarını oluşturun
npm run db:push
```

### 6. Uygulamayı Derleyin

```bash
# Production build oluşturun
npm run build
```

### 7. PM2 ile Uygulamayı Çalıştırma

PM2, Node.js uygulamalarını yönetmek için güçlü bir araçtır:

```bash
# PM2 yapılandırma dosyası oluşturun
cat > ecosystem.config.js << 'EOL'
module.exports = {
  apps: [{
    name: "patrold",
    script: "npm",
    args: "start",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "500M",
    env: {
      NODE_ENV: "production",
      PORT: 5000,
      DATABASE_URL: "postgres://patrold:güçlü_şifre_belirleyin@localhost:5432/patrold",
      PGUSER: "patrold",
      PGPASSWORD: "güçlü_şifre_belirleyin",
      PGHOST: "localhost",
      PGPORT: "5432",
      PGDATABASE: "patrold",
      TELEGRAM_BOT_TOKEN: "bot_token_buraya",
      SESSION_SECRET: "rastgele_güvenli_bir_dize"
    }
  }]
};
EOL

# PM2 ile uygulamayı başlatın
pm2 start ecosystem.config.js

# PM2'nin sistem başlangıcında otomatik başlamasını sağlayın
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER
pm2 save
```

### 8. Nginx Web Sunucusu Yapılandırması

Nginx'i PatrolD uygulamasınızı sunacak şekilde yapılandırın:

```bash
# Nginx yapılandırma dosyası oluşturun
sudo nano /etc/nginx/sites-available/patrold
```

Nginx yapılandırma dosyasına şu içeriği ekleyin:

```nginx
server {
    listen 80;
    server_name beta.patrold.com; # Default URL beta.patrold.com
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Nginx yapılandırmasını etkinleştirin:

```bash
# Sembolik bağlantı oluşturun
sudo ln -s /etc/nginx/sites-available/patrold /etc/nginx/sites-enabled/

# Nginx yapılandırmasını test edin
sudo nginx -t

# Nginx'i yeniden başlatın
sudo systemctl restart nginx
```

### 9. SSL Sertifikası Kurulumu (Let's Encrypt)

HTTPS için SSL sertifikası kurun:

```bash
# Let's Encrypt sertifikası alın
sudo certbot --nginx -d beta.patrold.com

# Certbot otomatik yenilemeyi etkinleştirin
sudo certbot renew --dry-run
```

### 10. Güvenlik Duvarını Yapılandırma

Güvenlik duvarını gerekli portlar için yapılandırın:

```bash
# UFW'yi etkinleştirin
sudo ufw enable

# HTTP, HTTPS ve SSH portlarını açın
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 80/tcp  # HTTP
sudo ufw allow 443/tcp # HTTPS

# Güvenlik duvarı durumunu kontrol edin
sudo ufw status
```

## Agent Kurulumu (Uzak Sunucularda)

İzlenecek uzak sunuculara agent'ları kurmak için:

1. Admin arayüzünden yeni agent oluşturun ve API anahtarını alın
2. Uzak sunucuda aşağıdaki komutu çalıştırın:

```bash
# Debian package kullanarak agent kurulumu
wget https://beta.patrold.com/patrold_1.0.0_all.deb
sudo dpkg -i patrold_1.0.0_all.deb

# Agent yapılandırması
sudo nano /etc/patrold/agent.conf
```

Agent yapılandırma dosyasına API anahtarını ekleyin:

```conf
API_KEY=agent_xxxxxxxxxx
SERVER_URL=https://beta.patrold.com
```

Agent'ı başlatın ve otomatik başlamasını sağlayın:

```bash
sudo systemctl start patrold-agent
sudo systemctl enable patrold-agent
```

## Docker ile Kurulum

Docker kullanarak hızlı kurulum için:

```bash
# Docker ve Docker Compose kurulumu
sudo apt update
sudo apt install -y docker.io docker-compose

# Docker servisini başlatın
sudo systemctl start docker
sudo systemctl enable docker

# PatrolD repo'sunu indirin
git clone https://github.com/kullanıcıadı/patrold.git
cd patrold

# .env dosyasını oluşturun
cp .env.example .env
# .env dosyasını düzenleyin

# Docker ile çalıştırın
docker-compose up -d
```

## GitHub Actions ile Otomatik Deployment

GitHub Actions kullanarak otomatik deployment için:

1. GitHub reponuzda **Settings > Secrets > Actions** bölümüne gidin
2. Aşağıdaki secret'ları ekleyin:
   - `SSH_HOST`: Sunucu IP adresi
   - `SSH_USERNAME`: SSH kullanıcı adı
   - `SSH_PRIVATE_KEY`: SSH özel anahtarı
   - `SSH_PORT`: SSH port numarası (genellikle 22)
   - `DATABASE_URL`: PostgreSQL bağlantı URL'si
   - `PGUSER`: PostgreSQL kullanıcı adı
   - `PGPASSWORD`: PostgreSQL şifresi
   - `PGHOST`: PostgreSQL sunucu adı/IP
   - `PGPORT`: PostgreSQL port numarası
   - `PGDATABASE`: PostgreSQL veritabanı adı
   - `TELEGRAM_TOKEN`: Telegram bot token'ı
   - `TELEGRAM_TO`: Bildirim gönderilecek Telegram Chat ID'si

## Sorun Giderme

### Veritabanı Bağlantı Hataları

```bash
# PostgreSQL durumunu kontrol edin
sudo systemctl status postgresql

# PostgreSQL loglarını kontrol edin
sudo tail -f /var/log/postgresql/postgresql-*.log
```

### Nginx Bağlantı Sorunları

```bash
# Nginx durumunu kontrol edin
sudo systemctl status nginx

# Nginx loglarını kontrol edin
sudo tail -f /var/log/nginx/error.log
```

### Uygulama Hataları

```bash
# PM2 loglarını kontrol edin
pm2 logs patrold

# Uygulama durumunu kontrol edin
pm2 monit
```

## Katkıda Bulunma

Projemize katkıda bulunmak istiyorsanız lütfen aşağıdaki adımları izleyin:

1. Bu repository'yi fork edin
2. Yeni bir branch oluşturun (`git checkout -b yeni-ozellik`)
3. Değişikliklerinizi commit edin (`git commit -am 'Yeni özellik: Açıklama'`)
4. Branch'inizi push edin (`git push origin yeni-ozellik`)
5. Bir Pull Request oluşturun

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır - ayrıntılar için [LICENSE](LICENSE) dosyasına bakın.

## İletişim

Sorularınız veya geri bildirimleriniz için [GitHub Issues](https://github.com/kullanıcıadı/patrold/issues) kullanabilirsiniz.