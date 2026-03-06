import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { RankingEntry, DailyCap } from '../models';

@Injectable({ providedIn: 'root' })
export class GamificationService {
  private api = inject(ApiService);

  getWeeklyRanking(limit = 20): Observable<RankingEntry[]> {
    return this.api.get<RankingEntry[]>('/gamification/ranking', { limit: String(limit) });
  }

  getDailyCaps(): Observable<DailyCap[]> {
    return this.api.get<DailyCap[]>('/gamification/caps');
  }
}
