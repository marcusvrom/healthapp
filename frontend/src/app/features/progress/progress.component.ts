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

      .chart-container { position: relative; height: 240px; overflow: hidden; }

      .chart-empty { height: 240px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .75rem;
        color: var(--color-text-muted);
        .emoji { font-size: 2rem; }
        p { font-size: .85rem; text-align: center; }
      }
    }

    /* SVG chart */
    .svg-chart { width: 100%; height: 100%; overflow: visible; }

    .axis-line { stroke: var(--color-border); stroke-width: 1; }
    .grid-line { stroke: var(--color-border); stroke-width: 0.5; stroke-dasharray: 4 3; opacity: .6; }
    .axis-label { font-size: 10px; fill: var(--color-text-subtle); font-family: inherit; }
    .data-label { font-size: 9px; fill: var(--color-text-muted); font-family: inherit; }

    /* Line chart */
    .line-path { fill: none; stroke: #10b981; stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
    .line-area { fill: url(#areaGrad); opacity: .25; }
    .line-dot  { fill: #10b981; }

    /* Bar chart */
    .bar-goal     { fill: rgba(14,165,233,.25); rx: 3; }
    .bar-consumed { fill: rgba(16,185,129,.7); rx: 3; }

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

    /* ── Copilot section ─────────────────────────────────────────────────────── */
    .copilot-section {
      margin-top: 2rem;

      .section-header {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 1rem;
        h2 { font-size: 1.05rem; font-weight: 700; }
        a { font-size: .8rem; }
      }
    }

    .insight-cards { display: flex; flex-direction: column; gap: .875rem; }

    .insight-card {
      border-radius: var(--radius-md); padding: 1rem 1.25rem;
      border-left: 4px solid transparent;
      display: flex; gap: .875rem; align-items: flex-start;

      &.warning { background: var(--color-secondary); border-left-color: #f59e0b; }
      &.success { background: var(--color-secondary); border-left-color: #22c55e; }
      &.tip     { background: var(--color-secondary); border-left-color: #3b82f6; }
      &.info    { background: var(--color-secondary); border-left-color: #8b5cf6; }

      .ic-icon { font-size: 1.5rem; flex-shrink: 0; line-height: 1; margin-top: .1rem; }
      .ic-body  { flex: 1; min-width: 0;
        h4 { font-size: .88rem; font-weight: 700; margin-bottom: .3rem; }
        p  { font-size: .82rem; line-height: 1.5; color: var(--color-text-muted); }
        .ic-action {
          display: inline-block; margin-top: .5rem;
          font-size: .75rem; font-weight: 700; color: var(--color-primary);
          text-decoration: none;
          background: var(--color-primary-light); padding: .2rem .6rem;
          border-radius: 99px; cursor: pointer;
        }
      }
    }

    .checkin-chart-card {
      margin-top: 24px;
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.5rem;

      .chart-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;
        h3 { font-size: .95rem; font-weight: 700; }
        a  { font-size: .78rem; font-weight: 600; }
      }
    }

    /* ── Ranking section ─────────────────────────────────────────────────────── */
    .ranking-section {
      margin-top: 2rem;

      .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;
        h2 { font-size: 1.05rem; font-weight: 700; }
        .period-pill { font-size: .72rem; font-weight: 600; background: var(--color-primary-light);
          color: var(--color-primary-dark); padding: .2rem .65rem; border-radius: 99px; }
      }
    }

    .ranking-list { display: flex; flex-direction: column; gap: .5rem; }

    .ranking-item {
      display: flex; align-items: center; gap: .875rem; padding: .75rem 1rem;
      border: 1px solid var(--color-border); border-radius: var(--radius-md);
      background: var(--color-bg); transition: box-shadow .15s;
      &:hover { box-shadow: var(--shadow-sm); }
      &.rank-1 { border-color: #fcd34d; }
      &.rank-2 { border-color: #d1d5db; }
      &.rank-3 { border-color: #b66303; }
      &.is-me  { border-color: var(--color-primary); }

      .rank-pos { font-size: 1.1rem; font-weight: 800; min-width: 28px; text-align: center; }
      .rank-avatar {
        width: 36px; height: 36px; border-radius: 50%; object-fit: cover;
        background: var(--color-primary-light); display: flex; align-items: center;
        justify-content: center; font-size: .9rem; font-weight: 700;
        color: var(--color-primary-dark); flex-shrink: 0;
      }
      .rank-info { flex: 1; min-width: 0;
        .rank-name  { font-size: .88rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rank-level { font-size: .72rem; color: var(--color-text-muted); }
      }
      .rank-xp { text-align: right; flex-shrink: 0;
        .xp-val   { font-size: 1rem; font-weight: 800; color: var(--color-primary); }
        .xp-label { font-size: .65rem; color: var(--color-text-muted); }
      }
    }

    /* ── Daily caps widget ───────────────────────────────────────────────────── */
    .caps-card {
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.5rem;

      h3 { font-size: .95rem; font-weight: 700; margin-bottom: 1rem; }
    }

    .cap-rows { display: flex; flex-direction: column; gap: .625rem; }

    .cap-row {
      display: flex; align-items: center; gap: .75rem;
      .cap-icon { font-size: 1rem; width: 1.25rem; text-align: center; flex-shrink: 0; }
      .cap-label { font-size: .78rem; font-weight: 600; min-width: 90px; }
      .cap-bar-track { flex: 1; height: 6px; background: var(--color-border); border-radius: 99px; overflow: hidden;
        .cap-bar-fill { height: 100%; border-radius: 99px; transition: width .4s; }
      }
      .cap-text { font-size: .72rem; color: var(--color-text-muted); min-width: 60px; text-align: right; }
    }

    .checkin-table {
      margin-top: 1rem;
      table { width: 100%; border-collapse: collapse; font-size: .78rem;
        th { text-align: left; color: var(--color-text-subtle); font-weight: 600; padding: .25rem .5rem; border-bottom: 1px solid var(--color-border); }
        td { padding: .35rem .5rem; border-bottom: 1px solid var(--color-border); }
        tr:last-child td { border-bottom: none; }
        .stars { letter-spacing: 1px; }
      }
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
        <div class="streak-card" [class.on-fire]="(streaks()?.waterCurrentStreak ?? 0) >= 3">
          <span class="streak-icon">{{ (streaks()?.waterCurrentStreak ?? 0) >= 3 ? '🔥' : '💧' }}</span>
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
                  <input type="number" [(ngModel)]="newWeightVal" placeholder="kg" min="20" max="300" step="0.1"
                    style="width:80px;padding:.35rem .5rem;border:1.5px solid var(--color-border);border-radius:6px;font-size:.82rem" />
                </div>
                <button class="btn btn-primary btn-sm" (click)="logWeight()" [disabled]="!newWeightVal || savingWeight()">
                  {{ savingWeight() ? '...' : '+ Peso' }}
                </button>
              </div>
            </div>
          </div>

          @if (weightLoading()) {
            <div class="chart-empty"><span class="spinner"></span></div>
          } @else if (weightPoints().length < 2) {
            <div class="chart-empty">
              <span class="emoji">⚖️</span>
              <p>Registre pelo menos 2 pesagens<br>para ver o gráfico de evolução.</p>
            </div>
          } @else {
            <div class="chart-container">
              <svg class="svg-chart" [attr.viewBox]="'0 0 ' + svgW + ' ' + svgH" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#10b981" stop-opacity=".4"/>
                    <stop offset="100%" stop-color="#10b981" stop-opacity="0"/>
                  </linearGradient>
                </defs>
                <!-- Grid lines -->
                @for (tick of weightYTicks(); track tick.y) {
                  <line class="grid-line" [attr.x1]="padL" [attr.x2]="svgW - padR" [attr.y1]="tick.y" [attr.y2]="tick.y"/>
                  <text class="axis-label" [attr.x]="padL - 4" [attr.y]="tick.y + 3" text-anchor="end">{{ tick.label }}</text>
                }
                <!-- X labels -->
                @for (pt of weightXLabels(); track pt.x) {
                  <text class="axis-label" [attr.x]="pt.x" [attr.y]="svgH - padB + 14" text-anchor="middle">{{ pt.label }}</text>
                }
                <!-- Area fill -->
                <path class="line-area" [attr.d]="weightAreaPath()"/>
                <!-- Line -->
                <path class="line-path" [attr.d]="weightLinePath()"/>
                <!-- Dots -->
                @for (pt of weightDots(); track pt.x) {
                  <circle class="line-dot" [attr.cx]="pt.x" [attr.cy]="pt.y" r="4"/>
                }
                <!-- Axes -->
                <line class="axis-line" [attr.x1]="padL" [attr.x2]="padL" [attr.y1]="padT" [attr.y2]="svgH - padB"/>
                <line class="axis-line" [attr.x1]="padL" [attr.x2]="svgW - padR" [attr.y1]="svgH - padB" [attr.y2]="svgH - padB"/>
              </svg>
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
              <svg class="svg-chart" [attr.viewBox]="'0 0 ' + svgW + ' ' + svgH" preserveAspectRatio="xMidYMid meet">
                <!-- Grid lines -->
                @for (tick of waterYTicks(); track tick.y) {
                  <line class="grid-line" [attr.x1]="padL" [attr.x2]="svgW - padR" [attr.y1]="tick.y" [attr.y2]="tick.y"/>
                  <text class="axis-label" [attr.x]="padL - 4" [attr.y]="tick.y + 3" text-anchor="end">{{ tick.label }}</text>
                }
                <!-- Bars -->
                @for (bar of waterBars(); track bar.x) {
                  <!-- Goal bar -->
                  <rect class="bar-goal"
                    [attr.x]="bar.x" [attr.y]="bar.goalY"
                    [attr.width]="bar.w / 2 - 1" [attr.height]="bar.goalH"
                    rx="3"/>
                  <!-- Consumed bar -->
                  <rect class="bar-consumed"
                    [attr.x]="bar.x + bar.w / 2" [attr.y]="bar.consumedY"
                    [attr.width]="bar.w / 2 - 1" [attr.height]="bar.consumedH"
                    rx="3"/>
                  <!-- X label -->
                  <text class="axis-label" [attr.x]="bar.x + bar.w / 2" [attr.y]="svgH - padB + 14" text-anchor="middle">{{ bar.label }}</text>
                }
                <!-- Axes -->
                <line class="axis-line" [attr.x1]="padL" [attr.x2]="padL" [attr.y1]="padT" [attr.y2]="svgH - padB"/>
                <line class="axis-line" [attr.x1]="padL" [attr.x2]="svgW - padR" [attr.y1]="svgH - padB" [attr.y2]="svgH - padB"/>
              </svg>
            </div>
            <!-- Legend -->
            <div style="display:flex;gap:.75rem;margin-top:.5rem;font-size:.72rem;color:var(--color-text-muted)">
              <span style="display:flex;align-items:center;gap:.3rem">
                <span style="width:12px;height:12px;background:rgba(14,165,233,.4);border-radius:2px;display:inline-block"></span> Meta
              </span>
              <span style="display:flex;align-items:center;gap:.3rem">
                <span style="width:12px;height:12px;background:rgba(16,185,129,.7);border-radius:2px;display:inline-block"></span> Consumido
              </span>
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

      <!-- ── Check-in weight chart ──────────────────────────────────────────── -->
      @if (checkIns().length > 0) {
        <div class="checkin-chart-card">
          <div class="chart-header">
            <h3>📸 Progresso por Check-in Semanal</h3>
            <a routerLink="/check-in">+ Novo Check-in</a>
          </div>

          @if (checkIns().length >= 2) {
            <div class="chart-container">
              <svg class="svg-chart" [attr.viewBox]="'0 0 ' + svgW + ' ' + svgH" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <linearGradient id="ciAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#8b5cf6" stop-opacity=".4"/>
                    <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0"/>
                  </linearGradient>
                </defs>
                @for (tick of ciYTicks(); track tick.y) {
                  <line class="grid-line" [attr.x1]="padL" [attr.x2]="svgW - padR" [attr.y1]="tick.y" [attr.y2]="tick.y"/>
                  <text class="axis-label" [attr.x]="padL - 4" [attr.y]="tick.y + 3" text-anchor="end">{{ tick.label }}</text>
                }
                @for (pt of ciXLabels(); track pt.x) {
                  <text class="axis-label" [attr.x]="pt.x" [attr.y]="svgH - padB + 14" text-anchor="middle">{{ pt.label }}</text>
                }
                <path style="fill:url(#ciAreaGrad);opacity:.25" [attr.d]="ciAreaPath()"/>
                <path style="fill:none;stroke:#8b5cf6;stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round" [attr.d]="ciLinePath()"/>
                @for (pt of ciDots(); track pt.x) {
                  <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="4" fill="#8b5cf6"/>
                  @if (pt.adherence) {
                    <text class="data-label" [attr.x]="pt.x" [attr.y]="pt.y - 7" text-anchor="middle">{{ pt.adherence }}★</text>
                  }
                }
                <line class="axis-line" [attr.x1]="padL" [attr.x2]="padL" [attr.y1]="padT" [attr.y2]="svgH - padB"/>
                <line class="axis-line" [attr.x1]="padL" [attr.x2]="svgW - padR" [attr.y1]="svgH - padB" [attr.y2]="svgH - padB"/>
              </svg>
            </div>
          } @else {
            <div class="chart-empty">
              <span class="emoji">📸</span>
              <p>Faça pelo menos 2 check-ins para ver o gráfico de evolução.</p>
            </div>
          }

          <div class="checkin-table">
            <table>
              <thead>
                <tr><th>Data</th><th>Peso (kg)</th><th>Cintura</th><th>Adesão</th><th>Notas</th></tr>
              </thead>
              <tbody>
                @for (ci of checkIns(); track ci.id) {
                  <tr>
                    <td>{{ ci.date | date:'dd/MM/yy' }}</td>
                    <td>{{ ci.currentWeight | number:'1.1-1' }}</td>
                    <td>{{ ci.waistCircumference ? (ci.waistCircumference + ' cm') : '—' }}</td>
                    <td class="stars">{{ starsFor(ci.adherenceScore) }}</td>
                    <td style="color:var(--color-text-muted);font-size:.72rem">{{ ci.notes || '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- ── Copilot insights ────────────────────────────────────────────────── -->
      <div class="copilot-section">
        <div class="section-header">
          <h2>🤖 Insights do Copiloto</h2>
          <a routerLink="/check-in">Fazer Check-in</a>
        </div>

        @if (insightsLoading()) {
          <div style="text-align:center;padding:2rem"><span class="spinner"></span></div>
        } @else {
          <div class="insight-cards">
            @for (ins of insights(); track ins.title) {
              <div class="insight-card" [class]="ins.type">
                <span class="ic-icon">{{ insightIcon(ins.type) }}</span>
                <div class="ic-body">
                  <h4>{{ ins.title }}</h4>
                  <p>{{ ins.message }}</p>
                  @if (ins.action) {
                    <a class="ic-action" routerLink="/check-in">{{ ins.action }}</a>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- ── Daily XP Caps ────────────────────────────────────────────────── -->
      @if (dailyCaps().length > 0) {
        <div class="caps-card" style="margin-top:2rem">
          <h3>⚡ Orçamento de XP de Hoje</h3>
          <div class="cap-rows">
            @for (c of dailyCaps(); track c.category) {
              <div class="cap-row">
                <span class="cap-icon">{{ capIcon(c.category) }}</span>
                <span class="cap-label">{{ capLabel(c.category) }}</span>
                <div class="cap-bar-track">
                  <div class="cap-bar-fill"
                    [style.width]="capPct(c) + '%'"
                    [style.background]="c.remaining === 0 ? '#ef4444' : 'var(--color-primary)'">
                  </div>
                </div>
                <span class="cap-text">
                  @if (c.remaining === 0) { Limite ✓ }
                  @else { +{{ c.remaining }} XP }
                </span>
              </div>
            }
          </div>
        </div>
      }

      <!-- ── Weekly Ranking ────────────────────────────────────────────────── -->
      <div class="ranking-section">
        <div class="section-header">
          <h2>🏆 Ranking Semanal</h2>
          <span class="period-pill">Últimos 7 dias</span>
        </div>

        @if (rankingLoading()) {
          <div style="text-align:center;padding:2rem"><span class="spinner"></span></div>
        } @else if (ranking().length === 0) {
          <div class="chart-empty">
            <span class="emoji">🏆</span>
            <p>Nenhum XP registrado esta semana ainda. Seja o primeiro!</p>
          </div>
        } @else {
          <div class="ranking-list">
            @for (entry of ranking(); track entry.userId; let i = $index) {
              <div class="ranking-item"
                [class.rank-1]="i === 0" [class.rank-2]="i === 1"
                [class.rank-3]="i === 2" [class.is-me]="entry.userId === myUserId()">
                <span class="rank-pos">{{ rankMedal(i) }}</span>
                @if (entry.avatarUrl) {
                  <img class="rank-avatar" [src]="img(entry.avatarUrl)" [alt]="entry.name">
                } @else {
                  <div class="rank-avatar">{{ entry.name.charAt(0).toUpperCase() }}</div>
                }
                <div class="rank-info">
                  <div class="rank-name">{{ entry.name }}{{ entry.userId === myUserId() ? ' (você)' : '' }}</div>
                  <div class="rank-level">Nível {{ entry.level }} · {{ entry.levelTitle }}</div>
                </div>
                <div class="rank-xp">
                  <div class="xp-val">{{ entry.weeklyXp }}</div>
                  <div class="xp-label">XP na semana</div>
                </div>
              </div>
            }
          </div>
        }
      </div>

    </div>
  `,
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
