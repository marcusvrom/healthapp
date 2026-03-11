import {
  Component, inject, signal, OnInit, OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { DailyMissionService } from '../../core/services/daily-mission.service';
import { DailyMission } from '../../core/models';

const MISSION_ICONS: Record<string, string> = {
  WATER_GOAL:  '💧',
  ALL_MEALS:   '🍽️',
  ACTIVITY:    '💪',
  WEIGHT_LOG:  '⚖️',
  SLEEP_BLOCK: '😴',
};

@Component({
  selector: 'app-daily-missions-widget',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    .card {
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius); padding: 1rem 1.125rem;
    }

    .card-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: .875rem;
    }
    .card-title { font-size: .9rem; font-weight: 800; color: var(--color-text);
      display: flex; align-items: center; gap: .4rem; }
    .progress-text { font-size: .72rem; color: var(--color-text-muted); font-weight: 600; }

    .mission-list { display: flex; flex-direction: column; gap: .5rem; }

    .mission-item {
      display: flex; align-items: center; gap: .75rem;
      padding: .5rem .625rem; border-radius: var(--radius-sm);
      border: 1.5px solid var(--color-border); background: var(--color-bg);
      transition: all .15s; position: relative; overflow: hidden;

      &.done { background: rgba(16,185,129,.06); border-color: rgba(16,185,129,.25); }

      .check {
        width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
        border: 2px solid var(--color-border); display: flex; align-items: center;
        justify-content: center; font-size: .8rem; transition: all .3s;
        &.checked { background: #10b981; border-color: #10b981; color: #fff; }
      }

      .icon { font-size: 1.1rem; flex-shrink: 0; }

      .content { flex: 1; min-width: 0;
        .title { font-size: .82rem; font-weight: 600; color: var(--color-text); }
        .xp    { font-size: .7rem;  color: var(--color-text-muted); }
        &.done-text .title { text-decoration: line-through; color: var(--color-text-muted); }
      }

      .auto-hint { font-size: .6rem; color: var(--color-text-subtle); flex-shrink: 0; font-style: italic; }

      /* Ripple animation when auto-completing */
      .ripple {
        position: absolute; inset: 0; display: flex; align-items: center;
        justify-content: center; font-size: 1rem; font-weight: 800;
        color: #10b981; background: rgba(16,185,129,.12);
        border-radius: inherit; animation: xpPop .7s ease forwards; pointer-events: none;
      }
    }

    @keyframes xpPop {
      0%   { opacity: 0; transform: scale(.8); }
      30%  { opacity: 1; transform: scale(1.05); }
      70%  { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(.9); }
    }

    .all-done {
      text-align: center; padding: .625rem;
      font-size: .82rem; font-weight: 700; color: #10b981;
      display: flex; align-items: center; justify-content: center; gap: .4rem;
    }

    .loading { text-align: center; padding: .75rem;
      font-size: .8rem; color: var(--color-text-muted); }
  `],
  template: `
    <div class="card">
      <div class="card-header">
        <div class="card-title">🎯 Missões do Dia</div>
        @if (!loading() && missions().length > 0) {
          <span class="progress-text">
            {{ completedCount() }}/{{ missions().length }} concluídas
          </span>
        }
      </div>

      @if (loading()) {
        <div class="loading">Carregando missões…</div>
      } @else {
        @if (allDone()) {
          <div class="all-done">✅ Todas as missões de hoje concluídas!</div>
        }
        <div class="mission-list">
          @for (m of missions(); track m.id) {
            <div class="mission-item" [class.done]="m.isCompleted">
              <div class="check" [class.checked]="m.isCompleted">
                @if (m.isCompleted) { ✓ }
              </div>
              <span class="icon">{{ missionIcon(m.missionType) }}</span>
              <div class="content" [class.done-text]="m.isCompleted">
                <div class="title">{{ m.title }}</div>
                <div class="xp">+{{ m.xpReward }} XP</div>
              </div>
              @if (!m.isCompleted) {
                <span class="auto-hint">auto</span>
              }
              @if (animating() === m.id) {
                <div class="ripple">+{{ m.xpReward }} XP</div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class DailyMissionsWidgetComponent implements OnInit, OnDestroy {
  private missionSvc = inject(DailyMissionService);
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  loading   = signal(true);
  missions  = signal<DailyMission[]>([]);
  animating = signal<string | null>(null);

  completedCount = () => this.missions().filter(m => m.isCompleted).length;
  allDone        = () => this.missions().length > 0 && this.completedCount() === this.missions().length;

  ngOnInit(): void {
    this.loadMissions();

    // Poll every 30s to pick up auto-completions from other actions
    this.pollTimer = setInterval(() => this.refreshMissions(), 30_000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  /** Triggers a refresh (can be called from parent components after actions) */
  refresh(): void {
    this.refreshMissions();
  }

  private loadMissions(): void {
    this.missionSvc.getTodayMissions().subscribe({
      next:  list => { this.missions.set(list); this.loading.set(false); },
      error: ()   => this.loading.set(false),
    });
  }

  private refreshMissions(): void {
    this.missionSvc.getTodayMissions().subscribe({
      next: list => {
        const prev = this.missions();
        // Detect newly completed missions and animate them
        for (const m of list) {
          const old = prev.find(p => p.id === m.id);
          if (m.isCompleted && old && !old.isCompleted) {
            this.animating.set(m.id);
            setTimeout(() => this.animating.set(null), 750);
          }
        }
        this.missions.set(list);
      },
    });
  }

  missionIcon(type: string): string {
    return MISSION_ICONS[type] ?? '🎯';
  }
}
