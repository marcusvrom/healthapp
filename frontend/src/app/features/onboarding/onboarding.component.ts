import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ProfileService } from '../../core/services/profile.service';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { WorkoutService } from '../../core/services/workout.service';
import { CommonModule, DecimalPipe } from '@angular/common';
import {
  ActivityFactor, Gender, PrimaryGoal,
  MainActivity, MetabolicResult, WorkoutTemplate,
} from '../../core/models';

// ── Local step interfaces ───────────────────────────────────────────────────
interface PersonalStep  { name: string; age: number|null; gender: Gender|''; weight: number|null; height: number|null; }
interface ScheduleStep  {
  wakeUpTime: string; sleepTime: string;
  mainActivity: MainActivity|'';
  workStartTime: string; workEndTime: string;
}
interface ActivityStep  { activityFactor: ActivityFactor|''; }
interface GoalStep      { primaryGoal: PrimaryGoal|''; targetWeight: number|null; }
interface RoutineBaseStep {
  wakeUpTime: string;
  sleepTime: string;
  preferredTrainTime: string;
  meals: Record<string, boolean>;
  waterReminders: boolean;
  waterIntervalMin: number;
}

const WATER_INTERVAL_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 30,  label: 'A cada 30 min' },
  { value: 45,  label: 'A cada 45 min' },
  { value: 60,  label: 'A cada 1 hora' },
  { value: 90,  label: 'A cada 1h30' },
  { value: 120, label: 'A cada 2 horas' },
];

// ── Constants ───────────────────────────────────────────────────────────────
const STEPS = ['Pessoal', 'Horários', 'Atividade', 'Objetivo', 'Resumo e Rotina'];

const GOAL_OPTIONS: Array<{ value: PrimaryGoal; icon: string; label: string; desc: string; kcal: string }> = [
  { value: 'emagrecimento', icon: '🔥', label: 'Emagrecimento',   desc: 'Perder peso com déficit calórico controlado', kcal: '-500 kcal/dia' },
  { value: 'ganho_massa',   icon: '💪', label: 'Ganho de Massa',  desc: 'Ganhar músculo com superávit calórico',        kcal: '+400 kcal/dia' },
  { value: 'manutencao',    icon: '⚖️', label: 'Manutenção',      desc: 'Manter o peso atual com equilíbrio calórico',  kcal: '0 kcal' },
  { value: 'saude_geral',   icon: '🌿', label: 'Saúde Geral',     desc: 'Melhorar hábitos e bem-estar geral',           kcal: '0 kcal' },
];

const ACTIVITY_OPTIONS: Array<{ value: ActivityFactor; label: string; desc: string; icon: string }> = [
  { value: 'sedentary',          icon: '🪑', label: 'Sedentário',          desc: 'Pouca movimentação, sem exercícios' },
  { value: 'lightly_active',     icon: '🚶', label: 'Levemente ativo',     desc: 'Exercício leve 1-3x por semana' },
  { value: 'moderately_active',  icon: '🏃', label: 'Moderadamente ativo', desc: 'Exercício moderado 3-5x por semana' },
  { value: 'very_active',        icon: '💪', label: 'Muito ativo',         desc: 'Exercício intenso 6-7x por semana' },
  { value: 'extra_active',       icon: '🏋️', label: 'Extremamente ativo', desc: 'Atividade física intensa + treinos diários' },
];

const MAIN_ACTIVITY_OPTIONS: Array<{ value: MainActivity; icon: string; label: string; desc: string }> = [
  { value: 'work',     icon: '💼', label: 'Trabalho',               desc: 'Tenho horário fixo de trabalho' },
  { value: 'study',    icon: '📚', label: 'Estudos',                desc: 'Sou estudante com horário definido' },
  { value: 'mixed',    icon: '💼📚', label: 'Misto (Trabalho + Estudos)', desc: 'Concilio trabalho e estudos' },
  { value: 'flexible', icon: '🌊', label: 'Livre/Flexível',         desc: 'Não tenho horário fixo de atividade' },
];

const MEAL_OPTIONS: Array<{ key: string; label: string; icon: string; time: string }> = [
  { key: 'breakfast',       label: 'Café da Manhã',    icon: '☕', time: '07:30' },
  { key: 'morning_snack',   label: 'Lanche da Manhã',  icon: '🍎', time: '10:00' },
  { key: 'lunch',           label: 'Almoço',           icon: '🍽️', time: '12:30' },
  { key: 'afternoon_snack', label: 'Lanche da Tarde',  icon: '🥤', time: '15:30' },
  { key: 'dinner',          label: 'Jantar',           icon: '🍲', time: '19:30' },
  { key: 'supper',          label: 'Ceia',             icon: '🌙', time: '21:30' },
];

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [FormsModule, CommonModule, ReactiveFormsModule, DecimalPipe],
  styleUrls: ['./onboarding.component.scss'],
  templateUrl: './onboarding.component.html',
})
export class OnboardingComponent {
  private profileSvc  = inject(ProfileService);
  private authSvc     = inject(AuthService);
  private apiSvc      = inject(ApiService);
  private workoutSvc  = inject(WorkoutService);
  private router      = inject(Router);

