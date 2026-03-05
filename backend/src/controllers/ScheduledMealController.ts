import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { ScheduledMealService } from "../services/ScheduledMealService";
import { GamificationService } from "../services/GamificationService";

export class ScheduledMealController {
  /** GET /scheduled-meals?date=YYYY-MM-DD */
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const date = req.query["date"] as string | undefined;
      const meals = await ScheduledMealService.list(req.userId, date);
      res.json(meals);
    } catch (err) {
      next(err);
    }
  }

  /** POST /scheduled-meals */
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const meal = await ScheduledMealService.create(req.userId, req.body);
      res.status(201).json(meal);
    } catch (err) {
      next(err);
    }
  }

  /** POST /scheduled-meals/generate */
  static async generate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const date = req.body?.date as string | undefined;
      const meals = await ScheduledMealService.generateForDate(req.userId, date);
      res.json(meals);
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /scheduled-meals/:id/toggle */
  static async toggle(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { meal, xpGained, totalXp } = await ScheduledMealService.toggleConsumed(
        req.params["id"]!,
        req.userId
      );
      const level = GamificationService.levelFromXp(totalXp);
      res.json({ meal, xpGained, totalXp, level });
    } catch (err) {
      next(err);
    }
  }

  /** DELETE /scheduled-meals/:id */
  static async remove(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await ScheduledMealService.remove(req.params["id"]!, req.userId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /scheduled-meals/:id/link-recipe
   * Body: { recipeId: string, servings: number }
   * Links a recipe to the scheduled meal. If the same recipe is already linked,
   * its servings are incremented. Returns the updated ScheduledMeal.
   */
  static async linkRecipe(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const meal = await ScheduledMealService.linkRecipe(
        req.params["id"]!,
        req.userId,
        { recipeId: req.body.recipeId, servings: req.body.servings ?? 1 }
      );
      res.json(meal);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /scheduled-meals/:id/link-recipe/:recipeId
   * Removes a recipe link from the scheduled meal.
   */
  static async unlinkRecipe(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const meal = await ScheduledMealService.unlinkRecipe(
        req.params["id"]!,
        req.userId,
        req.params["recipeId"]!
      );
      res.json(meal);
    } catch (err) {
      next(err);
    }
  }
}
