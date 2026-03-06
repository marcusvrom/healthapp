import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { GamificationService } from "../services/GamificationService";

export class RankingController {
  /**
   * GET /gamification/ranking?scope=global|regional|friends&limit=50
   */
  static async weekly(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = Math.min(50, Number(req.query["limit"] ?? 50));
      const scope = String(req.query["scope"] ?? "global") as "global" | "regional" | "friends";

      let ranking;
      if (scope === "regional") {
        ranking = await GamificationService.getRegionalRanking(req.userId, limit);
      } else if (scope === "friends") {
        ranking = await GamificationService.getFriendsRanking(req.userId, limit);
      } else {
        ranking = await GamificationService.getWeeklyRanking(limit);
      }

      res.json(ranking);
    } catch (err) { next(err); }
  }

  /**
   * GET /gamification/caps
   */
  static async caps(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { DAILY_XP_CAPS } = await import("../services/GamificationService");
      const today   = new Date().toISOString().slice(0, 10);
      const entries = await Promise.all(
        Object.entries(DAILY_XP_CAPS).map(async ([category, cap]) => {
          const earned    = await GamificationService.getDailyEarnedXp(req.userId, today, category);
          const remaining = Math.max(0, (cap ?? 0) - earned);
          return { category, cap: cap ?? 0, earned, remaining };
        })
      );
      res.json(entries);
    } catch (err) { next(err); }
  }
}
