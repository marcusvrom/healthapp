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
  styleUrls: ['./daily-missions-widget.component.scss'],
  templateUrl: './daily-missions-widget.component.html',
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
