import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { RecipeScheduleService } from "../services/RecipeScheduleService";

export class RecipeScheduleController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const schedules = await RecipeScheduleService.list(req.userId);
      res.json(schedules);
    } catch (err) { next(err); }
  }

  static async upsert(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { mealName, recipeId, servings, daysOfWeek } = req.body as {
        mealName: string;
        recipeId: string;
        servings?: number;
        daysOfWeek: number[];
      };
      if (!mealName || !recipeId || !Array.isArray(daysOfWeek)) {
        res.status(400).json({ message: "mealName, recipeId e daysOfWeek são obrigatórios." });
        return;
      }
      const schedule = await RecipeScheduleService.upsert(req.userId, {
        mealName,
        recipeId,
        servings: servings ?? 1,
        daysOfWeek,
      });
      res.json(schedule);
    } catch (err) { next(err); }
  }

  static async remove(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await RecipeScheduleService.remove(req.params["id"]!, req.userId);
      res.status(204).send();
    } catch (err) { next(err); }
  }
}
