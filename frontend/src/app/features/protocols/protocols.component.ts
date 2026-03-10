import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClinicalProtocolService } from '../../core/services/clinical-protocol.service';
import { ClinicalProtocol, ClinicalCategory } from '../../core/models';

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const CATEGORY_META: Record<ClinicalCategory, { label: string; icon: string; color: string; bg: string }> = {
  SUPLEMENTO:          { label: 'Suplemento',       icon: '🧴', color: '#0369a1', bg: '#e0f2fe' },
  REMEDIO_CONTROLADO:  { label: 'Medicamento',       icon: '💊', color: '#9a3412', bg: '#fee2e2' },
  TRT:                 { label: 'TRT',               icon: '💉', color: '#6b21a8', bg: '#ede9fe' },
  HORMONIO_FEMININO:   { label: 'Hormônio Feminino', icon: '🌸', color: '#be185d', bg: '#fce7f3' },
  SONO:                { label: 'Sono',              icon: '😴', color: '#166534', bg: '#dcfce7' },
};

@Component({
  selector: 'app-protocols',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .page { padding: 1.5rem; max-width: 800px; margin: 0 auto; }
    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.5rem; gap: 1rem;
      h2 { font-size: 1.5rem; margin: 0; }
      p  { color: var(--color-text-muted); margin: .25rem 0 0; font-size: .875rem; }
    }

    .protocol-list { display: flex; flex-direction: column; gap: .75rem; }

    .protocol-card {
      background: var(--color-surface); border: 1.5px solid var(--color-border);
      border-radius: var(--radius-md); padding: 1rem 1.25rem;
      display: flex; align-items: flex-start; gap: 1rem;
      &.inactive { opacity: .5; }

      .cat-icon  { font-size: 1.75rem; flex-shrink: 0; }
      .info      { flex: 1; min-width: 0; }
      .p-name    { font-weight: 700; font-size: .95rem; }
      .p-dosage  { font-size: .82rem; color: var(--color-text-muted); margin-top: .2rem; }
      .p-time    { font-size: .78rem; color: var(--color-text-subtle); margin-top: .2rem; }
      .p-days    { font-size: .72rem; margin-top: .375rem; display: flex; flex-wrap: wrap; gap: .25rem; }
      .p-notes   { font-size: .75rem; color: var(--color-text-muted); margin-top: .375rem; font-style: italic; }
      .actions   { display: flex; flex-direction: column; gap: .375rem; align-items: flex-end; flex-shrink: 0; }
    }

    .cat-badge {
      font-size: .7rem; font-weight: 700; padding: .2rem .625rem; border-radius: 99px; white-space: nowrap;
    }
    .day-tag {
      font-size: .68rem; font-weight: 600; padding: .1rem .4rem; border-radius: 4px;
      background: var(--color-surface-2); color: var(--color-text-subtle);
      &.active { background: var(--color-primary-light); color: var(--color-primary-dark); }
    }
    .status-btn {
      font-size: .72rem; cursor: pointer; padding: .2rem .625rem; border-radius: 99px;
      border: 1.5px solid var(--color-border); background: none; transition: .15s;
      &.on  { background: #dcfce7; border-color: #16a34a; color: #166534; }
      &.off { background: #fee2e2; border-color: #ef4444; color: #991b1b; }
    }
    .icon-btn { background: none; border: none; cursor: pointer; padding: .25rem;
      font-size: 1rem; color: var(--color-text-muted); border-radius: var(--radius-sm);
      &:hover { background: var(--color-surface-2); }
    }

    /* Form */
    .form-card {
      background: var(--color-surface); border: 1.5px solid var(--color-primary);
      border-radius: var(--radius-md); padding: 1.5rem; margin-bottom: 1.25rem;
      .form-title { font-size: 1rem; font-weight: 700; margin-bottom: 1rem; }
    }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .875rem;
      @media (max-width: 480px) { grid-template-columns: 1fr; } }
    .days-picker { display: flex; gap: .375rem; flex-wrap: wrap; margin-top: .375rem; }
    .day-pick-btn {
      width: 36px; height: 36px; border-radius: 50%; border: 2px solid var(--color-border);
      background: var(--color-surface-2); cursor: pointer; font-size: .75rem; font-weight: 700;
      display: flex; align-items: center; justify-content: center; transition: .15s;
      &.sel { background: var(--color-primary); border-color: var(--color-primary); color: #fff; }
    }
    .form-actions { display: flex; justify-content: flex-end; gap: .625rem; margin-top: 1rem;
      padding-top: 1rem; border-top: 1px solid var(--color-border); }

    .empty-state { text-align: center; padding: 3rem; color: var(--color-text-muted);
      .emoji { font-size: 3rem; display: block; margin-bottom: .75rem; } }
  `],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h2>💊 Protocolos Clínicos</h2>
          <p>Medicamentos, suplementos, hormônios e auxiliares do sono — todos num só lugar.</p>
        </div>
        <button class="btn btn-primary" (click)="openForm()">+ Adicionar</button>
      </div>

      <!-- Add/Edit form -->
      @if (showForm()) {
        <div class="form-card">
          <div class="form-title">{{ editId() ? '✏️ Editar Protocolo' : '➕ Novo Protocolo' }}</div>
          <div class="form-grid">
            <div class="form-group">
              <label>Nome *</label>
              <input type="text" [(ngModel)]="form.name" placeholder="Ex: Creatina, Enantato, Vitamina D…" />
            </div>
            <div class="form-group">
              <label>Categoria *</label>
              <select [(ngModel)]="form.category">
                @for (cat of categories; track cat.value) {
                  <option [value]="cat.value">{{ cat.icon }} {{ cat.label }}</option>
                }
              </select>
            </div>
            <div class="form-group">
              <label>Dosagem *</label>
              <input type="text" [(ngModel)]="form.dosage" placeholder="Ex: 5g, 20mg, 0.5ml…" />
            </div>
            <div class="form-group">
              <label>Horário base *</label>
              <input type="time" [(ngModel)]="form.scheduledTime" />
            </div>
          </div>

          <div class="form-group" style="margin-top:.875rem">
            <label>Dias da semana</label>
            <div class="days-picker">
              @for (d of dayLabels; track d; let i = $index) {
                <button type="button" class="day-pick-btn" [class.sel]="isDaySelected(i)" (click)="toggleDay(i)">{{ d }}</button>
              }
            </div>
          </div>

          <div class="form-group" style="margin-top:.875rem">
            <label>Observações</label>
            <input type="text" [(ngModel)]="form.notes" placeholder="Ex: Tomar com refeição, injeção subcut…" />
          </div>

          <div class="form-actions">
            <button class="btn btn-secondary" (click)="cancelForm()">Cancelar</button>
            <button class="btn btn-primary" (click)="submit()" [disabled]="saving() || !canSubmit()">
              {{ saving() ? '⏳ Salvando…' : editId() ? '💾 Atualizar' : '✅ Adicionar' }}
            </button>
          </div>
        </div>
      }

      <!-- List -->
      @if (loading()) {
        <div style="text-align:center;padding:3rem">
          <div class="spinner" style="margin:0 auto 1rem"></div> Carregando…
        </div>
      } @else if (protocols().length === 0 && !showForm()) {
        <div class="empty-state">
          <span class="emoji">💊</span>
          <p>Nenhum protocolo cadastrado.<br>
            Clique em <strong>+ Adicionar</strong> para inserir um medicamento, suplemento ou hormônio.</p>
        </div>
      } @else {
        <div class="protocol-list">
          @for (p of protocols(); track p.id) {
            <div class="protocol-card" [class.inactive]="!p.isActive">
              <span class="cat-icon">{{ catMeta(p.category).icon }}</span>
              <div class="info">
                <div class="p-name">{{ p.name }}</div>
                <div class="p-dosage">{{ p.dosage }}</div>
                <div class="p-time">⏰ {{ p.scheduledTime }}</div>
                <div class="p-days">
                  @for (d of dayLabels; track d; let i = $index) {
                    <span class="day-tag" [class.active]="p.daysOfWeek.includes(i)">{{ d }}</span>
                  }
                </div>
                @if (p.notes) {
                  <div class="p-notes">{{ p.notes }}</div>
                }
              </div>
              <div class="actions">
                <span class="cat-badge" [style.color]="catMeta(p.category).color" [style.background]="catMeta(p.category).bg">
                  {{ catMeta(p.category).label }}
                </span>
                <button class="status-btn" [class.on]="p.isActive" [class.off]="!p.isActive" (click)="toggleActive(p)">
                  {{ p.isActive ? '✓ Ativo' : '✗ Inativo' }}
                </button>
                <div style="display:flex;gap:.25rem">
                  <button class="icon-btn" (click)="edit(p)" title="Editar">✏️</button>
                  <button class="icon-btn" (click)="remove(p.id)" title="Remover">🗑️</button>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class ProtocolsComponent implements OnInit {
  private svc = inject(ClinicalProtocolService);

  readonly dayLabels = DAYS_PT;
  readonly categories = Object.entries(CATEGORY_META).map(([value, meta]) => ({ value: value as ClinicalCategory, ...meta }));

  protocols = signal<ClinicalProtocol[]>([]);
  loading   = signal(false);
  saving    = signal(false);
  showForm  = signal(false);
  editId    = signal<string | null>(null);

  form = this.emptyForm();

  ngOnInit(): void { this.load(); }

  private emptyForm() {
    return {
      name: '',
      category: 'SUPLEMENTO' as ClinicalCategory,
      dosage: '',
      scheduledTime: '08:00',
      daysOfWeek: [0,1,2,3,4,5,6],
      notes: '',
    };
  }

  load(): void {
    this.loading.set(true);
    this.svc.list(true).subscribe({
      next: list => { this.protocols.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openForm(): void {
    this.editId.set(null);
    this.form = this.emptyForm();
    this.showForm.set(true);
  }

  edit(p: ClinicalProtocol): void {
    this.editId.set(p.id);
    this.form = {
      name: p.name,
      category: p.category,
      dosage: p.dosage,
      scheduledTime: p.scheduledTime,
      daysOfWeek: [...p.daysOfWeek],
      notes: p.notes ?? '',
    };
    this.showForm.set(true);
  }

  cancelForm(): void { this.showForm.set(false); this.editId.set(null); }

  canSubmit(): boolean { return !!this.form.name && !!this.form.dosage && !!this.form.scheduledTime; }

  isDaySelected(i: number): boolean { return this.form.daysOfWeek.includes(i); }
  toggleDay(i: number): void {
    if (this.isDaySelected(i)) {
      this.form.daysOfWeek = this.form.daysOfWeek.filter(d => d !== i);
    } else {
      this.form.daysOfWeek = [...this.form.daysOfWeek, i].sort();
    }
  }

  submit(): void {
    if (!this.canSubmit()) return;
    this.saving.set(true);
    const dto = { ...this.form, notes: this.form.notes || undefined };
    const call = this.editId()
      ? this.svc.update(this.editId()!, dto)
      : this.svc.create(dto);

    call.subscribe({
      next: saved => {
        if (this.editId()) {
          this.protocols.update(list => list.map(p => p.id === saved.id ? saved : p));
        } else {
          this.protocols.update(list => [...list, saved]);
        }
        this.saving.set(false);
        this.cancelForm();
      },
      error: () => this.saving.set(false),
    });
  }

  toggleActive(p: ClinicalProtocol): void {
    this.svc.update(p.id, { isActive: !p.isActive }).subscribe({
      next: updated => this.protocols.update(list => list.map(x => x.id === updated.id ? updated : x)),
    });
  }

  remove(id: string): void {
    if (!confirm('Remover este protocolo?')) return;
    this.svc.remove(id).subscribe({
      next: () => this.protocols.update(list => list.filter(p => p.id !== id)),
    });
  }

  catMeta(cat: ClinicalCategory) { return CATEGORY_META[cat] ?? CATEGORY_META.SUPLEMENTO; }
}
