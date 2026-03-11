import {
  Component, inject, signal, computed, OnInit, OnDestroy, HostListener,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject, switchMap, of } from 'rxjs';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DailyMissionsWidgetComponent } from '../../shared/components/daily-missions-widget.component';

import { ProfileService }           from '../../core/services/profile.service';
import { RoutineService }            from '../../core/services/routine.service';
import { FoodService }               from '../../core/services/food.service';
import { UserService }               from '../../core/services/user.service';
import { WaterService }              from '../../core/services/water.service';
import { ClinicalProtocolService }   from '../../core/services/clinical-protocol.service';
import { RecipeService }             from '../../core/services/recipe.service';
import { ScheduledMealService }      from '../../core/services/scheduled-meal.service';
import { RecipeScheduleService }     from '../../core/services/recipe-schedule.service';
import { CheckInService }            from '../../core/services/check-in.service';
import { CopilotService }            from '../../core/services/copilot.service';

import {
  RoutineBlock, BlockType, DailySummary, ClinicalProtocolWithLog,
  ScheduledMeal, LinkedRecipe, Recipe, RecipeFeedItem, RecipeSchedule,
  BlockCompleteResult, FeedbackResponse, CreateBlockDto,
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
  study:        { icon: '📚', color: '#0891b2', bg: '#e0f7fa', label: 'Estudo' },
};

const PROTOCOL_ICON: Record<string, string> = {
  SUPLEMENTO: '🧴', REMEDIO_CONTROLADO: '💊', TRT: '💉',
  HORMONIO_FEMININO: '🌸', SONO: '😴',
};

/** Short labels for days of week in Portuguese (0=Sun … 6=Sat) */
const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

/** XP awarded for completing each completable block type */
const BLOCK_XP: Partial<Record<BlockType, number>> = {
  exercise:     25,
  water:         5,
  sun_exposure: 10,
  sleep:        10,
  work:          5,
  free:          5,
  custom:        5,
};

