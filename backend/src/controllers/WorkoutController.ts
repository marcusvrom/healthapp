import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { AppDataSource } from "../config/typeorm.config";
import { WorkoutSheet } from "../entities/WorkoutSheet";
import { WorkoutSheetExercise } from "../entities/WorkoutSheetExercise";

function sheetRepo() { return AppDataSource.getRepository(WorkoutSheet); }
function exerciseRepo() { return AppDataSource.getRepository(WorkoutSheetExercise); }

// ── Workout Templates ─────────────────────────────────────────────────────────
export interface TemplateExercise {
  name: string;
  sets: number;
  reps: string;
  restSeconds: number;
  notes?: string;
}

export interface WorkoutTemplate {
  slug: string;
  name: string;
  description: string;
  category: string;
  estimatedMinutes: number;
  exercises: TemplateExercise[];
}

export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  // ── Push / Pull / Legs ──────────────────────────────────────────────
  {
    slug: "ppl-push",
    name: "Push (Peito, Ombro, Triceps)",
    description: "Dia de empurrar — foco em peito, deltoides e triceps",
    category: "PPL",
    estimatedMinutes: 60,
    exercises: [
      { name: "Supino reto com barra", sets: 4, reps: "8-10", restSeconds: 90 },
      { name: "Supino inclinado halteres", sets: 3, reps: "10-12", restSeconds: 75 },
      { name: "Crucifixo maquina (peck deck)", sets: 3, reps: "12-15", restSeconds: 60 },
      { name: "Desenvolvimento com halteres", sets: 4, reps: "8-10", restSeconds: 90 },
      { name: "Elevacao lateral", sets: 3, reps: "12-15", restSeconds: 60 },
      { name: "Triceps corda", sets: 3, reps: "12-15", restSeconds: 60 },
      { name: "Triceps testa", sets: 3, reps: "10-12", restSeconds: 60 },
    ],
  },
  {
    slug: "ppl-pull",
    name: "Pull (Costas, Biceps)",
    description: "Dia de puxar — foco em dorsais, trapezio e biceps",
    category: "PPL",
    estimatedMinutes: 60,
    exercises: [
      { name: "Barra fixa (pull-up)", sets: 4, reps: "6-10", restSeconds: 90, notes: "Usar assistencia se necessario" },
      { name: "Remada curvada com barra", sets: 4, reps: "8-10", restSeconds: 90 },
      { name: "Puxada frontal", sets: 3, reps: "10-12", restSeconds: 75 },
      { name: "Remada unilateral halter", sets: 3, reps: "10-12", restSeconds: 60 },
      { name: "Face pull", sets: 3, reps: "15-20", restSeconds: 60 },
      { name: "Rosca direta barra", sets: 3, reps: "10-12", restSeconds: 60 },
      { name: "Rosca martelo", sets: 3, reps: "10-12", restSeconds: 60 },
    ],
  },
  {
    slug: "ppl-legs",
    name: "Legs (Pernas e Gluteos)",
    description: "Dia de pernas — quadriceps, posterior e gluteos",
    category: "PPL",
    estimatedMinutes: 70,
    exercises: [
      { name: "Agachamento livre", sets: 4, reps: "6-8", restSeconds: 120, notes: "Foco na profundidade" },
      { name: "Leg press 45", sets: 4, reps: "10-12", restSeconds: 90 },
      { name: "Cadeira extensora", sets: 3, reps: "12-15", restSeconds: 60 },
      { name: "Mesa flexora", sets: 3, reps: "10-12", restSeconds: 60 },
      { name: "Stiff com barra", sets: 3, reps: "10-12", restSeconds: 75 },
      { name: "Elevacao pelvica (hip thrust)", sets: 3, reps: "12-15", restSeconds: 75 },
      { name: "Panturrilha em pe", sets: 4, reps: "15-20", restSeconds: 45 },
    ],
  },

  // ── Upper / Lower ──────────────────────────────────────────────────
  {
    slug: "upper",
    name: "Upper Body (Superior Completo)",
    description: "Treino completo de membros superiores",
    category: "Upper/Lower",
    estimatedMinutes: 65,
    exercises: [
      { name: "Supino reto com barra", sets: 4, reps: "8-10", restSeconds: 90 },
      { name: "Remada curvada com barra", sets: 4, reps: "8-10", restSeconds: 90 },
      { name: "Desenvolvimento militar", sets: 3, reps: "8-10", restSeconds: 75 },
      { name: "Puxada frontal", sets: 3, reps: "10-12", restSeconds: 75 },
      { name: "Elevacao lateral", sets: 3, reps: "12-15", restSeconds: 60 },
      { name: "Rosca direta", sets: 3, reps: "10-12", restSeconds: 60 },
      { name: "Triceps corda", sets: 3, reps: "10-12", restSeconds: 60 },
    ],
  },
  {
    slug: "lower",
    name: "Lower Body (Inferior Completo)",
    description: "Treino completo de membros inferiores",
    category: "Upper/Lower",
    estimatedMinutes: 60,
    exercises: [
      { name: "Agachamento livre", sets: 4, reps: "6-8", restSeconds: 120 },
      { name: "Leg press 45", sets: 4, reps: "10-12", restSeconds: 90 },
      { name: "Passada (afundo) com halteres", sets: 3, reps: "10 cada", restSeconds: 75 },
      { name: "Mesa flexora", sets: 3, reps: "10-12", restSeconds: 60 },
      { name: "Elevacao pelvica", sets: 3, reps: "12-15", restSeconds: 75 },
      { name: "Panturrilha sentado", sets: 4, reps: "15-20", restSeconds: 45 },
    ],
  },

  // ── Cardio / Atletismo ─────────────────────────────────────────────
  {
    slug: "sprint-100m",
    name: "Treino de 100m Rasos",
    description: "Sessao de velocidade com aquecimento e tiros",
    category: "Atletismo",
    estimatedMinutes: 45,
    exercises: [
      { name: "Trote leve (aquecimento)", sets: 1, reps: "10min", restSeconds: 0 },
      { name: "Alongamento dinamico", sets: 1, reps: "5min", restSeconds: 0 },
      { name: "Skipping alto", sets: 3, reps: "30m", restSeconds: 45 },
      { name: "Tiros de 30m", sets: 4, reps: "1", restSeconds: 90, notes: "95% da velocidade maxima" },
      { name: "Tiros de 60m", sets: 3, reps: "1", restSeconds: 120 },
      { name: "Tiro de 100m", sets: 2, reps: "1", restSeconds: 180, notes: "Foco em explosao na largada" },
      { name: "Volta a calma (trote)", sets: 1, reps: "5min", restSeconds: 0 },
    ],
  },
  {
    slug: "hiit",
    name: "HIIT (Intervalo de Alta Intensidade)",
    description: "Circuito intenso para queima de gordura e condicionamento",
    category: "Cardio",
    estimatedMinutes: 30,
    exercises: [
      { name: "Burpees", sets: 4, reps: "45s", restSeconds: 15 },
      { name: "Mountain climbers", sets: 4, reps: "45s", restSeconds: 15 },
      { name: "Jump squats", sets: 4, reps: "45s", restSeconds: 15 },
      { name: "Prancha dinamica", sets: 4, reps: "45s", restSeconds: 15 },
      { name: "Corrida no lugar (alta intensidade)", sets: 4, reps: "45s", restSeconds: 15 },
    ],
  },

  // ── Full Body ──────────────────────────────────────────────────────
  {
    slug: "full-body",
    name: "Full Body (Corpo Inteiro)",
    description: "Treino equilibrado para todo o corpo em uma sessao",
    category: "Full Body",
    estimatedMinutes: 60,
    exercises: [
      { name: "Agachamento livre", sets: 3, reps: "8-10", restSeconds: 90 },
      { name: "Supino reto com barra", sets: 3, reps: "8-10", restSeconds: 90 },
      { name: "Remada curvada", sets: 3, reps: "8-10", restSeconds: 75 },
      { name: "Desenvolvimento com halteres", sets: 3, reps: "10-12", restSeconds: 75 },
      { name: "Stiff com barra", sets: 3, reps: "10-12", restSeconds: 75 },
      { name: "Rosca direta", sets: 2, reps: "10-12", restSeconds: 60 },
      { name: "Triceps testa", sets: 2, reps: "10-12", restSeconds: 60 },
      { name: "Prancha abdominal", sets: 3, reps: "45s", restSeconds: 30 },
    ],
  },

  // ── Treino ABC Clássico ────────────────────────────────────────────
  {
    slug: "abc-a",
    name: "Treino A – Peito e Triceps",
    description: "Divisao classica ABC — Dia A focado em peito e triceps",
    category: "ABC",
    estimatedMinutes: 50,
    exercises: [
      { name: "Supino reto com barra", sets: 4, reps: "8-10", restSeconds: 90 },
      { name: "Supino inclinado halteres", sets: 3, reps: "10-12", restSeconds: 75 },
      { name: "Crossover", sets: 3, reps: "12-15", restSeconds: 60 },
      { name: "Triceps pulley", sets: 3, reps: "10-12", restSeconds: 60 },
      { name: "Triceps frances", sets: 3, reps: "10-12", restSeconds: 60 },
    ],
  },
  {
    slug: "abc-b",
    name: "Treino B – Costas e Biceps",
    description: "Divisao classica ABC — Dia B focado em costas e biceps",
    category: "ABC",
    estimatedMinutes: 50,
    exercises: [
      { name: "Puxada frontal", sets: 4, reps: "8-10", restSeconds: 90 },
      { name: "Remada cavalinho", sets: 3, reps: "10-12", restSeconds: 75 },
      { name: "Remada unilateral", sets: 3, reps: "10-12", restSeconds: 60 },
      { name: "Rosca direta barra W", sets: 3, reps: "10-12", restSeconds: 60 },
      { name: "Rosca concentrada", sets: 3, reps: "10-12", restSeconds: 60 },
    ],
  },
  {
    slug: "abc-c",
    name: "Treino C – Pernas e Ombros",
    description: "Divisao classica ABC — Dia C focado em pernas e ombros",
    category: "ABC",
    estimatedMinutes: 55,
    exercises: [
      { name: "Agachamento smith", sets: 4, reps: "8-10", restSeconds: 90 },
      { name: "Cadeira extensora", sets: 3, reps: "12-15", restSeconds: 60 },
      { name: "Mesa flexora", sets: 3, reps: "10-12", restSeconds: 60 },
      { name: "Panturrilha em pe", sets: 4, reps: "15-20", restSeconds: 45 },
      { name: "Desenvolvimento maquina", sets: 3, reps: "10-12", restSeconds: 75 },
      { name: "Elevacao lateral", sets: 3, reps: "12-15", restSeconds: 60 },
    ],
  },
];

