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
  styleUrls: ['./planning.component.scss'],
  templateUrl: './planning.component.html',
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
