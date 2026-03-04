import { ActivityFactor, ACTIVITY_MULTIPLIERS, Gender, PrimaryGoal, GOAL_CALORIC_ADJUSTMENT } from "../entities/HealthProfile";
import {
  ExerciseCalcInput,
  MacroGrams,
  MetabolicResult,
  WaterReminder,
} from "../types/calculation.types";

/**
 * CalculationService
 * ──────────────────
 * Stateless service that encapsulates all metabolic math:
 *
 *  • BMR  – Mifflin-St Jeor equation
 *  • TEE  – Total Energy Expenditure (BMR × PAL)
 *  • MET  – Exercise calorie expenditure
 *  • Macros – baseline protein / carb / fat split
 *  • Water – daily target + hourly reminder schedule
 */
export class CalculationService {

  // ── Constants ───────────────────────────────────────────────────────────────

  /**
   * Protein ceiling for high hypertrophy stimulus (score ≥ HYPERTROPHY_THRESHOLD).
   * 2.2 g per kg body-weight – upper evidence-based limit.
   */
  private static readonly PROTEIN_CEILING_G_PER_KG = 2.2;
  private static readonly PROTEIN_BASE_G_PER_KG = 1.6;
  private static readonly HYPERTROPHY_THRESHOLD = 8;

  /** Water: 35 ml per kg body-weight */
  private static readonly WATER_ML_PER_KG = 35;

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Calculate Basal Metabolic Rate using the Mifflin-St Jeor equation.
   *
   * Male:   BMR = (10 × weight_kg) + (6.25 × height_cm) − (5 × age) + 5
   * Female: BMR = (10 × weight_kg) + (6.25 × height_cm) − (5 × age) − 161
   * Other:  average of both formulae
   *
   * @param weightKg  body weight in kilograms
   * @param heightCm  height in centimetres
   * @param age       age in years
   * @param gender    Gender enum
   * @returns BMR in kcal/day (rounded to 2 decimal places)
   */
  static calculateBMR(
    weightKg: number,
    heightCm: number,
    age: number,
    gender: Gender
  ): number {
    const base = 10 * weightKg + 6.25 * heightCm - 5 * age;

    let bmr: number;
    switch (gender) {
      case Gender.MALE:
        bmr = base + 5;
        break;
      case Gender.FEMALE:
        bmr = base - 161;
        break;
      default:
        // For "other" we use the average of both constants
        bmr = base + (5 + -161) / 2; // base − 78
        break;
    }

    return this.round2(bmr);
  }

  /**
   * Calculate Total Energy Expenditure.
   * TEE = BMR × Physical Activity Level multiplier
   *
   * @param bmr            result of calculateBMR()
   * @param activityFactor PAL category from ActivityFactor enum
   */
  static calculateTEE(bmr: number, activityFactor: ActivityFactor): number {
    const multiplier = ACTIVITY_MULTIPLIERS[activityFactor];
    return this.round2(bmr * multiplier);
  }

  /**
   * Calculate calories burned during an exercise session using the MET formula.
   *
   * kcal = MET × weight_kg × duration_hours
   *
   * @param input ExerciseCalcInput
   * @returns kcal burned (rounded to 2 dp)
   */
  static calculateExerciseCalories(input: ExerciseCalcInput): number {
    const durationHours = input.durationMinutes / 60;
    return this.round2(input.met * input.weightKg * durationHours);
  }

  /**
   * Build the full metabolic result for a given profile + optional exercise.
   *
   * Macro distribution baseline (adjustable by BloodTestAnalysisService):
   *   Protein : 25–30 % of calories (or up to 2.2 g/kg for hypertrophy)
   *   Fat     : 25 % of calories
   *   Carbs   : remainder
   *
   * @param weightKg       body weight in kg
   * @param heightCm       height in cm
   * @param age            age in years
   * @param gender         Gender
   * @param activityFactor PAL category
   * @param exercises      optional array of today's exercises
   */
  static computeMetabolicResult(
    weightKg: number,
    heightCm: number,
    age: number,
    gender: Gender,
    activityFactor: ActivityFactor,
    exercises: ExerciseCalcInput[] = [],
    primaryGoal?: PrimaryGoal
  ): MetabolicResult {
    const bmr = this.calculateBMR(weightKg, heightCm, age, gender);
    const tee = this.calculateTEE(bmr, activityFactor);

    // Sum calories from all exercises and track max hypertrophy score
    let exerciseCalories = 0;
    let maxHypertrophyScore = 0;
    for (const ex of exercises) {
      exerciseCalories += this.calculateExerciseCalories(ex);
      if (ex.hypertrophyScore > maxHypertrophyScore) {
        maxHypertrophyScore = ex.hypertrophyScore;
      }
    }

    const goalAdjustmentKcal = primaryGoal ? (GOAL_CALORIC_ADJUSTMENT[primaryGoal] ?? 0) : 0;
    const dailyCaloricTarget = this.round2(tee + exerciseCalories + goalAdjustmentKcal);

    const macros = this.calculateMacros(
      weightKg,
      dailyCaloricTarget,
      maxHypertrophyScore,
      primaryGoal
    );

    const waterMlTotal = this.calculateDailyWater(weightKg);

    return {
      bmr,
      tee,
      exerciseCalories: this.round2(exerciseCalories),
      dailyCaloricTarget,
      macros,
      waterMlTotal,
      hypertrophyScore: maxHypertrophyScore,
      goalAdjustmentKcal,
    };
  }

  /**
   * Calculate daily water intake target.
   * Formula: 35 ml × weight_kg
   *
   * @param weightKg body weight in kg
   * @returns total daily water in ml
   */
  static calculateDailyWater(weightKg: number): number {
    return this.round2(weightKg * this.WATER_ML_PER_KG);
  }

