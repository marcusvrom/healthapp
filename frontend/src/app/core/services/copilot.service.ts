import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { CopilotInsight, FeedbackResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class CopilotService {
  private api = inject(ApiService);

  getInsights(): Observable<CopilotInsight[]> {
    return this.api.get<CopilotInsight[]>('/copilot/insights');
  }

  /** Daily Copilot analysis for the Canvas: checks sleep, exercise, calories, water, protein. */
  getFeedback(date: string): Observable<FeedbackResponse> {
    return this.api.get<FeedbackResponse>('/routine/feedback', { date });
  }
}
