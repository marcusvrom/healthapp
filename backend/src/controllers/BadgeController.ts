import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { BadgeService } from "../services/BadgeService";

export class BadgeController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const badges = await BadgeService.getUserBadges(req.userId);
      res.json(badges);
    } catch (err) { next(err); }
  }

  static async check(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const newBadges = await BadgeService.checkAndUnlock(req.userId);
      res.json({ unlocked: newBadges.length, badges: newBadges });
    } catch (err) { next(err); }
  }
}
