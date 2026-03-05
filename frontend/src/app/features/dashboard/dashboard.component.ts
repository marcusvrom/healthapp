import {
  Component, inject, signal, computed, OnInit, OnDestroy, HostListener,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject, switchMap, of } from 'rxjs';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';

import { ProfileService }         from '../../core/services/profile.service';
import { RoutineService }          from '../../core/services/routine.service';
import { FoodService }             from '../../core/services/food.service';
import { UserService }             from '../../core/services/user.service';
import { WaterService }            from '../../core/services/water.service';
import { ClinicalProtocolService } from '../../core/services/clinical-protocol.service';
import { RecipeService }           from '../../core/services/recipe.service';
import { ScheduledMealService }    from '../../core/services/scheduled-meal.service';

import {
  RoutineBlock, BlockType, DailySummary, ClinicalProtocolWithLog,
  ScheduledMeal, LinkedRecipe, Recipe, RecipeFeedItem,
} from '../../core/models';
import { WaterTrackerComponent } from '../water/water-tracker.component';

// ── Pure helpers ─────────────────────────────────────────────────────────────
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
function pad2(n: number): string { return String(n).padStart(2, '0'); }

// ── Block metadata ───────────────────────────────────────────────────────────
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
  SUPLEMENTO: '🧴', REMEDIO_CONTROLADO: '💊', TRT: '💉',
  HORMONIO_FEMININO: '🌸', SONO: '😴',
};

interface TimeGroup {
  time: string; minuteOfDay: number; blocks: RoutineBlock[];
  isPast: boolean; isCurrent: boolean;
}

