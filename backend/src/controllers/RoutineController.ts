import { Response, NextFunction } from "express";
import { AppDataSource } from "../config/typeorm.config";
import { RoutineBlock, BlockType } from "../entities/RoutineBlock";
import { ScheduledMeal } from "../entities/ScheduledMeal";
import { HealthProfile } from "../entities/HealthProfile";
import { BloodTest } from "../entities/BloodTest";
import { Exercise } from "../entities/Exercise";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { CalculationService } from "../services/CalculationService";
import { BloodTestAnalysisService } from "../services/BloodTestAnalysisService";
import { RoutineGeneratorService } from "../services/RoutineGeneratorService";
import { ClinicalProtocolService } from "../services/ClinicalProtocolService";
import { ExerciseCalcInput } from "../types/calculation.types";

const routineRepo   = () => AppDataSource.getRepository(RoutineBlock);
const mealRepo      = () => AppDataSource.getRepository(ScheduledMeal);
const profileRepo   = () => AppDataSource.getRepository(HealthProfile);
const bloodTestRepo = () => AppDataSource.getRepository(BloodTest);
const exerciseRepo  = () => AppDataSource.getRepository(Exercise);

export class RoutineController {
  /** GET /routine?date=YYYY-MM-DD */
  static async get(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const date = (req.query["date"] as string) ?? new Date().toISOString().slice(0, 10);

      const blocks = await routineRepo().find({
        where: { userId: req.userId, routineDate: date },
        order: { sortOrder: "ASC" },
      });

      res.json(blocks);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /routine/generate?date=YYYY-MM-DD
   * Generates (or re-generates) the daily routine for the requested date.
   */
  static async generate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const date = (req.query["date"] as string) ?? new Date().toISOString().slice(0, 10);

      const profile = await profileRepo().findOne({
        where: { userId: req.userId },
        relations: ["exercises"],
      });

      if (!profile) {
        res.status(400).json({ message: "Crie um perfil de saúde antes de gerar a rotina." });
        return;
      }

      // Fetch exercises scheduled for the requested day-of-week
      const dayOfWeek = new Date(date + "T12:00:00").getDay();
      const allExercises = profile.exercises ?? [];
      const todaysExercises = allExercises.filter((ex) =>
        ex.daysOfWeek.includes(dayOfWeek)
      );

      // Calculate metabolic data (including primaryGoal adjustment)
      const exerciseInputs: ExerciseCalcInput[] = todaysExercises.map((ex) => ({
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
        exerciseInputs,
        profile.primaryGoal
      );

      // Analyse latest blood test if available
      const latestBloodTest = await bloodTestRepo().findOne({
        where: { userId: req.userId },
        order: { collectedAt: "DESC" },
      });

      let requiresSunExposureBlock = false;
      let prioritiseAerobic = false;

      if (latestBloodTest) {
        const analysis = BloodTestAnalysisService.analyse(
          latestBloodTest,
          metabolic.macros,
          profile.gender,
          Number(profile.weight),
          metabolic.dailyCaloricTarget
        );
        requiresSunExposureBlock = analysis.requiresSunExposureBlock;
        prioritiseAerobic = analysis.prioritiseAerobic;
      }

      // Fetch clinical protocols for today (medications, supplements, hormones)
      const clinicalProtocols = await ClinicalProtocolService.forDay(req.userId, date);

      // Wipe the full day before regenerating so old data never leaks through.
      // RoutineBlock delete is critical — run first.
      // ScheduledMeal delete is best-effort: silently ignore failures so a
      // missing table or type mismatch never prevents routine generation.
      await routineRepo().delete({ userId: req.userId, routineDate: date });
      try {
        await mealRepo().delete({ userId: req.userId, scheduledDate: date });
      } catch { /* non-fatal — proceed with block generation regardless */ }

      const blocks = RoutineGeneratorService.generate({
        healthProfile: profile,
        exercises: todaysExercises,
        clinicalProtocols,
        date,
        totalKcal: metabolic.dailyCaloricTarget,
        waterMlTotal: metabolic.waterMlTotal,
        requiresSunExposureBlock,
        prioritiseAerobic,
      });

      const entities = routineRepo().create(
        blocks.map((b) => ({ ...b, userId: req.userId }))
      );
      const saved = await routineRepo().save(entities);

      // ── Create one ScheduledMeal per meal block ─────────────────────────────
      // This links the timeline block to a ScheduledMeal (single source of truth
      // for recipe links and consumption tracking).
      const mealBlocksSaved = saved.filter(
        (b) => b.type === BlockType.MEAL && b.caloricTarget != null
      );

      if (mealBlocksSaved.length > 0 && metabolic.dailyCaloricTarget > 0) {
        const scheduledMeals = mealBlocksSaved.map((b) => {
          const ratio = Number(b.caloricTarget!) / metabolic.dailyCaloricTarget;
          return mealRepo().create({
            userId:        req.userId,
            scheduledDate: date,
            scheduledTime: b.startTime,
            name:          b.label,
            caloricTarget: Number(b.caloricTarget),
            proteinG:      Math.round(metabolic.macros.proteinG * ratio),
            carbsG:        Math.round(metabolic.macros.carbsG   * ratio),
            fatG:          Math.round(metabolic.macros.fatG     * ratio),
            isConsumed:    false,
            xpAwarded:     false,
          });
        });

        const savedMeals = await mealRepo().save(scheduledMeals);

        // Patch each meal block's metadata with its scheduledMealId so the
        // frontend can navigate from timeline block → ScheduledMeal.
        const blocksToUpdate = mealBlocksSaved.map((b, i) => ({
          ...b,
          metadata: { ...(b.metadata ?? {}), scheduledMealId: savedMeals[i]!.id },
        }));
        await routineRepo().save(blocksToUpdate);

        // Return freshly loaded blocks (with updated metadata).
        const finalBlocks = await routineRepo().find({
          where: { userId: req.userId, routineDate: date },
          order: { sortOrder: "ASC" },
        });
        res.status(201).json(finalBlocks);
        return;
      }

      res.status(201).json(saved);
    } catch (err) {
      next(err);
    }
  }
}
