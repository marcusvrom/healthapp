import { Response, NextFunction } from "express";
import { AppDataSource } from "../config/typeorm.config";
import { RoutineBlock, BlockType, MealType } from "../entities/RoutineBlock";
import { ScheduledMeal } from "../entities/ScheduledMeal";
import { HealthProfile } from "../entities/HealthProfile";
import { BloodTest } from "../entities/BloodTest";
import { Exercise } from "../entities/Exercise";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { CalculationService } from "../services/CalculationService";
import { BloodTestAnalysisService } from "../services/BloodTestAnalysisService";
import { RoutineGeneratorService } from "../services/RoutineGeneratorService";
import { ClinicalProtocolService } from "../services/ClinicalProtocolService";
import { GamificationService, XP_REWARDS } from "../services/GamificationService";
import { createBlockPost } from "./SocialController";
import { ChallengeService } from "../services/ChallengeService";
import { DailyMissionService } from "../services/DailyMissionService";
import { MissionType } from "../entities/DailyMission";
import { ExerciseCalcInput } from "../types/calculation.types";
import { WaterService } from "../services/WaterService";

// ── Time-window helpers ────────────────────────────────────────────────────────

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Validates that the block belongs to today and is completed within a
 * generous window around its scheduled slot.
 *
 * Hard reject  → routineDate != today  (prevents backdating — main anti-cheat)
 * Soft reject  → outside [start − 90min, end + 120min] (block still marked done, no XP)
 */
function checkTimeWindow(block: { routineDate: string; isRecurring?: boolean; startTime: string; endTime: string }): {
  allowed:     boolean;
  outOfWindow: boolean;
  reason?:     string;
} {
  const today = new Date().toISOString().slice(0, 10);

  // Recurring blocks don't have a fixed routineDate — allow if today matches
  if (!block.isRecurring && block.routineDate !== today) {
    return {
      allowed:     false,
      outOfWindow: true,
      reason:      "Somente blocos do dia atual podem ser concluídos.",
    };
  }

  const now    = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const start  = timeToMinutes(block.startTime);
  let   end    = timeToMinutes(block.endTime);
  if (end < start) end += 24 * 60; // midnight-crossing block

  const BEFORE = 90;
  const AFTER  = 120;
  const effectiveNow = end > 24 * 60 && nowMin < start ? nowMin + 24 * 60 : nowMin;

  if (effectiveNow < start - BEFORE || effectiveNow > end + AFTER) {
    return {
      allowed:     true,  // user still marks it done, no XP awarded
      outOfWindow: true,
      reason:      `Bloco concluído fora da janela horária (${block.startTime}–${block.endTime}). XP não concedido — conclua próximo ao horário agendado.`,
    };
  }

  return { allowed: true, outOfWindow: false };
}

const routineRepo   = () => AppDataSource.getRepository(RoutineBlock);
const mealRepo      = () => AppDataSource.getRepository(ScheduledMeal);
const profileRepo   = () => AppDataSource.getRepository(HealthProfile);

// ── Meal-type inference & macro distribution ──────────────────────────────────

/** Infer MealType from time slot (startTime HH:MM). */
function inferMealType(startTime: string): MealType {
  const min = timeToMinutes(startTime);
  if (min < 540)   return MealType.BREAKFAST;        // < 09:00
  if (min < 660)   return MealType.MORNING_SNACK;    // 09:00–10:59
  if (min < 870)   return MealType.LUNCH;             // 11:00–14:29
  if (min < 1020)  return MealType.AFTERNOON_SNACK;   // 14:30–16:59
  if (min < 1110)  return MealType.PRE_WORKOUT;       // 17:00–18:29
  if (min < 1200)  return MealType.DINNER;            // 18:30–19:59
  if (min < 1290)  return MealType.POST_WORKOUT;      // 20:00–21:29
  return MealType.SUPPER;                             // >= 21:30
}

