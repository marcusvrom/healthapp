import { AppDataSource } from "../config/typeorm.config";
import { RoutineBlock, BlockType, MealType } from "../entities/RoutineBlock";
import { ScheduledMeal } from "../entities/ScheduledMeal";
import { HealthProfile } from "../entities/HealthProfile";
import { Exercise } from "../entities/Exercise";
import { WorkoutSheet } from "../entities/WorkoutSheet";
import { WorkoutSheetExercise } from "../entities/WorkoutSheetExercise";
import { CalculationService } from "./CalculationService";
import { ExerciseCalcInput } from "../types/calculation.types";

// ── Helpers ─────────────────────────────────────────────────────────────────

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesToTime(mins: number): string {
  const wrapped = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Kcal share per meal type (same as RoutineController) */
const MEAL_KCAL_SHARE: Record<string, number> = {
  breakfast:       0.20,
  morning_snack:   0.10,
  lunch:           0.30,
  afternoon_snack: 0.10,
  dinner:          0.25,
  supper:          0.05,
};

/** Display labels for meals */
const MEAL_LABELS: Record<string, string> = {
  breakfast:       "Café da Manhã",
  morning_snack:   "Lanche da Manhã",
  lunch:           "Almoço",
  afternoon_snack: "Lanche da Tarde",
  dinner:          "Jantar",
  supper:          "Ceia",
};

/** MealType enum mapping */
const MEAL_TYPE_MAP: Record<string, MealType> = {
  breakfast:       MealType.BREAKFAST,
  morning_snack:   MealType.MORNING_SNACK,
  lunch:           MealType.LUNCH,
  afternoon_snack: MealType.AFTERNOON_SNACK,
  dinner:          MealType.DINNER,
  supper:          MealType.SUPPER,
};

export interface OnboardingExerciseDto {
  name:     string;
  category: string;
  sets?:    number;
  reps?:    string;
}

export interface CompleteOnboardingDto {
  wakeUpTime:         string;   // HH:MM
  sleepTime:          string;   // HH:MM
  preferredTrainTime: string;   // HH:MM
  meals:              string[]; // e.g. ["breakfast", "lunch", "dinner"]
  waterReminders?:    boolean;  // whether to create recurring water blocks
  waterIntervalMin?:  number;   // interval between reminders in minutes (default 45)
  exercises?:         OnboardingExerciseDto[];  // selected exercises to auto-create a workout sheet
  exerciseDaysOfWeek?: number[];                // days for the workout sheet (default [1,3,5])
  exerciseDurationMin?: number;                 // estimated duration in minutes (default 60)
}

export class OnboardingService {
  private static get blockRepo()  { return AppDataSource.getRepository(RoutineBlock); }
  private static get mealRepo()   { return AppDataSource.getRepository(ScheduledMeal); }
  private static get profileRepo(){ return AppDataSource.getRepository(HealthProfile); }
  private static get exerciseRepo(){ return AppDataSource.getRepository(Exercise); }

  /**
   * Generates a recurring base routine for a user based on their onboarding inputs.
   * Creates:
   *   - Sleep block(s)
   *   - Activity block (work/study) if applicable
   *   - Exercise/training block
   *   - ScheduledMeal + MEAL RoutineBlock for each selected meal
   */
  static async completeOnboarding(
    userId: string,
    dto: CompleteOnboardingDto
  ): Promise<void> {
    const profile = await this.profileRepo.findOne({
      where: { userId },
      relations: ["exercises"],
    });
    if (!profile) throw Object.assign(new Error("Perfil não encontrado."), { status: 404 });

    const allDays = [0, 1, 2, 3, 4, 5, 6]; // Sun through Sat

    const blocks: Partial<RoutineBlock>[] = [];
    const meals: Partial<ScheduledMeal>[] = [];
    const mealBlockLinks: Array<{ blockIndex: number; name: string; scheduledTime: string }> = [];

    // ── 1. Sleep block ────────────────────────────────────────────────────
    const sleepMin = timeToMinutes(dto.sleepTime);
    const wakeMin  = timeToMinutes(dto.wakeUpTime);

    if (sleepMin > wakeMin) {
      // Sleep spans midnight (e.g., 23:00 → 07:00) — single block
      blocks.push({
        userId, type: BlockType.SLEEP, isRecurring: true, daysOfWeek: allDays,
        startTime: dto.sleepTime, endTime: dto.wakeUpTime,
        label: "Sono", sortOrder: 0,
      });
    } else {
      // Sleep doesn't span midnight (rare, e.g., 01:00 → 07:00) — still one block
      blocks.push({
        userId, type: BlockType.SLEEP, isRecurring: true, daysOfWeek: allDays,
        startTime: dto.sleepTime, endTime: dto.wakeUpTime,
        label: "Sono", sortOrder: 0,
      });
    }

    // ── 2. Activity block (work/study) ────────────────────────────────────
    if (profile.mainActivity && profile.mainActivity !== "flexible" && profile.workStartTime && profile.workEndTime) {
      const labelMap: Record<string, string> = {
        work:  "Trabalho",
        study: "Estudos",
        mixed: "Trabalho + Estudos",
      };
      const typeMap: Record<string, BlockType> = {
        work:  BlockType.WORK,
        study: BlockType.STUDY,
        mixed: BlockType.WORK,
      };

      blocks.push({
        userId,
        type: typeMap[profile.mainActivity] ?? BlockType.WORK,
        isRecurring: true,
        daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri by default
        startTime: profile.workStartTime,
        endTime: profile.workEndTime,
        label: labelMap[profile.mainActivity] ?? "Atividade",
        sortOrder: 10,
      });
    }

    // ── 3. Exercise/training block ────────────────────────────────────────
    const trainDuration = (profile.exercises ?? []).length > 0
      ? Math.max(...(profile.exercises ?? []).map(e => e.durationMinutes), 60)
      : 60;
    const trainStart = timeToMinutes(dto.preferredTrainTime);
    const trainEnd   = trainStart + trainDuration;

    // Use exercise daysOfWeek from the first exercise if available, else Mon/Wed/Fri
    const exerciseDays = (profile.exercises ?? []).length > 0
      ? (profile.exercises![0]!.daysOfWeek ?? [1, 3, 5])
      : [1, 3, 5];

    blocks.push({
      userId, type: BlockType.EXERCISE, isRecurring: true,
      daysOfWeek: exerciseDays,
      startTime: dto.preferredTrainTime,
      endTime: minutesToTime(trainEnd),
      label: "Treino",
      sortOrder: 20,
    });

    // ── 4. Meal blocks + ScheduledMeals ───────────────────────────────────
    // Compute metabolic results for macro targets
    const exercises: ExerciseCalcInput[] = (profile.exercises ?? []).map(ex => ({
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

    const dailyCal  = metabolic.dailyCaloricTarget;
    const macros    = metabolic.macros;

    // Normalize shares for selected meals so they sum to 1
    const selectedMeals = dto.meals.filter(m => MEAL_KCAL_SHARE[m] !== undefined);
    const rawShareSum   = selectedMeals.reduce((sum, m) => sum + (MEAL_KCAL_SHARE[m] ?? 0), 0);
    const normalizer    = rawShareSum > 0 ? 1 / rawShareSum : 1;

    // Smart time distribution: spread meals between wake-up and sleep
    const awakeMins   = ((wakeMin < sleepMin ? sleepMin : sleepMin + 1440) - wakeMin);
    const mealGap     = selectedMeals.length > 1
      ? Math.floor(awakeMins / (selectedMeals.length + 1))
      : Math.floor(awakeMins / 2);

    // Default meal times (used if available, else computed)
    const DEFAULT_TIMES: Record<string, number> = {
      breakfast: wakeMin + 30,
      morning_snack: wakeMin + Math.floor(awakeMins * 0.25),
      lunch: wakeMin + Math.floor(awakeMins * 0.42),
      afternoon_snack: wakeMin + Math.floor(awakeMins * 0.58),
      dinner: wakeMin + Math.floor(awakeMins * 0.75),
      supper: wakeMin + Math.floor(awakeMins * 0.88),
    };

    let sortOrder = 30;
    for (const mealKey of selectedMeals) {
      const share    = (MEAL_KCAL_SHARE[mealKey] ?? 0.1) * normalizer;
      const mealCal  = Math.round(dailyCal * share);
      const proteinG = Math.round(macros.proteinG * share);
      const carbsG   = Math.round(macros.carbsG * share);
      const fatG     = Math.round(macros.fatG * share);

      const mealTime = minutesToTime(DEFAULT_TIMES[mealKey] ?? (wakeMin + sortOrder * 10));
      const mealEnd  = minutesToTime((DEFAULT_TIMES[mealKey] ?? (wakeMin + sortOrder * 10)) + 30);

      meals.push({
        userId,
        isRecurring: true,
        daysOfWeek: allDays,
        name: MEAL_LABELS[mealKey] ?? mealKey,
        scheduledTime: mealTime,
        caloricTarget: mealCal,
        proteinG, carbsG, fatG,
      });

      const blockIndex = blocks.length;
      blocks.push({
        userId, type: BlockType.MEAL, isRecurring: true,
        daysOfWeek: allDays,
        startTime: mealTime,
        endTime: mealEnd,
        label: MEAL_LABELS[mealKey] ?? mealKey,
        mealType: MEAL_TYPE_MAP[mealKey],
        caloricTarget: mealCal,
        sortOrder: sortOrder++,
        metadata: { mealKey },
      });

      mealBlockLinks.push({
        blockIndex,
        name: MEAL_LABELS[mealKey] ?? mealKey,
        scheduledTime: mealTime,
      });
    }

    // ── 5. Water reminder blocks ────────────────────────────────────────
    if (dto.waterReminders) {
      const intervalMin = dto.waterIntervalMin ?? 45;
      const waterTotal  = metabolic.waterMlTotal;

      // First reminder: 15 min after wake-up; last: 60 min before sleep
      const firstReminder = wakeMin + 15;
      const lastReminder  = sleepMin > wakeMin
        ? sleepMin - 60
        : (sleepMin + 1440) - 60; // handle sleep past midnight

      const reminders: number[] = [];
      for (let t = firstReminder; t <= lastReminder; t += intervalMin) {
        reminders.push(t);
      }

      // Distribute total water evenly across reminders
      const mlPerReminder = reminders.length > 0
        ? Math.round(waterTotal / reminders.length)
        : 0;

      let waterSortOrder = 100;
      for (const reminderMin of reminders) {
        const start = minutesToTime(reminderMin);
        const end   = minutesToTime(reminderMin + 5); // 5-min block

        blocks.push({
          userId,
          type: BlockType.WATER,
          isRecurring: true,
          daysOfWeek: allDays,
          startTime: start,
          endTime: end,
          label: `Água (${mlPerReminder} ml)`,
          waterMl: mlPerReminder,
          sortOrder: waterSortOrder++,
        });
      }
    }

    // ── 6. Auto-create workout sheet from onboarding exercises ──────────
    let workoutSheet: WorkoutSheet | null = null;
    const sheetExercises: Partial<WorkoutSheetExercise>[] = [];

    if (dto.exercises && dto.exercises.length > 0) {
      const sheetDays = dto.exerciseDaysOfWeek ?? exerciseDays;
      const sheetDuration = dto.exerciseDurationMin ?? trainDuration;

      workoutSheet = new WorkoutSheet();
      workoutSheet.userId = userId;
      workoutSheet.name = "Meu Treino";
      workoutSheet.description = "Ficha criada automaticamente durante o onboarding";
      workoutSheet.category = dto.exercises[0]?.category ?? "strength";
      workoutSheet.daysOfWeek = sheetDays;
      workoutSheet.estimatedMinutes = sheetDuration;
      workoutSheet.isActive = true;
      workoutSheet.fromTemplate = "onboarding";

      for (let i = 0; i < dto.exercises.length; i++) {
        const ex = dto.exercises[i]!;
        sheetExercises.push({
          name: ex.name,
          sets: ex.sets ?? 3,
          reps: ex.reps ?? "8-12",
          restSeconds: 60,
          sortOrder: i,
        });
      }
    }

    // ── Save all in a transaction ─────────────────────────────────────────
    await AppDataSource.transaction(async manager => {
      // Save workout sheet first so we can link it to the exercise block
      if (workoutSheet) {
        const savedSheet = await manager.getRepository(WorkoutSheet).save(workoutSheet);

        // Save sheet exercises
        if (sheetExercises.length > 0) {
          const exerciseEntities = sheetExercises.map(e => {
            const entity = manager.getRepository(WorkoutSheetExercise).create(e);
            entity.sheetId = savedSheet.id;
            return entity;
          });
          await manager.getRepository(WorkoutSheetExercise).save(exerciseEntities);
        }

        // Link the exercise block to the workout sheet via metadata
        const exerciseBlock = blocks.find(b => b.type === BlockType.EXERCISE);
        if (exerciseBlock) {
          exerciseBlock.metadata = {
            workoutSheetId: savedSheet.id,
            exercises: sheetExercises.map(e => ({ name: e.name, sets: e.sets, reps: e.reps, restSeconds: (e.restSeconds as number | undefined) ?? 60 })),
          };
        }
      }

      if (meals.length > 0) {
        const savedMeals = await manager.getRepository(ScheduledMeal).save(
          meals.map(m => manager.getRepository(ScheduledMeal).create(m))
        );

        // Link each meal routine block to the corresponding ScheduledMeal.
        // This avoids rendering duplicates in the dashboard (real block + synthetic block).
        const mealIdByKey = new Map<string, string>();
        for (const m of savedMeals) {
          mealIdByKey.set(`${m.name}::${m.scheduledTime}`, m.id);
        }
        for (const link of mealBlockLinks) {
          const scheduledMealId = mealIdByKey.get(`${link.name}::${link.scheduledTime}`);
          if (!scheduledMealId) continue;

          const block = blocks[link.blockIndex];
          if (!block) continue;

          block.metadata = {
            ...(block.metadata ?? {}),
            scheduledMealId,
          };
        }
      }
      if (blocks.length > 0) {
        await manager.getRepository(RoutineBlock).save(
          blocks.map(b => manager.getRepository(RoutineBlock).create(b))
        );
      }
    });
  }
}
