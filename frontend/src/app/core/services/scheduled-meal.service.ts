import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ScheduledMeal, ToggleResult } from '../models';

export interface LinkRecipeDto {
  recipeId: string;
  /** Number of servings (min 0.5). Defaults to 1. */
  servings: number;
}

@Injectable({ providedIn: 'root' })
export class ScheduledMealService {
  private api = inject(ApiService);

  /** Fetch all scheduled meals for a given date. */
  list(date: string): Observable<ScheduledMeal[]> {
    return this.api.get<ScheduledMeal[]>('/scheduled-meals', { date });
  }

  /**
   * Toggle the isConsumed flag.
   * When consumed: kcal/macros from linkedRecipes count toward daily totals.
   */
  toggle(id: string): Observable<ToggleResult> {
    return this.api.patch<ToggleResult>(`/scheduled-meals/${id}/toggle`, {});
  }

  /**
   * Link a recipe to this meal.
   * If the same recipe is already linked, its servings are incremented.
   * Returns the updated ScheduledMeal.
   */
  linkRecipe(mealId: string, dto: LinkRecipeDto): Observable<ScheduledMeal> {
    return this.api.post<ScheduledMeal>(`/scheduled-meals/${mealId}/link-recipe`, dto);
  }

  /**
   * Remove a recipe link from this meal.
   * Returns the updated ScheduledMeal.
   */
  unlinkRecipe(mealId: string, recipeId: string): Observable<ScheduledMeal> {
    return this.api.delete<ScheduledMeal>(`/scheduled-meals/${mealId}/link-recipe/${recipeId}`);
  }

  /**
   * Clone all scheduled meals (with linked recipes) from one date to another.
   * Replaces any existing meals on the target date.
   */
  clone(from: string, to: string): Observable<ScheduledMeal[]> {
    return this.api.post<ScheduledMeal[]>('/scheduled-meals/clone', { from, to });
  }

  /**
   * Auto-link recipes from active RecipeSchedules that match the given
   * date's day-of-week. Returns the updated meal list.
   */
  applySchedules(date: string): Observable<ScheduledMeal[]> {
    return this.api.post<ScheduledMeal[]>('/scheduled-meals/apply-schedules', { date });
  }
}
