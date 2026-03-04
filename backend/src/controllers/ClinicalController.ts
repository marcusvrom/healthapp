import { Response, NextFunction } from "express";
import { AppDataSource } from "../config/typeorm.config";
import { BloodTest } from "../entities/BloodTest";
import { HormoneLog } from "../entities/HormoneLog";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

const btRepo  = () => AppDataSource.getRepository(BloodTest);
const hlRepo  = () => AppDataSource.getRepository(HormoneLog);

export class ClinicalController {
  /**
   * GET /clinical/history?days=365
   * Returns combined blood-test history + hormone logs for charting.
   */
  static async history(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const days = Math.min(Number(req.query["days"] ?? 365), 730);
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceDate = since.toISOString().slice(0, 10);

      const [bloodTests, hormoneLogs] = await Promise.all([
        btRepo().find({
          where:  { userId: req.userId },
          order:  { collectedAt: "ASC" },
        }),
        hlRepo().createQueryBuilder("hl")
          .where("hl.user_id = :uid", { uid: req.userId })
          .andWhere("hl.administered_at >= :since", { since: sinceDate })
          .orderBy("hl.administered_at", "ASC")
          .getMany(),
      ]);

      // Filter blood tests by date range
      const filteredTests = bloodTests.filter(bt => bt.collectedAt >= sinceDate);

      res.json({ bloodTests: filteredTests, hormoneLogs });
    } catch (err) {
      next(err);
    }
  }
}