  step    = signal(0);
  saving  = signal(false);
  errorMsg= signal('');
  metabolic = signal<MetabolicResult | null>(null);

  // ── Workout template state ──────────────────────────────────────────────────
  workoutTemplates = signal<WorkoutTemplate[]>([]);
  selectedTemplate = signal<WorkoutTemplate | null>(null);
  templateFilter   = signal<string>('all');
  creatingFromTemplate = signal(false);

  readonly steps               = STEPS;
  readonly goalOptions         = GOAL_OPTIONS;
  readonly activityOptions     = ACTIVITY_OPTIONS;
  readonly mainActivityOptions = MAIN_ACTIVITY_OPTIONS;
  readonly mealOptions            = MEAL_OPTIONS;
  readonly waterIntervalOptions  = WATER_INTERVAL_OPTIONS;
  readonly genderOptions       = [
    { value: 'male' as Gender,   emoji: '👨', label: 'Masculino' },
    { value: 'female' as Gender, emoji: '👩', label: 'Feminino'  },
    { value: 'other' as Gender,  emoji: '🧑', label: 'Outro'     },
  ];

  personal: PersonalStep = { name: '', age: null, gender: '', weight: null, height: null };
  schedule: ScheduleStep = {
    wakeUpTime: '07:00', sleepTime: '23:00',
    mainActivity: '',
    workStartTime: '09:00', workEndTime: '18:00',
  };
  activity: ActivityStep = { activityFactor: '' };
  goal:     GoalStep     = { primaryGoal: '', targetWeight: null };
  routineBase: RoutineBaseStep = {
    wakeUpTime: '07:00',
    sleepTime: '23:00',
    preferredTrainTime: '07:00',
    meals: {
      breakfast: true,
      morning_snack: false,
      lunch: true,
      afternoon_snack: false,
      dinner: true,
      supper: false,
    },
    waterReminders: true,
    waterIntervalMin: 45,
  };


  // ── Main activity helpers ──────────────────────────────────────────────────

  hasFixedSchedule(): boolean {
    const ma = this.schedule.mainActivity;
    return ma === 'work' || ma === 'study' || ma === 'mixed';
  }

  activityStartLabel(): string {
    switch (this.schedule.mainActivity) {
      case 'study': return '📚 Início dos estudos';
      case 'mixed': return '💼 Início da atividade';
      default:      return '💼 Início do trabalho';
    }
  }

  activityEndLabel(): string {
    switch (this.schedule.mainActivity) {
      case 'study': return '🏠 Fim dos estudos';
      case 'mixed': return '🏠 Fim da atividade';
      default:      return '🏠 Fim do trabalho';
    }
  }

  goalLabel(): string {
    return GOAL_OPTIONS.find(g => g.value === this.goal.primaryGoal)?.label ?? '';
  }

  hasSelectedMeals(): boolean {
    return Object.values(this.routineBase.meals).some(v => v);
  }

  // ── Workout template helpers ──────────────────────────────────────────────────

  get filteredTemplates(): WorkoutTemplate[] {
    const f = this.templateFilter();
    const templates = this.workoutTemplates();
    if (f === 'all') return templates;
    return templates.filter(t => t.category === f);
  }

  get templateCategories(): string[] {
    return [...new Set(this.workoutTemplates().map(t => t.category))];
  }

  selectTemplate(tpl: WorkoutTemplate): void {
    this.selectedTemplate.set(
      this.selectedTemplate()?.slug === tpl.slug ? null : tpl
    );
  }

  skipTemplate(): void {
    this.selectedTemplate.set(null);
  }

  readonly CATEGORY_ICONS: Record<string, string> = {
    PPL: '🏋️', 'Upper/Lower': '💪', Atletismo: '🏃', Cardio: '❤️‍🔥',
    'Full Body': '🔥', ABC: '🅰️', Pilates: '🧘‍♀️', Natacao: '🏊',
    Yoga: '🕉️', Ciclismo: '🚴',
  };

  categoryIcon(cat: string): string { return this.CATEGORY_ICONS[cat] ?? '📋'; }

  // ── Step navigation ────────────────────────────────────────────────────────

