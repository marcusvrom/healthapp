import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type HormoneCategory = 'TRT' | 'Female_Hormones' | 'Sleep' | 'Other';

export interface HormoneLog {
  id: string;
  category: HormoneCategory;
  name: string;
  dosage: number;
  unit: string;
  administeredAt: string;
  notes?: string;
  createdAt: string;
}

export interface HormoneListResponse { data: HormoneLog[]; total: number; }
export interface LatestPerCategory   { category: HormoneCategory; lastLog: HormoneLog; }

export interface LogHormoneDto {
  category: HormoneCategory;
  name: string;
  dosage: number;
  unit: string;
  administeredAt: string;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class HormoneService {
  private api = inject(ApiService);

  log(dto: LogHormoneDto): Observable<HormoneLog> {
    return this.api.post<HormoneLog>('/hormones', dto);
  }

  list(category?: HormoneCategory, page = 1, pageSize = 30): Observable<HormoneListResponse> {
    const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
    if (category) params['category'] = category;
    return this.api.get<HormoneListResponse>('/hormones', params);
  }

  latest(): Observable<LatestPerCategory[]> {
    return this.api.get<LatestPerCategory[]>('/hormones/latest');
  }

  update(id: string, dto: Partial<LogHormoneDto>): Observable<HormoneLog> {
    return this.api.patch<HormoneLog>(`/hormones/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/hormones/${id}`);
  }
}
