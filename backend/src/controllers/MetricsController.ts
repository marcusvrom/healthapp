import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { MetricsService } from "../services/MetricsService";

export class MetricsController {
  /**
   * GET /metrics/weight?limit=30
   * Returns weight history as [{date, weightKg}] sorted ASC (for line chart)
   */
  static async weightHistory(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const limit = Math.min(Number(req.query["limit"] ?? 30), 90);
      const data  = await MetricsService.weightHistory(req.userId, limit);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /metrics/weight
   * Body: { weightKg: number, recordedAt?: YYYY-MM-DD, notes?: string }
   */
  static async logWeight(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { weightKg, recordedAt, notes } = req.body as {
        weightKg: number;
        recordedAt?: string;
        notes?: string;
      };

      if (!weightKg || weightKg <= 0) {
        res.status(400).json({ message: "weightKg deve ser maior que zero." });
        return;
      }

      const log = await MetricsService.logWeight(req.userId, weightKg, recordedAt, notes);
      res.status(201).json(log);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /metrics/water?days=7
   * Returns water consistency data for the last N days (for bar chart)
   */
  static async waterConsistency(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const days = Math.min(Number(req.query["days"] ?? 7), 30);
      const data = await MetricsService.waterConsistency(req.userId, days);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /metrics/streaks
   * Returns { waterCurrentStreak, waterLongestStreak }
   */
  static async streaks(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const data = await MetricsService.streaks(req.userId);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
}
