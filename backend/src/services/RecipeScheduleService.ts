import { Repository } from "typeorm";
import { AppDataSource } from "../config/typeorm.config";
import { RecipeSchedule } from "../entities/RecipeSchedule";
import { Recipe } from "../entities/Recipe";

export interface UpsertRecipeScheduleDto {
  mealName: string;
  recipeId: string;
  servings: number;
  daysOfWeek: number[]; // 0=Sun … 6=Sat
}

export class RecipeScheduleService {
  private static get repo(): Repository<RecipeSchedule> {
    return AppDataSource.getRepository(RecipeSchedule);
  }

  static async list(userId: string): Promise<RecipeSchedule[]> {
    return this.repo.find({
      where: { userId, isActive: true },
      order: { mealName: "ASC", title: "ASC" },
    });
  }

  /**
   * Upsert by (userId, mealName, recipeId).
   * If daysOfWeek is empty the schedule is deactivated instead of deleted.
   */
  static async upsert(
    userId: string,
    dto: UpsertRecipeScheduleDto
  ): Promise<RecipeSchedule> {
    const recipe = await AppDataSource.getRepository(Recipe).findOneBy({
      id: dto.recipeId,
      isActive: true,
    });
    if (!recipe)
      throw Object.assign(new Error("Receita não encontrada."), { statusCode: 404 });

    const servings = Math.max(0.5, Number(dto.servings) || 1);
    const daysOfWeek = (dto.daysOfWeek ?? [])
      .map(Number)
      .filter(d => d >= 0 && d <= 6);

    // Try to find existing record
    let schedule = await this.repo.findOneBy({
      userId,
      mealName: dto.mealName,
      recipeId: dto.recipeId,
    });

    if (schedule) {
      schedule.servings   = servings;
      schedule.daysOfWeek = daysOfWeek;
      schedule.isActive   = daysOfWeek.length > 0;
      // Refresh snapshot in case recipe was updated
      schedule.title              = recipe.title;
      schedule.kcalPerServing     = Number(recipe.kcal);
      schedule.proteinGPerServing = Number(recipe.proteinG);
      schedule.carbsGPerServing   = Number(recipe.carbsG);
      schedule.fatGPerServing     = Number(recipe.fatG);
    } else {
      schedule = this.repo.create({
        userId,
        mealName:           dto.mealName,
        recipeId:           dto.recipeId,
        title:              recipe.title,
        kcalPerServing:     Number(recipe.kcal),
        proteinGPerServing: Number(recipe.proteinG),
        carbsGPerServing:   Number(recipe.carbsG),
        fatGPerServing:     Number(recipe.fatG),
        servings,
        daysOfWeek,
        isActive: daysOfWeek.length > 0,
      });
    }

    return this.repo.save(schedule);
  }

  static async remove(id: string, userId: string): Promise<void> {
    const r = await this.repo.delete({ id, userId });
    if (r.affected === 0)
      throw Object.assign(new Error("Agendamento não encontrado."), { statusCode: 404 });
  }
}
