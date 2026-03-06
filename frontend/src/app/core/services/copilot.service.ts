import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { CopilotInsight } from '../models';

@Injectable({ providedIn: 'root' })
export class CopilotService {
  private api = inject(ApiService);

  getInsights(): Observable<CopilotInsight[]> {
    return this.api.get<CopilotInsight[]>('/copilot/insights');
  }
}
