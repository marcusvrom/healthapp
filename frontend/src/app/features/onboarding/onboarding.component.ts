import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ProfileService } from '../../core/services/profile.service';
import { RoutineService } from '../../core/services/routine.service';
import { AuthService } from '../../core/services/auth.service';
import { CommonModule } from '@angular/common';
import { ExercisePreset, ActivityFactor, Gender, PrimaryGoal } from '../../core/models';

interface PersonalStep  { name: string; age: number|null; gender: Gender|''; weight: number|null; height: number|null; }
interface ScheduleStep  { wakeUpTime: string; sleepTime: string; workStartTime: string; workEndTime: string; }
interface ActivityStep  { activityFactor: ActivityFactor|''; }
interface ExerciseStep  { selected: ExercisePreset[]; daysOfWeek: number[]; preferredTime: string; durationMinutes: number; }
interface GoalStep      { primaryGoal: PrimaryGoal|''; targetWeight: number|null; }

const STEPS = ['Pessoal', 'Horários', 'Atividade', 'Exercícios', 'Objetivo', 'Pronto!'];

const GOAL_OPTIONS: Array<{ value: PrimaryGoal; icon: string; label: string; desc: string; kcal: string }> = [
  { value: 'emagrecimento', icon: '🔥', label: 'Emagrecimento',   desc: 'Perder peso com déficit calórico controlado', kcal: '−500 kcal/dia' },
  { value: 'ganho_massa',   icon: '💪', label: 'Ganho de Massa',  desc: 'Ganhar músculo com superávit calórico',        kcal: '+300 kcal/dia' },
  { value: 'manutencao',    icon: '⚖️', label: 'Manutenção',      desc: 'Manter o peso atual com equilíbrio calórico',  kcal: '0 kcal' },
  { value: 'saude_geral',   icon: '🌿', label: 'Saúde Geral',     desc: 'Melhorar hábitos e bem-estar geral',           kcal: '0 kcal' },
];
const DAYS  = ['D','S','T','Q','Q','S','S'];
const ACTIVITY_OPTIONS: Array<{ value: ActivityFactor; label: string; desc: string; icon: string }> = [
  { value: 'sedentary',          icon: '🪑', label: 'Sedentário',          desc: 'Trabalho de escritório, sem exercícios' },
  { value: 'lightly_active',     icon: '🚶', label: 'Levemente ativo',     desc: 'Exercício leve 1–3× por semana' },
  { value: 'moderately_active',  icon: '🏃', label: 'Moderadamente ativo', desc: 'Exercício moderado 3–5× por semana' },
  { value: 'very_active',        icon: '💪', label: 'Muito ativo',         desc: 'Exercício intenso 6–7× por semana' },
  { value: 'extra_active',       icon: '🏋️', label: 'Extremamente ativo', desc: 'Trabalho físico + treinos diários' },
];

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [FormsModule, CommonModule, ReactiveFormsModule],
  styles: [`
    :host { display: block; min-height: 100vh; background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 60%, #d1fae5 100%); }

    .onboarding {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Progress bar */
    .progress-bar {
      background: #fff;
      padding: 1.25rem 2rem;
      box-shadow: 0 1px 4px rgba(0,0,0,.06);
      display: flex;
      align-items: center;
      justify-content: space-between;

      .logo { font-size: 1.1rem; font-weight: 700; color: var(--color-primary); display: flex; align-items: center; gap: .5rem; }

      .steps {
        display: flex;
        align-items: center;
        gap: 0;

        .step-item {
          display: flex;
          align-items: center;

          .bubble {
            width: 32px; height: 32px;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: .78rem; font-weight: 700;
            border: 2px solid var(--color-border);
            background: var(--color-surface-2);
            color: var(--color-text-subtle);
            transition: all .3s;

            &.active   { border-color: var(--color-primary); background: var(--color-primary); color: #fff; }
            &.completed{ border-color: var(--color-primary); background: #dcfce7; color: var(--color-primary-dark); }
          }

          .step-label {
            font-size: .7rem; font-weight: 500;
            color: var(--color-text-subtle);
            margin-left: .35rem;
            &.active { color: var(--color-primary); }
          }

          .line { width: 2rem; height: 2px; background: var(--color-border); margin: 0 .35rem;
            &.done { background: var(--color-primary); }
          }
        }
      }

      @media (max-width: 600px) {
        .step-label { display: none; }
        .line { width: 1rem; }
      }
    }

    /* Main content */
    .content {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }

    .step-card {
      background: #fff;
      border-radius: 24px;
      padding: 2.5rem;
      box-shadow: 0 8px 40px rgba(0,0,0,.08);
      width: 100%;
      max-width: 600px;
      animation: fadeIn .35s ease;

      .step-header {
        margin-bottom: 2rem;
        .emoji { font-size: 2.5rem; display: block; margin-bottom: .75rem; }
        h2 { margin-bottom: .375rem; }
        p { font-size: .95rem; }
      }

      .fields { display: flex; flex-direction: column; gap: 1.25rem; }
      .row-2  { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
      .row-4  { display: grid; grid-template-columns: repeat(4, 1fr); gap: .75rem; }
    }

    /* Gender cards */
    .gender-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: .75rem; }
    .option-card {
      padding: 1rem;
      border: 2px solid var(--color-border);
      border-radius: var(--radius-md);
      cursor: pointer;
      text-align: center;
      transition: all .2s;
      background: var(--color-surface-2);

      .emoji { font-size: 1.75rem; display: block; margin-bottom: .5rem; }
      .label { font-size: .85rem; font-weight: 600; color: var(--color-text); }
      .desc  { font-size: .72rem; color: var(--color-text-subtle); margin-top: .25rem; }

      &:hover     { border-color: var(--color-primary-dark); }
      &.selected  { border-color: var(--color-primary); background: var(--color-primary-light); }
    }

    /* Activity cards */
    .activity-cards { display: flex; flex-direction: column; gap: .625rem; }
    .activity-card {
      display: flex; align-items: center; gap: 1rem;
      padding: 1rem 1.25rem;
      border: 2px solid var(--color-border);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all .2s;
      background: var(--color-surface-2);

      .icon  { font-size: 1.75rem; }
      .info  { flex: 1; }
      .title { font-weight: 600; font-size: .9rem; }
      .desc  { font-size: .78rem; color: var(--color-text-subtle); margin-top: .15rem; }
      .check { width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--color-border);
        display: flex; align-items: center; justify-content: center; font-size: .7rem; }

      &.selected { border-color: var(--color-primary); background: var(--color-primary-light);
        .check { background: var(--color-primary); border-color: var(--color-primary); color: #fff; }
      }
      &:hover { border-color: var(--color-primary); }
    }

    /* Exercise presets */
    .exercise-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: .625rem;
      @media (max-width: 480px) { grid-template-columns: 1fr; }
    }
    .exercise-card {
      padding: .875rem;
      border: 2px solid var(--color-border);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all .2s;
      background: var(--color-surface-2);

      .ex-name { font-size: .85rem; font-weight: 600; }
      .ex-meta { font-size: .72rem; color: var(--color-text-subtle); margin-top: .2rem; }

      &.selected { border-color: var(--color-primary); background: var(--color-primary-light); }
    }

    /* Day selector */
    .day-selector { display: flex; gap: .5rem; flex-wrap: wrap; }
    .day-btn {
      width: 36px; height: 36px; border-radius: 50%;
      border: 2px solid var(--color-border);
      background: var(--color-surface-2);
      cursor: pointer; font-size: .8rem; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      transition: all .2s;
      &.active { background: var(--color-primary); border-color: var(--color-primary); color: #fff; }
    }

    /* Goal cards */
    .goal-cards { display: flex; flex-direction: column; gap: .625rem; }
    .goal-card {
      display: flex; align-items: center; gap: 1rem;
      padding: 1rem 1.25rem;
      border: 2px solid var(--color-border);
      border-radius: var(--radius-md);
      cursor: pointer; transition: all .2s;
      background: var(--color-surface-2);

      .icon  { font-size: 1.75rem; }
      .info  { flex: 1; }
      .title { font-weight: 600; font-size: .9rem; }
      .desc  { font-size: .78rem; color: var(--color-text-subtle); margin-top: .15rem; }
      .kcal  { font-size: .75rem; font-weight: 700; color: var(--color-primary-dark);
        background: var(--color-primary-light); padding: .1rem .5rem; border-radius: 99px; white-space: nowrap; }
      .check { width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--color-border);
        display: flex; align-items: center; justify-content: center; font-size: .7rem; }

      &.selected { border-color: var(--color-primary); background: var(--color-primary-light);
        .check { background: var(--color-primary); border-color: var(--color-primary); color: #fff; }
      }
      &:hover { border-color: var(--color-primary); }
    }

    /* Done step */
    .done-step { text-align: center; padding: 1rem 0;
      .big-emoji { font-size: 4rem; display: block; margin-bottom: 1rem; animation: pulse 1.5s ease-in-out infinite; }
      h2 { font-size: 1.75rem; margin-bottom: .5rem; }
      p  { font-size: 1rem; margin-bottom: 2rem; }
      .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin: 1.5rem 0;
        .metric { background: var(--color-primary-light); border-radius: var(--radius-md); padding: .875rem;
          .value { font-size: 1.5rem; font-weight: 800; color: var(--color-primary-dark); }
          .label { font-size: .75rem; color: var(--color-text-muted); margin-top: .2rem; }
        }
      }
    }

    /* Navigation */
    .nav-btns {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 2rem; padding-top: 1.5rem;
      border-top: 1px solid var(--color-border);
    }
    .step-counter { font-size: .82rem; color: var(--color-text-subtle); }
  `],
  template: `
    <div class="onboarding">
      <!-- Progress bar -->
      <header class="progress-bar">
        <div class="logo">🌿 HealthApp</div>
        <div class="steps">
          @for (s of steps; track s; let i = $index) {
            <div class="step-item">
              <div class="bubble" [class.active]="step() === i" [class.completed]="step() > i">
                @if (step() > i) { ✓ } @else { {{ i + 1 }} }
              </div>
              <span class="step-label" [class.active]="step() === i">{{ s }}</span>
              @if (i < steps.length - 1) {
                <div class="line" [class.done]="step() > i"></div>
              }
            </div>
          }
        </div>
      </header>

      <!-- Step content -->
      <main class="content">
        <div class="step-card">

          <!-- Step 0: Personal info -->
          @if (step() === 0) {
            <div class="step-header">
              <span class="emoji">👤</span>
              <h2>Sobre você</h2>
              <p>Precisamos de algumas informações básicas para personalizar seu plano.</p>
            </div>
            <div class="fields">
              <div class="form-group">
                <label>Nome completo</label>
                <input type="text" [(ngModel)]="personal.name" placeholder="Como você quer ser chamado?" />
              </div>
              <div class="row-2">
                <div class="form-group">
                  <label>Idade (anos)</label>
                  <input type="number" [(ngModel)]="personal.age" min="10" max="120" placeholder="Ex: 28" />
                </div>
                <div class="form-group">
                  <label>Peso (kg)</label>
                  <input type="number" [(ngModel)]="personal.weight" min="30" max="300" step="0.1" placeholder="Ex: 75.5" />
                </div>
              </div>
              <div class="form-group">
                <label>Altura (cm)</label>
                <input type="number" [(ngModel)]="personal.height" min="100" max="250" placeholder="Ex: 175" />
              </div>
              <div class="form-group">
                <label>Gênero</label>
                <div class="gender-cards">
                  @for (g of genderOptions; track g.value) {
                    <div class="option-card" [class.selected]="personal.gender === g.value" (click)="personal.gender = g.value">
                      <span class="emoji">{{ g.emoji }}</span>
                      <div class="label">{{ g.label }}</div>
                    </div>
                  }
                </div>
              </div>
            </div>
          }

          <!-- Step 1: Schedule -->
          @if (step() === 1) {
            <div class="step-header">
              <span class="emoji">🕐</span>
              <h2>Sua rotina de horários</h2>
              <p>Vamos encaixar sua alimentação e exercícios nos momentos certos do seu dia.</p>
            </div>
            <div class="fields">
              <div class="row-2">
                <div class="form-group">
                  <label>⏰ Acorda às</label>
                  <input type="time" [(ngModel)]="schedule.wakeUpTime" />
                </div>
                <div class="form-group">
                  <label>🌙 Dorme às</label>
                  <input type="time" [(ngModel)]="schedule.sleepTime" />
                </div>
              </div>
              <div class="row-2">
                <div class="form-group">
                  <label>💼 Início do trabalho</label>
                  <input type="time" [(ngModel)]="schedule.workStartTime" />
                </div>
                <div class="form-group">
                  <label>🏠 Fim do trabalho</label>
                  <input type="time" [(ngModel)]="schedule.workEndTime" />
                </div>
              </div>
              <div class="alert alert-info">
                💡 Esses horários serão usados para distribuir refeições, hidratação e exercícios ao longo do dia.
              </div>
            </div>
          }

          <!-- Step 2: Activity level -->
          @if (step() === 2) {
            <div class="step-header">
              <span class="emoji">⚡</span>
              <h2>Nível de atividade profissional</h2>
              <p>Quanto você se movimenta durante um dia normal de trabalho?</p>
            </div>
            <div class="activity-cards">
              @for (a of activityOptions; track a.value) {
                <div class="activity-card" [class.selected]="activity.activityFactor === a.value" (click)="activity.activityFactor = a.value">
                  <span class="icon">{{ a.icon }}</span>
                  <div class="info">
                    <div class="title">{{ a.label }}</div>
                    <div class="desc">{{ a.desc }}</div>
                  </div>
                  <div class="check">@if (activity.activityFactor === a.value) { ✓ }</div>
                </div>
              }
            </div>
          }

          <!-- Step 3: Exercises -->
          @if (step() === 3) {
            <div class="step-header">
              <span class="emoji">🏋️</span>
              <h2>Atividades físicas</h2>
              <p>Selecione as atividades que você pratica (pode escolher mais de uma).</p>
            </div>
            @if (presets().length === 0) {
              <div class="flex items-center justify-center" style="padding:2rem">
                <span class="spinner"></span>
              </div>
            } @else {
              <div class="fields">
                <div class="exercise-grid">
                  @for (p of presets(); track p.name) {
                    <div class="exercise-card" [class.selected]="isExerciseSelected(p)" (click)="toggleExercise(p)">
                      <div class="ex-name">{{ categoryIcon(p.category) }} {{ p.name }}</div>
                      <div class="ex-meta">MET {{ p.met }} · Score hipertrofia: {{ p.hypertrophyScore }}/10</div>
                    </div>
                  }
                </div>

                @if (exercise.selected.length > 0) {
                  <div class="form-group">
                    <label>Dias da semana</label>
                    <div class="day-selector">
                      @for (d of days; track d; let i = $index) {
                        <button type="button" class="day-btn" [class.active]="isDaySelected(i)" (click)="toggleDay(i)">{{ d }}</button>
                      }
                    </div>
                  </div>
                  <div class="row-2">
                    <div class="form-group">
                      <label>Horário preferido</label>
                      <input type="time" [(ngModel)]="exercise.preferredTime" />
                    </div>
                    <div class="form-group">
                      <label>Duração (min)</label>
                      <input type="number" [(ngModel)]="exercise.durationMinutes" min="10" max="300" />
                    </div>
                  </div>
                }
              </div>
            }
          }

          <!-- Step 4: Goal -->
          @if (step() === 4) {
            <div class="step-header">
              <span class="emoji">🎯</span>
              <h2>Objetivo principal</h2>
              <p>Qual é a sua meta de saúde? Isso ajustará sua meta calórica diária.</p>
            </div>
            <div class="fields">
              <div class="goal-cards">
                @for (g of goalOptions; track g.value) {
                  <div class="goal-card" [class.selected]="goal.primaryGoal === g.value" (click)="goal.primaryGoal = g.value">
                    <span class="icon">{{ g.icon }}</span>
                    <div class="info">
                      <div class="title">{{ g.label }}</div>
                      <div class="desc">{{ g.desc }}</div>
                    </div>
                    <span class="kcal">{{ g.kcal }}</span>
                    <div class="check">@if (goal.primaryGoal === g.value) { ✓ }</div>
                  </div>
                }
              </div>
              @if (goal.primaryGoal === 'emagrecimento' || goal.primaryGoal === 'ganho_massa') {
                <div class="form-group">
                  <label>Peso alvo (kg) <span style="font-weight:400;color:var(--color-text-subtle)">(opcional)</span></label>
                  <input type="number" [(ngModel)]="goal.targetWeight" min="30" max="300" step="0.5" placeholder="Ex: 75.0" />
                </div>
              }
            </div>
          }

          <!-- Step 5: Done -->
          @if (step() === 5) {
            <div class="done-step">
              @if (saving()) {
                <span class="big-emoji">⏳</span>
                <h2>Configurando seu plano...</h2>
                <p>Calculando sua TMB, macronutrientes e gerando sua rotina.</p>
                <div class="flex items-center justify-center mt-4"><span class="spinner" style="width:2rem;height:2rem"></span></div>
              } @else if (saved()) {
                <span class="big-emoji">🎉</span>
                <h2>Plano criado com sucesso!</h2>
                <p>Seu programa de saúde personalizado está pronto.</p>
                @if (metabolic()) {
                  <div class="metrics">
                    <div class="metric">
                      <div class="value">{{ metabolic()!.bmr | number:'1.0-0' }}</div>
                      <div class="label">TMB (kcal/dia)</div>
                    </div>
                    <div class="metric">
                      <div class="value">{{ metabolic()!.dailyCaloricTarget | number:'1.0-0' }}</div>
                      <div class="label">Meta calórica</div>
                    </div>
                    <div class="metric">
                      <div class="value">{{ metabolic()!.waterMlTotal | number:'1.0-0' }}</div>
                      <div class="label">Água/dia (ml)</div>
                    </div>
                  </div>
                }
              } @else if (errorMsg()) {
                <span class="big-emoji">😕</span>
                <h2>Algo deu errado</h2>
                <p>{{ errorMsg() }}</p>
              }
            </div>
          }

          <!-- Navigation buttons -->
          <div class="nav-btns">
            @if (step() > 0 && !saved()) {
              <button type="button" class="btn btn-secondary" (click)="back()">← Voltar</button>
            } @else {
              <div></div>
            }

            <span class="step-counter">{{ step() + 1 }} / {{ steps.length }}</span>

            @if (step() < steps.length - 1) {
              <button type="button" class="btn btn-primary" (click)="next()" [disabled]="!canProceed()">
                Próximo →
              </button>
            } @else if (saved()) {
              <button type="button" class="btn btn-primary btn-lg" (click)="goToDashboard()">
                Ver minha rotina 🚀
              </button>
            } @else if (!saving()) {
              <button type="button" class="btn btn-primary" (click)="save()" [disabled]="saving()">
                Criar meu plano ✨
              </button>
            }
          </div>
        </div>
      </main>
    </div>
  `,
})
export class OnboardingComponent {
  private profileSvc = inject(ProfileService);
  private routineSvc = inject(RoutineService);
  private authSvc    = inject(AuthService);
  private router     = inject(Router);

