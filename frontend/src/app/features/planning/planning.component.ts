import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ProfileService } from '../../core/services/profile.service';
import { PrimaryGoal, HealthProfile, MetabolicResult } from '../../core/models';

const GOAL_OPTIONS: Array<{ value: PrimaryGoal; icon: string; label: string; desc: string; adj: number }> = [
  { value: 'emagrecimento', icon: '🔥', label: 'Emagrecimento',  desc: 'Déficit calórico para perda de peso',   adj: -500 },
  { value: 'ganho_massa',   icon: '💪', label: 'Ganho de Massa', desc: 'Superávit calórico para hipertrofia',   adj: +400 },
  { value: 'manutencao',    icon: '⚖️', label: 'Manutenção',     desc: 'Equilíbrio calórico para manutenção',  adj: 0    },
  { value: 'saude_geral',   icon: '🌿', label: 'Saúde Geral',    desc: 'Foco em hábitos e bem-estar geral',    adj: 0    },
  { value: 'diabetico',     icon: '🩺', label: 'Diabético',      desc: 'Controle glicêmico com baixo carboidrato', adj: 0 },
];

@Component({
  selector: 'app-planning',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  styles: [`
    .page { padding: 1.5rem; max-width: 720px; margin: 0 auto; }
    .page-header { margin-bottom: 1.5rem; h2 { font-size: 1.5rem; } p { color: var(--color-text-muted); } }

    .section { background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); padding: 1.5rem; margin-bottom: 1.25rem; }
    .section-title { font-size: 1rem; font-weight: 700; margin-bottom: 1rem; }

    .goal-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: .75rem;
      @media (max-width: 480px) { grid-template-columns: 1fr; } }
    .goal-card {
      display: flex; flex-direction: column; gap: .375rem;
      padding: 1rem; border: 2px solid var(--color-border);
      border-radius: var(--radius-md); cursor: pointer; transition: all .2s;
      background: var(--color-surface-2);
      .gc-top { display: flex; align-items: center; gap: .625rem; }
      .gc-icon { font-size: 1.5rem; }
      .gc-label { font-weight: 700; font-size: .9rem; }
      .gc-desc { font-size: .77rem; color: var(--color-text-subtle); }
      .gc-adj { font-size: .77rem; font-weight: 700; padding: .15rem .5rem; border-radius: 99px;
        &.neg { background: #fee2e2; color: #991b1b; }
        &.pos { background: #dcfce7; color: #166534; }
        &.zero{ background: var(--color-surface-2); color: var(--color-text-muted); }
      }
      &.selected { border-color: var(--color-primary); background: var(--color-primary-light); }
      &:hover { border-color: var(--color-primary); }
    }

    .caloric-impact {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: .875rem; margin-top: 1rem;
      @media (max-width: 600px) { grid-template-columns: repeat(2, 1fr); }
      @media (max-width: 360px) { grid-template-columns: 1fr; }
    }
    .ci-card {
      text-align: center; border-radius: var(--radius-sm); padding: .875rem;
      .ci-val  { font-size: 1.4rem; font-weight: 800; }
      .ci-lbl  { font-size: .72rem; color: var(--color-text-subtle); margin-top: .2rem; font-weight: 600; text-transform: uppercase; }
      &.bmr    { background: #f5f3ff; .ci-val { color: #6d28d9; } }
      &.base   { background: #f0f9ff; .ci-val { color: #0369a1; } }
      &.adj    { background: #fef9c3; .ci-val { color: #854d0e; } }
      &.target { background: #f0fdf4; .ci-val { color: #16a34a; } }
    }

    .alert-info { background: #eff6ff; border-left: 4px solid #3b82f6;
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
      padding: .75rem 1rem; font-size: .83rem; color: #1e40af; margin-top: .75rem; }
  `],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>📋 Planejamento</h2>
        <p>Defina seu objetivo principal e veja o impacto na sua meta calórica.</p>
      </div>

      <!-- Goal selection -->
      <div class="section">
        <div class="section-title">🎯 Objetivo Principal</div>
        <div class="goal-grid">
          @for (g of goalOptions; track g.value) {
            <div class="goal-card" [class.selected]="selectedGoal() === g.value" (click)="selectGoal(g.value)">
              <div class="gc-top">
                <span class="gc-icon">{{ g.icon }}</span>
                <span class="gc-label">{{ g.label }}</span>
              </div>
              <div class="gc-desc">{{ g.desc }}</div>
              <span class="gc-adj" [class.neg]="g.adj < 0" [class.pos]="g.adj > 0" [class.zero]="g.adj === 0">
                {{ g.adj > 0 ? '+' : '' }}{{ g.adj === 0 ? 'Neutro' : g.adj + ' kcal/dia' }}
              </span>
            </div>
          }
        </div>
      </div>

      <!-- Target weight (only for weight-change goals) -->
      @if (selectedGoal() === 'emagrecimento' || selectedGoal() === 'ganho_massa') {
        <div class="section">
          <div class="section-title">⚖️ Peso Alvo</div>
          <div class="form-group" style="max-width:220px">
            <label>Peso desejado (kg)</label>
            <input type="number" [(ngModel)]="targetWeight" min="30" max="300" step="0.5" placeholder="Ex: 75.0" />
          </div>
          @if (profile()?.weight && targetWeight) {
            <div class="alert-info" style="margin-top:.75rem">
              Diferença: {{ (targetWeight - profile()!.weight!) | number:'1.1-1' }} kg
              em relação ao peso atual ({{ profile()!.weight }} kg).
            </div>
          }
        </div>
      }

      <!-- Caloric impact -->
      @if (metabolic()) {
        <div class="section">
          <div class="section-title">🔢 Como sua meta é calculada</div>
          <div class="caloric-impact">
            <div class="ci-card bmr">
              <div class="ci-val">{{ metabolic()!.bmr | number:'1.0-0' }}</div>
              <div class="ci-lbl">TMB (Mifflin)</div>
            </div>
            <div class="ci-card base">
              <div class="ci-val">{{ metabolic()!.tee | number:'1.0-0' }}</div>
              <div class="ci-lbl">GET (TMB × NAF)</div>
            </div>
            <div class="ci-card adj">
              <div class="ci-val">{{ adjDisplayText() }}</div>
              <div class="ci-lbl">Ajuste Objetivo</div>
            </div>
            <div class="ci-card target">
              <div class="ci-val">{{ metabolic()!.dailyCaloricTarget | number:'1.0-0' }}</div>
              <div class="ci-lbl">Meta Diária (kcal)</div>
            </div>
          </div>
          <div class="alert-info" style="margin-top:.75rem">
            💡 TMB × Fator de Atividade = GET.
            @if (metabolic()!.goalAdjustmentKcal !== 0) {
              O ajuste de {{ metabolic()!.goalAdjustmentKcal > 0 ? '+' : '' }}{{ metabolic()!.goalAdjustmentKcal }} kcal
              já está embutido na meta diária de {{ metabolic()!.dailyCaloricTarget | number:'1.0-0' }} kcal.
            } @else {
              Sem ajuste calórico — meta igual ao GET.
            }
          </div>
        </div>
      }

      <!-- Save button -->
      <div style="display:flex;justify-content:flex-end;gap:.75rem;margin-top:.5rem">
        <button class="btn btn-primary" (click)="save()" [disabled]="saving() || !selectedGoal()">
          {{ saving() ? '⏳ Salvando...' : '💾 Salvar Objetivo' }}
        </button>
      </div>

      @if (savedMsg()) {
        <div class="alert alert-success" style="margin-top:.75rem">{{ savedMsg() }}</div>
      }
    </div>
  `,
})
export class PlanningComponent implements OnInit {
  private profileSvc = inject(ProfileService);

  readonly goalOptions = GOAL_OPTIONS;

  profile    = signal<HealthProfile | null>(null);
  metabolic  = signal<MetabolicResult | null>(null);
  selectedGoal = signal<PrimaryGoal | ''>('');
  targetWeight = 0;
  saving     = signal(false);
  savedMsg   = signal('');

  adjDisplayText(): string {
    const adj = this.metabolic()?.goalAdjustmentKcal
      ?? this.goalOptions.find(g => g.value === this.selectedGoal())?.adj
      ?? 0;
    if (adj === 0) return 'Neutro';
    return (adj > 0 ? '+' : '') + adj + ' kcal';
  }

  ngOnInit(): void {
    this.profileSvc.loadProfile().subscribe({
      next: p => {
        this.profile.set(p);
        if (p?.primaryGoal) this.selectedGoal.set(p.primaryGoal);
        if (p?.targetWeight) this.targetWeight = p.targetWeight;
      },
    });
    this.profileSvc.loadMetabolic().subscribe({
      next: m => this.metabolic.set(m),
    });
  }

  selectGoal(g: PrimaryGoal): void {
    this.selectedGoal.set(g);
  }

  save(): void {
    if (!this.selectedGoal()) return;
    this.saving.set(true);
    this.savedMsg.set('');
    const dto: Partial<HealthProfile> = {
      primaryGoal: this.selectedGoal() as PrimaryGoal,
      targetWeight: this.targetWeight || undefined,
    };
    this.profileSvc.saveProfile(dto).subscribe({
      next: () => {
        this.profileSvc.loadMetabolic().subscribe({ next: m => this.metabolic.set(m) });
        this.saving.set(false);
        this.savedMsg.set('✅ Objetivo salvo com sucesso!');
        setTimeout(() => this.savedMsg.set(''), 3000);
      },
      error: () => { this.saving.set(false); this.savedMsg.set('❌ Erro ao salvar.'); },
    });
  }
}
