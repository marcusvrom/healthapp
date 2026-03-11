import { Repository } from "typeorm";
import { AppDataSource } from "../config/typeorm.config";
import { ScheduledMeal, ScheduledFoodItem, LinkedRecipe } from "../entities/ScheduledMeal";
import { Recipe } from "../entities/Recipe";
import { HealthProfile } from "../entities/HealthProfile";
import { RecipeSchedule } from "../entities/RecipeSchedule";
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
  isRecurring?: boolean;
  daysOfWeek?: number[];
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

  /**
   * Returns meals for a given date: specific-date meals UNION recurring meals
   * whose daysOfWeek includes the requested day-of-week.
   */
  static async list(userId: string, date?: string): Promise<ScheduledMeal[]> {
    const d = date ?? new Date().toISOString().slice(0, 10);
    const dayOfWeek = new Date(`${d}T12:00:00`).getDay();

    return this.repo
      .createQueryBuilder("m")
      .where("m.user_id = :userId", { userId })
      .andWhere(
        `(
          (m.is_recurring = false AND m.scheduled_date = :date)
          OR
          (m.is_recurring = true AND m.days_of_week @> :dow::jsonb)
        )`,
        { date: d, dow: JSON.stringify([dayOfWeek]) }
      )
      .orderBy("m.scheduled_time", "ASC")
      .getMany();
  }

  static async create(userId: string, dto: CreateScheduledMealDto): Promise<ScheduledMeal> {
    const isRecurring = dto.isRecurring === true && Array.isArray(dto.daysOfWeek) && dto.daysOfWeek.length > 0;
    const meal = this.repo.create({
      userId,
      scheduledDate: isRecurring ? undefined : (dto.scheduledDate ?? new Date().toISOString().slice(0, 10)),
      name: dto.name,
      scheduledTime: dto.scheduledTime,
      caloricTarget: dto.caloricTarget,
      proteinG: dto.proteinG,
      carbsG: dto.carbsG,
      fatG: dto.fatG,
      foods: dto.foods,
      notes: dto.notes,
      isRecurring,
      daysOfWeek: isRecurring ? dto.daysOfWeek! : [],
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
  ): Promise<{ meal: ScheduledMeal; xpGained: number; totalXp: number; capReached: boolean }> {
    const meal = await this.repo.findOneBy({ id, userId });
    if (!meal) throw Object.assign(new Error("Refeição não encontrada."), { statusCode: 404 });

    meal.isConsumed = !meal.isConsumed;
    meal.consumedAt = meal.isConsumed ? new Date() : undefined;

    let xpGained   = 0;
    let totalXp    = 0;
    let capReached = false;

    if (meal.isConsumed && !meal.xpAwarded) {
      const today     = new Date().toISOString().slice(0, 10);
      const remaining = await GamificationService.remainingDailyXp(userId, today, "meal");

      if (remaining > 0) {
        const reward     = Math.min(XP_REWARDS.MEAL_CONSUMED, remaining);
        totalXp          = await GamificationService.awardXp(userId, reward, "meal", meal.id);
        xpGained         = reward;
        meal.xpAwarded   = true;
      } else {
        capReached = true;
      }
    }

    const saved = await this.repo.save(meal);

    if (totalXp === 0) {
      totalXp = await GamificationService.getXp(userId);
    }

    return { meal: saved, xpGained, totalXp, capReached };
  }

  // ── Recipe linking ──────────────────────────────────────────────────────────

  /**
   * Links a recipe to this scheduled meal (single source of truth for consumption).
   * If the same recipe is already linked, its servings are incremented instead of
   * creating a duplicate entry.
   */
  static async linkRecipe(
    mealId: string,
    userId: string,
    dto: { recipeId: string; servings: number }
  ): Promise<ScheduledMeal> {
    const meal = await this.repo.findOneBy({ id: mealId, userId });
    if (!meal) throw Object.assign(new Error("Refeição não encontrada."), { statusCode: 404 });

    const recipe = await AppDataSource.getRepository(Recipe).findOneBy({
      id: dto.recipeId,
      isActive: true,
    });
    if (!recipe) throw Object.assign(new Error("Receita não encontrada."), { statusCode: 404 });

    const servings = Math.max(0.5, Number(dto.servings) || 1);
    const existing = (meal.linkedRecipes ?? []).findIndex(r => r.recipeId === dto.recipeId);

    if (existing >= 0) {
      // Increment servings on existing entry
      meal.linkedRecipes![existing]!.servings += servings;
    } else {
      const entry: LinkedRecipe = {
        recipeId:           recipe.id,
        title:              recipe.title,
        kcalPerServing:     Number(recipe.kcal),
        proteinGPerServing: Number(recipe.proteinG),
        carbsGPerServing:   Number(recipe.carbsG),
        fatGPerServing:     Number(recipe.fatG),
        servings,
      };
      meal.linkedRecipes = [...(meal.linkedRecipes ?? []), entry];
    }

    return this.repo.save(meal);
  }

  /**
   * Removes a recipe link from this scheduled meal.
   */
  static async unlinkRecipe(
    mealId: string,
    userId: string,
    recipeId: string
  ): Promise<ScheduledMeal> {
    const meal = await this.repo.findOneBy({ id: mealId, userId });
    if (!meal) throw Object.assign(new Error("Refeição não encontrada."), { statusCode: 404 });

    meal.linkedRecipes = (meal.linkedRecipes ?? []).filter(r => r.recipeId !== recipeId);
    return this.repo.save(meal);
  }

  static async remove(id: string, userId: string): Promise<void> {
    const r = await this.repo.delete({ id, userId });
    if (r.affected === 0) {
      throw Object.assign(new Error("Refeição não encontrada."), { statusCode: 404 });
    }
  }

  // ── Clone ───────────────────────────────────────────────────────────────────

  /**
   * Copies all scheduled meals (including linkedRecipes) from one date to
   * another, replacing any meals that already exist on the target date.
   */
  static async clone(
    userId: string,
    fromDate: string,
    toDate: string
  ): Promise<ScheduledMeal[]> {
    const source = await this.repo.find({
      where: { userId, scheduledDate: fromDate },
      order: { scheduledTime: "ASC" },
    });
    if (source.length === 0) {
      throw Object.assign(
        new Error("Nenhuma refeição encontrada na data de origem."),
        { statusCode: 404 }
      );
    }

    // Delete existing meals on target date
    await this.repo.delete({ userId, scheduledDate: toDate });

    const cloned = source.map(m =>
      this.repo.create({
        userId,
        scheduledDate:  toDate,
        name:           m.name,
        scheduledTime:  m.scheduledTime,
        caloricTarget:  m.caloricTarget,
        proteinG:       m.proteinG,
        carbsG:         m.carbsG,
        fatG:           m.fatG,
        foods:          m.foods,
        linkedRecipes:  m.linkedRecipes,
        notes:          m.notes,
        isConsumed:     false,
        xpAwarded:      false,
      })
    );

    return this.repo.save(cloned);
  }

  // ── Apply repeating schedules ───────────────────────────────────────────────

  /**
   * Reads the user's active RecipeSchedule records, filters those whose
   * daysOfWeek contains the given date's day-of-week, and auto-links
   * them into the matching ScheduledMeals for that date (no duplicates).
   */
  static async applySchedules(
    userId: string,
    date: string
  ): Promise<ScheduledMeal[]> {
    // day 0=Sun, use noon to avoid DST edge cases
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();

    const allSchedules = await AppDataSource.getRepository(RecipeSchedule).find({
      where: { userId, isActive: true },
    });

    const todaySchedules = allSchedules.filter(s =>
      s.daysOfWeek.includes(dayOfWeek)
    );

    if (todaySchedules.length === 0) return this.list(userId, date);

    const meals = await this.list(userId, date);

    for (const meal of meals) {
      const forMeal = todaySchedules.filter(
        s => s.mealName.toLowerCase() === meal.name.toLowerCase()
      );
      if (forMeal.length === 0) continue;

      let changed = false;
      for (const sched of forMeal) {
        const already = (meal.linkedRecipes ?? []).some(
          r => r.recipeId === sched.recipeId
        );
        if (!already) {
          meal.linkedRecipes = [
            ...(meal.linkedRecipes ?? []),
            {
              recipeId:           sched.recipeId,
              title:              sched.title,
              kcalPerServing:     Number(sched.kcalPerServing),
              proteinGPerServing: Number(sched.proteinGPerServing),
              carbsGPerServing:   Number(sched.carbsGPerServing),
              fatGPerServing:     Number(sched.fatGPerServing),
              servings:           Number(sched.servings),
            },
          ];
          changed = true;
        }
      }
      if (changed) await this.repo.save(meal);
    }

    return this.list(userId, date);
  }

  /**
   * @deprecated Part of the old auto-generation flow. The Canvas pivot
   * means users create their own meals. Kept for backwards compatibility
   * but should NOT be called from new code.
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
          })),
          profile.primaryGoal,
          profile.targetWeight ? Number(profile.targetWeight) : undefined
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
