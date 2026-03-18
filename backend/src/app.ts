import "reflect-metadata";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { AppDataSource } from "./config/typeorm.config";
import { env } from "./config/env";
import router from "./routes";
import { errorMiddleware } from "./middleware/error.middleware";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap(): Promise<void> {
  // ── Database connection ──────────────────────────────────────────────────
  await AppDataSource.initialize();
  await AppDataSource.runMigrations();
  console.log("[DB] Conectado ao PostgreSQL.");

  // ── Express setup ────────────────────────────────────────────────────────
  const app = express();

  // ── Security headers (Helmet) ──────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,  // allow loading images/uploads
  }));

  // ── CORS (restrictive per environment) ─────────────────────────────────
  const allowedOrigins = env.corsOrigins.split(",").map(o => o.trim()).filter(Boolean);
  app.use(cors({
    origin(origin, callback) {
      // Allow requests with no origin (server-to-server, curl, health checks)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`Origin ${origin} não permitida pelo CORS.`));
    },
    credentials: true,  // required for HttpOnly cookies
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }));

  // ── Cookie parser ──────────────────────────────────────────────────────
  app.use(cookieParser());

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // ── Rate limiting ──────────────────────────────────────────────────────
  // Auth endpoints: strict limit (brute-force protection)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 20,                // max 20 attempts per window
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Muitas tentativas. Aguarde 15 minutos e tente novamente." },
    keyGenerator: (req) => req.ip ?? req.socket.remoteAddress ?? "unknown",
  });
  app.use("/api/v1/auth", authLimiter);

  // General API: softer limit
  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    limit: 200,              // 200 requests per minute
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Limite de requisições excedido. Tente novamente em breve." },
    keyGenerator: (req) => req.ip ?? req.socket.remoteAddress ?? "unknown",
  });
  app.use("/api/v1", apiLimiter);

  // ── Static files (avatar uploads) ────────────────────────────────────────
  const uploadsPath = path.join(process.cwd(), "uploads");
  app.use("/uploads", express.static(uploadsPath));

  // ── Routes ───────────────────────────────────────────────────────────────
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/v1", router);

  // ── Error handling (must be last) ────────────────────────────────────────
  app.use(errorMiddleware);

  app.listen(env.port, () => {
    console.log(`[SERVER] Rodando em http://localhost:${env.port}`);
  });
}

bootstrap().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
