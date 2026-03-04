import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { ClinicalService } from '../../core/services/clinical.service';
import { BloodTestFull, HormoneLog } from '../../core/models';

// ── Marker definitions ────────────────────────────────────────────────────────
interface MarkerDef {
  key: keyof BloodTestFull;
  label: string;
  unit: string;
  color: string;
  refMin?: number;
  refMax?: number;
}

const MARKERS: MarkerDef[] = [
  { key: 'testosteroneTotalNgDl', label: 'Testosterona Total',  unit: 'ng/dL', color: '#6366f1', refMin: 300,  refMax: 1000 },
  { key: 'estradiolPgMl',         label: 'Estradiol',           unit: 'pg/mL', color: '#ec4899', refMin: 10,   refMax: 40   },
  { key: 'ldlMgDl',               label: 'LDL',                 unit: 'mg/dL', color: '#ef4444', refMin: 0,    refMax: 130  },
  { key: 'hdlMgDl',               label: 'HDL',                 unit: 'mg/dL', color: '#10b981', refMin: 40,   refMax: 99   },
  { key: 'cholesterolTotalMgDl',  label: 'Colesterol Total',    unit: 'mg/dL', color: '#f59e0b', refMin: 0,    refMax: 200  },
  { key: 'triglyceridesMgDl',     label: 'Triglicerídeos',      unit: 'mg/dL', color: '#f97316', refMin: 0,    refMax: 150  },
  { key: 'glucoseMgDl',           label: 'Glicemia',            unit: 'mg/dL', color: '#84cc16', refMin: 70,   refMax: 100  },
  { key: 'vitaminDNgMl',          label: 'Vitamina D',          unit: 'ng/mL', color: '#eab308', refMin: 30,   refMax: 100  },
  { key: 'vitaminB12PgMl',        label: 'Vitamina B12',        unit: 'pg/mL', color: '#06b6d4', refMin: 200,  refMax: 900  },
  { key: 'ferritinNgMl',          label: 'Ferritina',           unit: 'ng/mL', color: '#8b5cf6', refMin: 12,   refMax: 300  },
  { key: 'tshMiuL',               label: 'TSH',                 unit: 'mIU/L', color: '#14b8a6', refMin: 0.4,  refMax: 4.0  },
  { key: 'crpMgL',                label: 'PCR-us',              unit: 'mg/L',  color: '#f43f5e', refMin: 0,    refMax: 3.0  },
];

interface ChartPoint { x: number; y: number; value: number; date: string; }

