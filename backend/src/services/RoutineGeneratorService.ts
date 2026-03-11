import { BlockType, MealType, RoutineBlock } from "../entities/RoutineBlock";
import { HealthProfile } from "../entities/HealthProfile";
import { Exercise } from "../entities/Exercise";
import { ClinicalProtocol } from "../entities/ClinicalProtocol";
import { CalculationService } from "./CalculationService";
import { WaterReminder } from "../types/calculation.types";

interface GenerateRoutineInput {
  healthProfile: HealthProfile;
  exercises: Exercise[];            // today's exercises
  clinicalProtocols?: ClinicalProtocol[]; // today's medication/supplement protocols
  date: string;                // YYYY-MM-DD
  totalKcal: number;           // from MetabolicResult
  waterMlTotal: number;        // from MetabolicResult
  requiresSunExposureBlock: boolean;
  prioritiseAerobic: boolean;
}

/**
 * RoutineGeneratorService
 * ───────────────────────
 * @deprecated This service is deprecated as part of the Canvas Pivot.
 * The app no longer auto-generates routines. Users now create their own
 * blocks via the Canvas UI. This service is kept for reference but should
 * NOT be called from new code. Use the CRUD endpoints on RoutineController
 * instead.
 *
 * Previously built a time-blocked daily schedule for the user by:
 *  1. Locking SLEEP and WORK blocks
 *  2. Inserting EXERCISE blocks in free windows
 *  3. Placing SUN_EXPOSURE block if required by blood-test analysis
 *  4. Distributing MEAL blocks every 3–4 hours within the awake window
 *  5. Scattering WATER reminder blocks throughout the day
 */
export class RoutineGeneratorService {

  private static readonly MEAL_INTERVAL_MINUTES = 180; // 3 hours
  private static readonly MEAL_DURATION_MINUTES = 30;
  private static readonly PRE_WORKOUT_OFFSET_MINUTES = 90;  // 1.5 h before
  private static readonly POST_WORKOUT_DURATION_MINUTES = 30;
  private static readonly SUN_EXPOSURE_DURATION_MINUTES = 20;
  private static readonly SUN_EXPOSURE_PREFERRED_TIME = "11:00";

  /**
   * Generate an ordered list of RoutineBlock objects (not yet persisted).
   * The caller is responsible for saving them via the TypeORM repository.
   */
  static generate(input: GenerateRoutineInput): Omit<RoutineBlock, "id" | "createdAt" | "updatedAt" | "user">[] {
    const {
      healthProfile: hp,
      exercises,
      clinicalProtocols = [],
      date,
      totalKcal,
      waterMlTotal,
      requiresSunExposureBlock,
    } = input;

    const blocks: BlockSlot[] = [];

    // ── 1. Fixed blocks: sleep & work ─────────────────────────────────────
    blocks.push(...this.buildSleepBlocks(hp.sleepTime, hp.wakeUpTime, date));
    blocks.push(this.buildWorkBlock(hp.workStartTime, hp.workEndTime, date));

    // ── 2. Exercise blocks ─────────────────────────────────────────────────
    const exerciseBlockSlots = this.buildExerciseBlocks(exercises, hp, blocks, date);
    blocks.push(...exerciseBlockSlots);

    // ── 3. Sun exposure (injected when Vitamin D is low) ──────────────────
    if (requiresSunExposureBlock) {
      const sunSlot = this.buildSunExposureBlock(blocks, date);
      if (sunSlot) blocks.push(sunSlot);
    }

    // ── 4. Meal blocks ─────────────────────────────────────────────────────
    const mealBlocks = this.buildMealBlocks(
      hp.wakeUpTime,
      hp.sleepTime,
      exerciseBlockSlots,
      blocks,
      totalKcal,
      date
    );
    blocks.push(...mealBlocks);

    // ── 5. Clinical protocol (medication/supplement/hormone) blocks ────────
    blocks.push(...this.buildProtocolBlocks(clinicalProtocols, date));

    // ── 6. Water reminders ─────────────────────────────────────────────────
    const waterReminders = CalculationService.distributeWaterReminders(
      waterMlTotal,
      hp.wakeUpTime,
      hp.sleepTime
    );
    blocks.push(...this.buildWaterBlocks(waterReminders, date));

    // ── Sort by start time ─────────────────────────────────────────────────
    blocks.sort((a, b) =>
      CalculationService.timeToMinutes(a.startTime) -
      CalculationService.timeToMinutes(b.startTime)
    );

    return blocks.map((b, i) => ({
      ...b,
      userId: hp.userId,
      routineDate: date,
      sortOrder: i,
    }));
  }

