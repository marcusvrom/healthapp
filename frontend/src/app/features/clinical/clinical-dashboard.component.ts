import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { ClinicalService } from '../../core/services/clinical.service';
import { ProfileService } from '../../core/services/profile.service';
import { ClinicalReferenceService, StatusInfo } from '../../core/services/clinical-reference.service';
import { BloodTestFull, HormoneLog, Gender } from '../../core/models';

// ── Marker definitions ────────────────────────────────────────────────────────
interface MarkerDef {
  key: keyof BloodTestFull;
  label: string;
  unit: string;
  color: string;
}

const MARKERS: MarkerDef[] = [
  // Metabolic
  { key: 'glucoseMgDl',           label: 'Glicemia',              unit: 'mg/dL',  color: '#84cc16' },
  { key: 'insulinUiuMl',          label: 'Insulina',              unit: 'μIU/mL', color: '#a3e635' },
  { key: 'hba1cPct',              label: 'HbA1c',                 unit: '%',      color: '#65a30d' },
  // Lipid
  { key: 'cholesterolTotalMgDl',  label: 'Colesterol Total',      unit: 'mg/dL',  color: '#f59e0b' },
  { key: 'ldlMgDl',               label: 'LDL',                   unit: 'mg/dL',  color: '#ef4444' },
  { key: 'hdlMgDl',               label: 'HDL',                   unit: 'mg/dL',  color: '#10b981' },
  { key: 'triglyceridesMgDl',     label: 'Triglicerídeos',        unit: 'mg/dL',  color: '#f97316' },
  // Hormonal
  { key: 'testosteroneTotalNgDl', label: 'Testosterona Total',    unit: 'ng/dL',  color: '#6366f1' },
  { key: 'testosteroneFreeNgDl',  label: 'Testosterona Livre',    unit: 'ng/dL',  color: '#818cf8' },
  { key: 'estradiolPgMl',         label: 'Estradiol',             unit: 'pg/mL',  color: '#ec4899' },
  { key: 'shbgNmolL',             label: 'SHBG',                  unit: 'nmol/L', color: '#a78bfa' },
  { key: 'prolactinNgMl',         label: 'Prolactina',            unit: 'ng/mL',  color: '#c084fc' },
  { key: 'dhtPgMl',               label: 'DHT',                   unit: 'pg/mL',  color: '#7c3aed' },
  { key: 'fshMuiMl',              label: 'FSH',                   unit: 'mUI/mL', color: '#8b5cf6' },
  { key: 'lhMuiMl',               label: 'LH',                    unit: 'mUI/mL', color: '#9333ea' },
  { key: 'cortisolMcgDl',         label: 'Cortisol',              unit: 'μg/dL',  color: '#d97706' },
  // Thyroid
  { key: 'tshMiuL',               label: 'TSH',                   unit: 'mIU/L',  color: '#14b8a6' },
  { key: 't3FreePgMl',            label: 'T3 Livre',              unit: 'pg/mL',  color: '#0d9488' },
  { key: 't4FreeNgDl',            label: 'T4 Livre',              unit: 'ng/dL',  color: '#0f766e' },
  // Hepatic & Renal
  { key: 'astUL',                 label: 'AST/TGO',               unit: 'U/L',    color: '#dc2626' },
  { key: 'altUL',                 label: 'ALT/TGP',               unit: 'U/L',    color: '#b91c1c' },
  { key: 'gamaGtUL',              label: 'GGT',                   unit: 'U/L',    color: '#991b1b' },
  { key: 'creatinineMgDl',        label: 'Creatinina',            unit: 'mg/dL',  color: '#0284c7' },
  { key: 'ureaMgDl',              label: 'Ureia',                 unit: 'mg/dL',  color: '#0369a1' },
  // Vitamins & Inflammation
  { key: 'vitaminDNgMl',          label: 'Vitamina D',            unit: 'ng/mL',  color: '#eab308' },
  { key: 'vitaminB12PgMl',        label: 'Vitamina B12',          unit: 'pg/mL',  color: '#06b6d4' },
  { key: 'ferritinNgMl',          label: 'Ferritina',             unit: 'ng/mL',  color: '#7c3aed' },
  { key: 'crpMgL',                label: 'PCR-us',                unit: 'mg/L',   color: '#f43f5e' },
];

