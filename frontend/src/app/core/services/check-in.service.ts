import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { WeeklyCheckIn } from '../models';

export interface CreateCheckInDto {
  date?: string;
  currentWeight: number;
  waistCircumference?: number;
  adherenceScore: number;
  notes?: string;
}

export interface AdherenceStatDay {
  date: string;
  total: number;
  completed: number;
  pct: number;
}

export interface AdherenceResult {
  adherenceScore: number | null;
  weekPct: number | null;
  dailyStats: AdherenceStatDay[];
}

@Injectable({ providedIn: 'root' })
export class CheckInService {
  private api = inject(ApiService);

  list(): Observable<WeeklyCheckIn[]> {
    return this.api.get<WeeklyCheckIn[]>('/check-ins');
  }

  latest(): Observable<WeeklyCheckIn | null> {
    return this.api.get<WeeklyCheckIn | null>('/check-ins/latest');
  }

  create(dto: CreateCheckInDto): Observable<WeeklyCheckIn> {
    return this.api.post<WeeklyCheckIn>('/check-ins', dto);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/check-ins/${id}`);
  }

  adherence(): Observable<AdherenceResult> {
    return this.api.get<AdherenceResult>('/check-ins/adherence');
  }
}
