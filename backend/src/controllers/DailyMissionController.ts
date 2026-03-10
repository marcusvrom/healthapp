import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { DailyMissionService } from "../services/DailyMissionService";
import { GamificationService } from "../services/GamificationService";

export class DailyMissionController {
  /**
   * GET /missions/today
   * Returns (and lazily generates) the 3 daily missions for today.
   */
  static async today(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const missions = await DailyMissionService.getTodayMissions(req.userId);
      res.json(missions);
    } catch (err) { next(err); }
  }

  /**
   * POST /missions/:id/complete
   * Marks a mission as complete and awards XP.
   */
  static async complete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { mission, xpGained, totalXp } = await DailyMissionService.completeMission(req.userId, id);
      const { level, title: levelTitle, nextLevelXp } = GamificationService.levelFromXp(totalXp);
      res.json({ mission, xpGained, totalXp, level: { level, title: levelTitle, nextLevelXp } });
    } catch (err) { next(err); }
  }
}
