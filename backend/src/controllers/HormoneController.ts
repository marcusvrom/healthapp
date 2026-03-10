import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { HormoneService } from "../services/HormoneService";
import { HormoneCategory } from "../entities/HormoneLog";

export class HormoneController {
  /**
   * POST /hormones
   * Body: LogHormoneDto
   */
  static async log(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const entry = await HormoneService.log(req.userId, req.body);
      res.status(201).json(entry);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /hormones?category=TRT&page=1&pageSize=30
   */
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = req.query["category"] as HormoneCategory | undefined;
      const page     = Number(req.query["page"]     ?? 1);
      const pageSize = Number(req.query["pageSize"] ?? 30);

      const result = await HormoneService.list(req.userId, { category, page, pageSize });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /hormones/latest
   * Returns the most recent log for each category
   */
  static async latest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await HormoneService.latestPerCategory(req.userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /hormones/:id
   * Body: { dosage?, notes?, administeredAt? }
   */
  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await HormoneService.update(req.params["id"]!, req.userId, req.body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /hormones/:id
   */
  static async remove(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await HormoneService.remove(req.params["id"]!, req.userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}