// Linked recipe with computed totals
interface LinkedRecipeView extends LinkedRecipe {
  totalKcal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DecimalPipe, DatePipe, RouterLink, WaterTrackerComponent, FormsModule],
  styles: [`
    /* ── Layout ─────────────────────────────────────────────────────────────── */
    .dashboard { display: grid; grid-template-columns: 1fr 340px; gap: 1.5rem; padding: 1.5rem; background: var(--color-bg) !important;
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

    /* ── Timeline ────────────────────────────────────────────────────────────── */
    .timeline-panel { min-width: 0; .panel-title { font-size: .95rem; font-weight: 700; margin-bottom: 1rem; } }
    .timeline-feed { display: flex; flex-direction: column; position: relative; padding-bottom: 1rem;
      &::before { content: ''; position: absolute; left: 46px; top: 0; bottom: 0; width: 2px; background: var(--color-border); border-radius: 99px; }
    }
    .tg { display: flex; &.past { opacity: .6; } }
    .tg-time { width: 44px; padding-top: 1rem; font-size: .68rem; font-weight: 700; color: var(--color-text-subtle); text-align: right; flex-shrink: 0; line-height: 1; }
    .tg-rail { width: 4px; margin: 0 10px; display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
    .tg-dot  { width: 12px; height: 12px; border-radius: 50%; margin-top: .95rem; background: var(--color-border); border: 2px solid var(--color-surface); flex-shrink: 0; }
    .tg-cards { flex: 1; min-width: 0; padding: .5rem 0; display: flex; flex-direction: column; gap: .45rem; }

    .block-card { border-radius: var(--radius-sm); border: 1px solid var(--color-border); border-left-width: 3px; padding: .575rem .875rem; background: var(--color-surface); transition: box-shadow .15s, transform .1s;
      &:hover { box-shadow: var(--shadow-sm); transform: translateX(2px); }
      &.done { opacity: .65; }
      &.meal-clickable { cursor: pointer; }
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

    /* Meal block extras */
    .meal-recipes-preview { margin-top: .35rem; display: flex; flex-wrap: wrap; gap: .25rem; }
    .recipe-chip { font-size: .63rem; font-weight: 600; padding: .1rem .4rem; border-radius: 99px;
      background: rgba(245,158,11,.15); color: #92400e; border: 1px solid rgba(245,158,11,.3); }
    .meal-balance-bar { margin-top: .35rem; height: 4px; background: var(--color-border); border-radius: 99px; overflow: visible; position: relative;
      .mbb-fill { height: 100%; border-radius: 99px; transition: width .4s; }
      .mbb-over { position: absolute; right: 0; top: 0; height: 100%; border-radius: 99px; background: #ef4444; }
    }

    /* Now line */
    .now-line { display: flex; align-items: center; margin: .25rem 0;
      .now-time { width: 44px; font-size: .68rem; font-weight: 800; color: var(--color-danger); text-align: right; flex-shrink: 0; }
      .now-dot  { width: 12px; height: 12px; border-radius: 50%; background: var(--color-danger); margin: 0 10px; box-shadow: 0 0 0 4px rgba(239,68,68,.15); flex-shrink: 0; }
      .now-bar  { flex: 1; height: 2px; background: var(--color-danger); border-radius: 99px; opacity: .5; }
    }

    /* ── Right panel ─────────────────────────────────────────────────────────── */
    .right-panel { display: flex; flex-direction: column; gap: 1.25rem; }
    .macro-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1.25rem;
      .card-title { font-size: .875rem; font-weight: 700; margin-bottom: .875rem; }
      .calorie-row { display: flex; align-items: baseline; gap: .375rem; margin-bottom: .875rem;
        .cal-value { font-size: 1.875rem; font-weight: 800; color: var(--color-primary); }
        .cal-label { font-size: .78rem; color: var(--color-text-muted); }
        .cal-target { font-size: .78rem; color: var(--color-text-subtle); margin-left: auto; }
        .cal-over  { font-size: .72rem; color: var(--color-danger); font-weight: 700; }
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

    /* ── Meal panel modal ────────────────────────────────────────────────────── */
    .panel-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 200;
      display: flex; align-items: flex-end; justify-content: center;
      @media (min-width: 640px) { align-items: center; }
    }
    .meal-panel {
      background: var(--color-surface); border-radius: var(--radius-md) var(--radius-md) 0 0;
      width: 100%; max-width: 560px; max-height: 92vh; display: flex; flex-direction: column;
      overflow: hidden; box-shadow: var(--shadow-lg);
      @media (min-width: 640px) { border-radius: var(--radius-md); max-height: 88vh; }

      /* Header */
      .mp-header {
        padding: 1rem 1.25rem .75rem; border-bottom: 1px solid var(--color-border);
        display: flex; align-items: flex-start; gap: .75rem;
        .mp-title { flex: 1;
          h3 { font-size: 1rem; font-weight: 700; }
          .mp-time { font-size: .75rem; color: var(--color-text-muted); margin-top: .1rem; }
        }
        .mp-close { background: none; border: none; cursor: pointer; font-size: 1.25rem; color: var(--color-text-muted); padding: .2rem; line-height: 1; &:hover { color: var(--color-text); } }
      }

      /* Caloric balance bar */
      .mp-balance {
        padding: .875rem 1.25rem; border-bottom: 1px solid var(--color-border);

        .balance-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: .4rem;
          .bal-label { font-size: .75rem; color: var(--color-text-muted); }
          .bal-nums { font-size: .82rem; font-weight: 700;
            .bal-consumed { color: var(--color-primary); }
            .bal-sep { color: var(--color-text-subtle); margin: 0 .25rem; }
            .bal-target { color: var(--color-text-muted); font-weight: 400; }
          }
          .bal-delta { font-size: .78rem; font-weight: 700; padding: .1rem .45rem; border-radius: 99px;
            &.ok  { background: rgba(34,197,94,.14); color: #16a34a; }
            &.bad { background: rgba(239,68,68,.14);  color: #dc2626; }
          }
        }
        .balance-track { height: 8px; background: var(--color-border); border-radius: 99px; overflow: hidden; position: relative;
          .bt-green { position: absolute; left: 0; top: 0; height: 100%; background: #22c55e; border-radius: 99px; transition: width .4s; }
          .bt-red   { position: absolute; left: 0; top: 0; height: 100%; background: #ef4444; border-radius: 99px; transition: width .4s; }
        }

        /* Macro summary pills */
        .macro-pills { display: flex; gap: .375rem; margin-top: .625rem; flex-wrap: wrap;
          .mp-pill { font-size: .68rem; font-weight: 600; padding: .15rem .5rem; border-radius: 99px; border: 1px solid var(--color-border); color: var(--color-text-muted); }
        }
      }

      /* Scrollable body */
      .mp-body { flex: 1; overflow-y: auto; padding: .875rem 1.25rem; display: flex; flex-direction: column; gap: 1rem; }

      /* Linked recipe list */
      .linked-recipes { display: flex; flex-direction: column; gap: .5rem; }
      .linked-item {
        display: flex; align-items: center; gap: .625rem;
        background: var(--color-surface-2); border: 1px solid var(--color-border);
        border-radius: var(--radius-sm); padding: .625rem .75rem;

        .li-info { flex: 1; min-width: 0;
          .li-title { font-size: .82rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .li-macros { font-size: .68rem; color: var(--color-text-muted); margin-top: .1rem; }
        }
        .li-servings { display: flex; align-items: center; gap: .3rem; flex-shrink: 0;
          button { width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid var(--color-border); background: var(--color-surface); cursor: pointer; font-size: .9rem; line-height: 1; display: flex; align-items: center; justify-content: center;
            &:hover { background: var(--color-border); }
          }
          .srv-count { font-size: .8rem; font-weight: 700; min-width: 22px; text-align: center; }
        }
        .li-remove { background: none; border: none; cursor: pointer; color: var(--color-text-subtle); font-size: .9rem; padding: .2rem; flex-shrink: 0;
          &:hover { color: var(--color-danger); }
        }
      }

      /* Recipe search */
      .recipe-search { display: flex; flex-direction: column; gap: .5rem;
        label { font-size: .78rem; font-weight: 700; color: var(--color-text-muted); }
        .rs-input { display: flex; gap: .5rem;
          input { flex: 1; }
        }
        .rs-results { display: flex; flex-direction: column; gap: .375rem; max-height: 220px; overflow-y: auto; }
        .rs-item {
          display: flex; align-items: center; gap: .625rem;
          padding: .5rem .75rem; border-radius: var(--radius-sm);
          border: 1px solid var(--color-border); background: var(--color-surface-2);
          cursor: pointer; transition: .15s;
          &:hover { border-color: var(--color-primary-light); background: var(--color-surface); }

          .rsi-info { flex: 1; min-width: 0;
            .rsi-title { font-size: .82rem; font-weight: 600; }
            .rsi-kcal  { font-size: .68rem; color: var(--color-text-muted); }
          }
          .rsi-add { font-size: .75rem; font-weight: 700; padding: .25rem .625rem;
            border-radius: 99px; border: 1.5px solid var(--color-primary-light);
            background: none; cursor: pointer; color: var(--color-primary);
            &:hover { background: var(--color-primary); color: #fff; }
          }
        }
        .rs-empty { font-size: .8rem; color: var(--color-text-muted); text-align: center; padding: 1rem 0; }
      }

      /* Footer */
      .mp-footer {
        padding: .75rem 1.25rem; border-top: 1px solid var(--color-border);
        display: flex; gap: .625rem; align-items: center;
        .consume-btn { flex: 1; }
        .consume-btn.consumed { background: #d1fae5; border-color: #6ee7b7; color: #065f46; font-weight: 700;
          &:hover { background: #a7f3d0; }
        }
      }
    }

    /* ── XP pop ──────────────────────────────────────────────────────────────── */
    @keyframes xpPop { 0% { transform:scale(1);opacity:1; } 50% { transform:scale(1.5) translateY(-12px);opacity:1; } 100% { transform:scale(1) translateY(-28px);opacity:0; } }
    .xp-pop { position:fixed;pointer-events:none;z-index:999;font-size:1.1rem;font-weight:800;color:#7c3aed;animation:xpPop .9s ease forwards; }
  `],
  template: `
    <div class="dashboard">
      <!-- ── Header ──────────────────────────────────────────────────────── -->
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

      <!-- ── Generate bar ────────────────────────────────────────────────── -->
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

      <!-- ── Timeline ────────────────────────────────────────────────────── -->
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
                    <div class="block-card"
                      [class.done]="isDone(b)"
                      [class.meal-clickable]="b.type === 'meal'"
                      [style.border-left-color]="mealConsumed(b) ? '#22c55e' : blockMeta(b.type).color"
                      (click)="b.type === 'meal' ? openMealPanel(b) : null">

                      <div class="bc-row">
                        <div class="bc-icon" [style.background]="blockMeta(b.type).bg" [style.color]="blockMeta(b.type).color">{{ protocolIcon(b) }}</div>
                        <div class="bc-body">
                          <div class="bc-label">{{ b.label }}</div>
                          <div class="bc-sub">{{ b.startTime }}–{{ b.endTime }}
                            @if (b.caloricTarget) { &nbsp;·&nbsp;{{ b.caloricTarget | number:'1.0-0' }} kcal alvo }
                            @if (b.waterMl)       { &nbsp;·&nbsp;{{ b.waterMl | number:'1.0-0' }} ml }
                            @if (mealConsumed(b)) { &nbsp;· <span style="color:#16a34a;font-weight:700">✓ consumida</span> }
                          </div>

                          <!-- Recipe chips preview -->
                          @if (b.type === 'meal' && mealLinkedRecipes(b).length > 0) {
                            <div class="meal-recipes-preview">
                              @for (r of mealLinkedRecipes(b).slice(0, 3); track r.recipeId) {
                                <span class="recipe-chip">{{ r.title }} ×{{ r.servings }}</span>
                              }
                              @if (mealLinkedRecipes(b).length > 3) {
                                <span class="recipe-chip">+{{ mealLinkedRecipes(b).length - 3 }}</span>
                              }
                            </div>
                            <!-- Mini balance bar -->
                            <div class="meal-balance-bar" style="margin-top:.35rem">
                              @if (mealConsumedKcal(b) <= (b.caloricTarget ?? 0)) {
                                <div class="mbb-fill" [style.width.%]="mealBalancePct(b)" style="background:#22c55e"></div>
                              } @else {
                                <div class="mbb-fill" style="width:100%;background:#f59e0b"></div>
                                <div class="mbb-over" [style.width.%]="mealOverflowPct(b)"></div>
                              }
                            </div>
                          }
                        </div>

                        <div class="bc-right">
                          @if (b.type === 'medication') {
                            <span class="bc-pill" style="background:#ede9fe;color:#6b21a8">+5 XP</span>
                            <button class="bc-check" [class.checked]="isDone(b)" (click)="toggleProtocol(b, $event); $event.stopPropagation()" [disabled]="toggling() === b.id">{{ isDone(b) ? '✓' : '○' }}</button>
                          } @else if (b.type === 'meal') {
                            <span class="bc-pill" [style.background]="mealConsumed(b) ? '#d1fae5' : '#fef3c7'" [style.color]="mealConsumed(b) ? '#065f46' : '#92400e'">
                              {{ mealConsumed(b) ? '✓' : '+10 XP' }}
                            </span>
                            <span style="font-size:.75rem;color:var(--color-text-subtle)" title="Clique para gerenciar receitas">🍳</span>
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

      <!-- ── Right panel ─────────────────────────────────────────────────── -->
      <div class="right-panel">
        <div class="macro-card">
          <div class="card-title">🎯 Macronutrientes do Dia</div>
          @if (metabolic()) {
            <div class="calorie-row">
              <span class="cal-value" [style.color]="consumedKcal() > metabolic()!.dailyCaloricTarget ? 'var(--color-danger)' : 'var(--color-primary)'">{{ consumedKcal() | number:'1.0-0' }}</span>
              <span class="cal-label">kcal</span>
              <span class="cal-target">/ {{ metabolic()!.dailyCaloricTarget | number:'1.0-0' }}</span>
              @if (consumedKcal() > metabolic()!.dailyCaloricTarget) {
                <span class="cal-over">+{{ consumedKcal() - metabolic()!.dailyCaloricTarget | number:'1.0-0' }} excedido</span>
              }
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

    <!-- ── Meal panel overlay ─────────────────────────────────────────────── -->
    @if (mealPanel()) {
      <div class="panel-overlay" (click)="closeMealPanel()">
        <div class="meal-panel" (click)="$event.stopPropagation()">

          <!-- Header -->
          <div class="mp-header">
            <div class="mp-title">
              <h3>🍽️ {{ mealPanel()!.name }}</h3>
              <div class="mp-time">{{ mealPanel()!.scheduledTime }} · Alvo: {{ mealPanel()!.caloricTarget | number:'1.0-0' }} kcal</div>
            </div>
            <button class="mp-close" (click)="closeMealPanel()">✕</button>
          </div>

          <!-- Balance bar -->
          <div class="mp-balance">
            <div class="balance-row">
              <span class="bal-label">Consumo vs Meta</span>
              <span class="bal-nums">
                <span class="bal-consumed">{{ panelConsumedKcal() | number:'1.0-0' }}</span>
                <span class="bal-sep">/</span>
                <span class="bal-target">{{ mealPanel()!.caloricTarget | number:'1.0-0' }} kcal</span>
              </span>
              @if (panelBalance() !== 0) {
                <span class="bal-delta" [class.ok]="panelBalance() < 0" [class.bad]="panelBalance() > 0">
                  {{ panelBalance() > 0 ? '+' : '' }}{{ panelBalance() | number:'1.0-0' }} kcal
                </span>
              }
            </div>
            <div class="balance-track">
              @if (panelConsumedKcal() <= (mealPanel()!.caloricTarget ?? 0)) {
                <div class="bt-green" [style.width.%]="panelBalancePct()"></div>
              } @else {
                <div class="bt-red" style="width:100%"></div>
              }
            </div>
            <!-- Macro pills -->
            <div class="macro-pills">
              <span class="mp-pill">🥩 {{ panelConsumedProtein() | number:'1.0-0' }}g prot</span>
              <span class="mp-pill">🌾 {{ panelConsumedCarbs() | number:'1.0-0' }}g carb</span>
              <span class="mp-pill">🥑 {{ panelConsumedFat() | number:'1.0-0' }}g gord</span>
            </div>
          </div>

          <!-- Scrollable body -->
          <div class="mp-body">

            <!-- Linked recipes -->
            @if (panelRecipes().length > 0) {
              <div>
                <div style="font-size:.78rem;font-weight:700;color:var(--color-text-muted);margin-bottom:.5rem">Receitas vinculadas</div>
                <div class="linked-recipes">
                  @for (r of panelRecipes(); track r.recipeId) {
                    <div class="linked-item">
                      <div class="li-info">
                        <div class="li-title">{{ r.title }}</div>
                        <div class="li-macros">{{ r.totalKcal | number:'1.0-0' }} kcal · P:{{ r.totalProtein | number:'1.0-0' }}g C:{{ r.totalCarbs | number:'1.0-0' }}g G:{{ r.totalFat | number:'1.0-0' }}g</div>
                      </div>
                      <div class="li-servings">
                        <button (click)="changeServings(r, -0.5)" [disabled]="r.servings <= 0.5">−</button>
                        <span class="srv-count">{{ r.servings }}</span>
                        <button (click)="changeServings(r, 0.5)">+</button>
                      </div>
                      <button class="li-remove" (click)="removeRecipe(r.recipeId)" title="Remover">✕</button>
                    </div>
                  }
                </div>
              </div>
            } @else {
              <div style="text-align:center;padding:.75rem;color:var(--color-text-muted);font-size:.82rem">
                Nenhuma receita vinculada ainda.<br>Pesquise abaixo para adicionar.
              </div>
            }

            <!-- Recipe search -->
            <div class="recipe-search">
              <label>Adicionar receita</label>
              <div class="rs-input">
                <input type="text" placeholder="Buscar por nome..." [(ngModel)]="recipeSearch" />
              </div>

              @if (panelSearchResults().length > 0) {
                <div class="rs-results">
                  @for (r of panelSearchResults(); track r.id) {
                    <div class="rs-item">
                      <div class="rsi-info">
                        <div class="rsi-title">{{ r.title }}</div>
                        <div class="rsi-kcal">{{ r.kcal | number:'1.0-0' }} kcal/porção · P:{{ r.proteinG | number:'1.0-0' }}g C:{{ r.carbsG | number:'1.0-0' }}g G:{{ r.fatG | number:'1.0-0' }}g</div>
                      </div>
                      <button class="rsi-add" (click)="addRecipe(r)">+ Add</button>
                    </div>
                  }
                </div>
              } @else if (recipeSearch.length > 1) {
                <div class="rs-empty">Nenhuma receita encontrada.</div>
              } @else if (availableRecipes().length > 0) {
                <!-- Show top recipes when no search yet -->
                <div class="rs-results">
                  @for (r of availableRecipes().slice(0, 8); track r.id) {
                    <div class="rs-item">
                      <div class="rsi-info">
                        <div class="rsi-title">{{ r.title }}</div>
                        <div class="rsi-kcal">{{ r.kcal | number:'1.0-0' }} kcal/porção · P:{{ r.proteinG | number:'1.0-0' }}g C:{{ r.carbsG | number:'1.0-0' }}g G:{{ r.fatG | number:'1.0-0' }}g</div>
                      </div>
                      <button class="rsi-add" (click)="addRecipe(r)">+ Add</button>
                    </div>
                  }
                </div>
              }
            </div>

          </div>

          <!-- Footer: consumed toggle -->
          <div class="mp-footer">
            <button class="btn consume-btn" [class.consumed]="mealPanel()!.isConsumed"
              [disabled]="togglingMeal()"
              (click)="toggleConsumed()">
              {{ togglingMeal() ? '...' : mealPanel()!.isConsumed ? '✓ Refeição Consumida' : 'Marcar como Consumida' }}
            </button>
            @if (!mealPanel()!.isConsumed && panelRecipes().length > 0) {
              <span style="font-size:.72rem;color:var(--color-text-muted)">+10 XP</span>
            }
          </div>
        </div>
      </div>
    }

    <!-- XP pop -->
    @if (xpPopVisible()) {
      <div class="xp-pop" [style.left]="xpPopX + 'px'" [style.top]="xpPopY + 'px'">+{{ lastXp() }} XP ⚡</div>
    }
  `,
})
export class DashboardComponent implements OnInit, OnDestroy {
  private profileSvc   = inject(ProfileService);
  private routineSvc   = inject(RoutineService);
  private foodSvc      = inject(FoodService);
  readonly waterSvc    = inject(WaterService);
  private userSvc      = inject(UserService);
  private protocolSvc  = inject(ClinicalProtocolService);
  private recipeSvc    = inject(RecipeService);
  private scheduledSvc = inject(ScheduledMealService);

