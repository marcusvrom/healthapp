import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { WaterDayStats } from './water.service';

export interface WeightPoint { date: string; weightKg: number; }
export interface StreakData   { waterCurrentStreak: number; waterLongestStreak: number; }
export interface WeightLog    { id: string; weightKg: number; recordedAt: string; notes?: string; }

@Injectable({ providedIn: 'root' })
export class MetricsService {
  private api = inject(ApiService);

  weightHistory(limit = 30): Observable<WeightPoint[]> {
    return this.api.get<WeightPoint[]>('/metrics/weight', { limit: String(limit) });
  }

  logWeight(weightKg: number, recordedAt?: string, notes?: string): Observable<WeightLog> {
    return this.api.post<WeightLog>('/metrics/weight', { weightKg, recordedAt, notes });
  }

  waterConsistency(days = 7): Observable<WaterDayStats[]> {
    return this.api.get<WaterDayStats[]>('/metrics/water', { days: String(days) });
  }

  streaks(): Observable<StreakData> {
    return this.api.get<StreakData>('/metrics/streaks');
  }
}
