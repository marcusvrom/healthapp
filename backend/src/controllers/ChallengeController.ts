import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { ChallengeService } from "../services/ChallengeService";
import { GamificationService } from "../services/GamificationService";

export class ChallengeController {
  /**
   * GET /challenges
   * Lists all active challenges for this week with join status + progress.
   */
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const challenges = await ChallengeService.getActiveChallenges(req.userId);
      res.json(challenges);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /challenges/:id/join
   * Joins a challenge. Idempotent.
   */
  static async join(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const challengeId = req.params["id"]!;
      const participant = await ChallengeService.joinChallenge(req.userId, challengeId);
      res.status(201).json(participant);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "Desafio não encontrado.") {
        res.status(404).json({ message: err.message });
        return;
      }
      next(err);
    }
  }

  /**
   * POST /challenges/:id/check
   * Checks whether the user completed the challenge and awards XP if so.
   * Returns { xpAwarded, totalXp, level }.
   */
  static async check(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const challengeId = req.params["id"]!;
      const xpAwarded   = await ChallengeService.checkAndAwardCompletion(req.userId, challengeId);
      const totalXp     = await GamificationService.getXp(req.userId);
      const level       = GamificationService.levelFromXp(totalXp);
      res.json({ xpAwarded, totalXp, level });
    } catch (err) {
      next(err);
    }
  }
}
