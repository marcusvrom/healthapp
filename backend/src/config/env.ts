import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: process.env.JWT_SECRET ?? "change_me_in_production_please",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  db: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? "airafit",
    password: process.env.DB_PASSWORD ?? "airafit_secret",
    name: process.env.DB_NAME ?? "airafit_db",
  },
} as const;
