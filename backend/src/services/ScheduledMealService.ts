import { Repository } from "typeorm";
import { AppDataSource } from "../config/typeorm.config";
import { ScheduledMeal, ScheduledFoodItem } from "../entities/ScheduledMeal";
import { HealthProfile } from "../entities/HealthProfile";
import { GamificationService, XP_REWARDS } from "./GamificationService";
import { CalculationService } from "./CalculationService";

export interface CreateScheduledMealDto {
  scheduledDate?: string;
  name: string;
  scheduledTime: string;
  caloricTarget?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  foods?: ScheduledFoodItem[];
  notes?: string;
}

interface MealTemplate {
  name: string;
  timeOffsetMinutes: number; // minutes after wake-up
  calorieRatio: number;      // fraction of daily calories
}

const MEAL_TEMPLATES: MealTemplate[] = [
  { name: "Café da Manhã",       timeOffsetMinutes: 30,  calorieRatio: 0.25 },
  { name: "Lanche da Manhã",     timeOffsetMinutes: 180, calorieRatio: 0.10 },
  { name: "Almoço",              timeOffsetMinutes: 330, calorieRatio: 0.35 },
  { name: "Lanche da Tarde",     timeOffsetMinutes: 510, calorieRatio: 0.10 },
  { name: "Jantar",              timeOffsetMinutes: 690, calorieRatio: 0.20 },
];

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export class ScheduledMealService {
  private static get repo(): Repository<ScheduledMeal> {
    return AppDataSource.getRepository(ScheduledMeal);
  }

  static async list(userId: string, date?: string): Promise<ScheduledMeal[]> {
    const d = date ?? new Date().toISOString().slice(0, 10);
    return this.repo.find({
      where: { userId, scheduledDate: d },
      order: { scheduledTime: "ASC" },
    });
  }

  static async create(userId: string, dto: CreateScheduledMealDto): Promise<ScheduledMeal> {
    const meal = this.repo.create({
      userId,
      scheduledDate: dto.scheduledDate ?? new Date().toISOString().slice(0, 10),
      name: dto.name,
      scheduledTime: dto.scheduledTime,
      caloricTarget: dto.caloricTarget,
      proteinG: dto.proteinG,
      carbsG: dto.carbsG,
      fatG: dto.fatG,
      foods: dto.foods,
      notes: dto.notes,
      isConsumed: false,
      xpAwarded: false,
    });
    return this.repo.save(meal);
  }

  /**
   * Toggle the isConsumed flag.
   * Awards XP (once) when a meal is marked as consumed.
   */
  static async toggleConsumed(
    id: string,
    userId: string
  ): Promise<{ meal: ScheduledMeal; xpGained: number; totalXp: number }> {
    const meal = await this.repo.findOneBy({ id, userId });
    if (!meal) throw Object.assign(new Error("Refeição não encontrada."), { statusCode: 404 });

    meal.isConsumed = !meal.isConsumed;
    meal.consumedAt = meal.isConsumed ? new Date() : undefined;

    let xpGained = 0;
    if (meal.isConsumed && !meal.xpAwarded) {
      meal.xpAwarded = true;
      xpGained = XP_REWARDS.MEAL_CONSUMED;
    }

    const saved = await this.repo.save(meal);

    let totalXp = 0;
    if (xpGained > 0) {
      totalXp = await GamificationService.awardXp(userId, xpGained);
    } else {
      totalXp = await GamificationService.getXp(userId);
    }

    return { meal: saved, xpGained, totalXp };
  }

  static async remove(id: string, userId: string): Promise<void> {
    const r = await this.repo.delete({ id, userId });
    if (r.affected === 0) {
      throw Object.assign(new Error("Refeição não encontrada."), { statusCode: 404 });
    }
  }

  /**
   * Generates a full day of scheduled meals based on the user's HealthProfile.
   * Deletes any existing scheduled meals for that date first.
   */
  static async generateForDate(userId: string, date?: string): Promise<ScheduledMeal[]> {
    const d = date ?? new Date().toISOString().slice(0, 10);

    // Delete existing meals for this date
    await this.repo.delete({ userId, scheduledDate: d });

    // Load health profile
    const profile = await AppDataSource.getRepository(HealthProfile).findOne({
      where: { userId },
      relations: ["exercises"],
    });

    // Compute caloric target
    let dailyCal = 2000;
    let proteinTarget = 150;
    let carbsTarget = 200;
    let fatTarget = 67;
    const wakeTime = "07:00";

    if (profile) {
      try {
        const result = CalculationService.computeMetabolicResult(
          Number(profile.weight),
          Number(profile.height),
          profile.age,
          profile.gender,
          profile.activityFactor,
          (profile.exercises ?? []).map(ex => ({
            met: Number(ex.met),
            weightKg: Number(profile.weight),
            durationMinutes: ex.durationMinutes,
            hypertrophyScore: ex.hypertrophyScore,
          }))
        );
        dailyCal = profile.caloricGoal
          ? Number(profile.caloricGoal)
          : result.dailyCaloricTarget;
        proteinTarget = result.macros.proteinG;
        carbsTarget   = result.macros.carbsG;
        fatTarget     = result.macros.fatG;
      } catch {
        // keep defaults
      }
    }

    const wake = profile?.wakeUpTime ?? wakeTime;

    const meals = MEAL_TEMPLATES.map(tmpl => {
      const cal     = Math.round(dailyCal * tmpl.calorieRatio);
      const protein = Math.round(proteinTarget * tmpl.calorieRatio);
      const carbs   = Math.round(carbsTarget * tmpl.calorieRatio);
      const fat     = Math.round(fatTarget * tmpl.calorieRatio);

      return this.repo.create({
        userId,
        scheduledDate: d,
        name: tmpl.name,
        scheduledTime: addMinutes(wake, tmpl.timeOffsetMinutes),
        caloricTarget: cal,
        proteinG: protein,
        carbsG: carbs,
        fatG: fat,
        isConsumed: false,
        xpAwarded: false,
      });
    });

    return this.repo.save(meals);
  }
}
