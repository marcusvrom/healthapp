import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ScheduledMeal, ToggleResult, ScheduledFoodItem } from '../models';

export interface CreateScheduledMealDto {
  scheduledDate?: string;
  name: string;
  scheduledTime: string;
  caloricTarget?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  foods?: ScheduledFoodItem[];
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class DietPlanService {
  private api = inject(ApiService);

  list(date?: string): Observable<ScheduledMeal[]> {
    return this.api.get<ScheduledMeal[]>('/scheduled-meals', date ? { date } : undefined);
  }

  create(dto: CreateScheduledMealDto): Observable<ScheduledMeal> {
    return this.api.post<ScheduledMeal>('/scheduled-meals', dto);
  }

  generate(date?: string): Observable<ScheduledMeal[]> {
    return this.api.post<ScheduledMeal[]>('/scheduled-meals/generate', date ? { date } : {});
  }

  toggle(id: string): Observable<ToggleResult> {
    return this.api.patch<ToggleResult>(`/scheduled-meals/${id}/toggle`, {});
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/scheduled-meals/${id}`);
  }
}