/** Kcal share per meal type — mirrors the deprecated RoutineGeneratorService distribution. */
const MEAL_KCAL_SHARE: Record<MealType, number> = {
  [MealType.BREAKFAST]:       0.20,
  [MealType.MORNING_SNACK]:   0.10,
  [MealType.LUNCH]:           0.30,
  [MealType.AFTERNOON_SNACK]: 0.10,
  [MealType.PRE_WORKOUT]:     0.15,
  [MealType.POST_WORKOUT]:    0.20,
  [MealType.DINNER]:          0.25,
  [MealType.SUPPER]:          0.05,
};
const bloodTestRepo = () => AppDataSource.getRepository(BloodTest);
const exerciseRepo  = () => AppDataSource.getRepository(Exercise);

export class RoutineController {
  /**
   * GET /routine?date=YYYY-MM-DD
   * Returns the union of:
   *  - One-off blocks created specifically for the requested date
   *  - Recurring blocks whose daysOfWeek includes the requested day-of-week
   */
  static async get(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const date = (req.query["date"] as string) ?? new Date().toISOString().slice(0, 10);
      const dayOfWeek = new Date(`${date}T12:00:00`).getDay();

      const blocks = await routineRepo()
        .createQueryBuilder("b")
        .where("b.user_id = :userId", { userId: req.userId })
        .andWhere(
          `(
            (b.is_recurring = false AND b.routine_date = :date)
            OR
            (b.is_recurring = true AND b.days_of_week @> :dow::jsonb)
          )`,
          { date, dow: JSON.stringify([dayOfWeek]) }
        )
        .orderBy("b.sort_order", "ASC")
        .addOrderBy("b.start_time", "ASC")
        .getMany();

      res.json(blocks);
    } catch (err) {
      next(err);
    }
  }

  /**
   * @deprecated POST /routine/generate — Auto-generation is deprecated.
   * Returns 410 Gone to inform clients that this endpoint is no longer available.
   * Users should create blocks manually via POST /routine/blocks.
   */
  static async generate(
    _req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    res.status(410).json({
      message: "A geração automática de rotina foi descontinuada. Use o Canvas para criar seus blocos manualmente.",
    });
  }

  // ── Canvas CRUD ──────────────────────────────────────────────────────────────

  /**
   * POST /routine/blocks
   * Creates a new user-defined routine block.
   * Body: { type, startTime, endTime, label, routineDate?, isRecurring?, daysOfWeek?, mealType?, caloricTarget?, waterMl?, metadata? }
   *
   * When type === 'meal':
   *  - Infers mealType from startTime if not provided
   *  - Loads the user's HealthProfile to compute smart macro targets
   *  - Creates a corresponding ScheduledMeal record
   *  - Stores scheduledMealId in the block metadata
   */
  static async createBlock(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        type, startTime, endTime, label,
        routineDate, isRecurring, daysOfWeek,
        mealType, caloricTarget, waterMl, metadata,
      } = req.body as {
        type: BlockType; startTime: string; endTime: string; label: string;
        routineDate?: string; isRecurring?: boolean; daysOfWeek?: number[];
        mealType?: string; caloricTarget?: number; waterMl?: number;
        metadata?: Record<string, unknown>;
      };

      if (!type || !startTime || !endTime || !label) {
        res.status(400).json({ message: "Campos obrigatórios: type, startTime, endTime, label." });
        return;
      }

      const recurring = isRecurring === true && Array.isArray(daysOfWeek) && daysOfWeek.length > 0;
      const effectiveDate = recurring ? undefined : (routineDate ?? new Date().toISOString().slice(0, 10));
      const blockMeta: Record<string, unknown> = { ...(metadata ?? {}) };

      // ── Meal block: auto-create ScheduledMeal with smart macros ────────────
      let resolvedMealType = mealType as MealType | undefined;
      let resolvedCaloricTarget = caloricTarget;

      if (type === BlockType.MEAL) {
        // Infer meal type from time slot if not explicitly provided
        if (!resolvedMealType) {
          resolvedMealType = inferMealType(startTime);
        }

        // Load profile to compute macro distribution
        let mealKcal = resolvedCaloricTarget ?? 0;
        let mealProtein = 0;
        let mealCarbs = 0;
        let mealFat = 0;

        try {
          const profile = await profileRepo().findOne({
            where: { userId: req.userId },
            relations: ["exercises"],
          });

          if (profile) {
            const dayOfWeek = effectiveDate
              ? new Date(effectiveDate + "T12:00:00").getDay()
              : new Date().getDay();

            const exerciseInputs = (profile.exercises ?? [])
              .filter(ex => ex.daysOfWeek.includes(dayOfWeek))
              .map(ex => ({
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
              profile.primaryGoal,
              profile.targetWeight ? Number(profile.targetWeight) : undefined
            );

            const dailyCal = profile.caloricGoal ? Number(profile.caloricGoal) : metabolic.dailyCaloricTarget;
            const share = MEAL_KCAL_SHARE[resolvedMealType] ?? 0.15;

            // Only compute if user didn't provide an explicit caloric target
            if (!resolvedCaloricTarget) {
              mealKcal = Math.round(dailyCal * share);
              resolvedCaloricTarget = mealKcal;
            }

            // Distribute macros proportionally using the same share
            mealProtein = Math.round(metabolic.macros.proteinG * share);
            mealCarbs   = Math.round(metabolic.macros.carbsG * share);
            mealFat     = Math.round(metabolic.macros.fatG * share);
          }
        } catch {
          // Profile fetch failed — keep zero macros; meal still gets created
        }

        // Create the ScheduledMeal record
        const meal = mealRepo().create({
          userId: req.userId,
          scheduledDate: effectiveDate ?? undefined,
          name: label,
          scheduledTime: startTime,
          caloricTarget: resolvedCaloricTarget || undefined,
          proteinG:      mealProtein || undefined,
          carbsG:        mealCarbs || undefined,
          fatG:          mealFat || undefined,
          isRecurring:   recurring,
          daysOfWeek:    recurring ? daysOfWeek! : [],
          isConsumed:    false,
          xpAwarded:     false,
        });

        const savedMeal = await mealRepo().save(meal);
        blockMeta.scheduledMealId = savedMeal.id;
      }

      // ── Create the RoutineBlock ────────────────────────────────────────────
      const block = routineRepo().create({
        userId: req.userId,
        type,
        startTime,
        endTime,
        label,
        routineDate: effectiveDate,
        isRecurring: recurring,
        daysOfWeek: recurring ? daysOfWeek! : [],
        mealType: resolvedMealType as any,
        caloricTarget: resolvedCaloricTarget,
        waterMl,
        metadata: Object.keys(blockMeta).length > 0 ? blockMeta : undefined,
        sortOrder: timeToMinutes(startTime),
      });

      const saved = await routineRepo().save(block);
      res.status(201).json(saved);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /routine/blocks/:id
   * Updates an existing routine block.
   */
  static async updateBlock(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const block = await routineRepo().findOneBy({
        id: req.params["id"]!,
        userId: req.userId,
      });

      if (!block) {
        res.status(404).json({ message: "Bloco não encontrado." });
        return;
      }

      const {
        type, startTime, endTime, label,
        routineDate, isRecurring, daysOfWeek,
        mealType, caloricTarget, waterMl, metadata,
      } = req.body as Partial<{
        type: BlockType; startTime: string; endTime: string; label: string;
        routineDate: string; isRecurring: boolean; daysOfWeek: number[];
        mealType: string; caloricTarget: number; waterMl: number;
        metadata: Record<string, unknown>;
      }>;

      if (type !== undefined) block.type = type;
      if (startTime !== undefined) { block.startTime = startTime; block.sortOrder = timeToMinutes(startTime); }
      if (endTime !== undefined) block.endTime = endTime;
      if (label !== undefined) block.label = label;
      if (mealType !== undefined) block.mealType = mealType as any;
      if (caloricTarget !== undefined) block.caloricTarget = caloricTarget;
      if (waterMl !== undefined) block.waterMl = waterMl;
      if (metadata !== undefined) block.metadata = metadata;

      if (isRecurring !== undefined) {
        const recurring = isRecurring && Array.isArray(daysOfWeek) && daysOfWeek.length > 0;
        block.isRecurring = recurring;
        block.daysOfWeek = recurring ? daysOfWeek! : [];
        if (recurring) block.routineDate = undefined as any;
        else if (routineDate) block.routineDate = routineDate;
      } else if (routineDate !== undefined) {
        block.routineDate = routineDate;
      }

      const saved = await routineRepo().save(block);
      res.json(saved);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /routine/blocks/:id
   * Deletes a routine block.
   */
  static async deleteBlock(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Load the block first to check for linked ScheduledMeal
      const block = await routineRepo().findOneBy({
        id: req.params["id"]!,
        userId: req.userId,
      });

      if (!block) {
        res.status(404).json({ message: "Bloco não encontrado." });
        return;
      }

      // If this is a meal block with a linked ScheduledMeal, delete it too
      const linkedMealId = (block.metadata as any)?.scheduledMealId;
      if (block.type === BlockType.MEAL && linkedMealId) {
        await mealRepo().delete({ id: linkedMealId, userId: req.userId });
      }

      await routineRepo().delete({ id: block.id, userId: req.userId });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }

  // ── Feedback / Copilot ───────────────────────────────────────────────────────

  /**
   * GET /routine/feedback?date=YYYY-MM-DD
   * Analyzes the user's scheduled day and returns smart tips/warnings
   * based on their HealthProfile goals.
   */
  static async feedback(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const date = (req.query["date"] as string) ?? new Date().toISOString().slice(0, 10);
      const dayOfWeek = new Date(`${date}T12:00:00`).getDay();

      // Load profile + day's blocks + day's meals in parallel
      const [profile, blocks, meals] = await Promise.all([
        profileRepo().findOne({ where: { userId: req.userId }, relations: ["exercises"] }),
        routineRepo()
          .createQueryBuilder("b")
          .where("b.user_id = :userId", { userId: req.userId })
          .andWhere(
            `((b.is_recurring = false AND b.routine_date = :date) OR (b.is_recurring = true AND b.days_of_week @> :dow::jsonb))`,
            { date, dow: JSON.stringify([dayOfWeek]) }
          )
          .getMany(),
        mealRepo()
          .createQueryBuilder("m")
          .where("m.user_id = :userId", { userId: req.userId })
          .andWhere(
            `((m.is_recurring = false AND m.scheduled_date = :date) OR (m.is_recurring = true AND m.days_of_week @> :dow::jsonb))`,
            { date, dow: JSON.stringify([dayOfWeek]) }
          )
          .getMany(),
      ]);

      interface FeedbackItem {
        type: "warning" | "success" | "tip" | "checklist";
        icon: string;
        title: string;
        message: string;
        done?: boolean;
      }
      const feedback: FeedbackItem[] = [];

      // ── Compute targets from profile ─────────────────────────────────────
      let caloricGoal = 2000;
      let proteinGoal = 150;

      if (profile) {
        try {
          const exerciseInputs = (profile.exercises ?? [])
            .filter(ex => ex.daysOfWeek.includes(dayOfWeek))
            .map(ex => ({
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
            profile.primaryGoal,
            profile.targetWeight ? Number(profile.targetWeight) : undefined
          );

          caloricGoal = profile.caloricGoal ? Number(profile.caloricGoal) : metabolic.dailyCaloricTarget;
          proteinGoal = metabolic.macros.proteinG;
        } catch {
          // keep defaults
        }
      }

      // ── 1. Sleep check ───────────────────────────────────────────────────
      const sleepBlocks = blocks.filter(b => b.type === BlockType.SLEEP);
      const sleepMinutes = sleepBlocks.reduce((sum, b) => {
        const s = timeToMinutes(b.startTime);
        let e = timeToMinutes(b.endTime);
        if (e < s) e += 24 * 60;
        return sum + (e - s);
      }, 0);
      const sleepHours = Math.round(sleepMinutes / 60 * 10) / 10;

      if (sleepBlocks.length === 0) {
        feedback.push({
          type: "checklist",
          icon: "bed",
          title: "Agendar horário de sono",
          message: "Recomendamos 7-8h de sono. Nenhum bloco de sono encontrado.",
          done: false,
        });
      } else if (sleepHours < 6) {
        feedback.push({
          type: "warning",
          icon: "alert-triangle",
          title: `Apenas ${sleepHours}h de sono agendadas`,
          message: `Você agendou apenas ${sleepHours}h de sono. A recomendação mínima é de 7h para recuperação adequada.`,
        });
      } else {
        feedback.push({
          type: "checklist",
          icon: "bed",
          title: `Sono: ${sleepHours}h agendadas`,
          message: "Dentro da faixa recomendada.",
          done: true,
        });
      }

      // ── 2. Exercise check ────────────────────────────────────────────────
      const exerciseBlocks = blocks.filter(b => b.type === BlockType.EXERCISE);
      if (exerciseBlocks.length === 0) {
        feedback.push({
          type: "checklist",
          icon: "dumbbell",
          title: "Adicionar exercício",
          message: "Nenhum bloco de exercício encontrado na sua agenda de hoje.",
          done: false,
        });
      } else {
        const totalExMin = exerciseBlocks.reduce((sum, b) => {
          return sum + (timeToMinutes(b.endTime) - timeToMinutes(b.startTime));
        }, 0);
        feedback.push({
          type: "checklist",
          icon: "dumbbell",
          title: `Exercício: ${totalExMin} min agendados`,
          message: `${exerciseBlocks.length} bloco(s) de exercício.`,
          done: true,
        });
      }

      // ── 3. Caloric check ─────────────────────────────────────────────────
      const scheduledKcal = meals.reduce((sum, m) => sum + (Number(m.caloricTarget) || 0), 0);
      const mealBlockKcal = blocks
        .filter(b => b.type === BlockType.MEAL)
        .reduce((sum, b) => sum + (Number(b.caloricTarget) || 0), 0);
      const totalKcal = Math.max(scheduledKcal, mealBlockKcal);
      const kcalDiff = caloricGoal - totalKcal;

      if (totalKcal === 0) {
        feedback.push({
          type: "checklist",
          icon: "utensils",
          title: "Distribuir refeições",
          message: `Meta: ${Math.round(caloricGoal)} kcal. Nenhuma refeição agendada ainda.`,
          done: false,
        });
      } else if (kcalDiff > 200) {
        feedback.push({
          type: "warning",
          icon: "utensils",
          title: `Faltam ${Math.round(kcalDiff)} kcal`,
          message: `Agendadas ${Math.round(totalKcal)} kcal de ${Math.round(caloricGoal)} kcal da sua meta diária.`,
        });
      } else if (kcalDiff < -200) {
        feedback.push({
          type: "warning",
          icon: "utensils",
          title: `${Math.round(Math.abs(kcalDiff))} kcal acima da meta`,
          message: `Agendadas ${Math.round(totalKcal)} kcal, ${Math.round(Math.abs(kcalDiff))} acima da sua meta de ${Math.round(caloricGoal)} kcal.`,
        });
      } else {
        feedback.push({
          type: "checklist",
          icon: "utensils",
          title: `Calorias: ${Math.round(totalKcal)} / ${Math.round(caloricGoal)} kcal`,
          message: "Dentro da meta. Boa distribuição!",
          done: true,
        });
      }

      // ── 4. Water check ───────────────────────────────────────────────────
      const waterBlocks = blocks.filter(b => b.type === BlockType.WATER);
      const waterMl = waterBlocks.reduce((sum, b) => sum + (Number(b.waterMl) || 0), 0);
      const waterGoal = profile ? Number(profile.weight) * 35 : 2500;

      if (waterBlocks.length === 0) {
        feedback.push({
          type: "checklist",
          icon: "droplet",
          title: "Adicionar lembretes de água",
          message: `Meta: ${Math.round(waterGoal)} ml. Nenhum lembrete de água agendado.`,
          done: false,
        });
      } else if (waterMl < waterGoal * 0.8) {
        feedback.push({
          type: "tip",
          icon: "droplet",
          title: `Água: ${Math.round(waterMl)} / ${Math.round(waterGoal)} ml`,
          message: `Faltam ${Math.round(waterGoal - waterMl)} ml para bater a meta de hidratação.`,
        });
      } else {
        feedback.push({
          type: "checklist",
          icon: "droplet",
          title: `Água: ${Math.round(waterMl)} ml agendados`,
          message: "Meta de hidratação atingida.",
          done: true,
        });
      }

      // ── 5. Protein check ─────────────────────────────────────────────────
      const scheduledProtein = meals.reduce((sum, m) => sum + (Number(m.proteinG) || 0), 0);
      if (scheduledProtein > 0 && scheduledProtein < proteinGoal * 0.8) {
        feedback.push({
          type: "tip",
          icon: "egg",
          title: `Proteína: ${Math.round(scheduledProtein)}g / ${Math.round(proteinGoal)}g`,
          message: `Faltam ${Math.round(proteinGoal - scheduledProtein)}g de proteína para atingir a meta.`,
        });
      }

      // ── Summary score ────────────────────────────────────────────────────
      const totalChecks = feedback.filter(f => f.type === "checklist").length;
      const doneChecks = feedback.filter(f => f.type === "checklist" && f.done).length;

      res.json({
        date,
        goals: { caloricGoal: Math.round(caloricGoal), proteinGoal: Math.round(proteinGoal), waterGoal: Math.round(waterGoal) },
        scheduled: { kcal: Math.round(totalKcal), proteinG: Math.round(scheduledProtein), waterMl: Math.round(waterMl), sleepHours },
        completeness: totalChecks > 0 ? Math.round((doneChecks / totalChecks) * 100) : 0,
        feedback,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /routine/blocks/:id/complete
   * Toggles completedAt (complete ↔ undo).
   *
   * XP is awarded on first completion ONLY when:
   *  1. routineDate === today          (anti-backdating)
   *  2. Current time within window     (anti-preemptive completion)
   *  3. Daily XP cap not yet reached   (anti-farming)
   *
   * The block is still marked as done even when XP is denied (soft rejection).
   * Returns { block, xpGained, totalXp, level, capReached, outOfWindow, message }
   */
  static async completeBlock(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const block = await routineRepo().findOneBy({
        id: req.params["id"]!,
        userId: req.userId,
      });

      if (!block) {
        res.status(404).json({ message: "Bloco não encontrado." });
        return;
      }

      // ── Hard reject: cannot complete blocks from other days ───────────────
      const today = new Date().toISOString().slice(0, 10);
      if (!block.isRecurring && block.routineDate !== today) {
        res.status(409).json({
          message: "Somente blocos do dia atual podem ser concluídos.",
        });
        return;
      }

      const isUndoing = !!block.completedAt;

      // ── Sun exposure: only allow before 10h or after 16h ────────────────
      if (!isUndoing && block.type === BlockType.SUN_EXPOSURE) {
        const currentHour = new Date().getHours();
        if (currentHour >= 10 && currentHour < 16) {
          res.status(409).json({
            message: "Exposição solar só pode ser registrada antes das 10h ou após as 16h para proteger sua saúde.",
          });
          return;
        }
      }

      block.completedAt = isUndoing ? undefined : new Date();

      const XP_FOR_TYPE: Partial<Record<BlockType, number>> = {
        [BlockType.EXERCISE]:     XP_REWARDS.BLOCK_EXERCISE,
        [BlockType.WATER]:        XP_REWARDS.BLOCK_WATER,
        [BlockType.SUN_EXPOSURE]: XP_REWARDS.BLOCK_SUN_EXPOSURE,
        [BlockType.SLEEP]:        XP_REWARDS.BLOCK_SLEEP,
        [BlockType.WORK]:         XP_REWARDS.BLOCK_WORK,
        [BlockType.FREE]:         XP_REWARDS.BLOCK_FREE,
        [BlockType.CUSTOM]:       XP_REWARDS.BLOCK_CUSTOM,
      };

      let xpGained    = 0;
      let totalXp     = 0;
      let capReached  = false;
      let outOfWindow = false;
      let message: string | undefined;

      if (!isUndoing && !block.xpAwarded) {
        // ── Time-window check ──────────────────────────────────────────────
        const window = checkTimeWindow(block);
        outOfWindow  = window.outOfWindow;

        if (!window.allowed) {
          // Hard reject returned only for the "other day" case above, so this
          // branch currently is unreachable, but kept for safety.
          res.status(409).json({ message: window.reason });
          return;
        }

        if (!outOfWindow) {
          // ── Water XP gate: require 70% of daily water goal ─────────────
          if (block.type === BlockType.WATER) {
            const profile = await profileRepo().findOne({ where: { userId: req.userId } });
            const waterGoalMl = profile ? Number(profile.weight) * 35 : 2500;
            const { totalMl } = await WaterService.getDay(req.userId, today);
            const waterPct = totalMl / waterGoalMl;

            if (waterPct < 0.70) {
              message = `XP de agua liberado apenas ao atingir 70% da meta diaria (${Math.round(waterPct * 100)}% atual). Continue bebendo!`;
              // Block marked done but no XP
              await routineRepo().save(block);
              if (totalXp === 0) totalXp = await GamificationService.getXp(req.userId);
              const level = GamificationService.levelFromXp(totalXp);
              res.json({ block, xpGained: 0, totalXp, level, capReached: false, outOfWindow: false, message });
              return;
            }
          }

          // ── Daily cap check ──────────────────────────────────────────────
          const category = block.type as string; // e.g. "exercise"
          const remaining = await GamificationService.remainingDailyXp(
            req.userId, today, category
          );

          if (remaining <= 0) {
            capReached = true;
            message    = `Limite diário de XP para '${block.type}' atingido. Tente novamente amanhã!`;
          } else {
            const reward = Math.min(XP_FOR_TYPE[block.type] ?? 5, remaining);
            totalXp      = await GamificationService.awardXp(
              req.userId, reward, category, block.id
            );
            xpGained      = reward;
            block.xpAwarded = true;
          }
        } else {
          message = window.reason;
        }
      }

      if (totalXp === 0) {
        totalXp = await GamificationService.getXp(req.userId);
      }

      await routineRepo().save(block);

      // ── Optional social photo (only on first completion, not undo) ────────
      let postId: string | undefined;
      let photoBonusXp = 0;

      if (!isUndoing) {
        // ── Auto-complete daily missions ─────────────────────────────────────
        if (block.type === BlockType.EXERCISE) {
          DailyMissionService.checkAndComplete(req.userId, MissionType.ACTIVITY).catch(() => {});
        } else if (block.type === BlockType.SLEEP) {
          DailyMissionService.checkAndComplete(req.userId, MissionType.SLEEP_BLOCK).catch(() => {});
        }

        // ── Challenge auto-progress ──────────────────────────────────────────
        const challengeXp = await ChallengeService.handleBlockCompleted(req.userId, block.type);
        if (challengeXp > 0) {
          totalXp   = await GamificationService.getXp(req.userId);
          xpGained += challengeXp;
        }

        const { photoDataUrl, caption, sharePublic } = req.body as {
          photoDataUrl?: string;
          caption?: string;
          sharePublic?: boolean;
        };

        if (photoDataUrl?.startsWith("data:image/")) {
          const { post, photoVerified } = await createBlockPost({
            userId:           req.userId,
            blockId:          block.id,
            blockType:        block.type,
            photoDataUrl,
            caption,
            isPublic:         sharePublic !== false,
            blockStartTime:   block.startTime,
            blockRoutineDate: block.routineDate,
          });
          postId = post.id;

          // Award photo bonus XP (not subject to per-category daily cap)
          const bonus = XP_REWARDS.BLOCK_PHOTO;
          totalXp      = await GamificationService.awardXp(req.userId, bonus, "social", post.id);
          photoBonusXp = bonus;
          xpGained    += bonus;
          // Attach verification result to response
          (block as unknown as Record<string, unknown>)["photoVerified"] = photoVerified;
        }
      }

      const level = GamificationService.levelFromXp(totalXp);
      res.json({ block, xpGained, totalXp, level, capReached, outOfWindow, message, postId, photoBonusXp });
    } catch (err) {
      next(err);
    }
  }
}
