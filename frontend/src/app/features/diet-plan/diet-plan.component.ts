import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DietPlanService } from '../../core/services/diet-plan.service';
import { ProfileService } from '../../core/services/profile.service';
import { FoodService } from '../../core/services/food.service';
import { ClinicalProtocolService } from '../../core/services/clinical-protocol.service';
import { RecipeService } from '../../core/services/recipe.service';
import { ScheduledMealService } from '../../core/services/scheduled-meal.service';
import { ScheduledMeal, UserLevel, ClinicalProtocolWithLog, PrimaryGoal, Recipe, LinkedRecipe, DailySummary } from '../../core/models';

const GOAL_LABELS: Record<PrimaryGoal, string> = {
  emagrecimento: 'Emagrecimento',
  ganho_massa:   'Ganho de Massa',
  manutencao:    'Manutencao',
  saude_geral:   'Saude Geral',
  diabetico:     'Diabetico',
};

const GOAL_EMOJIS: Record<PrimaryGoal, string> = {
  emagrecimento: '🔥',
  ganho_massa:   '💪',
  manutencao:    '⚖️',
  saude_geral:   '🌿',
  diabetico:     '🩺',
};

const CATEGORY_ICON: Record<string, string> = {
  SUPLEMENTO:         '🧴',
  REMEDIO_CONTROLADO: '💊',
  TRT:                '💉',
  HORMONIO_FEMININO:  '🌸',
  SONO:               '😴',
};

type TimelineItem =
  | { kind: 'meal'; data: ScheduledMeal }
  | { kind: 'protocol'; data: ClinicalProtocolWithLog };

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

@Component({
  selector: 'app-diet-plan',
  standalone: true,
  imports: [FormsModule, DecimalPipe, DatePipe, RouterLink],
  styleUrls: ['./diet-plan.component.scss'],
  templateUrl: './diet-plan.component.html',
})
export class DietPlanComponent implements OnInit {
  private mealSvc      = inject(DietPlanService);
  private profileSvc   = inject(ProfileService);
  private foodSvc      = inject(FoodService);
  private protocolSvc  = inject(ClinicalProtocolService);
  private recipeSvc    = inject(RecipeService);
  private schedMealSvc = inject(ScheduledMealService);

  readonly XP_MEAL  = 10;
  readonly XP_PROTO = 5;

  loading      = signal(false);
  generating   = signal(false);
  checking     = signal<string | null>(null);
  linking      = signal(false);
  meals        = signal<ScheduledMeal[]>([]);
  protocols    = signal<ClinicalProtocolWithLog[]>([]);
  selectedDate = signal(new Date().toISOString().slice(0, 10));
  lastXp       = signal(0);
  xpPopVisible = signal(false);
  xpPopX = 0; xpPopY = 0;

  // Recipe picker
  pickerMeal     = signal<ScheduledMeal | null>(null);
  pickerSelected = signal<Recipe | null>(null);
  pickerQuery    = '';
  pickerServings = 1;
  myRecipes      = signal<Recipe[]>([]);

  readonly metabolic  = this.profileSvc.metabolic;
  readonly profile    = this.profileSvc.profile;
  summary = signal<DailySummary | null>(null);

  readonly goalLabel = computed(() => {
    const g = this.profile()?.primaryGoal;
    return g ? GOAL_LABELS[g] : null;
  });

  readonly goalEmoji = computed(() => {
    const g = this.profile()?.primaryGoal;
    return g ? GOAL_EMOJIS[g] : '🎯';
  });

  readonly targetCal     = computed(() => this.metabolic()?.dailyCaloricTarget ?? 0);
  readonly targetProtein = computed(() => this.metabolic()?.macros?.proteinG ?? 0);
  readonly targetCarbs   = computed(() => this.metabolic()?.macros?.carbsG ?? 0);
  readonly targetFat     = computed(() => this.metabolic()?.macros?.fatG ?? 0);
  readonly consumedMeals = computed(() => this.meals().filter(m => m.isConsumed).length);

  // ── Macro widget computed signals ──────────────────────────────────────
  readonly consumedKcal     = computed(() => this.summary()?.totalCalories ?? 0);
  readonly caloriesPct      = computed(() => { const m = this.metabolic(); return m ? Math.min(110, (this.consumedKcal() / m.dailyCaloricTarget) * 100) : 0; });
  readonly remainingKcal    = computed(() => { const m = this.metabolic(); return m ? Math.round(m.dailyCaloricTarget - this.consumedKcal()) : 0; });
  readonly remainingProtein = computed(() => { const m = this.metabolic(); return m ? Math.round(m.macros.proteinG - (this.summary()?.totalProtein ?? 0)) : 0; });
  readonly remainingCarbs   = computed(() => { const m = this.metabolic(); return m ? Math.round(m.macros.carbsG   - (this.summary()?.totalCarbs   ?? 0)) : 0; });
  readonly remainingFat     = computed(() => { const m = this.metabolic(); return m ? Math.round(m.macros.fatG     - (this.summary()?.totalFat     ?? 0)) : 0; });

