import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { RankingEntry, DailyCap, RankingScope } from '../models';

@Injectable({ providedIn: 'root' })
export class GamificationService {
  private api = inject(ApiService);

  getRanking(scope: RankingScope = 'global', limit = 50): Observable<RankingEntry[]> {
    return this.api.get<RankingEntry[]>('/gamification/ranking', {
      scope,
      limit: String(limit),
    });
  }

  /** @deprecated use getRanking('global') */
  getWeeklyRanking(limit = 50): Observable<RankingEntry[]> {
    return this.getRanking('global', limit);
  }

  getDailyCaps(): Observable<DailyCap[]> {
    return this.api.get<DailyCap[]>('/gamification/caps');
  }
}
