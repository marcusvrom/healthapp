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
import { GamificationService, XP_REWARDS } from "../services/GamificationService";
import { createBlockPost } from "./SocialController";
import { ChallengeService } from "../services/ChallengeService";
import { ExerciseCalcInput } from "../types/calculation.types";

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
function checkTimeWindow(block: { routineDate: string; startTime: string; endTime: string }): {
  allowed:     boolean;
  outOfWindow: boolean;
  reason?:     string;
} {
  const today = new Date().toISOString().slice(0, 10);

  if (block.routineDate !== today) {
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
        profile.primaryGoal,
        profile.targetWeight ? Number(profile.targetWeight) : undefined
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
      if (block.routineDate !== today) {
        res.status(409).json({
          message: "Somente blocos do dia atual podem ser concluídos.",
        });
        return;
      }

      const isUndoing = !!block.completedAt;
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
