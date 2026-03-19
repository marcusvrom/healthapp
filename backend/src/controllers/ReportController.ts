import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { ReportService } from "../services/ReportService";

export class ReportController {
  /**
   * GET /reports/progress — download a PDF progress report
   */
  static async progressReport(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const doc = await ReportService.generateProgressReport(req.userId);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="airafit-progresso-${new Date().toISOString().slice(0, 10)}.pdf"`);

      doc.pipe(res);
    } catch (err) { next(err); }
  }
}
