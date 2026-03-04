import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProfileService } from '../../core/services/profile.service';
import { RoutineService } from '../../core/services/routine.service';
import { FoodService } from '../../core/services/food.service';
import { UserService } from '../../core/services/user.service';
import { WaterService } from '../../core/services/water.service';
import { ClinicalProtocolService } from '../../core/services/clinical-protocol.service';
import { RoutineBlock, BlockType, DailySummary, ClinicalProtocolWithLog } from '../../core/models';
import { WaterTrackerComponent } from '../water/water-tracker.component';

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
function pad2(n: number): string { return String(n).padStart(2, '0'); }

const BLOCK_META: Record<BlockType, { icon: string; color: string; bg: string; label: string }> = {
  sleep:        { icon: '😴', color: '#4f46e5', bg: '#eef2ff', label: 'Sono' },
  work:         { icon: '💼', color: '#6b7280', bg: '#f3f4f6', label: 'Trabalho' },
  exercise:     { icon: '💪', color: '#10b981', bg: '#d1fae5', label: 'Exercício' },
  meal:         { icon: '🍽️', color: '#f59e0b', bg: '#fef3c7', label: 'Refeição' },
  water:        { icon: '💧', color: '#0ea5e9', bg: '#e0f2fe', label: 'Água' },
  sun_exposure: { icon: '☀️', color: '#eab308', bg: '#fef9c3', label: 'Sol' },
  free:         { icon: '⬜', color: '#9ca3af', bg: '#f9fafb', label: 'Livre' },
  custom:       { icon: '📌', color: '#8b5cf6', bg: '#ede9fe', label: 'Custom' },
  medication:   { icon: '💊', color: '#7c3aed', bg: '#f5f3ff', label: 'Protocolo' },
};

const PROTOCOL_ICON: Record<string, string> = {
  SUPLEMENTO:         '🧴',
  REMEDIO_CONTROLADO: '💊',
  TRT:                '💉',
  HORMONIO_FEMININO:  '🌸',
  SONO:               '😴',
};

