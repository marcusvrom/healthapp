import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { CheckInService, AdherenceResult } from '../../core/services/check-in.service';
import { WeeklyCheckIn } from '../../core/models';

@Component({
  selector: 'app-check-in',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe],
  styles: [`
    .page { padding: 1.5rem; max-width: 720px; margin: 0 auto; }

    .hero {
      text-align: center; padding: 2rem 1.5rem 1.5rem;
      background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
      border-radius: var(--radius-lg); color: #fff; margin-bottom: 2rem;
      position: relative; overflow: hidden;

      &::before {
        content: ''; position: absolute; inset: 0;
        background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.06'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E");
        pointer-events: none;
      }

      .hero-emoji { font-size: 3.5rem; display: block; margin-bottom: .75rem; animation: bounce 1.5s ease-in-out infinite; }
      h2 { font-size: 1.6rem; font-weight: 800; margin-bottom: .5rem; }
      p  { opacity: .85; font-size: .92rem; max-width: 400px; margin: 0 auto; }
    }

    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50%       { transform: translateY(-8px); }
    }

    /* Form card */
    .form-card {
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); padding: 1.75rem; margin-bottom: 1.5rem;
    }

    .form-card h3 {
      font-size: 1rem; font-weight: 700; margin-bottom: 1.25rem;
      display: flex; align-items: center; gap: .5rem;
    }

    .fields-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;
      @media (max-width: 540px) { grid-template-columns: 1fr; }
    }

    .field-full { grid-column: 1 / -1; }

    .form-group {
      display: flex; flex-direction: column; gap: .35rem;

      label { font-size: .8rem; font-weight: 600; color: var(--color-text-muted); }
      input, textarea {
        padding: .6rem .75rem; border: 1.5px solid var(--color-border);
        border-radius: var(--radius-sm); font-size: .9rem;
        background: var(--color-surface-2); font-family: inherit;
        transition: border-color .15s;
        &:focus { outline: none; border-color: var(--color-primary); }
      }
      textarea { min-height: 72px; resize: vertical; }
    }

    /* Adherence auto-calc banner */
    .adherence-auto {
      background: var(--color-surface-2); border: 1px solid var(--color-border);
      border-radius: var(--radius-sm); padding: .75rem 1rem; margin-bottom: .5rem;
      display: flex; align-items: center; gap: .75rem; flex-wrap: wrap;

      .auto-label { font-size: .75rem; color: var(--color-text-muted); font-weight: 600; flex: 1 0 100%; }
      .auto-pct { font-size: 1.4rem; font-weight: 800; color: var(--color-primary); }
      .auto-desc { font-size: .8rem; color: var(--color-text-muted); }
    }

    /* Daily breakdown */
    .daily-breakdown {
      display: flex; gap: .4rem; margin-top: .5rem; flex-wrap: wrap;

      .day-pill {
        display: flex; flex-direction: column; align-items: center; gap: .15rem;
        padding: .35rem .5rem; border-radius: var(--radius-sm); min-width: 42px;
        font-size: .7rem; border: 1px solid var(--color-border);
        background: var(--color-surface-2);

        .day-name { font-weight: 600; color: var(--color-text-muted); }
        .day-pct  { font-weight: 700; }
        .day-bar  {
          width: 28px; height: 4px; border-radius: 2px; background: var(--color-border);
          position: relative;
          .fill { position: absolute; left: 0; top: 0; height: 100%; border-radius: 2px; }
        }

        &.pct-high   { border-color: #6ee7b7; background: #ecfdf5; .day-pct { color: #059669; } .fill { background: #10b981; } }
        &.pct-mid    { border-color: #fcd34d; background: #fffbeb; .day-pct { color: #d97706; } .fill { background: #f59e0b; } }
        &.pct-low    { border-color: #fca5a5; background: #fef2f2; .day-pct { color: #dc2626; } .fill { background: #ef4444; } }
        &.pct-none   { opacity: .45; }
      }
    }

    /* Star rating */
    .star-row {
      display: flex; gap: .5rem; align-items: center; margin-top: .25rem;

      .star {
        font-size: 2rem; cursor: pointer; transition: transform .1s;
        line-height: 1;
        &:hover { transform: scale(1.2); }
        &.active { filter: drop-shadow(0 0 4px #f59e0b); }
      }
    }

    .adherence-label {
      font-size: .78rem; color: var(--color-text-muted); margin-top: .25rem; min-height: 1.1em;
    }

    .override-hint {
      font-size: .72rem; color: var(--color-text-subtle); margin-top: .2rem;
    }

    /* Submit button */
    .btn-submit {
      width: 100%; padding: .875rem; font-size: 1rem; font-weight: 700;
      background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
      color: #fff; border: none; border-radius: var(--radius-md); cursor: pointer;
      margin-top: 1.25rem; transition: opacity .2s;
      display: flex; align-items: center; justify-content: center; gap: .5rem;
      &:disabled { opacity: .5; cursor: not-allowed; }
    }

    /* XP celebration */
    .xp-badge {
      display: inline-flex; align-items: center; gap: .35rem;
      background: #fef3c7; color: #92400e; padding: .3rem .75rem;
      border-radius: 99px; font-size: .8rem; font-weight: 700;
      border: 1px solid #fcd34d; animation: pop .4s cubic-bezier(.36,.07,.19,.97);
    }

    @keyframes pop {
      0%   { transform: scale(.5); opacity: 0; }
      70%  { transform: scale(1.1); opacity: 1; }
      100% { transform: scale(1); }
    }

    /* History */
    .history-card {
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); padding: 1.25rem;

      h3 { font-size: .95rem; font-weight: 700; margin-bottom: 1rem; }
    }

    .history-list { display: flex; flex-direction: column; gap: .75rem; }

    .history-item {
      display: flex; align-items: center; gap: 1rem; padding: .75rem 1rem;
      border: 1px solid var(--color-border); border-radius: var(--radius-sm);
      background: var(--color-surface-2);

      .hi-date { font-size: .78rem; color: var(--color-text-muted); min-width: 70px; }
      .hi-weight { font-size: 1.05rem; font-weight: 700; }
      .hi-waist { font-size: .82rem; color: var(--color-text-muted); }
      .hi-stars { letter-spacing: 1px; }
      .hi-del {
        margin-left: auto; background: none; border: none; cursor: pointer;
        color: var(--color-text-subtle); font-size: .85rem; padding: .25rem .5rem;
        border-radius: var(--radius-sm); transition: background .15s;
        &:hover { background: #fee2e2; color: #dc2626; }
      }
    }

    .empty-history {
      text-align: center; padding: 2rem; color: var(--color-text-muted); font-size: .88rem;
    }

    .success-banner {
      background: linear-gradient(135deg, #d1fae5, #a7f3d0);
      border: 1px solid #6ee7b7; border-radius: var(--radius-md);
      padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;
      display: flex; align-items: center; gap: 1rem;

      .sb-icon { font-size: 2rem; }
      .sb-text h4 { font-weight: 700; color: #065f46; }
      .sb-text p  { font-size: .85rem; color: #047857; margin-top: .2rem; }
    }
  `],
  template: `
    <div class="page">

      <!-- Hero -->
      <div class="hero">
        <span class="hero-emoji">📸</span>
        <h2>Check-in Semanal</h2>
        <p>Registre seu progresso, ganhe XP e deixe o Copiloto analisar sua evolução.</p>
      </div>

      <!-- Success banner after save -->
      @if (justSaved()) {
        <div class="success-banner">
          <span class="sb-icon">🎉</span>
          <div class="sb-text">
            <h4>Check-in registrado!</h4>
            <p>Incrível! Seus dados foram salvos. O Copiloto já está analisando sua evolução.</p>
          </div>
          <span class="xp-badge">+50 XP</span>
        </div>
      }

      <!-- Check-in form -->
      <div class="form-card">
        <h3>⚖️ Dados de hoje · {{ todayLabel }}</h3>

        <div class="fields-grid">
          <!-- Weight -->
          <div class="form-group">
            <label>Peso atual (kg) *</label>
            <input type="number"
              [ngModel]="currentWeight()"
              (ngModelChange)="currentWeight.set($event ? +$event : null)"
              placeholder="ex: 78.5" min="20" max="300" step="0.1" />
          </div>

          <!-- Waist -->
          <div class="form-group">
            <label>Circunferência abdominal (cm)</label>
            <input type="number" [(ngModel)]="waistCircumference"
              placeholder="opcional" min="40" max="200" step="0.5" />
          </div>

          <!-- Adherence — auto-calculated + optional override -->
          <div class="form-group field-full">
            <label>Adesão ao plano esta semana *</label>

            @if (adherenceData(); as data) {
              @if (data.weekPct !== null) {
                <!-- Auto-calc result -->
                <div class="adherence-auto">
                  <span class="auto-label">Calculado automaticamente pelos blocos concluídos</span>
                  <span class="auto-pct">{{ data.weekPct }}%</span>
                  <span class="auto-desc">de média semanal ({{ data.dailyStats.length }} dia(s) com rotina)</span>

                  <!-- Daily breakdown pills -->
                  @if (data.dailyStats.length > 0) {
                    <div class="daily-breakdown">
                      @for (d of data.dailyStats; track d.date) {
                        <div class="day-pill"
                          [class.pct-high]="d.pct >= 70"
                          [class.pct-mid]="d.pct >= 35 && d.pct < 70"
                          [class.pct-low]="d.pct > 0 && d.pct < 35"
                          [class.pct-none]="d.pct === 0">
                          <span class="day-name">{{ dayLabel(d.date) }}</span>
                          <div class="day-bar"><div class="fill" [style.width.%]="d.pct"></div></div>
                          <span class="day-pct">{{ d.pct }}%</span>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            }

            <!-- Stars (pre-filled from auto-calc, can be overridden) -->
            <div class="star-row">
              @for (s of [1,2,3,4,5]; track s) {
                <span class="star" [class.active]="s <= adherenceScore()"
                  (click)="adherenceScore.set(s)">
                  {{ s <= adherenceScore() ? '⭐' : '☆' }}
                </span>
              }
            </div>
            <div class="adherence-label">{{ adherenceLabel() }}</div>
            @if (adherenceData()?.weekPct !== null) {
              <div class="override-hint">Clique nas estrelas para corrigir se desejar.</div>
            }
          </div>

          <!-- Notes -->
          <div class="form-group field-full">
            <label>Observações (opcional)</label>
            <textarea [(ngModel)]="notes" placeholder="Como foi a semana? Algo relevante?"></textarea>
          </div>
        </div>

        <button class="btn-submit" (click)="save()" [disabled]="!canSave() || saving()">
          @if (saving()) {
            <span class="spinner" style="width:18px;height:18px"></span> Salvando...
          } @else {
            ✅ Registrar Check-in &nbsp; <span class="xp-badge">+50 XP</span>
          }
        </button>
      </div>

      <!-- History -->
      <div class="history-card">
        <h3>📋 Histórico de Check-ins</h3>

        @if (loading()) {
          <div class="empty-history"><span class="spinner"></span></div>
        } @else if (checkIns().length === 0) {
          <div class="empty-history">
            <p>Nenhum check-in registrado ainda.</p>
            <p style="margin-top:.5rem">Faça seu primeiro check-in para começar a acompanhar seu progresso!</p>
          </div>
        } @else {
          <div class="history-list">
            @for (ci of checkIns(); track ci.id) {
              <div class="history-item">
                <span class="hi-date">{{ ci.date | date:'dd/MM/yy' }}</span>
                <span class="hi-weight">{{ ci.currentWeight | number:'1.1-1' }} kg</span>
                @if (ci.waistCircumference) {
                  <span class="hi-waist">• {{ ci.waistCircumference }} cm</span>
                }
                <span class="hi-stars">{{ starsFor(ci.adherenceScore) }}</span>
                <button class="hi-del" (click)="remove(ci.id)" title="Remover">✕</button>
              </div>
            }
          </div>
        }
      </div>

    </div>
  `,
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
    !!this.currentWeight() && this.adherenceScore() >= 1
  );

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
      error: () => this.saving.set(false),
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
