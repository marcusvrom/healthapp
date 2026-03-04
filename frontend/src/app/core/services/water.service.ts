import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';

export interface WaterLog { id: string; quantityMl: number; loggedAt: string; }
export interface WaterDay  { logs: WaterLog[]; totalMl: number; }
export interface WaterDayStats {
  date: string; consumedMl: number; goalMl: number; metGoal: boolean;
  logs: WaterLog[];
}

@Injectable({ providedIn: 'root' })
export class WaterService {
  private api = inject(ApiService);

  /** Reactive today's total — updated whenever add() or loadToday() resolves */
  readonly todayTotal = signal(0);
  readonly todayGoal  = signal(2000);
  readonly todayLogs  = signal<WaterLog[]>([]);

  add(quantityMl: number, loggedAt?: string): Observable<WaterLog> {
    return this.api.post<WaterLog>('/water', { quantityMl, loggedAt }).pipe(
      tap(() => this.loadToday().subscribe())
    );
  }

  loadToday(date?: string): Observable<WaterDay> {
    const params = date ? { date } : {};
    return this.api.get<WaterDay>('/water/today', params).pipe(
      tap(d => {
        this.todayTotal.set(d.totalMl);
        this.todayLogs.set(d.logs);
      })
    );
  }

  getHistory(days = 7): Observable<WaterDayStats[]> {
    return this.api.get<WaterDayStats[]>('/water/history', { days: String(days) });
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/water/${id}`).pipe(
      tap(() => this.loadToday().subscribe())
    );
  }

  setGoal(ml: number): void { this.todayGoal.set(ml); }
}
