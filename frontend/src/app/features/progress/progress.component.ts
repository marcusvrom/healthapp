import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe, NgStyle } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MetricsService, WeightPoint, StreakData } from '../../core/services/metrics.service';
import { WaterDayStats } from '../../core/services/water.service';
import { CheckInService } from '../../core/services/check-in.service';
import { CopilotService } from '../../core/services/copilot.service';
import { GamificationService } from '../../core/services/gamification.service';
import { ApiService } from '../../core/services/api.service';
import { WeeklyCheckIn, CopilotInsight, RankingEntry, DailyCap } from '../../core/models';

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [FormsModule, DecimalPipe, DatePipe, NgStyle, RouterLink],
  styleUrls: ['./progress.component.scss'],
  templateUrl: './progress.component.html',
})
export class ProgressComponent implements OnInit {
  private metricsSvc      = inject(MetricsService);
  private checkInSvc      = inject(CheckInService);
  private copilotSvc      = inject(CopilotService);
  private gamificationSvc = inject(GamificationService);
  private api             = inject(ApiService);
  img = (path: string | null | undefined) => this.api.storageUrl(path);

  streaks        = signal<StreakData | null>(null);
  waterHistory   = signal<WaterDayStats[]>([]);
  weightPoints   = signal<WeightPoint[]>([]);
  checkIns       = signal<WeeklyCheckIn[]>([]);
  insights       = signal<CopilotInsight[]>([]);
  ranking        = signal<RankingEntry[]>([]);
  dailyCaps      = signal<DailyCap[]>([]);
  myUserId       = signal<string | null>(null);
  waterLoading   = signal(false);
  weightLoading  = signal(false);
  insightsLoading= signal(false);
  rankingLoading = signal(false);
  savingWeight   = signal(false);
  waterDays      = signal(7);
  newWeightVal: number | null = null;

  // ── SVG layout constants ─────────────────────────────────────────────────────
  readonly svgW = 460;
  readonly svgH = 220;
  readonly padL = 42;
  readonly padR = 12;
  readonly padT = 12;
  readonly padB = 24;

  // ── Computed helpers ─────────────────────────────────────────────────────────
  latestWeight = (): number | null => {
    const pts = this.weightPoints();
    if (!pts.length) return null;
    return Number(pts[pts.length - 1]!.weightKg);
  };

  weightDelta = (): string => {
    const pts = this.weightPoints();
    if (pts.length < 2) return 'nenhum histórico';
    const delta = Number(pts[pts.length - 1]!.weightKg) - Number(pts[pts.length - 2]!.weightKg);
    if (delta === 0) return 'sem alteração';
    return `${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg vs anterior`;
  };

  avgWater = (): number => {
    const h = this.waterHistory();
    if (!h.length) return 0;
    return h.reduce((s, d) => s + d.consumedMl, 0) / h.length;
  };

  // ── Weight SVG computed ──────────────────────────────────────────────────────
  private weightRange = computed(() => {
    const pts = this.weightPoints();
    if (!pts.length) return { min: 60, max: 80 };
    const vals = pts.map(p => Number(p.weightKg));
    const min = Math.floor(Math.min(...vals) - 1);
    const max = Math.ceil(Math.max(...vals) + 1);
    return { min, max };
  });

  private wScaleY = computed(() => {
    const { min, max } = this.weightRange();
    const h = this.svgH - this.padT - this.padB;
    return (v: number) => this.padT + h - ((v - min) / (max - min)) * h;
  });

  private wScaleX = computed(() => {
    const pts = this.weightPoints();
    const w = this.svgW - this.padL - this.padR;
    return (i: number) => this.padL + (i / Math.max(pts.length - 1, 1)) * w;
  });

  weightDots = computed(() => {
    const pts = this.weightPoints();
    const sx = this.wScaleX();
    const sy = this.wScaleY();
    return pts.map((p, i) => ({ x: sx(i), y: sy(Number(p.weightKg)) }));
  });

  weightLinePath = computed(() => {
    const dots = this.weightDots();
    if (!dots.length) return '';
    return dots.map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(' ');
  });

