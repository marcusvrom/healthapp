import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/typeorm.config";
import { User } from "../entities/User";
import { env } from "../config/env";

const userRepo = () => AppDataSource.getRepository(User);

/** Parse JWT expiresIn string (e.g. "7d", "24h", "30m") to milliseconds */
function expiresInToMs(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days
  const n = Number(match[1]);
  switch (match[2]) {
    case "s": return n * 1000;
    case "m": return n * 60 * 1000;
    case "h": return n * 60 * 60 * 1000;
    case "d": return n * 24 * 60 * 60 * 1000;
    default:  return 7 * 24 * 60 * 60 * 1000;
  }
}

const COOKIE_NAME = "ha_token";
const isProduction = env.nodeEnv === "production";

function setTokenCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    domain: env.cookieDomain || undefined,
    maxAge: expiresInToMs(env.jwtExpiresIn),
    path: "/",
  });
}

export class AuthController {
  /** POST /auth/register */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, name, password } = req.body as {
        email: string;
        name: string;
        password: string;
      };

      const existing = await userRepo().findOneBy({ email });
      if (existing) {
        res.status(409).json({ message: "E-mail já cadastrado." });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const user = userRepo().create({ email, name, passwordHash });
      await userRepo().save(user);

      const token = AuthController.signToken(user.id);
      setTokenCookie(res, token);
      res.status(201).json({ token, userId: user.id });
    } catch (err) {
      next(err);
    }
  }

  /** POST /auth/login */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body as { email: string; password: string };

      const user = await userRepo().findOneBy({ email });
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        res.status(401).json({ message: "Credenciais inválidas." });
        return;
      }

      const token = AuthController.signToken(user.id);
      setTokenCookie(res, token);
      res.json({ token, userId: user.id });
    } catch (err) {
      next(err);
    }
  }

  /** POST /auth/logout */
  static async logout(_req: Request, res: Response): Promise<void> {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "strict" : "lax",
      domain: env.cookieDomain || undefined,
      path: "/",
    });
    res.json({ message: "Logout realizado." });
  }

  private static signToken(userId: string): string {
    return jwt.sign({ sub: userId }, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn,
    } as jwt.SignOptions);
  }
}