  canProceed(): boolean {
    switch (this.step()) {
      case 0: return !!this.personal.name && !!this.personal.age && !!this.personal.gender
                  && !!this.personal.weight && !!this.personal.height;
      case 1: return !!this.schedule.wakeUpTime && !!this.schedule.sleepTime && !!this.schedule.mainActivity;
      case 2: return !!this.activity.activityFactor;
      case 3: return !!this.goal.primaryGoal;
      default: return false;
    }
  }

  next(): void {
    if (!this.canProceed()) return;

    const currentStep = this.step();

    // When leaving step 3 (Goal) → save profile, then load metabolic for step 4
    if (currentStep === 3) {
      this.saveProfileAndPrepareFinish();
      return;
    }

    this.step.update(s => s + 1);
  }

  back(): void { this.step.update(s => Math.max(0, s - 1)); }

  // ── Save profile, then advance to step 4 with metabolic data ──

  private saveProfileAndPrepareFinish(): void {
    this.saving.set(true);
    this.step.set(4);

    const profileDto: Record<string, unknown> = {
      age:            this.personal.age!,
      weight:         this.personal.weight!,
      height:         this.personal.height!,
      gender:         this.personal.gender as Gender,
      activityFactor: this.activity.activityFactor as ActivityFactor,
      wakeUpTime:     this.schedule.wakeUpTime,
      sleepTime:      this.schedule.sleepTime,
      mainActivity:   this.schedule.mainActivity || undefined,
      primaryGoal:    this.goal.primaryGoal || undefined,
      targetWeight:   this.goal.targetWeight ?? undefined,
    };

    // Only include work times if user has a fixed schedule
    if (this.hasFixedSchedule()) {
      profileDto['workStartTime'] = this.schedule.workStartTime;
      profileDto['workEndTime']   = this.schedule.workEndTime;
    }

    this.profileSvc.saveProfile(profileDto as any).subscribe({
      next: () => this.loadMetabolicAndShow(),
      error: () => { this.errorMsg.set('Erro ao salvar perfil.'); this.saving.set(false); },
    });
  }

  private loadMetabolicAndShow(): void {
    this.profileSvc.loadMetabolic().subscribe({
      next: m => {
        this.metabolic.set(m);
        // Pre-fill routine base from schedule step
        this.routineBase.wakeUpTime = this.schedule.wakeUpTime;
        this.routineBase.sleepTime  = this.schedule.sleepTime;
        this.routineBase.preferredTrainTime = this.routineBase.preferredTrainTime || '07:00';
        this.saving.set(false);
      },
      error: () => {
        this.errorMsg.set('Erro ao calcular metas metabólicas.');
        this.saving.set(false);
      },
    });
    // Load workout templates for the template picker
    this.workoutSvc.getTemplates().subscribe({
      next: t => this.workoutTemplates.set(t),
      error: () => {},
    });
  }

  // ── Finish: call onboarding/complete endpoint ────────────────────────────

  finish(): void {
    this.saving.set(true);
    this.errorMsg.set('');

    const selectedMeals = Object.entries(this.routineBase.meals)
      .filter(([, v]) => v)
      .map(([key]) => key);

    const tpl = this.selectedTemplate();

    const payload: Record<string, unknown> = {
      wakeUpTime:         this.routineBase.wakeUpTime,
      sleepTime:          this.routineBase.sleepTime,
      preferredTrainTime: this.routineBase.preferredTrainTime,
      meals:              selectedMeals,
      waterReminders:     this.routineBase.waterReminders,
      waterIntervalMin:   this.routineBase.waterReminders ? this.routineBase.waterIntervalMin : undefined,
    };

    // Pass only duration so the backend can size the exercise block correctly,
    // but do NOT send exercises — the worksheet is created via createFromTemplate below.
    if (tpl) {
      payload['exerciseDurationMin'] = tpl.estimatedMinutes;
    }

    // Complete onboarding first
    this.apiSvc.post('/onboarding/complete', payload).subscribe({
      next: () => {
        // If user chose a template, create the workout sheet from it
        if (tpl) {
          this.workoutSvc.createFromTemplate(tpl.slug).subscribe({
            next: () => {
              this.authSvc.markOnboarded();
              this.router.navigate(['/dashboard']);
            },
            error: () => {
              // Onboarding completed successfully, just navigate even if template creation fails
              this.authSvc.markOnboarded();
              this.router.navigate(['/dashboard']);
            },
          });
        } else {
          this.authSvc.markOnboarded();
          this.router.navigate(['/dashboard']);
        }
      },
      error: () => {
        this.errorMsg.set('Erro ao finalizar onboarding. Tente novamente.');
        this.saving.set(false);
      },
    });
  }
}
