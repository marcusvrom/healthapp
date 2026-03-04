import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  ClinicalProtocol,
  ClinicalProtocolWithLog,
  ProtocolToggleResult,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ClinicalProtocolService {
  private api = inject(ApiService);

  list(all = false): Observable<ClinicalProtocol[]> {
    return this.api.get<ClinicalProtocol[]>('/protocols', all ? { all: 'true' } : {});
  }

  create(dto: Partial<ClinicalProtocol>): Observable<ClinicalProtocol> {
    return this.api.post<ClinicalProtocol>('/protocols', dto);
  }

  update(id: string, dto: Partial<ClinicalProtocol>): Observable<ClinicalProtocol> {
    return this.api.patch<ClinicalProtocol>(`/protocols/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/protocols/${id}`);
  }

  logsForDate(date: string): Observable<ClinicalProtocolWithLog[]> {
    return this.api.get<ClinicalProtocolWithLog[]>('/protocols/logs', { date });
  }

  toggle(id: string, date?: string): Observable<ProtocolToggleResult> {
    return this.api.patch<ProtocolToggleResult>(`/protocols/${id}/toggle`, date ? { date } : {});
  }
}
