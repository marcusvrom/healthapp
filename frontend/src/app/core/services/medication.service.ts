import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface Medication {
  id: string;
  userId: string;
  name: string;
  type: 'SUPLEMENTO' | 'VITAMINA' | 'REMEDIO_CONTROLADO' | 'TRT';
  dosage: string;
  scheduledTime: string;
  notes?: string;
  isActive: boolean;
}

export interface MedicationLog {
  id: string;
  medicationId: string;
  takenDate: string;
  takenAt: string;
  xpAwarded: boolean;
}

export interface MedicationWithLog extends Medication {
  log?: MedicationLog;
}

export interface MedicationToggleResult {
  taken: boolean;
  xpGained: number;
  totalXp: number;
}

@Injectable({ providedIn: 'root' })
export class MedicationService {
  private api = inject(ApiService);

  list(): Observable<Medication[]> {
    return this.api.get<Medication[]>('/medications');
  }

  create(dto: Partial<Medication>): Observable<Medication> {
    return this.api.post<Medication>('/medications', dto);
  }

  update(id: string, dto: Partial<Medication>): Observable<Medication> {
    return this.api.patch<Medication>(`/medications/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/medications/${id}`);
  }

  logsForDate(date: string): Observable<MedicationWithLog[]> {
    return this.api.get<MedicationWithLog[]>('/medications/logs', { date });
  }

  toggle(id: string, date?: string): Observable<MedicationToggleResult> {
    return this.api.patch<MedicationToggleResult>(`/medications/${id}/toggle`, date ? { date } : {});
  }
}