/** Block types that support user completion (excludes meal and medication — handled separately) */
const COMPLETABLE_TYPES = new Set<BlockType>([
  'exercise', 'water', 'sun_exposure', 'sleep', 'work', 'free', 'custom', 'study',
]);

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
  imports: [DecimalPipe, DatePipe, RouterLink, WaterTrackerComponent, FormsModule, DailyMissionsWidgetComponent],
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
    /* ── Canvas bar ───────────────────────────────────────────────────────────── */
    .canvas-bar { grid-column: 1/-1; display: flex; align-items: center; justify-content: space-between; gap: 1rem; background: var(--color-surface); border: 1.5px solid var(--color-border); border-radius: var(--radius-md); padding: .75rem 1.25rem;
      .cb-info { h3 { font-size: .9rem; font-weight: 700; } p { font-size: .75rem; color: var(--color-text-muted); } }
      .cb-actions { display: flex; gap: .5rem; flex-shrink: 0; flex-wrap: wrap; align-items: center; }
      .add-event-btn { display: flex; align-items: center; gap: .375rem; background: var(--color-primary); color: #fff; border: none; padding: .5rem 1.125rem; border-radius: var(--radius-sm); cursor: pointer; font-weight: 700; font-size: .82rem; white-space: nowrap; transition: .15s;
        &:hover { filter: brightness(1.1); }
      }
    }
    /* ── Event creation modal ─────────────────────────────────────────────────── */
    .event-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 400; display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .event-modal { background: var(--color-surface); border-radius: var(--radius-md); padding: 1.5rem; width: 100%; max-width: 440px; box-shadow: var(--shadow-lg);
      h3 { font-size: 1rem; font-weight: 700; margin-bottom: 1.25rem; }
      .em-section-label { font-size: .72rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: .04em; margin-bottom: .5rem; }
      .em-type-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; margin-bottom: 1.25rem;
        .em-type-btn { display: flex; flex-direction: column; align-items: center; gap: .25rem; padding: .625rem .375rem; border-radius: var(--radius-sm); border: 1.5px solid var(--color-border); background: var(--color-surface-2); cursor: pointer; transition: .15s;
          .et-icon { font-size: 1.25rem; }
          .et-label { font-size: .68rem; font-weight: 700; color: var(--color-text-muted); }
          &.selected { border-color: var(--color-primary); background: var(--color-primary-light); .et-label { color: var(--color-primary-dark); } }
          &:hover:not(.selected) { border-color: var(--color-border); background: var(--color-surface); }
        }
      }
      .em-fields { display: flex; flex-direction: column; gap: .75rem; margin-bottom: 1.25rem;
        label { font-size: .78rem; font-weight: 600; color: var(--color-text-muted); display: flex; flex-direction: column; gap: .25rem; input { font-size: .875rem; } }
        .em-time-row { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem; }
      }
      .em-recurrence { margin-bottom: 1.25rem;
        .em-days-row { display: flex; gap: .375rem; margin-top: .5rem; flex-wrap: wrap;
          button { width: 34px; height: 34px; border-radius: 50%; font-size: .7rem; font-weight: 700; border: 1.5px solid var(--color-border); background: var(--color-surface-2); cursor: pointer; transition: .15s;
            &.selected { background: var(--color-primary); border-color: var(--color-primary); color: #fff; }
            &:hover:not(.selected) { background: var(--color-border); }
          }
        }
        .em-recurrence-hint { font-size: .72rem; color: var(--color-text-muted); margin-top: .375rem; }
      }
      .em-actions { display: flex; gap: .625rem;
        button { flex: 1; }
      }
    }
    /* ── Copilot feedback panel ───────────────────────────────────────────────── */
    .copilot-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1.25rem;
      .cop-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: .875rem;
        .cop-title { font-size: .875rem; font-weight: 700; }
        .cop-score { font-size: .72rem; font-weight: 700; padding: .15rem .55rem; border-radius: 99px;
          &.score-high  { background: rgba(34,197,94,.15); color: #15803d; }
          &.score-mid   { background: rgba(234,179,8,.15); color: #92400e; }
          &.score-low   { background: rgba(239,68,68,.15); color: #dc2626; }
        }
      }
      .cop-loading { display: flex; align-items: center; gap: .5rem; font-size: .78rem; color: var(--color-text-muted); padding: .5rem 0; }
      .cop-items { display: flex; flex-direction: column; gap: .5rem; }
      .cop-item { display: flex; align-items: flex-start; gap: .5rem; padding: .5rem .625rem; border-radius: var(--radius-sm); font-size: .78rem;
        &.ok    { background: rgba(34,197,94,.07); border-left: 3px solid #22c55e; }
        &.warn  { background: rgba(234,179,8,.07);  border-left: 3px solid #eab308; }
        &.error { background: rgba(239,68,68,.07);  border-left: 3px solid #ef4444; }
        .cop-icon { font-size: .9rem; flex-shrink: 0; margin-top: .05rem; }
        .cop-msg  { line-height: 1.4; color: var(--color-text); }
      }
      .cop-refresh { display: block; width: 100%; margin-top: .875rem; font-size: .75rem; color: var(--color-text-muted); background: none; border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: .375rem; cursor: pointer; transition: .15s;
        &:hover { background: var(--color-surface-2); }
      }
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
      &.block-completed { background: rgba(34,197,94,.05); border-left-color: #22c55e !important; }
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
        &.checked { background: #22c55e; border-color: #22c55e; color: #fff; }
        &.checked-purple { background: #7c3aed; border-color: #7c3aed; color: #fff; }
        &:hover:not(.checked):not(.checked-purple) { border-color: #7c3aed; background: rgba(124,58,237,.08); }
      }
    }

    /* ── Inline recipe picker (diet view) ───────────────────────────────────── */
    .inline-recipe-picker { margin-top: .5rem; border-top: 1px solid var(--color-border); padding-top: .5rem;
      .irp-input-row { display:flex; gap:.375rem; margin-bottom:.375rem;
        input { flex:1; font-size:.78rem; padding:.3rem .6rem; }
        button { font-size:.72rem; padding:.3rem .6rem; white-space:nowrap; }
      }
      .irp-results { display:flex; flex-direction:column; gap:.25rem; max-height:200px; overflow-y:auto; }
      .irp-item { display:flex; align-items:center; gap:.5rem; padding:.375rem .5rem; border-radius:var(--radius-sm); border:1px solid var(--color-border); background:var(--color-surface);
        &:hover { background:var(--color-surface-2); }
        .irp-info { flex:1; min-width:0;
          .irp-title { font-size:.78rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
          .irp-kcal  { font-size:.65rem; color:var(--color-text-muted); }
        }
        .irp-add { font-size:.7rem; font-weight:700; padding:.2rem .5rem; border-radius:99px; border:1.5px solid var(--color-primary-light); background:none; cursor:pointer; color:var(--color-primary); white-space:nowrap;
          &:hover { background:var(--color-primary); color:#fff; }
        }
      }
      .irp-empty { font-size:.75rem; color:var(--color-text-muted); text-align:center; padding:.5rem 0; }
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

    /* ── Remaining macros section ────────────────────────────────────────────── */
    .remaining-section {
      margin-top: .875rem; padding-top: .875rem; border-top: 1px solid var(--color-border);
      .rem-title { font-size: .72rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: .04em; margin-bottom: .5rem; }
      .rem-pills { display: flex; flex-wrap: wrap; gap: .375rem; }
      .rem-pill { display: flex; align-items: center; gap: .3rem; font-size: .72rem; font-weight: 600; padding: .25rem .6rem; border-radius: 99px; border: 1.5px solid var(--color-border);
        &.positive { background: rgba(34,197,94,.08); border-color: rgba(34,197,94,.3); color: #15803d; }
        &.negative { background: rgba(239,68,68,.08); border-color: rgba(239,68,68,.3); color: #dc2626; }
        &.neutral  { background: var(--color-surface-2); color: var(--color-text-muted); }
      }
    }

    /* ── Meal grouping (diet view) ───────────────────────────────────────────── */
    .view-toggle { display:flex; gap:.375rem; margin-bottom:1rem;
      button { flex:1; padding:.375rem; font-size:.78rem; font-weight:600; border-radius:var(--radius-sm);
        border:1.5px solid var(--color-border); background:var(--color-surface); color:var(--color-text-muted);
        cursor:pointer; transition:.15s;
        &.active { background:var(--color-primary); border-color:var(--color-primary); color:#fff; }
        &:hover:not(.active) { background:var(--color-border); }
      }
    }
    .diet-view { display:flex; flex-direction:column; gap:.75rem; }
    .diet-meal-group {
      background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-md);
      border-left:3px solid var(--color-border); overflow:hidden; transition:.15s;
      &.consumed { border-left-color: #22c55e; }
      &.has-recipes:not(.consumed) { border-left-color: #f59e0b; }

      .dmg-header { display:flex; align-items:center; gap:.625rem; padding:.625rem .875rem; cursor:pointer; transition:.15s;
        &:hover { background: var(--color-surface-2); }
        .dmg-icon { width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:.9rem; flex-shrink:0; }
        .dmg-info { flex:1; min-width:0;
          .dmg-name { font-size:.82rem; font-weight:700; }
          .dmg-sub  { font-size:.68rem; color:var(--color-text-muted); margin-top:.1rem; }
        }
        .dmg-progress { text-align:right; flex-shrink:0;
          .dmg-pct { font-size:.72rem; font-weight:700; }
          .dmg-kcal { font-size:.65rem; color:var(--color-text-muted); }
        }
        .dmg-chevron { font-size:.7rem; color:var(--color-text-subtle); transition:transform .2s; flex-shrink:0;
          &.open { transform:rotate(180deg); }
        }
      }

      .dmg-bar { height:3px; background:var(--color-border);
        .dmg-bar-fill { height:100%; border-radius:0; transition:width .4s; }
      }

      .dmg-recipes { padding:.5rem .875rem .75rem; display:flex; flex-direction:column; gap:.375rem; border-top:1px solid var(--color-border); }
      .dmg-recipe-row { display:flex; align-items:center; gap:.5rem; padding:.375rem .5rem; border-radius:var(--radius-sm); background:var(--color-surface-2);
        .drr-title { flex:1; font-size:.78rem; font-weight:600; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .drr-kcal { font-size:.68rem; color:var(--color-text-muted); flex-shrink:0; }
        .drr-srv { display:flex; align-items:center; gap:.25rem; flex-shrink:0;
          button { width:20px; height:20px; border-radius:50%; border:1.5px solid var(--color-border); background:var(--color-surface); cursor:pointer; font-size:.8rem; line-height:1; display:flex; align-items:center; justify-content:center;
            &:hover { background:var(--color-border); } }
          span { font-size:.75rem; font-weight:700; min-width:18px; text-align:center; }
        }
        .drr-remove { background:none; border:none; cursor:pointer; color:var(--color-text-subtle); font-size:.8rem; &:hover { color:var(--color-danger); } }
      }
      .dmg-no-recipes { font-size:.75rem; color:var(--color-text-muted); padding:.5rem .5rem .25rem; border-top:1px solid var(--color-border); }
      .dmg-actions { display:flex; gap:.375rem; margin-top:.375rem;
        button { flex:1; font-size:.72rem; padding:.25rem .5rem; border-radius:var(--radius-sm); }
      }
    }

    /* ── Clone modal ─────────────────────────────────────────────────────────── */
    .clone-overlay { position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:300; display:flex; align-items:center; justify-content:center; padding:1rem; }
    .clone-modal { background:var(--color-surface); border-radius:var(--radius-md); padding:1.5rem; width:100%; max-width:380px; box-shadow:var(--shadow-lg);
      h3 { font-size:1rem; font-weight:700; margin-bottom:1rem; }
      .clone-fields { display:flex; flex-direction:column; gap:.75rem; margin-bottom:1.25rem;
        label { font-size:.78rem; font-weight:600; color:var(--color-text-muted); display:flex; flex-direction:column; gap:.25rem;
          input { font-size:.875rem; }
        }
      }
      .clone-actions { display:flex; gap:.625rem; }
    }

    /* ── Repeat picker (inside meal panel) ───────────────────────────────────── */
    .repeat-section { border-top:1px solid var(--color-border); padding-top:.75rem; margin-top:.25rem;
      .rp-title { font-size:.75rem; font-weight:700; color:var(--color-text-muted); margin-bottom:.5rem; }
      .rp-recipe-row { display:flex; align-items:center; gap:.5rem; margin-bottom:.625rem;
        .rpr-name { flex:1; font-size:.78rem; font-weight:600; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .rpr-days { display:flex; gap:.2rem; flex-wrap:wrap;
          button { width:28px; height:28px; border-radius:50%; font-size:.62rem; font-weight:700; border:1.5px solid var(--color-border); background:var(--color-surface); cursor:pointer; transition:.15s;
            &.selected { background:var(--color-primary); border-color:var(--color-primary); color:#fff; }
            &:hover:not(.selected) { background:var(--color-border); }
          }
        }
        .rpr-save { font-size:.7rem; padding:.2rem .5rem; border-radius:99px; }
      }
    }

    /* ── XP pop ──────────────────────────────────────────────────────────────── */
    @keyframes xpPop { 0% { transform:scale(1);opacity:1; } 50% { transform:scale(1.5) translateY(-12px);opacity:1; } 100% { transform:scale(1) translateY(-28px);opacity:0; } }
    .xp-pop { position:fixed;pointer-events:none;z-index:999;font-size:1.1rem;font-weight:800;color:#7c3aed;animation:xpPop .9s ease forwards; }

    /* ── Photo share prompt ──────────────────────────────────────────────────── */
    .photo-overlay {
      position: fixed; inset: 0; z-index: 900;
      background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center;
      padding: 1rem;
    }
    .photo-modal {
      background: var(--color-surface); border-radius: var(--radius-md);
      padding: 1.5rem; width: 100%; max-width: 400px;
      box-shadow: 0 8px 40px rgba(0,0,0,.25);

      h3 { font-size: 1.05rem; font-weight: 800; margin-bottom: .25rem; }
      .subtitle { font-size: .82rem; color: var(--color-text-muted); margin-bottom: 1.25rem; }

      .photo-preview {
        width: 100%; height: 180px; object-fit: cover;
        border-radius: var(--radius-sm); margin-bottom: .75rem;
      }
      .photo-pick-btn {
        display: block; width: 100%; padding: .6rem; border: 2px dashed var(--color-border);
        border-radius: var(--radius-sm); background: var(--color-surface-2);
        text-align: center; cursor: pointer; font-size: .82rem; color: var(--color-text-muted);
        margin-bottom: .75rem; transition: .15s;
        &:hover { border-color: var(--color-primary); color: var(--color-primary); }
      }
      .caption-input {
        width: 100%; padding: .5rem .75rem; border: 1.5px solid var(--color-border);
        border-radius: var(--radius-sm); font-size: .82rem; margin-bottom: 1rem;
        background: var(--color-surface-2);
        &:focus { outline: none; border-color: var(--color-primary); }
      }
      .share-toggle {
        display: flex; align-items: center; gap: .5rem;
        font-size: .82rem; color: var(--color-text-muted); margin-bottom: 1rem;
        input { width: 16px; height: 16px; cursor: pointer; }
      }
      .photo-actions {
        display: flex; gap: .625rem;
        .btn-skip  { flex: 1; padding: .625rem; border-radius: var(--radius-sm);
          border: 1.5px solid var(--color-border); background: none;
          font-size: .875rem; cursor: pointer; color: var(--color-text-muted);
          &:hover { background: var(--color-surface-2); } }
        .btn-share { flex: 1; padding: .625rem; border-radius: var(--radius-sm);
          border: none; background: var(--color-primary); color: #fff;
          font-size: .875rem; font-weight: 700; cursor: pointer;
          &:disabled { opacity: .5; cursor: not-allowed; } }
      }
      .xp-hint {
        text-align: center; font-size: .75rem; color: #7c3aed; font-weight: 700;
        margin-top: .75rem;
      }
    }

    /* ── Anti-cheat toast ────────────────────────────────────────────────────── */
    .xp-block-toast {
      position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%);
      z-index: 1000; background: #1e293b; color: #f1f5f9;
      padding: .75rem 1.25rem; border-radius: var(--radius-md);
      font-size: .82rem; max-width: 340px; text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,.3);
      animation: toastIn .25s ease; pointer-events: none;
      display: flex; align-items: center; gap: .5rem;
    }
    @keyframes toastIn { from { opacity:0; transform: translateX(-50%) translateY(12px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }

    /* ── Check-in banner ─────────────────────────────────────────────────────── */
    .checkin-banner {
      grid-column: 1 / -1;
      display: flex; align-items: center; gap: 1rem;
      background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
      color: #fff; border-radius: var(--radius-md); padding: .875rem 1.25rem;
      animation: fadeIn .4s ease;

      .cb-emoji { font-size: 1.75rem; flex-shrink: 0; }
      .cb-text  { flex: 1;
        h3 { font-size: .95rem; font-weight: 700; color: #fff; }
        p  { font-size: .78rem; color: rgba(255,255,255,.8); margin-top: .1rem; }
      }
      .cb-actions { display: flex; gap: .5rem; align-items: center; flex-shrink: 0; }
      .cb-btn {
        background: rgba(255,255,255,.2); border: 1.5px solid rgba(255,255,255,.4);
        color: #fff; padding: .4rem 1rem; border-radius: var(--radius-sm);
        cursor: pointer; font-weight: 600; font-size: .8rem; text-decoration: none;
        white-space: nowrap; transition: background .15s;
        &:hover { background: rgba(255,255,255,.35); }
      }
      .cb-dismiss {
        background: none; border: none; cursor: pointer; color: rgba(255,255,255,.6);
        font-size: 1.1rem; line-height: 1; padding: .2rem;
        &:hover { color: #fff; }
      }
    }
    @keyframes fadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:none; } }
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

      <!-- ── Check-in overdue banner ─────────────────────────────────────── -->
      @if (showCheckInBanner()) {
        <div class="checkin-banner">
          <span class="cb-emoji">📸</span>
          <div class="cb-text">
            <h3>Chegou o dia do seu Check-in Semanal!</h3>
            <p>Registre seu peso e adesão para que o Copiloto possa analisar sua evolução.</p>
          </div>
          <div class="cb-actions">
            <a class="cb-btn" routerLink="/check-in">Fazer Check-in</a>
            <button class="cb-dismiss" (click)="dismissCheckInBanner()" title="Dispensar">✕</button>
          </div>
        </div>
      }

      <!-- ── Canvas bar ──────────────────────────────────────────────────── -->
      <div class="canvas-bar">
        <div class="cb-info">
          @if (blocks().length === 0 && !loading()) {
            <h3>🗺️ Canvas em branco</h3>
            <p>Adicione eventos para montar sua agenda. O copiloto irá te orientar.</p>
          } @else {
            <h3>🗺️ Canvas do dia · {{ blocks().length }} blocos</h3>
            <p>{{ doneProtocols() }}/{{ totalProtocols() }} protocolos · {{ waterBlocks() }} lembretes de água</p>
          }
        </div>
        <div class="cb-actions">
          @if (scheduledMeals().length > 0) {
            <button class="btn btn-secondary btn-sm" (click)="applySchedules()" [disabled]="applyingSchedules()" title="Auto-vincular receitas repetidas deste dia da semana">{{ applyingSchedules() ? '⏳...' : '🔁 Repetições' }}</button>
            <button class="btn btn-secondary btn-sm" (click)="openCloneModal()">📋 Clonar Dieta</button>
          }
          <button class="add-event-btn" (click)="openAddEventModal()">+ Adicionar Evento</button>
        </div>
      </div>

      <!-- ── Event creation modal ──────────────────────────────────────────── -->
      @if (addEventModal()) {
        <div class="event-overlay" (click)="closeAddEventModal()">
          <div class="event-modal" (click)="$event.stopPropagation()">
            <h3>Novo Evento</h3>

            <div class="em-section-label">Tipo de evento</div>
            <div class="em-type-grid">
              @for (t of eventTypeOptions; track t.type) {
                <button class="em-type-btn" [class.selected]="newEvent.type === t.type" (click)="newEvent.type = t.type" type="button">
                  <span class="et-icon">{{ t.icon }}</span>
                  <span class="et-label">{{ t.label }}</span>
                </button>
              }
            </div>

            <div class="em-fields">
              <label>
                Título / Descrição
                <input type="text" [(ngModel)]="newEvent.label" placeholder="Ex: Treino de força, Almoço..." />
              </label>
              <div class="em-time-row">
                <label>Início <input type="time" [(ngModel)]="newEvent.startTime" /></label>
                <label>Fim    <input type="time" [(ngModel)]="newEvent.endTime" /></label>
              </div>
            </div>

            <div class="em-recurrence">
              <div class="em-section-label">Recorrência semanal</div>
              <div class="em-days-row">
                @for (d of allDays; track d) {
                  <button type="button" [class.selected]="newEvent.daysOfWeek.includes(d)" (click)="toggleNewEventDay(d)">{{ dayShort(d) }}</button>
                }
              </div>
              <div class="em-recurrence-hint">
                @if (newEvent.daysOfWeek.length === 0) {
                  Sem dias marcados — salvo apenas para {{ selectedDate() }}.
                } @else {
                  Salvo como recorrente toda semana nos dias marcados.
                }
              </div>
            </div>

            <div class="em-actions">
              <button class="btn btn-secondary" (click)="closeAddEventModal()" type="button">Cancelar</button>
              <button class="btn btn-primary" (click)="saveNewEvent()" type="button" [disabled]="savingEvent()">
                {{ savingEvent() ? 'Salvando...' : 'Salvar Evento' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ── Timeline / Diet view ────────────────────────────────────────── -->
      <div class="timeline-panel">
        <div class="panel-title" style="display:flex;align-items:center;justify-content:space-between">
          <span>{{ dietView() ? '🍽️ Refeições do Dia' : '📅 Agenda do Dia' }}</span>
        </div>

        <!-- View toggle -->
        @if (!loading() && (timeGroups().length > 0 || scheduledMeals().length > 0)) {
          <div class="view-toggle">
            <button [class.active]="!dietView()" (click)="dietView.set(false)">📅 Agenda completa</button>
            <button [class.active]="dietView()" (click)="dietView.set(true)">🍽️ Visão Dieta</button>
          </div>
        }

        @if (loading()) {
          <div style="text-align:center;padding:3rem;color:var(--color-text-muted)"><div class="spinner" style="margin:0 auto 1rem"></div>Carregando...</div>

        } @else if (dietView()) {
          <!-- ── Diet grouped view ──────────────────────────────────────── -->
          @if (scheduledMeals().length === 0) {
            <div style="text-align:center;padding:3rem;color:var(--color-text-muted);font-size:.875rem">
              Nenhuma refeição planejada.<br>Clique em <strong>+ Adicionar Evento</strong> para criar.
            </div>
          } @else {
            <div class="diet-view">
              @for (meal of scheduledMeals(); track meal.id) {
                <div class="diet-meal-group" [class.consumed]="meal.isConsumed" [class.has-recipes]="(meal.linkedRecipes?.length ?? 0) > 0">
                  <div class="dmg-header" (click)="toggleDietGroup(meal.id)">
                    <div class="dmg-icon" style="background:#fef3c7;color:#b45309">🍽️</div>
                    <div class="dmg-info">
                      <div class="dmg-name">{{ meal.name }}</div>
                      <div class="dmg-sub">
                        {{ meal.scheduledTime }}
                        @if (meal.caloricTarget) { · alvo {{ meal.caloricTarget | number:'1.0-0' }} kcal }
                        @if (meal.isConsumed) { · <span style="color:#16a34a;font-weight:700">✓ consumida</span> }
                      </div>
                    </div>
                    <div class="dmg-progress">
                      @if ((meal.linkedRecipes?.length ?? 0) > 0) {
                        <div class="dmg-pct" [style.color]="mealKcalFromLinked(meal) > (meal.caloricTarget ?? 0) ? '#dc2626' : '#16a34a'">
                          {{ mealKcalFromLinked(meal) | number:'1.0-0' }} kcal
                        </div>
                        <div class="dmg-kcal">/ {{ meal.caloricTarget | number:'1.0-0' }} alvo</div>
                      }
                    </div>
                    <span class="dmg-chevron" [class.open]="isDietGroupOpen(meal.id)">▼</span>
                  </div>

                  <!-- Progress bar -->
                  @if ((meal.linkedRecipes?.length ?? 0) > 0 && meal.caloricTarget) {
                    <div class="dmg-bar">
                      <div class="dmg-bar-fill"
                        [style.width.%]="mealBalancePctById(meal)"
                        [style.background]="mealKcalFromLinked(meal) > meal.caloricTarget! ? '#ef4444' : '#22c55e'">
                      </div>
                    </div>
                  }

                  <!-- Expanded recipes list -->
                  @if (isDietGroupOpen(meal.id)) {
                    <div class="dmg-recipes">
                      @if ((meal.linkedRecipes?.length ?? 0) === 0) {
                        <div class="dmg-no-recipes">Nenhuma receita vinculada ainda.</div>
                      } @else {
                        @for (r of meal.linkedRecipes!; track r.recipeId) {
                          <div class="dmg-recipe-row">
                            <span class="drr-title">{{ r.title }}</span>
                            <span class="drr-kcal">{{ r.kcalPerServing * r.servings | number:'1.0-0' }} kcal</span>
                            <div class="drr-srv">
                              <button (click)="changeServingsInline(meal, r, -0.5); $event.stopPropagation()" [disabled]="r.servings <= 0.5">−</button>
                              <span>×{{ r.servings }}</span>
                              <button (click)="changeServingsInline(meal, r, 0.5); $event.stopPropagation()">+</button>
                            </div>
                            <button class="drr-remove" (click)="removeRecipeFromMeal(meal, r.recipeId); $event.stopPropagation()" title="Remover">✕</button>
                          </div>
                        }
                      }
                      <!-- Inline recipe picker -->
                      @if (inlinePickerMealId() === meal.id) {
                        <div class="inline-recipe-picker" (click)="$event.stopPropagation()">
                          <div class="irp-input-row">
                            <input type="text" placeholder="Buscar receita por nome..." [(ngModel)]="inlineSearch" (input)="onInlineSearch()" autofocus />
                            <button class="btn btn-secondary" (click)="closeInlinePicker()">✕</button>
                          </div>
                          @if (inlinePickerResults().length > 0) {
                            <div class="irp-results">
                              @for (r of inlinePickerResults(); track r.id) {
                                <div class="irp-item">
                                  <div class="irp-info">
                                    <div class="irp-title">{{ r.title }}</div>
                                    <div class="irp-kcal">{{ r.kcal | number:'1.0-0' }} kcal · P:{{ r.proteinG | number:'1.0-0' }}g C:{{ r.carbsG | number:'1.0-0' }}g G:{{ r.fatG | number:'1.0-0' }}g</div>
                                  </div>
                                  <button class="irp-add" (click)="addRecipeInline(meal, r)">+ Add</button>
                                </div>
                              }
                            </div>
                          } @else if (inlineSearch.length > 1) {
                            <div class="irp-empty">Nenhuma receita encontrada.</div>
                          } @else {
                            <div class="irp-results">
                              @for (r of availableRecipes().slice(0, 6); track r.id) {
                                <div class="irp-item">
                                  <div class="irp-info">
                                    <div class="irp-title">{{ r.title }}</div>
                                    <div class="irp-kcal">{{ r.kcal | number:'1.0-0' }} kcal · P:{{ r.proteinG | number:'1.0-0' }}g C:{{ r.carbsG | number:'1.0-0' }}g G:{{ r.fatG | number:'1.0-0' }}g</div>
                                  </div>
                                  <button class="irp-add" (click)="addRecipeInline(meal, r)">+ Add</button>
                                </div>
                              }
                              @if (availableRecipes().length === 0) {
                                <div class="irp-empty">Carregando receitas...</div>
                              }
                            </div>
                          }
                        </div>
                      }

                      <div class="dmg-actions">
                        <button class="btn btn-secondary" (click)="openInlinePicker(meal); $event.stopPropagation()">
                          {{ inlinePickerMealId() === meal.id ? '🔍 Buscando...' : '+ Receita' }}
                        </button>
                        @if (!meal.isConsumed) {
                          <button class="btn" (click)="toggleConsumedById(meal); $event.stopPropagation()" [disabled]="togglingMeal()">
                            {{ togglingMeal() ? '...' : '✓ Consumida' }}
                          </button>
                        } @else {
                          <button class="btn btn-secondary" (click)="toggleConsumedById(meal); $event.stopPropagation()" [disabled]="togglingMeal()">
                            ↩ Desfazer
                          </button>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }

        } @else if (timeGroups().length === 0) {
          <div style="text-align:center;padding:3rem;color:var(--color-text-muted);font-size:.875rem">Nenhum bloco ainda.<br>Clique em <strong>+ Adicionar Evento</strong> para começar a montar sua agenda.</div>
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
                      [class.block-completed]="isBlockCompleted(b)"
                      [class.meal-clickable]="b.type === 'meal'"
                      [style.border-left-color]="blockBorderColor(b)"
                      (click)="b.type === 'meal' ? openMealPanel(b) : null">

                      <div class="bc-row">
                        <div class="bc-icon" [style.background]="blockMeta(b.type).bg" [style.color]="isBlockCompleted(b) ? '#16a34a' : blockMeta(b.type).color">{{ protocolIcon(b) }}</div>
                        <div class="bc-body">
                          <div class="bc-label" [style.text-decoration]="isBlockCompleted(b) ? 'line-through' : 'none'">{{ b.label }}</div>
                          <div class="bc-sub">{{ b.startTime }}–{{ b.endTime }}
                            @if (b.caloricTarget) { &nbsp;·&nbsp;{{ b.caloricTarget | number:'1.0-0' }} kcal alvo }
                            @if (b.waterMl)       { &nbsp;·&nbsp;{{ b.waterMl | number:'1.0-0' }} ml }
                            @if (mealConsumed(b)) { &nbsp;· <span style="color:#16a34a;font-weight:700">✓ consumida</span> }
                            @if (isBlockCompleted(b) && b.type !== 'meal' && b.type !== 'medication') {
                              &nbsp;· <span style="color:#16a34a;font-weight:700">✓ concluído</span>
                            }
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
                            <button class="bc-check" [class.checked-purple]="isDone(b)" (click)="toggleProtocol(b, $event); $event.stopPropagation()" [disabled]="toggling() === b.id">{{ isDone(b) ? '✓' : '○' }}</button>
                          } @else if (b.type === 'meal') {
                            <span class="bc-pill" [style.background]="mealConsumed(b) ? '#d1fae5' : '#fef3c7'" [style.color]="mealConsumed(b) ? '#065f46' : '#92400e'">
                              {{ mealConsumed(b) ? '✓' : '+10 XP' }}
                            </span>
                            <span style="font-size:.75rem;color:var(--color-text-subtle)" title="Clique para gerenciar receitas">🍳</span>
                          } @else if (isCompletable(b)) {
                            @if (!isBlockCompleted(b)) {
                              <span class="bc-pill" style="background:#dcfce7;color:#166534">+{{ blockXp(b) }} XP</span>
                            }
                            <button class="bc-check"
                              [class.checked]="isBlockCompleted(b)"
                              (click)="toggleBlockComplete(b, $event); $event.stopPropagation()"
                              [disabled]="completingBlock() === b.id"
                              [title]="isBlockCompleted(b) ? 'Desmarcar' : 'Marcar como concluído'">
                              {{ completingBlock() === b.id ? '…' : isBlockCompleted(b) ? '✓' : '○' }}
                            </button>
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
      </div> <!-- end timeline-panel -->

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

            <!-- ── Remaining macros ───────────────────────────────────── -->
            <div class="remaining-section">
              <div class="rem-title">⏳ O que ainda falta hoje</div>
              <div class="rem-pills">
                <span class="rem-pill" [class.positive]="remainingKcal() > 0" [class.negative]="remainingKcal() < 0" [class.neutral]="remainingKcal() === 0">
                  🔥 {{ remainingKcal() > 0 ? 'Faltam ' + (remainingKcal() | number:'1.0-0') + ' kcal' : remainingKcal() < 0 ? 'Excedeu ' + (absVal(remainingKcal()) | number:'1.0-0') + ' kcal' : '✓ Meta kcal!' }}
                </span>
                <span class="rem-pill" [class.positive]="remainingProtein() > 0" [class.negative]="remainingProtein() < 0" [class.neutral]="remainingProtein() === 0">
                  🥩 {{ remainingProtein() > 0 ? 'Faltam ' + (remainingProtein() | number:'1.0-0') + 'g prot' : remainingProtein() < 0 ? '+' + (absVal(remainingProtein()) | number:'1.0-0') + 'g prot' : '✓ Prot!' }}
                </span>
                <span class="rem-pill" [class.positive]="remainingCarbs() > 0" [class.negative]="remainingCarbs() < 0" [class.neutral]="remainingCarbs() === 0">
                  🌾 {{ remainingCarbs() > 0 ? 'Faltam ' + (remainingCarbs() | number:'1.0-0') + 'g carb' : remainingCarbs() < 0 ? '+' + (absVal(remainingCarbs()) | number:'1.0-0') + 'g carb' : '✓ Carb!' }}
                </span>
                <span class="rem-pill" [class.positive]="remainingFat() > 0" [class.negative]="remainingFat() < 0" [class.neutral]="remainingFat() === 0">
                  🥑 {{ remainingFat() > 0 ? 'Faltam ' + (remainingFat() | number:'1.0-0') + 'g gord' : remainingFat() < 0 ? '+' + (absVal(remainingFat()) | number:'1.0-0') + 'g gord' : '✓ Gord!' }}
                </span>
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

        <!-- ── Copilot Orientação Inteligente ──────────────────────────── -->
        <div class="copilot-card">
          <div class="cop-header">
            <div class="cop-title">🧭 Orientação Inteligente</div>
            @if (copilotFeedback()) {
              <span class="cop-score" [class.score-high]="copilotFeedback()!.score >= 80" [class.score-mid]="copilotFeedback()!.score >= 50 && copilotFeedback()!.score < 80" [class.score-low]="copilotFeedback()!.score < 50">
                {{ copilotFeedback()!.score }}%
              </span>
            }
          </div>
          @if (copilotLoading()) {
            <div class="cop-loading"><span class="spinner" style="width:16px;height:16px"></span> Analisando seu dia...</div>
          } @else if (copilotFeedback()) {
            <div class="cop-items">
              @for (item of copilotFeedback()!.items; track item.key) {
                <div class="cop-item" [class.ok]="item.status === 'ok'" [class.warn]="item.status === 'warn'" [class.error]="item.status === 'error'">
                  <span class="cop-icon">{{ item.status === 'ok' ? '✅' : item.status === 'warn' ? '⚠️' : '❌' }}</span>
                  <span class="cop-msg">{{ item.message }}</span>
                </div>
              }
            </div>
            <button class="cop-refresh" (click)="loadCopilotFeedback()">↻ Atualizar análise</button>
          } @else {
            <div class="cop-items">
              <div class="cop-item warn">
                <span class="cop-icon">ℹ️</span>
                <span class="cop-msg">Adicione eventos ao seu Canvas para receber orientações.</span>
              </div>
            </div>
            <button class="cop-refresh" (click)="loadCopilotFeedback()">↻ Analisar meu dia</button>
          }
        </div>

        <!-- Daily missions widget -->
        <app-daily-missions-widget />

        <div class="card" style="display:flex;flex-direction:column;gap:.5rem">
          <div style="font-size:.82rem;font-weight:700;margin-bottom:.125rem">⚡ Ações rápidas</div>
          <a routerLink="/nutrition"   class="btn btn-secondary w-full">🍽️ Registrar refeição</a>
          <a routerLink="/protocols"   class="btn btn-secondary w-full">💊 Protocolos clínicos</a>
          <a routerLink="/recipes"     class="btn btn-secondary w-full">📖 Receitas da comunidade</a>
          <a routerLink="/leaderboard" class="btn btn-secondary w-full">🏆 Ver ranking semanal</a>
          <a routerLink="/progress"    class="btn btn-secondary w-full">📊 Ver progresso</a>
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

            <!-- Repeat schedule section -->
            @if (panelRecipes().length > 0) {
              <div class="repeat-section">
                <div class="rp-title">🔁 Repetição semanal — selecione os dias para cada receita</div>
                @for (r of panelRecipes(); track r.recipeId) {
                  <div class="rp-recipe-row">
                    <span class="rpr-name">{{ r.title }}</span>
                    <div class="rpr-days">
                      @for (day of allDays; track day) {
                        <button
                          [class.selected]="isDaySelected(r.recipeId, day)"
                          (click)="toggleRepeatDay(r, day)">
                          {{ dayLabel(day) }}
                        </button>
                      }
                    </div>
                  </div>
                }
                <div style="font-size:.7rem;color:var(--color-text-muted);margin-top:.25rem">
                  Clique em um dia para ativar/desativar a repetição automática desta receita naquela refeição.
                </div>
              </div>
            }

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

    <!-- Anti-cheat toast (cap reached / out of window) -->
    @if (xpBlockToast()) {
      <div class="xp-block-toast">🚫 {{ xpBlockToast() }}</div>
    }

    <!-- ── Photo share prompt ─────────────────────────────────────────── -->
    @if (photoPromptBlock()) {
      <div class="photo-overlay" (click)="skipPhoto()">
        <div class="photo-modal" (click)="$event.stopPropagation()">
          <h3>📸 Compartilhar conquista?</h3>
          <p class="subtitle">Adicione uma foto opcional e ganhe <strong>+10 XP</strong> bônus!</p>

          @if (photoDraftDataUrl()) {
            <img [src]="photoDraftDataUrl()!" class="photo-preview" alt="preview">
          }

          <label class="photo-pick-btn">
            {{ photoDraftDataUrl() ? '🔄 Trocar foto' : '📷 Escolher foto' }}
            <input type="file" accept="image/*" style="display:none"
              (change)="onPhotoFileChange($event)">
          </label>

          <input type="text" class="caption-input"
            placeholder="Legenda (opcional)..."
            [(ngModel)]="photoDraftCaption"
            maxlength="280">

          <label class="share-toggle">
            <input type="checkbox" [(ngModel)]="photoSharePublic">
            Visível no feed público
          </label>

          <div class="photo-actions">
            <button class="btn-skip" (click)="skipPhoto()">Pular</button>
            <button class="btn-share"
              (click)="submitWithPhoto()"
              [disabled]="!photoDraftDataUrl() || sharingPhoto()">
              {{ sharingPhoto() ? '...' : '✨ Compartilhar +10 XP' }}
            </button>
          </div>
          <p class="xp-hint">Foto é opcional — clique em "Pular" para concluir sem compartilhar</p>
        </div>
      </div>
    }

    <!-- ── Clone Dieta modal ───────────────────────────────────────────── -->
    @if (cloneModal()) {
      <div class="clone-overlay" (click)="closeCloneModal()">
        <div class="clone-modal" (click)="$event.stopPropagation()">
          <h3>📋 Clonar Dieta</h3>
          <div class="clone-fields">
            <label>Data de origem (copiar de)
              <input type="date" [(ngModel)]="cloneFrom" />
            </label>
            <label>Data de destino (copiar para)
              <input type="date" [(ngModel)]="cloneTo" />
            </label>
          </div>
          <p style="font-size:.75rem;color:var(--color-text-muted);margin-bottom:1rem">
            Copia todas as refeições e receitas vinculadas da data de origem para a data de destino.
            Refeições já existentes no destino serão substituídas.
          </p>
          <div class="clone-actions">
            <button class="btn btn-secondary" style="flex:1" (click)="closeCloneModal()">Cancelar</button>
            <button class="btn" style="flex:1" (click)="cloneDiet()" [disabled]="cloning() || !cloneFrom || !cloneTo">
              {{ cloning() ? '⏳ Clonando...' : '📋 Clonar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class DashboardComponent implements OnInit, OnDestroy {
  private profileSvc      = inject(ProfileService);
  private routineSvc      = inject(RoutineService);
  private foodSvc         = inject(FoodService);
  readonly waterSvc       = inject(WaterService);
  private userSvc         = inject(UserService);
  private protocolSvc     = inject(ClinicalProtocolService);
  private recipeSvc       = inject(RecipeService);
  private scheduledSvc    = inject(ScheduledMealService);
  private recipeSchedSvc  = inject(RecipeScheduleService);
  private checkInSvc      = inject(CheckInService);
  private copilotSvc      = inject(CopilotService);

  readonly todayStr      = new Date().toISOString().slice(0, 10);
  readonly showWaterLogs = signal(false);

  // ── Check-in banner ─────────────────────────────────────────────────────────
  private lastCheckInDate = signal<string | null>(null);
  private bannerDismissed = signal(false);
  showCheckInBanner = computed(() => {
    if (this.bannerDismissed()) return false;
    const last = this.lastCheckInDate();
    if (!last) return true; // never did a check-in
    const msDiff = new Date().getTime() - new Date(last + 'T12:00:00').getTime();
    const daysDiff = msDiff / (1000 * 60 * 60 * 24);
    return daysDiff >= 7;
  });

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

  // ── Diet view ───────────────────────────────────────────────────────────────
  dietView        = signal(false);
  /** Set of meal IDs whose recipe list is expanded in diet view */
  openDietGroups  = signal<Set<string>>(new Set());

  // ── Clone modal ─────────────────────────────────────────────────────────────
  cloneModal   = signal(false);
  cloneFrom    = '';
  cloneTo      = '';
  cloning      = signal(false);

  // ── Apply schedules ─────────────────────────────────────────────────────────
  applyingSchedules = signal(false);

  // ── Canvas: Add Event modal ──────────────────────────────────────────────────
  addEventModal = signal(false);
  savingEvent   = signal(false);

  readonly eventTypeOptions: Array<{ type: BlockType; icon: string; label: string }> = [
    { type: 'meal',         icon: '🍽️', label: 'Refeição' },
    { type: 'work',         icon: '💼', label: 'Trabalho' },
    { type: 'study',        icon: '📚', label: 'Estudo' },
    { type: 'exercise',     icon: '💪', label: 'Exercício' },
    { type: 'water',        icon: '💧', label: 'Água' },
    { type: 'sleep',        icon: '😴', label: 'Sono' },
  ];

  newEvent: { type: BlockType; label: string; startTime: string; endTime: string; daysOfWeek: number[] } = {
    type: 'work', label: '', startTime: '08:00', endTime: '09:00', daysOfWeek: [],
  };

  // ── Copilot feedback panel ───────────────────────────────────────────────────
  copilotFeedback = signal<FeedbackResponse | null>(null);
  copilotLoading  = signal(false);

  // ── Recipe schedules (weekly repeat) ────────────────────────────────────────
  recipeSchedules = signal<RecipeSchedule[]>([]);

  /** All days 0-6 for the repeat picker */
  readonly allDays = [0, 1, 2, 3, 4, 5, 6];

  // ── Block completion ────────────────────────────────────────────────────────
  completingBlock = signal<string | null>(null);

  // ── Photo share prompt ───────────────────────────────────────────────────────
  photoPromptBlock  = signal<{ id: string; event: MouseEvent } | null>(null);
  photoDraftDataUrl = signal<string | null>(null);
  photoDraftCaption = '';
  photoSharePublic  = true;
  sharingPhoto      = signal(false);

  // ── Inline recipe picker (diet view) ────────────────────────────────────────
  inlinePickerMealId = signal<string | null>(null);
  inlineSearch       = '';
  inlinePickerResults = signal<Recipe[]>([]);

  // ── XP pop ─────────────────────────────────────────────────────────────────
  xpPopVisible = signal(false);
  lastXp       = signal(0);
  xpPopX = 0; xpPopY = 0;

  // ── Anti-cheat toast ────────────────────────────────────────────────────────
  xpBlockToast  = signal<string | null>(null);

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

  // ── Remaining macros ────────────────────────────────────────────────────────
  readonly remainingKcal    = computed(() => { const m = this.metabolic(); return m ? Math.round(m.dailyCaloricTarget - this.consumedKcal()) : 0; });
  readonly remainingProtein = computed(() => { const m = this.metabolic(); return m ? Math.round(m.macros.proteinG - (this.summary()?.totalProtein ?? 0)) : 0; });
  readonly remainingCarbs   = computed(() => { const m = this.metabolic(); return m ? Math.round(m.macros.carbsG   - (this.summary()?.totalCarbs   ?? 0)) : 0; });
  readonly remainingFat     = computed(() => { const m = this.metabolic(); return m ? Math.round(m.macros.fatG     - (this.summary()?.totalFat     ?? 0)) : 0; });

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
    this.loadRecipeSchedules();
    this.cloneFrom = this.selectedDate();
    this.clockInterval = setInterval(() => this.clockMinute.set(this.currentMinuteOfDay()), 30_000);
    this.checkInSvc.latest().subscribe({ next: ci => this.lastCheckInDate.set(ci?.date ?? null), error: () => {} });
    this.loadCopilotFeedback();
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

  private loadRecipeSchedules(): void {
    this.recipeSchedSvc.list().subscribe({
      next: s => this.recipeSchedules.set(s),
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

  // ── Apply schedules ──────────────────────────────────────────────────────────
  applySchedules(): void {
    this.applyingSchedules.set(true);
    this.scheduledSvc.applySchedules(this.selectedDate()).subscribe({
      next: meals => {
        this.scheduledMeals.set(meals);
        this.applyingSchedules.set(false);
        this.reloadSummary();
      },
      error: () => this.applyingSchedules.set(false),
    });
  }

  // ── Clone diet ───────────────────────────────────────────────────────────────
  openCloneModal(): void {
    this.cloneFrom = this.selectedDate();
    this.cloneTo   = '';
    this.cloneModal.set(true);
  }

  closeCloneModal(): void { this.cloneModal.set(false); }

  cloneDiet(): void {
    if (!this.cloneFrom || !this.cloneTo) return;
    this.cloning.set(true);
    this.scheduledSvc.clone(this.cloneFrom, this.cloneTo).subscribe({
      next: () => {
        this.cloning.set(false);
        this.closeCloneModal();
        // If cloned to selected date, reload meals
        if (this.cloneTo === this.selectedDate()) {
          this.loadScheduledMeals(this.selectedDate());
          this.reloadSummary();
        }
      },
      error: () => this.cloning.set(false),
    });
  }

  // ── Diet view helpers ─────────────────────────────────────────────────────────
  toggleDietGroup(mealId: string): void {
    this.openDietGroups.update(s => {
      const next = new Set(s);
      if (next.has(mealId)) next.delete(mealId); else next.add(mealId);
      return next;
    });
  }

  isDietGroupOpen(mealId: string): boolean {
    return this.openDietGroups().has(mealId);
  }

  mealKcalFromLinked(meal: ScheduledMeal): number {
    return (meal.linkedRecipes ?? []).reduce((s, r) => s + r.kcalPerServing * r.servings, 0);
  }

  mealBalancePctById(meal: ScheduledMeal): number {
    const target = Number(meal.caloricTarget) || 0;
    if (!target) return 0;
    return Math.min(100, (this.mealKcalFromLinked(meal) / target) * 100);
  }

  /** Change servings directly from the diet view (bypasses mealPanel state) */
  changeServingsInline(meal: ScheduledMeal, recipe: LinkedRecipe, delta: number): void {
    const newServings = Math.max(0.5, recipe.servings + delta);
    // Optimistic update
    this.scheduledMeals.update(list => list.map(m =>
      m.id !== meal.id ? m : {
        ...m,
        linkedRecipes: (m.linkedRecipes ?? []).map(r =>
          r.recipeId === recipe.recipeId ? { ...r, servings: newServings } : r
        ),
      }
    ));
    this.scheduledSvc.unlinkRecipe(meal.id, recipe.recipeId).subscribe({
      next: () => {
        this.scheduledSvc.linkRecipe(meal.id, { recipeId: recipe.recipeId, servings: newServings }).subscribe({
          next: updated => {
            this.scheduledMeals.update(list => list.map(m => m.id === updated.id ? updated : m));
            this.reloadSummary();
          },
          error: () => {},
        });
      },
      error: () => {},
    });
  }

  /** Remove a recipe directly from the diet view */
  removeRecipeFromMeal(meal: ScheduledMeal, recipeId: string): void {
    this.scheduledSvc.unlinkRecipe(meal.id, recipeId).subscribe({
      next: updated => {
        this.scheduledMeals.update(list => list.map(m => m.id === updated.id ? updated : m));
        this.reloadSummary();
        // If this meal is open in the panel too, refresh it
        if (this.mealPanel()?.id === updated.id) this.mealPanel.set({ ...updated });
      },
      error: () => {},
    });
  }

  /** Toggle consumed directly from diet view */
  toggleConsumedById(meal: ScheduledMeal): void {
    this.togglingMeal.set(true);
    this.scheduledSvc.toggle(meal.id).subscribe({
      next: result => {
        this.togglingMeal.set(false);
        this.scheduledMeals.update(list => list.map(m => m.id === result.meal.id ? result.meal : m));
        this.reloadSummary();
        if (result.xpGained > 0) this.showXpPop(result.xpGained);
        if (this.mealPanel()?.id === result.meal.id) this.mealPanel.set({ ...result.meal });
      },
      error: () => this.togglingMeal.set(false),
    });
  }

  /** Open meal panel from diet view (needs to pass a pseudo-block or find it) */
  openMealPanelById(meal: ScheduledMeal): void {
    this.mealPanel.set({ ...meal });
    this.recipeSearch = '';
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

  // ── Repeat schedule helpers ──────────────────────────────────────────────────
  /** Returns true if the recipe+mealName schedule has the given day selected */
  isDaySelected(recipeId: string, day: number): boolean {
    const meal = this.mealPanel();
    if (!meal) return false;
    return this.recipeSchedules().some(
      s => s.recipeId === recipeId && s.mealName === meal.name && s.daysOfWeek.includes(day)
    );
  }

  /** Toggle a single day for a linked recipe's repeat schedule */
  toggleRepeatDay(recipe: LinkedRecipeView, day: number): void {
    const meal = this.mealPanel();
    if (!meal) return;

    const existing = this.recipeSchedules().find(
      s => s.recipeId === recipe.recipeId && s.mealName === meal.name
    );
    const currentDays = existing?.daysOfWeek ?? [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day].sort();

    this.recipeSchedSvc.upsert({
      mealName:   meal.name,
      recipeId:   recipe.recipeId,
      servings:   recipe.servings,
      daysOfWeek: newDays,
    }).subscribe({
      next: updated => {
        this.recipeSchedules.update(list => {
          const i = list.findIndex(s => s.id === updated.id);
          if (i >= 0) { const next = [...list]; next[i] = updated; return next; }
          return [...list, updated];
        });
      },
      error: () => {},
    });
  }

  dayLabel(day: number): string { return DAY_LABELS[day] ?? '?'; }

  // ── Routine ──────────────────────────────────────────────────────────────────
  /** @deprecated Canvas pivot — kept for reference; server returns 410. */
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

  // ── Canvas: Add Event modal ──────────────────────────────────────────────────
  openAddEventModal(): void {
    this.newEvent = { type: 'work', label: '', startTime: '08:00', endTime: '09:00', daysOfWeek: [] };
    this.addEventModal.set(true);
  }

  closeAddEventModal(): void { this.addEventModal.set(false); }

  toggleNewEventDay(day: number): void {
    const days = this.newEvent.daysOfWeek;
    this.newEvent = {
      ...this.newEvent,
      daysOfWeek: days.includes(day) ? days.filter(d => d !== day) : [...days, day].sort(),
    };
  }

  saveNewEvent(): void {
    if (!this.newEvent.label.trim() || !this.newEvent.startTime || !this.newEvent.endTime) return;
    const isRecurring = this.newEvent.daysOfWeek.length > 0;
    const dto: CreateBlockDto = {
      type:        this.newEvent.type,
      label:       this.newEvent.label.trim(),
      startTime:   this.newEvent.startTime,
      endTime:     this.newEvent.endTime,
      isRecurring,
      daysOfWeek:  isRecurring ? this.newEvent.daysOfWeek : [],
      routineDate: isRecurring ? undefined : this.selectedDate(),
    };
    this.savingEvent.set(true);
    this.routineSvc.createBlock(dto).subscribe({
      next: () => {
        this.savingEvent.set(false);
        this.addEventModal.set(false);
        // Refresh the full list so recurring blocks appear correctly
        this.routineSvc.load(this.selectedDate()).subscribe({ error: () => {} });
        this.loadCopilotFeedback();
      },
      error: () => this.savingEvent.set(false),
    });
  }

  dayShort(day: number): string {
    return ['D','S','T','Q','Q','S','S'][day] ?? '?';
  }

  // ── Copilot feedback ─────────────────────────────────────────────────────────
  loadCopilotFeedback(): void {
    this.copilotLoading.set(true);
    this.copilotSvc.getFeedback(this.selectedDate()).subscribe({
      next: fb => { this.copilotFeedback.set(fb); this.copilotLoading.set(false); },
      error: ()  => { this.copilotLoading.set(false); },
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
    this.openDietGroups.set(new Set());
    this.cloneFrom = next;
    this.copilotFeedback.set(null);
    this.loadCopilotFeedback();
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

  // ── Block completion ──────────────────────────────────────────────────────────
  isCompletable(b: RoutineBlock): boolean {
    return COMPLETABLE_TYPES.has(b.type);
  }

  isBlockCompleted(b: RoutineBlock): boolean {
    return !!b.completedAt;
  }

  blockXp(b: RoutineBlock): number {
    return BLOCK_XP[b.type] ?? 5;
  }

  blockBorderColor(b: RoutineBlock): string {
    if (this.isBlockCompleted(b)) return '#22c55e';
    if (this.mealConsumed(b))     return '#22c55e';
    return BLOCK_META[b.type]?.color ?? '#9ca3af';
  }

  toggleBlockComplete(b: RoutineBlock, event: MouseEvent): void {
    // If undoing, call immediately without photo prompt
    if (b.completedAt) {
      this._doCompleteBlock(b.id, event);
      return;
    }
    // New completion: show photo share prompt
    this.photoPromptBlock.set({ id: b.id, event });
    this.photoDraftDataUrl.set(null);
    this.photoDraftCaption = '';
    this.photoSharePublic  = true;
  }

  skipPhoto(): void {
    const p = this.photoPromptBlock();
    if (!p) return;
    this.photoPromptBlock.set(null);
    this._doCompleteBlock(p.id, p.event);
  }

  onPhotoFileChange(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.compressImage(file).then(dataUrl => this.photoDraftDataUrl.set(dataUrl));
  }

  /** Resize + JPEG-compress to keep upload well under the 10 MB server limit. */
  private compressImage(file: File, maxDim = 1280, quality = 0.82): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
          else { width = Math.round(width * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(img.src);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = URL.createObjectURL(file);
    });
  }

  submitWithPhoto(): void {
    const p = this.photoPromptBlock();
    if (!p || !this.photoDraftDataUrl()) return;
    this.sharingPhoto.set(true);
    this._doCompleteBlock(p.id, p.event, {
      photoDataUrl: this.photoDraftDataUrl()!,
      caption:      this.photoDraftCaption || undefined,
      sharePublic:  this.photoSharePublic,
    });
  }

  private _doCompleteBlock(
    blockId: string,
    event: MouseEvent,
    photo?: { photoDataUrl: string; caption?: string; sharePublic?: boolean }
  ): void {
    this.photoPromptBlock.set(null);
    this.completingBlock.set(blockId);
    this.routineSvc.completeBlock(blockId, photo).subscribe({
      next: result => {
        this.completingBlock.set(null);
        this.sharingPhoto.set(false);
        if (result.xpGained > 0) {
          this.showXpPop(result.xpGained, event);
        } else if (result.message && (result.capReached || result.outOfWindow)) {
          this.showXpBlockToast(result.message);
        }
      },
      error: (err) => {
        this.completingBlock.set(null);
        this.sharingPhoto.set(false);
        const msg = err?.error?.message as string | undefined;
        if (msg) this.showXpBlockToast(msg);
      },
    });
  }

  private showXpBlockToast(msg: string): void {
    this.xpBlockToast.set(msg);
    setTimeout(() => this.xpBlockToast.set(null), 4000);
  }

  // ── Inline recipe picker ──────────────────────────────────────────────────────
  openInlinePicker(meal: ScheduledMeal): void {
    if (this.inlinePickerMealId() === meal.id) {
      this.closeInlinePicker();
      return;
    }
    this.inlinePickerMealId.set(meal.id);
    this.inlineSearch = '';
    this.inlinePickerResults.set([]);
    // Ensure recipes are loaded
    if (this.availableRecipes().length === 0) {
      this.recipeSvc.listMine().subscribe({
        next: mine => {
          this.recipeSvc.feed(1, 30).subscribe({
            next: feed => {
              const all = [...mine];
              const ids = new Set(mine.map(r => r.id));
              feed.forEach(r => { if (!ids.has(r.id)) all.push(r); });
              this.availableRecipes.set(all);
            },
            error: () => {},
          });
        },
        error: () => {},
      });
    }
  }

  closeInlinePicker(): void {
    this.inlinePickerMealId.set(null);
    this.inlineSearch = '';
    this.inlinePickerResults.set([]);
  }

  onInlineSearch(): void {
    const q = this.inlineSearch.toLowerCase().trim();
    if (q.length < 2) {
      this.inlinePickerResults.set([]);
      return;
    }
    this.inlinePickerResults.set(
      this.availableRecipes().filter(r => r.title.toLowerCase().includes(q))
    );
  }

  addRecipeInline(meal: ScheduledMeal, recipe: Recipe): void {
    this.scheduledSvc.linkRecipe(meal.id, { recipeId: recipe.id, servings: 1 }).subscribe({
      next: updated => {
        this.scheduledMeals.update(list => list.map(m => m.id === updated.id ? updated : m));
        this.reloadSummary();
        // Keep picker open so user can add more; clear search for convenience
        this.inlineSearch = '';
        this.inlinePickerResults.set([]);
      },
      error: () => {},
    });
  }

  dismissCheckInBanner(): void { this.bannerDismissed.set(true); }

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
  absVal(n: number): number { return Math.abs(n); }
  private currentMinuteOfDay(): number { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); }
  private showXpPop(xp: number, event?: MouseEvent): void {
    this.lastXp.set(xp); this.xpPopX = event?.clientX ?? window.innerWidth / 2; this.xpPopY = event?.clientY ?? window.innerHeight / 2;
    this.xpPopVisible.set(true); setTimeout(() => this.xpPopVisible.set(false), 900);
  }
}
