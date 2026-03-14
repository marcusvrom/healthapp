import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { RecipeService, CreateRecipeDto, IngredientDto } from '../../core/services/recipe.service';
import { RecipeFeedItem, Recipe, RecipeIngredient } from '../../core/models';

type Tab = 'feed' | 'mine';
type SortOption = 'rating' | 'likes' | 'recent';

const EMPTY_INGREDIENT = (): IngredientDto => ({ name: '', quantity: 0, unit: 'g' });

const EMPTY_FORM = (): CreateRecipeDto & { ingredients: IngredientDto[] } => ({
  title: '', instructions: '', kcal: 0,
  proteinG: 0, carbsG: 0, fatG: 0, servings: 1, isPublic: false,
  ingredients: [],
});

@Component({
  selector: 'app-recipe-community',
  standalone: true,
  imports: [FormsModule, DecimalPipe, DatePipe],
  styleUrls: ['./recipe-community.component.scss'],
  templateUrl: './recipe-community.component.html',
})
export class RecipeCommunityComponent implements OnInit {
  private svc = inject(RecipeService);

  readonly XP_IMPORT = 15;
  readonly unitOptions = [
    'g', 'kg', 'ml', 'L',
    'colher de sopa', 'colher de cha', 'colher de sobremesa',
    'xicara', 'unidade', 'fatia', 'pitada', 'a gosto',
  ];

  tab     = signal<Tab>('feed');
  loading = signal(false);
  saving  = signal(false);
  localQuery = '';
  searchQuery = signal('');
  searchFilter = signal<'all' | 'name' | 'ingredient' | 'description'>('all');
  sortOption: SortOption = 'rating';

  feed    = signal<RecipeFeedItem[]>([]);
  mine    = signal<Recipe[]>([]);

  // Form modal
  showForm  = signal(false);
  editingId = signal<string | null>(null);
  form: CreateRecipeDto & { ingredients: IngredientDto[] } = EMPTY_FORM();

  // Import modal
  importTarget = signal<Recipe | null>(null);

  // Detail modal
  detailTarget = signal<Recipe | null>(null);

  // Rating modal
  ratingTarget  = signal<RecipeFeedItem | null>(null);
  ratingVal     = signal(0);
  ratingComment = '';

  // XP pop
  xpPopVisible = signal(false);
  lastXp       = signal(0);
  xpPopX = 0; xpPopY = 0;

  readonly isResync = computed(() => {
    const t = this.importTarget();
    return t ? (t as RecipeFeedItem).hasUpdate === true : false;
  });

  readonly searchPlaceholder = computed(() => {
    const f = this.searchFilter();
    if (f === 'ingredient') return 'Buscar por ingrediente (ex: frango, batata doce)...';
    if (f === 'name') return 'Buscar por nome da receita...';
    if (f === 'description') return 'Buscar na descricao...';
    return 'Buscar por nome, ingrediente ou descricao...';
  });

  readonly importedCount = computed(() => this.mine().filter(r => r.forkedFromId).length);

  readonly filteredFeed = computed(() => this.feed());

  readonly filteredMine = computed(() => {
    const q = this.localQuery.toLowerCase().trim();
    if (!q) return this.mine();
    const filter = this.searchFilter();
    return this.mine().filter(r => {
      const matchName = r.title.toLowerCase().includes(q)
        || r.description?.toLowerCase().includes(q);
      const matchIng = r.ingredients?.some(i => i.name.toLowerCase().includes(q));
      if (filter === 'name') return r.title.toLowerCase().includes(q);
      if (filter === 'ingredient') return matchIng;
      if (filter === 'description') return r.description?.toLowerCase().includes(q);
      return matchName || matchIng;
    });
  });

  ngOnInit(): void {
    this.loadFeed();
    this.loadMine();
  }

