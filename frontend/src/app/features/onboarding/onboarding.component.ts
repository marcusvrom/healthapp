import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ProfileService } from '../../core/services/profile.service';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { CommonModule, DecimalPipe } from '@angular/common';
import {
  ExercisePreset, ActivityFactor, Gender, PrimaryGoal,
  MainActivity, MetabolicResult,
} from '../../core/models';

// ── Local step interfaces ───────────────────────────────────────────────────
interface PersonalStep  { name: string; age: number|null; gender: Gender|''; weight: number|null; height: number|null; }
interface ScheduleStep  {
  wakeUpTime: string; sleepTime: string;
  mainActivity: MainActivity|'';
  workStartTime: string; workEndTime: string;
}
interface ActivityStep  { activityFactor: ActivityFactor|''; }
interface ExerciseStep  { selected: ExercisePreset[]; daysOfWeek: number[]; preferredTime: string; durationMinutes: number; }
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
const STEPS = ['Pessoal', 'Horários', 'Atividade', 'Exercícios', 'Objetivo', 'Resumo e Rotina'];

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

const DAYS = ['D','S','T','Q','Q','S','S'];

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
  styles: [`
    :host { display: block; min-height: 100vh; background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 60%, #d1fae5 100%); }

    .onboarding {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background: var(--color-bg);
    }

    /* Progress bar */
    .progress-bar {
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
    }

    /* Wider card for final step */
    .step-card.wide { max-width: 860px; }

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

    /* Activity cards (reusable for main-activity and activity-factor) */
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

    /* ── Final step: Summary + Routine Base ─────────────────────────────────── */
    .summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      @media (max-width: 640px) { grid-template-columns: 1fr; }
    }

    .summary-block {
      border: 1.5px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 1.25rem;
      background: var(--color-surface-2);

      h3 { font-size: .95rem; font-weight: 700; margin-bottom: 1rem; display: flex; align-items: center; gap: .4rem; }
    }

    .metric-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: .75rem;
      .metric {
        background: var(--color-primary-light); border-radius: var(--radius); padding: .75rem;
        text-align: center;
        .value { font-size: 1.25rem; font-weight: 800; color: var(--color-primary-dark); }
        .label { font-size: .7rem; color: var(--color-text-muted); margin-top: .15rem; }
      }
      .metric.full { grid-column: span 2; }
    }

    .meal-checks {
      display: grid; grid-template-columns: 1fr 1fr; gap: .5rem;
      .meal-check {
        display: flex; align-items: center; gap: .5rem;
        padding: .5rem .75rem;
        border: 1.5px solid var(--color-border);
        border-radius: var(--radius);
        cursor: pointer; transition: all .2s;
        background: var(--color-bg);
        font-size: .82rem;

        .cb { width: 18px; height: 18px; border-radius: 4px; border: 2px solid var(--color-border);
          display: flex; align-items: center; justify-content: center; font-size: .65rem;
          flex-shrink: 0; transition: all .2s; }

        &.active {
          border-color: var(--color-primary); background: var(--color-primary-light);
          .cb { background: var(--color-primary); border-color: var(--color-primary); color: #fff; }
        }
        &:hover { border-color: var(--color-primary); }
      }
    }

    .routine-fields { display: flex; flex-direction: column; gap: .875rem; }

    .water-section {
      border: 1.5px solid var(--color-border);
      border-radius: var(--radius);
      padding: .75rem;
      background: var(--color-bg);
    }

    .water-toggle {
      display: flex; align-items: center; gap: .5rem;
      cursor: pointer; font-size: .85rem; font-weight: 600;
      padding: .25rem 0;

      .cb { width: 18px; height: 18px; border-radius: 4px; border: 2px solid var(--color-border);
        display: flex; align-items: center; justify-content: center; font-size: .65rem;
        flex-shrink: 0; transition: all .2s; }

      &.active .cb { background: var(--color-primary); border-color: var(--color-primary); color: #fff; }
    }

    .water-detail {
      margin-top: .5rem; padding: .35rem .5rem;
      background: rgba(59,130,246,.08); border-radius: var(--radius);
      .water-goal { font-size: .78rem; font-weight: 600; color: #2563eb; }
    }

    .interval-options {
      display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .35rem;
    }

    .interval-chip {
      padding: .35rem .75rem;
      border: 1.5px solid var(--color-border);
      border-radius: 99px;
      font-size: .78rem; font-weight: 600;
      cursor: pointer; transition: all .2s;
      background: var(--color-bg);

      &.active { background: var(--color-primary); border-color: var(--color-primary); color: #fff; }
      &:hover { border-color: var(--color-primary); }
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
        <div class="step-card" [class.wide]="step() === 5">

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

          <!-- Step 1: Schedule + Main Activity -->
          @if (step() === 1) {
            <div class="step-header">
              <span class="emoji">🕐</span>
              <h2>Sua rotina de horários</h2>
              <p>Vamos entender como é seu dia para encaixar tudo no momento certo.</p>
            </div>
            <div class="fields">
              <div class="form-group">
                <label>Qual é sua atividade principal?</label>
                <div class="activity-cards">
                  @for (opt of mainActivityOptions; track opt.value) {
                    <div class="activity-card"
                         [class.selected]="schedule.mainActivity === opt.value"
                         (click)="schedule.mainActivity = opt.value">
                      <span class="icon">{{ opt.icon }}</span>
                      <div class="info">
                        <div class="title">{{ opt.label }}</div>
                        <div class="desc">{{ opt.desc }}</div>
                      </div>
                      <div class="check">@if (schedule.mainActivity === opt.value) { ✓ }</div>
                    </div>
                  }
                </div>
              </div>

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

              @if (hasFixedSchedule()) {
                <div class="row-2">
                  <div class="form-group">
                    <label>{{ activityStartLabel() }}</label>
                    <input type="time" [(ngModel)]="schedule.workStartTime" />
                  </div>
                  <div class="form-group">
                    <label>{{ activityEndLabel() }}</label>
                    <input type="time" [(ngModel)]="schedule.workEndTime" />
                  </div>
                </div>
              }

              <div class="alert alert-info">
                💡 Esses horários serão usados para distribuir refeições, hidratação e exercícios ao longo do dia.
              </div>
            </div>
          }

          <!-- Step 2: Activity level -->
          @if (step() === 2) {
            <div class="step-header">
              <span class="emoji">⚡</span>
              <h2>Nível de atividade física</h2>
              <p>Quanto você se movimenta durante um dia normal?</p>
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

          <!-- Step 5: Summary + Routine Base -->
          @if (step() === 5) {
            @if (saving()) {
              <div style="text-align:center;padding:3rem 0">
                <div style="font-size:3rem;margin-bottom:1rem">⏳</div>
                <h2>Calculando seu plano...</h2>
                <p style="font-size:.9rem;margin-top:.5rem">Processando sua TMB, metas de macronutrientes e montando sua rotina base.</p>
                <div class="flex items-center justify-center mt-4"><span class="spinner" style="width:2rem;height:2rem"></span></div>
              </div>
            } @else if (errorMsg()) {
              <div style="text-align:center;padding:2rem 0">
                <div style="font-size:3rem;margin-bottom:1rem">😕</div>
                <h2>Algo deu errado</h2>
                <p>{{ errorMsg() }}</p>
              </div>
            } @else {
              <div class="step-header">
                <span class="emoji">🗺️</span>
                <h2>Resumo e Rotina Base</h2>
                <p>Confira suas metas calculadas e defina o esqueleto padrão dos seus dias.</p>
              </div>

              <div class="summary-grid">
                <!-- Block 1: Metabolic Summary -->
                <div class="summary-block">
                  <h3>📊 Resumo Metabólico</h3>
                  @if (metabolic()) {
                    <div class="metric-grid">
                      <div class="metric">
                        <div class="value">{{ metabolic()!.bmr | number:'1.0-0' }}</div>
                        <div class="label">TMB (kcal)</div>
                      </div>
                      <div class="metric">
                        <div class="value">{{ metabolic()!.tee | number:'1.0-0' }}</div>
                        <div class="label">GET (kcal)</div>
                      </div>
                      <div class="metric full">
                        <div class="value">{{ metabolic()!.dailyCaloricTarget | number:'1.0-0' }} kcal/dia</div>
                        <div class="label">Meta Diária ({{ goalLabel() }})</div>
                      </div>
                      <div class="metric">
                        <div class="value">{{ metabolic()!.macros.proteinG | number:'1.0-0' }}g</div>
                        <div class="label">Proteína</div>
                      </div>
                      <div class="metric">
                        <div class="value">{{ metabolic()!.macros.carbsG | number:'1.0-0' }}g</div>
                        <div class="label">Carboidratos</div>
                      </div>
                      <div class="metric">
                        <div class="value">{{ metabolic()!.macros.fatG | number:'1.0-0' }}g</div>
                        <div class="label">Gordura</div>
                      </div>
                      <div class="metric">
                        <div class="value">{{ metabolic()!.waterMlTotal | number:'1.0-0' }}</div>
                        <div class="label">Água (ml/dia)</div>
                      </div>
                    </div>
                  } @else {
                    <p style="font-size:.85rem;color:var(--color-text-muted)">Carregando...</p>
                  }
                </div>

                <!-- Block 2: Routine Base Builder -->
                <div class="summary-block">
                  <h3>🧱 Rotina Base</h3>
                  <div class="routine-fields">
                    <div class="row-2">
                      <div class="form-group">
                        <label>⏰ Horário de Acordar</label>
                        <input type="time" [(ngModel)]="routineBase.wakeUpTime" />
                      </div>
                      <div class="form-group">
                        <label>🌙 Horário de Dormir</label>
                        <input type="time" [(ngModel)]="routineBase.sleepTime" />
                      </div>
                    </div>

                    <div class="form-group">
                      <label>💪 Horário Preferido de Treino</label>
                      <input type="time" [(ngModel)]="routineBase.preferredTrainTime" />
                    </div>

                    <div class="form-group">
                      <label>Quais refeições você costuma fazer?</label>
                      <div class="meal-checks">
                        @for (m of mealOptions; track m.key) {
                          <div class="meal-check"
                               [class.active]="routineBase.meals[m.key]"
                               (click)="routineBase.meals[m.key] = !routineBase.meals[m.key]">
                            <div class="cb">@if (routineBase.meals[m.key]) { ✓ }</div>
                            <span>{{ m.icon }} {{ m.label }}</span>
                          </div>
                        }
                      </div>
                    </div>

                    <!-- Water reminders -->
                    <div class="water-section">
                      <div class="water-toggle"
                           [class.active]="routineBase.waterReminders"
                           (click)="routineBase.waterReminders = !routineBase.waterReminders">
                        <div class="cb">@if (routineBase.waterReminders) { ✓ }</div>
                        <span class="water-label">💧 Deseja lembretes para tomar água?</span>
                      </div>

                      @if (routineBase.waterReminders && metabolic()) {
                        <div class="water-detail">
                          <span class="water-goal">Meta diária: {{ metabolic()!.waterMlTotal | number:'1.0-0' }} ml</span>
                        </div>
                        <div class="form-group">
                          <label>Com qual frequência deseja ser lembrado?</label>
                          <div class="interval-options">
                            @for (opt of waterIntervalOptions; track opt.value) {
                              <div class="interval-chip"
                                   [class.active]="routineBase.waterIntervalMin === opt.value"
                                   (click)="routineBase.waterIntervalMin = opt.value">
                                {{ opt.label }}
                              </div>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                </div>
              </div>
            }
          }

          <!-- Navigation buttons -->
          <div class="nav-btns">
            @if (step() > 0 && !saving()) {
              <button type="button" class="btn btn-secondary" (click)="back()">← Voltar</button>
            } @else {
              <div></div>
            }

            <span class="step-counter">{{ step() + 1 }} / {{ steps.length }}</span>

            @if (step() < steps.length - 1) {
              <button type="button" class="btn btn-primary" (click)="next()" [disabled]="!canProceed()">
                Próximo →
              </button>
            } @else if (!saving() && !errorMsg()) {
              <button type="button" class="btn btn-primary btn-lg" (click)="finish()"
                      [disabled]="!hasSelectedMeals()">
                Finalizar e Entrar 🚀
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
  private authSvc    = inject(AuthService);
  private apiSvc     = inject(ApiService);
  private router     = inject(Router);

  step    = signal(0);
  saving  = signal(false);
  errorMsg= signal('');
  presets = signal<ExercisePreset[]>([]);
  metabolic = signal<MetabolicResult | null>(null);

  readonly steps               = STEPS;
  readonly days                = DAYS;
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
  exercise: ExerciseStep = { selected: [], daysOfWeek: [1, 3, 5], preferredTime: '07:00', durationMinutes: 60 };
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

  constructor() { this.loadPresets(); }

  private loadPresets(): void {
    this.profileSvc.getPresets().subscribe({ next: p => this.presets.set(p), error: () => {} });
  }

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

  // ── Step navigation ────────────────────────────────────────────────────────

  canProceed(): boolean {
    switch (this.step()) {
      case 0: return !!this.personal.name && !!this.personal.age && !!this.personal.gender
                  && !!this.personal.weight && !!this.personal.height;
      case 1: return !!this.schedule.wakeUpTime && !!this.schedule.sleepTime && !!this.schedule.mainActivity;
      case 2: return !!this.activity.activityFactor;
      case 3: return true; // exercises are optional
      case 4: return !!this.goal.primaryGoal;
      default: return false;
    }
  }

  next(): void {
    if (!this.canProceed()) return;

    const currentStep = this.step();

    // When leaving step 4 (Goal) → save profile + exercises, then load metabolic for step 5
    if (currentStep === 4) {
      this.saveProfileAndPrepareFinish();
      return;
    }

    this.step.update(s => s + 1);
  }

  back(): void { this.step.update(s => Math.max(0, s - 1)); }

  // ── Exercise helpers ──────────────────────────────────────────────────────

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

  // ── Save profile + exercises, then advance to step 5 with metabolic data ──

  private saveProfileAndPrepareFinish(): void {
    this.saving.set(true);
    this.step.set(5);

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
      next: () => this.saveExercisesThenLoadMetabolic(),
      error: () => { this.errorMsg.set('Erro ao salvar perfil.'); this.saving.set(false); },
    });
  }

  private saveExercisesThenLoadMetabolic(): void {
    if (this.exercise.selected.length === 0) {
      this.loadMetabolicAndShow();
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
        next: () => { if (--remaining === 0) this.loadMetabolicAndShow(); },
        error: () => { if (--remaining === 0) this.loadMetabolicAndShow(); },
      });
    }
  }

  private loadMetabolicAndShow(): void {
    this.profileSvc.loadMetabolic().subscribe({
      next: m => {
        this.metabolic.set(m);
        // Pre-fill routine base from schedule step
        this.routineBase.wakeUpTime = this.schedule.wakeUpTime;
        this.routineBase.sleepTime  = this.schedule.sleepTime;
        this.routineBase.preferredTrainTime = this.exercise.preferredTime || '07:00';
        this.saving.set(false);
      },
      error: () => {
        this.errorMsg.set('Erro ao calcular metas metabólicas.');
        this.saving.set(false);
      },
    });
  }

  // ── Finish: call onboarding/complete endpoint ────────────────────────────

  finish(): void {
    this.saving.set(true);
    this.errorMsg.set('');

    const selectedMeals = Object.entries(this.routineBase.meals)
      .filter(([, v]) => v)
      .map(([key]) => key);

    const payload = {
      wakeUpTime:         this.routineBase.wakeUpTime,
      sleepTime:          this.routineBase.sleepTime,
      preferredTrainTime: this.routineBase.preferredTrainTime,
      meals:              selectedMeals,
      waterReminders:     this.routineBase.waterReminders,
      waterIntervalMin:   this.routineBase.waterReminders ? this.routineBase.waterIntervalMin : undefined,
    };

    this.apiSvc.post('/onboarding/complete', payload).subscribe({
      next: () => {
        this.authSvc.markOnboarded();
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.errorMsg.set('Erro ao finalizar onboarding. Tente novamente.');
        this.saving.set(false);
      },
    });
  }
}
