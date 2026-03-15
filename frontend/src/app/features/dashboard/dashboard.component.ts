import {
  Component, inject, signal, computed, OnInit, OnDestroy, HostListener, ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject, switchMap, of } from 'rxjs';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DailyMissionsWidgetComponent } from '../../shared/components/daily-missions-widget.component';

import { ProfileService }           from '../../core/services/profile.service';
import { RoutineService }            from '../../core/services/routine.service';
import { FoodService }               from '../../core/services/food.service';
import { UserService }               from '../../core/services/user.service';
import { WaterService }              from '../../core/services/water.service';
import { ClinicalProtocolService }   from '../../core/services/clinical-protocol.service';
import { RecipeService }             from '../../core/services/recipe.service';
import { ScheduledMealService }      from '../../core/services/scheduled-meal.service';
import { RecipeScheduleService }     from '../../core/services/recipe-schedule.service';
import { NotificationService }       from '../../core/services/notification.service';
import { CheckInService }            from '../../core/services/check-in.service';
import { CopilotService }            from '../../core/services/copilot.service';
import { WorkoutService }            from '../../core/services/workout.service';

import {
  RoutineBlock, BlockType, DailySummary, ClinicalProtocolWithLog,
  ScheduledMeal, LinkedRecipe, Recipe, RecipeFeedItem, RecipeSchedule,
  BlockCompleteResult, FeedbackResponse, CreateBlockDto, WorkoutSheet,
} from '../../core/models';
import { WaterTrackerComponent } from '../water/water-tracker.component';

