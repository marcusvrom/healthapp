import { AppDataSource } from "../config/typeorm.config";
import { Recipe } from "../entities/Recipe";
import { RecipeReview } from "../entities/RecipeReview";
import { ScheduledMeal } from "../entities/ScheduledMeal";
import { GamificationService, XP_REWARDS } from "./GamificationService";

const repo       = () => AppDataSource.getRepository(Recipe);
const reviewRepo = () => AppDataSource.getRepository(RecipeReview);
const mealRepo   = () => AppDataSource.getRepository(ScheduledMeal);

export interface CreateRecipeDto {
  title: string;
  description?: string;
  instructions: string;
  kcal: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  servings?: number;
  prepTimeMin?: number;
  isPublic?: boolean;
}

export interface ReviewDto {
  rating?: number;   // 0-5
  isLiked?: boolean;
  comment?: string;
}

export interface ImportRecipeDto {
  scheduledDate?: string;   // YYYY-MM-DD  (defaults to today)
  scheduledTime: string;    // HH:MM
}

export interface RecipeFeedItem extends Recipe {
  avgRating: number;
  likeCount: number;
  reviewCount: number;
  myReview?: RecipeReview;
}

export class RecipeService {

  // ── My recipes ─────────────────────────────────────────────────────────────

  static async listMine(authorId: string): Promise<Recipe[]> {
    return repo().find({
      where: { authorId, isActive: true },
      order: { createdAt: "DESC" },
    });
  }

  static async findOne(id: string, requesterId: string): Promise<Recipe> {
    const recipe = await repo().findOne({ where: { id, isActive: true } });
    if (!recipe) throw this.notFound();
    // Private recipes only visible to author
    if (!recipe.isPublic && recipe.authorId !== requesterId) throw this.notFound();
    return recipe;
  }

  static async create(authorId: string, dto: CreateRecipeDto): Promise<Recipe> {
    const entity = repo().create({
      ...dto,
      authorId,
      servings:  dto.servings  ?? 1,
      proteinG:  dto.proteinG  ?? 0,
      carbsG:    dto.carbsG    ?? 0,
      fatG:      dto.fatG      ?? 0,
      isPublic:  dto.isPublic  ?? false,
    });
    return repo().save(entity);
  }

  static async update(id: string, authorId: string, dto: Partial<CreateRecipeDto>): Promise<Recipe> {
    const existing = await repo().findOneBy({ id, authorId, isActive: true });
    if (!existing) throw this.notFound();
    Object.assign(existing, dto);
    return repo().save(existing);
  }

  static async remove(id: string, authorId: string): Promise<void> {
    const existing = await repo().findOneBy({ id, authorId, isActive: true });
    if (!existing) throw this.notFound();
    // Soft-delete: mark inactive instead of physical delete (preserves review history)
    existing.isActive = false;
    await repo().save(existing);
  }

  // ── Community feed ─────────────────────────────────────────────────────────

  /**
   * Public recipe feed.
   * Aggregates avgRating, likeCount, reviewCount per recipe.
   * Ordered by (avgRating DESC, likeCount DESC, createdAt DESC).
   * Attaches the requesting user's own review if it exists.
   */
  static async feed(
    requesterId: string,
    page = 1,
    limit = 20
  ): Promise<RecipeFeedItem[]> {
    const offset = (page - 1) * limit;

    // Build feed with aggregate counts using a raw query for efficiency
    const rows: Array<Recipe & {
      avg_rating: string;
      like_count: string;
      review_count: string;
    }> = await AppDataSource.query(
      `
      SELECT
        r.*,
        COALESCE(AVG(rr.rating) FILTER (WHERE rr.rating > 0), 0) AS avg_rating,
        COUNT(rr.id)                                               AS review_count,
        COUNT(rr.id) FILTER (WHERE rr.is_liked = true)            AS like_count
      FROM   recipes r
      LEFT   JOIN recipe_reviews rr ON rr.recipe_id = r.id::text
      WHERE  r.is_public  = true
        AND  r.is_active  = true
      GROUP  BY r.id
      ORDER  BY avg_rating DESC, like_count DESC, r.created_at DESC
      LIMIT  $1 OFFSET $2
      `,
      [limit, offset]
    );

    if (rows.length === 0) return [];

    const recipeIds = rows.map((r) => r.id);

    // Fetch the requester's reviews for these recipes in one query
    const myReviews = await reviewRepo().find({
      where: recipeIds.map((rid) => ({ recipeId: rid, userId: requesterId })),
    });
    const myReviewMap = new Map(myReviews.map((rv) => [rv.recipeId, rv]));

    return rows.map((r) => ({
      ...(r as unknown as Recipe),
      avgRating:   parseFloat(r.avg_rating)  || 0,
      likeCount:   parseInt(r.like_count)    || 0,
      reviewCount: parseInt(r.review_count)  || 0,
      myReview:    myReviewMap.get(r.id),
    }));
  }

