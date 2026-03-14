import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { WorkoutSheet, WorkoutTemplate, WorkoutSheetExercise, RoutineBlock } from '../models';

@Injectable({ providedIn: 'root' })
export class WorkoutService {
  private api = inject(ApiService);

  // ── Templates ──────────────────────────────────────────────────────
  getTemplates(): Observable<WorkoutTemplate[]> {
    return this.api.get<WorkoutTemplate[]>('/workouts/templates');
  }

  createFromTemplate(slug: string, name?: string, daysOfWeek?: number[]): Observable<WorkoutSheet> {
    return this.api.post<WorkoutSheet>('/workouts/from-template', { slug, name, daysOfWeek });
  }

  // ── Sheets CRUD ────────────────────────────────────────────────────
  list(): Observable<WorkoutSheet[]> {
    return this.api.get<WorkoutSheet[]>('/workouts');
  }

  detail(id: string): Observable<WorkoutSheet> {
    return this.api.get<WorkoutSheet>(`/workouts/${id}`);
  }

  create(data: Partial<WorkoutSheet>): Observable<WorkoutSheet> {
    return this.api.post<WorkoutSheet>('/workouts', data);
  }

  update(id: string, data: Partial<WorkoutSheet>): Observable<WorkoutSheet> {
    return this.api.patch<WorkoutSheet>(`/workouts/${id}`, data);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/workouts/${id}`);
  }

  // ── Sheet Exercises ────────────────────────────────────────────────
  addExercise(sheetId: string, data: Partial<WorkoutSheetExercise>): Observable<WorkoutSheetExercise> {
    return this.api.post<WorkoutSheetExercise>(`/workouts/${sheetId}/exercises`, data);
  }

  updateExercise(sheetId: string, exId: string, data: Partial<WorkoutSheetExercise>): Observable<WorkoutSheetExercise> {
    return this.api.patch<WorkoutSheetExercise>(`/workouts/${sheetId}/exercises/${exId}`, data);
  }

  removeExercise(sheetId: string, exId: string): Observable<void> {
    return this.api.delete<void>(`/workouts/${sheetId}/exercises/${exId}`);
  }

  // ── Schedule to routine ──────────────────────────────────────────
  schedule(sheetId: string, data: {
    startTime: string; endTime: string;
    routineDate?: string; isRecurring?: boolean; daysOfWeek?: number[];
  }): Observable<RoutineBlock> {
    return this.api.post<RoutineBlock>(`/workouts/${sheetId}/schedule`, data);
  }
}
