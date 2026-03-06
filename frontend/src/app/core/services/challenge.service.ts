import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Challenge } from '../models';

@Injectable({ providedIn: 'root' })
export class ChallengeService {
  private api = inject(ApiService);

  list(): Observable<Challenge[]> {
    return this.api.get<Challenge[]>('/challenges');
  }

  join(challengeId: string): Observable<unknown> {
    return this.api.post(`/challenges/${challengeId}/join`, {});
  }

  check(challengeId: string): Observable<{ xpAwarded: number; totalXp: number }> {
    return this.api.post<{ xpAwarded: number; totalXp: number }>(`/challenges/${challengeId}/check`, {});
  }
}
