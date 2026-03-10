import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MedicationService, Medication } from '../../core/services/medication.service';

type MedType = 'SUPLEMENTO' | 'VITAMINA' | 'REMEDIO_CONTROLADO' | 'TRT';

const TYPE_META: Record<MedType, { label: string; color: string; bg: string }> = {
  SUPLEMENTO:         { label: 'Suplemento',    color: '#0369a1', bg: '#e0f2fe' },
  VITAMINA:           { label: 'Vitamina',       color: '#166534', bg: '#dcfce7' },
  REMEDIO_CONTROLADO: { label: 'Medicamento',    color: '#9a3412', bg: '#fee2e2' },
  TRT:                { label: 'TRT',            color: '#6b21a8', bg: '#ede9fe' },
};

@Component({
  selector: 'app-medications',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .page { padding: 1.5rem; max-width: 720px; margin: 0 auto; }
    .page-header { display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 1.5rem; flex-wrap: wrap; gap: .75rem;
      h2 { font-size: 1.5rem; margin: 0; }
      p  { color: var(--color-text-muted); margin: .25rem 0 0; font-size: .875rem; }
    }

    .med-list { display: flex; flex-direction: column; gap: .75rem; }
    .med-card {
      background: var(--color-surface); border: 1.5px solid var(--color-border);
      border-radius: var(--radius-md); padding: 1rem 1.25rem;
      display: flex; align-items: flex-start; gap: 1rem;

      .med-icon { font-size: 1.75rem; flex-shrink: 0; margin-top: .125rem; }
      .med-info { flex: 1; min-width: 0;
        .med-name    { font-weight: 700; font-size: .95rem; }
        .med-dosage  { font-size: .82rem; color: var(--color-text-muted); margin-top: .25rem; }
        .med-time    { font-size: .78rem; color: var(--color-text-subtle); margin-top: .2rem; }
        .med-notes   { font-size: .75rem; color: var(--color-text-muted); margin-top: .375rem;
          font-style: italic; }
      }
      .med-actions { display: flex; flex-direction: column; gap: .375rem; align-items: flex-end; flex-shrink: 0; }

      &.inactive { opacity: .55; }
    }

    .type-badge {
      font-size: .7rem; font-weight: 700; padding: .2rem .625rem; border-radius: 99px;
      white-space: nowrap;
    }
    .status-toggle {
      font-size: .72rem; cursor: pointer; padding: .2rem .625rem; border-radius: 99px;
      border: 1.5px solid var(--color-border); background: none; cursor: pointer; transition: .15s;
      &.active   { background: #dcfce7; border-color: #16a34a; color: #166534; }
      &.inactive { background: #fee2e2; border-color: #ef4444; color: #991b1b; }
      &:hover { opacity: .8; }
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
      @media (max-width: 480px) { grid-template-columns: 1fr; }
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
          <h2>💊 Medicamentos & Suplementos</h2>
          <p>Gerencie seus remédios, vitaminas e suplementos diários.</p>
        </div>
        <button class="btn btn-primary" (click)="openForm()">+ Adicionar</button>
      </div>

      <!-- Add/Edit form -->
      @if (showForm()) {
        <div class="form-card">
          <div class="form-title">{{ editingId() ? '✏️ Editar' : '➕ Novo' }} item</div>
          <div class="form-grid">
            <div class="form-group">
              <label>Nome *</label>
              <input type="text" [(ngModel)]="form.name" placeholder="Ex: Creatina, Vitamina D..." />
            </div>
            <div class="form-group">
              <label>Tipo *</label>
              <select [(ngModel)]="form.type">
                <option value="SUPLEMENTO">Suplemento</option>
                <option value="VITAMINA">Vitamina</option>
                <option value="REMEDIO_CONTROLADO">Medicamento Controlado</option>
                <option value="TRT">TRT</option>
              </select>
            </div>
            <div class="form-group">
              <label>Dosagem *</label>
              <input type="text" [(ngModel)]="form.dosage" placeholder="Ex: 5g, 2000UI, 1 comprimido..." />
            </div>
            <div class="form-group">
              <label>Horário *</label>
              <input type="time" [(ngModel)]="form.scheduledTime" />
            </div>
          </div>
          <div class="form-group" style="margin-top:.875rem">
            <label>Observações</label>
            <input type="text" [(ngModel)]="form.notes" placeholder="Ex: Tomar com refeição, em jejum..." />
          </div>
          <div class="form-actions">
            <button class="btn btn-secondary" (click)="cancelForm()">Cancelar</button>
            <button class="btn btn-primary" (click)="submit()" [disabled]="saving() || !canSubmit()">
              {{ saving() ? '⏳ Salvando...' : editingId() ? '💾 Atualizar' : '✅ Adicionar' }}
            </button>
          </div>
        </div>
      }

      <!-- List -->
      @if (loading()) {
        <div style="text-align:center;padding:3rem;color:var(--color-text-muted)">
          <div class="spinner" style="margin:0 auto 1rem"></div> Carregando...
        </div>
      } @else if (medications().length === 0 && !showForm()) {
        <div class="empty-state">
          <span class="emoji">💊</span>
          <p>Nenhum medicamento ou suplemento cadastrado.<br>
            Clique em <strong>+ Adicionar</strong> para começar.</p>
        </div>
      } @else {
        <div class="med-list">
          @for (med of medications(); track med.id) {
            <div class="med-card" [class.inactive]="!med.isActive">
              <span class="med-icon">{{ typeIcon(med.type) }}</span>
              <div class="med-info">
                <div class="med-name">{{ med.name }}</div>
                <div class="med-dosage">{{ med.dosage }}</div>
                <div class="med-time">⏰ {{ med.scheduledTime }}</div>
                @if (med.notes) {
                  <div class="med-notes">{{ med.notes }}</div>
                }
              </div>
              <div class="med-actions">
                <span class="type-badge" [style.color]="typeMeta(med.type).color" [style.background]="typeMeta(med.type).bg">
                  {{ typeMeta(med.type).label }}
                </span>
                <button class="status-toggle" [class.active]="med.isActive" [class.inactive]="!med.isActive"
                  (click)="toggleActive(med)">
                  {{ med.isActive ? '✓ Ativo' : '✗ Inativo' }}
                </button>
                <div style="display:flex;gap:.25rem">
                  <button class="icon-btn" (click)="edit(med)" title="Editar">✏️</button>
                  <button class="icon-btn" (click)="remove(med.id)" title="Remover">🗑️</button>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class MedicationsComponent implements OnInit {
  private svc = inject(MedicationService);

  medications = signal<Medication[]>([]);
  loading     = signal(false);
  saving      = signal(false);
  showForm    = signal(false);
  editingId   = signal<string | null>(null);

  form = { name: '', type: 'SUPLEMENTO' as MedType, dosage: '', scheduledTime: '08:00', notes: '' };

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.svc.list().subscribe({
      next: list => { this.medications.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openForm(): void {
    this.editingId.set(null);
    this.form = { name: '', type: 'SUPLEMENTO', dosage: '', scheduledTime: '08:00', notes: '' };
    this.showForm.set(true);
  }

  edit(med: Medication): void {
    this.editingId.set(med.id);
    this.form = { name: med.name, type: med.type, dosage: med.dosage, scheduledTime: med.scheduledTime, notes: med.notes ?? '' };
    this.showForm.set(true);
  }

  cancelForm(): void { this.showForm.set(false); this.editingId.set(null); }

  canSubmit(): boolean { return !!this.form.name && !!this.form.dosage && !!this.form.scheduledTime; }

  submit(): void {
    if (!this.canSubmit()) return;
    this.saving.set(true);
    const dto = { ...this.form, notes: this.form.notes || undefined };
    const call = this.editingId()
      ? this.svc.update(this.editingId()!, dto)
      : this.svc.create(dto);

    call.subscribe({
      next: saved => {
        if (this.editingId()) {
          this.medications.update(list => list.map(m => m.id === saved.id ? saved : m));
        } else {
          this.medications.update(list => [...list, saved]);
        }
        this.saving.set(false);
        this.cancelForm();
      },
      error: () => this.saving.set(false),
    });
  }

  toggleActive(med: Medication): void {
    this.svc.update(med.id, { isActive: !med.isActive }).subscribe({
      next: updated => this.medications.update(list => list.map(m => m.id === updated.id ? updated : m)),
    });
  }

  remove(id: string): void {
    if (!confirm('Remover este item?')) return;
    this.svc.remove(id).subscribe({
      next: () => this.medications.update(list => list.filter(m => m.id !== id)),
    });
  }

  typeIcon(type: MedType): string {
    const icons: Record<MedType, string> = {
      SUPLEMENTO: '🧴', VITAMINA: '💊', REMEDIO_CONTROLADO: '💉', TRT: '🔬'
    };
    return icons[type] ?? '💊';
  }

  typeMeta(type: MedType) { return TYPE_META[type] ?? TYPE_META.SUPLEMENTO; }
}