  readonly todayStr      = new Date().toISOString().slice(0, 10);
  readonly showWaterLogs = signal(false);

  blocks         = this.routineSvc.blocks;
  selectedDate   = this.routineSvc.selectedDate;
  metabolic      = this.profileSvc.metabolic;

  loading    = signal(true);
  generating = signal(false);
  toggling   = signal<string | null>(null);
  summary    = signal<DailySummary | null>(null);
  userName   = signal<string>('usuário');
  protocols  = signal<ClinicalProtocolWithLog[]>([]);

  /** All scheduled meals for the selected date — single source of truth. */
  scheduledMeals = signal<ScheduledMeal[]>([]);

  // ── Meal panel state ────────────────────────────────────────────────────────
  mealPanel        = signal<ScheduledMeal | null>(null);
  togglingMeal     = signal(false);
  availableRecipes = signal<Recipe[]>([]);
  recipeSearch     = '';

  // ── XP pop ─────────────────────────────────────────────────────────────────
  xpPopVisible = signal(false);
  lastXp       = signal(0);
  xpPopX = 0; xpPopY = 0;

  private clockInterval: ReturnType<typeof setInterval> | null = null;
  private clockMinute = signal(this.currentMinuteOfDay());

  // ── Computed ────────────────────────────────────────────────────────────────
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

