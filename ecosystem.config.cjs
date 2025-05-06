module.exports = {
  apps: [{
    name: "patrold",
    script: "dist/index.js", // Direct path to the built JS file
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "500M",
    env: {
      NODE_ENV: "production",
      PORT: 5000,
      // You should replace these with your actual values
      DATABASE_URL: process.env.DATABASE_URL || "postgres://patrold:password@localhost:5432/patrold",
      PGUSER: process.env.PGUSER || "patrold",
      PGPASSWORD: process.env.PGPASSWORD || "password",
      PGHOST: process.env.PGHOST || "localhost",
      PGPORT: process.env.PGPORT || "5432",
      PGDATABASE: process.env.PGDATABASE || "patrold",
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
      SESSION_SECRET: process.env.SESSION_SECRET || "patrold-session-secret"
    }
  }]
};