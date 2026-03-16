import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { CheckInService, AdherenceResult } from '../../core/services/check-in.service';
import { WeeklyCheckIn } from '../../core/models';

@Component({
  selector: 'app-check-in',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe],
  styleUrls: ['./check-in.component.scss'],
  templateUrl: './check-in.component.html',
})
export class CheckInComponent implements OnInit {
  private svc    = inject(CheckInService);
  private router = inject(Router);

  checkIns     = signal<WeeklyCheckIn[]>([]);
  loading      = signal(false);
  saving       = signal(false);
  justSaved    = signal(false);
  adherenceData = signal<AdherenceResult | null>(null);

  readonly todayLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  // Reactive fields tracked by computed()
  currentWeight    = signal<number | null>(null);
  adherenceScore   = signal(0);

  // Plain fields (not needed in computed)
  waistCircumference: number | null = null;
  notes = '';

  adherenceLabel = computed(() => {
    const labels = ['', 'Muito ruim — quase nada seguido', 'Ruim — muitos deslizes', 'Regular — alguns deslizes', 'Bom — poucas exceções', 'Perfeito — seguiu tudo!'];
    return labels[this.adherenceScore()] ?? '';
  });

  // Only requires weight; adherence is auto-set (but can be overridden, minimum 1 star required)
  canSave = computed(() =>
    !!this.currentWeight() && this.adherenceScore() >= 1 && !this.alreadyCheckedInThisWeek()
  );

  /** Returns the date string of the check-in already done this week, or null */
  alreadyCheckedInThisWeek = computed<string | null>(() => {
    const today = new Date();
    const day = today.getDay(); // 0=Sun … 6=Sat
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const found = this.checkIns().find(ci => {
      const d = new Date(ci.date + 'T12:00:00');
      return d >= monday && d <= sunday;
    });
    return found ? found.date : null;
  });

  ngOnInit(): void {
    this.loadHistory();
    this.loadAdherence();
  }

  private loadHistory(): void {
    this.loading.set(true);
    this.svc.list().subscribe({
      next: list => { this.checkIns.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private loadAdherence(): void {
    this.svc.adherence().subscribe({
      next: data => {
        this.adherenceData.set(data);
        if (data.adherenceScore !== null) {
          this.adherenceScore.set(data.adherenceScore);
        }
      },
      error: () => { /* fail silently — user can set stars manually */ },
    });
  }

  save(): void {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.svc.create({
      date: new Date().toISOString().slice(0, 10),
      currentWeight: this.currentWeight()!,
      waistCircumference: this.waistCircumference ?? undefined,
      adherenceScore: this.adherenceScore(),
      notes: this.notes || undefined,
    }).subscribe({
      next: ci => {
        this.checkIns.update(list => [ci, ...list]);
        this.saving.set(false);
        this.justSaved.set(true);
        this.currentWeight.set(null);
        this.waistCircumference = null;
        this.adherenceScore.set(this.adherenceData()?.adherenceScore ?? 0);
        this.notes = '';
        setTimeout(() => this.justSaved.set(false), 6000);
      },
      error: (err) => {
        this.saving.set(false);
        // 409 = already checked in this week — reload list so computed picks it up
        if (err?.status === 409) {
          this.loadHistory();
        }
      },
    });
  }

  remove(id: string): void {
    this.svc.remove(id).subscribe({
      next: () => this.checkIns.update(list => list.filter(c => c.id !== id)),
    });
  }

  starsFor(score: number): string {
    return '⭐'.repeat(score) + '☆'.repeat(5 - score);
  }

  /** Returns short weekday label (e.g. "Seg") from an ISO date string */
  dayLabel(date: string): string {
    const d = new Date(date + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  }
}
