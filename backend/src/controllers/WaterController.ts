import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { WaterService } from "../services/WaterService";
import { MetricsService } from "../services/MetricsService";
import { DailyMissionService } from "../services/DailyMissionService";
import { MissionType } from "../entities/DailyMission";
import { AppDataSource } from "../config/typeorm.config";
import { RoutineBlock, BlockType } from "../entities/RoutineBlock";

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export class WaterController {
  /**
   * POST /water
   * Body: { quantityMl: number, loggedAt?: string }
   *
   * After logging water, auto-completes any WATER routine blocks whose
   * time window covers the logged time. This removes the need for the
   * user to manually mark water reminders as done.
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

      // Auto-complete water blocks in the matching time window
      WaterController.autoCompleteWaterBlocks(req.userId, loggedAt).catch(() => {});

      res.status(201).json(log);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Finds uncompleted WATER blocks for today whose scheduled window covers
   * the given time (or "now") and marks them as completed.
   */
  private static async autoCompleteWaterBlocks(userId: string, loggedAt?: string): Promise<void> {
    const now = loggedAt ? new Date(loggedAt) : new Date();
    const today = now.toISOString().slice(0, 10);
    const dayOfWeek = now.getDay();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const repo = AppDataSource.getRepository(RoutineBlock);
    const blocks = await repo
      .createQueryBuilder("b")
      .where("b.user_id = :userId", { userId })
      .andWhere("b.type = :type", { type: BlockType.WATER })
      .andWhere("b.completed_at IS NULL")
      .andWhere(
        `(
          (b.is_recurring = false AND b.routine_date = :date)
          OR
          (b.is_recurring = true AND b.days_of_week @> :dow::jsonb)
        )`,
        { date: today, dow: JSON.stringify([dayOfWeek]) }
      )
      .getMany();

    const BEFORE = 30; // minutes before block start
    const AFTER  = 60; // minutes after block end

    for (const block of blocks) {
      const start = timeToMinutes(block.startTime);
      let end = timeToMinutes(block.endTime);
      if (end < start) end += 24 * 60;

      const effectiveNow = end > 24 * 60 && nowMin < start ? nowMin + 24 * 60 : nowMin;

      if (effectiveNow >= start - BEFORE && effectiveNow <= end + AFTER) {
        block.completedAt = now;
        await repo.save(block);
      }
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