@Component({
  selector: 'app-clinical-dashboard',
  standalone: true,
  imports: [DecimalPipe, DatePipe],
  styles: [`
    .page { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
    .page-header { margin-bottom: 1.5rem; h2 { font-size: 1.5rem; } p { color: var(--color-text-muted); } }

    /* Marker selector */
    .marker-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: .625rem;
      margin-bottom: 1.5rem;
    }
    .marker-btn {
      display: flex; align-items: center; gap: .5rem;
      padding: .625rem .875rem; border-radius: var(--radius-sm);
      border: 1.5px solid var(--color-border); background: var(--color-surface);
      cursor: pointer; transition: .15s; text-align: left;

      .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
      .mlabel { font-size: .82rem; font-weight: 600; flex: 1; }
      .mval   { font-size: .72rem; color: var(--color-text-muted); }

      &.active { border-color: var(--dot-color); background: color-mix(in srgb, var(--dot-color) 8%, white); }
      &:hover:not(.active) { background: var(--color-surface-2); }
    }

    /* Main chart area */
    .chart-section { display: grid; grid-template-columns: 1fr 300px; gap: 1.5rem;
      @media (max-width: 900px) { grid-template-columns: 1fr; }
    }

    .chart-card {
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); padding: 1.25rem;

      .chart-title { font-size: .95rem; font-weight: 700; margin-bottom: 1rem; }

      .chart-empty { height: 300px; display: flex; flex-direction: column; align-items: center;
        justify-content: center; gap: .75rem; color: var(--color-text-muted);
        .emoji { font-size: 2.5rem; }
      }
      .chart-container { position: relative; height: 300px; }
    }

    .svg-chart { width: 100%; height: 100%; overflow: visible; }

    .axis-line { stroke: var(--color-border); stroke-width: 1; }
    .grid-line  { stroke: var(--color-border); stroke-width: 0.5; stroke-dasharray: 4 3; opacity: .5; }
    .ref-line   { stroke-dasharray: 6 4; stroke-width: 1.5; opacity: .5; }
    .axis-label { font-size: 10px; fill: var(--color-text-subtle); font-family: inherit; }

    /* Hormone overlays */
    .hormone-line { stroke-width: 1.5; stroke-dasharray: 3 3; opacity: .7; }

    /* Reference range badge */
    .ref-badge {
      display: inline-flex; align-items: center; gap: .375rem;
      background: var(--color-surface-2); border-radius: var(--radius-sm);
      padding: .25rem .625rem; font-size: .75rem; color: var(--color-text-muted);
      margin-top: .5rem;
    }

    /* Sidebar: recent values + hormone log */
    .sidebar-card {
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); padding: 1.25rem;

      h4 { font-size: .875rem; font-weight: 700; margin-bottom: .875rem; }
    }

    .value-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: .5rem 0; border-bottom: 1px solid var(--color-border);
      &:last-child { border-bottom: none; }

      .vdate { font-size: .72rem; color: var(--color-text-subtle); }
      .vval  { font-size: .95rem; font-weight: 700; }
      .vunit { font-size: .72rem; color: var(--color-text-subtle); }
      .vstatus { font-size: .75rem; padding: .1rem .4rem; border-radius: 99px; font-weight: 600;
        &.ok      { background: #dcfce7; color: #166534; }
        &.low     { background: #fef9c3; color: #713f12; }
        &.high    { background: #fee2e2; color: #991b1b; }
      }
    }

    .hormone-item {
      padding: .5rem 0; border-bottom: 1px solid var(--color-border);
      &:last-child { border-bottom: none; }
      .hname { font-size: .82rem; font-weight: 600; }
      .hmeta { font-size: .72rem; color: var(--color-text-muted); margin-top: .125rem; }
    }

    /* Category filter */
    .cat-pills { display: flex; flex-wrap: wrap; gap: .375rem; margin-bottom: .875rem;
      .cpill { padding: .2rem .625rem; border-radius: 99px; font-size: .72rem; font-weight: 600;
        border: 1px solid var(--color-border); background: var(--color-surface-2); cursor: pointer;
        &.active { background: var(--color-primary); border-color: var(--color-primary); color: #fff; }
      }
    }

    /* Legend strip */
    .legend-strip {
      display: flex; flex-wrap: wrap; gap: .625rem; margin-top: .75rem;
      .leg { display: flex; align-items: center; gap: .3rem; font-size: .72rem;
        .leg-dot { width: 10px; height: 10px; border-radius: 50%; }
      }
    }
  `],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>🩺 Dashboard Clínico</h2>
        <p>Acompanhe a evolução dos seus marcadores laboratoriais e doses hormonais ao longo do tempo.</p>
      </div>

      @if (loading()) {
        <div style="text-align:center;padding:3rem;color:var(--color-text-muted)">
          <div class="spinner" style="margin:0 auto 1rem"></div>
          Carregando dados clínicos...
        </div>
      } @else {

        <!-- Marker selector -->
        <div class="marker-grid">
          @for (m of markers; track m.key) {
            @if (hasData(m.key)) {
              <button class="marker-btn"
                [class.active]="selectedMarker() === m.key"
                [style]="'--dot-color:' + m.color"
                (click)="selectMarker(m.key)">
                <span class="dot" [style.background]="m.color"></span>
                <span class="mlabel">{{ m.label }}</span>
                <span class="mval">{{ latestValue(m.key) | number:'1.0-2' }}</span>
              </button>
            }
          }
        </div>

        @if (activeMarker()) {
          <div class="chart-section">
            <!-- Main line chart -->
            <div class="chart-card">
              <div class="chart-title">
                📈 {{ activeMarker()!.label }} ({{ activeMarker()!.unit }})
              </div>

              @if (chartPoints().length < 2) {
                <div class="chart-empty">
                  <span class="emoji">🩸</span>
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

                    <!-- Reference range band (if defined) -->
                    @if (refBand()) {
                      <rect
                        [attr.x]="padL" [attr.y]="refBand()!.top"
                        [attr.width]="W - padL - padR"
                        [attr.height]="refBand()!.bottom - refBand()!.top"
                        [attr.fill]="activeMarker()!.color" fill-opacity="0.06"/>
                      <line class="ref-line" [attr.x1]="padL" [attr.x2]="W - padR"
                        [attr.y1]="refBand()!.top" [attr.y2]="refBand()!.top"
                        [attr.stroke]="activeMarker()!.color"/>
                      <line class="ref-line" [attr.x1]="padL" [attr.x2]="W - padR"
                        [attr.y1]="refBand()!.bottom" [attr.y2]="refBand()!.bottom"
                        [attr.stroke]="activeMarker()!.color"/>
                    }

                    <!-- Hormone dose overlay lines (vertical) -->
                    @for (hl of filteredHormoneLogs(); track hl.id) {
                      <line class="hormone-line"
                        [attr.x1]="hormoneX(hl)" [attr.x2]="hormoneX(hl)"
                        [attr.y1]="padT" [attr.y2]="H - padB"
                        stroke="#6366f1"/>
                    }

                    <!-- Area fill -->
                    <path [attr.d]="areaPath()" [attr.fill]="activeMarker()!.color" fill-opacity="0.12"/>

                    <!-- Main line -->
                    <path [attr.d]="linePath()" fill="none"
                      [attr.stroke]="activeMarker()!.color" stroke-width="2.5"
                      stroke-linejoin="round" stroke-linecap="round"/>

                    <!-- Dots -->
                    @for (pt of chartPoints(); track pt.date) {
                      <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="5"
                        [attr.fill]="activeMarker()!.color" stroke="#fff" stroke-width="2"/>
                      <text class="axis-label" [attr.x]="pt.x" [attr.y]="pt.y - 10"
                        text-anchor="middle" [attr.fill]="activeMarker()!.color">
                        {{ pt.value | number:'1.0-1' }}
                      </text>
                    }

                    <!-- X labels -->
                    @for (pt of chartPoints(); track pt.date) {
                      <text class="axis-label" [attr.x]="pt.x" [attr.y]="H - padB + 14"
                        text-anchor="middle">{{ shortDate(pt.date) }}</text>
                    }

                    <!-- Axes -->
                    <line class="axis-line" [attr.x1]="padL" [attr.x2]="padL" [attr.y1]="padT" [attr.y2]="H - padB"/>
                    <line class="axis-line" [attr.x1]="padL" [attr.x2]="W - padR" [attr.y1]="H - padB" [attr.y2]="H - padB"/>
                  </svg>
                </div>

                <!-- Legend -->
                <div class="legend-strip">
                  <div class="leg">
                    <div class="leg-dot" [style.background]="activeMarker()!.color"></div>
                    {{ activeMarker()!.label }}
                  </div>
                  @if (filteredHormoneLogs().length > 0) {
                    <div class="leg">
                      <div class="leg-dot" style="background:#6366f1;opacity:.7"></div>
                      Dose hormonal (linhas pontilhadas)
                    </div>
                  }
                  @if (activeMarker()!.refMin != null) {
                    <div class="ref-badge">
                      Ref: {{ activeMarker()!.refMin }}–{{ activeMarker()!.refMax }} {{ activeMarker()!.unit }}
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Sidebar -->
            <div>
              <!-- Recent values -->
              <div class="sidebar-card" style="margin-bottom:1rem">
                <h4>🔬 Últimos Resultados</h4>
                @for (bt of bloodTests().slice(-6).reverse(); track bt.id) {
                  @if (bt[activeMarker()!.key] != null) {
                    <div class="value-row">
                      <div>
                        <div class="vdate">{{ bt.collectedAt | date:'dd/MM/yyyy' }}</div>
                        <div style="display:flex;align-items:baseline;gap:.25rem">
                          <span class="vval">{{ bt[activeMarker()!.key] | number:'1.0-2' }}</span>
                          <span class="vunit">{{ activeMarker()!.unit }}</span>
                        </div>
                      </div>
                      <span class="vstatus" [class]="statusClass(bt[activeMarker()!.key])">
                        {{ statusLabel(bt[activeMarker()!.key]) }}
                      </span>
                    </div>
                  }
                }
              </div>

              <!-- Hormone log sidebar -->
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
          <div style="text-align:center;padding:3rem;color:var(--color-text-muted)">
            <div style="font-size:2.5rem;margin-bottom:.75rem">🩸</div>
            <p>Nenhum exame de sangue registrado ainda.<br>
              Cadastre exames na tela de Perfil para visualizar a evolução.</p>
          </div>
        }
      }
    </div>
  `,
})
export class ClinicalDashboardComponent implements OnInit {
  private clinicalSvc = inject(ClinicalService);

  readonly W = 540; readonly H = 300;
  readonly padL = 48; readonly padR = 16; readonly padT = 20; readonly padB = 28;

  readonly markers = MARKERS;
  readonly hormoneCategories = ['TRT', 'Female_Hormones', 'Sleep', 'Other', 'Todas'] as const;

  loading       = signal(true);
  bloodTests    = signal<BloodTestFull[]>([]);
  hormoneLogs   = signal<HormoneLog[]>([]);
  selectedMarker= signal<keyof BloodTestFull | null>(null);
  hormoneFilter = signal<string>('Todas');

  // ── Derived ─────────────────────────────────────────────────────────────────
  activeMarker = computed(() => {
    const key = this.selectedMarker();
    return key ? (MARKERS.find(m => m.key === key) ?? null) : null;
  });

  filteredHormoneLogs = computed(() => {
    const cat = this.hormoneFilter();
    const logs = this.hormoneLogs();
    return cat === 'Todas' ? logs : logs.filter(h => h.category === cat);
  });

  // Chart geometry computations
  private seriesValues = computed((): number[] => {
    const key = this.selectedMarker();
    if (!key) return [];
    return this.bloodTests()
      .map(bt => bt[key] as number | undefined)
      .filter((v): v is number => v != null);
  });

  private yRange = computed(() => {
    const vals = this.seriesValues();
    if (!vals.length) return { min: 0, max: 100 };
    const m = this.activeMarker();
    const allVals = [
      ...vals,
      ...(m?.refMin != null ? [m.refMin] : []),
      ...(m?.refMax != null ? [m.refMax] : []),
    ];
    const pad = (Math.max(...allVals) - Math.min(...allVals)) * 0.1 || 5;
    return { min: Math.max(0, Math.min(...allVals) - pad), max: Math.max(...allVals) + pad };
  });

  private scaleY = computed(() => {
    const { min, max } = this.yRange();
    const h = this.H - this.padT - this.padB;
    return (v: number) => this.padT + h - ((v - min) / (max - min)) * h;
  });

  private dateRange = computed(() => {
    const tests = this.bloodTests().filter(bt => bt[this.selectedMarker()!] != null);
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
    const sx = this.scaleX();
    const sy = this.scaleY();
    return this.bloodTests()
      .filter(bt => bt[key] != null)
      .map(bt => ({
        x: sx(new Date(bt.collectedAt).getTime()),
        y: sy(bt[key] as number),
        value: bt[key] as number,
        date: bt.collectedAt,
      }));
  });

  linePath = computed((): string => {
    const pts = this.chartPoints();
    if (!pts.length) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  });

  areaPath = computed((): string => {
    const pts = this.chartPoints();
    if (!pts.length) return '';
    const base = this.H - this.padB;
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    return `${line} L${pts[pts.length - 1]!.x.toFixed(1)},${base} L${pts[0]!.x.toFixed(1)},${base} Z`;
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

  refBand = computed(() => {
    const m = this.activeMarker();
    if (!m || m.refMin == null || m.refMax == null) return null;
    const sy = this.scaleY();
    return { top: sy(m.refMax), bottom: sy(m.refMin) };
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.clinicalSvc.history(730).subscribe({
      next: data => {
        this.bloodTests.set(data.bloodTests);
        this.hormoneLogs.set(data.hormoneLogs);
        // Auto-select first marker with data
        const first = MARKERS.find(m => this.hasData(m.key));
        if (first) this.selectedMarker.set(first.key);
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
    return tests.length ? (tests[tests.length - 1]![key] as number) : null;
  }

  selectMarker(key: keyof BloodTestFull): void {
    this.selectedMarker.set(key);
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

  statusClass(value: number | undefined): string {
    if (value == null) return '';
    const m = this.activeMarker();
    if (!m || m.refMin == null || m.refMax == null) return '';
    if (value < m.refMin) return 'low';
    if (value > m.refMax) return 'high';
    return 'ok';
  }

  statusLabel(value: number | undefined): string {
    const cls = this.statusClass(value);
    return cls === 'ok' ? '✓ Normal' : cls === 'low' ? '↓ Baixo' : cls === 'high' ? '↑ Alto' : '';
  }
}
