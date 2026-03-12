import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Recipe, RecipeFeedItem, RecipeReview, RecipeIngredient } from '../models';

export interface IngredientDto {
  name: string;
  quantity: number;
  unit: string;
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
  rating?: number;
  isLiked?: boolean;
  comment?: string;
}

export interface ReviewResult {
  review: RecipeReview;
  xpGained: number;
  totalXp: number;
}

export interface LikeResult {
  isLiked: boolean;
  likeCount: number;
}

export interface ImportResult {
  recipe: Recipe;
  xpGained: number;
  totalXp: number;
}

@Injectable({ providedIn: 'root' })
export class RecipeService {
  private api = inject(ApiService);

  /** My own recipes (including imported forks) */
  listMine(): Observable<Recipe[]> {
    return this.api.get<Recipe[]>('/recipes/mine');
  }

  /** Public community feed with optional search (by title, description, or ingredient) */
  feed(page = 1, limit = 20, search?: string): Observable<RecipeFeedItem[]> {
    const params: Record<string, string> = { page: String(page), limit: String(limit) };
    if (search?.trim()) params['search'] = search.trim();
    return this.api.get<RecipeFeedItem[]>('/recipes/feed', params);
  }

  findOne(id: string): Observable<Recipe> {
    return this.api.get<Recipe>(`/recipes/${id}`);
  }

  create(dto: CreateRecipeDto): Observable<Recipe> {
    return this.api.post<Recipe>('/recipes', dto);
  }

  update(id: string, dto: Partial<CreateRecipeDto>): Observable<Recipe> {
    return this.api.patch<Recipe>(`/recipes/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/recipes/${id}`);
  }

  /**
   * Import a community recipe into "My Recipes" as a private fork.
   * If already imported, re-syncs to the latest version of the original.
   */
  importRecipe(id: string): Observable<ImportResult> {
    return this.api.post<ImportResult>(`/recipes/${id}/import`, {});
  }

  /** Upsert a review (rating + optional comment) */
  review(id: string, dto: ReviewDto): Observable<ReviewResult> {
    return this.api.post<ReviewResult>(`/recipes/${id}/review`, dto);
  }

  /** Toggle like on a recipe */
  toggleLike(id: string): Observable<LikeResult> {
    return this.api.patch<LikeResult>(`/recipes/${id}/like`, {});
  }
}
