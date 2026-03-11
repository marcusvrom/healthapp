import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { DailyMission } from '../models';

@Injectable({ providedIn: 'root' })
export class DailyMissionService {
  private api = inject(ApiService);

  getTodayMissions(): Observable<DailyMission[]> {
    return this.api.get<DailyMission[]>('/missions/today');
  }
}