  timeline = computed((): TimelineItem[] => {
    const items: TimelineItem[] = [
      ...this.meals().map(m => ({ kind: 'meal' as const, data: m })),
      ...this.protocols().map(p => ({ kind: 'protocol' as const, data: p })),
    ];
    return items.sort((a, b) => toMinutes(a.data.scheduledTime) - toMinutes(b.data.scheduledTime));
  });

  readonly filteredPickerRecipes = computed(() => {
    const q = this.pickerQuery.toLowerCase().trim();
    const recipes = this.myRecipes();
    if (!q) return recipes;
    return recipes.filter(r =>
      r.title.toLowerCase().includes(q)
      || r.ingredients?.some(i => i.name.toLowerCase().includes(q))
    );
  });

  ngOnInit(): void {
    this.profileSvc.loadProfile().subscribe({ error: () => {} });
    this.profileSvc.loadMetabolic().subscribe({ error: () => {} });
    this.load();
    this.loadSummary();
    this.loadMyRecipes();
  }

  load(): void {
    this.loading.set(true);
    const date = this.selectedDate();
    let pending = 2;
    const done = () => { if (--pending === 0) this.loading.set(false); };

    this.mealSvc.list(date).subscribe({ next: m => { this.meals.set(m); done(); }, error: done });
    this.protocolSvc.logsForDate(date).subscribe({
      next: p => { this.protocols.set(p.filter(x => x.isActive)); done(); },
      error: done,
    });
  }

  private loadMyRecipes(): void {
    this.recipeSvc.listMine().subscribe({
      next: recipes => this.myRecipes.set(recipes),
      error: () => {},
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
    this.loadSummary();
  }

  private loadSummary(): void {
    this.foodSvc.getSummary(this.selectedDate()).subscribe({ next: s => this.summary.set(s), error: () => {} });
  }

  pct(consumed: number | undefined, target: number): number {
    if (!consumed || !target) return 0;
    return Math.min(100, (consumed / target) * 100);
  }

  absVal(n: number): number { return Math.abs(n); }

  itemKey(item: TimelineItem): string {
    return item.kind + '-' + item.data.id;
  }

  catIcon(category: string): string {
    return CATEGORY_ICON[category] ?? '💊';
  }

  linkedRecipeKcal(lr: LinkedRecipe): number {
    return lr.kcalPerServing * lr.servings;
  }

  // ── Recipe picker ────────────────────────────────────────────
  openRecipePicker(meal: ScheduledMeal): void {
    this.pickerMeal.set(meal);
    this.pickerSelected.set(null);
    this.pickerQuery = '';
    this.pickerServings = 1;
  }

  closeRecipePicker(): void {
    this.pickerMeal.set(null);
    this.pickerSelected.set(null);
  }

  selectPickerRecipe(r: Recipe): void {
    this.pickerSelected.set(r);
    this.pickerServings = 1;
  }

  confirmLinkRecipe(): void {
    const meal = this.pickerMeal();
    const recipe = this.pickerSelected();
    if (!meal || !recipe) return;

    this.linking.set(true);
    this.schedMealSvc.linkRecipe(meal.id, {
      recipeId: recipe.id,
      servings: this.pickerServings,
    }).subscribe({
      next: updatedMeal => {
        this.meals.update(list => list.map(m => m.id === updatedMeal.id ? updatedMeal : m));
        this.linking.set(false);
        this.closeRecipePicker();
      },
      error: () => this.linking.set(false),
    });
  }

  unlinkRecipe(meal: ScheduledMeal, recipeId: string): void {
    this.schedMealSvc.unlinkRecipe(meal.id, recipeId).subscribe({
      next: updatedMeal => {
        this.meals.update(list => list.map(m => m.id === updatedMeal.id ? updatedMeal : m));
      },
      error: () => {},
    });
  }

  // ── Timeline actions ─────────────────────────────────────────
  toggleMeal(meal: ScheduledMeal, event?: MouseEvent): void {
    this.checking.set(meal.id);
    this.mealSvc.toggle(meal.id).subscribe({
      next: result => {
        this.meals.update(list => list.map(m => m.id === meal.id ? result.meal : m));
        this.checking.set(null);
        this.loadSummary();
        if (result.xpGained > 0) this.showXpPop(result.xpGained, event);
      },
      error: () => this.checking.set(null),
    });
  }

  toggleProtocol(proto: ClinicalProtocolWithLog, event?: MouseEvent): void {
    this.checking.set('proto-' + proto.id);
    this.protocolSvc.toggle(proto.id, this.selectedDate()).subscribe({
      next: result => {
        this.protocolSvc.logsForDate(this.selectedDate()).subscribe({
          next: list => this.protocols.set(list.filter(x => x.isActive)),
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
