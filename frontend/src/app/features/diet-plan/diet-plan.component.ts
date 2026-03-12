import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { DietPlanService } from '../../core/services/diet-plan.service';
import { ProfileService } from '../../core/services/profile.service';
import { ClinicalProtocolService } from '../../core/services/clinical-protocol.service';
import { RecipeService } from '../../core/services/recipe.service';
import { ScheduledMealService } from '../../core/services/scheduled-meal.service';
import { ScheduledMeal, UserLevel, ClinicalProtocolWithLog, PrimaryGoal, Recipe, LinkedRecipe } from '../../core/models';

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
  imports: [FormsModule, DecimalPipe, DatePipe],
  styles: [`
    .page { padding: 1.5rem; max-width: 860px; margin: 0 auto; }

    .page-header {
      margin-bottom: 1.5rem;
      h2 { font-size: 1.5rem; font-weight: 800;
        background: linear-gradient(135deg, var(--color-primary), #8b5cf6);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      }
      p { color: var(--color-text-muted); font-size: .875rem; line-height: 1.5; }
    }

    .controls {
      display: flex; align-items: center; gap: .75rem; margin-bottom: 1.5rem; flex-wrap: wrap;
      input[type=date] { border: 1.5px solid var(--color-border); border-radius: var(--radius-sm);
        padding: .45rem .75rem; font-size: .875rem; background: var(--color-surface); color: var(--color-text); }
    }

    /* Goal + caloric target banner */
    .goal-banner {
      display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
      background: var(--color-surface); border: 1.5px solid var(--color-border);
      border-radius: var(--radius-md); padding: 1rem 1.25rem; margin-bottom: 1.25rem;

      .goal-pill {
        display: flex; align-items: center; gap: .5rem;
        background: var(--color-primary-light); color: var(--color-primary-dark);
        border-radius: 99px; padding: .35rem .875rem;
        font-size: .875rem; font-weight: 700;
        .g-emoji { font-size: 1.1rem; }
      }

      .caloric-info { flex: 1; display: flex; align-items: baseline; gap: .5rem;
        .cal-val   { font-size: 1.75rem; font-weight: 800; color: var(--color-primary); }
        .cal-lbl   { font-size: .82rem; color: var(--color-text-muted); }
        .adj-badge { font-size: .75rem; font-weight: 700; padding: .15rem .5rem;
          border-radius: 99px; margin-left: auto; }
        .adj-pos   { background: #dcfce7; color: #15803d; }
        .adj-neg   { background: #fee2e2; color: #b91c1c; }
        .adj-zero  { background: var(--color-surface-2); color: var(--color-text-muted); }
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

    .proto-card { border-color: #c4b5fd !important;
      &.done { background: #f5f3ff !important; border-color: #a78bfa !important;
        &::before { background: #7c3aed !important; box-shadow: 0 0 0 2px #c4b5fd !important; }
      }
    }

    .card-row { display: flex; align-items: flex-start; gap: .875rem; }
    .time-badge { padding: .25rem .625rem; border-radius: var(--radius-sm); font-size: .78rem;
      font-weight: 700; white-space: nowrap; flex-shrink: 0;
      &.meal  { background: var(--color-primary-light); color: var(--color-primary-dark); }
      &.proto { background: #ede9fe; color: #6b21a8; }
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
    .cat-pill { font-size: .7rem; font-weight: 700; padding: .1rem .5rem; border-radius: 99px;
      background: #ede9fe; color: #6b21a8; display: inline-block; margin-top: .25rem; }

    .food-list { margin-top: .75rem; padding-top: .75rem; border-top: 1px dashed var(--color-border);
      display: flex; flex-direction: column; gap: .375rem; }
    .food-item { display: flex; align-items: center; justify-content: space-between; font-size: .8rem;
      .fname { color: var(--color-text); } .fmacro { color: var(--color-text-muted); font-size: .72rem; } }

    /* ── Linked recipes section ──────────────────────────────── */
    .linked-recipes {
      margin-top: .75rem; padding-top: .75rem; border-top: 1px dashed var(--color-border);
      .lr-header {
        display: flex; align-items: center; justify-content: space-between; margin-bottom: .5rem;
        .lr-title { font-size: .75rem; font-weight: 700; color: var(--color-text-subtle);
          text-transform: uppercase; letter-spacing: .04em; }
        .lr-add-btn { font-size: .75rem; color: var(--color-primary); background: none; border: none;
          cursor: pointer; font-weight: 600; &:hover { text-decoration: underline; } }
      }
    }
    .lr-item {
      display: flex; align-items: center; gap: .5rem; padding: .4rem .5rem;
      border-radius: var(--radius-sm); font-size: .82rem;
      &:nth-child(even) { background: var(--color-surface-2); }
      .lr-name { flex: 1; font-weight: 600; color: var(--color-text); }
      .lr-macro { font-size: .72rem; color: var(--color-text-muted); }
      .lr-servings { font-size: .72rem; color: var(--color-primary); font-weight: 700;
        padding: .1rem .4rem; background: var(--color-primary-light); border-radius: 99px; }
      .lr-remove { width: 24px; height: 24px; border: none; background: none;
        color: var(--color-text-subtle); cursor: pointer; font-size: .9rem; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        &:hover { background: rgba(239,68,68,.1); color: #ef4444; } }
    }
    .add-recipe-btn {
      margin-top: .5rem; width: 100%; padding: .5rem; border: 1.5px dashed var(--color-border);
      border-radius: var(--radius-sm); background: none; color: var(--color-primary);
      font-size: .82rem; font-weight: 600; cursor: pointer; transition: all .15s;
      &:hover { border-color: var(--color-primary); background: rgba(99,102,241,.04); }
    }

    .check-btn {
      width: 44px; height: 44px; border-radius: 50%; border: 2.5px solid var(--color-border);
      background: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
      font-size: 1.25rem; transition: all .2s; flex-shrink: 0;
      &.done      { background: #16a34a; border-color: #16a34a; color: #fff; }
      &.proto-done{ background: #7c3aed; border-color: #7c3aed; color: #fff; }
      &:hover:not(.done):not(.proto-done) { border-color: #16a34a; background: #f0fdf4; }
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

    /* ── Recipe picker modal ─────────────────────────────────── */
    .modal-overlay {
      position: fixed; inset: 0; z-index: 500;
      background: rgba(0,0,0,.5); backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center; padding: 1rem;
    }
    .modal {
      background: var(--color-surface); border-radius: var(--radius-lg);
      width: 100%; max-width: 560px; max-height: 85vh; overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,.15); animation: modalIn .25s ease;
    }
    .modal-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--color-border);
      position: sticky; top: 0; background: var(--color-surface); z-index: 1;
      h3 { font-size: 1.1rem; font-weight: 700; margin: 0; }
      .close-btn { width: 32px; height: 32px; border-radius: 50%;
        border: none; background: var(--color-surface-2); cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        font-size: 1rem; color: var(--color-text-muted); transition: .15s;
        &:hover { background: var(--color-border); } }
    }
    .modal-body { padding: 1rem 1.5rem; }

    @keyframes modalIn { from { opacity: 0; transform: scale(.96) translateY(8px); } to { opacity: 1; transform: none; } }

    .picker-search {
      margin-bottom: 1rem;
      input { width: 100%; padding: .6rem .875rem; border: 1.5px solid var(--color-border);
        border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text);
        font-size: .875rem; outline: none; transition: all .15s;
        &:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(99,102,241,.08); }
        &::placeholder { color: var(--color-text-subtle); }
      }
    }

    .picker-list { display: flex; flex-direction: column; gap: .5rem; }
    .picker-item {
      display: flex; align-items: center; gap: .75rem; padding: .75rem 1rem;
      border: 1.5px solid var(--color-border); border-radius: var(--radius-sm);
      cursor: pointer; transition: all .15s;
      &:hover { border-color: var(--color-primary); background: rgba(99,102,241,.04); }
      .pi-info { flex: 1; min-width: 0;
        .pi-name { font-size: .9rem; font-weight: 700; color: var(--color-text);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pi-macros { font-size: .72rem; color: var(--color-text-muted); margin-top: .15rem; }
      }
      .pi-add { padding: .35rem .75rem; border-radius: var(--radius-sm);
        background: var(--color-primary); color: #fff; border: none;
        font-size: .78rem; font-weight: 600; cursor: pointer; white-space: nowrap;
        &:hover { background: #4f46e5; } }
    }
    .picker-empty { text-align: center; padding: 2rem; color: var(--color-text-muted);
      font-size: .875rem; }

    .servings-input {
      display: flex; align-items: center; gap: .5rem;
      padding: 1rem 1.5rem; border-top: 1px solid var(--color-border);
      background: var(--color-surface-2);
      .si-label { font-size: .82rem; font-weight: 600; color: var(--color-text-muted); }
      input { width: 80px; padding: .4rem .6rem; border: 1.5px solid var(--color-border);
        border-radius: var(--radius-sm); font-size: .875rem; text-align: center;
        background: var(--color-surface); color: var(--color-text); }
      .si-recipe { flex: 1; font-size: .85rem; font-weight: 700; color: var(--color-text); }
      .si-confirm { padding: .4rem .875rem; border-radius: var(--radius-sm);
        background: var(--color-primary); color: #fff; border: none;
        font-size: .82rem; font-weight: 600; cursor: pointer;
        &:hover { background: #4f46e5; } }
    }
  `],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>Dieta & Protocolos</h2>
        <p>Sua timeline diaria com refeicoes e protocolos clinicos. Marque cada item e ganhe XP!
        Vincule receitas para manter sua dieta organizada.</p>
      </div>

      <div class="controls">
        <input type="date" [value]="selectedDate()" (change)="onDateChange($event)" />
        <button class="btn btn-primary" (click)="generate()" [disabled]="generating()">
          {{ generating() ? 'Gerando...' : 'Gerar Plano de Exemplo' }}
        </button>
        <button class="btn" (click)="load()">Recarregar</button>
      </div>

      <!-- Goal + caloric target banner -->
      @if (metabolic()) {
        <div class="goal-banner">
          @if (goalLabel()) {
            <div class="goal-pill">
              <span class="g-emoji">{{ goalEmoji() }}</span>
              <span>{{ goalLabel() }}</span>
            </div>
          }
          <div class="caloric-info">
            <span class="cal-val">{{ metabolic()!.dailyCaloricTarget | number:'1.0-0' }}</span>
            <span class="cal-lbl">kcal / dia (meta)</span>
            @if (metabolic()!.goalAdjustmentKcal !== 0) {
              <span class="adj-badge" [class.adj-pos]="metabolic()!.goalAdjustmentKcal > 0"
                [class.adj-neg]="metabolic()!.goalAdjustmentKcal < 0">
                {{ metabolic()!.goalAdjustmentKcal > 0 ? '+' : '' }}{{ metabolic()!.goalAdjustmentKcal | number:'1.0-0' }} kcal ajuste
              </span>
            } @else {
              <span class="adj-badge adj-zero">{{ goalLabel() ?? 'Manutencao' }}</span>
            }
          </div>
        </div>
      }

      @if (meals().length > 0 || metabolic()) {
        <div class="macros-row">
          <div class="macro-card">
            <div class="mv">{{ targetCal() | number:'1.0-0' }}</div>
            <div class="ml">Calorias</div><div class="mc">meta do dia</div>
          </div>
          <div class="macro-card">
            <div class="mv">{{ targetProtein() | number:'1.0-0' }}g</div>
            <div class="ml">Proteina</div><div class="mc">meta do dia</div>
          </div>
          <div class="macro-card">
            <div class="mv">{{ targetCarbs() | number:'1.0-0' }}g</div>
            <div class="ml">Carboidratos</div><div class="mc">meta do dia</div>
          </div>
          <div class="macro-card">
            <div class="mv">{{ consumedMeals() }}/{{ meals().length }}</div>
            <div class="ml">Refeicoes</div><div class="mc">concluidas</div>
          </div>
        </div>
      }

      @if (loading()) {
        <div style="text-align:center;padding:3rem;color:var(--color-text-muted)">
          <div class="spinner" style="margin:0 auto 1rem"></div> Carregando...
        </div>
      } @else if (timeline().length === 0) {
        <div class="empty-state">
          <span class="emoji">&#127860;</span>
          <p>Nenhum item para este dia.<br>
            Clique em <strong>Gerar Plano de Exemplo</strong> para criar seu plano alimentar.<br>
            Adicione protocolos em <strong>Protocolos</strong> para ve-los aqui.</p>
        </div>
      } @else {
        <div class="timeline">
          @for (item of timeline(); track itemKey(item)) {

            @if (item.kind === 'meal') {
              <div class="timeline-card"
                [class.done]="item.data.isConsumed"
                [class.checking]="checking() === item.data.id">
                <div class="card-row">
                  <span class="time-badge meal">{{ item.data.scheduledTime }}</span>
                  <div class="card-info">
                    <div class="item-name" [class.struck]="item.data.isConsumed">{{ item.data.name }}</div>
                    <div class="pill-row">
                      @if (item.data.caloricTarget) {
                        <span class="macro-pill kcal">{{ item.data.caloricTarget | number:'1.0-0' }} kcal</span>
                      }
                      @if (item.data.proteinG) {
                        <span class="macro-pill prot">{{ item.data.proteinG | number:'1.0-0' }}g prot</span>
                      }
                      @if (item.data.carbsG) {
                        <span class="macro-pill carb">{{ item.data.carbsG | number:'1.0-0' }}g carb</span>
                      }
                      @if (item.data.fatG) {
                        <span class="macro-pill fat">{{ item.data.fatG | number:'1.0-0' }}g gord</span>
                      }
                    </div>
                  </div>
                  <button class="check-btn" [class.done]="item.data.isConsumed"
                    (click)="toggleMeal(item.data, $event)" [disabled]="checking() === item.data.id">
                    {{ item.data.isConsumed ? '&#10003;' : '&#9675;' }}
                  </button>
                </div>

                @if (item.data.foods && item.data.foods.length > 0) {
                  <div class="food-list">
                    @for (food of item.data.foods; track food.name) {
                      <div class="food-item">
                        <span class="fname">{{ food.name }}</span>
                        <span class="fmacro">{{ food.quantityG }}g · {{ food.calories | number:'1.0-0' }} kcal</span>
                      </div>
                    }
                  </div>
                }

                <!-- Linked recipes -->
                <div class="linked-recipes">
                  <div class="lr-header">
                    <span class="lr-title">Receitas vinculadas</span>
                    @if (!item.data.isConsumed) {
                      <button class="lr-add-btn" (click)="openRecipePicker(item.data)">+ Vincular receita</button>
                    }
                  </div>

                  @if (item.data.linkedRecipes && item.data.linkedRecipes.length > 0) {
                    @for (lr of item.data.linkedRecipes; track lr.recipeId) {
                      <div class="lr-item">
                        <span class="lr-name">{{ lr.title }}</span>
                        <span class="lr-servings">x{{ lr.servings }}</span>
                        <span class="lr-macro">{{ linkedRecipeKcal(lr) | number:'1.0-0' }} kcal</span>
                        @if (!item.data.isConsumed) {
                          <button class="lr-remove" (click)="unlinkRecipe(item.data, lr.recipeId)" title="Remover receita">&#10005;</button>
                        }
                      </div>
                    }
                  } @else {
                    @if (!item.data.isConsumed) {
                      <button class="add-recipe-btn" (click)="openRecipePicker(item.data)">
                        + Adicionar receita a esta refeicao
                      </button>
                    }
                  }
                </div>

                @if (item.data.isConsumed && item.data.consumedAt) {
                  <div class="done-note" style="color:#16a34a">
                    &#10003; Consumida as {{ item.data.consumedAt | date:'HH:mm' }}
                    @if (item.data.xpAwarded) { · +{{ XP_MEAL }} XP! }
                  </div>
                }
              </div>
            }

            @if (item.kind === 'protocol') {
              <div class="timeline-card proto-card"
                [class.done]="!!item.data.log"
                [class.checking]="checking() === 'proto-' + item.data.id">
                <div class="card-row">
                  <span class="time-badge proto">{{ catIcon(item.data.category) }} {{ item.data.scheduledTime }}</span>
                  <div class="card-info">
                    <div class="item-name" [class.struck]="!!item.data.log">{{ item.data.name }}</div>
                    <div class="item-sub">{{ item.data.dosage }}</div>
                    <span class="cat-pill">{{ item.data.category }}</span>
                  </div>
                  <button class="check-btn" [class.proto-done]="!!item.data.log"
                    (click)="toggleProtocol(item.data, $event)" [disabled]="checking() === 'proto-' + item.data.id">
                    {{ item.data.log ? '&#10003;' : '&#9675;' }}
                  </button>
                </div>
                @if (item.data.log) {
                  <div class="done-note" style="color:#7c3aed">
                    &#10003; Tomado as {{ item.data.log.takenAt | date:'HH:mm' }}
                    @if (item.data.log.xpAwarded) { · +{{ XP_PROTO }} XP! }
                  </div>
                }
              </div>
            }

          }
        </div>
      }
    </div>

    <!-- ── Recipe Picker Modal ─────────────────────────────────── -->
    @if (pickerMeal()) {
      <div class="modal-overlay" (click)="closeRecipePicker()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3>Vincular receita a "{{ pickerMeal()!.name }}"</h3>
            <button class="close-btn" (click)="closeRecipePicker()">&#10005;</button>
          </div>

          <div class="modal-body">
            <div class="picker-search">
              <input type="text" placeholder="Buscar nas minhas receitas..."
                [(ngModel)]="pickerQuery" />
            </div>

            @if (filteredPickerRecipes().length > 0) {
              <div class="picker-list">
                @for (r of filteredPickerRecipes(); track r.id) {
                  <div class="picker-item">
                    <div class="pi-info">
                      <div class="pi-name">{{ r.title }}</div>
                      <div class="pi-macros">
                        {{ r.kcal | number:'1.0-0' }} kcal · {{ r.proteinG | number:'1.0-0' }}g prot
                        · {{ r.carbsG | number:'1.0-0' }}g carb · {{ r.fatG | number:'1.0-0' }}g gord
                        @if (r.servings > 1) { · {{ r.servings }} porcoes }
                      </div>
                    </div>
                    @if (pickerSelected()?.id === r.id) {
                      <span style="font-size:.78rem;color:var(--color-primary);font-weight:700">Selecionada</span>
                    } @else {
                      <button class="pi-add" (click)="selectPickerRecipe(r)">Selecionar</button>
                    }
                  </div>
                }
              </div>
            } @else {
              <div class="picker-empty">
                <p>Nenhuma receita encontrada.</p>
                <p style="font-size:.78rem;margin-top:.5rem">Crie ou importe receitas na aba <strong>Receitas</strong>.</p>
              </div>
            }
          </div>

          @if (pickerSelected()) {
            <div class="servings-input">
              <span class="si-recipe">{{ pickerSelected()!.title }}</span>
              <span class="si-label">Porcoes:</span>
              <input type="number" [(ngModel)]="pickerServings" min="0.5" step="0.5" />
              <button class="si-confirm" (click)="confirmLinkRecipe()" [disabled]="linking()">
                {{ linking() ? 'Vinculando...' : 'Vincular' }}
              </button>
            </div>
          }
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
export class DietPlanComponent implements OnInit {
  private mealSvc      = inject(DietPlanService);
  private profileSvc   = inject(ProfileService);
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
  readonly consumedMeals = computed(() => this.meals().filter(m => m.isConsumed).length);

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
  }

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