  // ── Panel computed ──────────────────────────────────────────────────────────
  readonly panelRecipes = computed((): LinkedRecipeView[] => {
    const m = this.mealPanel();
    if (!m) return [];
    return (m.linkedRecipes ?? []).map(r => ({
      ...r,
      totalKcal:    r.kcalPerServing     * r.servings,
      totalProtein: r.proteinGPerServing * r.servings,
      totalCarbs:   r.carbsGPerServing   * r.servings,
      totalFat:     r.fatGPerServing     * r.servings,
    }));
  });
  readonly panelConsumedKcal    = computed(() => this.panelRecipes().reduce((s, r) => s + r.totalKcal,    0));
  readonly panelConsumedProtein = computed(() => this.panelRecipes().reduce((s, r) => s + r.totalProtein, 0));
  readonly panelConsumedCarbs   = computed(() => this.panelRecipes().reduce((s, r) => s + r.totalCarbs,   0));
  readonly panelConsumedFat     = computed(() => this.panelRecipes().reduce((s, r) => s + r.totalFat,     0));
  readonly panelBalance         = computed(() => this.panelConsumedKcal() - (this.mealPanel()?.caloricTarget ?? 0));
  readonly panelBalancePct      = computed(() => {
    const target = this.mealPanel()?.caloricTarget ?? 0;
    if (!target) return 0;
    return Math.min(100, (this.panelConsumedKcal() / target) * 100);
  });

