import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { CopilotService } from "../services/CopilotService";

export class CopilotController {
  /** GET /copilot/insights */
  static async insights(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const insights = await CopilotService.getInsights(req.userId);
      res.json(insights);
    } catch (err) {
      next(err);
    }
  }
}