  /**
   * Distribute daily water intake into reminder blocks throughout the day.
   *
   * Strategy:
   *  1. Split awake-window into N equal slots (default every 45 min)
   *  2. Each slot gets an equal share of the daily water target
   *  3. First reminder: 15 min after wake-up
   *  4. Last reminder: 60 min before sleep
   *
   * @param totalMl       total daily water target (ml)
   * @param wakeUpTime    HH:MM string
   * @param sleepTime     HH:MM string
   * @param intervalMin   minutes between reminders (default 45)
   * @returns array of { time, volumeMl }
   */
  static distributeWaterReminders(
    totalMl: number,
    wakeUpTime: string,
    sleepTime: string,
    intervalMin = 45
  ): WaterReminder[] {
    const wakeMinutes = this.timeToMinutes(wakeUpTime) + 15;
    const sleepMinutes = this.timeToMinutes(sleepTime) - 60;

    if (sleepMinutes <= wakeMinutes) {
      // Edge case: sleep before midnight or same time – return single block
      return [{ time: wakeUpTime, volumeMl: totalMl }];
    }

    const reminders: WaterReminder[] = [];
    let cursor = wakeMinutes;

    while (cursor <= sleepMinutes) {
      reminders.push({ time: this.minutesToTime(cursor), volumeMl: 0 });
      cursor += intervalMin;
    }

    if (reminders.length === 0) {
      return [{ time: this.minutesToTime(wakeMinutes), volumeMl: totalMl }];
    }

    // Distribute total volume evenly; last slot gets any rounding remainder
    const perSlot = Math.floor(totalMl / reminders.length);
    const remainder = totalMl - perSlot * reminders.length;

    return reminders.map((r, i) => ({
      time: r.time,
      volumeMl: i === reminders.length - 1 ? perSlot + remainder : perSlot,
    }));
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  // ── Goal metadata helpers (Single Source of Truth) ─────────────────────────

  /** Human-readable label for each goal (used by frontend AND backend logs). */
  static getGoalLabel(goal: PrimaryGoal): string {
    const labels: Record<PrimaryGoal, string> = {
      [PrimaryGoal.EMAGRECIMENTO]: "Emagrecimento",
      [PrimaryGoal.GANHO_MASSA]:   "Ganho de Massa",
      [PrimaryGoal.MANUTENCAO]:    "Manutenção",
      [PrimaryGoal.SAUDE_GERAL]:   "Saúde Geral",
      [PrimaryGoal.DIABETICO]:     "Diabéticos",
    };
    return labels[goal] ?? goal;
  }

  /** Caloric offset for a given goal (delegates to the constant in HealthProfile). */
  static getGoalAdjustmentKcal(goal: PrimaryGoal): number {
    return GOAL_CALORIC_ADJUSTMENT[goal] ?? 0;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Goal-aware macro split — the ONLY place in the codebase that distributes
   * macronutrients.  All other modules call this; none recalculate macros
   * independently.
   *
   * Standard distribution:
   *   Protein : 1.6 g/kg (2.2 g/kg when hypertrophyScore ≥ 8)
   *   Fat     : 25 % of calories
   *   Carbs   : remainder
   *
   * Diabetic distribution (DIABETICO goal):
   *   Protein : 2.0 g/kg (to preserve lean mass on moderate deficit)
   *   Carbs   : capped at 100 g/day (glycaemic control)
   *   Fat     : remainder after protein + capped carbs
   *
   * Caloric coefficients: protein = 4 kcal/g, fat = 9 kcal/g, carbs = 4 kcal/g
   */
  private static calculateMacros(
    weightKg: number,
    dailyCaloricTarget: number,
    hypertrophyScore: number,
    primaryGoal?: PrimaryGoal
  ): MacroGrams {
    // ── Diabetic low-carb pathway ──────────────────────────────────────────
    if (primaryGoal === PrimaryGoal.DIABETICO) {
      const proteinG    = this.round2(weightKg * 2.0);
      const proteinKcal = proteinG * 4;

      // Cap carbs at 100 g (glycaemic control) OR 25 % of calories, whichever is less
      const carbsCap = Math.min(100, this.round2((dailyCaloricTarget * 0.25) / 4));
      const carbsG    = carbsCap;
      const carbsKcal = carbsG * 4;

      // Fat receives the remaining calories
      const fatKcal = Math.max(0, dailyCaloricTarget - proteinKcal - carbsKcal);
      const fatG    = this.round2(fatKcal / 9);

      return { proteinG, carbsG, fatG };
    }

    // ── Standard pathway ───────────────────────────────────────────────────
    const proteinGPerKg =
      hypertrophyScore >= this.HYPERTROPHY_THRESHOLD
        ? this.PROTEIN_CEILING_G_PER_KG
        : this.PROTEIN_BASE_G_PER_KG;

    const proteinG = this.round2(weightKg * proteinGPerKg);
    const proteinKcal = proteinG * 4;

    // Fat = 25 % of total calories
    const fatKcal = dailyCaloricTarget * 0.25;
    const fatG = this.round2(fatKcal / 9);

    // Carbs = remainder
    const carbsKcal = Math.max(0, dailyCaloricTarget - proteinKcal - fatKcal);
    const carbsG = this.round2(carbsKcal / 4);

    return { proteinG, carbsG, fatG };
  }

  /** Convert HH:MM string to minutes since midnight */
  static timeToMinutes(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  }

  /** Convert minutes since midnight to HH:MM string */
  static minutesToTime(minutes: number): string {
    // Handle times that overflow past midnight
    const normalised = ((minutes % 1440) + 1440) % 1440;
    const h = Math.floor(normalised / 60);
    const m = normalised % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  private static round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
