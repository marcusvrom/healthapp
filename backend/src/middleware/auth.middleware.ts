import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AuthenticatedRequest extends Request {
  userId: string;
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Token de autenticação não fornecido." });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string };
    (req as AuthenticatedRequest).userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ message: "Token inválido ou expirado." });
  }
}
