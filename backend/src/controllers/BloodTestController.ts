import { Response, NextFunction } from "express";
import { AppDataSource } from "../config/typeorm.config";
import { BloodTest } from "../entities/BloodTest";
import { HealthProfile } from "../entities/HealthProfile";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { BloodTestAnalysisService } from "../services/BloodTestAnalysisService";
import { CalculationService } from "../services/CalculationService";
import { ExerciseCalcInput } from "../types/calculation.types";

const bloodTestRepo = () => AppDataSource.getRepository(BloodTest);
const profileRepo = () => AppDataSource.getRepository(HealthProfile);

export class BloodTestController {
  /** GET /blood-tests */
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tests = await bloodTestRepo().find({
        where: { userId: req.userId },
        order: { collectedAt: "DESC" },
      });
      res.json(tests);
    } catch (err) {
      next(err);
    }
  }

  /** POST /blood-tests */
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const test = bloodTestRepo().create({ ...req.body, userId: req.userId } as Partial<BloodTest>);
      const saved = await bloodTestRepo().save(test) as BloodTest;

      // Immediately compute adjustments
      const adjustments = await BloodTestController.computeAdjustments(
        req.userId,
        saved
      );
      saved.computedAdjustments = adjustments as unknown as Record<string, unknown>;
      await bloodTestRepo().save(saved);

      res.status(201).json(saved);
    } catch (err) {
      next(err);
    }
  }

  /** GET /blood-tests/latest/analysis */
  static async latestAnalysis(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const latest = await bloodTestRepo().findOne({
        where: { userId: req.userId },
        order: { collectedAt: "DESC" },
      });

      if (!latest) {
        res.status(404).json({ message: "Nenhum exame encontrado." });
        return;
      }

      const adjustments = await BloodTestController.computeAdjustments(
        req.userId,
        latest
      );

      res.json({ bloodTest: latest, analysis: adjustments });
    } catch (err) {
      next(err);
    }
  }

  private static async computeAdjustments(userId: string, test: BloodTest) {
    const profile = await profileRepo().findOne({
      where: { userId },
      relations: ["exercises"],
    });

    if (!profile) return null;

    const exercises: ExerciseCalcInput[] = (profile.exercises ?? []).map((ex) => ({
      met: Number(ex.met),
      weightKg: Number(profile.weight),
      durationMinutes: ex.durationMinutes,
      hypertrophyScore: ex.hypertrophyScore,
    }));

    const metabolic = CalculationService.computeMetabolicResult(
      Number(profile.weight),
      Number(profile.height),
      profile.age,
      profile.gender,
      profile.activityFactor,
      exercises,
      profile.primaryGoal,
      profile.targetWeight ? Number(profile.targetWeight) : undefined
    );

    return BloodTestAnalysisService.analyse(
      test,
      metabolic.macros,
      profile.gender,
      Number(profile.weight),
      metabolic.dailyCaloricTarget
    );
  }
}