  // ── Import recipe into diet plan ───────────────────────────────────────────

  /**
   * Copies a recipe's macro/kcal data into the user's ScheduledMeal for a
   * given date and time.  Awards XP_REWARDS.RECIPE_IMPORTED (15 XP).
   */
  static async importRecipe(
    id: string,
    requesterId: string,
    dto: ImportRecipeDto
  ): Promise<{ meal: ScheduledMeal; xpGained: number; totalXp: number }> {
    const recipe = await this.findOne(id, requesterId);

    const scheduledDate = dto.scheduledDate ?? new Date().toISOString().slice(0, 10);

    const meal = mealRepo().create({
      userId:        requesterId,
      scheduledDate,
      scheduledTime: dto.scheduledTime,
      name:          recipe.title,
      caloricTarget: Number(recipe.kcal),
      proteinG:      Number(recipe.proteinG),
      carbsG:        Number(recipe.carbsG),
      fatG:          Number(recipe.fatG),
      notes:         `Importado da receita: ${recipe.title}`,
      isConsumed:    false,
      xpAwarded:     false,
    });
    const saved = await mealRepo().save(meal);

    const xpGained = XP_REWARDS.RECIPE_IMPORTED ?? 15;
    const totalXp  = await GamificationService.awardXp(requesterId, xpGained);

    return { meal: saved, xpGained, totalXp };
  }

  // ── Reviews & Likes ────────────────────────────────────────────────────────

  /**
   * Upsert a review for a recipe.
   * A user can only have one review per recipe (enforced by UQ constraint).
   */
  static async upsertReview(
    recipeId: string,
    userId: string,
    dto: ReviewDto
  ): Promise<RecipeReview> {
    // Ensure the recipe exists and is accessible
    await this.findOne(recipeId, userId);

    let review = await reviewRepo().findOne({ where: { recipeId, userId } });

    if (review) {
      if (dto.rating   !== undefined) review.rating   = Math.min(5, Math.max(0, dto.rating));
      if (dto.isLiked  !== undefined) review.isLiked  = dto.isLiked;
      if (dto.comment  !== undefined) review.comment  = dto.comment;
    } else {
      review = reviewRepo().create({
        recipeId,
        userId,
        rating:  dto.rating  !== undefined ? Math.min(5, Math.max(0, dto.rating)) : 0,
        isLiked: dto.isLiked ?? false,
        comment: dto.comment,
      });
    }

    return reviewRepo().save(review);
  }

  /**
   * Toggle the like status of the requesting user's review.
   * Creates a review record if none exists yet.
   */
  static async toggleLike(
    recipeId: string,
    userId: string
  ): Promise<{ isLiked: boolean; likeCount: number }> {
    await this.findOne(recipeId, userId);

    let review = await reviewRepo().findOne({ where: { recipeId, userId } });
    if (review) {
      review.isLiked = !review.isLiked;
    } else {
      review = reviewRepo().create({ recipeId, userId, isLiked: true, rating: 0 });
    }
    await reviewRepo().save(review);

    const likeCount: number = await reviewRepo().count({ where: { recipeId, isLiked: true } });
    return { isLiked: review.isLiked, likeCount };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private static notFound(): Error {
    return Object.assign(new Error("Receita não encontrada."), { statusCode: 404 });
  }
}
