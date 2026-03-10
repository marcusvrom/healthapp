import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { HealthProfile, MetabolicResult, BloodTest, Exercise, ExercisePreset } from '../models';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private api = inject(ApiService);

  readonly profile = signal<HealthProfile | null>(null);
  readonly metabolic = signal<MetabolicResult | null>(null);

  loadProfile() {
    return this.api.get<HealthProfile>('/profile').pipe(
      tap(p => this.profile.set(p))
    );
  }

  saveProfile(data: Partial<HealthProfile>) {
    return this.api.post<HealthProfile>('/profile', data).pipe(
      tap(p => this.profile.set(p))
    );
  }

  loadMetabolic() {
    return this.api.get<MetabolicResult>('/profile/metabolic').pipe(
      tap(m => this.metabolic.set(m))
    );
  }

  // ── Blood Tests ──────────────────────────────────────────────────────────
  getBloodTests()    { return this.api.get<BloodTest[]>('/blood-tests'); }
  saveBloodTest(dto: Partial<BloodTest>) { return this.api.post<BloodTest>('/blood-tests', dto); }
  getLatestAnalysis(){ return this.api.get<{ bloodTest: BloodTest; analysis: unknown }>('/blood-tests/latest/analysis'); }

  // ── Exercises ────────────────────────────────────────────────────────────
  getPresets()   { return this.api.get<ExercisePreset[]>('/exercises/presets'); }
  getExercises() { return this.api.get<Exercise[]>('/exercises'); }
  addExercise(dto: Partial<Exercise>) { return this.api.post<Exercise>('/exercises', dto); }
  updateExercise(id: string, dto: Partial<Exercise>) { return this.api.patch<Exercise>(`/exercises/${id}`, dto); }
  deleteExercise(id: string) { return this.api.delete<void>(`/exercises/${id}`); }
}
