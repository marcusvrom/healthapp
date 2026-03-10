import "reflect-metadata";
import express from "express";
import cors from "cors";
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

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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
