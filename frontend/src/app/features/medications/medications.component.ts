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
  styleUrls: ['./medications.component.scss'],
  templateUrl: './medications.component.html',
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
