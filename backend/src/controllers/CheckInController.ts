import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { AppDataSource } from "../config/typeorm.config";
import { WeeklyCheckIn } from "../entities/WeeklyCheckIn";
import { RoutineBlock } from "../entities/RoutineBlock";
import { Between } from "typeorm";

function repo() {
  return AppDataSource.getRepository(WeeklyCheckIn);
}

export class CheckInController {
  /** GET /check-ins — list all check-ins for the user, newest first */
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const checkIns = await repo().find({
        where: { userId: req.userId },
        order: { date: "DESC" },
      });
      res.json(checkIns);
    } catch (err) {
      next(err);
    }
  }

  /** GET /check-ins/latest — latest single check-in */
  static async latest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const checkIn = await repo().findOne({
        where: { userId: req.userId },
        order: { date: "DESC" },
      });
      res.json(checkIn ?? null);
    } catch (err) {
      next(err);
    }
  }

  /** POST /check-ins — create a new check-in */
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { date, currentWeight, waistCircumference, adherenceScore, notes } =
        req.body as {
          date?: string;
          currentWeight: number;
          waistCircumference?: number;
          adherenceScore: number;
          notes?: string;
        };

      if (!currentWeight || !adherenceScore) {
        res.status(400).json({ message: "currentWeight e adherenceScore são obrigatórios." });
        return;
      }

      if (adherenceScore < 1 || adherenceScore > 5) {
        res.status(400).json({ message: "adherenceScore deve ser entre 1 e 5." });
        return;
      }

      const checkIn = repo().create({
        userId: req.userId,
        date: date ?? new Date().toISOString().slice(0, 10),
        currentWeight,
        waistCircumference: waistCircumference ?? undefined,
        adherenceScore,
        notes: notes ?? undefined,
      });

      await repo().save(checkIn);
      res.status(201).json(checkIn);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /check-ins/adherence
   * Calculates weekly and daily adherence based on completed RoutineBlocks for the last 7 days.
   * Returns { adherenceScore (1-5 or null), weekPct (0-100 or null), dailyStats[] }
   */
  static async adherence(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const blocks = await AppDataSource.getRepository(RoutineBlock).find({
        where: { userId: req.userId, routineDate: Between(weekAgo, today) },
        order: { routineDate: "ASC" },
      });

      // Group by date
      const byDate = new Map<string, { total: number; completed: number }>();
      for (const b of blocks) {
        if (!byDate.has(b.routineDate)) byDate.set(b.routineDate, { total: 0, completed: 0 });
        const day = byDate.get(b.routineDate)!;
        day.total++;
        if (b.completedAt) day.completed++;
      }

      const dailyStats = Array.from(byDate.entries()).map(([date, s]) => ({
        date,
        total: s.total,
        completed: s.completed,
        pct: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
      }));

      const daysWithBlocks = dailyStats.filter(d => d.total > 0);
      const weekPct = daysWithBlocks.length > 0
        ? Math.round(daysWithBlocks.reduce((sum, d) => sum + d.pct, 0) / daysWithBlocks.length)
        : null;

      // Map 0-100% → 1-5 stars: 0-20=1, 21-40=2, 41-60=3, 61-80=4, 81-100=5
      const adherenceScore = weekPct !== null
        ? Math.max(1, Math.min(5, Math.ceil(weekPct / 20)))
        : null;

      res.json({ adherenceScore, weekPct, dailyStats });
    } catch (err) {
      next(err);
    }
  }

  /** DELETE /check-ins/:id — delete a check-in */
  static async remove(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const checkIn = await repo().findOneBy({ id: req.params["id"]!, userId: req.userId });
      if (!checkIn) {
        res.status(404).json({ message: "Check-in não encontrado." });
        return;
      }
      await repo().remove(checkIn);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
}
