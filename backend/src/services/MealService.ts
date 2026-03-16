import { Repository } from "typeorm";
import { AppDataSource } from "../config/typeorm.config";
import { Meal, MealFood } from "../entities/Meal";
import { Food } from "../entities/Food";
import { MealType } from "../entities/RoutineBlock";
import { ScheduledMeal } from "../entities/ScheduledMeal";

export interface AddFoodToMealDto {
  foodId: string;
  quantityG: number;
}

export interface CreateMealDto {
  mealDate: string;
  mealType: MealType;
  notes?: string;
  foods?: AddFoodToMealDto[];
}

export class MealService {
  private static get mealRepo(): Repository<Meal> {
    return AppDataSource.getRepository(Meal);
  }
  private static get mealFoodRepo(): Repository<MealFood> {
    return AppDataSource.getRepository(MealFood);
  }
  private static get foodRepo(): Repository<Food> {
    return AppDataSource.getRepository(Food);
  }

  /** List all meals for a user on a given date */
  static async listByDate(userId: string, date: string): Promise<Meal[]> {
    return this.mealRepo.find({
      where: { userId, mealDate: date },
      order: { mealType: "ASC" },
    });
  }

  /** Get a single meal with all foods */
  static async findOne(mealId: string, userId: string): Promise<Meal | null> {
    return this.mealRepo.findOne({ where: { id: mealId, userId } });
  }

  /** Create a new meal, optionally with an initial list of foods */
  static async create(userId: string, dto: CreateMealDto): Promise<Meal> {
    const meal = this.mealRepo.create({
      userId,
      mealDate: dto.mealDate,
      mealType: dto.mealType,
      notes: dto.notes,
      mealFoods: [],
    });

    const saved = await this.mealRepo.save(meal);

    if (dto.foods?.length) {
      await this.addFoods(saved.id, userId, dto.foods);
      return this.mealRepo.findOne({ where: { id: saved.id } }) as Promise<Meal>;
    }

    return saved;
  }

  /** Add one or more foods to an existing meal */
  static async addFoods(
    mealId: string,
    userId: string,
    foods: AddFoodToMealDto[]
  ): Promise<Meal> {
    const meal = await this.mealRepo.findOne({ where: { id: mealId, userId } });
    if (!meal) throw Object.assign(new Error("Refeição não encontrada."), { statusCode: 404 });

    const mealFoods = foods.map((f) =>
      this.mealFoodRepo.create({ mealId, foodId: f.foodId, quantityG: f.quantityG })
    );

    await this.mealFoodRepo.save(mealFoods);

    return this.mealRepo.findOne({ where: { id: mealId } }) as Promise<Meal>;
  }

  /** Remove a food entry from a meal */
  static async removeFood(mealFoodId: string, userId: string): Promise<void> {
    const mf = await this.mealFoodRepo.findOne({
      where: { id: mealFoodId },
      relations: ["meal"],
    });

    if (!mf || mf.meal.userId !== userId) {
      throw Object.assign(new Error("Item não encontrado."), { statusCode: 404 });
    }

    await this.mealFoodRepo.remove(mf);
  }

  /** Update the quantity of a food item in a meal */
  static async updateFoodQuantity(
    mealFoodId: string,
    userId: string,
    quantityG: number
  ): Promise<MealFood> {
    const mf = await this.mealFoodRepo.findOne({
      where: { id: mealFoodId },
      relations: ["meal"],
    });

    if (!mf || mf.meal.userId !== userId) {
      throw Object.assign(new Error("Item não encontrado."), { statusCode: 404 });
    }

    mf.quantityG = quantityG;
    return this.mealFoodRepo.save(mf);
  }

  /** Delete an entire meal */
  static async delete(mealId: string, userId: string): Promise<void> {
    const result = await this.mealRepo.delete({ id: mealId, userId });
    if (result.affected === 0) {
      throw Object.assign(new Error("Refeição não encontrada."), { statusCode: 404 });
    }
  }

  /**
   * Daily nutritional summary: aggregates all meals for a given date.
   */
  static async dailySummary(
    userId: string,
    date: string
  ): Promise<{
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
    totalFiber: number;
    /** Kcal contributed specifically by consumed recipe-linked scheduled meals */
    scheduledRecipeKcal: number;
    byMeal: Array<{
      mealType: MealType;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    }>;
  }> {
    // ── Manual food-log meals (Meal entity) ───────────────────────────────────
    const meals = await this.listByDate(userId, date);
    const byMeal = meals.map((m) => ({
      mealType: m.mealType,
      calories: m.totalCalories,
      protein:  m.totalProtein,
      carbs:    m.totalCarbs,
      fat:      m.totalFat,
    }));

    // ── Consumed scheduled meals (recipe-linked) ──────────────────────────────
    // These are the single source of truth for recipe-based consumption.
    // Must also include recurring meals whose daysOfWeek matches the date.
    const scheduledMealRepo = AppDataSource.getRepository(ScheduledMeal);
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
    const consumedScheduled = await scheduledMealRepo
      .createQueryBuilder("m")
      .where("m.user_id = :userId", { userId })
      .andWhere("m.is_consumed = true")
      .andWhere(
        `(
          (m.is_recurring = false AND m.scheduled_date = :date)
          OR
          (m.is_recurring = true AND m.days_of_week @> :dow::jsonb)
        )`,
        { date, dow: JSON.stringify([dayOfWeek]) }
      )
      .getMany();

    let schedKcal = 0, schedProtein = 0, schedCarbs = 0, schedFat = 0;
    for (const sm of consumedScheduled) {
      const linked = sm.linkedRecipes ?? [];
      if (linked.length > 0) {
        // Sum recipe snapshots × servings
        for (const r of linked) {
          schedKcal    += r.kcalPerServing     * r.servings;
          schedProtein += r.proteinGPerServing * r.servings;
          schedCarbs   += r.carbsGPerServing   * r.servings;
          schedFat     += r.fatGPerServing     * r.servings;
        }
      } else {
        // No recipes linked → count the planned targets as consumed
        schedKcal    += Number(sm.caloricTarget ?? 0);
        schedProtein += Number(sm.proteinG     ?? 0);
        schedCarbs   += Number(sm.carbsG       ?? 0);
        schedFat     += Number(sm.fatG         ?? 0);
      }
    }

    return {
      totalCalories:       byMeal.reduce((s, m) => s + m.calories, 0) + schedKcal,
      totalProtein:        byMeal.reduce((s, m) => s + m.protein, 0)  + schedProtein,
      totalCarbs:          byMeal.reduce((s, m) => s + m.carbs, 0)    + schedCarbs,
      totalFat:            byMeal.reduce((s, m) => s + m.fat, 0)      + schedFat,
      totalFiber:          meals.reduce((s, m) => s + m.totalFiber, 0),
      scheduledRecipeKcal: schedKcal,
      byMeal,
    };
  }
}
