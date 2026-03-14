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
  styleUrls: ['./profile.component.scss'],
  templateUrl: './profile.component.html',
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
