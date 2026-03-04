import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { RecipeService, CreateRecipeDto } from '../../core/services/recipe.service';
import { RecipeFeedItem, Recipe } from '../../core/models';

type Tab = 'feed' | 'mine';

const EMPTY_FORM = (): CreateRecipeDto => ({
  title: '', instructions: '', kcal: 0,
  protein_g: 0, carbs_g: 0, fat_g: 0, servings: 1, isPublic: false,
});

@Component({
  selector: 'app-recipe-community',
  standalone: true,
  imports: [FormsModule, DecimalPipe, DatePipe],
  styles: [`
    .page { padding: 1.5rem; max-width: 1100px; margin: 0 auto; }

    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;
      h2 { font-size: 1.5rem; margin-bottom: .2rem; }
      p  { color: var(--color-text-muted); font-size: .875rem; }
    }

    /* Tabs */
    .tabs { display: flex; gap: .5rem; margin-bottom: 1.25rem; border-bottom: 2px solid var(--color-border); }
    .tab-btn {
      padding: .625rem 1.25rem; background: none; border: none; border-bottom: 2px solid transparent;
      font-size: .9rem; font-weight: 600; color: var(--color-text-muted);
      cursor: pointer; margin-bottom: -2px; transition: .15s;
      &.active { border-bottom-color: var(--color-primary); color: var(--color-primary); }
      &:hover:not(.active) { color: var(--color-text); }
    }

    /* Controls bar */
    .controls { display: flex; gap: .75rem; align-items: center; flex-wrap: wrap; margin-bottom: 1.25rem;
      .search-wrap { flex: 1; min-width: 180px; position: relative;
        .si { position: absolute; left: .75rem; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--color-text-subtle); }
        input { width: 100%; padding: .575rem .875rem .575rem 2.25rem; border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text);
          font-size: .875rem; outline: none;
          &:focus { border-color: var(--color-primary); }
          &::placeholder { color: var(--color-text-subtle); }
        }
      }
    }

    /* Feed grid */
    .feed { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.25rem; }

    .recipe-card {
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); padding: 1.25rem;
      display: flex; flex-direction: column; gap: .75rem;
      transition: box-shadow .2s, transform .2s;
      &:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }

      .r-header { display: flex; justify-content: space-between; align-items: flex-start; gap: .5rem;
        .r-title { font-size: 1rem; font-weight: 700; line-height: 1.3; flex: 1;
          overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .pub-badge { font-size: .65rem; font-weight: 700; padding: .15rem .5rem; border-radius: 99px;
          background: var(--color-primary-light); color: var(--color-primary-dark); white-space: nowrap; flex-shrink: 0; }
      }

      .macro-row { display: flex; gap: .5rem; flex-wrap: wrap;
        .mp { font-size: .72rem; font-weight: 600; padding: .15rem .5rem; border-radius: 99px;
          &.kcal { background: #fef3c7; color: #92400e; }
          &.prot { background: #dbeafe; color: #1e40af; }
          &.carb { background: #fce7f3; color: #9d174d; }
          &.fat  { background: #ede9fe; color: #5b21b6; }
          &.serv { background: var(--color-surface-2); color: var(--color-text-muted); }
        }
      }

      .r-desc { font-size: .8rem; color: var(--color-text-muted); line-height: 1.5;
        overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

      .rating-row { display: flex; align-items: center; gap: .625rem;
        .stars { color: #f59e0b; font-size: .9rem; letter-spacing: .1rem; }
        .r-count { font-size: .75rem; color: var(--color-text-subtle); }
        .like-count { font-size: .75rem; color: var(--color-text-subtle); margin-left: auto; }
      }

      .card-actions { display: flex; gap: .5rem; flex-wrap: wrap; margin-top: auto;
        button { flex: 1; min-width: 80px; }
      }
    }

    /* Modal overlay */
    .modal-overlay {
      position: fixed; inset: 0; z-index: 500;
      background: rgba(0,0,0,.45); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center; padding: 1rem;
    }
    .modal {
      background: var(--color-surface); border-radius: var(--radius-lg); padding: 1.75rem;
      width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto;
      box-shadow: var(--shadow-lg); animation: scaleIn .2s ease;

      h3 { font-size: 1.1rem; margin-bottom: 1.25rem; }

      .modal-footer { display: flex; justify-content: flex-end; gap: .75rem; margin-top: 1.5rem; }
    }

    /* Form fields within modal */
    .field { margin-bottom: 1rem;
      label { font-size: .82rem; font-weight: 600; color: var(--color-text-muted);
        display: block; margin-bottom: .3rem; }
      input, textarea, select {
        width: 100%; padding: .575rem .875rem; border: 1.5px solid var(--color-border);
        border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text);
        font-size: .875rem; font-family: inherit; outline: none; transition: border-color .15s;
        &:focus { border-color: var(--color-primary); }
      }
      textarea { resize: vertical; min-height: 80px; }
    }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: .875rem; }
    .field-row-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: .75rem; }

    .toggle-wrap { display: flex; align-items: center; gap: .75rem; font-size: .875rem;
      input[type=checkbox] { width: 16px; height: 16px; cursor: pointer; accent-color: var(--color-primary); }
    }

    /* Star rating picker */
    .star-picker { display: flex; gap: .25rem;
      button { background: none; border: none; cursor: pointer; font-size: 1.5rem;
        transition: transform .1s;
        &:hover { transform: scale(1.2); }
      }
    }

    /* Import time field */
    .import-hint { font-size: .8rem; color: var(--color-text-muted); margin-top: .375rem; }

    .empty-state { text-align: center; padding: 4rem 1rem; color: var(--color-text-muted);
      .emoji { font-size: 3rem; display: block; margin-bottom: .75rem; }
      p { font-size: .9rem; }
    }

    @keyframes xpPop {
      0%   { opacity:1; transform: scale(1) translateY(0); }
      60%  { opacity:1; transform: scale(1.4) translateY(-20px); }
      100% { opacity:0; transform: scale(1) translateY(-40px); }
    }
    .xp-pop { position:fixed; z-index:999; pointer-events:none;
      font-size:1.25rem; font-weight:800; color:#6366f1;
      animation: xpPop .9s ease forwards; }
  `],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h2>📖 Receitas</h2>
          <p>Explore, avalie e importe receitas da comunidade para sua dieta.</p>
        </div>
        <button class="btn btn-primary" (click)="openCreateModal()">+ Nova Receita</button>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab-btn" [class.active]="tab() === 'feed'"  (click)="setTab('feed')">🌐 Comunidade ({{ feed().length }})</button>
        <button class="tab-btn" [class.active]="tab() === 'mine'"  (click)="setTab('mine')">👤 Minhas Receitas ({{ mine().length }})</button>
      </div>

      <!-- Controls -->
      <div class="controls">
        <div class="search-wrap">
          <span class="si">🔍</span>
          <input type="text" placeholder="Buscar receita..." [(ngModel)]="query" />
        </div>
        @if (tab() === 'feed') {
          <button class="btn btn-secondary btn-sm" (click)="loadFeed()">🔄 Atualizar</button>
        }
      </div>

      <!-- Loading -->
      @if (loading()) {
        <div style="text-align:center;padding:3rem;color:var(--color-text-muted)">
          <div class="spinner" style="margin:0 auto 1rem"></div> Carregando receitas...
        </div>
      } @else {

        <!-- Feed tab -->
        @if (tab() === 'feed') {
          @if (filteredFeed().length > 0) {
            <div class="feed stagger">
              @for (r of filteredFeed(); track r.id) {
                <div class="recipe-card animate-fade">
                  <div class="r-header">
                    <span class="r-title">{{ r.title }}</span>
                    @if (r.isPublic) { <span class="pub-badge">🌐 Público</span> }
                  </div>

                  <div class="macro-row">
                    <span class="mp kcal">🔥 {{ r.kcal | number:'1.0-0' }} kcal</span>
                    <span class="mp prot">💪 {{ r.protein_g | number:'1.0-0' }}g prot</span>
                    <span class="mp carb">🌾 {{ r.carbs_g | number:'1.0-0' }}g carb</span>
                    <span class="mp fat">🥑 {{ r.fat_g | number:'1.0-0' }}g gord</span>
                    @if (r.servings > 1) { <span class="mp serv">×{{ r.servings }} porções</span> }
                  </div>

                  @if (r.description) {
                    <p class="r-desc">{{ r.description }}</p>
                  }

                  <div class="rating-row">
                    <span class="stars">{{ stars(r.avgRating) }}</span>
                    <span class="r-count">{{ r.avgRating | number:'1.1-1' }} ({{ r.reviewCount }})</span>
                    <span class="like-count">❤️ {{ r.likeCount }}</span>
                    @if (r.myReview?.isLiked) { <span style="font-size:.7rem;color:#ef4444">Curtido</span> }
                  </div>

                  <div class="card-actions">
                    <button class="btn btn-secondary btn-sm" (click)="openImport(r)">📥 Importar</button>
                    <button class="btn btn-ghost btn-sm"
                      [style.color]="r.myReview?.isLiked ? '#ef4444' : ''"
                      (click)="toggleLike(r)">
                      {{ r.myReview?.isLiked ? '❤️' : '🤍' }}
                    </button>
                    <button class="btn btn-ghost btn-sm" (click)="openRating(r)">⭐ Avaliar</button>
                    <button class="btn btn-ghost btn-sm" (click)="openDetail(r)">📄 Ver</button>
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="empty-state">
              <span class="emoji">🌐</span>
              <p>Nenhuma receita pública encontrada.<br>Seja o primeiro a compartilhar!</p>
            </div>
          }
        }

        <!-- Mine tab -->
        @if (tab() === 'mine') {
          @if (filteredMine().length > 0) {
            <div class="feed stagger">
              @for (r of filteredMine(); track r.id) {
                <div class="recipe-card animate-fade">
                  <div class="r-header">
                    <span class="r-title">{{ r.title }}</span>
                    <span class="pub-badge" [style.background]="r.isPublic ? '' : '#f3f4f6'"
                      [style.color]="r.isPublic ? '' : '#6b7280'">
                      {{ r.isPublic ? '🌐 Público' : '🔒 Privado' }}
                    </span>
                  </div>

                  <div class="macro-row">
                    <span class="mp kcal">🔥 {{ r.kcal | number:'1.0-0' }} kcal</span>
                    <span class="mp prot">💪 {{ r.protein_g | number:'1.0-0' }}g</span>
                    <span class="mp carb">🌾 {{ r.carbs_g | number:'1.0-0' }}g</span>
                    <span class="mp fat">🥑 {{ r.fat_g | number:'1.0-0' }}g</span>
                  </div>

                  @if (r.description) { <p class="r-desc">{{ r.description }}</p> }

                  <div class="card-actions">
                    <button class="btn btn-secondary btn-sm" (click)="openImport(r)">📥 Importar</button>
                    <button class="btn btn-ghost btn-sm" (click)="openEdit(r)">✏️ Editar</button>
                    <button class="btn btn-ghost btn-sm" style="color:var(--color-danger)" (click)="remove(r)">🗑️</button>
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="empty-state">
              <span class="emoji">📝</span>
              <p>Você ainda não criou nenhuma receita.<br>
                Clique em <strong>+ Nova Receita</strong> para começar.</p>
            </div>
          }
        }
      }
    </div>

    <!-- ── Create / Edit Modal ─────────────────────────────────── -->
    @if (showForm()) {
      <div class="modal-overlay" (click)="closeModals()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>{{ editingId() ? '✏️ Editar Receita' : '📝 Nova Receita' }}</h3>

          <div class="field">
            <label>Título *</label>
            <input type="text" [(ngModel)]="form.title" placeholder="Ex: Omelete de Frango" />
          </div>
          <div class="field">
            <label>Descrição (opcional)</label>
            <input type="text" [(ngModel)]="form.description" placeholder="Breve descrição..." />
          </div>
          <div class="field">
            <label>Modo de preparo *</label>
            <textarea [(ngModel)]="form.instructions" placeholder="Descreva os ingredientes e o preparo..."></textarea>
          </div>

          <div class="field-row-4">
            <div class="field">
              <label>Calorias (kcal) *</label>
              <input type="number" [(ngModel)]="form.kcal" min="0" />
            </div>
            <div class="field">
              <label>Proteína (g)</label>
              <input type="number" [(ngModel)]="form.protein_g" min="0" />
            </div>
            <div class="field">
              <label>Carbs (g)</label>
              <input type="number" [(ngModel)]="form.carbs_g" min="0" />
            </div>
            <div class="field">
              <label>Gordura (g)</label>
              <input type="number" [(ngModel)]="form.fat_g" min="0" />
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label>Porções</label>
              <input type="number" [(ngModel)]="form.servings" min="1" />
            </div>
            <div class="field">
              <label>Tempo de preparo (min)</label>
              <input type="number" [(ngModel)]="form.prepTimeMin" min="1" />
            </div>
          </div>

          <div class="toggle-wrap" style="margin-bottom:1rem">
            <input type="checkbox" id="pub-toggle" [(ngModel)]="form.isPublic" />
            <label for="pub-toggle" style="font-size:.875rem;color:var(--color-text);cursor:pointer">
              🌐 Publicar no feed da comunidade
            </label>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModals()">Cancelar</button>
            <button class="btn btn-primary" (click)="saveRecipe()" [disabled]="saving()">
              {{ saving() ? '⏳ Salvando...' : editingId() ? '💾 Atualizar' : '✨ Criar Receita' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── Import Modal ─────────────────────────────────────────── -->
    @if (importTarget()) {
      <div class="modal-overlay" (click)="closeModals()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>📥 Importar para Dieta</h3>
          <p style="font-size:.875rem;color:var(--color-text-muted);margin-bottom:1.25rem">
            A receita <strong>{{ importTarget()!.title }}</strong> será copiada como refeição agendada.
          </p>

          <div class="field-row">
            <div class="field">
              <label>Data</label>
              <input type="date" [(ngModel)]="importDate" />
            </div>
            <div class="field">
              <label>Horário *</label>
              <input type="time" [(ngModel)]="importTime" />
            </div>
          </div>
          <p class="import-hint">+{{ XP_IMPORT }} XP ao importar!</p>

          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModals()">Cancelar</button>
            <button class="btn btn-primary" (click)="confirmImport()" [disabled]="!importTime || saving()">
              {{ saving() ? '⏳...' : '📥 Importar' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── Detail Modal ─────────────────────────────────────────── -->
    @if (detailTarget()) {
      <div class="modal-overlay" (click)="closeModals()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>📄 {{ detailTarget()!.title }}</h3>

          <div style="margin-bottom:1rem">
            <div class="macro-row" style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.75rem">
              <span class="mp kcal" style="font-size:.78rem;font-weight:600;padding:.2rem .6rem;border-radius:99px;background:#fef3c7;color:#92400e">
                🔥 {{ detailTarget()!.kcal | number:'1.0-0' }} kcal
              </span>
              <span style="font-size:.78rem;font-weight:600;padding:.2rem .6rem;border-radius:99px;background:#dbeafe;color:#1e40af">
                💪 {{ detailTarget()!.protein_g | number:'1.0-0' }}g prot
              </span>
              <span style="font-size:.78rem;font-weight:600;padding:.2rem .6rem;border-radius:99px;background:#fce7f3;color:#9d174d">
                🌾 {{ detailTarget()!.carbs_g | number:'1.0-0' }}g carb
              </span>
              <span style="font-size:.78rem;font-weight:600;padding:.2rem .6rem;border-radius:99px;background:#ede9fe;color:#5b21b6">
                🥑 {{ detailTarget()!.fat_g | number:'1.0-0' }}g gord
              </span>
            </div>
            @if (detailTarget()!.description) {
              <p style="font-size:.875rem;color:var(--color-text-muted);margin-bottom:.75rem">
                {{ detailTarget()!.description }}
              </p>
            }
            @if (detailTarget()!.prepTimeMin) {
              <p style="font-size:.82rem;color:var(--color-text-muted);margin-bottom:.75rem">
                ⏱️ Tempo de preparo: {{ detailTarget()!.prepTimeMin }} min
              </p>
            }
          </div>

          <div style="background:var(--color-surface-2);border-radius:var(--radius-sm);padding:1rem">
            <div style="font-size:.78rem;font-weight:700;color:var(--color-text-subtle);text-transform:uppercase;margin-bottom:.5rem">
              Modo de Preparo
            </div>
            <div style="font-size:.875rem;color:var(--color-text);white-space:pre-wrap;line-height:1.65">{{ detailTarget()!.instructions }}</div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModals()">Fechar</button>
            <button class="btn btn-primary" (click)="openImport(detailTarget()!); detailTarget.set(null)">📥 Importar</button>
          </div>
        </div>
      </div>
    }

    <!-- ── Rating Modal ─────────────────────────────────────────── -->
    @if (ratingTarget()) {
      <div class="modal-overlay" (click)="closeModals()">
        <div class="modal" (click)="$event.stopPropagation()" style="max-width:400px">
          <h3>⭐ Avaliar: {{ ratingTarget()!.title }}</h3>

          <div class="field">
            <label>Sua nota</label>
            <div class="star-picker">
              @for (s of [1,2,3,4,5]; track s) {
                <button (click)="ratingVal.set(s)" [style.filter]="s <= ratingVal() ? '' : 'grayscale(1)'">⭐</button>
              }
            </div>
            <div style="font-size:.8rem;color:var(--color-text-muted);margin-top:.375rem">
              {{ ratingVal() > 0 ? ratingVal() + '/5' : 'Sem nota' }}
            </div>
          </div>

          <div class="field">
            <label>Comentário (opcional)</label>
            <textarea [(ngModel)]="ratingComment" placeholder="Deixe uma mensagem..."></textarea>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModals()">Cancelar</button>
            <button class="btn btn-primary" (click)="submitRating()" [disabled]="saving()">
              {{ saving() ? '⏳...' : '✓ Enviar Avaliação' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (xpPopVisible()) {
      <div class="xp-pop" [style.left]="xpPopX + 'px'" [style.top]="xpPopY + 'px'">
        +{{ lastXp() }} XP ⚡
      </div>
    }
  `,
})
export class RecipeCommunityComponent implements OnInit {
  private svc = inject(RecipeService);

  readonly XP_IMPORT = 15;

  tab     = signal<Tab>('feed');
  loading = signal(false);
  saving  = signal(false);
  query   = '';

  feed    = signal<RecipeFeedItem[]>([]);
  mine    = signal<Recipe[]>([]);

  // Form modal
  showForm  = signal(false);
  editingId = signal<string | null>(null);
  form: CreateRecipeDto = EMPTY_FORM();

  // Import modal
  importTarget = signal<Recipe | null>(null);
  importDate   = new Date().toISOString().slice(0, 10);
  importTime   = '12:00';

  // Detail modal
  detailTarget = signal<RecipeFeedItem | null>(null);

  // Rating modal
  ratingTarget  = signal<RecipeFeedItem | null>(null);
  ratingVal     = signal(0);
  ratingComment = '';

  // XP pop
  xpPopVisible = signal(false);
  lastXp       = signal(0);
  xpPopX = 0; xpPopY = 0;

  readonly filteredFeed = computed(() => {
    const q = this.query.toLowerCase();
    return q
      ? this.feed().filter(r => r.title.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q))
      : this.feed();
  });

  readonly filteredMine = computed(() => {
    const q = this.query.toLowerCase();
    return q ? this.mine().filter(r => r.title.toLowerCase().includes(q)) : this.mine();
  });

  ngOnInit(): void {
    this.loadFeed();
    this.loadMine();
  }

  loadFeed(): void {
    this.loading.set(true);
    this.svc.feed().subscribe({
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
      kcal: r.kcal, protein_g: r.protein_g, carbs_g: r.carbs_g, fat_g: r.fat_g,
      servings: r.servings, prepTimeMin: r.prepTimeMin, isPublic: r.isPublic,
    };
    this.showForm.set(true);
  }

  saveRecipe(): void {
    if (!this.form.title?.trim() || !this.form.instructions?.trim()) return;
    this.saving.set(true);
    const id = this.editingId();
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

  // ── Import ─────────────────────────────────────────────────────
  openImport(r: Recipe): void {
    this.importTarget.set(r);
    this.importDate = new Date().toISOString().slice(0, 10);
    this.importTime = '12:00';
  }

  confirmImport(event?: MouseEvent): void {
    const r = this.importTarget();
    if (!r || !this.importTime) return;
    this.saving.set(true);
    this.svc.importRecipe(r.id, { scheduledDate: this.importDate, scheduledTime: this.importTime }).subscribe({
      next: result => {
        this.saving.set(false);
        this.closeModals();
        this.showXpPop(result.xpGained, event);
      },
      error: () => this.saving.set(false),
    });
  }

  // ── Detail ─────────────────────────────────────────────────────
  openDetail(r: RecipeFeedItem): void { this.detailTarget.set(r); }

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
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
  }

  private recalcAvg(item: RecipeFeedItem, review: any): number {
    // Optimistic client-side approximation — actual value comes from next feed refresh
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
