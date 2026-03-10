import { Request, Response, NextFunction } from "express";
import { FoodService } from "../services/FoodService";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

export class FoodController {
  /**
   * GET /foods/search?q=banana&limit=20
   * Hybrid search: local DB first, OpenFoodFacts fallback.
   */
  static async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = (req.query["q"] as string ?? "").trim();
      const limit = Math.min(Number(req.query["limit"] ?? 20), 50);

      if (q.length < 2) {
        res.status(400).json({ message: "Informe ao menos 2 caracteres para busca." });
        return;
      }

      const results = await FoodService.searchByName(q, limit);
      res.json(results);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /foods/barcode/:barcode
   * Local lookup → OpenFoodFacts product API.
   */
  static async byBarcode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { barcode } = req.params;
      const food = await FoodService.searchByBarcode(barcode!);

      if (!food) {
        res.status(404).json({ message: "Alimento não encontrado para este código de barras." });
        return;
      }

      res.json(food);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /foods/:id
   */
  static async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const food = await FoodService.findById(req.params["id"]!);
      if (!food) {
        res.status(404).json({ message: "Alimento não encontrado." });
        return;
      }
      res.json(food);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /foods – create a custom food
   */
  static async create(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const food = await FoodService.createCustomFood(req.body);
      res.status(201).json(food);
    } catch (err) {
      next(err);
    }
  }
}
