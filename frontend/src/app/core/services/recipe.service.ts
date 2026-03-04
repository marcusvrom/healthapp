import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Recipe, RecipeFeedItem, RecipeReview } from '../models';

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
  rating?: number;
  isLiked?: boolean;
  comment?: string;
}

export interface ImportRecipeDto {
  scheduledDate?: string;
  scheduledTime: string;
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

@Injectable({ providedIn: 'root' })
export class RecipeService {
  private api = inject(ApiService);

  /** My own recipes */
  listMine(): Observable<Recipe[]> {
    return this.api.get<Recipe[]>('/recipes/mine');
  }

  /** Public community feed */
  feed(page = 1, limit = 20): Observable<RecipeFeedItem[]> {
    return this.api.get<RecipeFeedItem[]>('/recipes/feed', { page: String(page), limit: String(limit) });
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

  /** Import recipe macros into ScheduledMeal */
  importRecipe(id: string, dto: ImportRecipeDto): Observable<{ xpGained: number; totalXp: number }> {
    return this.api.post<{ xpGained: number; totalXp: number }>(`/recipes/${id}/import`, dto);
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
