import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions, ChartDataset } from 'chart.js';
import { MetricsService, WeightPoint, StreakData } from '../../core/services/metrics.service';
import { WaterDayStats } from '../../core/services/water.service';

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [FormsModule, DecimalPipe, DatePipe, BaseChartDirective],
  styles: [`
    .page { padding: 1.5rem; max-width: 1100px; margin: 0 auto; }
    .page-header { margin-bottom: 1.5rem; h2 { font-size: 1.5rem; } p { color: var(--color-text-muted); } }

    /* Streak cards row */
    .streak-row {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem;
      margin-bottom: 2rem;
    }
    .streak-card {
      border-radius: var(--radius-md); padding: 1.25rem;
      border: 1px solid var(--color-border); background: var(--color-surface);
      text-align: center;

      .streak-icon { font-size: 2rem; display: block; margin-bottom: .5rem; }
      .streak-value {
        font-size: 2.5rem; font-weight: 800; line-height: 1;
        background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      .streak-label  { font-size: .72rem; color: var(--color-text-subtle); margin-top: .25rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
      .streak-sub    { font-size: .75rem; color: var(--color-text-muted); margin-top: .25rem; }

      &.on-fire .streak-icon { animation: pulse 1.2s ease-in-out infinite; }
    }

    /* Charts grid */
    .charts-grid {
      display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem;
      @media (max-width: 800px) { grid-template-columns: 1fr; }
    }

    .chart-card {
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); padding: 1.25rem;

      .chart-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;
        h3 { font-size: .95rem; font-weight: 700; }
        .actions { display: flex; gap: .5rem; }
      }

      .chart-container { position: relative; height: 240px; }

      .chart-empty { height: 240px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .75rem;
        color: var(--color-text-muted);
        .emoji { font-size: 2rem; }
        p { font-size: .85rem; text-align: center; }
      }
    }

    /* Log weight form */
    .log-weight-form {
      display: flex; gap: .625rem; align-items: flex-end;
      .form-group { flex: 1; }
    }

    /* Water day pills */
    .water-legend {
      display: flex; gap: .375rem; flex-wrap: wrap; margin-top: .75rem;

      .day-pill {
        display: flex; align-items: center; gap: .3rem;
        font-size: .7rem; padding: .2rem .5rem; border-radius: 99px;
        font-weight: 600;
        &.met     { background: #dcfce7; color: #166534; }
        &.not-met { background: #fee2e2; color: #991b1b; }
      }
    }

    /* Mini table for water detail */
    .water-detail {
      margin-top: .875rem;
      table { width: 100%; border-collapse: collapse; font-size: .78rem;
        th { text-align: left; color: var(--color-text-subtle); font-weight: 600; padding: .25rem .5rem; border-bottom: 1px solid var(--color-border); }
        td { padding: .3rem .5rem; border-bottom: 1px solid var(--color-border); }
        tr:last-child td { border-bottom: none; }
        .met-icon   { color: #16a34a; }
        .unmet-icon { color: #dc2626; }
      }
    }

    /* Period selector */
    .period-btns { display: flex; gap: .375rem; }
    .period-btn {
      padding: .3rem .75rem; border-radius: 99px; font-size: .75rem; font-weight: 600;
      border: 1.5px solid var(--color-border); background: var(--color-surface-2);
      cursor: pointer; transition: .15s;
      &.active { background: var(--color-primary); border-color: var(--color-primary); color: #fff; }
    }
  `],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>📊 Métricas & Progresso</h2>
        <p>Acompanhe sua evolução de peso, hidratação e consistência.</p>
      </div>

      <!-- Streak cards -->
      <div class="streak-row">
        <div class="streak-card" [class.on-fire]="streaks()?.waterCurrentStreak! >= 3">
          <span class="streak-icon">{{ streaks()?.waterCurrentStreak! >= 3 ? '🔥' : '💧' }}</span>
          <div class="streak-value">{{ streaks()?.waterCurrentStreak ?? '—' }}</div>
          <div class="streak-label">Sequência atual</div>
          <div class="streak-sub">dias batendo a meta de água</div>
        </div>
        <div class="streak-card">
          <span class="streak-icon">🏆</span>
          <div class="streak-value">{{ streaks()?.waterLongestStreak ?? '—' }}</div>
          <div class="streak-label">Melhor sequência</div>
          <div class="streak-sub">maior recorde de hidratação</div>
        </div>
        <div class="streak-card">
          <span class="streak-icon">⚖️</span>
          <div class="streak-value">{{ latestWeight() ?? '—' }}</div>
          <div class="streak-label">Último peso (kg)</div>
          <div class="streak-sub">{{ weightDelta() }}</div>
        </div>
        <div class="streak-card">
          <span class="streak-icon">📈</span>
          <div class="streak-value">{{ avgWater() | number:'1.0-0' }}</div>
          <div class="streak-label">Média de água</div>
          <div class="streak-sub">ml/dia nos últimos 7 dias</div>
        </div>
      </div>

      <!-- Charts grid -->
      <div class="charts-grid">

        <!-- Weight line chart -->
        <div class="chart-card">
          <div class="chart-header">
            <h3>⚖️ Evolução do Peso</h3>
            <div class="actions">
              <div class="log-weight-form">
                <div class="form-group">
                  <input type="number" [(ngModel)]="newWeight" placeholder="kg" min="20" max="300" step="0.1"
                    style="width:80px;padding:.35rem .5rem;border:1.5px solid var(--color-border);border-radius:6px;font-size:.82rem" />
                </div>
                <button class="btn btn-primary btn-sm" (click)="logWeight()" [disabled]="!newWeight || savingWeight()">
                  {{ savingWeight() ? '...' : '+ Peso' }}
                </button>
              </div>
            </div>
          </div>

          @if (weightLoading()) {
            <div class="chart-empty"><span class="spinner"></span></div>
          } @else if ((weightChartData.datasets[0]?.data?.length ?? 0) < 2) {
            <div class="chart-empty">
              <span class="emoji">⚖️</span>
              <p>Registre pelo menos 2 pesagens<br>para ver o gráfico de evolução.</p>
            </div>
          } @else {
            <div class="chart-container">
              <canvas baseChart
                [data]="weightChartData"
                [options]="weightChartOptions"
                [type]="'line'">
              </canvas>
            </div>
          }
        </div>

        <!-- Water bar chart -->
        <div class="chart-card">
          <div class="chart-header">
            <h3>💧 Hidratação — Últimos Dias</h3>
            <div class="period-btns">
              @for (d of [7, 14]; track d) {
                <button class="period-btn" [class.active]="waterDays() === d" (click)="setWaterDays(d)">{{ d }}d</button>
              }
            </div>
          </div>

          @if (waterLoading()) {
            <div class="chart-empty"><span class="spinner"></span></div>
          } @else if (waterHistory().length === 0) {
            <div class="chart-empty">
              <span class="emoji">💧</span>
              <p>Nenhum dado de hidratação ainda.<br>Comece a registrar na tela de hidratação.</p>
            </div>
          } @else {
            <div class="chart-container">
              <canvas baseChart
                [data]="waterChartData"
                [options]="waterChartOptions"
                [type]="'bar'">
              </canvas>
            </div>
            <!-- Day pills legend -->
            <div class="water-legend">
              @for (d of waterHistory(); track d.date) {
                <span class="day-pill" [class.met]="d.metGoal" [class.not-met]="!d.metGoal">
                  {{ d.metGoal ? '✓' : '✗' }} {{ shortDate(d.date) }}
                </span>
              }
            </div>
          }
        </div>

        <!-- Water detail table (full width) -->
        @if (waterHistory().length > 0) {
          <div class="chart-card" style="grid-column:1/-1">
            <div class="chart-header"><h3>📋 Detalhe de Hidratação</h3></div>
            <div class="water-detail">
              <table>
                <thead>
                  <tr>
                    <th>Data</th><th>Consumido</th><th>Meta</th><th>%</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (d of waterHistory().slice().reverse(); track d.date) {
                    <tr>
                      <td>{{ d.date | date:'EEE, dd/MM' }}</td>
                      <td>{{ d.consumedMl | number:'1.0-0' }} ml</td>
                      <td>{{ d.goalMl | number:'1.0-0' }} ml</td>
                      <td>{{ (d.consumedMl / d.goalMl * 100) | number:'1.0-0' }}%</td>
                      <td>
                        @if (d.metGoal) {
                          <span class="met-icon">✓ Meta batida</span>
                        } @else {
                          <span class="unmet-icon">✗ {{ d.goalMl - d.consumedMl | number:'1.0-0' }} ml abaixo</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class ProgressComponent implements OnInit {
  private metricsSvc = inject(MetricsService);

  streaks      = signal<StreakData | null>(null);
  waterHistory = signal<WaterDayStats[]>([]);
  weightPoints = signal<WeightPoint[]>([]);
  waterLoading = signal(false);
  weightLoading= signal(false);
  savingWeight = signal(false);
  waterDays    = signal(7);
  newWeight    = signal<number | null>(null);

  // ── Computed helpers ────────────────────────────────────────────────────────
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

  // ── Chart configs ───────────────────────────────────────────────────────────
  weightChartData: ChartData<'line'> = {
    labels:   [],
    datasets: [{ data: [], label: 'Peso (kg)', fill: true, tension: .4,
      borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.12)',
      pointBackgroundColor: '#10b981', pointRadius: 5,
    }],
  };

  weightChartOptions: ChartOptions<'line'> = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: {
      label: ctx => ` ${ctx.parsed.y} kg`,
    }}},
    scales: {
      y: { title: { display: true, text: 'kg' }, ticks: { font: { size: 11 } } },
      x: { ticks: { font: { size: 11 } } },
    },
  };

  waterChartData: ChartData<'bar'> = {
    labels:   [],
    datasets: [
      { data: [], label: 'Meta (ml)', backgroundColor: 'rgba(14,165,233,.2)', borderColor: '#0ea5e9', borderWidth: 1.5, borderRadius: 4 },
      { data: [], label: 'Consumido (ml)', backgroundColor: 'rgba(16,185,129,.65)', borderColor: '#10b981', borderWidth: 1.5, borderRadius: 4 },
    ],
  };

  waterChartOptions: ChartOptions<'bar'> = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } },
      tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y.toLocaleString('pt-BR')} ml` }},
    },
    scales: {
      y: { title: { display: true, text: 'ml' }, ticks: { font: { size: 11 } } },
      x: { ticks: { font: { size: 11 } } },
    },
  };

  ngOnInit(): void {
    this.loadAll();
  }

  private loadAll(): void {
    this.metricsSvc.streaks().subscribe({ next: s => this.streaks.set(s), error: () => {} });
    this.loadWeight();
    this.loadWater();
  }

  private loadWeight(): void {
    this.weightLoading.set(true);
    this.metricsSvc.weightHistory(30).subscribe({
      next: pts => {
        this.weightPoints.set(pts);
        this.weightChartData = {
          ...this.weightChartData,
          labels: pts.map(p => this.shortDate(p.date)),
          datasets: [{
            ...this.weightChartData.datasets[0]!,
            data: pts.map(p => Number(p.weightKg)),
          }],
        };
        this.weightLoading.set(false);
      },
      error: () => this.weightLoading.set(false),
    });
  }

  private loadWater(): void {
    this.waterLoading.set(true);
    this.metricsSvc.waterConsistency(this.waterDays()).subscribe({
      next: hist => {
        this.waterHistory.set(hist);
        this.waterChartData = {
          ...this.waterChartData,
          labels: hist.map(d => this.shortDate(d.date)),
          datasets: [
            { ...this.waterChartData.datasets[0]!, data: hist.map(d => d.goalMl) },
            { ...this.waterChartData.datasets[1]!, data: hist.map(d => d.consumedMl) },
          ],
        };
        this.waterLoading.set(false);
      },
      error: () => this.waterLoading.set(false),
    });
  }

  setWaterDays(d: number): void {
    this.waterDays.set(d);
    this.loadWater();
  }

  logWeight(): void {
    const w = this.newWeight();
    if (!w) return;
    this.savingWeight.set(true);
    this.metricsSvc.logWeight(w).subscribe({
      next: () => {
        this.savingWeight.set(false);
        this.newWeight.set(null);
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
}
