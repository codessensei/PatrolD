FROM node:20-alpine as builder

# Çalışma dizini oluştur
WORKDIR /app

# Bağımlılık dosyalarını kopyala
COPY package*.json ./

# Bağımlılıkları yükle
RUN npm ci

# Kaynak dosyaları kopyala
COPY . .

# İstemci uygulamasını derle
RUN npm run build

# Çalıştırma ortamı için yeni bir aşama
FROM node:20-alpine

# Çalışma dizini oluştur
WORKDIR /app

# Bağımlılık dosyalarını kopyala
COPY package*.json ./

# Sadece üretim bağımlılıklarını yükle
RUN npm ci --only=production

# Builder aşamasından derlenmiş dosyaları kopyala
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/server ./server

# Uygulama için gerekli diğer dosyaları kopyala
COPY --from=builder /app/drizzle.config.ts ./

# Çalışma portu
EXPOSE 5000

# Veritabanı ortam değişkenleri
ENV DATABASE_URL=postgres://postgres:postgres@postgres:5432/patrold
ENV PGHOST=postgres
ENV PGUSER=postgres
ENV PGPASSWORD=postgres
ENV PGDATABASE=patrold
ENV PGPORT=5432

# Telegram bot token (varsayılan boş, dağıtımda ayarlanmalı)
ENV TELEGRAM_BOT_TOKEN=""

# Çalıştırma komutu
CMD ["npm", "start"]