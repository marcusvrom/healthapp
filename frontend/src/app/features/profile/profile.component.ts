import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ProfileService } from '../../core/services/profile.service';
import { HealthProfile, ActivityFactor, Gender, Exercise, BloodTest } from '../../core/models';

const ACTIVITY_LABELS: Record<ActivityFactor, string> = {
  sedentary:         '🪑 Sedentário',
  lightly_active:    '🚶 Levemente ativo',
  moderately_active: '🏃 Moderadamente ativo',
  very_active:       '💪 Muito ativo',
  extra_active:      '🏋️ Extremamente ativo',
};

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  styles: [`
    .profile-page { padding: 1.5rem; max-width: 900px; margin: 0 auto; }
    .page-header  { margin-bottom: 2rem;
      h2 { font-size: 1.5rem; }
      p  { color: var(--color-text-muted); }
    }

    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;
      @media (max-width: 700px) { grid-template-columns: 1fr; }
    }
    .section-title { font-size: 1rem; font-weight: 700; margin-bottom: 1.25rem;
      display: flex; align-items: center; gap: .5rem; }
    .fields { display: flex; flex-direction: column; gap: 1rem; }
    .row-2  { display: grid; grid-template-columns: 1fr 1fr; gap: .875rem; }

    .save-btn { margin-top: 1.25rem; }

    .metabolic-banner {
      background: linear-gradient(135deg, #064e3b, #10b981);
      border-radius: var(--radius-md); padding: 1.5rem; color: #fff; margin-bottom: 1.5rem;
      display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem;

      .metric { text-align: center;
        .val { font-size: 1.5rem; font-weight: 800; }
        .lbl { font-size: .72rem; color: rgba(255,255,255,.8); margin-top: .2rem; }
      }
    }

    /* Exercise list */
    .exercise-list { display: flex; flex-direction: column; gap: .625rem; margin-bottom: 1rem; }
    .exercise-row  {
      background: var(--color-surface-2); border: 1px solid var(--color-border);
      border-radius: var(--radius-sm); padding: .75rem 1rem;
      display: flex; align-items: center; gap: .75rem;

      .ex-name { font-weight: 600; font-size: .875rem; flex: 1; }
      .ex-meta { font-size: .72rem; color: var(--color-text-subtle); }
      .del-btn { background: none; border: none; cursor: pointer; color: var(--color-text-subtle);
        &:hover { color: var(--color-danger); } }
    }

    /* Blood test */
    .bt-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: .875rem; }
    .success-msg { color: var(--color-primary); font-size: .875rem; font-weight: 600; padding: .5rem 0; }
  `],
  template: `
    <div class="profile-page">
      <div class="page-header">
        <h2>👤 Perfil de Saúde</h2>
        <p>Mantenha suas informações atualizadas para cálculos precisos.</p>
      </div>

      <!-- Metabolic summary -->
      @if (metabolic()) {
        <div class="metabolic-banner animate-fade">
          <div class="metric"><div class="val">{{ metabolic()!.bmr | number:'1.0-0' }}</div><div class="lbl">TMB (kcal)</div></div>
          <div class="metric"><div class="val">{{ metabolic()!.tee | number:'1.0-0' }}</div><div class="lbl">GET (kcal)</div></div>
          <div class="metric"><div class="val">{{ metabolic()!.dailyCaloricTarget | number:'1.0-0' }}</div><div class="lbl">Meta calórica</div></div>
          <div class="metric"><div class="val">{{ metabolic()!.macros.proteinG | number:'1.0-0' }}g</div><div class="lbl">Proteína/dia</div></div>
          <div class="metric"><div class="val">{{ metabolic()!.waterMlTotal | number:'1.0-0' }}ml</div><div class="lbl">Água/dia</div></div>
        </div>
      }

      @if (saveSuccess()) { <div class="success-msg">✓ Perfil salvo com sucesso!</div> }
      @if (saveError())   { <div class="alert alert-error mb-4">{{ saveError() }}</div> }

      <div class="grid-2">
        <!-- Personal data -->
        <div class="card">
          <div class="section-title">🧍 Dados Pessoais</div>
          <div class="fields">
            <div class="row-2">
              <div class="form-group">
                <label>Idade (anos)</label>
                <input type="number" [(ngModel)]="form.age" min="10" max="120" />
              </div>
              <div class="form-group">
                <label>Gênero</label>
                <select [(ngModel)]="form.gender">
                  <option value="male">Masculino</option>
                  <option value="female">Feminino</option>
                  <option value="other">Outro</option>
                </select>
              </div>
            </div>
            <div class="row-2">
              <div class="form-group">
                <label>Peso (kg)</label>
                <input type="number" [(ngModel)]="form.weight" step="0.1" />
              </div>
              <div class="form-group">
                <label>Altura (cm)</label>
                <input type="number" [(ngModel)]="form.height" />
              </div>
            </div>
            <div class="form-group">
              <label>Fator de Atividade</label>
              <select [(ngModel)]="form.activityFactor">
                @for (a of activityOptions; track a.value) {
                  <option [value]="a.value">{{ a.label }}</option>
                }
              </select>
            </div>
          </div>
        </div>

        <!-- Schedule -->
        <div class="card">
          <div class="section-title">🕐 Horários de Rotina</div>
          <div class="fields">
            <div class="row-2">
              <div class="form-group"><label>⏰ Acorda às</label><input type="time" [(ngModel)]="form.wakeUpTime" /></div>
              <div class="form-group"><label>🌙 Dorme às</label><input type="time" [(ngModel)]="form.sleepTime" /></div>
            </div>
            <div class="row-2">
              <div class="form-group"><label>💼 Início trabalho</label><input type="time" [(ngModel)]="form.workStartTime" /></div>
              <div class="form-group"><label>🏠 Fim trabalho</label><input type="time" [(ngModel)]="form.workEndTime" /></div>
            </div>
            <div class="form-group" style="margin-top:.5rem">
              <button class="btn btn-primary save-btn" (click)="saveProfile()" [disabled]="saving()">
                {{ saving() ? 'Salvando...' : '💾 Salvar Perfil' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Exercises -->
        <div class="card">
          <div class="section-title">💪 Exercícios Cadastrados</div>
          @if (exercises().length === 0) {
            <p class="text-muted">Nenhum exercício cadastrado.</p>
          } @else {
            <div class="exercise-list">
              @for (ex of exercises(); track ex.id) {
                <div class="exercise-row">
                  <div style="flex:1">
                    <div class="ex-name">{{ ex.name }}</div>
                    <div class="ex-meta">MET {{ ex.met }} · {{ ex.durationMinutes }}min · Score {{ ex.hypertrophyScore }}/10</div>
                  </div>
                  <button class="del-btn" (click)="deleteExercise(ex.id)">🗑️</button>
                </div>
              }
            </div>
          }
        </div>

        <!-- Blood test -->
        <div class="card">
          <div class="section-title">🩸 Cadastrar Exame de Sangue</div>
          <div class="bt-grid">
            <div class="form-group"><label>Glicemia (mg/dL)</label><input type="number" [(ngModel)]="bt.glucoseMgDl" placeholder="Ex: 95" /></div>
            <div class="form-group"><label>Insulina (μIU/mL)</label><input type="number" [(ngModel)]="bt.insulinUiuMl" placeholder="Ex: 10" /></div>
            <div class="form-group"><label>LDL (mg/dL)</label><input type="number" [(ngModel)]="bt.ldlMgDl" placeholder="Ex: 100" /></div>
            <div class="form-group"><label>HDL (mg/dL)</label><input type="number" [(ngModel)]="bt.hdlMgDl" placeholder="Ex: 55" /></div>
            <div class="form-group"><label>Triglicerídeos</label><input type="number" [(ngModel)]="bt.triglyceridesMgDl" placeholder="Ex: 120" /></div>
            <div class="form-group"><label>Vitamina D (ng/mL)</label><input type="number" [(ngModel)]="bt.vitaminDNgMl" placeholder="Ex: 35" /></div>
            <div class="form-group"><label>PCR-us (mg/L)</label><input type="number" [(ngModel)]="bt.crpMgL" placeholder="Ex: 1.2" /></div>
            <div class="form-group"><label>Data da coleta</label><input type="date" [(ngModel)]="bt.collectedAt" /></div>
          </div>
          <button class="btn btn-primary mt-4" (click)="saveBloodTest()" [disabled]="savingBt()">
            {{ savingBt() ? 'Salvando...' : '🩸 Salvar Exame' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ProfileComponent implements OnInit {
  private profileSvc = inject(ProfileService);

  metabolic  = this.profileSvc.metabolic;
  saving     = signal(false);
  saveSuccess= signal(false);
  saveError  = signal('');
  savingBt   = signal(false);
  exercises  = signal<Exercise[]>([]);

  form: Partial<HealthProfile> = {
    age: undefined, gender: 'male', weight: undefined, height: undefined,
    activityFactor: 'sedentary', wakeUpTime: '07:00', sleepTime: '23:00',
    workStartTime: '09:00', workEndTime: '18:00',
  };

  bt: Partial<BloodTest> = {
    collectedAt: new Date().toISOString().slice(0, 10),
  };

  readonly activityOptions = Object.entries(ACTIVITY_LABELS).map(([value, label]) => ({ value, label }));

  ngOnInit(): void {
    this.profileSvc.loadProfile().subscribe({
      next: p => { Object.assign(this.form, p); },
      error: () => {},
    });
    this.profileSvc.loadMetabolic().subscribe({ error: () => {} });
    this.profileSvc.getExercises().subscribe({
      next: ex => this.exercises.set(ex),
      error: () => {},
    });
  }

  saveProfile(): void {
    this.saving.set(true);
    this.saveSuccess.set(false);
    this.saveError.set('');

    this.profileSvc.saveProfile(this.form).subscribe({
      next: () => {
        this.saving.set(false);
        this.saveSuccess.set(true);
        this.profileSvc.loadMetabolic().subscribe({ error: () => {} });
        setTimeout(() => this.saveSuccess.set(false), 3000);
      },
      error: (e) => {
        this.saving.set(false);
        this.saveError.set(e.error?.message ?? 'Erro ao salvar perfil.');
      },
    });
  }

  deleteExercise(id: string): void {
    this.profileSvc.deleteExercise(id).subscribe({
      next: () => this.exercises.update(ex => ex.filter(e => e.id !== id)),
    });
  }

  saveBloodTest(): void {
    this.savingBt.set(true);
    this.profileSvc.saveBloodTest(this.bt).subscribe({
      next: () => {
        this.savingBt.set(false);
        this.bt = { collectedAt: new Date().toISOString().slice(0, 10) };
        this.saveSuccess.set(true);
        setTimeout(() => this.saveSuccess.set(false), 3000);
      },
      error: () => this.savingBt.set(false),
    });
  }
}