interface TimeGroup {
  time: string; minuteOfDay: number; blocks: RoutineBlock[];
  isPast: boolean; isCurrent: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DecimalPipe, DatePipe, RouterLink, WaterTrackerComponent],
  styles: [`
    .dashboard { display: grid; grid-template-columns: 1fr 340px; gap: 1.5rem; padding: 1.5rem;
      @media (max-width: 960px) { grid-template-columns: 1fr; } }
    .dash-header { grid-column: 1/-1; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;
      .greeting { h2 { font-size: 1.5rem; } p { font-size: .875rem; } }
      .date-nav { display: flex; align-items: center; gap: .625rem;
        .date-label { font-weight: 600; font-size: .9rem; min-width: 110px; text-align: center; color: var(--color-text); }
        .nav-btn { width: 32px; height: 32px; border-radius: 50%; background: var(--color-surface); border: 1.5px solid var(--color-border); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1rem; transition: .15s; &:hover { background: var(--color-border); } }
        .today-btn { font-size: .75rem; padding: .25rem .625rem; border-radius: 99px; background: var(--color-primary-light); color: var(--color-primary-dark); border: none; cursor: pointer; font-weight: 600; transition: .15s; &:hover { background: var(--color-primary); color: #fff; } }
      }
    }
    .generate-bar { grid-column: 1/-1; display: flex; align-items: center; justify-content: space-between; gap: 1rem; background: linear-gradient(135deg, #059669, #10b981); color: #fff; border-radius: var(--radius-md); padding: .875rem 1.5rem;
      .gb-text { h3 { font-size: .95rem; color: #fff; } p { font-size: .78rem; color: rgba(255,255,255,.8); } }
      button { background: rgba(255,255,255,.2); border: 1.5px solid rgba(255,255,255,.4); color: #fff; padding: .4rem 1rem; border-radius: var(--radius-sm); cursor: pointer; font-weight: 600; font-size: .8rem; white-space: nowrap; &:hover { background: rgba(255,255,255,.35); } &:disabled { opacity: .6; cursor: wait; } }
    }
    .timeline-panel { min-width: 0; .panel-title { font-size: .95rem; font-weight: 700; margin-bottom: 1rem; } }
    .timeline-feed { display: flex; flex-direction: column; position: relative; padding-bottom: 1rem;
      &::before { content: ''; position: absolute; left: 46px; top: 0; bottom: 0; width: 2px; background: var(--color-border); border-radius: 99px; }
    }
    .tg { display: flex; &.past { opacity: .6; } }
    .tg-time { width: 44px; padding-top: 1rem; font-size: .68rem; font-weight: 700; color: var(--color-text-subtle); text-align: right; flex-shrink: 0; line-height: 1; }
    .tg-rail { width: 4px; margin: 0 10px; display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
    .tg-dot { width: 12px; height: 12px; border-radius: 50%; margin-top: .95rem; background: var(--color-border); border: 2px solid var(--color-surface); flex-shrink: 0; }
    .tg-cards { flex: 1; min-width: 0; padding: .5rem 0; display: flex; flex-direction: column; gap: .45rem; }
    .block-card { border-radius: var(--radius-sm); border: 1px solid var(--color-border); border-left-width: 3px; padding: .575rem .875rem; background: var(--color-surface); cursor: default; transition: box-shadow .15s, transform .1s;
      &:hover { box-shadow: var(--shadow-sm); transform: translateX(2px); }
      &.done  { opacity: .65; }
      .bc-row { display: flex; align-items: center; gap: .625rem; }
      .bc-icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: .9rem; flex-shrink: 0; }
      .bc-body { flex: 1; min-width: 0;
        .bc-label { font-size: .8rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--color-text); }
        .bc-sub   { font-size: .68rem; color: var(--color-text-subtle); margin-top: .1rem; }
      }
      .bc-right { display: flex; align-items: center; gap: .375rem; flex-shrink: 0; }
      .bc-pill  { font-size: .66rem; font-weight: 700; padding: .1rem .4rem; border-radius: 99px; }
      .bc-check { width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--color-border); background: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: .8rem; transition: .15s; flex-shrink: 0;
        &.checked { background: #7c3aed; border-color: #7c3aed; color: #fff; }
        &:hover:not(.checked) { border-color: #7c3aed; background: #f5f3ff; }
      }
    }
    .now-line { display: flex; align-items: center; margin: .25rem 0;
      .now-time { width: 44px; font-size: .68rem; font-weight: 800; color: var(--color-danger); text-align: right; flex-shrink: 0; }
      .now-dot  { width: 12px; height: 12px; border-radius: 50%; background: var(--color-danger); margin: 0 10px; box-shadow: 0 0 0 4px rgba(239,68,68,.15); flex-shrink: 0; }
      .now-bar  { flex: 1; height: 2px; background: var(--color-danger); border-radius: 99px; opacity: .5; }
    }
    .right-panel { display: flex; flex-direction: column; gap: 1.25rem; }
    .macro-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1.25rem;
      .card-title { font-size: .875rem; font-weight: 700; margin-bottom: .875rem; }
      .calorie-row { display: flex; align-items: baseline; gap: .375rem; margin-bottom: .875rem;
        .cal-value { font-size: 1.875rem; font-weight: 800; color: var(--color-primary); }
        .cal-label { font-size: .78rem; color: var(--color-text-muted); }
        .cal-target { font-size: .78rem; color: var(--color-text-subtle); margin-left: auto; }
      }
      .macro-bars { display: flex; flex-direction: column; gap: .55rem; }
      .macro-bar-row { .mb-header { display: flex; justify-content: space-between; font-size: .75rem; margin-bottom: .2rem; .name { font-weight: 600; } .value { color: var(--color-text-muted); } } .bar-track { height: 5px; background: var(--color-border); border-radius: 99px; overflow: hidden; .bar-fill { height: 100%; border-radius: 99px; transition: width .6s ease; } } }
    }
    .water-card { background: linear-gradient(135deg, #e0f2fe, #bae6fd); border: 1px solid #7dd3fc; border-radius: var(--radius-md); padding: 1.25rem;
      .card-title { font-size: .875rem; font-weight: 700; display: flex; align-items: center; gap: .5rem; margin-bottom: .625rem; color: #0c4a6e; }
      .water-progress { display: flex; align-items: baseline; gap: .3rem; margin-bottom: .625rem; .cur { font-size: 1.625rem; font-weight: 800; color: #0369a1; } .sep { color: #7dd3fc; } .tot { font-size: .95rem; color: #0369a1; } .unit { font-size: .72rem; color: #0ea5e9; } }
      .water-bar { height: 7px; background: rgba(255,255,255,.5); border-radius: 99px; overflow: hidden; .fill { height: 100%; background: #0284c7; border-radius: 99px; transition: width .6s; } }
      .water-hint { font-size: .72rem; color: #0369a1; margin-top: .4rem; }
    }
    .stats-row { display: grid; grid-template-columns: 1fr 1fr; gap: .625rem; }
    .stat-mini { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: .875rem; text-align: center; .val { font-size: 1.3rem; font-weight: 800; } .lbl { font-size: .68rem; color: var(--color-text-muted); margin-top: .15rem; } }
    @keyframes xpPop { 0% { transform:scale(1);opacity:1; } 50% { transform:scale(1.5) translateY(-12px);opacity:1; } 100% { transform:scale(1) translateY(-28px);opacity:0; } }
    .xp-pop { position:fixed;pointer-events:none;z-index:999;font-size:1.1rem;font-weight:800;color:#7c3aed;animation:xpPop .9s ease forwards; }
  `],
  template: `
    <div class="dashboard">
      <div class="dash-header">
        <div class="greeting">
          <h2>{{ greeting() }}, {{ firstName() }}! 🌿</h2>
          <p class="text-muted">{{ todayFormatted() }}</p>
        </div>
        <div class="date-nav">
          <button class="nav-btn" (click)="changeDate(-1)">‹</button>
          <span class="date-label">{{ selectedDate() === todayStr ? 'Hoje' : selectedDate() }}</span>
          <button class="nav-btn" (click)="changeDate(1)">›</button>
          @if (selectedDate() !== todayStr) {
            <button class="today-btn" (click)="goToday()">Hoje</button>
          }
        </div>
      </div>

      @if (blocks().length === 0 && !loading()) {
        <div class="generate-bar">
          <div class="gb-text"><h3>Nenhuma rotina para este dia</h3><p>Gere sua agenda personalizada com exercícios, refeições e protocolos clínicos.</p></div>
          <button (click)="generateRoutine()" [disabled]="generating()">{{ generating() ? '⏳ Gerando...' : '✨ Gerar Rotina' }}</button>
        </div>
      } @else if (blocks().length > 0) {
        <div class="generate-bar" style="padding:.625rem 1.5rem">
          <div class="gb-text"><h3>Rotina do dia · {{ blocks().length }} blocos</h3><p>{{ doneProtocols() }}/{{ totalProtocols() }} protocolos · {{ waterBlocks() }} lembretes de água</p></div>
          <button (click)="generateRoutine()" [disabled]="generating()">{{ generating() ? '⏳...' : '🔄 Regenerar' }}</button>
        </div>
      }

      <div class="timeline-panel">
        <div class="panel-title">📅 Agenda do Dia</div>
        @if (loading()) {
          <div style="text-align:center;padding:3rem;color:var(--color-text-muted)"><div class="spinner" style="margin:0 auto 1rem"></div>Carregando...</div>
        } @else if (timeGroups().length === 0) {
          <div style="text-align:center;padding:3rem;color:var(--color-text-muted);font-size:.875rem">Nenhum bloco.<br>Clique em <strong>✨ Gerar Rotina</strong> para começar.</div>
        } @else {
          <div class="timeline-feed">
            @for (grp of timeGroups(); track grp.time; let i = $index) {
              @if (showNowLine() && grp.minuteOfDay > nowMinutes() && (i === 0 || timeGroups()[i-1].minuteOfDay <= nowMinutes())) {
                <div class="now-line"><span class="now-time">{{ nowLabel() }}</span><span class="now-dot"></span><span class="now-bar"></span></div>
              }
              <div class="tg" [class.past]="grp.isPast">
                <div class="tg-time">{{ grp.time }}</div>
                <div class="tg-rail">
                  <div class="tg-dot"
                    [style.background]="grp.isCurrent ? 'var(--color-danger)' : dotColor(grp.blocks[0].type)"
                    [style.box-shadow]="grp.isCurrent ? '0 0 0 4px rgba(239,68,68,.2)' : 'none'">
                  </div>
                </div>
                <div class="tg-cards">
                  @for (b of grp.blocks; track b.id) {
                    <div class="block-card" [class.done]="isDone(b)" [style.border-left-color]="blockMeta(b.type).color">
                      <div class="bc-row">
                        <div class="bc-icon" [style.background]="blockMeta(b.type).bg" [style.color]="blockMeta(b.type).color">{{ protocolIcon(b) }}</div>
                        <div class="bc-body">
                          <div class="bc-label">{{ b.label }}</div>
                          <div class="bc-sub">{{ b.startTime }}–{{ b.endTime }}
                            @if (b.caloricTarget) { &nbsp;· {{ b.caloricTarget | number:'1.0-0' }} kcal }
                            @if (b.waterMl)       { &nbsp;· {{ b.waterMl | number:'1.0-0' }} ml }
                          </div>
                        </div>
                        <div class="bc-right">
                          @if (b.type === 'medication') {
                            <span class="bc-pill" style="background:#ede9fe;color:#6b21a8">+5 XP</span>
                            <button class="bc-check" [class.checked]="isDone(b)" (click)="toggleProtocol(b, $event)" [disabled]="toggling() === b.id">{{ isDone(b) ? '✓' : '○' }}</button>
                          } @else if (b.type === 'meal') {
                            <span class="bc-pill" style="background:#fef3c7;color:#92400e">+10 XP</span>
                          }
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
            @if (showNowLine() && allBlocksPast()) {
              <div class="now-line"><span class="now-time">{{ nowLabel() }}</span><span class="now-dot"></span><span class="now-bar"></span></div>
            }
          </div>
        }
      </div>

      <div class="right-panel">
        <div class="macro-card">
          <div class="card-title">🎯 Macronutrientes</div>
          @if (metabolic()) {
            <div class="calorie-row">
              <span class="cal-value">{{ consumedKcal() | number:'1.0-0' }}</span>
              <span class="cal-label">kcal</span>
              <span class="cal-target">/ {{ metabolic()!.dailyCaloricTarget | number:'1.0-0' }}</span>
            </div>
            <div class="macro-bar-row" style="margin-bottom:.75rem">
              <div class="bar-track" style="height:8px">
                <div class="bar-fill" [style.width.%]="caloriesPct()" [style.background]="caloriesPct() > 105 ? 'var(--color-danger)' : 'var(--color-primary)'"></div>
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
            <p class="text-muted" style="padding:1rem;font-size:.875rem;text-align:center">Complete seu perfil para ver os macros.</p>
          }
        </div>

        <div class="water-card">
          <div class="card-title">💧 Hidratação</div>
          @if (metabolic()) {
            <div class="water-progress">
              <span class="cur">{{ waterSvc.todayTotal() }}</span><span class="sep">/</span>
              <span class="tot">{{ metabolic()!.waterMlTotal | number:'1.0-0' }}</span><span class="unit">ml</span>
            </div>
            <div class="water-bar"><div class="fill" [style.width.%]="waterPct()"></div></div>
            <p class="water-hint">{{ waterBlocks() }} lembretes distribuídos no dia</p>
          } @else {
            <p style="font-size:.82rem;color:#0369a1">Configure o perfil para ver a meta de água.</p>
          }
        </div>

        @if (metabolic()) {
          <div class="stats-row">
            <div class="stat-mini"><div class="val" style="color:var(--color-primary)">{{ metabolic()!.bmr | number:'1.0-0' }}</div><div class="lbl">TMB (kcal/dia)</div></div>
            <div class="stat-mini"><div class="val" style="color:#6366f1">{{ metabolic()!.tee | number:'1.0-0' }}</div><div class="lbl">GET (kcal/dia)</div></div>
            <div class="stat-mini"><div class="val" style="color:#f59e0b">{{ metabolic()!.exerciseCalories | number:'1.0-0' }}</div><div class="lbl">Kcal exercício</div></div>
            <div class="stat-mini"><div class="val" style="color:#0ea5e9">{{ metabolic()!.hypertrophyScore }}/10</div><div class="lbl">Score hipertrofia</div></div>
          </div>
        }

        <app-water-tracker [showLogs]="showWaterLogs" />

        <div class="card" style="display:flex;flex-direction:column;gap:.5rem">
          <div style="font-size:.82rem;font-weight:700;margin-bottom:.125rem">⚡ Ações rápidas</div>
          <a routerLink="/nutrition" class="btn btn-secondary w-full">🍽️ Registrar refeição</a>
          <a routerLink="/protocols" class="btn btn-secondary w-full">💊 Protocolos clínicos</a>
          <a routerLink="/recipes"   class="btn btn-secondary w-full">📖 Receitas da comunidade</a>
          <a routerLink="/progress"  class="btn btn-secondary w-full">📊 Ver progresso</a>
        </div>
      </div>
    </div>

    @if (xpPopVisible()) {
      <div class="xp-pop" [style.left]="xpPopX + 'px'" [style.top]="xpPopY + 'px'">+{{ lastXp() }} XP ⚡</div>
    }
  `,
})
export class DashboardComponent implements OnInit, OnDestroy {
  private profileSvc  = inject(ProfileService);
  private routineSvc  = inject(RoutineService);
  private foodSvc     = inject(FoodService);
  readonly waterSvc   = inject(WaterService);
  private userSvc     = inject(UserService);
  private protocolSvc = inject(ClinicalProtocolService);

