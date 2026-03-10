import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Food, Meal, DailySummary } from '../models';

@Injectable({ providedIn: 'root' })
export class FoodService {
  private api = inject(ApiService);

  search(q: string, limit = 20): Observable<Food[]> {
    return this.api.get<Food[]>('/foods/search', { q, limit: String(limit) });
  }

  byBarcode(barcode: string): Observable<Food> {
    return this.api.get<Food>(`/foods/barcode/${barcode}`);
  }

  createCustom(dto: Partial<Food>): Observable<Food> {
    return this.api.post<Food>('/foods', dto);
  }

  // ── Meals ──────────────────────────────────────────────────────────────
  getMeals(date: string): Observable<Meal[]> {
    return this.api.get<Meal[]>('/meals', { date });
  }

  getSummary(date: string): Observable<DailySummary> {
    return this.api.get<DailySummary>('/meals/summary', { date });
  }

  createMeal(dto: {
    mealDate: string;
    mealType: string;
    notes?: string;
    foods?: Array<{ foodId: string; quantityG: number }>;
  }): Observable<Meal> {
    return this.api.post<Meal>('/meals', dto);
  }

  addFoodsToMeal(mealId: string, foods: Array<{ foodId: string; quantityG: number }>): Observable<Meal> {
    return this.api.post<Meal>(`/meals/${mealId}/foods`, { foods });
  }

  removeMealFood(mealId: string, mealFoodId: string): Observable<void> {
    return this.api.delete<void>(`/meals/${mealId}/foods/${mealFoodId}`);
  }

  deleteMeal(mealId: string): Observable<void> {
    return this.api.delete<void>(`/meals/${mealId}`);
  }
}
