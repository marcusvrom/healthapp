import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { RecipeService, CreateRecipeDto, IngredientDto } from '../../core/services/recipe.service';
import { RecipeFeedItem, Recipe, RecipeIngredient } from '../../core/models';

type Tab = 'feed' | 'mine';

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

    .search-hint { font-size: .72rem; color: var(--color-text-subtle); margin-top: .25rem; margin-bottom: .75rem; }

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

      .ingredients-preview { font-size: .75rem; color: var(--color-text-subtle); line-height: 1.4;
        overflow: hidden; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }

      .rating-row { display: flex; align-items: center; gap: .625rem;
        .stars { color: #f59e0b; font-size: .9rem; letter-spacing: .1rem; }
        .r-count { font-size: .75rem; color: var(--color-text-subtle); }
        .like-count { font-size: .75rem; color: var(--color-text-subtle); margin-left: auto; }
      }

      .card-actions { display: flex; gap: .5rem; flex-wrap: wrap; margin-top: auto;
        button { flex: 1; min-width: 80px; }
      }

      .fork-badge { font-size: .65rem; font-weight: 700; padding: .15rem .5rem; border-radius: 99px;
        background: #e0f2fe; color: #0369a1; white-space: nowrap; flex-shrink: 0; }

      .update-badge { font-size: .65rem; font-weight: 700; padding: .15rem .5rem; border-radius: 99px;
        background: #fef3c7; color: #92400e; white-space: nowrap; flex-shrink: 0;
        animation: pulse 2s infinite; }
    }

    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .6; } }

    /* Modal overlay */
    .modal-overlay {
      position: fixed; inset: 0; z-index: 500;
      background: rgba(0,0,0,.45); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center; padding: 1rem;
    }
    .modal {
      background: var(--color-surface); border-radius: var(--radius-lg); padding: 1.75rem;
      width: 100%; max-width: 620px; max-height: 90vh; overflow-y: auto;
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

    /* ── Ingredient list ──────────────────────────────────── */
    .ingredients-section {
      margin-bottom: 1rem; padding: 1rem; border-radius: var(--radius-sm);
      background: var(--color-surface-2); border: 1px solid var(--color-border);

      .ing-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: .75rem;
        .ing-title { font-size: .82rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; }
      }

      .ing-row { display: grid; grid-template-columns: 1fr 80px 140px 36px; gap: .5rem; align-items: end; margin-bottom: .5rem;
        input, select {
          width: 100%; padding: .45rem .6rem; border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text);
          font-size: .82rem; font-family: inherit; outline: none;
          &:focus { border-color: var(--color-primary); }
        }
        .rm-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
          border: none; background: none; color: var(--color-danger); cursor: pointer;
          font-size: 1rem; border-radius: 50%; transition: .15s;
          &:hover { background: rgba(239,68,68,.1); }
        }
      }

      .ing-labels { display: grid; grid-template-columns: 1fr 80px 140px 36px; gap: .5rem; margin-bottom: .25rem;
        span { font-size: .72rem; font-weight: 600; color: var(--color-text-subtle); }
      }

      .add-ing-btn { font-size: .82rem; color: var(--color-primary); background: none; border: none;
        cursor: pointer; font-weight: 600; padding: .3rem 0; margin-top: .25rem;
        &:hover { text-decoration: underline; }
      }
    }

    /* Star rating picker */
    .star-picker { display: flex; gap: .25rem;
      button { background: none; border: none; cursor: pointer; font-size: 1.5rem;
        transition: transform .1s;
        &:hover { transform: scale(1.2); }
      }
    }

    /* Import confirmation */
    .import-info { font-size: .8rem; color: var(--color-text-muted); margin-top: .375rem; }
    .import-card { background: var(--color-surface-2); border-radius: var(--radius-sm); padding: 1rem; margin-bottom: 1rem;
      .ic-title { font-weight: 700; font-size: .95rem; margin-bottom: .5rem; }
    }

    .empty-state { text-align: center; padding: 4rem 1rem; color: var(--color-text-muted);
      .emoji { font-size: 3rem; display: block; margin-bottom: .75rem; }
      p { font-size: .9rem; }
    }

    /* Detail ingredient list */
    .detail-ingredients { margin-top: .75rem;
      .di-title { font-size: .78rem; font-weight: 700; color: var(--color-text-subtle); text-transform: uppercase; margin-bottom: .5rem; }
      .di-item { font-size: .82rem; color: var(--color-text); padding: .25rem 0; border-bottom: 1px solid var(--color-border);
        display: flex; gap: .5rem;
        .di-qty { font-weight: 600; min-width: 80px; }
        &:last-child { border-bottom: none; }
      }
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
          <h2>Receitas</h2>
          <p>Explore, avalie e importe receitas da comunidade para suas receitas.</p>
        </div>
        <button class="btn btn-primary" (click)="openCreateModal()">+ Nova Receita</button>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab-btn" [class.active]="tab() === 'feed'"  (click)="setTab('feed')">Comunidade ({{ feed().length }})</button>
        <button class="tab-btn" [class.active]="tab() === 'mine'"  (click)="setTab('mine')">Minhas Receitas ({{ mine().length }})</button>
      </div>

      <!-- Controls -->
      <div class="controls">
        <div class="search-wrap">
          <span class="si">&#128269;</span>
          @if (tab() === 'feed') {
            <input type="text" placeholder="Buscar por nome ou ingrediente..."
              [ngModel]="searchQuery()" (ngModelChange)="onSearchChange($event)"
              (keydown.enter)="doSearch()" />
          } @else {
            <input type="text" placeholder="Buscar receita ou ingrediente..." [(ngModel)]="localQuery" />
          }
        </div>
        @if (tab() === 'feed') {
          <button class="btn btn-secondary btn-sm" (click)="doSearch()">Buscar</button>
          @if (searchQuery()) {
            <button class="btn btn-ghost btn-sm" (click)="clearSearch()">Limpar</button>
          }
        }
      </div>
      @if (tab() === 'feed') {
        <div class="search-hint">Pesquise por nome da receita, descricao ou ingredientes (ex: "frango", "batata doce")</div>
      }

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
                    @if (r.isPublic) { <span class="pub-badge">Publico</span> }
                    @if (r.hasUpdate) { <span class="update-badge">Nova versao disponivel</span> }
                  </div>

                  <div class="macro-row">
                    <span class="mp kcal">{{ r.kcal | number:'1.0-0' }} kcal</span>
                    <span class="mp prot">{{ r.proteinG | number:'1.0-0' }}g prot</span>
                    <span class="mp carb">{{ r.carbsG | number:'1.0-0' }}g carb</span>
                    <span class="mp fat">{{ r.fatG | number:'1.0-0' }}g gord</span>
                    @if (r.servings > 1) { <span class="mp serv">x{{ r.servings }} porcoes</span> }
                  </div>

                  @if (r.ingredients?.length) {
                    <p class="ingredients-preview">
                      Ingredientes: {{ ingredientsSummary(r.ingredients) }}
                    </p>
                  }

                  @if (r.description) {
                    <p class="r-desc">{{ r.description }}</p>
                  }

                  <div class="rating-row">
                    <span class="stars">{{ stars(r.avgRating) }}</span>
                    <span class="r-count">{{ r.avgRating | number:'1.1-1' }} ({{ r.reviewCount }})</span>
                    <span class="like-count">{{ r.likeCount }} curtida(s)</span>
                    @if (r.myReview?.isLiked) { <span style="font-size:.7rem;color:#ef4444">Curtido</span> }
                  </div>

                  <div class="card-actions">
                    <button class="btn btn-secondary btn-sm" (click)="openImport(r)">
                      {{ r.hasUpdate ? 'Atualizar copia' : 'Importar' }}
                    </button>
                    <button class="btn btn-ghost btn-sm"
                      [style.color]="r.myReview?.isLiked ? '#ef4444' : ''"
                      (click)="toggleLike(r)">
                      {{ r.myReview?.isLiked ? '&#10084;' : '&#9825;' }}
                    </button>
                    <button class="btn btn-ghost btn-sm" (click)="openRating(r)">Avaliar</button>
                    <button class="btn btn-ghost btn-sm" (click)="openDetail(r)">Ver</button>
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="empty-state">
              <span class="emoji">&#127760;</span>
              <p>Nenhuma receita encontrada.<br>Tente uma busca diferente ou seja o primeiro a compartilhar!</p>
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
                    @if (r.forkedFromId) {
                      <span class="fork-badge">Importada</span>
                    }
                    <span class="pub-badge" [style.background]="r.isPublic ? '' : '#f3f4f6'"
                      [style.color]="r.isPublic ? '' : '#6b7280'">
                      {{ r.isPublic ? 'Publico' : 'Privado' }}
                    </span>
                  </div>

                  <div class="macro-row">
                    <span class="mp kcal">{{ r.kcal | number:'1.0-0' }} kcal</span>
                    <span class="mp prot">{{ r.proteinG | number:'1.0-0' }}g</span>
                    <span class="mp carb">{{ r.carbsG | number:'1.0-0' }}g</span>
                    <span class="mp fat">{{ r.fatG | number:'1.0-0' }}g</span>
                  </div>

                  @if (r.ingredients?.length) {
                    <p class="ingredients-preview">
                      Ingredientes: {{ ingredientsSummary(r.ingredients) }}
                    </p>
                  }

                  @if (r.description) { <p class="r-desc">{{ r.description }}</p> }

                  <div class="card-actions">
                    <button class="btn btn-ghost btn-sm" (click)="openDetail(r)">Ver</button>
                    <button class="btn btn-ghost btn-sm" (click)="openEdit(r)">Editar</button>
                    <button class="btn btn-ghost btn-sm" style="color:var(--color-danger)" (click)="remove(r)">Remover</button>
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="empty-state">
              <span class="emoji">&#128221;</span>
              <p>Voce ainda nao criou nenhuma receita.<br>
                Clique em <strong>+ Nova Receita</strong> para comecar ou importe da comunidade.</p>
            </div>
          }
        }
      }
    </div>

    <!-- ── Create / Edit Modal ─────────────────────────────────── -->
    @if (showForm()) {
      <div class="modal-overlay" (click)="closeModals()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>{{ editingId() ? 'Editar Receita' : 'Nova Receita' }}</h3>

          <div class="field">
            <label>Titulo *</label>
            <input type="text" [(ngModel)]="form.title" placeholder="Ex: Omelete de Frango" />
          </div>
          <div class="field">
            <label>Descricao (opcional)</label>
            <input type="text" [(ngModel)]="form.description" placeholder="Breve descricao..." />
          </div>
          <div class="field">
            <label>Modo de preparo *</label>
            <textarea [(ngModel)]="form.instructions" placeholder="Descreva o modo de preparo..."></textarea>
          </div>

          <div class="field-row-4">
            <div class="field">
              <label>Calorias (kcal) *</label>
              <input type="number" [(ngModel)]="form.kcal" min="0" />
            </div>
            <div class="field">
              <label>Proteina (g)</label>
              <input type="number" [(ngModel)]="form.proteinG" min="0" />
            </div>
            <div class="field">
              <label>Carbs (g)</label>
              <input type="number" [(ngModel)]="form.carbsG" min="0" />
            </div>
            <div class="field">
              <label>Gordura (g)</label>
              <input type="number" [(ngModel)]="form.fatG" min="0" />
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label>Porcoes</label>
              <input type="number" [(ngModel)]="form.servings" min="1" />
            </div>
            <div class="field">
              <label>Tempo de preparo (min)</label>
              <input type="number" [(ngModel)]="form.prepTimeMin" min="1" />
            </div>
          </div>

          <!-- ── Ingredients ─────────────────────────────────── -->
          <div class="ingredients-section">
            <div class="ing-header">
              <span class="ing-title">Ingredientes</span>
              <button class="add-ing-btn" (click)="addIngredient()">+ Adicionar ingrediente</button>
            </div>

            @if (form.ingredients.length > 0) {
              <div class="ing-labels">
                <span>Nome</span>
                <span>Qtd</span>
                <span>Unidade</span>
                <span></span>
              </div>

              @for (ing of form.ingredients; track $index; let i = $index) {
                <div class="ing-row">
                  <input type="text" [(ngModel)]="ing.name" placeholder="Ex: Frango desfiado" />
                  <input type="number" [(ngModel)]="ing.quantity" min="0" step="0.5" />
                  <select [(ngModel)]="ing.unit">
                    @for (u of unitOptions; track u) {
                      <option [value]="u">{{ u }}</option>
                    }
                  </select>
                  <button class="rm-btn" (click)="removeIngredient(i)" title="Remover">&#10005;</button>
                </div>
              }
            } @else {
              <p style="font-size:.8rem;color:var(--color-text-subtle);margin:.5rem 0">
                Nenhum ingrediente adicionado. Clique em "+ Adicionar ingrediente" acima.
              </p>
            }
          </div>

          <div class="toggle-wrap" style="margin-bottom:1rem">
            <input type="checkbox" id="pub-toggle" [(ngModel)]="form.isPublic" />
            <label for="pub-toggle" style="font-size:.875rem;color:var(--color-text);cursor:pointer">
              Publicar no feed da comunidade
            </label>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModals()">Cancelar</button>
            <button class="btn btn-primary" (click)="saveRecipe()" [disabled]="saving()">
              {{ saving() ? 'Salvando...' : editingId() ? 'Atualizar' : 'Criar Receita' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── Import Confirmation Modal ──────────────────────────── -->
    @if (importTarget()) {
      <div class="modal-overlay" (click)="closeModals()">
        <div class="modal" (click)="$event.stopPropagation()" style="max-width:480px">
          <h3>{{ isResync() ? 'Atualizar Receita Importada' : 'Importar para Minhas Receitas' }}</h3>

          <div class="import-card">
            <div class="ic-title">{{ importTarget()!.title }}</div>
            <div class="macro-row" style="margin-bottom:.5rem">
              <span class="mp kcal">{{ importTarget()!.kcal | number:'1.0-0' }} kcal</span>
              <span class="mp prot">{{ importTarget()!.proteinG | number:'1.0-0' }}g prot</span>
              <span class="mp carb">{{ importTarget()!.carbsG | number:'1.0-0' }}g carb</span>
              <span class="mp fat">{{ importTarget()!.fatG | number:'1.0-0' }}g gord</span>
            </div>
            @if (importTarget()!.ingredients?.length) {
              <div style="font-size:.78rem;color:var(--color-text-muted)">
                {{ importTarget()!.ingredients!.length }} ingrediente(s)
              </div>
            }
          </div>

          @if (isResync()) {
            <p style="font-size:.85rem;color:var(--color-text-muted);margin-bottom:1rem">
              O autor atualizou esta receita. Deseja sincronizar sua copia com a versao mais recente?
              Suas alteracoes locais serao substituidas.
            </p>
          } @else {
            <p style="font-size:.85rem;color:var(--color-text-muted);margin-bottom:1rem">
              Uma copia privada sera adicionada em <strong>Minhas Receitas</strong>. Voce podera edita-la
              livremente sem afetar a receita original. Futuras alteracoes do autor nao afetarao sua copia.
            </p>
          }

          <p class="import-info">+{{ XP_IMPORT }} XP ao importar!</p>

          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModals()">Cancelar</button>
            <button class="btn btn-primary" (click)="confirmImport()" [disabled]="saving()">
              {{ saving() ? 'Importando...' : isResync() ? 'Sincronizar' : 'Importar' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── Detail Modal ─────────────────────────────────────────── -->
    @if (detailTarget()) {
      <div class="modal-overlay" (click)="closeModals()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>{{ detailTarget()!.title }}</h3>

          <div style="margin-bottom:1rem">
            <div class="macro-row" style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.75rem">
              <span style="font-size:.78rem;font-weight:600;padding:.2rem .6rem;border-radius:99px;background:#fef3c7;color:#92400e">
                {{ detailTarget()!.kcal | number:'1.0-0' }} kcal
              </span>
              <span style="font-size:.78rem;font-weight:600;padding:.2rem .6rem;border-radius:99px;background:#dbeafe;color:#1e40af">
                {{ detailTarget()!.proteinG | number:'1.0-0' }}g prot
              </span>
              <span style="font-size:.78rem;font-weight:600;padding:.2rem .6rem;border-radius:99px;background:#fce7f3;color:#9d174d">
                {{ detailTarget()!.carbsG | number:'1.0-0' }}g carb
              </span>
              <span style="font-size:.78rem;font-weight:600;padding:.2rem .6rem;border-radius:99px;background:#ede9fe;color:#5b21b6">
                {{ detailTarget()!.fatG | number:'1.0-0' }}g gord
              </span>
            </div>
            @if (detailTarget()!.description) {
              <p style="font-size:.875rem;color:var(--color-text-muted);margin-bottom:.75rem">
                {{ detailTarget()!.description }}
              </p>
            }
            @if (detailTarget()!.prepTimeMin) {
              <p style="font-size:.82rem;color:var(--color-text-muted);margin-bottom:.75rem">
                Tempo de preparo: {{ detailTarget()!.prepTimeMin }} min
              </p>
            }
            @if (detailTarget()!.version) {
              <p style="font-size:.72rem;color:var(--color-text-subtle)">
                Versao {{ detailTarget()!.version }}
                @if (detailTarget()!.forkedFromId) {
                  &middot; Importada (versao original: {{ detailTarget()!.forkedAtVersion }})
                }
              </p>
            }
          </div>

          <!-- Ingredients list -->
          @if (detailTarget()!.ingredients?.length) {
            <div class="detail-ingredients">
              <div class="di-title">Ingredientes</div>
              @for (ing of detailTarget()!.ingredients; track $index) {
                <div class="di-item">
                  <span class="di-qty">{{ ing.quantity }} {{ ing.unit }}</span>
                  <span>{{ ing.name }}</span>
                </div>
              }
            </div>
          }

          <div style="background:var(--color-surface-2);border-radius:var(--radius-sm);padding:1rem;margin-top:1rem">
            <div style="font-size:.78rem;font-weight:700;color:var(--color-text-subtle);text-transform:uppercase;margin-bottom:.5rem">
              Modo de Preparo
            </div>
            <div style="font-size:.875rem;color:var(--color-text);white-space:pre-wrap;line-height:1.65">{{ detailTarget()!.instructions }}</div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModals()">Fechar</button>
            @if (!detailTarget()!.forkedFromId && detailTarget()!.isPublic) {
              <button class="btn btn-primary" (click)="openImport(detailTarget()!); detailTarget.set(null)">Importar</button>
            }
          </div>
        </div>
      </div>
    }

    <!-- ── Rating Modal ─────────────────────────────────────────── -->
    @if (ratingTarget()) {
      <div class="modal-overlay" (click)="closeModals()">
        <div class="modal" (click)="$event.stopPropagation()" style="max-width:400px">
          <h3>Avaliar: {{ ratingTarget()!.title }}</h3>

          <div class="field">
            <label>Sua nota</label>
            <div class="star-picker">
              @for (s of [1,2,3,4,5]; track s) {
                <button (click)="ratingVal.set(s)" [style.filter]="s <= ratingVal() ? '' : 'grayscale(1)'">&#11088;</button>
              }
            </div>
            <div style="font-size:.8rem;color:var(--color-text-muted);margin-top:.375rem">
              {{ ratingVal() > 0 ? ratingVal() + '/5' : 'Sem nota' }}
            </div>
          </div>

          <div class="field">
            <label>Comentario (opcional)</label>
            <textarea [(ngModel)]="ratingComment" placeholder="Deixe uma mensagem..."></textarea>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModals()">Cancelar</button>
            <button class="btn btn-primary" (click)="submitRating()" [disabled]="saving()">
              {{ saving() ? 'Enviando...' : 'Enviar Avaliacao' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (xpPopVisible()) {
      <div class="xp-pop" [style.left]="xpPopX + 'px'" [style.top]="xpPopY + 'px'">
        +{{ lastXp() }} XP
      </div>
    }
  `,
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

  readonly filteredFeed = computed(() => this.feed());

  readonly filteredMine = computed(() => {
    const q = this.localQuery.toLowerCase();
    if (!q) return this.mine();
    return this.mine().filter(r =>
      r.title.toLowerCase().includes(q)
      || r.ingredients?.some(i => i.name.toLowerCase().includes(q))
    );
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
        // Add or update the fork in "mine"
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
        // Refresh feed to update hasUpdate flags
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
