import { Response, NextFunction } from "express";
import { Request } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { AppDataSource } from "../config/typeorm.config";
import { User } from "../entities/User";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { GamificationService } from "../services/GamificationService";

// ── Multer setup ─────────────────────────────────────────────────────────────
const uploadsDir = path.join(process.cwd(), "uploads", "avatars");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Somente arquivos de imagem são permitidos."));
  },
}).single("avatar");

/** Wrap multer in a promise so we can use async/await. */
function runUpload(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    uploadMiddleware(req, res, (err) => {
      if (err) reject(Object.assign(err, { statusCode: 400 }));
      else resolve();
    });
  });
}

const userRepo = () => AppDataSource.getRepository(User);

// ── Controller ────────────────────────────────────────────────────────────────
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
   * POST /users/avatar  (multipart/form-data, field: "avatar")
   * Saves the file, updates avatarUrl in DB, returns the new URL.
   */
  static async uploadAvatar(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await runUpload(req, res);

      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file) {
        res.status(400).json({ message: "Nenhum arquivo enviado." });
        return;
      }

      const avatarUrl = `/uploads/avatars/${file.filename}`;

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
