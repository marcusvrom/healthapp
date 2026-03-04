import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/typeorm.config";
import { User } from "../entities/User";
import { env } from "../config/env";

const userRepo = () => AppDataSource.getRepository(User);

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
      res.json({ token, userId: user.id });
    } catch (err) {
      next(err);
    }
  }

  private static signToken(userId: string): string {
    return jwt.sign({ sub: userId }, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn,
    } as jwt.SignOptions);
  }
}