// ── Tab definitions ───────────────────────────────────────────────────────────
interface TabDef { id: string; label: string; icon: string; keys: string[]; }

const TABS: TabDef[] = [
  {
    id: 'overview', label: 'Visão Geral', icon: '📊',
    keys: ['glucoseMgDl', 'testosteroneTotalNgDl', 'ldlMgDl', 'hdlMgDl',
           'tshMiuL', 'vitaminDNgMl', 'crpMgL', 'creatinineMgDl'],
  },
  {
    id: 'hormonal', label: 'Painel Hormonal', icon: '⚗️',
    keys: ['testosteroneTotalNgDl', 'testosteroneFreeNgDl', 'estradiolPgMl',
           'shbgNmolL', 'prolactinNgMl', 'dhtPgMl', 'fshMuiMl', 'lhMuiMl', 'cortisolMcgDl'],
  },
  {
    id: 'thyroid',   label: 'Tireoide',         icon: '🦋',
    keys: ['tshMiuL', 't3FreePgMl', 't4FreeNgDl'],
  },
  {
    id: 'metabolic', label: 'Metabólico',       icon: '🍬',
    keys: ['glucoseMgDl', 'insulinUiuMl', 'hba1cPct',
           'cholesterolTotalMgDl', 'ldlMgDl', 'hdlMgDl', 'triglyceridesMgDl'],
  },
  {
    id: 'hepatic',   label: 'Hepático/Renal',  icon: '🫁',
    keys: ['astUL', 'altUL', 'gamaGtUL', 'creatinineMgDl', 'ureaMgDl'],
  },
  {
    id: 'vitamins',  label: 'Vitaminas',        icon: '💊',
    keys: ['vitaminDNgMl', 'vitaminB12PgMl', 'ferritinNgMl', 'crpMgL'],
  },
];

interface ChartPoint { x: number; y: number; value: number; date: string; }
interface SnapshotItem { marker: MarkerDef; value: number; status: StatusInfo; }

