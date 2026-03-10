import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ClinicalHistory } from '../models';

@Injectable({ providedIn: 'root' })
export class ClinicalService {
  private api = inject(ApiService);

  history(days = 365): Observable<ClinicalHistory> {
    return this.api.get<ClinicalHistory>('/clinical/history', { days: String(days) });
  }
}
