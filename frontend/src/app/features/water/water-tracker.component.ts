import { Component, inject, signal, computed, OnInit, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { WaterService, WaterLog } from '../../core/services/water.service';
import { ProfileService } from '../../core/services/profile.service';

const QUICK_AMOUNTS = [150, 250, 350, 500] as const;

@Component({
  selector: 'app-water-tracker',
  standalone: true,
  imports: [FormsModule, DecimalPipe, DatePipe],
  styleUrls: ['./water-tracker.component.scss'],
  templateUrl: './water-tracker.component.html',
})
export class WaterTrackerComponent implements OnInit {
  private waterSvc  = inject(WaterService);
  private profileSvc= inject(ProfileService);

  /** When true, hides logs (used when embedded as a dashboard widget) */
  @Input() showLogs = signal(true);

  readonly quickAmounts = QUICK_AMOUNTS;

  readonly todayTotal = this.waterSvc.todayTotal;
  readonly logs       = this.waterSvc.todayLogs;

  readonly goal = computed(() => this.waterSvc.todayGoal());
  readonly pct  = computed(() => Math.min(100, (this.todayTotal() / this.goal()) * 100));

  showForm   = signal(false);
  adding     = signal(false);
  customMl   = 250;
  customTime = this.nowLocalISO();

  ngOnInit(): void {
    this.waterSvc.loadToday().subscribe({ error: () => {} });
    // Pull water goal from metabolic result
    this.profileSvc.loadMetabolic().subscribe({
      next: m => { if (m?.waterMlTotal) this.waterSvc.setGoal(m.waterMlTotal); },
      error: () => {},
    });
  }

  quickAdd(ml: number): void {
    this.adding.set(true);
    this.waterSvc.add(ml).subscribe({
      next: () => this.adding.set(false),
      error: () => this.adding.set(false),
    });
  }

  addCustom(): void {
    if (!this.customMl || this.customMl <= 0) return;
    this.adding.set(true);
    const loggedAt = this.customTime ? new Date(this.customTime).toISOString() : undefined;
    this.waterSvc.add(this.customMl, loggedAt).subscribe({
      next: () => {
        this.adding.set(false);
        this.showForm.set(false);
        this.customMl   = 250;
        this.customTime = this.nowLocalISO();
      },
      error: () => this.adding.set(false),
    });
  }

  removeLog(id: string): void {
    this.waterSvc.remove(id).subscribe({ error: () => {} });
  }

  private nowLocalISO(): string {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }
}