export class WorkoutController {
  /**
   * GET /workouts/templates — list all built-in templates
   */
  static listTemplates(_req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    try {
      res.json(WORKOUT_TEMPLATES);
    } catch (err) { next(err); }
  }

  /**
   * POST /workouts/from-template — create a sheet from a template
   * Body: { slug: string, name?: string, daysOfWeek?: number[] }
   */
  static async createFromTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug, name, daysOfWeek } = req.body as { slug: string; name?: string; daysOfWeek?: number[] };
      const tpl = WORKOUT_TEMPLATES.find(t => t.slug === slug);
      if (!tpl) { res.status(404).json({ message: "Template nao encontrado." }); return; }

      const sheet = sheetRepo().create({
        userId: req.userId,
        name: name ?? tpl.name,
        description: tpl.description,
        category: tpl.category,
        estimatedMinutes: tpl.estimatedMinutes,
        daysOfWeek: daysOfWeek ?? [],
        fromTemplate: tpl.slug,
      });
      await sheetRepo().save(sheet);

      const exercises = tpl.exercises.map((e, i) =>
        exerciseRepo().create({
          sheetId: sheet.id,
          name: e.name,
          sets: e.sets,
          reps: e.reps,
          restSeconds: e.restSeconds,
          notes: e.notes,
          sortOrder: i,
        })
      );
      await exerciseRepo().save(exercises);

      sheet.exercises = exercises;
      res.status(201).json(sheet);
    } catch (err) { next(err); }
  }

  /**
   * GET /workouts — list user's workout sheets
   */
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const sheets = await sheetRepo().find({
        where: { userId: req.userId },
        relations: ["exercises"],
        order: { createdAt: "DESC" },
      });
      // Sort exercises within each sheet
      sheets.forEach(s => s.exercises?.sort((a, b) => a.sortOrder - b.sortOrder));
      res.json(sheets);
    } catch (err) { next(err); }
  }

  /**
   * GET /workouts/:id — single sheet detail
   */
  static async detail(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const sheet = await sheetRepo().findOne({
        where: { id: req.params["id"]!, userId: req.userId },
        relations: ["exercises"],
      });
      if (!sheet) { res.status(404).json({ message: "Ficha nao encontrada." }); return; }
      sheet.exercises?.sort((a, b) => a.sortOrder - b.sortOrder);
      res.json(sheet);
    } catch (err) { next(err); }
  }

  /**
   * POST /workouts — create empty sheet
   * Body: { name, description?, category?, daysOfWeek?, estimatedMinutes?, exercises? }
   */
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, description, category, daysOfWeek, estimatedMinutes, exercises } = req.body as {
        name: string;
        description?: string;
        category?: string;
        daysOfWeek?: number[];
        estimatedMinutes?: number;
        exercises?: Array<{ name: string; sets?: number; reps?: string; restSeconds?: number; notes?: string }>;
      };

      if (!name?.trim()) { res.status(400).json({ message: "Nome da ficha e obrigatorio." }); return; }

      const sheet = sheetRepo().create({
        userId: req.userId,
        name: name.trim(),
        description: description?.trim(),
        category: category?.trim(),
        daysOfWeek: daysOfWeek ?? [],
        estimatedMinutes: estimatedMinutes ?? 60,
      });
      await sheetRepo().save(sheet);

      if (exercises?.length) {
        const exs = exercises.map((e, i) =>
          exerciseRepo().create({
            sheetId: sheet.id,
            name: e.name,
            sets: e.sets ?? 3,
            reps: e.reps ?? "8-12",
            restSeconds: e.restSeconds ?? 60,
            notes: e.notes,
            sortOrder: i,
          })
        );
        await exerciseRepo().save(exs);
        sheet.exercises = exs;
      }

      res.status(201).json(sheet);
    } catch (err) { next(err); }
  }

  /**
   * PATCH /workouts/:id — update sheet metadata
   */
  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const sheet = await sheetRepo().findOneBy({ id: req.params["id"]!, userId: req.userId });
      if (!sheet) { res.status(404).json({ message: "Ficha nao encontrada." }); return; }

      const { name, description, category, daysOfWeek, estimatedMinutes, isActive } = req.body as Partial<{
        name: string; description: string; category: string;
        daysOfWeek: number[]; estimatedMinutes: number; isActive: boolean;
      }>;

      if (name !== undefined)             sheet.name = name.trim();
      if (description !== undefined)      sheet.description = description?.trim() || undefined;
      if (category !== undefined)         sheet.category = category?.trim() || undefined;
      if (daysOfWeek !== undefined)       sheet.daysOfWeek = daysOfWeek;
      if (estimatedMinutes !== undefined) sheet.estimatedMinutes = estimatedMinutes;
      if (isActive !== undefined)         sheet.isActive = isActive;

      await sheetRepo().save(sheet);
      res.json(sheet);
    } catch (err) { next(err); }
  }

  /**
   * DELETE /workouts/:id — delete sheet (cascades exercises)
   */
  static async remove(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const sheet = await sheetRepo().findOneBy({ id: req.params["id"]!, userId: req.userId });
      if (!sheet) { res.status(404).json({ message: "Ficha nao encontrada." }); return; }
      await sheetRepo().remove(sheet);
      res.status(204).end();
    } catch (err) { next(err); }
  }

  // ── Sheet exercises CRUD ──────────────────────────────────────────────────

  /**
   * POST /workouts/:id/exercises — add exercise to sheet
   * Body: { name, sets?, reps?, restSeconds?, notes? }
   */
  static async addExercise(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const sheet = await sheetRepo().findOneBy({ id: req.params["id"]!, userId: req.userId });
      if (!sheet) { res.status(404).json({ message: "Ficha nao encontrada." }); return; }

      const { name, sets, reps, restSeconds, notes } = req.body as {
        name: string; sets?: number; reps?: string; restSeconds?: number; notes?: string;
      };
      if (!name?.trim()) { res.status(400).json({ message: "Nome do exercicio e obrigatorio." }); return; }

      // Calculate next sort order
      const maxOrder = await exerciseRepo()
        .createQueryBuilder("e")
        .select("COALESCE(MAX(e.sort_order), -1)", "mx")
        .where("e.sheet_id = :sid", { sid: sheet.id })
        .getRawOne<{ mx: number }>();

      const ex = exerciseRepo().create({
        sheetId: sheet.id,
        name: name.trim(),
        sets: sets ?? 3,
        reps: reps ?? "8-12",
        restSeconds: restSeconds ?? 60,
        notes: notes?.trim(),
        sortOrder: (maxOrder?.mx ?? -1) + 1,
      });
      await exerciseRepo().save(ex);
      res.status(201).json(ex);
    } catch (err) { next(err); }
  }

  /**
   * PATCH /workouts/:sheetId/exercises/:exId
   */
  static async updateExercise(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const sheet = await sheetRepo().findOneBy({ id: req.params["sheetId"]!, userId: req.userId });
      if (!sheet) { res.status(404).json({ message: "Ficha nao encontrada." }); return; }

      const ex = await exerciseRepo().findOneBy({ id: req.params["exId"]!, sheetId: sheet.id });
      if (!ex) { res.status(404).json({ message: "Exercicio nao encontrado." }); return; }

      const { name, sets, reps, restSeconds, notes, sortOrder } = req.body as Partial<{
        name: string; sets: number; reps: string; restSeconds: number; notes: string; sortOrder: number;
      }>;

      if (name !== undefined)        ex.name = name.trim();
      if (sets !== undefined)        ex.sets = sets;
      if (reps !== undefined)        ex.reps = reps;
      if (restSeconds !== undefined) ex.restSeconds = restSeconds;
      if (notes !== undefined)       ex.notes = notes?.trim() || undefined;
      if (sortOrder !== undefined)   ex.sortOrder = sortOrder;

      await exerciseRepo().save(ex);
      res.json(ex);
    } catch (err) { next(err); }
  }

  /**
   * DELETE /workouts/:sheetId/exercises/:exId
   */
  static async removeExercise(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const sheet = await sheetRepo().findOneBy({ id: req.params["sheetId"]!, userId: req.userId });
      if (!sheet) { res.status(404).json({ message: "Ficha nao encontrada." }); return; }

      const ex = await exerciseRepo().findOneBy({ id: req.params["exId"]!, sheetId: sheet.id });
      if (!ex) { res.status(404).json({ message: "Exercicio nao encontrado." }); return; }

      await exerciseRepo().remove(ex);
      res.status(204).end();
    } catch (err) { next(err); }
  }
}