  readonly todayStr      = new Date().toISOString().slice(0, 10);
  readonly showWaterLogs = signal(false);

  blocks       = this.routineSvc.blocks;
  selectedDate = this.routineSvc.selectedDate;
  metabolic    = this.profileSvc.metabolic;

  loading    = signal(true);
  generating = signal(false);
  toggling   = signal<string | null>(null);
  summary    = signal<DailySummary | null>(null);
  userName   = signal<string>('usuário');
  protocols  = signal<ClinicalProtocolWithLog[]>([]);

  xpPopVisible = signal(false);
  lastXp       = signal(0);
  xpPopX = 0; xpPopY = 0;

  private clockInterval: ReturnType<typeof setInterval> | null = null;
  private clockMinute = signal(this.currentMinuteOfDay());

  readonly firstName      = computed(() => this.userName().split(' ')[0] || 'usuário');
  readonly greeting       = computed(() => { const h = new Date().getHours(); if (h < 12) return 'Bom dia'; if (h < 18) return 'Boa tarde'; return 'Boa noite'; });
  readonly todayFormatted = computed(() => new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }));
  readonly nowMinutes     = computed(() => this.clockMinute());
  readonly nowLabel       = computed(() => { const n = new Date(); return `${pad2(n.getHours())}:${pad2(n.getMinutes())}`; });
  readonly showNowLine    = computed(() => this.selectedDate() === this.todayStr);

  readonly timeGroups = computed((): TimeGroup[] => {
    const now = this.nowMinutes(); const isToday = this.selectedDate() === this.todayStr;
    const map = new Map<string, RoutineBlock[]>();
    for (const b of this.blocks()) { if (!map.has(b.startTime)) map.set(b.startTime, []); map.get(b.startTime)!.push(b); }
    return Array.from(map.entries())
      .sort((a, b) => timeToMinutes(a[0]) - timeToMinutes(b[0]))
      .map(([time, blks]) => {
        const min = timeToMinutes(time);
        return { time, minuteOfDay: min, blocks: blks, isPast: isToday && (min + 30) < now, isCurrent: isToday && min <= now && now < min + 60 };
      });
  });

  readonly allBlocksPast  = computed(() => this.timeGroups().length > 0 && this.timeGroups().every(g => g.isPast));
  readonly consumedKcal   = computed(() => this.summary()?.totalCalories ?? 0);
  readonly caloriesPct    = computed(() => { const m = this.metabolic(); return m ? Math.min(110, (this.consumedKcal() / m.dailyCaloricTarget) * 100) : 0; });
  readonly waterPct       = computed(() => { const m = this.metabolic(); return m ? Math.min(100, (this.waterSvc.todayTotal() / m.waterMlTotal) * 100) : 0; });
  readonly waterBlocks    = computed(() => this.blocks().filter(b => b.type === 'water').length);
  readonly totalProtocols = computed(() => this.protocols().length);
  readonly doneProtocols  = computed(() => this.protocols().filter(p => !!p.log).length);

  ngOnInit(): void {
    this.userSvc.loadMe().subscribe({ next: (u: any) => { if (u.name) this.userName.set(u.name); }, error: () => {} });
    this.profileSvc.loadProfile().subscribe({ error: () => {} });
    this.profileSvc.loadMetabolic().subscribe({ error: () => {} });
    this.routineSvc.load().subscribe({ next: () => this.loading.set(false), error: () => this.loading.set(false) });
    this.foodSvc.getSummary(this.selectedDate()).subscribe({ next: s => this.summary.set(s), error: () => {} });
    this.waterSvc.loadToday().subscribe({ error: () => {} });
    this.loadProtocols();
    this.clockInterval = setInterval(() => this.clockMinute.set(this.currentMinuteOfDay()), 30_000);
  }

  ngOnDestroy(): void { if (this.clockInterval) clearInterval(this.clockInterval); }

  private loadProtocols(): void {
    this.protocolSvc.logsForDate(this.selectedDate()).subscribe({ next: p => this.protocols.set(p.filter(x => x.isActive)), error: () => {} });
  }

  generateRoutine(): void {
    this.generating.set(true);
    this.routineSvc.generate(this.selectedDate()).subscribe({ next: () => { this.generating.set(false); this.loadProtocols(); }, error: () => this.generating.set(false) });
  }

  changeDate(delta: number): void {
    const d = new Date(this.selectedDate()); d.setDate(d.getDate() + delta);
    const next = d.toISOString().slice(0, 10);
    this.routineSvc.setDate(next); this.loading.set(true);
    this.routineSvc.load(next).subscribe({ next: () => this.loading.set(false), error: () => this.loading.set(false) });
    this.foodSvc.getSummary(next).subscribe({ next: s => this.summary.set(s), error: () => {} });
    this.protocolSvc.logsForDate(next).subscribe({ next: p => this.protocols.set(p.filter(x => x.isActive)), error: () => {} });
  }

  goToday(): void { this.routineSvc.setDate(this.todayStr); this.changeDate(0); }

  toggleProtocol(block: RoutineBlock, event: MouseEvent): void {
    const protocolId = block.metadata?.['protocolId'] as string | undefined;
    if (!protocolId) return;
    this.toggling.set(block.id);
    this.protocolSvc.toggle(protocolId, this.selectedDate()).subscribe({
      next: result => {
        this.protocolSvc.logsForDate(this.selectedDate()).subscribe({ next: p => this.protocols.set(p.filter(x => x.isActive)) });
        this.toggling.set(null);
        if (result.xpGained > 0) this.showXpPop(result.xpGained, event);
      },
      error: () => this.toggling.set(null),
    });
  }

  blockMeta(type: BlockType) { return BLOCK_META[type] ?? BLOCK_META.custom; }
  dotColor(type: BlockType)  { return BLOCK_META[type]?.color ?? '#9ca3af'; }
  protocolIcon(b: RoutineBlock): string {
    if (b.type === 'medication') { const cat = b.metadata?.['category'] as string | undefined; return cat ? (PROTOCOL_ICON[cat] ?? '💊') : '💊'; }
    return BLOCK_META[b.type]?.icon ?? '📌';
  }
  isDone(b: RoutineBlock): boolean {
    if (b.type !== 'medication') return false;
    const pid = b.metadata?.['protocolId'] as string | undefined;
    return pid ? this.protocols().some(p => p.id === pid && !!p.log) : false;
  }
  pct(consumed: number | undefined, target: number): number { if (!consumed || !target) return 0; return Math.min(100, (consumed / target) * 100); }
  private currentMinuteOfDay(): number { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); }
  private showXpPop(xp: number, event?: MouseEvent): void {
    this.lastXp.set(xp); this.xpPopX = event?.clientX ?? window.innerWidth / 2; this.xpPopY = event?.clientY ?? window.innerHeight / 2;
    this.xpPopVisible.set(true); setTimeout(() => this.xpPopVisible.set(false), 900);
  }
}