  step    = signal(0);
  saving  = signal(false);
  saved   = signal(false);
  errorMsg= signal('');
  presets = signal<ExercisePreset[]>([]);
  metabolic = signal(this.profileSvc.metabolic());

  readonly steps          = STEPS;
  readonly days           = DAYS;
  readonly goalOptions    = GOAL_OPTIONS;
  readonly genderOptions  = [
    { value: 'male' as Gender,   emoji: '👨', label: 'Masculino' },
    { value: 'female' as Gender, emoji: '👩', label: 'Feminino'  },
    { value: 'other' as Gender,  emoji: '🧑', label: 'Outro'     },
  ];
  readonly activityOptions = ACTIVITY_OPTIONS;

  personal: PersonalStep = { name: '', age: null, gender: '', weight: null, height: null };
  schedule: ScheduleStep = { wakeUpTime: '07:00', sleepTime: '23:00', workStartTime: '09:00', workEndTime: '18:00' };
  activity: ActivityStep = { activityFactor: '' };
  exercise: ExerciseStep = { selected: [], daysOfWeek: [1, 3, 5], preferredTime: '07:00', durationMinutes: 60 };
  goal:     GoalStep     = { primaryGoal: '', targetWeight: null };

  constructor() { this.loadPresets(); }

  private loadPresets(): void {
    this.profileSvc.getPresets().subscribe({ next: p => this.presets.set(p), error: () => {} });
  }

