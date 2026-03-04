import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { DietPlanService } from '../../core/services/diet-plan.service';
import { ScheduledMeal, UserLevel } from '../../core/models';

@Component({
  selector: 'app-diet-plan',
  standalone: true,
  imports: [FormsModule, DecimalPipe, DatePipe],
  styles: [`
    .page { padding: 1.5rem; max-width: 860px; margin: 0 auto; }
    .page-header { margin-bottom: 1.5rem; h2 { font-size: 1.5rem; } p { color: var(--color-text-muted); } }

    /* Date + controls row */
    .controls {
      display: flex; align-items: center; gap: .75rem; margin-bottom: 1.5rem;
      flex-wrap: wrap;
      input[type=date] { border: 1.5px solid var(--color-border); border-radius: var(--radius-sm);
        padding: .45rem .75rem; font-size: .875rem; }
    }

    /* XP banner */
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

    /* Daily macros summary */
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

    /* Timeline */
    .timeline { position: relative; padding-left: 2.5rem;
      &::before { content: ''; position: absolute; left: .9rem; top: 0; bottom: 0;
        width: 2px; background: var(--color-border); border-radius: 99px; }
    }

    .meal-card {
      position: relative; background: var(--color-surface);
      border: 2px solid var(--color-border);
      border-radius: var(--radius-md); padding: 1rem 1.25rem;
      margin-bottom: 1rem; transition: all .25s;

      /* Timeline dot */
      &::before { content: ''; position: absolute; left: -2rem; top: 1.125rem;
        width: 12px; height: 12px; border-radius: 50%;
        background: var(--color-border); border: 2px solid #fff;
        box-shadow: 0 0 0 2px var(--color-border); }

      &.consumed {
        background: #f0fdf4; border-color: #86efac; opacity: .85;
        &::before { background: #16a34a; box-shadow: 0 0 0 2px #86efac; }
        .meal-name { text-decoration: line-through; color: var(--color-text-subtle); }
      }

      &.checking { opacity: .7; pointer-events: none; }
    }

    .meal-header {
      display: flex; align-items: flex-start; gap: .875rem;
      .time-badge { background: var(--color-primary-light); color: var(--color-primary-dark);
        padding: .25rem .625rem; border-radius: var(--radius-sm); font-size: .78rem;
        font-weight: 700; white-space: nowrap; }
      .meal-info { flex: 1; }
      .meal-name  { font-size: 1rem; font-weight: 700; margin-bottom: .25rem; }
      .meal-macros{ font-size: .72rem; color: var(--color-text-muted);
        span { margin-right: .625rem; font-weight: 600; }
      }
      .meal-action { display: flex; align-items: center; gap: .5rem; }
    }

    /* Check button */
    .check-btn {
      width: 44px; height: 44px; border-radius: 50%; border: 2.5px solid var(--color-border);
      background: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
      font-size: 1.25rem; transition: all .2s; flex-shrink: 0;
      &.done { background: #16a34a; border-color: #16a34a; color: #fff; }
      &:hover:not(.done) { border-color: #16a34a; background: #f0fdf4; }
    }

    /* Food list (collapsible) */
    .food-list {
      margin-top: .75rem; padding-top: .75rem;
      border-top: 1px dashed var(--color-border);
      display: flex; flex-direction: column; gap: .375rem;
    }
    .food-item {
      display: flex; align-items: center; justify-content: space-between;
      font-size: .8rem;
      .fname  { color: var(--color-text); }
      .fmacro { color: var(--color-text-muted); font-size: .72rem; }
    }

    /* Macro pill row per meal */
    .pill-row { display: flex; flex-wrap: wrap; gap: .375rem; margin-top: .5rem; }
    .macro-pill {
      font-size: .7rem; font-weight: 600; padding: .15rem .5rem; border-radius: 99px;
      &.kcal  { background: #fef3c7; color: #92400e; }
      &.prot  { background: #dbeafe; color: #1e40af; }
      &.carb  { background: #fce7f3; color: #9d174d; }
      &.fat   { background: #ede9fe; color: #5b21b6; }
    }

    /* XP pop animation */
    @keyframes xpPop {
      0%   { transform: scale(1); opacity: 1; }
      50%  { transform: scale(1.5) translateY(-10px); opacity: 1; }
      100% { transform: scale(1) translateY(-20px); opacity: 0; }
    }
    .xp-pop {
      position: fixed; pointer-events: none; z-index: 999;
      font-size: 1.25rem; font-weight: 800; color: #6366f1;
      animation: xpPop .9s ease forwards;
    }

    /* Empty state */
    .empty-state { text-align: center; padding: 3rem; color: var(--color-text-muted);
      .emoji { font-size: 3rem; display: block; margin-bottom: .75rem; }
    }
  `],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>🍽️ Plano Alimentar</h2>
        <p>Suas refeições planejadas para o dia. Marque cada uma como concluída e ganhe XP!</p>
      </div>

      <!-- Controls -->
      <div class="controls">
        <input type="date" [value]="selectedDate()" (change)="onDateChange($event)" />
        <button class="btn btn-primary" (click)="generate()" [disabled]="generating()">
          {{ generating() ? '⏳ Gerando...' : '✨ Gerar Plano do Dia' }}
        </button>
        @if (meals().length > 0) {
          <button class="btn" (click)="load()">🔄 Recarregar</button>
        }
      </div>

      <!-- XP banner -->
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

      <!-- Daily macro summary -->
      @if (meals().length > 0) {
        <div class="macros-row">
          <div class="macro-card">
            <div class="mv">{{ totalCal() | number:'1.0-0' }}</div>
            <div class="ml">Calorias</div>
            <div class="mc">kcal planejadas</div>
          </div>
          <div class="macro-card">
            <div class="mv">{{ totalProtein() | number:'1.0-0' }}g</div>
            <div class="ml">Proteína</div>
            <div class="mc">meta do dia</div>
          </div>
          <div class="macro-card">
            <div class="mv">{{ totalCarbs() | number:'1.0-0' }}g</div>
            <div class="ml">Carboidratos</div>
            <div class="mc">meta do dia</div>
          </div>
          <div class="macro-card">
            <div class="mv">{{ consumedCount() }}/{{ meals().length }}</div>
            <div class="ml">Concluídas</div>
            <div class="mc">refeições</div>
          </div>
        </div>
      }

      <!-- Timeline -->
      @if (loading()) {
        <div style="text-align:center;padding:3rem;color:var(--color-text-muted)">
          <div class="spinner" style="margin:0 auto 1rem"></div> Carregando...
        </div>
      } @else if (meals().length === 0) {
        <div class="empty-state">
          <span class="emoji">🍽️</span>
          <p>Nenhuma refeição planejada para este dia.<br>
            Clique em <strong>Gerar Plano do Dia</strong> para criar seu plano alimentar personalizado.</p>
        </div>
      } @else {
        <div class="timeline">
          @for (meal of meals(); track meal.id) {
            <div class="meal-card" [class.consumed]="meal.isConsumed" [class.checking]="checking() === meal.id">
              <div class="meal-header">
                <span class="time-badge">⏰ {{ meal.scheduledTime }}</span>
                <div class="meal-info">
                  <div class="meal-name">{{ meal.name }}</div>
                  <div class="pill-row">
                    @if (meal.caloricTarget) {
                      <span class="macro-pill kcal">🔥 {{ meal.caloricTarget | number:'1.0-0' }} kcal</span>
                    }
                    @if (meal.proteinG) {
                      <span class="macro-pill prot">💪 {{ meal.proteinG | number:'1.0-0' }}g prot</span>
                    }
                    @if (meal.carbsG) {
                      <span class="macro-pill carb">🌾 {{ meal.carbsG | number:'1.0-0' }}g carb</span>
                    }
                    @if (meal.fatG) {
                      <span class="macro-pill fat">🥑 {{ meal.fatG | number:'1.0-0' }}g gord</span>
                    }
                  </div>
                </div>
                <div class="meal-action">
                  <button class="check-btn" [class.done]="meal.isConsumed"
                    (click)="toggle(meal)" [disabled]="checking() === meal.id">
                    {{ meal.isConsumed ? '✓' : '○' }}
                  </button>
                </div>
              </div>

              @if (meal.foods && meal.foods.length > 0) {
                <div class="food-list">
                  @for (food of meal.foods; track food.name) {
                    <div class="food-item">
                      <span class="fname">🥄 {{ food.name }}</span>
                      <span class="fmacro">{{ food.quantityG }}g · {{ food.calories | number:'1.0-0' }} kcal</span>
                    </div>
                  }
                </div>
              }

              @if (meal.isConsumed && meal.consumedAt) {
                <div style="margin-top:.5rem;font-size:.72rem;color:#16a34a;font-weight:600">
                  ✓ Consumida às {{ meal.consumedAt | date:'HH:mm' }}
                  @if (meal.xpAwarded) { · +{{ XP_PER_MEAL }} XP ganhos! }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>

    <!-- XP pop overlay portal -->
    @if (xpPopVisible()) {
      <div class="xp-pop" [style.left]="xpPopX + 'px'" [style.top]="xpPopY + 'px'">
        +{{ XP_PER_MEAL }} XP ⚡
      </div>
    }
  `,
})
export class DietPlanComponent implements OnInit {
  private svc = inject(DietPlanService);

  readonly XP_PER_MEAL = 10;

  loading     = signal(false);
  generating  = signal(false);
  checking    = signal<string | null>(null);
  meals       = signal<ScheduledMeal[]>([]);
  selectedDate= signal(new Date().toISOString().slice(0, 10));
  totalXp     = signal(0);
  currentLevel= signal<UserLevel | null>(null);

  // XP pop animation
  xpPopVisible= signal(false);
  xpPopX = 0; xpPopY = 0;

  // Computed summaries
  totalCal     = computed(() => this.meals().reduce((s, m) => s + (m.caloricTarget ?? 0), 0));
  totalProtein = computed(() => this.meals().reduce((s, m) => s + (m.proteinG ?? 0), 0));
  totalCarbs   = computed(() => this.meals().reduce((s, m) => s + (m.carbsG ?? 0), 0));
  consumedCount= computed(() => this.meals().filter(m => m.isConsumed).length);

  xpPct = computed(() => {
    const lv = this.currentLevel();
    if (!lv) return 0;
    return Math.min(100, Math.round((this.totalXp() / lv.nextLevelXp) * 100));
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.svc.list(this.selectedDate()).subscribe({
      next: meals => { this.meals.set(meals); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  generate(): void {
    this.generating.set(true);
    this.svc.generate(this.selectedDate()).subscribe({
      next: meals => { this.meals.set(meals); this.generating.set(false); },
      error: () => this.generating.set(false),
    });
  }

  onDateChange(e: Event): void {
    const val = (e.target as HTMLInputElement).value;
    this.selectedDate.set(val);
    this.load();
  }

  toggle(meal: ScheduledMeal, event?: MouseEvent): void {
    this.checking.set(meal.id);
    this.svc.toggle(meal.id).subscribe({
      next: result => {
        this.meals.update(list => list.map(m => m.id === meal.id ? result.meal : m));
        this.totalXp.set(result.totalXp);
        this.currentLevel.set(result.level);
        this.checking.set(null);

        if (result.xpGained > 0) {
          this.showXpPop(event);
        }
      },
      error: () => this.checking.set(null),
    });
  }

  private showXpPop(event?: MouseEvent): void {
    this.xpPopX = event?.clientX ?? window.innerWidth / 2;
    this.xpPopY = event?.clientY ?? window.innerHeight / 2;
    this.xpPopVisible.set(true);
    setTimeout(() => this.xpPopVisible.set(false), 900);
  }
}
