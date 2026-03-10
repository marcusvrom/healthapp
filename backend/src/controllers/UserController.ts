import { Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import { AppDataSource } from "../config/typeorm.config";
import { User } from "../entities/User";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { GamificationService } from "../services/GamificationService";

const uploadsDir = path.join(process.cwd(), "uploads", "avatars");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const userRepo = () => AppDataSource.getRepository(User);

export class UserController {
  /** GET /users/me */
  static async me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userRepo().findOneBy({ id: req.userId });
      if (!user) { res.status(404).json({ message: "Usuário não encontrado." }); return; }

      const xp    = user.xp;
      const level = GamificationService.levelFromXp(xp);

      res.json({
        id:        user.id,
        email:     user.email,
        name:      user.name,
        avatarUrl: user.avatarUrl ?? null,
        xp,
        level,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /users/avatar  (JSON body: { dataUrl: "data:image/png;base64,..." })
   * Saves the decoded file, updates avatarUrl in DB, returns the new URL.
   */
  static async uploadAvatar(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { dataUrl } = req.body as { dataUrl?: string };
      if (!dataUrl || !dataUrl.startsWith("data:image/")) {
        res.status(400).json({ message: "dataUrl de imagem inválida." });
        return;
      }

      const [header, base64Data] = dataUrl.split(",");
      if (!header || !base64Data) {
        res.status(400).json({ message: "Formato de dataUrl inválido." });
        return;
      }

      const ext = header.match(/data:image\/(\w+)/)?.[1] ?? "jpg";
      const filename = `avatar-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const filePath  = path.join(uploadsDir, filename);

      fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

      const avatarUrl = `/uploads/avatars/${filename}`;

      await userRepo()
        .createQueryBuilder()
        .update(User)
        .set({ avatarUrl })
        .where("id = :id", { id: req.userId })
        .execute();

      res.json({ avatarUrl });
    } catch (err) {
      next(err);
    }
  }
}