  loadFeed(): void {
    this.loading.set(true);
    const search = this.searchQuery()?.trim() || undefined;
    this.svc.feed(1, 20, search).subscribe({
      next: items => { this.feed.set(items); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private loadMine(): void {
    this.svc.listMine().subscribe({
      next: items => this.mine.set(items),
      error: () => {},
    });
  }

  setTab(t: Tab): void { this.tab.set(t); }

  onSearchChange(val: string): void { this.searchQuery.set(val); }

  setSearchFilter(f: 'all' | 'name' | 'ingredient' | 'description'): void {
    this.searchFilter.set(f);
    if (this.tab() === 'feed' && this.searchQuery()) {
      this.doSearch();
    }
  }

  doSearch(): void { this.loadFeed(); }

  clearSearch(): void { this.searchQuery.set(''); this.loadFeed(); }

  // ── Ingredients ─────────────────────────────────────────────
  addIngredient(): void {
    this.form.ingredients = [...this.form.ingredients, EMPTY_INGREDIENT()];
  }

  removeIngredient(index: number): void {
    this.form.ingredients = this.form.ingredients.filter((_, i) => i !== index);
  }

  ingredientsSummary(ingredients: (RecipeIngredient | IngredientDto)[]): string {
    return ingredients
      .slice(0, 5)
      .map(i => `${i.quantity} ${i.unit} ${i.name}`)
      .join(', ')
      + (ingredients.length > 5 ? ` (+${ingredients.length - 5})` : '');
  }

  // ── Form (create / edit) ───────────────────────────────────────
  openCreateModal(): void {
    this.editingId.set(null);
    this.form = EMPTY_FORM();
    this.showForm.set(true);
  }

  openEdit(r: Recipe): void {
    this.editingId.set(r.id);
    this.form = {
      title: r.title, description: r.description, instructions: r.instructions,
      kcal: r.kcal, proteinG: r.proteinG, carbsG: r.carbsG, fatG: r.fatG,
      servings: r.servings, prepTimeMin: r.prepTimeMin, isPublic: r.isPublic,
      ingredients: (r.ingredients ?? []).map(i => ({
        name: i.name, quantity: Number(i.quantity), unit: i.unit, sortOrder: i.sortOrder,
      })),
    };
    this.showForm.set(true);
  }

  saveRecipe(): void {
    if (!this.form.title?.trim() || !this.form.instructions?.trim()) return;
    this.saving.set(true);
    const id = this.editingId();

    // Assign sort orders and filter out empty names
    this.form.ingredients = this.form.ingredients
      .filter(i => i.name?.trim())
      .map((i, idx) => ({ ...i, sortOrder: idx }));

    const obs = id ? this.svc.update(id, this.form) : this.svc.create(this.form);
    obs.subscribe({
      next: saved => {
        if (id) {
          this.mine.update(list => list.map(r => r.id === id ? saved : r));
        } else {
          this.mine.update(list => [saved, ...list]);
        }
        if (saved.isPublic) this.loadFeed();
        this.saving.set(false);
        this.closeModals();
      },
      error: () => this.saving.set(false),
    });
  }

  remove(r: Recipe): void {
    if (!confirm(`Remover "${r.title}"?`)) return;
    this.svc.remove(r.id).subscribe({
      next: () => {
        this.mine.update(list => list.filter(x => x.id !== r.id));
        this.feed.update(list => list.filter(x => x.id !== r.id));
      },
      error: () => {},
    });
  }

  // ── Import (fork to My Recipes) ─────────────────────────────
  openImport(r: Recipe): void {
    this.importTarget.set(r);
  }

  confirmImport(event?: MouseEvent): void {
    const r = this.importTarget();
    if (!r) return;
    this.saving.set(true);
    this.svc.importRecipe(r.id).subscribe({
      next: result => {
        this.mine.update(list => {
          const existing = list.findIndex(x => x.id === result.recipe.id);
          if (existing >= 0) {
            return list.map((x, i) => i === existing ? result.recipe : x);
          }
          return [result.recipe, ...list];
        });
        this.saving.set(false);
        this.closeModals();
        this.showXpPop(result.xpGained, event);
        this.loadFeed();
      },
      error: () => this.saving.set(false),
    });
  }

  // ── Detail ─────────────────────────────────────────────────────
  openDetail(r: Recipe): void { this.detailTarget.set(r); }

  // ── Rating ─────────────────────────────────────────────────────
  openRating(r: RecipeFeedItem): void {
    this.ratingTarget.set(r);
    this.ratingVal.set(r.myReview?.rating ?? 0);
    this.ratingComment = r.myReview?.comment ?? '';
  }

  submitRating(event?: MouseEvent): void {
    const r = this.ratingTarget();
    if (!r) return;
    this.saving.set(true);
    this.svc.review(r.id, { rating: this.ratingVal(), comment: this.ratingComment }).subscribe({
      next: result => {
        this.feed.update(list => list.map(item =>
          item.id === r.id
            ? { ...item, myReview: result.review, avgRating: this.recalcAvg(item, result.review) }
            : item
        ));
        this.saving.set(false);
        this.closeModals();
        if (result.xpGained > 0) this.showXpPop(result.xpGained, event);
      },
      error: () => this.saving.set(false),
    });
  }

  // ── Like ───────────────────────────────────────────────────────
  toggleLike(r: RecipeFeedItem): void {
    this.svc.toggleLike(r.id).subscribe({
      next: result => {
        this.feed.update(list => list.map(item =>
          item.id === r.id
            ? { ...item, likeCount: result.likeCount, myReview: { ...item.myReview, isLiked: result.isLiked } as any }
            : item
        ));
      },
      error: () => {},
    });
  }

  // ── Helpers ────────────────────────────────────────────────────
  closeModals(): void {
    this.showForm.set(false);
    this.importTarget.set(null);
    this.detailTarget.set(null);
    this.ratingTarget.set(null);
    this.saving.set(false);
  }

  stars(avg: number): string {
    const full  = Math.floor(avg);
    const half  = avg - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return '\u2605'.repeat(full) + (half ? '\u00BD' : '') + '\u2606'.repeat(empty);
  }

  private recalcAvg(item: RecipeFeedItem, review: any): number {
    return item.avgRating;
  }

  private showXpPop(xp: number, event?: MouseEvent): void {
    this.lastXp.set(xp);
    this.xpPopX = event?.clientX ?? window.innerWidth / 2;
    this.xpPopY = event?.clientY ?? window.innerHeight / 2;
    this.xpPopVisible.set(true);
    setTimeout(() => this.xpPopVisible.set(false), 900);
  }
}
