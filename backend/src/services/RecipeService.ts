import { AppDataSource } from "../config/typeorm.config";
import { Recipe } from "../entities/Recipe";
import { RecipeIngredient } from "../entities/RecipeIngredient";
import { RecipeReview } from "../entities/RecipeReview";
import { GamificationService, XP_REWARDS } from "./GamificationService";

const repo           = () => AppDataSource.getRepository(Recipe);
const ingredientRepo = () => AppDataSource.getRepository(RecipeIngredient);
const reviewRepo     = () => AppDataSource.getRepository(RecipeReview);

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface IngredientDto {
  name: string;
  quantity: number;
  unit: string;        // "g", "ml", "colher de sopa", "xícara", "unidade", etc.
  sortOrder?: number;
}

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
  ingredients?: IngredientDto[];
}

export interface ReviewDto {
  rating?: number;   // 0-5
  isLiked?: boolean;
  comment?: string;
}

export interface RecipeFeedItem extends Recipe {
  avgRating: number;
  likeCount: number;
  reviewCount: number;
  myReview?: RecipeReview;
  /** Whether a newer version exists compared to user's fork */
  hasUpdate?: boolean;
  originalVersion?: number;
}

export class RecipeService {

  // ── My recipes ─────────────────────────────────────────────────────────────

  static async listMine(authorId: string): Promise<Recipe[]> {
    return repo().find({
      where: { authorId, isActive: true },
      relations: ["ingredients"],
      order: { createdAt: "DESC" },
    });
  }

  static async findOne(id: string, requesterId: string): Promise<Recipe> {
    const recipe = await repo().findOne({
      where: { id, isActive: true },
      relations: ["ingredients"],
    });
    if (!recipe) throw this.notFound();
    // Private recipes only visible to author
    if (!recipe.isPublic && recipe.authorId !== requesterId) throw this.notFound();
    return recipe;
  }

  static async create(authorId: string, dto: CreateRecipeDto): Promise<Recipe> {
    const b = dto as any;
    const entity = repo().create({
      ...dto,
      authorId,
      servings:  dto.servings  ?? 1,
      proteinG:  b.proteinG  ?? b.protein_g ?? 0,
      carbsG:    b.carbsG    ?? b.carbs_g   ?? 0,
      fatG:      b.fatG      ?? b.fat_g     ?? 0,
      isPublic:  dto.isPublic  ?? false,
      version:   1,
    });
    const saved = await repo().save(entity);

    // Save ingredients if provided
    if (dto.ingredients?.length) {
      await this.saveIngredients(saved.id, dto.ingredients);
      saved.ingredients = await ingredientRepo().find({
        where: { recipeId: saved.id },
        order: { sortOrder: "ASC" },
      });
    }

    return saved;
  }

  static async update(id: string, authorId: string, dto: Partial<CreateRecipeDto>): Promise<Recipe> {
    const existing = await repo().findOneBy({ id, authorId, isActive: true });
    if (!existing) throw this.notFound();
    const b = dto as any;
    Object.assign(existing, dto);
    if (b.protein_g !== undefined && b.proteinG === undefined) existing.proteinG = b.protein_g;
    if (b.carbs_g   !== undefined && b.carbsG   === undefined) existing.carbsG   = b.carbs_g;
    if (b.fat_g     !== undefined && b.fatG     === undefined) existing.fatG     = b.fat_g;

    // Bump version on every update
    existing.version = (existing.version ?? 1) + 1;

    const saved = await repo().save(existing);

    // Replace ingredients if provided
    if (dto.ingredients !== undefined) {
      await ingredientRepo().delete({ recipeId: id });
      if (dto.ingredients.length) {
        await this.saveIngredients(id, dto.ingredients);
      }
      saved.ingredients = await ingredientRepo().find({
        where: { recipeId: id },
        order: { sortOrder: "ASC" },
      });
    }

    return saved;
  }

