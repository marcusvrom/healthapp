import { Component, inject, signal, OnInit, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ProfileService } from '../../core/services/profile.service';
import { UserService } from '../../core/services/user.service';
import {
  HealthProfile, ActivityFactor, Gender,
  Exercise, ExerciseCategory, ExercisePreset, BloodTest,
} from '../../core/models';
import { environment } from '../../environments/environment';

// ── Constants ─────────────────────────────────────────────────────────────────
const ACTIVITY_LABELS: Record<ActivityFactor, string> = {
  sedentary:         '🪑 Sedentário',
  lightly_active:    '🚶 Levemente ativo',
  moderately_active: '🏃 Moderadamente ativo',
  very_active:       '💪 Muito ativo',
  extra_active:      '🏋️ Extremamente ativo',
};

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAYS = [0, 1, 2, 3, 4, 5, 6];

const CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  strength:    '💪 Força',
  cardio:      '🏃 Cardio',
  flexibility: '🧘 Flexibilidade',
  mind_body:   '🧠 Mente-corpo',
  sports:      '⚽ Esporte',
};

// ── Blood test accordion ───────────────────────────────────────────────────────
interface BtField { key: string; label: string; placeholder?: string; step?: string; }
interface BtSection { title: string; icon: string; fields: BtField[]; }

const BT_SECTIONS: BtSection[] = [
  {
    title: 'Perfil Metabólico', icon: '🍬',
    fields: [
      { key: 'glucoseMgDl',   label: 'Glicemia (mg/dL)',   placeholder: 'Ex: 95' },
      { key: 'insulinUiuMl',  label: 'Insulina (μIU/mL)',  placeholder: 'Ex: 10' },
      { key: 'hba1cPct',      label: 'HbA1c (%)',          placeholder: 'Ex: 5.4', step: '0.1' },
    ],
  },
  {
    title: 'Perfil Lipídico', icon: '🫀',
    fields: [
      { key: 'cholesterolTotalMgDl', label: 'Colesterol Total (mg/dL)', placeholder: 'Ex: 190' },
      { key: 'ldlMgDl',             label: 'LDL (mg/dL)',               placeholder: 'Ex: 100' },
      { key: 'hdlMgDl',             label: 'HDL (mg/dL)',               placeholder: 'Ex: 55'  },
      { key: 'triglyceridesMgDl',   label: 'Triglicerídeos (mg/dL)',    placeholder: 'Ex: 120' },
    ],
  },
  {
    title: 'Painel Hormonal', icon: '⚗️',
    fields: [
      { key: 'testosteroneTotalNgDl', label: 'Testosterona Total (ng/dL)', placeholder: 'Ex: 650' },
      { key: 'testosteroneFreeNgDl',  label: 'Testosterona Livre (ng/dL)', placeholder: 'Ex: 12',  step: '0.01' },
      { key: 'estradiolPgMl',         label: 'Estradiol E2 (pg/mL)',       placeholder: 'Ex: 25'  },
      { key: 'shbgNmolL',             label: 'SHBG (nmol/L)',              placeholder: 'Ex: 35'  },
      { key: 'prolactinNgMl',         label: 'Prolactina (ng/mL)',         placeholder: 'Ex: 8'   },
      { key: 'dhtPgMl',               label: 'DHT (pg/mL)',                placeholder: 'Ex: 300' },
      { key: 'fshMuiMl',              label: 'FSH (mUI/mL)',               placeholder: 'Ex: 4'   },
      { key: 'lhMuiMl',               label: 'LH (mUI/mL)',                placeholder: 'Ex: 5'   },
      { key: 'cortisolMcgDl',         label: 'Cortisol matinal (μg/dL)',   placeholder: 'Ex: 15'  },
    ],
  },
  {
    title: 'Tireoide', icon: '🦋',
    fields: [
      { key: 'tshMiuL',      label: 'TSH (μIU/mL)',  placeholder: 'Ex: 2.1', step: '0.01' },
      { key: 't3FreePgMl',   label: 'T3 Livre (pg/mL)', placeholder: 'Ex: 3.2', step: '0.1' },
      { key: 't4FreeNgDl',   label: 'T4 Livre (ng/dL)', placeholder: 'Ex: 1.2', step: '0.1' },
    ],
  },
  {
    title: 'Hepático & Renal', icon: '🫁',
    fields: [
      { key: 'astUL',          label: 'AST/TGO (U/L)',     placeholder: 'Ex: 28' },
      { key: 'altUL',          label: 'ALT/TGP (U/L)',     placeholder: 'Ex: 25' },
      { key: 'gamaGtUL',       label: 'GGT (U/L)',         placeholder: 'Ex: 30' },
      { key: 'creatinineMgDl', label: 'Creatinina (mg/dL)',placeholder: 'Ex: 1.0', step: '0.01' },
      { key: 'ureaMgDl',       label: 'Ureia (mg/dL)',     placeholder: 'Ex: 35' },
    ],
  },
  {
    title: 'Vitaminas & Inflamação', icon: '💊',
    fields: [
      { key: 'vitaminDNgMl',   label: 'Vitamina D (ng/mL)', placeholder: 'Ex: 40' },
      { key: 'vitaminB12PgMl', label: 'Vitamina B12 (pg/mL)', placeholder: 'Ex: 500' },
      { key: 'ferritinNgMl',   label: 'Ferritina (ng/mL)',   placeholder: 'Ex: 80' },
      { key: 'crpMgL',         label: 'PCR-us (mg/L)',       placeholder: 'Ex: 1.2', step: '0.1' },
    ],
  },
];