  weightAreaPath = computed(() => {
    const dots = this.weightDots();
    if (!dots.length) return '';
    const base = this.svgH - this.padB;
    const line = dots.map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(' ');
    const last = dots[dots.length - 1]!;
    const first = dots[0]!;
    return `${line} L${last.x.toFixed(1)},${base} L${first.x.toFixed(1)},${base} Z`;
  });

  weightYTicks = computed(() => {
    const { min, max } = this.weightRange();
    const sy = this.wScaleY();
    const step = Math.ceil((max - min) / 4);
    const ticks: { y: number; label: string }[] = [];
    for (let v = min; v <= max; v += step) {
      ticks.push({ y: sy(v), label: String(v) });
    }
    return ticks;
  });

  weightXLabels = computed(() => {
    const pts = this.weightPoints();
    const sx = this.wScaleX();
    const every = Math.max(1, Math.floor(pts.length / 6));
    return pts
      .map((p, i) => ({ x: sx(i), label: this.shortDate(p.date), i }))
      .filter((_, i) => i % every === 0 || i === pts.length - 1);
  });

  // ── Check-in SVG computed ────────────────────────────────────────────────────
  private ciRange = computed(() => {
    const pts = this.checkIns();
    if (!pts.length) return { min: 60, max: 80 };
    const vals = pts.map(p => Number(p.currentWeight));
    const min = Math.floor(Math.min(...vals) - 1);
    const max = Math.ceil(Math.max(...vals) + 1);
    return { min, max };
  });

  private ciScaleY = computed(() => {
    const { min, max } = this.ciRange();
    const h = this.svgH - this.padT - this.padB;
    return (v: number) => this.padT + h - ((v - min) / (max - min)) * h;
  });

  private ciScaleX = computed(() => {
    const pts = this.checkIns();
    const w = this.svgW - this.padL - this.padR;
    // Sort ascending for chart (list from API is newest first)
    return (i: number) => this.padL + (i / Math.max(pts.length - 1, 1)) * w;
  });

  ciDots = computed(() => {
    const pts = [...this.checkIns()].reverse(); // oldest first
    const sx = this.ciScaleX();
    const sy = this.ciScaleY();
    return pts.map((p, i) => ({
      x: sx(i),
      y: sy(Number(p.currentWeight)),
      adherence: p.adherenceScore,
    }));
  });

  ciLinePath = computed(() => {
    const dots = this.ciDots();
    if (!dots.length) return '';
    return dots.map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(' ');
  });

  ciAreaPath = computed(() => {
    const dots = this.ciDots();
    if (!dots.length) return '';
    const base = this.svgH - this.padB;
    const line = dots.map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(' ');
    const last  = dots[dots.length - 1]!;
    const first = dots[0]!;
    return `${line} L${last.x.toFixed(1)},${base} L${first.x.toFixed(1)},${base} Z`;
  });

  ciYTicks = computed(() => {
    const { min, max } = this.ciRange();
    const sy = this.ciScaleY();
    const step = Math.ceil((max - min) / 4);
    const ticks: { y: number; label: string }[] = [];
    for (let v = min; v <= max; v += step) ticks.push({ y: sy(v), label: String(v) });
    return ticks;
  });

  ciXLabels = computed(() => {
    const pts = [...this.checkIns()].reverse();
    const sx = this.ciScaleX();
    const every = Math.max(1, Math.floor(pts.length / 6));
    return pts
      .map((p, i) => ({ x: sx(i), label: this.shortDate(p.date), i }))
      .filter((_, i) => i % every === 0 || i === pts.length - 1);
  });

  // ── Water SVG computed ───────────────────────────────────────────────────────
  private waterMaxVal = computed(() => {
    const h = this.waterHistory();
    if (!h.length) return 2000;
    return Math.max(...h.map(d => Math.max(d.goalMl, d.consumedMl))) * 1.1;
  });

  private wWaterScaleY = computed(() => {
    const maxV = this.waterMaxVal();
    const h = this.svgH - this.padT - this.padB;
    return (v: number) => this.padT + h - (v / maxV) * h;
  });

