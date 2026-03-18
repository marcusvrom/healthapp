import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AuthenticatedRequest extends Request {
  userId: string;
}

const COOKIE_NAME = "ha_token";

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // 1. Try HttpOnly cookie first (preferred)
  let token: string | undefined = req.cookies?.[COOKIE_NAME];

  // 2. Fall back to Authorization header (backwards compat / mobile clients)
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    res.status(401).json({ message: "Token de autenticação não fornecido." });
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string };
    (req as AuthenticatedRequest).userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ message: "Token inválido ou expirado." });
  }
}
