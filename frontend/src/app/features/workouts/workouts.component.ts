import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { WorkoutService } from '../../core/services/workout.service';
import { WorkoutSheet, WorkoutTemplate, WorkoutSheetExercise } from '../../core/models';

type Tab = 'sheets' | 'templates';
type ModalMode = 'none' | 'create' | 'edit' | 'detail' | 'add-exercise' | 'schedule';

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  PPL:          { icon: '🏋️', color: '#059669' },
  'Upper/Lower': { icon: '💪', color: '#2563eb' },
  Atletismo:    { icon: '🏃', color: '#d97706' },
  Cardio:       { icon: '❤️‍🔥', color: '#ef4444' },
  'Full Body':  { icon: '🔥', color: '#7c3aed' },
  ABC:          { icon: '🅰️', color: '#0891b2' },
};

@Component({
  selector: 'app-workouts',
  standalone: true,
  imports: [FormsModule, DatePipe],
  styleUrls: ['./workouts.component.scss'],
  templateUrl: './workouts.component.html',
})
export class WorkoutsComponent implements OnInit {
  private svc = inject(WorkoutService);

  tab = signal<Tab>('sheets');
  loading = signal(false);

  // ── Sheets ──────────────────────────────────────────────────────────
  sheets = signal<WorkoutSheet[]>([]);

  // ── Templates ───────────────────────────────────────────────────────
  templates = signal<WorkoutTemplate[]>([]);
  templateFilter = signal<string>('all');

  // ── Modal state ─────────────────────────────────────────────────────
  modal = signal<ModalMode>('none');
  selectedSheet = signal<WorkoutSheet | null>(null);

  // Create/edit form
  formName = '';
  formDesc = '';
  formCategory = '';
  formMinutes = 60;
  formDays: boolean[] = [false, false, false, false, false, false, false];

  // Add exercise form
  exName = '';
  exSets = 3;
  exReps = '8-12';
  exRest = 60;
  exNotes = '';

  // Schedule form
  schedStartTime = '07:00';
  schedEndTime = '08:00';
  schedDate = new Date().toISOString().slice(0, 10);
  schedDays: boolean[] = [false, false, false, false, false, false, false];
  scheduling = signal(false);

  ngOnInit(): void {
    this.loadSheets();
    this.svc.getTemplates().subscribe({
      next: t => this.templates.set(t),
    });
  }

  setTab(t: Tab): void { this.tab.set(t); }

  // ── Sheets ──────────────────────────────────────────────────────────

