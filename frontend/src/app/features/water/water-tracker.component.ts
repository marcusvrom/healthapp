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
  styles: [`
    :host { display: block; }

    .water-card {
      background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
      border: 1px solid #7dd3fc;
      border-radius: var(--radius-md);
      padding: 1.25rem;
    }

    /* Card header */
    .card-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 1rem;

      .title { font-size: .95rem; font-weight: 700; color: #0c4a6e; display: flex; align-items: center; gap: .5rem; }
      .toggle-btn {
        background: rgba(14,165,233,.15); border: none; border-radius: var(--radius-sm);
        padding: .3rem .65rem; font-size: .75rem; font-weight: 600; color: #0369a1;
        cursor: pointer; transition: background .15s;
        &:hover { background: rgba(14,165,233,.3); }
      }
    }

    /* Progress section */
    .progress-section {
      margin-bottom: 1.25rem;

      .amounts {
        display: flex; align-items: baseline; gap: .375rem; margin-bottom: .625rem;
        .current  { font-size: 2.25rem; font-weight: 800; color: #0369a1; line-height: 1; }
        .slash    { font-size: 1.1rem; color: #7dd3fc; }
        .goal     { font-size: 1.1rem; color: #0369a1; }
        .unit     { font-size: .75rem; color: #38bdf8; }
        .pct-chip {
          margin-left: auto;
          background: rgba(14,165,233,.2); border-radius: 99px;
          padding: .2rem .6rem; font-size: .75rem; font-weight: 700; color: #0369a1;
        }
      }

      .bar-track {
        height: 10px; background: rgba(255,255,255,.5); border-radius: 99px; overflow: hidden;
        .bar-fill {
          height: 100%; border-radius: 99px;
          background: linear-gradient(90deg, #38bdf8, #0284c7);
          transition: width .6s cubic-bezier(.22,1,.36,1);
        }
      }

      .bar-label { display: flex; justify-content: space-between; margin-top: .375rem;
        font-size: .7rem; color: #0369a1; }
    }

    /* Quick-add buttons */
    .quick-add {
      display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 1rem;

      .qa-btn {
        flex: 1; min-width: 60px;
        padding: .5rem .25rem;
        background: rgba(255,255,255,.6); border: 1.5px solid #7dd3fc;
        border-radius: var(--radius-sm); font-size: .82rem; font-weight: 700;
        color: #0369a1; cursor: pointer; transition: all .15s;
        text-align: center;

        &:hover { background: #fff; border-color: #0284c7; }
        &:active { transform: scale(.96); }
      }
    }

    /* Custom add form */
    .custom-add {
      background: rgba(255,255,255,.55); border-radius: var(--radius-sm);
      padding: .875rem; border: 1px solid #7dd3fc;

      .form-row {
        display: grid; grid-template-columns: 1fr 1fr; gap: .625rem; margin-bottom: .625rem;
      }

      label { font-size: .75rem; font-weight: 600; color: #0369a1; display: block; margin-bottom: .2rem; }
      input  {
        width: 100%; padding: .45rem .65rem;
        border: 1.5px solid #7dd3fc; border-radius: 6px;
        background: #fff; font-size: .85rem; outline: none;
        &:focus { border-color: #0284c7; }
      }

      .submit-row { display: flex; gap: .5rem; }
      .add-btn {
        flex: 1; padding: .55rem; font-size: .85rem; font-weight: 700;
        background: #0284c7; color: #fff; border: none; border-radius: 6px;
        cursor: pointer; transition: background .15s;
        &:hover { background: #0369a1; }
        &:disabled { opacity: .6; cursor: wait; }
      }
    }

    /* Today's log list */
    .log-section {
      margin-top: 1rem;

      .log-title {
        font-size: .78rem; font-weight: 700; color: #0369a1;
        margin-bottom: .5rem; display: flex; align-items: center; justify-content: space-between;
      }

      .log-list { display: flex; flex-direction: column; gap: .3rem; max-height: 200px; overflow-y: auto; }

      .log-item {
        display: flex; align-items: center;
        background: rgba(255,255,255,.55); border-radius: 6px;
        padding: .3rem .625rem; font-size: .78rem;

        .log-qty  { font-weight: 700; color: #0284c7; margin-right: .375rem; }
        .log-time { color: #38bdf8; margin-right: auto; }
        .del-btn  { background: none; border: none; cursor: pointer; color: #7dd3fc; font-size: .9rem;
          &:hover { color: #dc2626; } }
      }

      .no-logs { font-size: .78rem; color: #38bdf8; text-align: center; padding: .5rem; }
    }

    /* Compact mode (for dashboard widget) */
    :host(.compact) {
      .log-section { display: none; }
      .custom-add { display: none; }
    }
  `],
  template: `
    <div class="water-card">
      <div class="card-header">
        <span class="title">💧 Hidratação</span>
        <button class="toggle-btn" (click)="showForm.set(!showForm())">
          {{ showForm() ? 'Fechar ▲' : 'Registrar ▼' }}
        </button>
      </div>

      <!-- Progress bar -->
      <div class="progress-section">
        <div class="amounts">
          <span class="current">{{ todayTotal() }}</span>
          <span class="slash">/</span>
          <span class="goal">{{ goal() }}</span>
          <span class="unit">ml</span>
          <span class="pct-chip">{{ pct() | number:'1.0-0' }}%</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" [style.width.%]="pct()"></div>
        </div>
        <div class="bar-label">
          <span>Consumido: {{ todayTotal() }} ml</span>
          <span>Meta: {{ goal() }} ml</span>
        </div>
      </div>

      <!-- Quick add buttons (always visible) -->
      <div class="quick-add">
        @for (amt of quickAmounts; track amt) {
          <button class="qa-btn" (click)="quickAdd(amt)" [disabled]="adding()">
            +{{ amt }}ml
          </button>
        }
      </div>

      <!-- Custom add form (collapsible) -->
      @if (showForm()) {
        <div class="custom-add animate-fade">
          <div class="form-row">
            <div>
              <label>Quantidade (ml)</label>
              <input type="number" [(ngModel)]="customMl" min="50" max="3000" placeholder="ex: 300" />
            </div>
            <div>
              <label>Horário</label>
              <input type="datetime-local" [(ngModel)]="customTime" />
            </div>
          </div>
          <div class="submit-row">
            <button class="add-btn" (click)="addCustom()" [disabled]="adding() || !customMl">
              {{ adding() ? 'Registrando...' : '✓ Registrar' }}
            </button>
          </div>
        </div>
      }

      <!-- Today's log -->
      @if (showLogs()) {
        <div class="log-section animate-fade">
          <div class="log-title">
            <span>Registros de hoje</span>
            <span>{{ logs().length }} entrada{{ logs().length !== 1 ? 's' : '' }}</span>
          </div>
          <div class="log-list">
            @if (logs().length === 0) {
              <div class="no-logs">Nenhum registro ainda.</div>
            }
            @for (log of logs(); track log.id) {
              <div class="log-item">
                <span class="log-qty">{{ log.quantityMl }} ml</span>
                <span class="log-time">{{ log.loggedAt | date:'HH:mm' }}</span>
                <button class="del-btn" (click)="removeLog(log.id)" title="Remover">✕</button>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
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
