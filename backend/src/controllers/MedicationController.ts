import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { MedicationService } from "../services/MedicationService";
import { GamificationService } from "../services/GamificationService";

export class MedicationController {
  /** GET /medications */
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const includeInactive = req.query["all"] === "true";
      const meds = await MedicationService.list(req.userId, !includeInactive);
      res.json(meds);
    } catch (err) { next(err); }
  }

  /** POST /medications */
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const med = await MedicationService.create(req.userId, req.body);
      res.status(201).json(med);
    } catch (err) { next(err); }
  }

  /** PATCH /medications/:id */
  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const med = await MedicationService.update(req.params["id"]!, req.userId, req.body);
      res.json(med);
    } catch (err) { next(err); }
  }

  /** DELETE /medications/:id */
  static async remove(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await MedicationService.remove(req.params["id"]!, req.userId);
      res.status(204).end();
    } catch (err) { next(err); }
  }

  /** GET /medications/logs?date=YYYY-MM-DD */
  static async logs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const date = (req.query["date"] as string) ?? new Date().toISOString().slice(0, 10);
      const logs = await MedicationService.logsForDate(req.userId, date);
      res.json(logs);
    } catch (err) { next(err); }
  }

  /** PATCH /medications/:id/toggle */
  static async toggle(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const date = req.body?.date as string | undefined;
      const { taken, xpGained, totalXp } = await MedicationService.toggle(
        req.params["id"]!, req.userId, date
      );
      const level = GamificationService.levelFromXp(totalXp);
      res.json({ taken, xpGained, totalXp, level });
    } catch (err) { next(err); }
  }
}
