import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

interface WorkoutSheet {
  id: string;
  name: string;
  exercises?: Array<{ id: string; name: string; sets: number; reps: string }>;
}

interface ExerciseLog {
  id: string;
  exerciseName: string;
  logDate: string;
  sets: number;
  reps: string;
  weightKg: number;
  notes?: string;
}

interface ProgressionPoint {
  date: string;
  maxWeight: number;
  totalVolume: number;
  maxSets: number;
  maxReps: string;
}

@Component({
  selector: 'app-workout-progression',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './workout-progression.component.html',
  styleUrls: ['./workout-progression.component.scss'],
})
export class WorkoutProgressionComponent implements OnInit {
  private api = inject(ApiService);

  sheets = signal<WorkoutSheet[]>([]);
  selectedSheet = signal<WorkoutSheet | null>(null);
  logs = signal<ExerciseLog[]>([]);
  loading = signal(true);

  // Log exercise form
  showLogForm = signal(false);
  logExerciseName = signal('');
  logSets = signal(3);
  logReps = signal('10');
  logWeight = signal(0);
  logNotes = signal('');
  saving = signal(false);

  // Progression view
  selectedExercise = signal<string | null>(null);
  progression = signal<ProgressionPoint[]>([]);
  loadingProgression = signal(false);

  exerciseNames = computed(() => {
    const sheet = this.selectedSheet();
    if (!sheet?.exercises) return [];
    return sheet.exercises.map(e => e.name);
  });

  recentLogs = computed(() => {
    return this.logs().slice(0, 20);
  });

  maxWeightInProgression = computed(() => {
    const pts = this.progression();
    return pts.length ? Math.max(...pts.map(p => p.maxWeight)) : 0;
  });

  ngOnInit() {
    this.loadSheets();
  }

  loadSheets() {
    this.loading.set(true);
    this.api.get<WorkoutSheet[]>('/workouts').subscribe({
      next: (s) => {
        this.sheets.set(s);
        if (s.length > 0) this.selectSheet(s[0]);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  selectSheet(sheet: WorkoutSheet) {
    this.selectedSheet.set(sheet);
    this.selectedExercise.set(null);
    this.progression.set([]);
    this.loadLogs(sheet.id);
  }

  loadLogs(sheetId: string) {
    this.api.get<ExerciseLog[]>(`/workouts/${sheetId}/logs`).subscribe({
      next: (logs) => this.logs.set(logs),
      error: () => this.logs.set([]),
    });
  }

  openLogForm(exerciseName?: string) {
    this.showLogForm.set(true);
    if (exerciseName) this.logExerciseName.set(exerciseName);
  }

  closeLogForm() {
    this.showLogForm.set(false);
    this.logExerciseName.set('');
    this.logSets.set(3);
    this.logReps.set('10');
    this.logWeight.set(0);
    this.logNotes.set('');
  }

  saveLog() {
    const sheet = this.selectedSheet();
    if (!sheet || !this.logExerciseName()) return;

    this.saving.set(true);
    this.api.post(`/workouts/${sheet.id}/log`, {
      exerciseName: this.logExerciseName(),
      sets: this.logSets(),
      reps: this.logReps(),
      weightKg: this.logWeight(),
      notes: this.logNotes() || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeLogForm();
        this.loadLogs(sheet.id);
      },
      error: () => this.saving.set(false),
    });
  }

  deleteLog(logId: string) {
    this.api.delete(`/workouts/logs/${logId}`).subscribe({
      next: () => {
        const sheet = this.selectedSheet();
        if (sheet) this.loadLogs(sheet.id);
      },
    });
  }

  viewProgression(exerciseName: string) {
    this.selectedExercise.set(exerciseName);
    this.loadingProgression.set(true);
    this.api.get<{ exerciseName: string; data: ProgressionPoint[] }>(
      `/workouts/progression/${encodeURIComponent(exerciseName)}`
    ).subscribe({
      next: (res) => { this.progression.set(res.data); this.loadingProgression.set(false); },
      error: () => this.loadingProgression.set(false),
    });
  }

  barHeight(weight: number): number {
    const max = this.maxWeightInProgression();
    return max > 0 ? (weight / max) * 100 : 0;
  }
}