  readonly panelSearchResults = computed((): Recipe[] => {
    const q = this.recipeSearch.toLowerCase().trim();
    if (q.length < 2) return [];
    return this.availableRecipes().filter(r => r.title.toLowerCase().includes(q));
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.userSvc.loadMe().subscribe({ next: (u: any) => { if (u.name) this.userName.set(u.name); }, error: () => {} });
    this.profileSvc.loadProfile().subscribe({ error: () => {} });
    this.profileSvc.loadMetabolic().subscribe({ error: () => {} });
    this.routineSvc.load().subscribe({ next: () => this.loading.set(false), error: () => this.loading.set(false) });
    this.foodSvc.getSummary(this.selectedDate()).subscribe({ next: s => this.summary.set(s), error: () => {} });
    this.waterSvc.loadToday().subscribe({ error: () => {} });
    this.loadProtocols();
    this.loadScheduledMeals(this.selectedDate());
    this.clockInterval = setInterval(() => this.clockMinute.set(this.currentMinuteOfDay()), 30_000);
  }

  ngOnDestroy(): void { if (this.clockInterval) clearInterval(this.clockInterval); }

  @HostListener('document:keydown.escape')
  onEsc() { this.closeMealPanel(); }

  // ── Data loading ─────────────────────────────────────────────────────────────
  private loadScheduledMeals(date: string): void {
    this.scheduledSvc.list(date).subscribe({
      next: meals => this.scheduledMeals.set(meals),
      error: () => {},
    });
  }

  private loadProtocols(): void {
    this.protocolSvc.logsForDate(this.selectedDate()).subscribe({
      next: p => this.protocols.set(p.filter(x => x.isActive)),
      error: () => {},
    });
  }

  private reloadSummary(): void {
    this.foodSvc.getSummary(this.selectedDate()).subscribe({ next: s => this.summary.set(s), error: () => {} });
  }

  // ── Routine ──────────────────────────────────────────────────────────────────
  generateRoutine(): void {
    this.generating.set(true);
    this.routineSvc.generate(this.selectedDate()).subscribe({
      next: () => {
        this.generating.set(false);
        this.loadProtocols();
        this.loadScheduledMeals(this.selectedDate());
      },
      error: () => this.generating.set(false),
    });
  }

  changeDate(delta: number): void {
    const d = new Date(this.selectedDate()); d.setDate(d.getDate() + delta);
    const next = d.toISOString().slice(0, 10);
    this.routineSvc.setDate(next); this.loading.set(true);
    this.routineSvc.load(next).subscribe({ next: () => this.loading.set(false), error: () => this.loading.set(false) });
    this.foodSvc.getSummary(next).subscribe({ next: s => this.summary.set(s), error: () => {} });
    this.protocolSvc.logsForDate(next).subscribe({ next: p => this.protocols.set(p.filter(x => x.isActive)), error: () => {} });
    this.loadScheduledMeals(next);
    this.closeMealPanel();
  }

  goToday(): void { this.routineSvc.setDate(this.todayStr); this.changeDate(0); }

  // ── Protocol toggle ──────────────────────────────────────────────────────────
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

  // ── Meal block helpers ───────────────────────────────────────────────────────
  private getScheduledMeal(block: RoutineBlock): ScheduledMeal | undefined {
    const id = block.metadata?.['scheduledMealId'] as string | undefined;
    return id ? this.scheduledMeals().find(m => m.id === id) : undefined;
  }

  mealConsumed(block: RoutineBlock): boolean {
    return this.getScheduledMeal(block)?.isConsumed ?? false;
  }

  mealLinkedRecipes(block: RoutineBlock): LinkedRecipe[] {
    return this.getScheduledMeal(block)?.linkedRecipes ?? [];
  }

  mealConsumedKcal(block: RoutineBlock): number {
    const linked = this.mealLinkedRecipes(block);
    return linked.reduce((s, r) => s + r.kcalPerServing * r.servings, 0);
  }

  mealBalancePct(block: RoutineBlock): number {
    const target = Number(block.caloricTarget) || 0;
    if (!target) return 0;
    return Math.min(100, (this.mealConsumedKcal(block) / target) * 100);
  }

  mealOverflowPct(block: RoutineBlock): number {
    const target = Number(block.caloricTarget) || 0;
    const over   = this.mealConsumedKcal(block) - target;
    if (over <= 0 || !target) return 0;
    return Math.min(40, (over / target) * 100);
  }

  // ── Meal panel ───────────────────────────────────────────────────────────────
  openMealPanel(block: RoutineBlock): void {
    const meal = this.getScheduledMeal(block);
    if (!meal) return;
    this.mealPanel.set({ ...meal });
    this.recipeSearch = '';
    // Load user's own recipes + community feed for the picker (combine & dedupe)
    this.recipeSvc.listMine().subscribe({
      next: mine => {
        const existing = this.availableRecipes();
        const ids = new Set(existing.map(r => r.id));
        this.availableRecipes.set([...mine, ...existing.filter(r => !ids.has(r.id))]);
      },
      error: () => {},
    });
    this.recipeSvc.feed(1, 30).subscribe({
      next: feed => {
        const existing = this.availableRecipes();
        const ids = new Set(existing.map(r => r.id));
        this.availableRecipes.set([...existing, ...feed.filter(r => !ids.has(r.id))]);
      },
      error: () => {},
    });
  }

  closeMealPanel(): void { this.mealPanel.set(null); }

  addRecipe(recipe: Recipe): void {
    const meal = this.mealPanel();
    if (!meal) return;
    this.scheduledSvc.linkRecipe(meal.id, { recipeId: recipe.id, servings: 1 }).subscribe({
      next: updated => this.refreshMealInPanel(updated),
      error: () => {},
    });
  }

  removeRecipe(recipeId: string): void {
    const meal = this.mealPanel();
    if (!meal) return;
    this.scheduledSvc.unlinkRecipe(meal.id, recipeId).subscribe({
      next: updated => this.refreshMealInPanel(updated),
      error: () => {},
    });
  }

  changeServings(recipe: LinkedRecipeView, delta: number): void {
    const meal = this.mealPanel();
    if (!meal) return;
    const newServings = Math.max(0.5, recipe.servings + delta);
    // Remove then re-add with correct servings (simplest: remove + re-link is complex;
    // instead patch linkedRecipes locally and re-save via unlink + link)
    // For best UX: patch the local signal immediately, then sync to API.
    const updated: ScheduledMeal = {
      ...meal,
      linkedRecipes: (meal.linkedRecipes ?? []).map(r =>
        r.recipeId === recipe.recipeId ? { ...r, servings: newServings } : r
      ),
    };
    this.mealPanel.set(updated);
    // Sync to backend: unlink + re-link with new servings
    this.scheduledSvc.unlinkRecipe(meal.id, recipe.recipeId).subscribe({
      next: () => {
        this.scheduledSvc.linkRecipe(meal.id, { recipeId: recipe.recipeId, servings: newServings }).subscribe({
          next: final => this.refreshMealInPanel(final),
          error: () => {},
        });
      },
      error: () => {},
    });
  }

  toggleConsumed(): void {
    const meal = this.mealPanel();
    if (!meal) return;
    this.togglingMeal.set(true);
    this.scheduledSvc.toggle(meal.id).subscribe({
      next: result => {
        this.togglingMeal.set(false);
        this.refreshMealInPanel(result.meal);
        this.reloadSummary();
        if (result.xpGained > 0) this.showXpPop(result.xpGained);
      },
      error: () => this.togglingMeal.set(false),
    });
  }

  /** Update the open panel and the scheduledMeals list from a fresh server record. */
  private refreshMealInPanel(updated: ScheduledMeal): void {
    this.mealPanel.set({ ...updated });
    this.scheduledMeals.update(list =>
      list.map(m => m.id === updated.id ? updated : m)
    );
    this.reloadSummary();
  }

  // ── Misc helpers ─────────────────────────────────────────────────────────────
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
