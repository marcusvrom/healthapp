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
  styleUrls: ['./clinical-dashboard.component.scss'],
  templateUrl: './clinical-dashboard.component.html',
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
