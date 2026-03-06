import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { AppDataSource } from "../config/typeorm.config";
import { WeeklyCheckIn } from "../entities/WeeklyCheckIn";

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
