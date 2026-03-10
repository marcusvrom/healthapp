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
  styles: [`
    .page { padding: 1.5rem; max-width: 960px; margin: 0 auto; }
    .page-header { margin-bottom: 1.5rem; h2 { font-size: 1.5rem; } p { color: var(--color-text-muted); } }

    /* Last-dose summary cards */
    .summary-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;
      margin-bottom: 2rem;
    }
    .summary-card {
      border-radius: var(--radius-md); padding: 1rem 1.25rem;
      border: 1px solid var(--color-border);

      .s-header { display: flex; align-items: center; gap: .5rem; margin-bottom: .625rem;
        .icon { font-size: 1.25rem; }
        .label{ font-size: .8rem; font-weight: 700; }
      }
      .s-name   { font-weight: 600; font-size: .9rem; margin-bottom: .2rem; }
      .s-dose   { font-size: .85rem; }
      .s-time   { font-size: .72rem; margin-top: .25rem; }
      .no-log   { font-size: .8rem; color: var(--color-text-subtle); font-style: italic; }
    }

    /* Main layout */
    .main-grid {
      display: grid; grid-template-columns: 380px 1fr; gap: 1.5rem;
      @media (max-width: 860px) { grid-template-columns: 1fr; }
    }

    /* New log form */
    .form-card {
      .card-title { font-size: 1rem; font-weight: 700; margin-bottom: 1.25rem; display: flex; align-items: center; gap: .5rem; }

      .fields { display: flex; flex-direction: column; gap: 1rem; }
      .row-2  { display: grid; grid-template-columns: 1fr 1fr; gap: .875rem; }
      .row-3  { display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: .75rem; }

      .submit-btn { width: 100%; margin-top: .5rem; }

      /* Category selector */
      .cat-selector { display: grid; grid-template-columns: repeat(2, 1fr); gap: .5rem; }
      .cat-btn {
        color: var(--color-text);
        padding: .625rem .5rem; border-radius: var(--radius-sm);
        border: 2px solid var(--color-border); background: var(--color-surface-2);
        cursor: pointer; text-align: center; font-size: .78rem; font-weight: 600;
        transition: all .15s; display: flex; align-items: center; justify-content: center; gap: .4rem;
        .btn-icon { font-size: 1rem; }
        &.active { border-width: 2px; }
      }

      /* Suggestions */
      .suggestions { display: flex; flex-wrap: wrap; gap: .375rem; margin-top: .25rem; }
      .sug-chip {
        font-size: .72rem; padding: .2rem .55rem; border-radius: 99px;
        background: var(--color-surface-2); border: 1px solid var(--color-border);
        cursor: pointer; transition: .15s;
        &:hover { background: var(--color-primary-light); border-color: var(--color-primary); }
      }
    }

    /* History panel */
    .history-panel {
      .panel-header {
        display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;
        h3 { font-size: 1rem; font-weight: 700; }
      }

      /* Category filter tabs */
      .filter-tabs { display: flex; gap: .375rem; flex-wrap: wrap; margin-bottom: 1rem; }
      .tab {
        padding: .35rem .875rem; border-radius: 99px; font-size: .78rem; font-weight: 600;
        border: 1.5px solid var(--color-border); background: var(--color-surface-2);
        cursor: pointer; transition: .15s; white-space: nowrap;
        &.active { border-color: currentColor; }
      }

      .history-list { display: flex; flex-direction: column; gap: .625rem; }

      .log-item {
        background: var(--color-surface); border: 1px solid var(--color-border);
        border-radius: var(--radius-md); padding: .875rem 1rem;
        display: flex; align-items: flex-start; gap: .875rem; transition: border-color .15s;
        &:hover { border-color: var(--color-primary); }

        .log-icon { font-size: 1.5rem; margin-top: .1rem; }

        .log-body { flex: 1; min-width: 0; }
        .log-header { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; margin-bottom: .25rem;
          .log-name { font-weight: 700; font-size: .9rem; }
          .log-cat  { font-size: .7rem; padding: .15rem .5rem; border-radius: 99px; font-weight: 700; }
        }
        .log-dose { font-size: .85rem; color: var(--color-text); margin-bottom: .2rem;
          strong { font-weight: 700; }
        }
        .log-time { font-size: .72rem; color: var(--color-text-subtle); }
        .log-notes{ font-size: .78rem; color: var(--color-text-muted); margin-top: .375rem;
          padding: .375rem .5rem; background: var(--color-surface-2); border-radius: 6px;
          border-left: 3px solid var(--color-border);
        }
        .del-btn { background: none; border: none; cursor: pointer; color: var(--color-text-subtle);
          font-size: 1rem; padding: .25rem; &:hover { color: var(--color-danger); } }
      }

      .empty-state { text-align: center; padding: 3rem 1rem; color: var(--color-text-muted); font-size: .9rem;
        .emoji { font-size: 2.5rem; display: block; margin-bottom: .75rem; }
      }

      .load-more { width: 100%; margin-top: .875rem; }
    }
  `],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>💉 Controle Hormonal</h2>
        <p>Registre e monitore todas as suas administrações de hormônios e suplementos.</p>
      </div>

      <!-- Last dose per category -->
      <div class="summary-grid">
        @for (cat of categoryKeys; track cat) {
          <div class="summary-card animate-fade" [style.background]="catMeta(cat).bg">
            <div class="s-header">
              <span class="icon">{{ catMeta(cat).icon }}</span>
              <span class="label" [style.color]="catMeta(cat).color">{{ catMeta(cat).label }}</span>
            </div>
            @if (lastDose(cat)) {
              <div class="s-name">{{ lastDose(cat)!.name }}</div>
              <div class="s-dose" [style.color]="catMeta(cat).color">
                {{ lastDose(cat)!.dosage }} {{ lastDose(cat)!.unit }}
              </div>
              <div class="s-time">
                Última: {{ lastDose(cat)!.administeredAt | date:'dd/MM HH:mm' }}
                · {{ daysAgo(lastDose(cat)!.administeredAt) }}
              </div>
            } @else {
              <div class="no-log">Nenhum registro</div>
            }
          </div>
        }
      </div>

      <div class="main-grid">
        <!-- Add new log -->
        <div class="card form-card">
          <div class="card-title">➕ Novo Registro</div>

          @if (formError()) { <div class="alert alert-error mb-4">{{ formError() }}</div> }

          <div class="fields">
            <!-- Category selector -->
            <div class="form-group">
              <label>Categoria</label>
              <div class="cat-selector">
                @for (cat of categoryKeys; track cat) {
                  <button type="button" class="cat-btn"
                    [class.active]="form.category === cat"
                    [style.border-color]="form.category === cat ? catMeta(cat).color : ''"
                    [style.background]="form.category === cat ? catMeta(cat).bg : ''"
                    [style.color]="form.category === cat ? catMeta(cat).color : ''"
                    (click)="setCategory(cat)">
                    <span class="btn-icon">{{ catMeta(cat).icon }}</span>
                    {{ catMeta(cat).label }}
                  </button>
                }
              </div>
            </div>

            <!-- Name -->
            <div class="form-group">
              <label>Nome</label>
              <input type="text" [(ngModel)]="form.name" placeholder="ex: Enantato de Testosterona" />
              @if (suggestions().length > 0) {
                <div class="suggestions">
                  @for (s of suggestions(); track s) {
                    <span class="sug-chip" (click)="form.name = s">{{ s }}</span>
                  }
                </div>
              }
            </div>

            <!-- Dose + unit -->
            <div class="row-3">
              <div class="form-group">
                <label>Dose</label>
                <input type="number" [(ngModel)]="form.dosage" min="0.001" step="any" placeholder="ex: 250" />
              </div>
              <div class="form-group">
                <label>Unidade</label>
                <select [(ngModel)]="form.unit">
                  @for (u of units; track u) { <option [value]="u">{{ u }}</option> }
                </select>
              </div>
              <div></div>
            </div>

            <!-- Date + time -->
            <div class="form-group">
              <label>Data e hora da administração</label>
              <input type="datetime-local" [(ngModel)]="form.administeredAt" />
            </div>

            <!-- Notes -->
            <div class="form-group">
              <label>Observações (opcional)</label>
              <textarea [(ngModel)]="form.notes" rows="2"
                placeholder="Local da aplicação, como se sentiu, etc."></textarea>
            </div>

            <button class="btn btn-primary submit-btn" (click)="save()" [disabled]="saving()">
              {{ saving() ? 'Salvando...' : '💉 Registrar Administração' }}
            </button>
          </div>
        </div>

        <!-- History -->
        <div class="history-panel">
          <div class="panel-header">
            <h3>📋 Histórico</h3>
            <span class="chip chip-gray">{{ total() }} registro{{ total() !== 1 ? 's' : '' }}</span>
          </div>

          <!-- Filter tabs -->
          <div class="filter-tabs">
            <button class="tab" [class.active]="!activeFilter()"
              [style.border-color]="!activeFilter() ? 'var(--color-primary)' : ''"
              [style.color]="!activeFilter() ? 'var(--color-primary)' : ''"
              (click)="filterBy(undefined)">Todos</button>
            @for (cat of categoryKeys; track cat) {
              @if (hasLogs(cat)) {
                <button class="tab" [class.active]="activeFilter() === cat"
                  [style.border-color]="activeFilter() === cat ? catMeta(cat).color : ''"
                  [style.color]="activeFilter() === cat ? catMeta(cat).color : ''"
                  (click)="filterBy(cat)">
                  {{ catMeta(cat).icon }} {{ catMeta(cat).label }}
                </button>
              }
            }
          </div>

          @if (loading()) {
            <div class="flex items-center justify-center" style="padding:2rem">
              <span class="spinner"></span>
            </div>
          } @else if (logs().length === 0) {
            <div class="empty-state">
              <span class="emoji">💊</span>
              <p>Nenhum registro encontrado.<br>Adicione sua primeira administração ao lado.</p>
            </div>
          } @else {
            <div class="history-list stagger">
              @for (log of logs(); track log.id) {
                <div class="log-item animate-fade">
                  <span class="log-icon">{{ catMeta(log.category).icon }}</span>
                  <div class="log-body">
                    <div class="log-header">
                      <span class="log-name">{{ log.name }}</span>
                      <span class="log-cat"
                        [style.background]="catMeta(log.category).bg"
                        [style.color]="catMeta(log.category).color">
                        {{ catMeta(log.category).label }}
                      </span>
                    </div>
                    <div class="log-dose">
                      <strong>{{ log.dosage }} {{ log.unit }}</strong>
                    </div>
                    <div class="log-time">
                      🕐 {{ log.administeredAt | date:'dd/MM/yyyy HH:mm' }}
                      · {{ daysAgo(log.administeredAt) }}
                    </div>
                    @if (log.notes) {
                      <div class="log-notes">📝 {{ log.notes }}</div>
                    }
                  </div>
                  <button class="del-btn" (click)="remove(log.id)" title="Excluir">🗑️</button>
                </div>
              }
            </div>

            @if (hasMore()) {
              <button class="btn btn-secondary load-more" (click)="loadMore()">Carregar mais...</button>
            }
          }
        </div>
      </div>
    </div>
  `,
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
