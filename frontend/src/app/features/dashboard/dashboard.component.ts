import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProfileService } from '../../core/services/profile.service';
import { RoutineService } from '../../core/services/routine.service';
import { FoodService } from '../../core/services/food.service';
import { RoutineBlock, BlockType, DailySummary, MetabolicResult } from '../../core/models';

const HOUR_PX = 64; // px per hour in timeline
const DAY_START_H = 0; // midnight

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

const BLOCK_COLORS: Record<BlockType, string> = {
  sleep:        '#4f46e5',
  work:         '#6b7280',
  exercise:     '#10b981',
  meal:         '#f59e0b',
  water:        '#0ea5e9',
  sun_exposure: '#eab308',
  free:         '#d1d5db',
  custom:       '#8b5cf6',
};

const BLOCK_LABELS: Record<BlockType, string> = {
  sleep:        '😴 Sono',
  work:         '💼 Trabalho',
  exercise:     '💪 Exercício',
  meal:         '🍽️ Refeição',
  water:        '💧 Água',
  sun_exposure: '☀️ Sol',
  free:         '⬜ Livre',
  custom:       '📌 Custom',
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DecimalPipe, DatePipe, RouterLink],
  styles: [`
    .dashboard { display: grid; grid-template-columns: 1fr 340px; gap: 1.5rem; padding: 1.5rem;
      @media (max-width: 900px) { grid-template-columns: 1fr; }
    }

    /* Header */
    .dash-header {
      grid-column: 1/-1;
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;

      .greeting { h2 { font-size: 1.5rem; } p { font-size: .9rem; } }

      .date-nav {
        display: flex; align-items: center; gap: .75rem;
        .date-label { font-weight: 600; font-size: .95rem; min-width: 120px; text-align: center; }
        button { background: var(--color-surface); border: 1px solid var(--color-border);
          border-radius: var(--radius-sm); padding: .4rem .75rem; cursor: pointer; font-size: 1rem;
          &:hover { background: var(--color-border); }
        }
      }
    }

    /* Generate routine button */
    .generate-bar {
      grid-column: 1/-1;
      display: flex; align-items: center; justify-content: space-between;
      background: linear-gradient(135deg, #059669, #10b981);
      color: #fff; border-radius: var(--radius-md); padding: 1rem 1.5rem;

      .text h3 { font-size: 1rem; color: #fff; }
      .text p  { font-size: .82rem; color: rgba(255,255,255,.8); }

      button { background: rgba(255,255,255,.2); border: 1px solid rgba(255,255,255,.4);
        color: #fff; padding: .5rem 1.25rem; border-radius: var(--radius-sm);
        cursor: pointer; font-weight: 600; font-size: .875rem; backdrop-filter: blur(4px);
        &:hover { background: rgba(255,255,255,.35); }
        &:disabled { opacity: .6; cursor: wait; }
      }
    }

    /* Timeline */
    .timeline-panel { .panel-title { font-size: 1rem; font-weight: 700; margin-bottom: 1rem; } }

    .timeline {
      position: relative;
      background: var(--color-surface);
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
      overflow: hidden;

      .hours {
        position: relative;
        height: calc(24 * 64px);

        .hour-row {
          position: absolute; left: 0; right: 0;
          height: 64px;
          border-top: 1px solid var(--color-border);
          display: flex; align-items: flex-start; padding: .25rem .5rem;

          .hour-label { font-size: .7rem; color: var(--color-text-subtle); width: 36px; flex-shrink: 0; }
        }

        .current-time-line {
          position: absolute; left: 0; right: 0; height: 2px;
          background: var(--color-danger); z-index: 5;
          &::before {
            content: ''; position: absolute; left: -4px; top: -4px;
            width: 10px; height: 10px; border-radius: 50%; background: var(--color-danger);
          }
        }
      }

      /* Blocks overlay */
      .blocks-overlay {
        position: absolute; top: 0; left: 44px; right: 0; bottom: 0; pointer-events: none;

        .block {
          position: absolute;
          left: 4px; right: 4px;
          border-radius: 6px;
          padding: .25rem .5rem;
          overflow: hidden;
          cursor: pointer;
          pointer-events: all;
          transition: filter .15s;

          &:hover { filter: brightness(1.1); }

          .b-label { font-size: .72rem; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .b-time  { font-size: .65rem; color: rgba(255,255,255,.8); }
          .b-extra { font-size: .65rem; color: rgba(255,255,255,.9); margin-top: .1rem; }
        }
      }
    }

    /* Right panel */
    .right-panel { display: flex; flex-direction: column; gap: 1.25rem; }

    /* Macro card */
    .macro-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 1.25rem;

      .card-title { font-size: .9rem; font-weight: 700; margin-bottom: 1rem; display: flex; align-items: center; gap: .5rem; }

      .calorie-row {
        display: flex; align-items: baseline; gap: .5rem; margin-bottom: 1rem;
        .cal-value { font-size: 2rem; font-weight: 800; color: var(--color-primary); }
        .cal-label { font-size: .8rem; color: var(--color-text-muted); }
        .cal-target{ font-size: .8rem; color: var(--color-text-subtle); margin-left: auto; }
      }

      .macro-bars { display: flex; flex-direction: column; gap: .625rem; }
      .macro-bar-row {
        .mb-header { display: flex; justify-content: space-between; font-size: .78rem; margin-bottom: .25rem;
          .name  { font-weight: 600; }
          .value { color: var(--color-text-muted); }
        }
        .bar-track { height: 6px; background: var(--color-border); border-radius: 99px; overflow: hidden;
          .bar-fill  { height: 100%; border-radius: 99px; transition: width .6s ease; }
        }
      }
    }

    /* Water card */
    .water-card {
      background: linear-gradient(135deg, #e0f2fe, #bae6fd);
      border: 1px solid #7dd3fc;
      border-radius: var(--radius-md);
      padding: 1.25rem;

      .card-title { font-size: .9rem; font-weight: 700; display: flex; align-items: center; gap: .5rem; margin-bottom: .75rem; }
      .water-progress { display: flex; align-items: baseline; gap: .375rem; margin-bottom: .75rem;
        .current { font-size: 1.75rem; font-weight: 800; color: #0369a1; }
        .sep     { font-size: 1rem; color: #7dd3fc; }
        .total   { font-size: 1rem; color: #0369a1; }
        .unit    { font-size: .75rem; color: #0ea5e9; }
      }
      .water-bar { height: 8px; background: rgba(255,255,255,.5); border-radius: 99px; overflow: hidden;
        .fill { height: 100%; background: #0284c7; border-radius: 99px; transition: width .6s; }
      }
      .water-hint { font-size: .75rem; color: #0369a1; margin-top: .5rem; }
    }

    /* Stats row */
    .stats-row { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
    .stat-mini {
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); padding: 1rem; text-align: center;
      .val { font-size: 1.4rem; font-weight: 800; }
      .lbl { font-size: .72rem; color: var(--color-text-muted); margin-top: .2rem; }
    }

    /* Block detail tooltip */
    .block-detail {
      grid-column: 1/-1;
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); padding: 1rem 1.5rem;
      display: flex; align-items: center; gap: 1rem; animation: fadeIn .2s ease;

      .detail-icon { font-size: 1.75rem; }
      .detail-info { flex: 1;
        h4 { font-size: .95rem; }
        p  { font-size: .8rem; }
      }
      button { background: none; border: none; cursor: pointer; font-size: 1.25rem; color: var(--color-text-subtle); }
    }
  `],
  template: `
    <div class="dashboard">

      <!-- Header -->
      <div class="dash-header">
        <div class="greeting">
          <h2>{{ greeting() }}, {{ firstName() }}! 🌿</h2>
          <p class="text-muted">{{ todayFormatted() }}</p>
        </div>
        <div class="date-nav">
          <button (click)="changeDate(-1)">‹</button>
          <span class="date-label">{{ selectedDate() === todayStr ? 'Hoje' : selectedDate() }}</span>
          <button (click)="changeDate(1)">›</button>
          @if (selectedDate() !== todayStr) {
            <button (click)="goToday()">Hoje</button>
          }
        </div>
      </div>

      <!-- Generate bar (shown when no blocks) -->
      @if (blocks().length === 0 && !loading()) {
        <div class="generate-bar">
          <div class="text">
            <h3>Nenhuma rotina para hoje</h3>
            <p>Gere sua rotina personalizada com base no seu perfil e exercícios.</p>
          </div>
          <button (click)="generateRoutine()" [disabled]="generating()">
            {{ generating() ? 'Gerando...' : '✨ Gerar rotina' }}
          </button>
        </div>
      } @else if (blocks().length > 0) {
        <div class="generate-bar" style="padding: .75rem 1.5rem">
          <div class="text">
            <h3>Rotina do dia</h3>
            <p>{{ blocks().length }} blocos · {{ waterReminders().length }} lembretes de água</p>
          </div>
          <button (click)="generateRoutine()" [disabled]="generating()">
            {{ generating() ? 'Atualizando...' : '🔄 Regenerar' }}
          </button>
        </div>
      }

      <!-- Block detail -->
      @if (selected()) {
        <div class="block-detail animate-fade">
          <span class="detail-icon">{{ blockEmoji(selected()!.type) }}</span>
          <div class="detail-info">
            <h4>{{ selected()!.label }}</h4>
            <p>{{ selected()!.startTime }} – {{ selected()!.endTime }}
              @if (selected()!.caloricTarget) { · {{ selected()!.caloricTarget | number:'1.0-0' }} kcal }
              @if (selected()!.waterMl)       { · {{ selected()!.waterMl | number:'1.0-0' }} ml }
            </p>
          </div>
          <button (click)="selected.set(null)">✕</button>
        </div>
      }

      <!-- Timeline -->
      <div class="timeline-panel">
        <div class="panel-title">📅 Agenda do Dia</div>
        <div class="timeline" #timelineEl>
          <div class="hours">
            @for (h of hours; track h) {
              <div class="hour-row" [style.top.px]="h * HOUR_PX">
                <span class="hour-label">{{ h.toString().padStart(2,'0') }}h</span>
              </div>
            }
            <!-- Current time indicator -->
            <div class="current-time-line" [style.top.px]="currentTimePx()"></div>
          </div>

          <!-- Block overlays -->
          <div class="blocks-overlay">
            @for (b of blocks(); track b.id) {
              <div class="block"
                [style.top.px]="blockTop(b)"
                [style.height.px]="blockHeight(b)"
                [style.background]="blockColor(b.type)"
                [style.opacity]="b.type === 'water' ? 0.7 : 0.9"
                (click)="selected.set(b)">
                <div class="b-label">{{ b.label }}</div>
                <div class="b-time">{{ b.startTime }} – {{ b.endTime }}</div>
                @if (b.caloricTarget) {
                  <div class="b-extra">{{ b.caloricTarget | number:'1.0-0' }} kcal</div>
                }
                @if (b.waterMl) {
                  <div class="b-extra">{{ b.waterMl | number:'1.0-0' }} ml</div>
                }
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Right panel: metrics -->
      <div class="right-panel">

        <!-- Macros -->
        <div class="macro-card">
          <div class="card-title">🎯 Macronutrientes</div>
          @if (metabolic()) {
            <div class="calorie-row">
              <span class="cal-value">{{ consumedKcal() | number:'1.0-0' }}</span>
              <span class="cal-label">kcal consumidas</span>
              <span class="cal-target">/ {{ metabolic()!.dailyCaloricTarget | number:'1.0-0' }}</span>
            </div>
            <!-- Progress bar overall -->
            <div class="macro-bar-row" style="margin-bottom:.875rem">
              <div class="bar-track" style="height:10px">
                <div class="bar-fill" [style.width.%]="caloriesPct()" style="background:var(--color-primary)"></div>
              </div>
            </div>
            <div class="macro-bars">
              <div class="macro-bar-row">
                <div class="mb-header"><span class="name">🥩 Proteína</span><span class="value">{{ summary()?.totalProtein | number:'1.0-0' }}g / {{ metabolic()!.macros.proteinG | number:'1.0-0' }}g</span></div>
                <div class="bar-track"><div class="bar-fill" [style.width.%]="pct(summary()?.totalProtein, metabolic()!.macros.proteinG)" style="background:#10b981"></div></div>
              </div>
              <div class="macro-bar-row">
                <div class="mb-header"><span class="name">🌾 Carboidratos</span><span class="value">{{ summary()?.totalCarbs | number:'1.0-0' }}g / {{ metabolic()!.macros.carbsG | number:'1.0-0' }}g</span></div>
                <div class="bar-track"><div class="bar-fill" [style.width.%]="pct(summary()?.totalCarbs, metabolic()!.macros.carbsG)" style="background:#f59e0b"></div></div>
              </div>
              <div class="macro-bar-row">
                <div class="mb-header"><span class="name">🥑 Gorduras</span><span class="value">{{ summary()?.totalFat | number:'1.0-0' }}g / {{ metabolic()!.macros.fatG | number:'1.0-0' }}g</span></div>
                <div class="bar-track"><div class="bar-fill" [style.width.%]="pct(summary()?.totalFat, metabolic()!.macros.fatG)" style="background:#6366f1"></div></div>
              </div>
            </div>
          } @else {
            <p class="text-muted text-center" style="padding:1rem">Complete seu perfil para ver os macros.</p>
          }
        </div>

        <!-- Water -->
        <div class="water-card">
          <div class="card-title">💧 Hidratação</div>
          @if (metabolic()) {
            <div class="water-progress">
              <span class="current">{{ waterConsumed() }}</span>
              <span class="sep">/</span>
              <span class="total">{{ metabolic()!.waterMlTotal | number:'1.0-0' }}</span>
              <span class="unit">ml</span>
            </div>
            <div class="water-bar">
              <div class="fill" [style.width.%]="waterPct()"></div>
            </div>
            <p class="water-hint">{{ waterReminders().length }} lembretes ao longo do dia</p>
          } @else {
            <p style="font-size:.85rem;color:#0369a1">Configure seu perfil para ver a meta de água.</p>
          }
        </div>

        <!-- Stats mini -->
        @if (metabolic()) {
          <div class="stats-row">
            <div class="stat-mini">
              <div class="val" style="color:var(--color-primary)">{{ metabolic()!.bmr | number:'1.0-0' }}</div>
              <div class="lbl">TMB (kcal/dia)</div>
            </div>
            <div class="stat-mini">
              <div class="val" style="color:#6366f1">{{ metabolic()!.tee | number:'1.0-0' }}</div>
              <div class="lbl">GET (kcal/dia)</div>
            </div>
            <div class="stat-mini">
              <div class="val" style="color:#f59e0b">{{ metabolic()!.exerciseCalories | number:'1.0-0' }}</div>
              <div class="lbl">Kcal exercício</div>
            </div>
            <div class="stat-mini">
              <div class="val" style="color:#0ea5e9">{{ metabolic()!.hypertrophyScore }}/10</div>
              <div class="lbl">Score hipertrofia</div>
            </div>
          </div>
        }

        <!-- Quick links -->
        <div class="card" style="display:flex;flex-direction:column;gap:.625rem">
          <div style="font-size:.85rem;font-weight:700;margin-bottom:.25rem">⚡ Ações rápidas</div>
          <a routerLink="/nutrition" class="btn btn-secondary w-full">🍽️ Registrar refeição</a>
          <a routerLink="/profile" class="btn btn-secondary w-full">👤 Atualizar perfil</a>
        </div>
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private profileSvc = inject(ProfileService);
  private routineSvc = inject(RoutineService);
  private foodSvc    = inject(FoodService);

  readonly HOUR_PX = HOUR_PX;
  readonly hours   = Array.from({ length: 24 }, (_, i) => i);
  readonly todayStr = new Date().toISOString().slice(0, 10);

  blocks     = this.routineSvc.blocks;
  selectedDate = this.routineSvc.selectedDate;
  metabolic  = this.profileSvc.metabolic;
  selected   = signal<RoutineBlock | null>(null);
  loading    = signal(true);
  generating = signal(false);
  summary    = signal<DailySummary | null>(null);

  readonly firstName = computed(() => {
    const name = (this.profileSvc.profile()?.userId ?? '');
    return name.split(' ')[0] || 'usuário';
  });

  readonly waterReminders = computed(() =>
    this.blocks().filter(b => b.type === 'water')
  );

  readonly consumedKcal = computed(() => this.summary()?.totalCalories ?? 0);
  readonly waterConsumed = computed(() => '0');

  readonly caloriesPct = computed(() => {
    const m = this.metabolic();
    if (!m) return 0;
    return Math.min(100, (this.consumedKcal() / m.dailyCaloricTarget) * 100);
  });

  readonly waterPct = computed(() => {
    const m = this.metabolic();
    if (!m) return 0;
    return Math.min(100, (0 / m.waterMlTotal) * 100);
  });

  readonly greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  });

  readonly todayFormatted = computed(() => {
    return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  });

  ngOnInit(): void {
    // Load profile & metabolic
    this.profileSvc.loadProfile().subscribe({ error: () => {} });
    this.profileSvc.loadMetabolic().subscribe({ error: () => {} });

    // Load routine blocks
    this.routineSvc.load().subscribe({ next: () => this.loading.set(false), error: () => this.loading.set(false) });

    // Load daily meal summary
    this.loadSummary();
  }

  private loadSummary(): void {
    this.foodSvc.getSummary(this.selectedDate()).subscribe({
      next: s => this.summary.set(s),
      error: () => {},
    });
  }

  generateRoutine(): void {
    this.generating.set(true);
    this.routineSvc.generate(this.selectedDate()).subscribe({
      next: () => this.generating.set(false),
      error: () => this.generating.set(false),
    });
  }

  changeDate(delta: number): void {
    const d = new Date(this.selectedDate());
    d.setDate(d.getDate() + delta);
    const next = d.toISOString().slice(0, 10);
    this.routineSvc.setDate(next);
    this.loading.set(true);
    this.routineSvc.load(next).subscribe({ next: () => this.loading.set(false), error: () => this.loading.set(false) });
    this.foodSvc.getSummary(next).subscribe({ next: s => this.summary.set(s), error: () => {} });
  }

  goToday(): void { this.changeDate(0); this.routineSvc.setDate(this.todayStr); }

  currentTimePx = computed(() => {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    return (minutes / 60) * HOUR_PX;
  });

  blockTop(b: RoutineBlock): number {
    return (timeToMinutes(b.startTime) / 60) * HOUR_PX;
  }

  blockHeight(b: RoutineBlock): number {
    const start = timeToMinutes(b.startTime);
    let   end   = timeToMinutes(b.endTime);
    if (end <= start) end += 1440; // overnight
    const duration = end - start;
    return Math.max(20, (duration / 60) * HOUR_PX - 2);
  }

  blockColor(type: BlockType): string { return BLOCK_COLORS[type] ?? '#9ca3af'; }
  blockEmoji(type: BlockType): string  { return BLOCK_LABELS[type]?.split(' ')[0] ?? '📌'; }

  pct(consumed: number | undefined, target: number): number {
    if (!consumed || !target) return 0;
    return Math.min(100, (consumed / target) * 100);
  }
}