  private loadSheets(): void {
    this.loading.set(true);
    this.svc.list().subscribe({
      next: s => { this.sheets.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openCreate(): void {
    this.formName = '';
    this.formDesc = '';
    this.formCategory = '';
    this.formMinutes = 60;
    this.formDays = [false, false, false, false, false, false, false];
    this.modal.set('create');
  }

  openEdit(sheet: WorkoutSheet): void {
    this.selectedSheet.set(sheet);
    this.formName = sheet.name;
    this.formDesc = sheet.description ?? '';
    this.formCategory = sheet.category ?? '';
    this.formMinutes = sheet.estimatedMinutes;
    this.formDays = [0, 1, 2, 3, 4, 5, 6].map(d => sheet.daysOfWeek.includes(d));
    this.modal.set('edit');
  }

  openDetail(sheet: WorkoutSheet): void {
    this.selectedSheet.set(sheet);
    this.modal.set('detail');
  }

  closeModal(): void {
    this.modal.set('none');
    this.selectedSheet.set(null);
  }

  submitCreate(): void {
    if (!this.formName.trim()) return;
    const daysOfWeek = this.formDays.map((v, i) => v ? i : -1).filter(i => i >= 0);
    this.svc.create({
      name: this.formName.trim(),
      description: this.formDesc.trim() || undefined,
      category: this.formCategory.trim() || undefined,
      estimatedMinutes: this.formMinutes,
      daysOfWeek,
    } as any).subscribe({
      next: s => {
        this.sheets.update(arr => [s, ...arr]);
        this.closeModal();
      },
    });
  }

  submitEdit(): void {
    const sheet = this.selectedSheet();
    if (!sheet || !this.formName.trim()) return;
    const daysOfWeek = this.formDays.map((v, i) => v ? i : -1).filter(i => i >= 0);
    this.svc.update(sheet.id, {
      name: this.formName.trim(),
      description: this.formDesc.trim() || undefined,
      category: this.formCategory.trim() || undefined,
      estimatedMinutes: this.formMinutes,
      daysOfWeek,
    } as any).subscribe({
      next: updated => {
        this.sheets.update(arr => arr.map(s => s.id === updated.id ? { ...s, ...updated } : s));
        this.closeModal();
      },
    });
  }

  deleteSheet(sheet: WorkoutSheet): void {
    if (!confirm(`Excluir a ficha "${sheet.name}"? Esta acao nao pode ser desfeita.`)) return;
    this.svc.remove(sheet.id).subscribe({
      next: () => {
        this.sheets.update(arr => arr.filter(s => s.id !== sheet.id));
        if (this.selectedSheet()?.id === sheet.id) this.closeModal();
      },
    });
  }

  // ── Exercises in detail view ────────────────────────────────────────

  openAddExercise(): void {
    this.exName = '';
    this.exSets = 3;
    this.exReps = '8-12';
    this.exRest = 60;
    this.exNotes = '';
    this.modal.set('add-exercise');
  }

  backToDetail(): void {
    this.modal.set('detail');
  }

  submitAddExercise(): void {
    const sheet = this.selectedSheet();
    if (!sheet || !this.exName.trim()) return;
    this.svc.addExercise(sheet.id, {
      name: this.exName.trim(),
      sets: this.exSets,
      reps: this.exReps,
      restSeconds: this.exRest,
      notes: this.exNotes.trim() || undefined,
    } as any).subscribe({
      next: ex => {
        const updated = { ...sheet, exercises: [...(sheet.exercises ?? []), ex] };
        this.selectedSheet.set(updated);
        this.sheets.update(arr => arr.map(s => s.id === sheet.id ? updated : s));
        this.backToDetail();
      },
    });
  }

  removeExercise(ex: WorkoutSheetExercise): void {
    const sheet = this.selectedSheet();
    if (!sheet) return;
    this.svc.removeExercise(sheet.id, ex.id).subscribe({
      next: () => {
        const updated = { ...sheet, exercises: (sheet.exercises ?? []).filter(e => e.id !== ex.id) };
        this.selectedSheet.set(updated);
        this.sheets.update(arr => arr.map(s => s.id === sheet.id ? updated : s));
      },
    });
  }

  // ── Templates ───────────────────────────────────────────────────────

  get filteredTemplates(): WorkoutTemplate[] {
    const f = this.templateFilter();
    if (f === 'all') return this.templates();
    return this.templates().filter(t => t.category === f);
  }

  get templateCategories(): string[] {
    return [...new Set(this.templates().map(t => t.category))];
  }

  useTemplate(tpl: WorkoutTemplate): void {
    this.svc.createFromTemplate(tpl.slug).subscribe({
      next: sheet => {
        this.sheets.update(arr => [sheet, ...arr]);
        this.tab.set('sheets');
        this.openDetail(sheet);
      },
    });
  }

  // ── Schedule to routine ──────────────────────────────────────────────

  openSchedule(): void {
    const sheet = this.selectedSheet();
    if (!sheet) return;
    this.schedStartTime = '07:00';
    const dur = sheet.estimatedMinutes ?? 60;
    const endMin = 7 * 60 + dur;
    const h = Math.floor(endMin / 60) % 24;
    const m = endMin % 60;
    this.schedEndTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    this.schedDate = new Date().toISOString().slice(0, 10);
    this.schedDays = sheet.daysOfWeek.length
      ? [0,1,2,3,4,5,6].map(d => sheet.daysOfWeek.includes(d))
      : [false, false, false, false, false, false, false];
    this.modal.set('schedule');
  }

  submitSchedule(): void {
    const sheet = this.selectedSheet();
    if (!sheet) return;
    const daysOfWeek = this.schedDays.map((v, i) => v ? i : -1).filter(i => i >= 0);
    const isRecurring = daysOfWeek.length > 0;
    this.scheduling.set(true);
    this.svc.schedule(sheet.id, {
      startTime: this.schedStartTime,
      endTime: this.schedEndTime,
      routineDate: isRecurring ? undefined : this.schedDate,
      isRecurring,
      daysOfWeek: isRecurring ? daysOfWeek : undefined,
    }).subscribe({
      next: () => {
        this.scheduling.set(false);
        this.closeModal();
        alert('Treino agendado no cronograma!');
      },
      error: () => this.scheduling.set(false),
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  dayLabel(d: number): string { return DAY_LABELS[d] ?? '?'; }

  daysText(days: number[]): string {
    if (!days.length) return 'Sem dias definidos';
    return days.map(d => DAY_LABELS[d]).join(', ');
  }

  categoryIcon(cat: string): string { return CATEGORY_META[cat]?.icon ?? '📋'; }
  categoryColor(cat: string): string { return CATEGORY_META[cat]?.color ?? '#6b7280'; }

  totalSets(sheet: WorkoutSheet): number {
    return (sheet.exercises ?? []).reduce((sum, e) => sum + e.sets, 0);
  }

  formatRest(seconds: number): string {
    return seconds >= 60 ? `${Math.floor(seconds / 60)}min` : `${seconds}s`;
  }
}