  // ── Sleep ─────────────────────────────────────────────────────────────────

  /**
   * Sleep may span midnight, so we create two blocks when necessary:
   *  e.g. sleepTime=23:00 → wakeUpTime=07:00 becomes
   *    Block 1: 23:00–23:59 (night part)  and
   *    Block 2: 00:00–07:00 (morning part)
   */
  private static buildSleepBlocks(
    sleepTime: string,
    wakeUpTime: string,
    date: string
  ): BlockSlot[] {
    const sleepMin = CalculationService.timeToMinutes(sleepTime);
    const wakeMin = CalculationService.timeToMinutes(wakeUpTime);

    if (sleepMin < wakeMin) {
      // Normal same-day sleep window (edge case: naps, unusual schedule)
      return [this.slot(BlockType.SLEEP, sleepTime, wakeUpTime, "Sono", date)];
    }

    // Sleep crosses midnight
    return [
      this.slot(BlockType.SLEEP, sleepTime, "23:59", "Sono (início)", date),
      this.slot(BlockType.SLEEP, "00:00", wakeUpTime, "Sono (continuação)", date),
    ];
  }

  // ── Work ──────────────────────────────────────────────────────────────────

  private static buildWorkBlock(
    workStart: string,
    workEnd: string,
    date: string
  ): BlockSlot {
    return this.slot(BlockType.WORK, workStart, workEnd, "Trabalho", date);
  }

  // ── Exercise ──────────────────────────────────────────────────────────────

  private static buildExerciseBlocks(
    exercises: Exercise[],
    hp: HealthProfile,
    occupied: BlockSlot[],
    date: string
  ): BlockSlot[] {
    const result: BlockSlot[] = [];

    for (const ex of exercises) {
      const preferredStart = ex.preferredTime ?? this.findFreeWindow(
        hp.wakeUpTime,
        hp.sleepTime,
        ex.durationMinutes,
        [...occupied, ...result]
      );

      if (!preferredStart) continue;

      const startMin = CalculationService.timeToMinutes(preferredStart);
      const endMin = startMin + ex.durationMinutes;

      result.push(
        this.slot(
          BlockType.EXERCISE,
          preferredStart,
          CalculationService.minutesToTime(endMin),
          `Exercício: ${ex.name}`,
          date,
          { exerciseId: ex.id, met: ex.met, durationMinutes: ex.durationMinutes }
        )
      );
    }

    return result;
  }

  // ── Sun Exposure ──────────────────────────────────────────────────────────

  private static buildSunExposureBlock(
    occupied: BlockSlot[],
    date: string
  ): BlockSlot | null {
    const preferred = this.SUN_EXPOSURE_PREFERRED_TIME;
    const start = this.findFreeWindowAt(preferred, this.SUN_EXPOSURE_DURATION_MINUTES, occupied)
      ?? this.findFreeWindow("10:00", "14:00", this.SUN_EXPOSURE_DURATION_MINUTES, occupied);

    if (!start) return null;

    const endMin = CalculationService.timeToMinutes(start) + this.SUN_EXPOSURE_DURATION_MINUTES;
    return this.slot(
      BlockType.SUN_EXPOSURE,
      start,
      CalculationService.minutesToTime(endMin),
      "Exposição Solar (Vitamina D)",
      date
    );
  }

  // ── Meals ─────────────────────────────────────────────────────────────────

