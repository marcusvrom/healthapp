import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { RecipeService } from "../services/RecipeService";
import { GamificationService, XP_REWARDS } from "../services/GamificationService";

export class RecipeController {

  // ── My recipes ─────────────────────────────────────────────────────────────

  /**
   * GET /recipes/mine
   * Returns all recipes created by (or imported to) the authenticated user.
   */
  static async listMine(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await RecipeService.listMine(req.userId));
    } catch (err) { next(err); }
  }

  /**
   * GET /recipes/feed?page=1&limit=20&search=frango
   * Public community feed — aggregates avgRating, likeCount, reviewCount.
   * Supports search by title, description, or ingredient name.
   */
  static async feed(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page   = Math.max(1, parseInt(String(req.query["page"]  ?? "1")));
      const limit  = Math.min(50, Math.max(1, parseInt(String(req.query["limit"] ?? "20"))));
      const search = req.query["search"] ? String(req.query["search"]) : undefined;
      res.json(await RecipeService.feed(req.userId, page, limit, search));
    } catch (err) { next(err); }
  }

  /**
   * GET /recipes/:id
   * Returns a single recipe with ingredients.
   */
  static async findOne(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await RecipeService.findOne(req.params["id"]!, req.userId));
    } catch (err) { next(err); }
  }

  /**
   * POST /recipes
   * Create a new recipe with optional ingredient list.
   * Body: { ...recipeFields, ingredients?: IngredientDto[] }
   */
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const recipe = await RecipeService.create(req.userId, req.body);
      await GamificationService.awardXp(req.userId, XP_REWARDS.RECIPE_CREATED);
      res.status(201).json(recipe);
    } catch (err) { next(err); }
  }

  /**
   * PATCH /recipes/:id
   * Update a recipe owned by the authenticated user.
   * Automatically bumps the recipe version.
   */
  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await RecipeService.update(req.params["id"]!, req.userId, req.body));
    } catch (err) { next(err); }
  }

  /**
   * DELETE /recipes/:id
   * Soft-delete a recipe (sets is_active = false).
   */
  static async remove(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await RecipeService.remove(req.params["id"]!, req.userId);
      res.status(204).end();
    } catch (err) { next(err); }
  }

  // ── Community interactions ─────────────────────────────────────────────────

  /**
   * POST /recipes/:id/import
   * Imports a community recipe into the user's "My Recipes" as a private fork.
   * Creates a versioned snapshot so future edits to the original don't affect
   * the user's copy. Re-importing (syncing) updates the fork to the latest version.
   * Awards RECIPE_IMPORTED XP.
   */
  static async importRecipe(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await RecipeService.importRecipe(req.params["id"]!, req.userId);
      res.status(201).json(result);
    } catch (err) { next(err); }
  }

  /**
   * POST /recipes/:id/review
   * Upsert a review (rating 0-5, optional comment).
   */
  static async review(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const review = await RecipeService.upsertReview(req.params["id"]!, req.userId, req.body);

      const isNew = Math.abs(review.updatedAt.getTime() - review.createdAt.getTime()) < 5000;
      let xpGained = 0;
      if (isNew) {
        xpGained = XP_REWARDS.RECIPE_REVIEWED;
        await GamificationService.awardXp(req.userId, xpGained);
      }
      const totalXp = await GamificationService.getXp(req.userId);

      res.json({ review, xpGained, totalXp });
    } catch (err) { next(err); }
  }

  /**
   * PATCH /recipes/:id/like
   * Toggle the like status for this recipe.
   */
  static async toggleLike(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await RecipeService.toggleLike(req.params["id"]!, req.userId));
    } catch (err) { next(err); }
  }
}
