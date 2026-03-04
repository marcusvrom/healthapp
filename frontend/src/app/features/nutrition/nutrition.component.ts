import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { FoodService } from '../../core/services/food.service';
import { ProfileService } from '../../core/services/profile.service';
import { Food, Meal, MealType, DailySummary } from '../../core/models';
import { debounceTime, distinctUntilChanged, Subject, switchMap, catchError, of } from 'rxjs';

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast:       '☀️ Café da Manhã',
  morning_snack:   '🍎 Lanche da Manhã',
  lunch:           '🍽️ Almoço',
  afternoon_snack: '🥗 Lanche da Tarde',
  pre_workout:     '⚡ Pré-Treino',
  post_workout:    '💪 Pós-Treino',
  dinner:          '🌙 Jantar',
  supper:          '🌛 Ceia',
};

@Component({
  selector: 'app-nutrition',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  styles: [`
    .nutrition { padding: 1.5rem; display: grid; grid-template-columns: 1fr 380px; gap: 1.5rem; align-items: start;
      @media (max-width: 900px) { grid-template-columns: 1fr; }
    }

    .page-title { grid-column: 1/-1; }

    /* Search panel */
    .search-panel {
      .search-bar {
        position: relative; margin-bottom: 1rem;
        input { padding-left: 2.5rem; width: 100%; }
        .search-icon { position: absolute; left: .75rem; top: 50%; transform: translateY(-50%); font-size: 1rem; color: var(--color-text-subtle); }
      }

      .searching { display: flex; align-items: center; gap: .75rem; padding: 1rem; color: var(--color-text-muted); font-size: .9rem; }

      .results { display: flex; flex-direction: column; gap: .5rem; }

      .food-item {
        background: var(--color-surface); border: 1px solid var(--color-border);
        border-radius: var(--radius-md); padding: .875rem 1rem;
        display: flex; align-items: center; gap .75rem; cursor: pointer;
        transition: border-color .15s;

        &:hover { border-color: var(--color-primary); }

        .food-info { flex: 1; }
        .food-name { font-weight: 600; font-size: .9rem; }
        .food-source { font-size: .7rem; color: var(--color-text-subtle); margin-top: .1rem; }
        .food-macros { display: flex; gap: .5rem; margin-top: .375rem; flex-wrap: wrap; }

        .add-btn { flex-shrink: 0; }
      }

      .empty-state { text-align: center; padding: 3rem 1rem;
        .emoji { font-size: 3rem; display: block; margin-bottom: 1rem; }
        p { color: var(--color-text-muted); }
      }
    }

    /* Add to meal modal */
    .add-modal {
      position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 100;
      display: flex; align-items: flex-end; justify-content: center;
      @media (min-width: 600px) { align-items: center; }

      .modal-card {
        background: var(--color-surface); border-radius: 20px 20px 0 0;
        padding: 1.5rem; width: 100%; max-width: 480px; animation: fadeIn .25s ease;
        @media (min-width: 600px) { border-radius: 20px; }

        .modal-title { font-size: 1.1rem; font-weight: 700; margin-bottom: .25rem; }
        .modal-sub   { font-size: .82rem; color: var(--color-text-muted); margin-bottom: 1.25rem; }

        .modal-macros { display: grid; grid-template-columns: repeat(4, 1fr); gap: .5rem; margin: 1rem 0;
          .m { background: var(--color-surface-2); border-radius: var(--radius-sm); padding: .5rem; text-align: center;
            .v { font-size: 1rem; font-weight: 700; }
            .l { font-size: .65rem; color: var(--color-text-subtle); }
          }
        }

        .modal-actions { display: flex; gap: .75rem; margin-top: 1.25rem; }
      }
    }

    /* Right panel: today's meals */
    .meals-panel {
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-md);

      .panel-header {
        padding: 1rem 1.25rem; border-bottom: 1px solid var(--color-border);
        display: flex; align-items: center; justify-content: space-between;
        h3 { font-size: 1rem; font-weight: 700; }
      }

      .day-summary {
        padding: 1rem 1.25rem; border-bottom: 1px solid var(--color-border);
        background: var(--color-primary-light);
        display: grid; grid-template-columns: repeat(2, 1fr); gap: .5rem;

        .sum-item { .v { font-size: 1.1rem; font-weight: 800; color: var(--color-primary-dark); }
          .l { font-size: .7rem; color: var(--color-text-muted); } }
      }

      .meal-list { display: flex; flex-direction: column; }

      .meal-group {
        border-bottom: 1px solid var(--color-border); padding: 1rem 1.25rem;

        .meal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: .5rem;
          .meal-name  { font-size: .875rem; font-weight: 700; }
          .meal-kcal  { font-size: .78rem; color: var(--color-text-muted); }
          .del-btn    { background: none; border: none; cursor: pointer; color: var(--color-text-subtle); font-size: 1rem;
            &:hover { color: var(--color-danger); } }
        }

        .food-rows { display: flex; flex-direction: column; gap: .375rem; }
        .food-row  { display: flex; align-items: center; font-size: .8rem;
          .food-name { flex: 1; color: var(--color-text); }
          .food-qty  { color: var(--color-text-subtle); margin-right: .5rem; }
          .food-kcal { font-weight: 600; color: var(--color-primary-dark); }
          .rm-btn    { background: none; border: none; cursor: pointer; color: var(--color-text-subtle); padding: 0 .25rem;
            &:hover { color: var(--color-danger); } }
        }
      }

      .no-meals { padding: 2rem 1.25rem; text-align: center; color: var(--color-text-muted); font-size: .875rem; }
    }
  `],
  template: `
    <div class="nutrition">
      <div class="page-title">
        <h2>🥗 Nutrição & Cardápio</h2>
        <p>Busque alimentos e monte suas refeições do dia.</p>
      </div>

      <!-- Food search -->
      <div class="search-panel card">
        <div class="search-bar form-group">
          <span class="search-icon">🔍</span>
          <input type="text" [(ngModel)]="query" (ngModelChange)="onSearch($event)"
            placeholder="Buscar alimento (ex: arroz, frango, banana)..." />
        </div>

        @if (searching()) {
          <div class="searching"><span class="spinner"></span> Buscando...</div>
        } @else if (results().length > 0) {
          <div class="results stagger">
            @for (food of results(); track food.id) {
              <div class="food-item animate-fade" (click)="openAddModal(food)">
                <div class="food-info">
                  <div class="food-name">{{ food.name }}</div>
                  <div class="food-source">{{ sourceLabel(food.source) }}</div>
                  <div class="food-macros">
                    <span class="chip chip-green">{{ food.calories | number:'1.0-0' }} kcal</span>
                    <span class="chip chip-blue">P: {{ food.protein | number:'1.0-1' }}g</span>
                    <span class="chip chip-amber">C: {{ food.carbs | number:'1.0-1' }}g</span>
                    <span class="chip chip-purple">G: {{ food.fat | number:'1.0-1' }}g</span>
                    @if (food.householdMeasure) {
                      <span class="chip chip-gray">{{ food.householdMeasure }}</span>
                    }
                  </div>
                </div>
                <button class="btn btn-primary btn-sm add-btn">+ Adicionar</button>
              </div>
            }
          </div>
        } @else if (query().length >= 2 && !searching()) {
          <div class="empty-state">
            <span class="emoji">🔎</span>
            <p>Nenhum alimento encontrado para "<strong>{{ query() }}</strong>".<br>Tente outro termo.</p>
          </div>
        } @else {
          <div class="empty-state">
            <span class="emoji">🥦</span>
            <p>Digite o nome de um alimento para buscar.<br>Pesquisamos no banco TACO/TBCA e no Open Food Facts.</p>
          </div>
        }
      </div>

      <!-- Today's meals -->
      <div class="meals-panel">
        <div class="panel-header">
          <h3>📋 Refeições de Hoje</h3>
          <span class="chip chip-gray">{{ selectedDate() }}</span>
        </div>

        @if (summary()) {
          <div class="day-summary">
            <div class="sum-item"><div class="v">{{ summary()!.totalCalories | number:'1.0-0' }} kcal</div><div class="l">Calorias totais</div></div>
            <div class="sum-item"><div class="v">{{ summary()!.totalProtein | number:'1.0-0' }}g</div><div class="l">Proteína</div></div>
            <div class="sum-item"><div class="v">{{ summary()!.totalCarbs | number:'1.0-0' }}g</div><div class="l">Carboidratos</div></div>
            <div class="sum-item"><div class="v">{{ summary()!.totalFat | number:'1.0-0' }}g</div><div class="l">Gorduras</div></div>
          </div>
        }

        <div class="meal-list">
          @if (meals().length === 0) {
            <div class="no-meals">Nenhuma refeição registrada hoje.<br>Busque alimentos e adicione às refeições.</div>
          }
          @for (meal of meals(); track meal.id) {
            <div class="meal-group">
              <div class="meal-header">
                <span class="meal-name">{{ mealLabel(meal.mealType) }}</span>
                <span class="meal-kcal">{{ meal.totalCalories | number:'1.0-0' }} kcal</span>
                <button class="del-btn" (click)="deleteMeal(meal.id)" title="Remover refeição">🗑️</button>
              </div>
              <div class="food-rows">
                @for (mf of meal.mealFoods; track mf.id) {
                  <div class="food-row">
                    <span class="food-name">{{ mf.food.name }}</span>
                    <span class="food-qty">{{ mf.quantityG | number:'1.0-0' }}g</span>
                    <span class="food-kcal">{{ mf.computedCalories | number:'1.0-0' }} kcal</span>
                    <button class="rm-btn" (click)="removeMealFood(meal.id, mf.id)">✕</button>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>

    <!-- Add food modal -->
    @if (modalFood()) {
      <div class="add-modal" (click)="closeModal()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-title">{{ modalFood()!.name }}</div>
          <div class="modal-sub">Valores por 100g</div>

          <div class="modal-macros">
            <div class="m"><div class="v" style="color:var(--color-primary)">{{ adjustedKcal() | number:'1.0-0' }}</div><div class="l">kcal</div></div>
            <div class="m"><div class="v" style="color:#10b981">{{ adjustedProtein() | number:'1.0-1' }}g</div><div class="l">Proteína</div></div>
            <div class="m"><div class="v" style="color:#f59e0b">{{ adjustedCarbs() | number:'1.0-1' }}g</div><div class="l">Carbos</div></div>
            <div class="m"><div class="v" style="color:#6366f1">{{ adjustedFat() | number:'1.0-1' }}g</div><div class="l">Gordura</div></div>
          </div>

          <div class="row" style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
            <div class="form-group">
              <label>Refeição</label>
              <select [(ngModel)]="selectedMealType">
                @for (mt of mealTypes; track mt.value) {
                  <option [value]="mt.value">{{ mt.label }}</option>
                }
              </select>
            </div>
            <div class="form-group">
              <label>Quantidade (g)</label>
              <input type="number" [(ngModel)]="quantity" min="1" max="2000" />
            </div>
          </div>

          <div class="modal-actions">
            <button class="btn btn-secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn btn-primary" style="flex:1" (click)="addFood()" [disabled]="addingFood()">
              {{ addingFood() ? 'Adicionando...' : '✓ Adicionar à refeição' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class NutritionComponent implements OnInit {
  private foodSvc    = inject(FoodService);
  private profileSvc = inject(ProfileService);

  query      = signal('');
  results    = signal<Food[]>([]);
  searching  = signal(false);
  meals      = signal<Meal[]>([]);
  summary    = signal<DailySummary | null>(null);
  modalFood  = signal<Food | null>(null);
  addingFood = signal(false);

  selectedMealType = signal<MealType>('lunch');
  quantity         = signal(100);

  private search$ = new Subject<string>();
  readonly selectedDate = computed(() => new Date().toISOString().slice(0, 10));

  readonly mealTypes = Object.entries(MEAL_TYPE_LABELS).map(([value, label]) => ({ value: value as MealType, label }));

  readonly adjustedKcal    = computed(() => this.adjust(this.modalFood()?.calories ?? 0));
  readonly adjustedProtein = computed(() => this.adjust(this.modalFood()?.protein  ?? 0));
  readonly adjustedCarbs   = computed(() => this.adjust(this.modalFood()?.carbs    ?? 0));
  readonly adjustedFat     = computed(() => this.adjust(this.modalFood()?.fat      ?? 0));

  ngOnInit(): void {
    this.search$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(q => {
        if (q.length < 2) { this.results.set([]); return of([]); }
        this.searching.set(true);
        return this.foodSvc.search(q).pipe(catchError(() => of([])));
      })
    ).subscribe(r => { this.results.set(r); this.searching.set(false); });

    this.loadMeals();
  }

  onSearch(q: string): void { this.search$.next(q); }

  private loadMeals(): void {
    const date = this.selectedDate();
    this.foodSvc.getMeals(date).subscribe({ next: m => this.meals.set(m), error: () => {} });
    this.foodSvc.getSummary(date).subscribe({ next: s => this.summary.set(s), error: () => {} });
  }

  openAddModal(food: Food): void {
    this.modalFood.set(food);
    this.quantity.set(food.gramsReference ?? 100);
  }

  closeModal(): void { this.modalFood.set(null); }

  addFood(): void {
    const food = this.modalFood();
    if (!food) return;
    this.addingFood.set(true);

    this.foodSvc.createMeal({
      mealDate: this.selectedDate(),
      mealType: this.selectedMealType(),
      foods: [{ foodId: food.id, quantityG: this.quantity() }],
    }).subscribe({
      next: () => { this.closeModal(); this.loadMeals(); this.addingFood.set(false); },
      error: () => this.addingFood.set(false),
    });
  }

  deleteMeal(mealId: string): void {
    this.foodSvc.deleteMeal(mealId).subscribe({ next: () => this.loadMeals() });
  }

  removeMealFood(mealId: string, mealFoodId: string): void {
    this.foodSvc.removeMealFood(mealId, mealFoodId).subscribe({ next: () => this.loadMeals() });
  }

  mealLabel(type: MealType): string { return MEAL_TYPE_LABELS[type] ?? type; }

  sourceLabel(source: string): string {
    const map: Record<string, string> = { TACO: 'TACO (Brasil)', TBCA: 'TBCA (Brasil)', OpenFoodFacts: 'Open Food Facts', UserCustom: 'Personalizado' };
    return map[source] ?? source;
  }

  private adjust(per100g: number): number {
    return Math.round(per100g * this.quantity() / 100 * 10) / 10;
  }
}