  private static buildMealBlocks(
    wakeUpTime: string,
    sleepTime: string,
    exerciseBlocks: BlockSlot[],
    allBlocks: BlockSlot[],
    totalKcal: number,
    date: string
  ): BlockSlot[] {
    const meals: BlockSlot[] = [];

    // Determine exercise windows to place pre/post workout meals
    const prePostMealMinutes = new Set<number>();

    for (const ex of exerciseBlocks) {
      const exStartMin = CalculationService.timeToMinutes(ex.startTime);
      const exEndMin = CalculationService.timeToMinutes(ex.endTime);

      // Pre-workout meal: 90 min before exercise
      const preMin = exStartMin - this.PRE_WORKOUT_OFFSET_MINUTES;
      if (preMin >= CalculationService.timeToMinutes(wakeUpTime)) {
        const preEnd = preMin + this.MEAL_DURATION_MINUTES;
        meals.push(
          this.slot(
            BlockType.MEAL,
            CalculationService.minutesToTime(preMin),
            CalculationService.minutesToTime(preEnd),
            "Pré-treino",
            date,
            { mealType: MealType.PRE_WORKOUT, caloricTarget: this.round2(totalKcal * 0.15) }
          )
        );
        prePostMealMinutes.add(preMin);
      }

      // Post-workout meal: immediately after exercise
      const postEnd = exEndMin + this.POST_WORKOUT_DURATION_MINUTES;
      meals.push(
        this.slot(
          BlockType.MEAL,
          CalculationService.minutesToTime(exEndMin),
          CalculationService.minutesToTime(postEnd),
          "Pós-treino",
          date,
          { mealType: MealType.POST_WORKOUT, caloricTarget: this.round2(totalKcal * 0.20) }
        )
      );
      prePostMealMinutes.add(exEndMin);
    }

    // Distribute remaining meals every MEAL_INTERVAL_MINUTES within awake window
    const wakeMin = CalculationService.timeToMinutes(wakeUpTime);
    const sleepMin = CalculationService.timeToMinutes(sleepTime);
    const mealOrder: MealType[] = [
      MealType.BREAKFAST,
      MealType.MORNING_SNACK,
      MealType.LUNCH,
      MealType.AFTERNOON_SNACK,
      MealType.DINNER,
      MealType.SUPPER,
    ];

    let mealIndex = 0;
    let cursor = wakeMin + 30; // First meal 30 min after waking up

    while (cursor < sleepMin && mealIndex < mealOrder.length) {
      // Skip if this slot overlaps a pre/post workout meal we already placed
      const overlaps = prePostMealMinutes.has(cursor) ||
        [...prePostMealMinutes].some(m => Math.abs(m - cursor) < this.MEAL_INTERVAL_MINUTES / 2);

      const mealType = mealOrder[mealIndex]!;

      if (!overlaps && !this.isOccupied(cursor, this.MEAL_DURATION_MINUTES, allBlocks)) {
        const endMin = cursor + this.MEAL_DURATION_MINUTES;
        const kcalShare = this.mealKcalShare(mealType, totalKcal);

        meals.push(
          this.slot(
            BlockType.MEAL,
            CalculationService.minutesToTime(cursor),
            CalculationService.minutesToTime(endMin),
            this.mealLabel(mealType),
            date,
            { mealType, caloricTarget: kcalShare }
          )
        );
      }

      mealIndex++;
      cursor += this.MEAL_INTERVAL_MINUTES;
    }

    return meals;
  }

  // ── Clinical Protocols ────────────────────────────────────────────────────

  private static buildProtocolBlocks(protocols: ClinicalProtocol[], date: string): BlockSlot[] {
    return protocols.map(p => {
      const startMin = CalculationService.timeToMinutes(p.scheduledTime);
      const endMin   = startMin + 15; // 15-minute block
      return this.slot(
        BlockType.MEDICATION,
        p.scheduledTime,
        CalculationService.minutesToTime(endMin),
        `${this.categoryIcon(p.category)} ${p.name} – ${p.dosage}`,
        date,
        { protocolId: p.id, category: p.category, dosage: p.dosage }
      );
    });
  }

  private static categoryIcon(category: string): string {
    const icons: Record<string, string> = {
      SUPLEMENTO:          "🧴",
      REMEDIO_CONTROLADO:  "💊",
      TRT:                 "💉",
      HORMONIO_FEMININO:   "🌸",
      SONO:                "😴",
    };
    return icons[category] ?? "💊";
  }