@Component({
  selector: 'app-clinical-dashboard',
  standalone: true,
  imports: [DecimalPipe, DatePipe],
  styles: [`
    .page { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
    .page-header { margin-bottom: 1.25rem; h2 { font-size: 1.5rem; } p { color: var(--color-text-muted); } }

    /* ── Tab navigation ─────────────────────────────────────────────────────── */
    .tab-nav {
      display: flex; gap: .375rem; flex-wrap: wrap; margin-bottom: 1.5rem;
      border-bottom: 1.5px solid var(--color-border); padding-bottom: .75rem;
    }
    .tab-btn {
      padding: .4rem .875rem; border-radius: var(--radius-sm) var(--radius-sm) 0 0;
      border: 1.5px solid transparent; background: transparent;
      cursor: pointer; font-size: .82rem; font-weight: 600;
      color: var(--color-text-muted); transition: .15s;
      display: flex; align-items: center; gap: .375rem;

      &:hover:not(.active) { background: var(--color-surface-2); color: var(--color-text); }
      &.active {
        background: var(--color-surface); border-color: var(--color-border);
        border-bottom-color: var(--color-surface); color: var(--color-primary);
        margin-bottom: -1.5px;
      }
    }

    /* ── Marker selector ────────────────────────────────────────────────────── */
    .marker-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: .5rem;
      margin-bottom: 1.5rem;
    }
    .marker-btn {
      display: flex; align-items: center; gap: .5rem;
      padding: .5rem .75rem; border-radius: var(--radius-sm);
      border: 1.5px solid var(--color-border); background: var(--color-surface);
      cursor: pointer; transition: .15s; text-align: left; min-width: 0;

      .dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
      .mlabel { font-size: .8rem; font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-text); }
      .mval   { font-size: .72rem; color: var(--color-text-muted); flex-shrink: 0; }

      &.active { border-color: var(--dot-color); background: color-mix(in srgb, var(--dot-color) 10%, transparent); }
      &:hover:not(.active) { background: var(--color-surface-2); }
    }

    /* ── Main chart area ────────────────────────────────────────────────────── */
    .chart-section { display: grid; grid-template-columns: 1fr 300px; gap: 1.5rem; margin-bottom: 1.5rem;
      @media (max-width: 900px) { grid-template-columns: 1fr; }
    }

    .chart-card {
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); padding: 1.25rem;

      .chart-title { font-size: .95rem; font-weight: 700; margin-bottom: 1rem;
        display: flex; align-items: center; gap: .5rem;
      }
      .chart-empty { height: 300px; display: flex; flex-direction: column; align-items: center;
        justify-content: center; gap: .75rem; color: var(--color-text-muted);
        .emoji { font-size: 2.5rem; }
      }
      .chart-container { position: relative; height: 300px; }
    }

    .svg-chart { width: 100%; height: 100%; overflow: visible; }
    .axis-line   { stroke: var(--color-border); stroke-width: 1; }
    .grid-line   { stroke: var(--color-border); stroke-width: 0.5; stroke-dasharray: 4 3; opacity: .5; }
    .axis-label  { font-size: 10px; fill: var(--color-text-subtle); font-family: inherit; }

    /* Zone lines */
    .zone-optimal-line  { stroke: #22c55e; stroke-width: 1.5; stroke-dasharray: 5 3; opacity: .7; }
    .zone-attention-line{ stroke: #f59e0b; stroke-width: 1.5; stroke-dasharray: 4 2; opacity: .7; }
    .zone-alert-line    { stroke: #ef4444; stroke-width: 1.5; stroke-dasharray: 3 2; opacity: .6; }
    .hormone-line       { stroke-width: 1.5; stroke-dasharray: 3 3; opacity: .7; }

    /* Zone legend strip */
    .legend-strip {
      display: flex; flex-wrap: wrap; gap: .625rem; margin-top: .75rem;
      .leg { display: flex; align-items: center; gap: .3rem; font-size: .72rem;
        .leg-dot { width: 10px; height: 10px; border-radius: 50%; }
        .leg-line { width: 18px; height: 2px; border-radius: 1px; }
      }
    }

    /* ── Sidebar ────────────────────────────────────────────────────────────── */
    .sidebar { display: flex; flex-direction: column; gap: 1rem; }
    .sidebar-card {
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); padding: 1.25rem;
      h4 { font-size: .875rem; font-weight: 700; margin-bottom: .875rem; }
    }

    .hormone-item {
      padding: .5rem 0; border-bottom: 1px solid var(--color-border);
      &:last-child { border-bottom: none; }
      .hname { font-size: .82rem; font-weight: 600; }
      .hmeta { font-size: .72rem; color: var(--color-text-muted); margin-top: .125rem; }
    }
    .cat-pills { display: flex; flex-wrap: wrap; gap: .375rem; margin-bottom: .875rem;
      .cpill { padding: .2rem .625rem; border-radius: 99px; font-size: .72rem; font-weight: 600;
        border: 1px solid var(--color-border); background: var(--color-surface-2); cursor: pointer;
        &.active { background: var(--color-primary); border-color: var(--color-primary); color: #fff; }
      }
    }

    /* ── Snapshot grid (último exame) ───────────────────────────────────────── */
    .snapshot-section {
      margin-top: .5rem;
      h4 { font-size: .875rem; font-weight: 700; margin-bottom: .75rem; }
    }
    .snapshot-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: .625rem;
    }
    .snapshot-card {
      background: var(--color-surface-2); border: 1px solid var(--color-border);
      border-radius: var(--radius-sm); padding: .75rem;
      cursor: pointer; transition: border-color .15s;
      &:hover { border-color: var(--color-primary-light); }

      .sc-label { font-size: .7rem; color: var(--color-text-muted); margin-bottom: .2rem;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sc-value { font-size: 1.2rem; font-weight: 800; line-height: 1; margin-bottom: .3rem; }
      .sc-unit  { font-size: .65rem; color: var(--color-text-subtle); margin-left: .15rem;
        font-weight: 400; }
    }

    /* ── Status badge ───────────────────────────────────────────────────────── */
    .status-badge {
      display: inline-flex; align-items: center; gap: .25rem;
      padding: .15rem .5rem; border-radius: 99px;
      font-size: .7rem; font-weight: 700; line-height: 1.4;
      &.optimal   { background: rgba(34,197,94,.15);  color: #16a34a; }
      &.normal    { background: rgba(59,130,246,.15);  color: #2563eb; }
      &.attention { background: rgba(234,179,8,.15);   color: #d97706; }
      &.alert     { background: rgba(239,68,68,.15);   color: #dc2626; }
    }

    /* ── Full-width snapshot bar (when no chart marker selected) ────────────── */
    .tab-summary-card {
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.5rem;
      h4 { font-size: .95rem; font-weight: 700; margin-bottom: 1rem; }
    }

    /* ── Empty states ───────────────────────────────────────────────────────── */
    .empty-state { text-align: center; padding: 3rem; color: var(--color-text-muted);
      .es-icon { font-size: 2.5rem; margin-bottom: .75rem; }
    }
  `],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>🩺 Dashboard Clínico</h2>
        <p>Acompanhe a evolução dos seus marcadores laboratoriais e doses hormonais ao longo do tempo.</p>
      </div>

      @if (loading()) {
        <div class="empty-state">
          <div class="spinner" style="margin: 0 auto 1rem"></div>
          Carregando dados clínicos...
        </div>
      } @else if (bloodTests().length === 0) {
        <div class="empty-state">
          <div class="es-icon">🩸</div>
          <p>Nenhum exame de sangue registrado ainda.<br>
             Cadastre exames na tela de Perfil para visualizar a evolução.</p>
        </div>
      } @else {

        <!-- ── Tab navigation ────────────────────────────────────────────── -->
        <nav class="tab-nav">
          @for (tab of tabs; track tab.id) {
            <button class="tab-btn" [class.active]="activeTab() === tab.id"
              (click)="switchTab(tab.id)">
              {{ tab.icon }} {{ tab.label }}
              @if (tabAlertCount(tab.id) > 0) {
                <span style="background:#ef4444;color:#fff;border-radius:99px;
                  font-size:.65rem;padding:.05rem .35rem;font-weight:800">
                  {{ tabAlertCount(tab.id) }}
                </span>
              }
            </button>
          }
        </nav>

        <!-- ── Marker selector (filtered to current tab) ────────────────── -->
        @if (tabMarkersWithData().length > 0) {
          <div class="marker-grid">
            @for (m of tabMarkersWithData(); track m.key) {
              <button class="marker-btn"
                [class.active]="selectedMarker() === m.key"
                [style]="'--dot-color:' + m.color"
                (click)="selectMarker(m.key)">
                <span class="dot" [style.background]="m.color"></span>
                <span class="mlabel">{{ m.label }}</span>
                <span class="mval">{{ latestValue(m.key) | number:'1.0-2' }}</span>
              </button>
            }
          </div>
        }

        <!-- ── Chart + sidebar (only when a marker is selected) ─────────── -->
        @if (activeMarker(); as am) {
          <div class="chart-section">

            <!-- Line chart -->
            <div class="chart-card">
              <div class="chart-title">
                <span class="dot" style="width:10px;height:10px;border-radius:50%;flex-shrink:0"
                  [style.background]="am.color"></span>
                📈 {{ am.label }} ({{ am.unit }})
              </div>

              @if (chartPoints().length < 2) {
                <div class="chart-empty">
                  <span class="emoji">📉</span>
                  <p>Registre pelo menos 2 exames para visualizar a evolução.</p>
                </div>
              } @else {
                <div class="chart-container">
                  <svg class="svg-chart" [attr.viewBox]="'0 0 ' + W + ' ' + H" preserveAspectRatio="xMidYMid meet">

                    <!-- Grid lines + Y labels -->
                    @for (t of yTicks(); track t.y) {
                      <line class="grid-line" [attr.x1]="padL" [attr.x2]="W - padR" [attr.y1]="t.y" [attr.y2]="t.y"/>
                      <text class="axis-label" [attr.x]="padL - 4" [attr.y]="t.y + 3" text-anchor="end">{{ t.label }}</text>
                    }

                    <!-- ① Alert zone lines -->
                    @for (ln of alertLines(); track ln.y) {
                      <line class="zone-alert-line"
                        [attr.x1]="padL" [attr.x2]="W - padR" [attr.y1]="ln.y" [attr.y2]="ln.y"/>
                    }

                    <!-- ② Attention zone lines -->
                    @for (ln of attentionLines(); track ln.y) {
                      <line class="zone-attention-line"
                        [attr.x1]="padL" [attr.x2]="W - padR" [attr.y1]="ln.y" [attr.y2]="ln.y"/>
                    }

                    <!-- ③ Optimal zone — green filled band -->
                    @if (optimalBand(); as band) {
                      <rect [attr.x]="padL" [attr.y]="band.top"
                        [attr.width]="W - padL - padR"
                        [attr.height]="band.bottom - band.top"
                        fill="#22c55e" fill-opacity="0.10"/>
                      <line class="zone-optimal-line"
                        [attr.x1]="padL" [attr.x2]="W - padR" [attr.y1]="band.top" [attr.y2]="band.top"/>
                      <line class="zone-optimal-line"
                        [attr.x1]="padL" [attr.x2]="W - padR" [attr.y1]="band.bottom" [attr.y2]="band.bottom"/>
                    }

                    <!-- Hormone dose overlay lines -->
                    @for (hl of filteredHormoneLogs(); track hl.id) {
                      <line class="hormone-line"
                        [attr.x1]="hormoneX(hl)" [attr.x2]="hormoneX(hl)"
                        [attr.y1]="padT" [attr.y2]="H - padB"
                        stroke="#6366f1"/>
                    }

                    <!-- Area fill -->
                    <path [attr.d]="areaPath()" [attr.fill]="am.color" fill-opacity="0.10"/>

                    <!-- Main line -->
                    <path [attr.d]="linePath()" fill="none"
                      [attr.stroke]="am.color" stroke-width="2.5"
                      stroke-linejoin="round" stroke-linecap="round"/>

                    <!-- Dots with status color ring -->
                    @for (pt of chartPoints(); track pt.date) {
                      <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="6"
                        [attr.fill]="pointStatusColor(pt.value)" stroke="#fff" stroke-width="2.5"/>
                      <text class="axis-label" [attr.x]="pt.x" [attr.y]="pt.y - 11"
                        text-anchor="middle" [attr.fill]="am.color">
                        {{ pt.value | number:'1.0-1' }}
                      </text>
                    }

                    <!-- X labels -->
                    @for (pt of chartPoints(); track pt.date) {
                      <text class="axis-label" [attr.x]="pt.x" [attr.y]="H - padB + 14" text-anchor="middle">
                        {{ shortDate(pt.date) }}
                      </text>
                    }

                    <!-- Axes -->
                    <line class="axis-line" [attr.x1]="padL" [attr.x2]="padL" [attr.y1]="padT" [attr.y2]="H - padB"/>
                    <line class="axis-line" [attr.x1]="padL" [attr.x2]="W - padR" [attr.y1]="H - padB" [attr.y2]="H - padB"/>
                  </svg>
                </div>

                <!-- Legend -->
                <div class="legend-strip">
                  <div class="leg">
                    <div class="leg-dot" [style.background]="am.color"></div>
                    {{ am.label }}
                  </div>
                  <div class="leg">
                    <div class="leg-line" style="background:#22c55e;opacity:.7;border-style:dashed;border-width:1px;border-color:#22c55e;background:none"></div>
                    Faixa ideal
                  </div>
                  <div class="leg">
                    <div class="leg-line" style="background:none;border-style:dashed;border-width:1px;border-color:#f59e0b"></div>
                    Limite atenção
                  </div>
                  @if (filteredHormoneLogs().length > 0) {
                    <div class="leg">
                      <div class="leg-dot" style="background:#6366f1;opacity:.7"></div>
                      Dose hormonal
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Sidebar: snapshot + hormone log -->
            <div class="sidebar">

              <!-- Last exam status for active tab markers -->
              @if (snapshotItems().length > 0) {
                <div class="sidebar-card">
                  <h4>🔬 Último Exame · {{ lastExamDate() | date:'dd/MM/yyyy' }}</h4>
                  @for (item of snapshotItems(); track item.marker.key) {
                    <div style="display:flex;align-items:center;justify-content:space-between;
                      padding:.4rem 0;border-bottom:1px solid var(--color-border);"
                      [style.border-bottom-color]="'var(--color-border)'"
                      style="cursor:pointer"
                      (click)="selectMarker(item.marker.key)">
                      <div>
                        <div style="font-size:.72rem;color:var(--color-text-muted)">{{ item.marker.label }}</div>
                        <div style="font-size:.95rem;font-weight:700">
                          {{ item.value | number:'1.0-2' }}
                          <span style="font-size:.65rem;color:var(--color-text-subtle);font-weight:400">{{ item.marker.unit }}</span>
                        </div>
                      </div>
                      <span class="status-badge" [class]="item.status.status">
                        {{ item.status.dot }} {{ item.status.label }}
                      </span>
                    </div>
                  }
                </div>
              }

              <!-- Hormone log -->
              <div class="sidebar-card">
                <h4>💉 Log Hormonal</h4>
                <div class="cat-pills">
                  @for (cat of hormoneCategories; track cat) {
                    <span class="cpill" [class.active]="hormoneFilter() === cat"
                      (click)="setHormoneFilter(cat)">{{ cat }}</span>
                  }
                </div>
                @for (hl of filteredHormoneLogs().slice(-8).reverse(); track hl.id) {
                  <div class="hormone-item">
                    <div class="hname">{{ hl.name }} {{ hl.dosage }}{{ hl.unit }}</div>
                    <div class="hmeta">{{ hl.administeredAt | date:'dd/MM/yy HH:mm' }} · {{ hl.category }}</div>
                  </div>
                }
                @if (filteredHormoneLogs().length === 0) {
                  <p style="font-size:.82rem;color:var(--color-text-muted)">Sem registros hormonais.</p>
                }
              </div>
            </div>
          </div>
        } @else {

          <!-- No marker selected: show full-width snapshot for the tab -->
          @if (snapshotItems().length > 0) {
            <div class="tab-summary-card">
              <h4>🔬 Último Exame — {{ activeTabDef()?.label }}
                <span style="font-size:.75rem;color:var(--color-text-muted);font-weight:400;margin-left:.5rem">
                  {{ lastExamDate() | date:'dd/MM/yyyy' }}
                </span>
              </h4>
              <div class="snapshot-grid">
                @for (item of snapshotItems(); track item.marker.key) {
                  <div class="snapshot-card" (click)="selectMarker(item.marker.key)">
                    <div class="sc-label">{{ item.marker.label }}</div>
                    <div class="sc-value" [style.color]="item.status.color">
                      {{ item.value | number:'1.0-2' }}
                      <span class="sc-unit">{{ item.marker.unit }}</span>
                    </div>
                    <span class="status-badge" [class]="item.status.status">
                      {{ item.status.dot }} {{ item.status.label }}
                    </span>
                  </div>
                }
              </div>
            </div>
          } @else {
            <div class="empty-state">
              <div class="es-icon">🩸</div>
              <p>Nenhum dado para esta categoria ainda.<br>
                 Cadastre exames no Perfil para visualizar aqui.</p>
            </div>
          }
        }

      }
    </div>
  `,
})
export class ClinicalDashboardComponent implements OnInit {
  private clinicalSvc = inject(ClinicalService);
  private profileSvc  = inject(ProfileService);
  private refSvc      = inject(ClinicalReferenceService);

  readonly W = 540; readonly H = 300;
  readonly padL = 48; readonly padR = 16; readonly padT = 20; readonly padB = 28;

  readonly tabs = TABS;
  readonly hormoneCategories = ['TRT', 'Female_Hormones', 'Sleep', 'Other', 'Todas'] as const;

  loading        = signal(true);
  bloodTests     = signal<BloodTestFull[]>([]);
  hormoneLogs    = signal<HormoneLog[]>([]);
  selectedMarker = signal<keyof BloodTestFull | null>(null);
  hormoneFilter  = signal<string>('Todas');
  activeTab      = signal<string>('overview');

  // ── Profile gender for gender-aware ranges ──────────────────────────────────
  userGender = computed((): Gender => this.profileSvc.profile()?.gender ?? 'male');

  // ── Tab helpers ─────────────────────────────────────────────────────────────
  activeTabDef = computed(() => TABS.find(t => t.id === this.activeTab()) ?? TABS[0]!);

  tabMarkersWithData = computed(() => {
    const keys = this.activeTabDef().keys;
    return MARKERS.filter(m => keys.includes(m.key as string) && this.hasData(m.key));
  });

  tabAlertCount(tabId: string): number {
    const tab = TABS.find(t => t.id === tabId);
    if (!tab) return 0;
    const last = this.bloodTests().at(-1);
    if (!last) return 0;
    const gender = this.userGender();
    return tab.keys.filter(key => {
      const v = last[key as keyof BloodTestFull] as number | undefined;
      if (v == null) return false;
      const s = this.refSvc.classify(key, v, gender);
      return s.status === 'alert';
    }).length;
  }

  // ── Derived: active marker ──────────────────────────────────────────────────
  activeMarker = computed(() => {
    const key = this.selectedMarker();
    return key ? (MARKERS.find(m => m.key === key) ?? null) : null;
  });

  // ── Derived: snapshot ───────────────────────────────────────────────────────
  lastExamForTab = computed((): BloodTestFull | null => {
    const tab = this.activeTabDef();
    const tests = this.bloodTests();
    if (!tests.length) return null;
    for (let i = tests.length - 1; i >= 0; i--) {
      const bt = tests[i]!;
      if (tab.keys.some(k => bt[k as keyof BloodTestFull] != null)) return bt;
    }
    return null;
  });

  lastExamDate = computed((): string => this.lastExamForTab()?.collectedAt ?? '');

  snapshotItems = computed((): SnapshotItem[] => {
    const tab = this.activeTabDef();
    const bt = this.lastExamForTab();
    const gender = this.userGender();
    if (!bt) return [];
    return tab.keys
      .map(key => {
        const marker = MARKERS.find(m => m.key === key);
        const value = bt[key as keyof BloodTestFull] as number | undefined;
        if (!marker || value == null) return null;
        return { marker, value, status: this.refSvc.classify(key, value, gender) };
      })
      .filter((x): x is SnapshotItem => x != null);
  });

  // ── Derived: hormone log ────────────────────────────────────────────────────
  filteredHormoneLogs = computed(() => {
    const cat = this.hormoneFilter();
    const logs = this.hormoneLogs();
    return cat === 'Todas' ? logs : logs.filter(h => h.category === cat);
  });

  // ── Chart geometry ──────────────────────────────────────────────────────────
  private seriesValues = computed((): number[] => {
    const key = this.selectedMarker();
    if (!key) return [];
    return this.bloodTests()
      .map(bt => bt[key] as number | undefined)
      .filter((v): v is number => v != null);
  });

  yRange = computed(() => {
    const vals = this.seriesValues();
    if (!vals.length) return { min: 0, max: 100 };
    const key = this.selectedMarker() as string;
    const range = this.refSvc.getRange(key, this.userGender());
    const allVals = [
      ...vals,
      ...(range?.attentionLow  != null ? [range.attentionLow]  : []),
      ...(range?.attentionHigh != null ? [range.attentionHigh] : []),
    ];
    const pad = (Math.max(...allVals) - Math.min(...allVals)) * 0.12 || 5;
    return { min: Math.max(0, Math.min(...allVals) - pad), max: Math.max(...allVals) + pad };
  });

  private scaleY = computed(() => {
    const { min, max } = this.yRange();
    const h = this.H - this.padT - this.padB;
    return (v: number) => this.padT + h - ((v - min) / (max - min)) * h;
  });

  private dateRange = computed(() => {
    const key = this.selectedMarker();
    const tests = this.bloodTests().filter(bt => key && bt[key] != null);
    if (!tests.length) return { min: 0, max: 1 };
    const dates = tests.map(bt => new Date(bt.collectedAt).getTime());
    return { min: Math.min(...dates), max: Math.max(...dates) };
  });

  private scaleX = computed(() => {
    const { min, max } = this.dateRange();
    const w = this.W - this.padL - this.padR;
    const span = max - min || 1;
    return (ts: number) => this.padL + ((ts - min) / span) * w;
  });

  chartPoints = computed((): ChartPoint[] => {
    const key = this.selectedMarker();
    if (!key) return [];
    return this.bloodTests()
      .filter(bt => bt[key] != null)
      .map(bt => ({
        x: this.scaleX()(new Date(bt.collectedAt).getTime()),
        y: this.scaleY()(bt[key] as number),
        value: bt[key] as number,
        date: bt.collectedAt,
      }));
  });

  linePath = computed((): string => {
    const pts = this.chartPoints();
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  });

  areaPath = computed((): string => {
    const pts = this.chartPoints();
    if (!pts.length) return '';
    const base = this.H - this.padB;
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    return `${line} L${pts.at(-1)!.x.toFixed(1)},${base} L${pts[0]!.x.toFixed(1)},${base} Z`;
  });

  yTicks = computed(() => {
    const { min, max } = this.yRange();
    const sy = this.scaleY();
    const step = (max - min) / 4;
    return Array.from({ length: 5 }, (_, i) => {
      const v = min + step * i;
      return { y: sy(v), label: v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(v < 10 ? 1 : 0) };
    });
  });

  // ── Chart zone bands ────────────────────────────────────────────────────────
  private activeRange = computed(() => {
    const key = this.selectedMarker();
    if (!key) return null;
    return this.refSvc.getRange(key as string, this.userGender());
  });

  private clampedY(value: number): number | null {
    const { min, max } = this.yRange();
    if (value > max || value < min) return null;
    return this.scaleY()(value);
  }

  optimalBand = computed((): { top: number; bottom: number } | null => {
    const r = this.activeRange();
    if (!r) return null;
    const { min: yMin, max: yMax } = this.yRange();
    const oMax = Math.min(r.optimalMax, yMax);
    const oMin = Math.max(r.optimalMin, yMin);
    if (oMin >= oMax) return null;
    return { top: this.scaleY()(oMax), bottom: this.scaleY()(oMin) };
  });

  attentionLines = computed((): { y: number }[] => {
    const r = this.activeRange();
    if (!r) return [];
    const lines: { y: number }[] = [];
    const ah = r.attentionHigh != null ? this.clampedY(r.attentionHigh) : null;
    const al = r.attentionLow  != null ? this.clampedY(r.attentionLow)  : null;
    if (ah != null) lines.push({ y: ah });
    if (al != null) lines.push({ y: al });
    return lines;
  });

  alertLines = computed((): { y: number }[] => {
    const r = this.activeRange();
    if (!r) return [];
    const lines: { y: number }[] = [];
    const ah = r.alertHigh != null ? this.clampedY(r.alertHigh) : null;
    const al = r.alertLow  != null ? this.clampedY(r.alertLow)  : null;
    if (ah != null) lines.push({ y: ah });
    if (al != null) lines.push({ y: al });
    return lines;
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.profileSvc.loadProfile().subscribe({ error: () => {} });
    this.clinicalSvc.history(730).subscribe({
      next: data => {
        this.bloodTests.set(data.bloodTests);
        this.hormoneLogs.set(data.hormoneLogs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  hasData(key: keyof BloodTestFull): boolean {
    return this.bloodTests().some(bt => bt[key] != null);
  }

  latestValue(key: keyof BloodTestFull): number | null {
    const tests = this.bloodTests().filter(bt => bt[key] != null);
    return tests.length ? (tests.at(-1)![key] as number) : null;
  }

  selectMarker(key: keyof BloodTestFull): void {
    this.selectedMarker.set(this.selectedMarker() === key ? null : key);
  }

  switchTab(id: string): void {
    this.activeTab.set(id);
    // Auto-select first marker with data in the new tab, or clear
    const tab = TABS.find(t => t.id === id);
    if (!tab) { this.selectedMarker.set(null); return; }
    const first = tab.keys.find(k => this.hasData(k as keyof BloodTestFull));
    this.selectedMarker.set(first ? (first as keyof BloodTestFull) : null);
  }

  setHormoneFilter(cat: string): void {
    this.hormoneFilter.set(cat);
  }

  hormoneX(hl: HormoneLog): number {
    return this.scaleX()(new Date(hl.administeredAt).getTime());
  }

  shortDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  /** Returns the status color for a data point dot. */
  pointStatusColor(value: number): string {
    const key = this.selectedMarker();
    if (!key) return '#6b7280';
    const s = this.refSvc.classify(key as string, value, this.userGender());
    return s.color;
  }
}