  canProceed(): boolean {
    switch (this.step()) {
      case 0: return !!this.personal.name && !!this.personal.age && !!this.personal.gender
                  && !!this.personal.weight && !!this.personal.height;
      case 1: return !!this.schedule.wakeUpTime && !!this.schedule.sleepTime;
      case 2: return !!this.activity.activityFactor;
      case 3: return true; // exercises are optional
      case 4: return !!this.goal.primaryGoal;
      default: return false;
    }
  }

  next(): void { if (this.canProceed()) this.step.update(s => s + 1); }
  back(): void { this.step.update(s => Math.max(0, s - 1)); }

  isExerciseSelected(p: ExercisePreset): boolean {
    return this.exercise.selected.some(s => s.name === p.name);
  }

  toggleExercise(p: ExercisePreset): void {
    if (this.isExerciseSelected(p)) {
      this.exercise.selected = this.exercise.selected.filter(s => s.name !== p.name);
    } else {
      this.exercise.selected = [...this.exercise.selected, p];
    }
  }

  isDaySelected(i: number): boolean { return this.exercise.daysOfWeek.includes(i); }
  toggleDay(i: number): void {
    if (this.isDaySelected(i)) {
      this.exercise.daysOfWeek = this.exercise.daysOfWeek.filter(d => d !== i);
    } else {
      this.exercise.daysOfWeek = [...this.exercise.daysOfWeek, i].sort();
    }
  }

