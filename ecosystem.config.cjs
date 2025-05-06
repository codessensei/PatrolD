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
      // Burada kendi değerlerinizle değiştirin
      DATABASE_URL: "postgres://patrold:password@localhost:5432/patrold",
      PGUSER: "patrold",
      PGPASSWORD: "password",
      PGHOST: "localhost",
      PGPORT: "5432",
      PGDATABASE: "patrold",
      TELEGRAM_BOT_TOKEN: "your_token_here",
      SESSION_SECRET: "your_secret_here"
    }
  }]
};