// ── Blank exercise form ───────────────────────────────────────────────────────
function blankExForm() {
  return {
    id: undefined as string | undefined,
    selectedPresetName: '',
    name: '', category: 'strength' as ExerciseCategory,
    met: 0, hypertrophyScore: 0,
    durationMinutes: 45,
    preferredTime: '', daysOfWeek: [] as number[],
  };
}

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

    /* ── Exercise list ──────────────────────────────────────────────────────── */
    .exercise-list { display: flex; flex-direction: column; gap: .625rem; margin-bottom: 1rem; }
    .exercise-row  {
      background: var(--color-surface-2); border: 1px solid var(--color-border);
      border-radius: var(--radius-sm); padding: .75rem 1rem;

      .ex-name { font-weight: 600; font-size: .875rem; }
      .ex-meta { font-size: .72rem; color: var(--color-text-subtle); margin-top: .15rem; }

      .ex-actions { display: flex; gap: .375rem; margin-left: auto; flex-shrink: 0;
        button { background: none; border: none; cursor: pointer; color: var(--color-text-subtle); font-size: .875rem; padding: .2rem .3rem;
          &:hover { color: var(--color-primary); }
          &.del:hover { color: var(--color-danger); }
        }
      }
    }
    .day-pills { display: flex; flex-wrap: wrap; gap: .25rem; margin-top: .375rem;
      .dp { font-size: .65rem; font-weight: 700; padding: .1rem .35rem; border-radius: 99px;
        background: var(--color-border); color: var(--color-text-subtle);
        &.on { background: var(--color-primary-light); color: var(--color-primary); }
      }
    }

    /* ── Exercise form ──────────────────────────────────────────────────────── */
    .ex-form {
      background: var(--color-surface-2); border: 1px solid var(--color-border);
      border-radius: var(--radius-sm); padding: 1rem; margin-top: .5rem;
    }
    .day-selector { display: flex; flex-wrap: wrap; gap: .375rem; margin-top: .25rem;
      .day-btn { padding: .25rem .6rem; border-radius: 99px; border: 1.5px solid var(--color-border);
        background: var(--color-surface); cursor: pointer; font-size: .75rem; font-weight: 600;
        transition: .15s;
        &.selected { background: var(--color-primary); border-color: var(--color-primary); color: #fff; }
      }
    }

    /* ── Blood test accordion ───────────────────────────────────────────────── */
    .bt-accordion { display: flex; flex-direction: column; gap: .5rem; }
    .bt-section {
      border: 1px solid var(--color-border); border-radius: var(--radius-sm);
      overflow: hidden;

      .bt-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: .75rem 1rem; cursor: pointer; background: var(--color-surface-2);
        user-select: none;
        &:hover { background: var(--color-surface); }

        .bt-title { font-size: .875rem; font-weight: 700; display: flex; align-items: center; gap: .5rem; }
        .chevron { transition: transform .2s; font-size: .75rem; color: var(--color-text-muted); }
      }
      &.open .bt-header .chevron { transform: rotate(180deg); }

      .bt-body {
        display: none; padding: 1rem;
        display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: .75rem;
        max-height: 0; overflow: hidden; transition: max-height .25s ease;
      }
      &.open .bt-body { max-height: 600px; }
    }

    /* ── Blood test date row ────────────────────────────────────────────────── */
    .bt-meta-row { display: grid; grid-template-columns: 1fr 1fr; gap: .875rem; margin-bottom: .75rem; }

    /* ── Misc ───────────────────────────────────────────────────────────────── */
    .success-msg { color: var(--color-primary); font-size: .875rem; font-weight: 600; padding: .5rem 0; }

    /* ── Avatar ─────────────────────────────────────────────────────────────── */
    .avatar-section {
      display: flex; align-items: center; gap: 1.25rem; margin-bottom: 1.75rem;
      padding: 1.25rem; background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-md);

      .avatar-wrap {
        position: relative; cursor: pointer; flex-shrink: 0;
        width: 80px; height: 80px;

        .avatar-img {
          width: 80px; height: 80px; border-radius: 50%; object-fit: cover;
          border: 3px solid var(--color-primary-light);
        }
        .avatar-placeholder {
          width: 80px; height: 80px; border-radius: 50%;
          background: var(--color-primary-light); display: flex; align-items: center;
          justify-content: center; font-size: 2rem; border: 3px solid var(--color-primary-light);
        }
        .edit-overlay {
          position: absolute; inset: 0; border-radius: 50%; background: rgba(0,0,0,.45);
          display: flex; align-items: center; justify-content: center; opacity: 0;
          transition: opacity .2s; color: #fff; font-size: .875rem; font-weight: 600;
        }
        &:hover .edit-overlay { opacity: 1; }
      }

      .avatar-info {
        .avatar-hint { font-size: .8rem; color: var(--color-text-muted); margin-top: .25rem; }
      }
    }
  `],
  template: `
    <!-- Hidden file input for avatar upload -->
    <input #fileInput type="file" accept="image/*" style="display:none" (change)="onFileSelected($event)" />

    <div class="profile-page">
      <div class="page-header">
        <h2>👤 Perfil de Saúde</h2>
        <p>Mantenha suas informações atualizadas para cálculos precisos.</p>
      </div>

      <!-- Avatar section -->
      <div class="avatar-section">
        <div class="avatar-wrap" (click)="fileInput.click()">
          @if (avatarUrl()) {
            <img class="avatar-img" [src]="avatarUrl()" alt="Avatar" />
          } @else {
            <div class="avatar-placeholder">👤</div>
          }
          <div class="edit-overlay">✏️ Editar</div>
        </div>
        <div class="avatar-info">
          <strong>Foto de Perfil</strong>
          <div class="avatar-hint">Clique para alterar · JPG/PNG, máx 5 MB</div>
          @if (uploadingAvatar()) {
            <div style="font-size:.8rem;color:var(--color-primary);margin-top:.25rem">⏳ Enviando...</div>
          }
          @if (avatarError()) {
            <div style="font-size:.8rem;color:var(--color-danger);margin-top:.25rem">{{ avatarError() }}</div>
          }
        </div>
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

      @if (saveSuccess()) { <div class="success-msg">✓ Salvo com sucesso!</div> }
      @if (saveError())   { <div class="alert alert-error mb-4">{{ saveError() }}</div> }

      <div class="grid-2">
        <!-- ── Personal data ─────────────────────────────────────────────── -->
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

        <!-- ── Schedule ──────────────────────────────────────────────────── -->
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

        <!-- ── Exercises ─────────────────────────────────────────────────── -->
        <div class="card" style="grid-column: 1 / -1">
          <div class="section-title">
            💪 Exercícios Cadastrados
            <button class="btn btn-sm btn-outline" style="margin-left:auto"
              (click)="openAddExercise()" [disabled]="showExForm() && !exForm.id">
              + Adicionar
            </button>
          </div>

          <!-- Exercise list -->
          @if (exercises().length > 0) {
            <div class="exercise-list">
              @for (ex of exercises(); track ex.id) {
                <div class="exercise-row" style="display:flex;align-items:flex-start;gap:.75rem">
                  <div style="flex:1">
                    <div class="ex-name">{{ ex.name }}</div>
                    <div class="ex-meta">
                      {{ categoryLabel(ex.category) }} · MET {{ ex.met }} · {{ ex.durationMinutes }}min
                      @if (ex.preferredTime) { · 🕐 {{ ex.preferredTime }} }
                    </div>
                    <div class="day-pills">
                      @for (d of days; track d) {
                        <span class="dp" [class.on]="ex.daysOfWeek.includes(d)">{{ dayLabels[d] }}</span>
                      }
                    </div>
                  </div>
                  <div class="ex-actions">
                    <button (click)="startEdit(ex)" title="Editar">✏️</button>
                    <button class="del" (click)="deleteExercise(ex.id)" title="Excluir">🗑️</button>
                  </div>
                </div>
              }
            </div>
          } @else {
            <p class="text-muted" style="margin-bottom:.75rem">Nenhum exercício cadastrado.</p>
          }

          <!-- Add / Edit form -->
          @if (showExForm()) {
            <div class="ex-form">
              <div style="font-weight:700;font-size:.875rem;margin-bottom:.875rem">
                {{ exForm.id ? '✏️ Editar Exercício' : '➕ Novo Exercício' }}
              </div>

              <!-- Preset selector -->
              @if (!exForm.id) {
                <div class="form-group" style="margin-bottom:.875rem">
                  <label>Escolher preset</label>
                  <select [(ngModel)]="exForm.selectedPresetName" (ngModelChange)="onPresetChange($event)">
                    <option value="">— Personalizado —</option>
                    @for (p of presets(); track p.name) {
                      <option [value]="p.name">{{ p.name }}</option>
                    }
                  </select>
                </div>
              }

              <div class="row-2" style="margin-bottom:.875rem">
                <div class="form-group">
                  <label>Nome</label>
                  <input type="text" [(ngModel)]="exForm.name" placeholder="Ex: Corrida" />
                </div>
                <div class="form-group">
                  <label>Categoria</label>
                  <select [(ngModel)]="exForm.category">
                    @for (c of categoryOptions; track c.value) {
                      <option [value]="c.value">{{ c.label }}</option>
                    }
                  </select>
                </div>
              </div>

              <div class="row-2" style="margin-bottom:.875rem">
                <div class="form-group">
                  <label>MET</label>
                  <input type="number" [(ngModel)]="exForm.met" step="0.1" min="1" />
                </div>
                <div class="form-group">
                  <label>Score hipertrofia (0–10)</label>
                  <input type="number" [(ngModel)]="exForm.hypertrophyScore" min="0" max="10" step="0.5" />
                </div>
              </div>

              <div class="row-2" style="margin-bottom:.875rem">
                <div class="form-group">
                  <label>Duração (min)</label>
                  <input type="number" [(ngModel)]="exForm.durationMinutes" min="5" />
                </div>
                <div class="form-group">
                  <label>Horário preferido</label>
                  <input type="time" [(ngModel)]="exForm.preferredTime" />
                </div>
              </div>

              <!-- Day checkboxes -->
              <div class="form-group" style="margin-bottom:.875rem">
                <label>Dias da semana</label>
                <div class="day-selector">
                  @for (d of days; track d) {
                    <button type="button" class="day-btn"
                      [class.selected]="exForm.daysOfWeek.includes(d)"
                      (click)="toggleDay(d)">{{ dayLabels[d] }}</button>
                  }
                </div>
              </div>

              <div style="display:flex;gap:.625rem">
                <button class="btn btn-primary" (click)="submitExercise()" [disabled]="addingEx()">
                  {{ addingEx() ? 'Salvando...' : (exForm.id ? '💾 Atualizar' : '✅ Adicionar') }}
                </button>
                <button class="btn btn-outline" (click)="cancelEdit()">Cancelar</button>
              </div>
            </div>
          }
        </div>

        <!-- ── Blood test ─────────────────────────────────────────────────── -->
        <div class="card" style="grid-column: 1 / -1">
          <div class="section-title">🩸 Cadastrar Exame de Sangue</div>

          <!-- Date + notes -->
          <div class="bt-meta-row">
            <div class="form-group">
              <label>Data da coleta</label>
              <input type="date" [ngModel]="bt['collectedAt']" (ngModelChange)="bt['collectedAt'] = $event" />
            </div>
            <div class="form-group">
              <label>Observações</label>
              <input type="text" [ngModel]="bt['notes']" (ngModelChange)="bt['notes'] = $event" placeholder="Opcional" />
            </div>
          </div>

          <!-- Accordion sections -->
          <div class="bt-accordion">
            @for (sec of btSections; track sec.title; let si = $index) {
              <div class="bt-section" [class.open]="openBtSection() === si">
                <div class="bt-header" (click)="toggleBtSection(si)">
                  <span class="bt-title">{{ sec.icon }} {{ sec.title }}</span>
                  <span class="chevron">▼</span>
                </div>
                <div class="bt-body">
                  @for (f of sec.fields; track f.key) {
                    <div class="form-group">
                      <label>{{ f.label }}</label>
                      <input type="number"
                        [step]="f.step ?? '0.1'"
                        [placeholder]="f.placeholder ?? ''"
                        [ngModel]="bt[f.key]"
                        (ngModelChange)="bt[f.key] = $event" />
                    </div>
                  }
                </div>
              </div>
            }
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
  private userSvc    = inject(UserService);

  readonly apiBase = environment.apiUrl.replace('/api/v1', '');

  metabolic       = this.profileSvc.metabolic;
  saving          = signal(false);
  saveSuccess     = signal(false);
  saveError       = signal('');
  savingBt        = signal(false);
  exercises       = signal<Exercise[]>([]);
  presets         = signal<ExercisePreset[]>([]);
  uploadingAvatar = signal(false);
  avatarError     = signal('');
  avatarUrl       = signal<string | null>(null);

  showExForm    = signal(false);
  addingEx      = signal(false);
  openBtSection = signal<number | null>(0); // first section open by default

  exForm = blankExForm();

  // bt needs an index signature so Angular can use bt[f.key] in the template
  bt: { [key: string]: string | number | null | undefined; collectedAt: string } = {
    collectedAt: new Date().toISOString().slice(0, 10),
  };

  form: Partial<HealthProfile> = {
    age: undefined, gender: 'male', weight: undefined, height: undefined,
    activityFactor: 'sedentary', wakeUpTime: '07:00', sleepTime: '23:00',
    workStartTime: '09:00', workEndTime: '18:00',
  };

  readonly days      = DAYS;
  readonly dayLabels = DAY_LABELS;
  readonly btSections = BT_SECTIONS;
  readonly activityOptions = Object.entries(ACTIVITY_LABELS).map(([value, label]) => ({ value, label }));
  readonly categoryOptions = Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value: value as ExerciseCategory, label }));

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.profileSvc.loadProfile().subscribe({ next: p => Object.assign(this.form, p), error: () => {} });
    this.profileSvc.loadMetabolic().subscribe({ error: () => {} });
    this.profileSvc.getExercises().subscribe({ next: ex => this.exercises.set(ex), error: () => {} });
    this.profileSvc.getPresets().subscribe({ next: p => this.presets.set(p), error: () => {} });
    this.userSvc.loadMe().subscribe({
      next: u => this.avatarUrl.set(u.avatarUrl ? `${this.apiBase}${u.avatarUrl}` : null),
      error: () => {},
    });
  }

  // ── Avatar ──────────────────────────────────────────────────────────────────
  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadingAvatar.set(true);
    this.avatarError.set('');
    this.userSvc.uploadAvatar(file).subscribe({
      next: r => { this.avatarUrl.set(`${this.apiBase}${r.avatarUrl}`); this.uploadingAvatar.set(false); },
      error: () => { this.avatarError.set('Erro ao enviar imagem. Verifique o formato e tamanho.'); this.uploadingAvatar.set(false); },
    });
  }

  // ── Profile ─────────────────────────────────────────────────────────────────
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
      error: (e) => { this.saving.set(false); this.saveError.set(e.error?.message ?? 'Erro ao salvar perfil.'); },
    });
  }

  // ── Exercises ───────────────────────────────────────────────────────────────
  categoryLabel(cat: ExerciseCategory): string {
    return CATEGORY_LABEL[cat] ?? cat;
  }

  openAddExercise(): void {
    this.exForm = blankExForm();
    this.showExForm.set(true);
  }

  startEdit(ex: Exercise): void {
    this.exForm = {
      id: ex.id,
      selectedPresetName: '',
      name: ex.name,
      category: ex.category,
      met: ex.met,
      hypertrophyScore: ex.hypertrophyScore,
      durationMinutes: ex.durationMinutes,
      preferredTime: ex.preferredTime ?? '',
      daysOfWeek: [...ex.daysOfWeek],
    };
    this.showExForm.set(true);
  }

  cancelEdit(): void {
    this.exForm = blankExForm();
    this.showExForm.set(false);
  }

  onPresetChange(name: string): void {
    const p = this.presets().find(x => x.name === name);
    if (!p) return;
    this.exForm.name           = p.name;
    this.exForm.category       = p.category;
    this.exForm.met            = p.met;
    this.exForm.hypertrophyScore = p.hypertrophyScore;
  }

  toggleDay(d: number): void {
    const idx = this.exForm.daysOfWeek.indexOf(d);
    if (idx >= 0) this.exForm.daysOfWeek.splice(idx, 1);
    else           this.exForm.daysOfWeek.push(d);
  }

  submitExercise(): void {
    if (!this.exForm.name.trim()) return;
    this.addingEx.set(true);

    const dto: Partial<Exercise> = {
      name:             this.exForm.name,
      category:         this.exForm.category,
      met:              this.exForm.met,
      hypertrophyScore: this.exForm.hypertrophyScore,
      durationMinutes:  this.exForm.durationMinutes,
      preferredTime:    this.exForm.preferredTime || undefined,
      daysOfWeek:       this.exForm.daysOfWeek,
    };

    const req$ = this.exForm.id
      ? this.profileSvc.updateExercise(this.exForm.id, dto)
      : this.profileSvc.addExercise(dto);

    req$.subscribe({
      next: saved => {
        if (this.exForm.id) {
          this.exercises.update(ex => ex.map(e => e.id === saved.id ? saved : e));
        } else {
          this.exercises.update(ex => [...ex, saved]);
        }
        this.addingEx.set(false);
        this.cancelEdit();
      },
      error: () => this.addingEx.set(false),
    });
  }

  deleteExercise(id: string): void {
    this.profileSvc.deleteExercise(id).subscribe({
      next: () => this.exercises.update(ex => ex.filter(e => e.id !== id)),
    });
  }

  // ── Blood test ──────────────────────────────────────────────────────────────
  toggleBtSection(idx: number): void {
    this.openBtSection.update(cur => cur === idx ? null : idx);
  }

  saveBloodTest(): void {
    this.savingBt.set(true);
    this.profileSvc.saveBloodTest(this.bt as Partial<BloodTest>).subscribe({
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
