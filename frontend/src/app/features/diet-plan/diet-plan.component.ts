import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { DietPlanService } from '../../core/services/diet-plan.service';
import { MedicationService, MedicationWithLog } from '../../core/services/medication.service';
import { ScheduledMeal, UserLevel } from '../../core/models';

type TimelineItem =
  | { kind: 'meal'; data: ScheduledMeal }
  | { kind: 'medication'; data: MedicationWithLog };

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

@Component({
  selector: 'app-diet-plan',
  standalone: true,
  imports: [FormsModule, DecimalPipe, DatePipe],
  styles: [`
    .page { padding: 1.5rem; max-width: 860px; margin: 0 auto; }
    .page-header { margin-bottom: 1.5rem; h2 { font-size: 1.5rem; } p { color: var(--color-text-muted); } }

    .controls {
      display: flex; align-items: center; gap: .75rem; margin-bottom: 1.5rem; flex-wrap: wrap;
      input[type=date] { border: 1.5px solid var(--color-border); border-radius: var(--radius-sm);
        padding: .45rem .75rem; font-size: .875rem; }
    }

    .xp-banner {
      display: flex; align-items: center; gap: .875rem;
      background: linear-gradient(135deg, #312e81, #6366f1);
      border-radius: var(--radius-md); padding: 1rem 1.25rem;
      color: #fff; margin-bottom: 1.5rem;
      .xp-icon { font-size: 1.75rem; }
      .xp-info { flex: 1;
        .xp-level { font-size: .8rem; opacity: .85; }
        .xp-val   { font-size: 1.2rem; font-weight: 800; }
      }
      .xp-bar-wrap { width: 120px;
        .xp-bar-bg  { height: 8px; background: rgba(255,255,255,.2); border-radius: 99px;
          .xp-bar-fill { height: 100%; background: #a5b4fc; border-radius: 99px; transition: width .5s; }
        }
        .xp-next { font-size: .68rem; opacity: .75; margin-top: .2rem; }
      }
    }

    .macros-row {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: .875rem; margin-bottom: 1.5rem;
      @media (max-width: 600px) { grid-template-columns: repeat(2, 1fr); }
    }
    .macro-card {
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-sm); padding: .875rem 1rem; text-align: center;
      .mv { font-size: 1.3rem; font-weight: 800; color: var(--color-primary); }
      .ml { font-size: .7rem; color: var(--color-text-subtle); margin-top: .2rem; font-weight: 600; text-transform: uppercase; }
      .mc { font-size: .72rem; color: var(--color-text-muted); margin-top: .1rem; }
    }

    .timeline { position: relative; padding-left: 2.5rem;
      &::before { content: ''; position: absolute; left: .9rem; top: 0; bottom: 0;
        width: 2px; background: var(--color-border); border-radius: 99px; }
    }

    .timeline-card {
      position: relative; border-radius: var(--radius-md); padding: 1rem 1.25rem;
      margin-bottom: 1rem; transition: all .25s; border: 2px solid var(--color-border);
      background: var(--color-surface);
      &::before { content: ''; position: absolute; left: -2rem; top: 1.125rem;
        width: 12px; height: 12px; border-radius: 50%;
        background: var(--color-border); border: 2px solid #fff;
        box-shadow: 0 0 0 2px var(--color-border); }
      &.done {
        background: #f0fdf4; border-color: #86efac; opacity: .85;
        &::before { background: #16a34a; box-shadow: 0 0 0 2px #86efac; }
      }
      &.checking { opacity: .7; pointer-events: none; }
    }

    .med-card { border-color: #c4b5fd !important; background: #faf5ff !important;
      &.done { background: #f5f3ff !important; border-color: #a78bfa !important;
        &::before { background: #7c3aed !important; box-shadow: 0 0 0 2px #c4b5fd !important; }
      }
    }

    .card-row { display: flex; align-items: flex-start; gap: .875rem; }
    .time-badge { padding: .25rem .625rem; border-radius: var(--radius-sm); font-size: .78rem;
      font-weight: 700; white-space: nowrap; flex-shrink: 0;
      &.meal { background: var(--color-primary-light); color: var(--color-primary-dark); }
      &.med  { background: #ede9fe; color: #6b21a8; }
    }
    .card-info { flex: 1; min-width: 0;
      .item-name   { font-size: .95rem; font-weight: 700; &.struck { text-decoration: line-through; color: var(--color-text-subtle); } }
      .item-sub    { font-size: .78rem; color: var(--color-text-muted); margin-top: .2rem; }
    }

    .pill-row { display: flex; flex-wrap: wrap; gap: .375rem; margin-top: .5rem; }
    .macro-pill {
      font-size: .7rem; font-weight: 600; padding: .15rem .5rem; border-radius: 99px;
      &.kcal { background: #fef3c7; color: #92400e; }
      &.prot { background: #dbeafe; color: #1e40af; }
      &.carb { background: #fce7f3; color: #9d174d; }
      &.fat  { background: #ede9fe; color: #5b21b6; }
    }
    .type-pill { font-size: .7rem; font-weight: 700; padding: .1rem .5rem; border-radius: 99px;
      background: #ede9fe; color: #6b21a8; display: inline-block; margin-top: .25rem; }

    .food-list { margin-top: .75rem; padding-top: .75rem; border-top: 1px dashed var(--color-border);
      display: flex; flex-direction: column; gap: .375rem; }
    .food-item { display: flex; align-items: center; justify-content: space-between; font-size: .8rem;
      .fname { color: var(--color-text); } .fmacro { color: var(--color-text-muted); font-size: .72rem; } }

    .check-btn {
      width: 44px; height: 44px; border-radius: 50%; border: 2.5px solid var(--color-border);
      background: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
      font-size: 1.25rem; transition: all .2s; flex-shrink: 0;
      &.done     { background: #16a34a; border-color: #16a34a; color: #fff; }
      &.med-done { background: #7c3aed; border-color: #7c3aed; color: #fff; }
      &:hover:not(.done):not(.med-done) { border-color: #16a34a; background: #f0fdf4; }
    }

    .done-note { margin-top: .5rem; font-size: .72rem; font-weight: 600; }

    @keyframes xpPop {
      0%   { transform: scale(1); opacity: 1; }
      50%  { transform: scale(1.5) translateY(-10px); opacity: 1; }
      100% { transform: scale(1) translateY(-20px); opacity: 0; }
    }
    .xp-pop { position: fixed; pointer-events: none; z-index: 999;
      font-size: 1.25rem; font-weight: 800; color: #6366f1;
      animation: xpPop .9s ease forwards; }

    .empty-state { text-align: center; padding: 3rem; color: var(--color-text-muted);
      .emoji { font-size: 3rem; display: block; margin-bottom: .75rem; } }
  `],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>🍽️ Dieta & Medicamentos</h2>
        <p>Sua timeline diária com refeições e medicamentos. Marque cada item e ganhe XP!</p>
      </div>

      <div class="controls">
        <input type="date" [value]="selectedDate()" (change)="onDateChange($event)" />
        <button class="btn btn-primary" (click)="generate()" [disabled]="generating()">
          {{ generating() ? '⏳ Gerando...' : '✨ Gerar Plano do Dia' }}
        </button>
        <button class="btn" (click)="load()">🔄 Recarregar</button>
      </div>

      @if (totalXp() > 0) {
        <div class="xp-banner">
          <div class="xp-icon">⚡</div>
          <div class="xp-info">
            <div class="xp-level">{{ currentLevel()?.title }} · Nível {{ currentLevel()?.level }}</div>
            <div class="xp-val">{{ totalXp() }} XP</div>
          </div>
          <div class="xp-bar-wrap">
            <div class="xp-bar-bg">
              <div class="xp-bar-fill" [style.width]="xpPct() + '%'"></div>
            </div>
            <div class="xp-next">Próximo: {{ currentLevel()?.nextLevelXp }} XP</div>
          </div>
        </div>
      }

      @if (meals().length > 0) {
        <div class="macros-row">
          <div class="macro-card">
            <div class="mv">{{ totalCal() | number:'1.0-0' }}</div>
            <div class="ml">Calorias</div><div class="mc">kcal planejadas</div>
          </div>
          <div class="macro-card">
            <div class="mv">{{ totalProtein() | number:'1.0-0' }}g</div>
            <div class="ml">Proteína</div><div class="mc">meta do dia</div>
          </div>
          <div class="macro-card">
            <div class="mv">{{ totalCarbs() | number:'1.0-0' }}g</div>
            <div class="ml">Carboidratos</div><div class="mc">meta do dia</div>
          </div>
          <div class="macro-card">
            <div class="mv">{{ consumedMeals() }}/{{ meals().length }}</div>
            <div class="ml">Refeições</div><div class="mc">concluídas</div>
          </div>
        </div>
      }

      @if (loading()) {
        <div style="text-align:center;padding:3rem;color:var(--color-text-muted)">
          <div class="spinner" style="margin:0 auto 1rem"></div> Carregando...
        </div>
      } @else if (timeline().length === 0) {
        <div class="empty-state">
          <span class="emoji">🍽️</span>
          <p>Nenhum item para este dia.<br>
            Clique em <strong>Gerar Plano do Dia</strong> para criar seu plano alimentar.<br>
            Adicione medicamentos em <strong>💊 Medicamentos</strong> para vê-los aqui.</p>
        </div>
      } @else {
        <div class="timeline">
          @for (item of timeline(); track itemKey(item)) {

            @if (item.kind === 'meal') {
              <div class="timeline-card"
                [class.done]="item.data.isConsumed"
                [class.checking]="checking() === item.data.id">
                <div class="card-row">
                  <span class="time-badge meal">⏰ {{ item.data.scheduledTime }}</span>
                  <div class="card-info">
                    <div class="item-name" [class.struck]="item.data.isConsumed">{{ item.data.name }}</div>
                    <div class="pill-row">
                      @if (item.data.caloricTarget) {
                        <span class="macro-pill kcal">🔥 {{ item.data.caloricTarget | number:'1.0-0' }} kcal</span>
                      }
                      @if (item.data.proteinG) {
                        <span class="macro-pill prot">💪 {{ item.data.proteinG | number:'1.0-0' }}g prot</span>
                      }
                      @if (item.data.carbsG) {
                        <span class="macro-pill carb">🌾 {{ item.data.carbsG | number:'1.0-0' }}g carb</span>
                      }
                      @if (item.data.fatG) {
                        <span class="macro-pill fat">🥑 {{ item.data.fatG | number:'1.0-0' }}g gord</span>
                      }
                    </div>
                  </div>
                  <button class="check-btn" [class.done]="item.data.isConsumed"
                    (click)="toggleMeal(item.data, $event)" [disabled]="checking() === item.data.id">
                    {{ item.data.isConsumed ? '✓' : '○' }}
                  </button>
                </div>

                @if (item.data.foods && item.data.foods.length > 0) {
                  <div class="food-list">
                    @for (food of item.data.foods; track food.name) {
                      <div class="food-item">
                        <span class="fname">🥄 {{ food.name }}</span>
                        <span class="fmacro">{{ food.quantityG }}g · {{ food.calories | number:'1.0-0' }} kcal</span>
                      </div>
                    }
                  </div>
                }

                @if (item.data.isConsumed && item.data.consumedAt) {
                  <div class="done-note" style="color:#16a34a">
                    ✓ Consumida às {{ item.data.consumedAt | date:'HH:mm' }}
                    @if (item.data.xpAwarded) { · +{{ XP_MEAL }} XP! }
                  </div>
                }
              </div>
            }

            @if (item.kind === 'medication') {
              <div class="timeline-card med-card"
                [class.done]="!!item.data.log"
                [class.checking]="checking() === 'med-' + item.data.id">
                <div class="card-row">
                  <span class="time-badge med">💊 {{ item.data.scheduledTime }}</span>
                  <div class="card-info">
                    <div class="item-name" [class.struck]="!!item.data.log">{{ item.data.name }}</div>
                    <div class="item-sub">{{ item.data.dosage }}</div>
                    <span class="type-pill">{{ item.data.type }}</span>
                  </div>
                  <button class="check-btn" [class.med-done]="!!item.data.log"
                    (click)="toggleMedication(item.data, $event)" [disabled]="checking() === 'med-' + item.data.id">
                    {{ item.data.log ? '✓' : '○' }}
                  </button>
                </div>
                @if (item.data.log) {
                  <div class="done-note" style="color:#7c3aed">
                    ✓ Tomado às {{ item.data.log.takenAt | date:'HH:mm' }}
                    @if (item.data.log.xpAwarded) { · +{{ XP_MED }} XP! }
                  </div>
                }
              </div>
            }

          }
        </div>
      }
    </div>

    @if (xpPopVisible()) {
      <div class="xp-pop" [style.left]="xpPopX + 'px'" [style.top]="xpPopY + 'px'">
        +{{ lastXp() }} XP ⚡
      </div>
    }
  `,
})
export class DietPlanComponent implements OnInit {
  private mealSvc = inject(DietPlanService);
  private medSvc  = inject(MedicationService);

  readonly XP_MEAL = 10;
  readonly XP_MED  = 5;

  loading      = signal(false);
  generating   = signal(false);
  checking     = signal<string | null>(null);
  meals        = signal<ScheduledMeal[]>([]);
  medications  = signal<MedicationWithLog[]>([]);
  selectedDate = signal(new Date().toISOString().slice(0, 10));
  totalXp      = signal(0);
  currentLevel = signal<UserLevel | null>(null);
  lastXp       = signal(0);
  xpPopVisible = signal(false);
  xpPopX = 0; xpPopY = 0;

  timeline = computed((): TimelineItem[] => {
    const items: TimelineItem[] = [
      ...this.meals().map(m => ({ kind: 'meal' as const, data: m })),
      ...this.medications().map(m => ({ kind: 'medication' as const, data: m })),
    ];
    return items.sort((a, b) => toMinutes(a.data.scheduledTime) - toMinutes(b.data.scheduledTime));
  });

  totalCal     = computed(() => this.meals().reduce((s, m) => s + (m.caloricTarget ?? 0), 0));
  totalProtein = computed(() => this.meals().reduce((s, m) => s + (m.proteinG ?? 0), 0));
  totalCarbs   = computed(() => this.meals().reduce((s, m) => s + (m.carbsG ?? 0), 0));
  consumedMeals= computed(() => this.meals().filter(m => m.isConsumed).length);

  xpPct = computed(() => {
    const lv = this.currentLevel();
    if (!lv) return 0;
    return Math.min(100, Math.round((this.totalXp() / lv.nextLevelXp) * 100));
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    const date = this.selectedDate();
    let pending = 2;
    const done = () => { if (--pending === 0) this.loading.set(false); };

    this.mealSvc.list(date).subscribe({ next: m => { this.meals.set(m); done(); }, error: done });
    this.medSvc.logsForDate(date).subscribe({
      next: m => { this.medications.set(m.filter(x => x.isActive)); done(); },
      error: done,
    });
  }

  generate(): void {
    this.generating.set(true);
    this.mealSvc.generate(this.selectedDate()).subscribe({
      next: meals => { this.meals.set(meals); this.generating.set(false); },
      error: () => this.generating.set(false),
    });
  }

  onDateChange(e: Event): void {
    this.selectedDate.set((e.target as HTMLInputElement).value);
    this.load();
  }

  itemKey(item: TimelineItem): string {
    return item.kind + '-' + item.data.id;
  }

  toggleMeal(meal: ScheduledMeal, event?: MouseEvent): void {
    this.checking.set(meal.id);
    this.mealSvc.toggle(meal.id).subscribe({
      next: result => {
        this.meals.update(list => list.map(m => m.id === meal.id ? result.meal : m));
        this.totalXp.set(result.totalXp);
        this.currentLevel.set(result.level);
        this.checking.set(null);
        if (result.xpGained > 0) this.showXpPop(result.xpGained, event);
      },
      error: () => this.checking.set(null),
    });
  }

  toggleMedication(med: MedicationWithLog, event?: MouseEvent): void {
    this.checking.set('med-' + med.id);
    this.medSvc.toggle(med.id, this.selectedDate()).subscribe({
      next: result => {
        this.medSvc.logsForDate(this.selectedDate()).subscribe({
          next: list => this.medications.set(list.filter(x => x.isActive)),
        });
        this.checking.set(null);
        if (result.xpGained > 0) this.showXpPop(result.xpGained, event);
      },
      error: () => this.checking.set(null),
    });
  }

  private showXpPop(xp: number, event?: MouseEvent): void {
    this.lastXp.set(xp);
    this.xpPopX = event?.clientX ?? window.innerWidth / 2;
    this.xpPopY = event?.clientY ?? window.innerHeight / 2;
    this.xpPopVisible.set(true);
    setTimeout(() => this.xpPopVisible.set(false), 900);
  }
}
