import { Response, NextFunction } from "express";
import { AppDataSource } from "../config/typeorm.config";
import { HealthProfile } from "../entities/HealthProfile";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { CalculationService } from "../services/CalculationService";
import { ExerciseCalcInput } from "../types/calculation.types";
import { Exercise } from "../entities/Exercise";

const profileRepo = () => AppDataSource.getRepository(HealthProfile);
const exerciseRepo = () => AppDataSource.getRepository(Exercise);

export class HealthProfileController {
  /** GET /profile */
  static async get(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await profileRepo().findOne({
        where: { userId: req.userId },
        relations: ["exercises"],
      });

      if (!profile) {
        res.status(404).json({ message: "Perfil não encontrado." });
        return;
      }

      res.json(profile);
    } catch (err) {
      next(err);
    }
  }

  /** POST /profile – create or update */
  static async upsert(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const existing = await profileRepo().findOneBy({ userId: req.userId });

      const profile = existing ?? profileRepo().create({ userId: req.userId });
      Object.assign(profile, req.body);

      await profileRepo().save(profile);
      res.status(existing ? 200 : 201).json(profile);
    } catch (err) {
      next(err);
    }
  }

  /** GET /profile/metabolic – live metabolic calculation */
  static async getMetabolicResult(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const profile = await profileRepo().findOne({
        where: { userId: req.userId },
        relations: ["exercises"],
      });

      if (!profile) {
        res.status(404).json({ message: "Perfil não encontrado. Crie um perfil primeiro." });
        return;
      }

      const exercises: ExerciseCalcInput[] = (profile.exercises ?? []).map((ex) => ({
        met: Number(ex.met),
        weightKg: Number(profile.weight),
        durationMinutes: ex.durationMinutes,
        hypertrophyScore: ex.hypertrophyScore,
      }));

      const result = CalculationService.computeMetabolicResult(
        Number(profile.weight),
        Number(profile.height),
        profile.age,
        profile.gender,
        profile.activityFactor,
        exercises,
        profile.primaryGoal
      );

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}
