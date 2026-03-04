import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { ClinicalProtocolService } from "../services/ClinicalProtocolService";

export class ClinicalProtocolController {
  /** GET /protocols */
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const includeInactive = req.query["all"] === "true";
      res.json(await ClinicalProtocolService.list(req.userId, includeInactive));
    } catch (err) { next(err); }
  }

  /** POST /protocols */
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(await ClinicalProtocolService.create(req.userId, req.body));
    } catch (err) { next(err); }
  }

  /** PATCH /protocols/:id */
  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await ClinicalProtocolService.update(req.params["id"]!, req.userId, req.body));
    } catch (err) { next(err); }
  }

  /** DELETE /protocols/:id */
  static async remove(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await ClinicalProtocolService.remove(req.params["id"]!, req.userId);
      res.status(204).end();
    } catch (err) { next(err); }
  }

  /**
   * GET /protocols/logs?date=YYYY-MM-DD
   * Returns protocols for the day enriched with their log entries.
   */
  static async logs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const date = (req.query["date"] as string) ?? new Date().toISOString().slice(0, 10);
      res.json(await ClinicalProtocolService.logsForDate(req.userId, date));
    } catch (err) { next(err); }
  }

  /**
   * PATCH /protocols/:id/toggle
   * Body (optional): { date: "YYYY-MM-DD" }
   */
  static async toggle(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const date = (req.body as Record<string, string>)["date"];
      res.json(await ClinicalProtocolService.toggle(req.params["id"]!, req.userId, date));
    } catch (err) { next(err); }
  }
}