  waterYTicks = computed(() => {
    const maxV = this.waterMaxVal();
    const sy = this.wWaterScaleY();
    const ticks: { y: number; label: string }[] = [];
    const step = Math.ceil(maxV / 4 / 500) * 500;
    for (let v = 0; v <= maxV; v += step) {
      ticks.push({ y: sy(v), label: v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v) });
    }
    return ticks;
  });

  waterBars = computed(() => {
    const hist = this.waterHistory();
    const sy = this.wWaterScaleY();
    const chartW = this.svgW - this.padL - this.padR;
    const barW = chartW / hist.length;
    const base = this.svgH - this.padB;
    return hist.map((d, i) => {
      const goalY = sy(d.goalMl);
      const consumedY = sy(d.consumedMl);
      return {
        x: this.padL + i * barW,
        w: barW - 2,
        goalY,
        goalH: base - goalY,
        consumedY,
        consumedH: base - consumedY,
        label: this.shortDate(d.date),
      };
    });
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.metricsSvc.streaks().subscribe({ next: s => this.streaks.set(s), error: () => {} });
    this.loadWeight();
    this.loadWater();
    this.checkInSvc.list().subscribe({ next: list => this.checkIns.set(list), error: () => {} });

    this.insightsLoading.set(true);
    this.copilotSvc.getInsights().subscribe({
      next: ins => { this.insights.set(ins); this.insightsLoading.set(false); },
      error: () => this.insightsLoading.set(false),
    });

    this.rankingLoading.set(true);
    this.gamificationSvc.getWeeklyRanking().subscribe({
      next: r => { this.ranking.set(r); this.rankingLoading.set(false); },
      error: () => this.rankingLoading.set(false),
    });

    this.gamificationSvc.getDailyCaps().subscribe({
      next: caps => this.dailyCaps.set(caps),
      error: () => {},
    });

    // Resolve current user id from localStorage JWT payload (quick, no extra API call)
    try {
      const token = localStorage.getItem('token') ?? '';
      const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as { userId?: string };
      if (payload.userId) this.myUserId.set(payload.userId);
    } catch { /* ignore */ }
  }

  private loadWeight(): void {
    this.weightLoading.set(true);
    this.metricsSvc.weightHistory(30).subscribe({
      next: pts => { this.weightPoints.set(pts); this.weightLoading.set(false); },
      error: () => this.weightLoading.set(false),
    });
  }

  private loadWater(): void {
    this.waterLoading.set(true);
    this.metricsSvc.waterConsistency(this.waterDays()).subscribe({
      next: hist => { this.waterHistory.set(hist); this.waterLoading.set(false); },
      error: () => this.waterLoading.set(false),
    });
  }

  setWaterDays(d: number): void {
    this.waterDays.set(d);
    this.loadWater();
  }

  logWeight(): void {
    const w = this.newWeightVal;
    if (!w) return;
    this.savingWeight.set(true);
    this.metricsSvc.logWeight(w).subscribe({
      next: () => {
        this.savingWeight.set(false);
        this.newWeightVal = null;
        this.loadWeight();
        this.metricsSvc.streaks().subscribe({ next: s => this.streaks.set(s) });
      },
      error: () => this.savingWeight.set(false),
    });
  }

  shortDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  starsFor(score: number): string {
    return '⭐'.repeat(score) + '☆'.repeat(5 - score);
  }

  insightIcon(type: string): string {
    const icons: Record<string, string> = {
      warning: '⚠️', success: '✅', tip: '💡', info: 'ℹ️',
    };
    return icons[type] ?? 'ℹ️';
  }

  rankMedal(i: number): string {
    return ['🥇', '🥈', '🥉'][i] ?? String(i + 1);
  }

  capIcon(cat: string): string {
    const map: Record<string, string> = {
      exercise: '💪', meal: '🍽️', water: '💧', sleep: '😴',
      sun_exposure: '☀️', work: '💼', free: '⬜', custom: '📌',
    };
    return map[cat] ?? '⚡';
  }

  capLabel(cat: string): string {
    const map: Record<string, string> = {
      exercise: 'Exercício', meal: 'Refeições', water: 'Água', sleep: 'Sono',
      sun_exposure: 'Sol', work: 'Trabalho', free: 'Livre', custom: 'Custom',
    };
    return map[cat] ?? cat;
  }

  capPct(c: DailyCap): number {
    if (c.cap === 0) return 0;
    return Math.min(100, Math.round((c.earned / c.cap) * 100));
  }
}
