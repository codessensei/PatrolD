import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { checkDatabaseConnection } from "./db";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Uygulama başlangıcında veritabanı durumunu kontrol et
  console.log("\n=== VERİTABANI DURUM KONTROLÜ ===");
  const dbStatus = await checkDatabaseConnection();
  console.log(`=== VERİTABANI DURUM SONUCU: ${dbStatus.success ? 'BAŞARILI ✅' : 'BAŞARISIZ ❌'} ===\n`);
  
  // Uygulama rotalarını kaydet
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // More detailed error logging
    console.error("Server error:", {
      status,
      message,
      stack: err.stack,
      originalError: err
    });

    // Try to handle commonly occurring issues
    if (message.includes("Invalid URL")) {
      return res.status(400).json({ 
        message: "Invalid URL format in service configuration. Please check host and port values."
      });
    }

    // Send a more structured error response
    res.status(status).json({ 
      message,
      error: process.env.NODE_ENV === 'production' ? undefined : err.toString(),
      status
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