  categoryIcon(cat: string): string {
    const icons: Record<string, string> = {
      strength: '🏋️', cardio: '🏃', flexibility: '🤸', mind_body: '🧘', sports: '⚽'
    };
    return icons[cat] ?? '💪';
  }

  save(): void {
    this.saving.set(true);
    this.step.set(5);

    // 1. Save health profile
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profileDto: any = {
      age:            this.personal.age!,
      weight:         this.personal.weight!,
      height:         this.personal.height!,
      gender:         this.personal.gender as Gender,
      activityFactor: this.activity.activityFactor as ActivityFactor,
      ...this.schedule,
      primaryGoal:    this.goal.primaryGoal || undefined,
      targetWeight:   this.goal.targetWeight ?? undefined,
    };

    this.profileSvc.saveProfile(profileDto).subscribe({
      next: () => this.saveExercises(),
      error: () => { this.errorMsg.set('Erro ao salvar perfil.'); this.saving.set(false); },
    });
  }

  private saveExercises(): void {
    if (this.exercise.selected.length === 0) {
      this.generateRoutineAndFinish();
      return;
    }

    let remaining = this.exercise.selected.length;
    for (const ex of this.exercise.selected) {
      this.profileSvc.addExercise({
        name:            ex.name,
        category:        ex.category,
        met:             ex.met,
        hypertrophyScore:ex.hypertrophyScore,
        durationMinutes: this.exercise.durationMinutes,
        preferredTime:   this.exercise.preferredTime,
        daysOfWeek:      this.exercise.daysOfWeek,
      }).subscribe({
        next: () => { if (--remaining === 0) this.generateRoutineAndFinish(); },
        error: () => { if (--remaining === 0) this.generateRoutineAndFinish(); },
      });
    }
  }

  private generateRoutineAndFinish(): void {
    const today = new Date().toISOString().slice(0, 10);
    this.routineSvc.generate(today).subscribe({
      next: () => {
        this.profileSvc.loadMetabolic().subscribe({
          next: m => {
            this.metabolic.set(m);
            this.saved.set(true);
            this.saving.set(false);
            this.authSvc.markOnboarded();
          },
          error: () => { this.saved.set(true); this.saving.set(false); this.authSvc.markOnboarded(); },
        });
      },
      error: () => { this.saved.set(true); this.saving.set(false); this.authSvc.markOnboarded(); },
    });
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}
