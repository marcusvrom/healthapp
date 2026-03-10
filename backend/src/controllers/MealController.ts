import { Response, NextFunction } from "express";
import { MealService } from "../services/MealService";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

export class MealController {
  /** GET /meals?date=YYYY-MM-DD */
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const date = (req.query["date"] as string) ?? new Date().toISOString().slice(0, 10);
      const meals = await MealService.listByDate(req.userId, date);
      res.json(meals);
    } catch (err) {
      next(err);
    }
  }

  /** GET /meals/summary?date=YYYY-MM-DD */
  static async summary(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const date = (req.query["date"] as string) ?? new Date().toISOString().slice(0, 10);
      const summary = await MealService.dailySummary(req.userId, date);
      res.json(summary);
    } catch (err) {
      next(err);
    }
  }

  /** POST /meals */
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const meal = await MealService.create(req.userId, req.body);
      res.status(201).json(meal);
    } catch (err) {
      next(err);
    }
  }

  /** POST /meals/:id/foods */
  static async addFoods(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const meal = await MealService.addFoods(req.params["id"]!, req.userId, req.body.foods);
      res.json(meal);
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /meals/:mealId/foods/:mealFoodId */
  static async updateFood(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const mealFood = await MealService.updateFoodQuantity(
        req.params["mealFoodId"]!,
        req.userId,
        Number(req.body.quantityG)
      );
      res.json(mealFood);
    } catch (err) {
      next(err);
    }
  }

  /** DELETE /meals/:mealId/foods/:mealFoodId */
  static async removeFood(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await MealService.removeFood(req.params["mealFoodId"]!, req.userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  /** DELETE /meals/:id */
  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await MealService.delete(req.params["id"]!, req.userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}
