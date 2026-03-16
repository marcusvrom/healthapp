import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  HormoneService,
  HormoneLog,
  HormoneCategory,
  LogHormoneDto,
  LatestPerCategory,
} from '../../core/services/hormone.service';

const CATEGORY_META: Record<HormoneCategory, { label: string; icon: string; color: string; bg: string }> = {
  TRT:             { label: 'TRT',              icon: '💉', color: '#7c3aed', bg: '#ede9fe' },
  Female_Hormones: { label: 'Hormônios Fem.',   icon: '🌸', color: '#db2777', bg: '#fce7f3' },
  Sleep:           { label: 'Sono',             icon: '😴', color: '#0369a1', bg: '#e0f2fe' },
  Other:           { label: 'Outros',           icon: '💊', color: '#059669', bg: '#d1fae5' },
};

const UNITS = ['mg', 'ml', 'ui', 'mcg', 'comprimido', 'cápsula', 'g'];
const COMMON_NAMES: Record<HormoneCategory, string[]> = {
  TRT:             ['Enantato de Testosterona', 'Cipionato de Testosterona', 'Propionato de Testosterona', 'hCG', 'Anastrozol'],
  Female_Hormones: ['Estradiol', 'Progesterona', 'Levotiroxina', 'Anticoncepcional'],
  Sleep:           ['Melatonina', 'Zolpidem', 'Clonazepam', 'Trazodona', 'Valeriana'],
  Other:           ['Vitamina D', 'Vitamina B12', 'Ômega 3', 'Zinco', 'Magnésio'],
};

@Component({
  selector: 'app-hormones',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe],
  styleUrls: ['./hormones.component.scss'],
  templateUrl: './hormones.component.html',
})
export class HormonesComponent implements OnInit {
  private hormoneSvc = inject(HormoneService);

  readonly categoryKeys = Object.keys(CATEGORY_META) as HormoneCategory[];
  readonly units        = UNITS;

  logs         = signal<HormoneLog[]>([]);
  latest       = signal<LatestPerCategory[]>([]);
  total        = signal(0);
  loading      = signal(false);
  saving       = signal(false);
  formError    = signal('');
  activeFilter = signal<HormoneCategory | undefined>(undefined);
  page         = signal(1);

  form: LogHormoneDto = {
    category:       'TRT',
    name:           '',
    dosage:         0,
    unit:           'mg',
    administeredAt: this.nowLocalISO(),
    notes:          '',
  };

  readonly suggestions = computed(() => COMMON_NAMES[this.form.category] ?? []);
  readonly hasMore     = computed(() => this.logs().length < this.total());

  ngOnInit(): void {
    this.loadLogs();
    this.loadLatest();
  }

  private loadLogs(append = false): void {
    this.loading.set(!append);
    this.hormoneSvc.list(this.activeFilter(), this.page(), 20).subscribe({
      next: r => {
        this.logs.update(l => append ? [...l, ...r.data] : r.data);
        this.total.set(r.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadLatest(): void {
    this.hormoneSvc.latest().subscribe({ next: l => this.latest.set(l), error: () => {} });
  }

  filterBy(cat: HormoneCategory | undefined): void {
    this.activeFilter.set(cat);
    this.page.set(1);
    this.loadLogs();
  }

  loadMore(): void {
    this.page.update(p => p + 1);
    this.loadLogs(true);
  }

  setCategory(cat: HormoneCategory): void {
    this.form.category = cat;
    this.form.name     = '';
  }

  save(): void {
    if (!this.form.name || !this.form.dosage) {
      this.formError.set('Nome e dose são obrigatórios.');
      return;
    }
    this.formError.set('');
    this.saving.set(true);

    this.hormoneSvc.log({ ...this.form, notes: this.form.notes || undefined }).subscribe({
      next: () => {
        this.saving.set(false);
        this.resetForm();
        this.page.set(1);
        this.loadLogs();
        this.loadLatest();
      },
      error: (e) => {
        this.saving.set(false);
        this.formError.set(e.error?.message ?? 'Erro ao salvar.');
      },
    });
  }

  remove(id: string): void {
    this.hormoneSvc.remove(id).subscribe({
      next: () => {
        this.logs.update(l => l.filter(e => e.id !== id));
        this.total.update(t => Math.max(0, t - 1));
        this.loadLatest();
      },
    });
  }

  catMeta(cat: HormoneCategory) { return CATEGORY_META[cat]; }

  lastDose(cat: HormoneCategory): HormoneLog | null {
    return this.latest().find(l => l.category === cat)?.lastLog ?? null;
  }

  hasLogs(cat: HormoneCategory): boolean {
    return this.logs().some(l => l.category === cat) || !!this.lastDose(cat);
  }

  daysAgo(isoDate: string): string {
    const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000);
    if (diff === 0) return 'hoje';
    if (diff === 1) return 'ontem';
    return `${diff} dias atrás`;
  }

  private resetForm(): void {
    this.form = {
      category:       this.form.category,
      name:           '',
      dosage:         0,
      unit:           'mg',
      administeredAt: this.nowLocalISO(),
      notes:          '',
    };
  }

  private nowLocalISO(): string {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }
}
