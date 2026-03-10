import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { RecipeSchedule } from '../models';

export interface UpsertRecipeScheduleDto {
  mealName: string;
  recipeId: string;
  servings: number;
  /** 0=Sunday … 6=Saturday */
  daysOfWeek: number[];
}

@Injectable({ providedIn: 'root' })
export class RecipeScheduleService {
  private api = inject(ApiService);

  /** Fetch all active recipe schedules for the current user. */
  list(): Observable<RecipeSchedule[]> {
    return this.api.get<RecipeSchedule[]>('/recipe-schedules');
  }

  /**
   * Create or update a recipe schedule (upsert by mealName + recipeId).
   * Passing an empty daysOfWeek deactivates the schedule.
   */
  upsert(dto: UpsertRecipeScheduleDto): Observable<RecipeSchedule> {
    return this.api.post<RecipeSchedule>('/recipe-schedules', dto);
  }

  /** Delete a recipe schedule by ID. */
  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/recipe-schedules/${id}`);
  }
}
