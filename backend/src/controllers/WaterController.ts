import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { WaterService } from "../services/WaterService";
import { MetricsService } from "../services/MetricsService";
import { DailyMissionService } from "../services/DailyMissionService";
import { MissionType } from "../entities/DailyMission";

export class WaterController {
  /**
   * POST /water
   * Body: { quantityMl: number, loggedAt?: string }
   */
  static async add(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { quantityMl, loggedAt } = req.body as { quantityMl: number; loggedAt?: string };

      if (!quantityMl || quantityMl <= 0) {
        res.status(400).json({ message: "quantityMl deve ser maior que zero." });
        return;
      }

      const log = await WaterService.add(req.userId, { quantityMl, loggedAt });

      // Auto-complete WATER_GOAL mission
      DailyMissionService.checkAndComplete(req.userId, MissionType.WATER_GOAL).catch(() => {});

      res.status(201).json(log);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /water/today?date=YYYY-MM-DD
   * Returns all logs for the day + total consumed + daily goal
   */
  static async today(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const date = req.query["date"] as string | undefined;
      const { logs, totalMl } = await WaterService.getDay(req.userId, date);
      res.json({ logs, totalMl });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /water/history?days=7
   * Returns per-day consumed/goal/metGoal for the last N days
   */
  static async history(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const days    = Math.min(Number(req.query["days"] ?? 7), 30);
      const history = await MetricsService.waterConsistency(req.userId, days);
      res.json(history);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /water/:id
   */
  static async remove(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await WaterService.remove(req.params["id"]!, req.userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}