// ── Pure helpers ─────────────────────────────────────────────────────────────
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
function pad2(n: number): string { return String(n).padStart(2, '0'); }
function addMinutes(time: string, mins: number): string {
  const total = timeToMinutes(time) + mins;
  return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}`;
}

// ── Block metadata ───────────────────────────────────────────────────────────
const BLOCK_META: Record<BlockType, { icon: string; color: string; bg: string; label: string }> = {
  sleep:        { icon: '😴', color: '#4f46e5', bg: '#eef2ff', label: 'Sono' },
  work:         { icon: '💼', color: '#6b7280', bg: '#f3f4f6', label: 'Trabalho' },
  exercise:     { icon: '💪', color: '#10b981', bg: '#d1fae5', label: 'Exercício' },
  meal:         { icon: '🍽️', color: '#f59e0b', bg: '#fef3c7', label: 'Refeição' },
  water:        { icon: '💧', color: '#0ea5e9', bg: '#e0f2fe', label: 'Água' },
  sun_exposure: { icon: '☀️', color: '#eab308', bg: '#fef9c3', label: 'Sol' },
  free:         { icon: '⬜', color: '#9ca3af', bg: '#f9fafb', label: 'Livre' },
  custom:       { icon: '📌', color: '#8b5cf6', bg: '#ede9fe', label: 'Custom' },
  medication:   { icon: '💊', color: '#7c3aed', bg: '#f5f3ff', label: 'Protocolo' },
  study:        { icon: '📚', color: '#0891b2', bg: '#e0f7fa', label: 'Estudo' },
};

const PROTOCOL_ICON: Record<string, string> = {
  SUPLEMENTO: '🧴', REMEDIO_CONTROLADO: '💊', TRT: '💉',
  HORMONIO_FEMININO: '🌸', SONO: '😴',
};

/** Short labels for days of week in Portuguese (0=Sun … 6=Sat) */
const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

/** XP awarded for completing each completable block type */
const BLOCK_XP: Partial<Record<BlockType, number>> = {
  exercise:     25,
  water:         5,
  sun_exposure: 10,
  sleep:        10,
  work:          5,
  free:          5,
  custom:        5,
};

/** Block types that support user completion (excludes meal and medication — handled separately) */
const COMPLETABLE_TYPES = new Set<BlockType>([
  'exercise', 'water', 'sun_exposure', 'sleep', 'work', 'free', 'custom', 'study',
]);

interface TimeGroup {
  time: string; minuteOfDay: number; blocks: RoutineBlock[];
  isPast: boolean; isCurrent: boolean;
}

// Linked recipe with computed totals
interface LinkedRecipeView extends LinkedRecipe {
  totalKcal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DecimalPipe, DatePipe, RouterLink, WaterTrackerComponent, FormsModule, DailyMissionsWidgetComponent],
  styleUrls: ['./dashboard.component.scss'],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private profileSvc      = inject(ProfileService);
  private routineSvc      = inject(RoutineService);
  private foodSvc         = inject(FoodService);
  readonly waterSvc       = inject(WaterService);
  private userSvc         = inject(UserService);
  private protocolSvc     = inject(ClinicalProtocolService);
  private recipeSvc       = inject(RecipeService);
  private scheduledSvc    = inject(ScheduledMealService);
  private recipeSchedSvc  = inject(RecipeScheduleService);
  private checkInSvc      = inject(CheckInService);
  private copilotSvc      = inject(CopilotService);
  private notifSvc        = inject(NotificationService);
  private workoutSvc      = inject(WorkoutService);
  private router          = inject(Router);

  @ViewChild(DailyMissionsWidgetComponent) missionsWidget?: DailyMissionsWidgetComponent;

  readonly todayStr       = new Date().toISOString().slice(0, 10);
  readonly waterModalOpen = signal(false);

  // ── Check-in banner ─────────────────────────────────────────────────────────
  private lastCheckInDate = signal<string | null>(null);
  private bannerDismissed = signal(false);
  showCheckInBanner = computed(() => {
    if (this.bannerDismissed()) return false;
    const last = this.lastCheckInDate();
    if (!last) return true; // never did a check-in
    const msDiff = new Date().getTime() - new Date(last + 'T12:00:00').getTime();
    const daysDiff = msDiff / (1000 * 60 * 60 * 24);
    return daysDiff >= 7;
  });

  blocks         = this.routineSvc.blocks;
  selectedDate   = this.routineSvc.selectedDate;
  metabolic      = this.profileSvc.metabolic;

  loading    = signal(true);
  generating = signal(false);
  toggling   = signal<string | null>(null);
  summary    = signal<DailySummary | null>(null);
  userName   = signal<string>('usuário');
  protocols  = signal<ClinicalProtocolWithLog[]>([]);

  /** All scheduled meals for the selected date — single source of truth. */
  scheduledMeals = signal<ScheduledMeal[]>([]);

  // ── Meal panel state ────────────────────────────────────────────────────────
  mealPanel        = signal<ScheduledMeal | null>(null);
  togglingMeal     = signal(false);
  availableRecipes = signal<Recipe[]>([]);
  recipeSearch     = '';

  // ── Diet view ───────────────────────────────────────────────────────────────
  dietView        = signal(false);
  /** Set of meal IDs whose recipe list is expanded in diet view */
  openDietGroups  = signal<Set<string>>(new Set());

  // ── Clone modal ─────────────────────────────────────────────────────────────
  cloneModal   = signal(false);
  cloneFrom    = '';
  cloneTo      = '';
  cloning      = signal(false);

  // ── Apply schedules ─────────────────────────────────────────────────────────
  applyingSchedules = signal(false);

  // ── Water reminders ────────────────────────────────────────────────────────
  waterReminderModal = signal(false);
  waterFrequency     = 60;  // minutes
  waterStartTime     = '07:00';
  waterEndTime       = '22:00';
  generatingWater    = signal(false);

  waterPreviewCount(): number {
    const startMin = timeToMinutes(this.waterStartTime);
    const endMin   = timeToMinutes(this.waterEndTime);
    if (startMin >= endMin || this.waterFrequency < 10) return 0;
    let count = 0;
    for (let m = startMin; m < endMin; m += this.waterFrequency) count++;
    return count;
  }

  // ── Copilot event suggestions ────────────────────────────────────────────────
  private readonly COPILOT_TIPS: Record<BlockType, string> = {
    meal:         'Registrar suas refeicoes ajuda o copiloto a monitorar seu consumo calorico. Dica: crie blocos para cafe, almoco, lanche e jantar!',
    work:         'Blocos de trabalho ajudam a manter o equillbrio entre produtividade e descanso. Tente nao exceder 4 horas sem uma pausa.',
    study:        'Estudo focado rende mais em blocos de 45-60 minutos. Considere adicionar pausas curtas entre eles.',
    exercise:     'Exercicio regular e fundamental! O ideal e distribuir sessoes ao longo da semana. Voce ganha +25 XP por treino concluido.',
    water:        'Hidratacao e essencial! Use o botao "Lembretes de Agua" para gerar lembretes automaticos ao longo do dia.',
    sleep:        'Registre seu horario de sono para que o copiloto analise sua qualidade de descanso. Adultos precisam de 7-9 horas.',
    sun_exposure: 'Exposicao solar moderada ajuda na producao de vitamina D. 15-20 minutos pela manha e o ideal.',
    free:         'Tempo livre e importante para a saude mental. Nao subestime momentos de descanso na sua rotina.',
    custom:       'Crie eventos personalizados para acompanhar qualquer atividade que faca parte da sua rotina.',
    medication:   'Protocolos e medicamentos sao gerenciados na area de protocolos clinicos.',
  };

  copilotEventTip(): string {
    const type = this.newEvent.type;
    const blocks = this.blocks();
    const meals = blocks.filter(b => b.type === 'meal');
    const water = blocks.filter(b => b.type === 'water');
    const exercise = blocks.filter(b => b.type === 'exercise');

    // Context-aware tips
    if (type === 'meal' && meals.length === 0) {
      return 'Voce ainda nao tem nenhuma refeicao agendada hoje! Comece criando as refeicoes principais: cafe da manha, almoco e jantar.';
    }
    if (type === 'water' && water.length >= 5) {
      return 'Voce ja tem ' + water.length + ' lembretes de agua hoje. Se precisar de mais, ajuste a frequencia no gerador automatico.';
    }
    if (type === 'exercise' && exercise.length >= 2) {
      return 'Ja tem ' + exercise.length + ' blocos de exercicio hoje. Cuidado para nao exagerar — descanso tambem faz parte do treino!';
    }
    if (blocks.length === 0) {
      return 'Sua agenda esta vazia! Comece montando sua rotina com os principais eventos do dia. Eu vou te orientar conforme voce adiciona.';
    }

    return this.COPILOT_TIPS[type] ?? 'Adicione este evento para organizar melhor sua rotina diaria.';
  }

  copilotEventSuggestions(): Array<{ icon: string; label: string; type: BlockType; name: string; start: string; end: string }> {
    const blocks = this.blocks();
    const suggestions: Array<{ icon: string; label: string; type: BlockType; name: string; start: string; end: string }> = [];

    const hasMeal = (name: string) => blocks.some(b => b.type === 'meal' && b.label.toLowerCase().includes(name));
    const hasExercise = blocks.some(b => b.type === 'exercise');
    const hasWater = blocks.some(b => b.type === 'water');

    if (!hasMeal('cafe') && !hasMeal('breakfast')) {
      suggestions.push({ icon: '☕', label: 'Adicionar Cafe da manha (07:00)', type: 'meal', name: 'Cafe da Manha', start: '07:00', end: '07:30' });
    }
    if (!hasMeal('almoc') && !hasMeal('lunch')) {
      suggestions.push({ icon: '🍛', label: 'Adicionar Almoco (12:00)', type: 'meal', name: 'Almoco', start: '12:00', end: '13:00' });
    }
    if (!hasMeal('jantar') && !hasMeal('dinner') && !hasMeal('janta')) {
      suggestions.push({ icon: '🌙', label: 'Adicionar Jantar (19:00)', type: 'meal', name: 'Jantar', start: '19:00', end: '20:00' });
    }
    if (!hasExercise) {
      suggestions.push({ icon: '💪', label: 'Adicionar Treino (06:00)', type: 'exercise', name: 'Treino', start: '06:00', end: '07:00' });
    }
    if (!hasWater) {
      suggestions.push({ icon: '💧', label: 'Adicionar Lembrete de Agua', type: 'water', name: 'Lembrete de Agua', start: '08:00', end: '08:10' });
    }

    return suggestions.slice(0, 3);
  }

  copilotLabelPlaceholder(): string {
    const placeholders: Record<BlockType, string> = {
      meal: 'Ex: Cafe da Manha, Almoco, Lanche...',
      work: 'Ex: Reuniao de equipe, Foco profundo...',
      study: 'Ex: Leitura, Curso online...',
      exercise: 'Ex: Treino de forca, Corrida, Yoga...',
      water: 'Ex: Lembrete de Agua',
      sleep: 'Ex: Sono noturno, Cochilo...',
      sun_exposure: 'Ex: Banho de sol matinal',
      free: 'Ex: Tempo livre, Descanso...',
      custom: 'Ex: Meditacao, Hobbie...',
      medication: 'Ex: Suplemento, Remedio...',
    };
    return placeholders[this.newEvent.type] ?? 'Descreva o evento...';
  }

  applyCopilotSuggestion(s: { type: BlockType; name: string; start: string; end: string }): void {
    this.newEvent = { ...this.newEvent, type: s.type, label: s.name, startTime: s.start, endTime: s.end };
  }

  // ── Canvas: Add Event modal ──────────────────────────────────────────────────
  addEventModal = signal(false);
  savingEvent   = signal(false);

  readonly eventTypeOptions: Array<{ type: BlockType; icon: string; label: string }> = [
    { type: 'meal',         icon: '🍽️', label: 'Refeição' },
    { type: 'work',         icon: '💼', label: 'Trabalho' },
    { type: 'study',        icon: '📚', label: 'Estudo' },
    { type: 'exercise',     icon: '💪', label: 'Exercício' },
    { type: 'water',        icon: '💧', label: 'Água' },
    { type: 'sleep',        icon: '😴', label: 'Sono' },
  ];

  newEvent: { type: BlockType; label: string; startTime: string; endTime: string; daysOfWeek: number[]; targetDate: string; workoutSheetId: string } = {
    type: 'work', label: '', startTime: '08:00', endTime: '09:00', daysOfWeek: [], targetDate: '', workoutSheetId: '',
  };

  // ── Workout sheets for exercise blocks ──────────────────────────────────────
  workoutSheets = signal<WorkoutSheet[]>([]);
  private workoutSheetsLoaded = false;

  // ── Workout detail panel for exercise blocks ────────────────────────────────
  expandedWorkoutBlock = signal<string | null>(null);

  // ── Edit block state ──────────────────────────────────────────────────────
  editEventModal = signal(false);
  editEvent: { id: string; type: BlockType; label: string; startTime: string; endTime: string; daysOfWeek: number[]; targetDate: string } = {
    id: '', type: 'work', label: '', startTime: '08:00', endTime: '09:00', daysOfWeek: [], targetDate: '',
  };
  savingEdit  = signal(false);
  deletingBlock = signal<string | null>(null);

  // ── Copilot feedback panel ───────────────────────────────────────────────────
  copilotFeedback = signal<FeedbackResponse | null>(null);
  copilotLoading  = signal(false);

  // ── Recipe schedules (weekly repeat) ────────────────────────────────────────
  recipeSchedules = signal<RecipeSchedule[]>([]);

  /** All days 0-6 for the repeat picker */
  readonly allDays = [0, 1, 2, 3, 4, 5, 6];

  // ── Block completion ────────────────────────────────────────────────────────
  completingBlock = signal<string | null>(null);

  // ── Per-block notification toggle ──────────────────────────────────────────
  /** Set of block IDs that have notifications enabled */
  blockNotifEnabled = signal<Set<string>>(new Set());

  // ── Photo share prompt ───────────────────────────────────────────────────────
  photoPromptBlock  = signal<{ id: string; event: MouseEvent } | null>(null);
  photoDraftDataUrl = signal<string | null>(null);
  photoDraftCaption = '';
  photoSharePublic  = true;
  sharingPhoto      = signal(false);

  // ── Inline recipe picker (diet view) ────────────────────────────────────────
  inlinePickerMealId = signal<string | null>(null);
  inlineSearch       = '';
  inlinePickerResults = signal<Recipe[]>([]);

  // ── XP pop ─────────────────────────────────────────────────────────────────
  xpPopVisible = signal(false);
  lastXp       = signal(0);
  xpPopX = 0; xpPopY = 0;

  // ── Anti-cheat toast ────────────────────────────────────────────────────────
  xpBlockToast  = signal<string | null>(null);

  private clockInterval: ReturnType<typeof setInterval> | null = null;
  private clockMinute = signal(this.currentMinuteOfDay());

  // ── Computed ────────────────────────────────────────────────────────────────
  readonly firstName      = computed(() => this.userName().split(' ')[0] || 'usuário');
  readonly greeting       = computed(() => { const h = new Date().getHours(); if (h < 12) return 'Bom dia'; if (h < 18) return 'Boa tarde'; return 'Boa noite'; });
  readonly todayFormatted = computed(() => new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }));
  readonly nowMinutes     = computed(() => this.clockMinute());
  readonly nowLabel       = computed(() => { const n = new Date(); return `${pad2(n.getHours())}:${pad2(n.getMinutes())}`; });
  readonly showNowLine    = computed(() => this.selectedDate() === this.todayStr);

  readonly timeGroups = computed((): TimeGroup[] => {
    const now = this.nowMinutes(); const isToday = this.selectedDate() === this.todayStr;
    const map = new Map<string, RoutineBlock[]>();
    for (const b of this.blocks()) { if (!map.has(b.startTime)) map.set(b.startTime, []); map.get(b.startTime)!.push(b); }

    // Inject orphaned scheduledMeals (not linked to any block) as synthetic blocks
    const linkedMealIds = new Set<string>();
    for (const b of this.blocks()) {
      const smId = b.metadata?.['scheduledMealId'] as string | undefined;
      if (smId) linkedMealIds.add(smId);
    }
    for (const meal of this.scheduledMeals()) {
      if (linkedMealIds.has(meal.id)) continue;
      const synth: RoutineBlock = {
        id: `synth-meal-${meal.id}`,
        userId: meal.userId,
        type: 'meal',
        startTime: meal.scheduledTime,
        endTime: addMinutes(meal.scheduledTime, 30),
        label: meal.name,
        caloricTarget: meal.caloricTarget,
        sortOrder: 0,
        metadata: { scheduledMealId: meal.id },
      };
      if (!map.has(synth.startTime)) map.set(synth.startTime, []);
      map.get(synth.startTime)!.push(synth);
    }

    return Array.from(map.entries())
      .sort((a, b) => timeToMinutes(a[0]) - timeToMinutes(b[0]))
      .map(([time, blks]) => {
        const min = timeToMinutes(time);
        return { time, minuteOfDay: min, blocks: blks, isPast: isToday && (min + 30) < now, isCurrent: isToday && min <= now && now < min + 60 };
      });
  });

  readonly allBlocksPast  = computed(() => this.timeGroups().length > 0 && this.timeGroups().every(g => g.isPast));
  readonly consumedKcal   = computed(() => this.summary()?.totalCalories ?? 0);
  readonly caloriesPct    = computed(() => { const m = this.metabolic(); return m ? Math.min(110, (this.consumedKcal() / m.dailyCaloricTarget) * 100) : 0; });
  readonly waterPct       = computed(() => { const m = this.metabolic(); return m ? Math.min(100, (this.waterSvc.todayTotal() / m.waterMlTotal) * 100) : 0; });
  readonly waterBlocks    = computed(() => this.blocks().filter(b => b.type === 'water').length);
  readonly totalProtocols = computed(() => this.protocols().length);
  readonly doneProtocols  = computed(() => this.protocols().filter(p => !!p.log).length);

  // ── Remaining macros ────────────────────────────────────────────────────────
  readonly remainingKcal    = computed(() => { const m = this.metabolic(); return m ? Math.round(m.dailyCaloricTarget - this.consumedKcal()) : 0; });
  readonly remainingProtein = computed(() => { const m = this.metabolic(); return m ? Math.round(m.macros.proteinG - (this.summary()?.totalProtein ?? 0)) : 0; });
  readonly remainingCarbs   = computed(() => { const m = this.metabolic(); return m ? Math.round(m.macros.carbsG   - (this.summary()?.totalCarbs   ?? 0)) : 0; });
  readonly remainingFat     = computed(() => { const m = this.metabolic(); return m ? Math.round(m.macros.fatG     - (this.summary()?.totalFat     ?? 0)) : 0; });

  // ── Panel computed ──────────────────────────────────────────────────────────
  readonly panelRecipes = computed((): LinkedRecipeView[] => {
    const m = this.mealPanel();
    if (!m) return [];
    return (m.linkedRecipes ?? []).map(r => ({
      ...r,
      totalKcal:    r.kcalPerServing     * r.servings,
      totalProtein: r.proteinGPerServing * r.servings,
      totalCarbs:   r.carbsGPerServing   * r.servings,
      totalFat:     r.fatGPerServing     * r.servings,
    }));
  });
  readonly panelConsumedKcal    = computed(() => this.panelRecipes().reduce((s, r) => s + r.totalKcal,    0));
  readonly panelConsumedProtein = computed(() => this.panelRecipes().reduce((s, r) => s + r.totalProtein, 0));
  readonly panelConsumedCarbs   = computed(() => this.panelRecipes().reduce((s, r) => s + r.totalCarbs,   0));
  readonly panelConsumedFat     = computed(() => this.panelRecipes().reduce((s, r) => s + r.totalFat,     0));
  readonly panelBalance         = computed(() => this.panelConsumedKcal() - (this.mealPanel()?.caloricTarget ?? 0));
  readonly panelBalancePct      = computed(() => {
    const target = this.mealPanel()?.caloricTarget ?? 0;
    if (!target) return 0;
    return Math.min(100, (this.panelConsumedKcal() / target) * 100);
  });

  readonly panelSearchResults = computed((): Recipe[] => {
    const q = this.recipeSearch.toLowerCase().trim();
    if (q.length < 2) return [];
    return this.availableRecipes().filter(r => r.title.toLowerCase().includes(q));
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.userSvc.loadMe().subscribe({ next: (u: any) => { if (u.name) this.userName.set(u.name); }, error: () => {} });
    this.profileSvc.loadProfile().subscribe({ error: () => {} });
    this.profileSvc.loadMetabolic().subscribe({ error: () => {} });
    this.routineSvc.load().subscribe({ next: () => this.loading.set(false), error: () => this.loading.set(false) });
    this.foodSvc.getSummary(this.selectedDate()).subscribe({ next: s => this.summary.set(s), error: () => {} });
    this.waterSvc.loadToday().subscribe({ error: () => {} });
    this.loadProtocols();
    this.loadScheduledMeals(this.selectedDate());
    this.loadRecipeSchedules();
    this.cloneFrom = this.selectedDate();
    this.clockInterval = setInterval(() => this.clockMinute.set(this.currentMinuteOfDay()), 30_000);
    this.checkInSvc.latest().subscribe({ next: ci => this.lastCheckInDate.set(ci?.date ?? null), error: () => {} });
    this.loadCopilotFeedback();
  }

  ngOnDestroy(): void { if (this.clockInterval) clearInterval(this.clockInterval); }

  @HostListener('document:keydown.escape')
  onEsc() { this.closeMealPanel(); }

  // ── Data loading ─────────────────────────────────────────────────────────────
  private loadScheduledMeals(date: string): void {
    this.scheduledSvc.list(date).subscribe({
      next: meals => this.scheduledMeals.set(meals),
      error: () => {},
    });
  }

  private loadRecipeSchedules(): void {
    this.recipeSchedSvc.list().subscribe({
      next: s => this.recipeSchedules.set(s),
      error: () => {},
    });
  }

  private loadProtocols(): void {
    this.protocolSvc.logsForDate(this.selectedDate()).subscribe({
      next: p => this.protocols.set(p.filter(x => x.isActive)),
      error: () => {},
    });
  }

  private reloadSummary(): void {
    this.foodSvc.getSummary(this.selectedDate()).subscribe({ next: s => this.summary.set(s), error: () => {} });
  }

  // ── Apply schedules ──────────────────────────────────────────────────────────
  applySchedules(): void {
    this.applyingSchedules.set(true);
    this.scheduledSvc.applySchedules(this.selectedDate()).subscribe({
      next: meals => {
        this.scheduledMeals.set(meals);
        this.applyingSchedules.set(false);
        this.reloadSummary();
      },
      error: () => this.applyingSchedules.set(false),
    });
  }

  // ── Water reminders ──────────────────────────────────────────────────────────
  openWaterReminderModal(): void {
    this.waterFrequency = 60;
    this.waterStartTime = '07:00';
    this.waterEndTime   = '22:00';
    this.waterReminderModal.set(true);
  }

  closeWaterReminderModal(): void { this.waterReminderModal.set(false); }

  generateWaterReminders(): void {
    if (this.waterFrequency < 10 || !this.waterStartTime || !this.waterEndTime) return;
    this.generatingWater.set(true);

    const startMin = timeToMinutes(this.waterStartTime);
    const endMin   = timeToMinutes(this.waterEndTime);
    if (startMin >= endMin) { this.generatingWater.set(false); return; }

    const slots: Array<{ start: string; end: string }> = [];
    for (let m = startMin; m < endMin; m += this.waterFrequency) {
      const blockEnd = Math.min(m + 10, endMin); // 10-min block duration
      slots.push({
        start: `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`,
        end:   `${pad2(Math.floor(blockEnd / 60))}:${pad2(blockEnd % 60)}`,
      });
    }

    let remaining = slots.length;
    const done = () => {
      remaining--;
      if (remaining <= 0) {
        this.generatingWater.set(false);
        this.closeWaterReminderModal();
        this.routineSvc.load(this.selectedDate()).subscribe({ error: () => {} });
      }
    };

    for (const slot of slots) {
      const dto: CreateBlockDto = {
        type:       'water',
        label:      `Lembrete de Agua`,
        startTime:  slot.start,
        endTime:    slot.end,
        routineDate: this.selectedDate(),
      };
      this.routineSvc.createBlock(dto).subscribe({ next: done, error: done });
    }
  }

  // ── Clone diet ───────────────────────────────────────────────────────────────
  openCloneModal(): void {
    this.cloneFrom = this.selectedDate();
    this.cloneTo   = '';
    this.cloneModal.set(true);
  }

  closeCloneModal(): void { this.cloneModal.set(false); }

  cloneDiet(): void {
    if (!this.cloneFrom || !this.cloneTo) return;
    this.cloning.set(true);
    this.scheduledSvc.clone(this.cloneFrom, this.cloneTo).subscribe({
      next: () => {
        this.cloning.set(false);
        this.closeCloneModal();
        // If cloned to selected date, reload meals
        if (this.cloneTo === this.selectedDate()) {
          this.loadScheduledMeals(this.selectedDate());
          this.reloadSummary();
        }
      },
      error: () => this.cloning.set(false),
    });
  }

  // ── Diet view helpers ─────────────────────────────────────────────────────────
  toggleDietGroup(mealId: string): void {
    this.openDietGroups.update(s => {
      const next = new Set(s);
      if (next.has(mealId)) next.delete(mealId); else next.add(mealId);
      return next;
    });
  }

  isDietGroupOpen(mealId: string): boolean {
    return this.openDietGroups().has(mealId);
  }

  mealKcalFromLinked(meal: ScheduledMeal): number {
    return (meal.linkedRecipes ?? []).reduce((s, r) => s + r.kcalPerServing * r.servings, 0);
  }

  mealBalancePctById(meal: ScheduledMeal): number {
    const target = Number(meal.caloricTarget) || 0;
    if (!target) return 0;
    return Math.min(100, (this.mealKcalFromLinked(meal) / target) * 100);
  }

  /** Change servings directly from the diet view (bypasses mealPanel state) */
  changeServingsInline(meal: ScheduledMeal, recipe: LinkedRecipe, delta: number): void {
    const newServings = Math.max(0.5, recipe.servings + delta);
    // Optimistic update
    this.scheduledMeals.update(list => list.map(m =>
      m.id !== meal.id ? m : {
        ...m,
        linkedRecipes: (m.linkedRecipes ?? []).map(r =>
          r.recipeId === recipe.recipeId ? { ...r, servings: newServings } : r
        ),
      }
    ));
    this.scheduledSvc.unlinkRecipe(meal.id, recipe.recipeId).subscribe({
      next: () => {
        this.scheduledSvc.linkRecipe(meal.id, { recipeId: recipe.recipeId, servings: newServings }).subscribe({
          next: updated => {
            this.scheduledMeals.update(list => list.map(m => m.id === updated.id ? updated : m));
            this.reloadSummary();
          },
          error: () => {},
        });
      },
      error: () => {},
    });
  }

  /** Remove a recipe directly from the diet view */
  removeRecipeFromMeal(meal: ScheduledMeal, recipeId: string): void {
    this.scheduledSvc.unlinkRecipe(meal.id, recipeId).subscribe({
      next: updated => {
        this.scheduledMeals.update(list => list.map(m => m.id === updated.id ? updated : m));
        this.reloadSummary();
        // If this meal is open in the panel too, refresh it
        if (this.mealPanel()?.id === updated.id) this.mealPanel.set({ ...updated });
      },
      error: () => {},
    });
  }

  /** Toggle consumed directly from diet view */
  toggleConsumedById(meal: ScheduledMeal): void {
    this.togglingMeal.set(true);
    this.scheduledSvc.toggle(meal.id).subscribe({
      next: result => {
        this.togglingMeal.set(false);
        this.scheduledMeals.update(list => list.map(m => m.id === result.meal.id ? result.meal : m));
        this.reloadSummary();
        if (result.xpGained > 0) this.showXpPop(result.xpGained);
        if (this.mealPanel()?.id === result.meal.id) this.mealPanel.set({ ...result.meal });
        // Refresh missions — meal consumed may auto-complete ALL_MEALS
        this.missionsWidget?.refresh();
      },
      error: () => this.togglingMeal.set(false),
    });
  }

  /** Open meal panel from diet view (needs to pass a pseudo-block or find it) */
  openMealPanelById(meal: ScheduledMeal): void {
    this.mealPanel.set({ ...meal });
    this.recipeSearch = '';
    this.recipeSvc.listMine().subscribe({
      next: mine => {
        const existing = this.availableRecipes();
        const ids = new Set(existing.map(r => r.id));
        this.availableRecipes.set([...mine, ...existing.filter(r => !ids.has(r.id))]);
      },
      error: () => {},
    });
    this.recipeSvc.feed(1, 30).subscribe({
      next: feed => {
        const existing = this.availableRecipes();
        const ids = new Set(existing.map(r => r.id));
        this.availableRecipes.set([...existing, ...feed.filter(r => !ids.has(r.id))]);
      },
      error: () => {},
    });
  }

  // ── Repeat schedule helpers ──────────────────────────────────────────────────
  /** Returns true if the recipe+mealName schedule has the given day selected */
  isDaySelected(recipeId: string, day: number): boolean {
    const meal = this.mealPanel();
    if (!meal) return false;
    return this.recipeSchedules().some(
      s => s.recipeId === recipeId && s.mealName === meal.name && s.daysOfWeek.includes(day)
    );
  }

  /** Toggle a single day for a linked recipe's repeat schedule */
  toggleRepeatDay(recipe: LinkedRecipeView, day: number): void {
    const meal = this.mealPanel();
    if (!meal) return;

    const existing = this.recipeSchedules().find(
      s => s.recipeId === recipe.recipeId && s.mealName === meal.name
    );
    const currentDays = existing?.daysOfWeek ?? [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day].sort();

    this.recipeSchedSvc.upsert({
      mealName:   meal.name,
      recipeId:   recipe.recipeId,
      servings:   recipe.servings,
      daysOfWeek: newDays,
    }).subscribe({
      next: updated => {
        this.recipeSchedules.update(list => {
          const i = list.findIndex(s => s.id === updated.id);
          if (i >= 0) { const next = [...list]; next[i] = updated; return next; }
          return [...list, updated];
        });
      },
      error: () => {},
    });
  }

  dayLabel(day: number): string { return DAY_LABELS[day] ?? '?'; }

  // ── Routine ──────────────────────────────────────────────────────────────────
  /** @deprecated Canvas pivot — kept for reference; server returns 410. */
  generateRoutine(): void {
    this.generating.set(true);
    this.routineSvc.generate(this.selectedDate()).subscribe({
      next: () => {
        this.generating.set(false);
        this.loadProtocols();
        this.loadScheduledMeals(this.selectedDate());
      },
      error: () => this.generating.set(false),
    });
  }

  // ── Canvas: Add Event modal ──────────────────────────────────────────────────
  openAddEventModal(): void {
    this.newEvent = { type: 'work', label: '', startTime: '08:00', endTime: '09:00', daysOfWeek: [], targetDate: this.selectedDate(), workoutSheetId: '' };
    this.addEventModal.set(true);
    if (!this.workoutSheetsLoaded) {
      this.workoutSvc.list().subscribe({
        next: sheets => { this.workoutSheets.set(sheets); this.workoutSheetsLoaded = true; },
      });
    }
  }

  onWorkoutSheetSelected(): void {
    const sheet = this.workoutSheets().find(s => s.id === this.newEvent.workoutSheetId);
    if (sheet) {
      this.newEvent.label = sheet.name;
      const dur = sheet.estimatedMinutes ?? 60;
      const [h, m] = this.newEvent.startTime.split(':').map(Number);
      const endTotal = (h ?? 0) * 60 + (m ?? 0) + dur;
      this.newEvent.endTime = `${pad2(Math.floor(endTotal / 60) % 24)}:${pad2(endTotal % 60)}`;
    }
  }

  closeAddEventModal(): void { this.addEventModal.set(false); }

  toggleNewEventDay(day: number): void {
    const days = this.newEvent.daysOfWeek;
    this.newEvent = {
      ...this.newEvent,
      daysOfWeek: days.includes(day) ? days.filter(d => d !== day) : [...days, day].sort(),
    };
  }

  saveNewEvent(): void {
    if (!this.newEvent.label.trim() || !this.newEvent.startTime || !this.newEvent.endTime) return;
    const isRecurring = this.newEvent.daysOfWeek.length > 0;

    // Build metadata for exercise blocks linked to a workout sheet
    let metadata: Record<string, unknown> | undefined;
    if (this.newEvent.type === 'exercise' && this.newEvent.workoutSheetId) {
      const sheet = this.workoutSheets().find(s => s.id === this.newEvent.workoutSheetId);
      if (sheet) {
        metadata = {
          workoutSheetId: sheet.id,
          workoutSheetName: sheet.name,
          exercises: (sheet.exercises ?? []).map(e => ({
            name: e.name, sets: e.sets, reps: e.reps,
            restSeconds: e.restSeconds, notes: e.notes,
          })),
        };
      }
    }

    const dto: CreateBlockDto = {
      type:        this.newEvent.type,
      label:       this.newEvent.label.trim(),
      startTime:   this.newEvent.startTime,
      endTime:     this.newEvent.endTime,
      isRecurring,
      daysOfWeek:  isRecurring ? this.newEvent.daysOfWeek : [],
      routineDate: isRecurring ? undefined : (this.newEvent.targetDate || this.selectedDate()),
      metadata,
    };
    this.savingEvent.set(true);
    this.routineSvc.createBlock(dto).subscribe({
      next: () => {
        this.savingEvent.set(false);
        this.addEventModal.set(false);
        // Refresh the full list so recurring blocks appear correctly
        this.routineSvc.load(this.selectedDate()).subscribe({ error: () => {} });
        // If this was a meal block, the backend auto-created a ScheduledMeal — reload diet view
        if (dto.type === 'meal') {
          this.loadScheduledMeals(this.selectedDate());
          this.reloadSummary();
        }
        this.loadCopilotFeedback();
      },
      error: () => this.savingEvent.set(false),
    });
  }

  navigateToDiet(): void {
    this.router.navigate(['/diet']);
  }

  isSunSafeHour(): boolean {
    const h = new Date().getHours();
    return h < 10 || h >= 16;
  }

  toggleWorkoutDetail(blockId: string): void {
    this.expandedWorkoutBlock.set(this.expandedWorkoutBlock() === blockId ? null : blockId);
  }

  blockExercises(block: RoutineBlock): Array<{ name: string; sets: number; reps: string; restSeconds: number; notes?: string }> {
    const meta = block.metadata as any;
    return meta?.exercises ?? [];
  }

  hasLinkedWorkout(block: RoutineBlock): boolean {
    return !!(block.metadata as any)?.workoutSheetId;
  }

  dayShort(day: number): string {
    return ['D','S','T','Q','Q','S','S'][day] ?? '?';
  }

  // ── Edit / Delete block ─────────────────────────────────────────────────────
  openEditModal(b: RoutineBlock, ev: Event): void {
    ev.stopPropagation();
    this.editEvent = {
      id: b.id,
      type: b.type,
      label: b.label,
      startTime: b.startTime,
      endTime: b.endTime,
      daysOfWeek: b.daysOfWeek ?? [],
      targetDate: b.routineDate ?? this.selectedDate(),
    };
    this.editEventModal.set(true);
  }

  closeEditModal(): void { this.editEventModal.set(false); }

  toggleEditEventDay(day: number): void {
    const days = this.editEvent.daysOfWeek;
    this.editEvent = {
      ...this.editEvent,
      daysOfWeek: days.includes(day) ? days.filter(d => d !== day) : [...days, day].sort(),
    };
  }

  saveEditEvent(): void {
    if (!this.editEvent.label.trim() || !this.editEvent.startTime || !this.editEvent.endTime) return;
    const isRecurring = this.editEvent.daysOfWeek.length > 0;
    const dto: Partial<CreateBlockDto> = {
      type:        this.editEvent.type,
      label:       this.editEvent.label.trim(),
      startTime:   this.editEvent.startTime,
      endTime:     this.editEvent.endTime,
      isRecurring,
      daysOfWeek:  isRecurring ? this.editEvent.daysOfWeek : [],
      routineDate: isRecurring ? undefined : (this.editEvent.targetDate || this.selectedDate()),
    };
    this.savingEdit.set(true);
    this.routineSvc.updateBlock(this.editEvent.id, dto).subscribe({
      next: () => {
        this.savingEdit.set(false);
        this.editEventModal.set(false);
        this.routineSvc.load(this.selectedDate()).subscribe({ error: () => {} });
        if (dto.type === 'meal') {
          this.loadScheduledMeals(this.selectedDate());
          this.reloadSummary();
        }
        this.loadCopilotFeedback();
      },
      error: () => this.savingEdit.set(false),
    });
  }

  deleteBlock(b: RoutineBlock, ev: Event): void {
    ev.stopPropagation();
    if (!confirm(`Excluir "${b.label}"?`)) return;
    this.deletingBlock.set(b.id);
    this.routineSvc.deleteBlock(b.id).subscribe({
      next: () => {
        this.deletingBlock.set(null);
        this.routineSvc.load(this.selectedDate()).subscribe({ error: () => {} });
        if (b.type === 'meal') {
          this.loadScheduledMeals(this.selectedDate());
          this.reloadSummary();
        }
        this.loadCopilotFeedback();
      },
      error: () => this.deletingBlock.set(null),
    });
  }

  // ── Copilot feedback ─────────────────────────────────────────────────────────
  loadCopilotFeedback(): void {
    this.copilotLoading.set(true);
    this.copilotSvc.getFeedback(this.selectedDate()).subscribe({
      next: fb => { this.copilotFeedback.set(fb); this.copilotLoading.set(false); },
      error: ()  => { this.copilotLoading.set(false); },
    });
  }

  changeDate(delta: number): void {
    const d = new Date(this.selectedDate()); d.setDate(d.getDate() + delta);
    const next = d.toISOString().slice(0, 10);
    this.routineSvc.setDate(next); this.loading.set(true);
    this.routineSvc.load(next).subscribe({ next: () => this.loading.set(false), error: () => this.loading.set(false) });
    this.foodSvc.getSummary(next).subscribe({ next: s => this.summary.set(s), error: () => {} });
    this.protocolSvc.logsForDate(next).subscribe({ next: p => this.protocols.set(p.filter(x => x.isActive)), error: () => {} });
    this.loadScheduledMeals(next);
    this.closeMealPanel();
    this.openDietGroups.set(new Set());
    this.cloneFrom = next;
    this.copilotFeedback.set(null);
    this.loadCopilotFeedback();
  }

  goToday(): void { this.routineSvc.setDate(this.todayStr); this.changeDate(0); }

  // ── Protocol toggle ──────────────────────────────────────────────────────────
  toggleProtocol(block: RoutineBlock, event: MouseEvent): void {
    const protocolId = block.metadata?.['protocolId'] as string | undefined;
    if (!protocolId) return;
    this.toggling.set(block.id);
    this.protocolSvc.toggle(protocolId, this.selectedDate()).subscribe({
      next: result => {
        this.protocolSvc.logsForDate(this.selectedDate()).subscribe({ next: p => this.protocols.set(p.filter(x => x.isActive)) });
        this.toggling.set(null);
        if (result.xpGained > 0) this.showXpPop(result.xpGained, event);
      },
      error: () => this.toggling.set(null),
    });
  }

  // ── Meal block helpers ───────────────────────────────────────────────────────
  private getScheduledMeal(block: RoutineBlock): ScheduledMeal | undefined {
    const id = block.metadata?.['scheduledMealId'] as string | undefined;
    return id ? this.scheduledMeals().find(m => m.id === id) : undefined;
  }

  mealConsumed(block: RoutineBlock): boolean {
    return this.getScheduledMeal(block)?.isConsumed ?? false;
  }

  mealLinkedRecipes(block: RoutineBlock): LinkedRecipe[] {
    return this.getScheduledMeal(block)?.linkedRecipes ?? [];
  }

  mealConsumedKcal(block: RoutineBlock): number {
    const linked = this.mealLinkedRecipes(block);
    return linked.reduce((s, r) => s + r.kcalPerServing * r.servings, 0);
  }

  mealBalancePct(block: RoutineBlock): number {
    const target = Number(block.caloricTarget) || 0;
    if (!target) return 0;
    return Math.min(100, (this.mealConsumedKcal(block) / target) * 100);
  }

  mealOverflowPct(block: RoutineBlock): number {
    const target = Number(block.caloricTarget) || 0;
    const over   = this.mealConsumedKcal(block) - target;
    if (over <= 0 || !target) return 0;
    return Math.min(40, (over / target) * 100);
  }

  // ── Meal panel ───────────────────────────────────────────────────────────────
  openMealPanel(block: RoutineBlock): void {
    const meal = this.getScheduledMeal(block);
    if (!meal) return;
    this.mealPanel.set({ ...meal });
    this.recipeSearch = '';
    // Load user's own recipes + community feed for the picker (combine & dedupe)
    this.recipeSvc.listMine().subscribe({
      next: mine => {
        const existing = this.availableRecipes();
        const ids = new Set(existing.map(r => r.id));
        this.availableRecipes.set([...mine, ...existing.filter(r => !ids.has(r.id))]);
      },
      error: () => {},
    });
    this.recipeSvc.feed(1, 30).subscribe({
      next: feed => {
        const existing = this.availableRecipes();
        const ids = new Set(existing.map(r => r.id));
        this.availableRecipes.set([...existing, ...feed.filter(r => !ids.has(r.id))]);
      },
      error: () => {},
    });
  }

  closeMealPanel(): void { this.mealPanel.set(null); }

  addRecipe(recipe: Recipe): void {
    const meal = this.mealPanel();
    if (!meal) return;
    this.scheduledSvc.linkRecipe(meal.id, { recipeId: recipe.id, servings: 1 }).subscribe({
      next: updated => this.refreshMealInPanel(updated),
      error: () => {},
    });
  }

  removeRecipe(recipeId: string): void {
    const meal = this.mealPanel();
    if (!meal) return;
    this.scheduledSvc.unlinkRecipe(meal.id, recipeId).subscribe({
      next: updated => this.refreshMealInPanel(updated),
      error: () => {},
    });
  }

  changeServings(recipe: LinkedRecipeView, delta: number): void {
    const meal = this.mealPanel();
    if (!meal) return;
    const newServings = Math.max(0.5, recipe.servings + delta);
    // Remove then re-add with correct servings (simplest: remove + re-link is complex;
    // instead patch linkedRecipes locally and re-save via unlink + link)
    // For best UX: patch the local signal immediately, then sync to API.
    const updated: ScheduledMeal = {
      ...meal,
      linkedRecipes: (meal.linkedRecipes ?? []).map(r =>
        r.recipeId === recipe.recipeId ? { ...r, servings: newServings } : r
      ),
    };
    this.mealPanel.set(updated);
    // Sync to backend: unlink + re-link with new servings
    this.scheduledSvc.unlinkRecipe(meal.id, recipe.recipeId).subscribe({
      next: () => {
        this.scheduledSvc.linkRecipe(meal.id, { recipeId: recipe.recipeId, servings: newServings }).subscribe({
          next: final => this.refreshMealInPanel(final),
          error: () => {},
        });
      },
      error: () => {},
    });
  }

  toggleConsumed(): void {
    const meal = this.mealPanel();
    if (!meal) return;
    this.togglingMeal.set(true);
    this.scheduledSvc.toggle(meal.id).subscribe({
      next: result => {
        this.togglingMeal.set(false);
        this.refreshMealInPanel(result.meal);
        this.reloadSummary();
        if (result.xpGained > 0) this.showXpPop(result.xpGained);
        // Refresh missions — meal consumed may auto-complete ALL_MEALS
        this.missionsWidget?.refresh();
      },
      error: () => this.togglingMeal.set(false),
    });
  }

  /** Update the open panel and the scheduledMeals list from a fresh server record. */
  private refreshMealInPanel(updated: ScheduledMeal): void {
    this.mealPanel.set({ ...updated });
    this.scheduledMeals.update(list =>
      list.map(m => m.id === updated.id ? updated : m)
    );
    this.reloadSummary();
  }

  // ── Block completion ──────────────────────────────────────────────────────────
  isCompletable(b: RoutineBlock): boolean {
    return COMPLETABLE_TYPES.has(b.type);
  }

  isBlockCompleted(b: RoutineBlock): boolean {
    return !!b.completedAt;
  }

  blockXp(b: RoutineBlock): number {
    return BLOCK_XP[b.type] ?? 5;
  }

  blockBorderColor(b: RoutineBlock): string {
    if (this.isBlockCompleted(b)) return '#22c55e';
    if (this.mealConsumed(b))     return '#22c55e';
    return BLOCK_META[b.type]?.color ?? '#9ca3af';
  }

  toggleBlockNotif(b: RoutineBlock): void {
    const blockId = b.id;
    this.blockNotifEnabled.update(set => {
      const next = new Set(set);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
        // Create a notification for this block
        if (!blockId.startsWith('synth-')) {
          this.notifSvc.generate(this.selectedDate()).subscribe({ error: () => {} });
        }
        // Show local browser notification as confirmation
        this.notifSvc.showLocalNotification(
          'Lembrete ativado',
          `Voce sera lembrado: ${b.label} as ${b.startTime}`
        );
      }
      return next;
    });
  }

  toggleBlockComplete(b: RoutineBlock, event: MouseEvent): void {
    // If undoing, call immediately without photo prompt
    if (b.completedAt) {
      this._doCompleteBlock(b.id, event);
      return;
    }

    // Exercise blocks: redirect to workouts page
    if (b.type === 'exercise') {
      this.router.navigate(['/workouts']);
      return;
    }

    // Water blocks: open water modal
    if (b.type === 'water') {
      this.waterModalOpen.set(true);
      return;
    }

    // Sun exposure blocks: only allow before 10h or after 16h
    if (b.type === 'sun_exposure') {
      const now = new Date();
      const currentHour = now.getHours();
      if (currentHour >= 10 && currentHour < 16) {
        alert('Exposicao solar so pode ser registrada antes das 10h ou apos as 16h para proteger sua saude. Evite o sol entre 10h e 16h!');
        return;
      }
    }

    // New completion: show photo share prompt
    this.photoPromptBlock.set({ id: b.id, event });
    this.photoDraftDataUrl.set(null);
    this.photoDraftCaption = '';
    this.photoSharePublic  = true;
  }

  skipPhoto(): void {
    const p = this.photoPromptBlock();
    if (!p) return;
    this.photoPromptBlock.set(null);
    this._doCompleteBlock(p.id, p.event);
  }

  onPhotoFileChange(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.compressImage(file).then(dataUrl => this.photoDraftDataUrl.set(dataUrl));
  }

  /** Resize + JPEG-compress to keep upload well under the 10 MB server limit. */
  private compressImage(file: File, maxDim = 1280, quality = 0.82): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
          else { width = Math.round(width * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(img.src);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = URL.createObjectURL(file);
    });
  }

  submitWithPhoto(): void {
    const p = this.photoPromptBlock();
    if (!p || !this.photoDraftDataUrl()) return;
    this.sharingPhoto.set(true);
    this._doCompleteBlock(p.id, p.event, {
      photoDataUrl: this.photoDraftDataUrl()!,
      caption:      this.photoDraftCaption || undefined,
      sharePublic:  this.photoSharePublic,
    });
  }

  private _doCompleteBlock(
    blockId: string,
    event: MouseEvent,
    photo?: { photoDataUrl: string; caption?: string; sharePublic?: boolean }
  ): void {
    this.photoPromptBlock.set(null);
    this.completingBlock.set(blockId);
    this.routineSvc.completeBlock(blockId, photo).subscribe({
      next: result => {
        this.completingBlock.set(null);
        this.sharingPhoto.set(false);
        if (result.xpGained > 0) {
          this.showXpPop(result.xpGained, event);
        } else if (result.message && (result.capReached || result.outOfWindow)) {
          this.showXpBlockToast(result.message);
        }
        // Refresh missions — block completion may auto-complete ACTIVITY or SLEEP_BLOCK
        this.missionsWidget?.refresh();
      },
      error: (err) => {
        this.completingBlock.set(null);
        this.sharingPhoto.set(false);
        const msg = err?.error?.message as string | undefined;
        if (msg) this.showXpBlockToast(msg);
      },
    });
  }

  private showXpBlockToast(msg: string): void {
    this.xpBlockToast.set(msg);
    setTimeout(() => this.xpBlockToast.set(null), 4000);
  }

  // ── Inline recipe picker ──────────────────────────────────────────────────────
  openInlinePicker(meal: ScheduledMeal): void {
    if (this.inlinePickerMealId() === meal.id) {
      this.closeInlinePicker();
      return;
    }
    this.inlinePickerMealId.set(meal.id);
    this.inlineSearch = '';
    this.inlinePickerResults.set([]);
    // Ensure recipes are loaded
    if (this.availableRecipes().length === 0) {
      this.recipeSvc.listMine().subscribe({
        next: mine => {
          this.recipeSvc.feed(1, 30).subscribe({
            next: feed => {
              const all = [...mine];
              const ids = new Set(mine.map(r => r.id));
              feed.forEach(r => { if (!ids.has(r.id)) all.push(r); });
              this.availableRecipes.set(all);
            },
            error: () => {},
          });
        },
        error: () => {},
      });
    }
  }

  closeInlinePicker(): void {
    this.inlinePickerMealId.set(null);
    this.inlineSearch = '';
    this.inlinePickerResults.set([]);
  }

  onInlineSearch(): void {
    const q = this.inlineSearch.toLowerCase().trim();
    if (q.length < 2) {
      this.inlinePickerResults.set([]);
      return;
    }
    this.inlinePickerResults.set(
      this.availableRecipes().filter(r => r.title.toLowerCase().includes(q))
    );
  }

  addRecipeInline(meal: ScheduledMeal, recipe: Recipe): void {
    this.scheduledSvc.linkRecipe(meal.id, { recipeId: recipe.id, servings: 1 }).subscribe({
      next: updated => {
        this.scheduledMeals.update(list => list.map(m => m.id === updated.id ? updated : m));
        this.reloadSummary();
        // Keep picker open so user can add more; clear search for convenience
        this.inlineSearch = '';
        this.inlinePickerResults.set([]);
      },
      error: () => {},
    });
  }

  dismissCheckInBanner(): void { this.bannerDismissed.set(true); }

  // ── Misc helpers ─────────────────────────────────────────────────────────────
  blockMeta(type: BlockType) { return BLOCK_META[type] ?? BLOCK_META.custom; }
  dotColor(type: BlockType)  { return BLOCK_META[type]?.color ?? '#9ca3af'; }
  protocolIcon(b: RoutineBlock): string {
    if (b.type === 'medication') { const cat = b.metadata?.['category'] as string | undefined; return cat ? (PROTOCOL_ICON[cat] ?? '💊') : '💊'; }
    return BLOCK_META[b.type]?.icon ?? '📌';
  }
  isDone(b: RoutineBlock): boolean {
    if (b.type !== 'medication') return false;
    const pid = b.metadata?.['protocolId'] as string | undefined;
    return pid ? this.protocols().some(p => p.id === pid && !!p.log) : false;
  }
  pct(consumed: number | undefined, target: number): number { if (!consumed || !target) return 0; return Math.min(100, (consumed / target) * 100); }
  absVal(n: number): number { return Math.abs(n); }
  private currentMinuteOfDay(): number { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); }
  private showXpPop(xp: number, event?: MouseEvent): void {
    this.lastXp.set(xp); this.xpPopX = event?.clientX ?? window.innerWidth / 2; this.xpPopY = event?.clientY ?? window.innerHeight / 2;
    this.xpPopVisible.set(true); setTimeout(() => this.xpPopVisible.set(false), 900);
  }
}
