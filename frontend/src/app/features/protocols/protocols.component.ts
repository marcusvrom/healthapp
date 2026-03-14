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
  styleUrls: ['./protocols.component.scss'],
  templateUrl: './protocols.component.html',
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