  // ── Water ─────────────────────────────────────────────────────────────────

  private static buildWaterBlocks(reminders: WaterReminder[], date: string): BlockSlot[] {
    return reminders.map((r) => ({
      type: BlockType.WATER,
      startTime: r.time,
      endTime: r.time,
      label: `Água – ${r.volumeMl} ml`,
      routineDate: date,
      waterMl: r.volumeMl,
      userId: "",
      sortOrder: 0,
    }));
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  /** Find the first free window of `durationMin` minutes within [rangeStart, rangeEnd] */
  private static findFreeWindow(
    rangeStart: string,
    rangeEnd: string,
    durationMin: number,
    occupied: BlockSlot[]
  ): string | null {
    const start = CalculationService.timeToMinutes(rangeStart);
    const end = CalculationService.timeToMinutes(rangeEnd);

    for (let t = start; t + durationMin <= end; t += 15) {
      if (!this.isOccupied(t, durationMin, occupied)) {
        return CalculationService.minutesToTime(t);
      }
    }
    return null;
  }

  /** Try to place a block starting at `preferred` time; return null if occupied */
  private static findFreeWindowAt(
    preferred: string,
    durationMin: number,
    occupied: BlockSlot[]
  ): string | null {
    const t = CalculationService.timeToMinutes(preferred);
    return this.isOccupied(t, durationMin, occupied) ? null : preferred;
  }

  private static isOccupied(
    startMin: number,
    durationMin: number,
    occupied: BlockSlot[]
  ): boolean {
    const endMin = startMin + durationMin;
    return occupied.some((b) => {
      const bStart = CalculationService.timeToMinutes(b.startTime);
      const bEnd = CalculationService.timeToMinutes(b.endTime);
      return startMin < bEnd && endMin > bStart;
    });
  }

  private static mealLabel(type: MealType): string {
    const labels: Record<MealType, string> = {
      [MealType.BREAKFAST]: "Café da Manhã",
      [MealType.MORNING_SNACK]: "Lanche da Manhã",
      [MealType.LUNCH]: "Almoço",
      [MealType.AFTERNOON_SNACK]: "Lanche da Tarde",
      [MealType.PRE_WORKOUT]: "Pré-treino",
      [MealType.POST_WORKOUT]: "Pós-treino",
      [MealType.DINNER]: "Jantar",
      [MealType.SUPPER]: "Ceia",
    };
    return labels[type];
  }

  /**
   * Distributes total daily calories across meal types.
   * Largest meals (lunch, dinner) get more; snacks get less.
   */
  private static mealKcalShare(type: MealType, totalKcal: number): number {
    const shares: Record<MealType, number> = {
      [MealType.BREAKFAST]: 0.20,
      [MealType.MORNING_SNACK]: 0.10,
      [MealType.LUNCH]: 0.30,
      [MealType.AFTERNOON_SNACK]: 0.10,
      [MealType.PRE_WORKOUT]: 0.15,
      [MealType.POST_WORKOUT]: 0.20,
      [MealType.DINNER]: 0.25,
      [MealType.SUPPER]: 0.05,
    };
    return this.round2(totalKcal * (shares[type] ?? 0.1));
  }

  private static slot(
    type: BlockType,
    startTime: string,
    endTime: string,
    label: string,
    routineDate: string,
    extra?: { mealType?: MealType; caloricTarget?: number; [key: string]: unknown }
  ): BlockSlot {
    const { mealType, caloricTarget, ...restMeta } = extra ?? {};
    // Keep non-entity fields (exerciseId, met, etc.) in the JSONB metadata column
    const metadata = Object.keys(restMeta).length > 0 ? restMeta : undefined;
    return { type, startTime, endTime, label, routineDate, mealType, caloricTarget, metadata, userId: "", sortOrder: 0 };
  }

  private static round2(n: number): number {
    return Math.round(n * 100) / 100;
  }
}

// Internal type used only within this service
type BlockSlot = Omit<RoutineBlock, "id" | "createdAt" | "updatedAt" | "user">;