  static async remove(id: string, authorId: string): Promise<void> {
    const existing = await repo().findOneBy({ id, authorId, isActive: true });
    if (!existing) throw this.notFound();
    existing.isActive = false;
    await repo().save(existing);
  }

  // ── Community feed ─────────────────────────────────────────────────────────

  /**
   * Public recipe feed with optional search.
   * When `search` is provided, searches by recipe title AND ingredient names.
   */
  static async feed(
    requesterId: string,
    page = 1,
    limit = 20,
    search?: string
  ): Promise<RecipeFeedItem[]> {
    const offset = (page - 1) * limit;

    let searchCondition = "";
    const params: any[] = [limit, offset];

    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term);
      const termIdx = params.length; // $3
      searchCondition = `
        AND (
          LOWER(r.title) LIKE $${termIdx}
          OR LOWER(r.description) LIKE $${termIdx}
          OR EXISTS (
            SELECT 1 FROM recipe_ingredients ri
            WHERE ri.recipe_id = r.id AND LOWER(ri.name) LIKE $${termIdx}
          )
        )
      `;
    }

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
      LEFT   JOIN recipe_reviews rr ON rr.recipe_id = r.id
      WHERE  r.is_public  = true
        AND  r.is_active  = true
        AND  r.forked_from_id IS NULL
        ${searchCondition}
      GROUP  BY r.id
      ORDER  BY avg_rating DESC, like_count DESC, r.created_at DESC
      LIMIT  $1 OFFSET $2
      `,
      params
    );

    if (rows.length === 0) return [];

    const recipeIds = rows.map((r) => r.id);

    // Fetch the requester's reviews and forks for these recipes
    const [myReviews, myForks, allIngredients] = await Promise.all([
      reviewRepo().find({
        where: recipeIds.map((rid) => ({ recipeId: rid, userId: requesterId })),
      }),
      repo().find({
        where: recipeIds.map((rid) => ({ forkedFromId: rid, authorId: requesterId, isActive: true })),
      }),
      ingredientRepo()
        .createQueryBuilder("ri")
        .where("ri.recipe_id IN (:...ids)", { ids: recipeIds })
        .orderBy("ri.sort_order", "ASC")
        .getMany(),
    ]);

    const myReviewMap = new Map(myReviews.map((rv) => [rv.recipeId, rv]));
    const myForkMap = new Map(myForks.map((f) => [f.forkedFromId!, f]));
    const ingredientMap = new Map<string, RecipeIngredient[]>();
    for (const ing of allIngredients) {
      if (!ingredientMap.has(ing.recipeId)) ingredientMap.set(ing.recipeId, []);
      ingredientMap.get(ing.recipeId)!.push(ing);
    }

    return rows.map((r) => {
      const raw = r as any;
      const fork = myForkMap.get(raw.id);
      return {
        id:           raw.id,
        authorId:     raw.author_id,
        title:        raw.title,
        description:  raw.description,
        instructions: raw.instructions,
        kcal:         Number(raw.kcal),
        proteinG:     Number(raw.protein_g),
        carbsG:       Number(raw.carbs_g),
        fatG:         Number(raw.fat_g),
        servings:     Number(raw.servings),
        prepTimeMin:  raw.prep_time_min != null ? Number(raw.prep_time_min) : undefined,
        isPublic:     raw.is_public === true || raw.is_public === 'true',
        isActive:     raw.is_active === true  || raw.is_active  === 'true',
        version:      Number(raw.version ?? 1),
        forkedFromId: raw.forked_from_id,
        forkedAtVersion: raw.forked_at_version != null ? Number(raw.forked_at_version) : undefined,
        createdAt:    raw.created_at,
        updatedAt:    raw.updated_at,
        ingredients:  ingredientMap.get(raw.id) ?? [],
        avgRating:    parseFloat(raw.avg_rating)  || 0,
        likeCount:    parseInt(raw.like_count)    || 0,
        reviewCount:  parseInt(raw.review_count)  || 0,
        myReview:     myReviewMap.get(raw.id),
        // Flag whether the user already imported this recipe
        hasUpdate:    fork ? Number(raw.version ?? 1) > (fork.forkedAtVersion ?? 0) : false,
        originalVersion: Number(raw.version ?? 1),
      } as RecipeFeedItem;
    });
  }

  // ── Import recipe → My Recipes (fork with version snapshot) ────────────────

  /**
   * Imports a community recipe into the user's "My Recipes" tab by creating a
   * private fork. The fork captures the current version of the original, so
   * future edits to the original do not affect the user's copy.
   *
   * If the user already has a fork of this recipe, the fork is updated to the
   * latest version of the original (re-sync).
   */
  static async importRecipe(
    id: string,
    requesterId: string
  ): Promise<{ recipe: Recipe; xpGained: number; totalXp: number }> {
    const original = await this.findOne(id, requesterId);

    // Check if user already has an active fork
    let fork = await repo().findOne({
      where: { forkedFromId: id, authorId: requesterId, isActive: true },
      relations: ["ingredients"],
    });

    if (fork) {
      // Re-sync: update fork with latest data from original
      fork.title        = original.title;
      fork.description  = original.description;
      fork.instructions = original.instructions;
      fork.kcal         = original.kcal;
      fork.proteinG     = original.proteinG;
      fork.carbsG       = original.carbsG;
      fork.fatG         = original.fatG;
      fork.servings     = original.servings;
      fork.prepTimeMin  = original.prepTimeMin;
      fork.forkedAtVersion = original.version;
      fork.version      = (fork.version ?? 1) + 1;
      fork = await repo().save(fork);

      // Re-sync ingredients
      await ingredientRepo().delete({ recipeId: fork.id });
      if (original.ingredients?.length) {
        await this.saveIngredients(fork.id, original.ingredients.map((i) => ({
          name: i.name, quantity: Number(i.quantity), unit: i.unit, sortOrder: i.sortOrder,
        })));
      }
      fork.ingredients = await ingredientRepo().find({
        where: { recipeId: fork.id },
        order: { sortOrder: "ASC" },
      });
    } else {
      // Create new private fork
      fork = repo().create({
        authorId:        requesterId,
        title:           original.title,
        description:     original.description,
        instructions:    original.instructions,
        kcal:            original.kcal,
        proteinG:        original.proteinG,
        carbsG:          original.carbsG,
        fatG:            original.fatG,
        servings:        original.servings,
        prepTimeMin:     original.prepTimeMin,
        isPublic:        false,
        version:         1,
        forkedFromId:    original.id,
        forkedAtVersion: original.version,
      });
      fork = await repo().save(fork);

      // Copy ingredients
      if (original.ingredients?.length) {
        await this.saveIngredients(fork.id, original.ingredients.map((i) => ({
          name: i.name, quantity: Number(i.quantity), unit: i.unit, sortOrder: i.sortOrder,
        })));
      }
      fork.ingredients = await ingredientRepo().find({
        where: { recipeId: fork.id },
        order: { sortOrder: "ASC" },
      });
    }

    const xpGained = XP_REWARDS.RECIPE_IMPORTED ?? 15;
    const totalXp  = await GamificationService.awardXp(requesterId, xpGained, "recipe");

    return { recipe: fork, xpGained, totalXp };
  }

  // ── Reviews & Likes ────────────────────────────────────────────────────────

  static async upsertReview(
    recipeId: string,
    userId: string,
    dto: ReviewDto
  ): Promise<RecipeReview> {
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

  private static async saveIngredients(recipeId: string, items: IngredientDto[]): Promise<void> {
    const entities = items.map((item, idx) =>
      ingredientRepo().create({
        recipeId,
        name:      item.name,
        quantity:  item.quantity,
        unit:      item.unit,
        sortOrder: item.sortOrder ?? idx,
      })
    );
    await ingredientRepo().save(entities);
  }

  private static notFound(): Error {
    return Object.assign(new Error("Receita não encontrada."), { statusCode: 404 });
  }
}
