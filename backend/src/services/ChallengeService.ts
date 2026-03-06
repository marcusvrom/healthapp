import { AppDataSource } from "../config/typeorm.config";
import { Challenge } from "../entities/Challenge";
import { ChallengeParticipant } from "../entities/ChallengeParticipant";
import { RoutineBlock } from "../entities/RoutineBlock";
import { GamificationService } from "./GamificationService";

// ── Week helpers ─────────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD for the ISO Monday of the given date. */
function isoWeekStart(d = new Date()): string {
  const day = d.getUTCDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setUTCDate(d.getUTCDate() + diff);
  return mon.toISOString().slice(0, 10);
}

/** Returns YYYY-MM-DD for the ISO Sunday of the given date. */
function isoWeekEnd(d = new Date()): string {
  const start = isoWeekStart(d);
  const sun = new Date(start);
  sun.setUTCDate(sun.getUTCDate() + 6);
  return sun.toISOString().slice(0, 10);
}

/**
 * ISO week number (1–53) for the given date.
 * Used as the seed for deterministic weekly challenge rotation.
 */
function isoWeekNumber(d = new Date()): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// ── Challenge template pool ───────────────────────────────────────────────────

interface ChallengeTemplate {
  title: string;
  description: string;
  category: string;
  targetCount: number;
  xpReward: number;
  emoji: string;
}

type DifficultyTrio = [ChallengeTemplate, ChallengeTemplate, ChallengeTemplate];

/**
 * SLOT 1 — Exercício
 * Apoia o objetivo de saúde mais impactante: movimento físico consistente.
 */
const EXERCISE_POOL: DifficultyTrio = [
  {
    title:       "Primeiros Passos",
    description: "Complete 3 treinos esta semana. Todo movimento conta — comece agora!",
    category:    "exercise", targetCount: 3, xpReward: 40, emoji: "🏃",
  },
  {
    title:       "Semana Ativa",
    description: "5 blocos de exercício. Construa o hábito de se mover todos os dias!",
    category:    "exercise", targetCount: 5, xpReward: 75, emoji: "🏋️",
  },
  {
    title:       "Atleta da Semana",
    description: "7 treinos em 7 dias. Apenas para os mais dedicados!",
    category:    "exercise", targetCount: 7, xpReward: 120, emoji: "🔥",
  },
];

/**
 * SLOT 2 — Sono
 * Sono de qualidade é o maior acelerador de recuperação e performance hormonal.
 */
const SLEEP_POOL: DifficultyTrio = [
  {
    title:       "Sono Essencial",
    description: "Registre 3 noites de sono esta semana. Descanso é parte do treino!",
    category:    "sleep", targetCount: 3, xpReward: 35, emoji: "😴",
  },
  {
    title:       "Mestre do Sono",
    description: "5 registros de sono completos. Recuperação total é performance máxima!",
    category:    "sleep", targetCount: 5, xpReward: 55, emoji: "🌙",
  },
  {
    title:       "Sono Perfeito",
    description: "7 noites registradas. Quem dorme como atleta, performa como atleta!",
    category:    "sleep", targetCount: 7, xpReward: 90, emoji: "✨",
  },
];

/**
 * SLOT 3 — Hidratação
 * Hidratação inadequada reduz performance cognitiva e física em até 20%.
 */
const WATER_POOL: DifficultyTrio = [
  {
    title:       "Hidratação Básica",
    description: "Registre 3 blocos de água. Comece a cultivar o hábito da hidratação!",
    category:    "water", targetCount: 3, xpReward: 30, emoji: "💧",
  },
  {
    title:       "Hidratação Constante",
    description: "5 registros de hidratação. Água é vida — mantenha o ritmo diário!",
    category:    "water", targetCount: 5, xpReward: 50, emoji: "🌊",
  },
  {
    title:       "Hidro Máximo",
    description: "7 dias hidratado. Hidratação de alta performance — sem exceções!",
    category:    "water", targetCount: 7, xpReward: 80, emoji: "💦",
  },
];

/**
 * SLOT 4 — Wildcard (rotaciona a cada ciclo de 3 semanas)
 * Exposição solar → saúde hormonal, vitamina D e ritmo circadiano.
 * Trabalho focado → produtividade saudável e equilíbrio mental.
 * Lazer/recuperação → prevenção de burnout e resiliência.
 */
const WILDCARD_POOLS: DifficultyTrio[] = [
  // Ciclo A — Exposição Solar (semanas 1–3, 10–12, 19–21…)
  [
    {
      title:       "Sol da Manhã",
      description: "Expor-se ao sol 2 vezes esta semana. Vitamina D grátis, sem suplemento!",
      category:    "sun_exposure", targetCount: 2, xpReward: 30, emoji: "☀️",
    },
    {
      title:       "Vitamina D",
      description: "3 blocos de exposição solar. Equilíbrio hormonal e humor naturais!",
      category:    "sun_exposure", targetCount: 3, xpReward: 45, emoji: "🌤️",
    },
    {
      title:       "Exposição Solar Total",
      description: "5 dias de exposição solar consciente. Otimize seus níveis de vitamina D!",
      category:    "sun_exposure", targetCount: 5, xpReward: 70, emoji: "🌞",
    },
  ],
  // Ciclo B — Trabalho Focado (semanas 4–6, 13–15, 22–24…)
  [
    {
      title:       "Foco no Trabalho",
      description: "Complete 2 blocos de trabalho focado. Produtividade é um hábito!",
      category:    "work", targetCount: 2, xpReward: 25, emoji: "💼",
    },
    {
      title:       "Foco Total",
      description: "4 sessões de trabalho focado. Mente sã em corpo são!",
      category:    "work", targetCount: 4, xpReward: 45, emoji: "🧠",
    },
    {
      title:       "Workaholic Saudável",
      description: "6 blocos de trabalho produtivo. Discipline-se sem se destruir!",
      category:    "work", targetCount: 6, xpReward: 65, emoji: "💪",
    },
  ],
  // Ciclo C — Lazer e Recuperação (semanas 7–9, 16–18, 25–27…)
  [
    {
      title:       "Tempo para Si",
      description: "Reserve 2 momentos de lazer. Recuperação ativa é tão vital quanto treinar!",
      category:    "free", targetCount: 2, xpReward: 25, emoji: "🎯",
    },
    {
      title:       "Equilíbrio",
      description: "4 blocos de lazer e recuperação. Bem-estar vai além da academia!",
      category:    "free", targetCount: 4, xpReward: 45, emoji: "🧘",
    },
    {
      title:       "Modo Zen",
      description: "6 momentos de lazer registrados. Quem sabe descansar, sabe viver!",
      category:    "free", targetCount: 6, xpReward: 65, emoji: "🌿",
    },
  ],
];

/**
 * SLOT 5 — Presença Geral
 * Recompensa a consistência independente da atividade — o hábito em si.
 * "Qualquer bloco" (category = "any") conta, incentivando completar a rotina.
 */
const GENERAL_POOL: DifficultyTrio = [
  {
    title:       "Rotina em Movimento",
    description: "Complete qualquer 5 blocos de rotina esta semana. Presença é tudo!",
    category:    "any", targetCount: 5, xpReward: 40, emoji: "🌱",
  },
  {
    title:       "Rotina Consistente",
    description: "10 blocos completados. Consistência bate perfeição — apareça todo dia!",
    category:    "any", targetCount: 10, xpReward: 70, emoji: "⭐",
  },
  {
    title:       "Modo Máquina",
    description: "15 blocos em 7 dias. Você é uma máquina de hábitos — imparável!",
    category:    "any", targetCount: 15, xpReward: 120, emoji: "🏆",
  },
];

/**
 * Selects 5 challenges for the current ISO week using deterministic rotation.
 *
 * Rotation axes:
 *  • Difficulty tier   = weekNumber % 3
 *      0 → Iniciante (easy)   — 1ª, 4ª, 7ª semana do ciclo…
 *      1 → Consistente (mid)  — 2ª, 5ª, 8ª semana do ciclo…
 *      2 → Elite (hard)       — 3ª, 6ª, 9ª semana do ciclo…
 *
 *  • Wildcard category = Math.floor(weekNumber / 3) % 3
 *      0 → Exposição Solar (ciclos 0, 3, 6…)
 *      1 → Trabalho Focado (ciclos 1, 4, 7…)
 *      2 → Lazer/Recuperação (ciclos 2, 5, 8…)
 *
 * Full unique cycle: 9 weeks × 1 per slot = no exact repeat for 9 weeks.
 * Users feel natural progression: 3 easy → 3 medium → 3 hard → reset.
 * The wildcard keeps variety even within the same difficulty tier.
 */
function selectWeeklyTemplates(): ChallengeTemplate[] {
  const week     = isoWeekNumber();
  const tier     = week % 3;                                   // 0 | 1 | 2
  const wildcard = Math.floor(week / 3) % WILDCARD_POOLS.length; // 0 | 1 | 2

  return [
    EXERCISE_POOL[tier]!,
    SLEEP_POOL[tier]!,
    WATER_POOL[tier]!,
    WILDCARD_POOLS[wildcard]![tier]!,
    GENERAL_POOL[tier]!,
  ];
}

// ── Repository helpers ────────────────────────────────────────────────────────

function challengeRepo()   { return AppDataSource.getRepository(Challenge); }
function participantRepo() { return AppDataSource.getRepository(ChallengeParticipant); }
function blockRepo()       { return AppDataSource.getRepository(RoutineBlock); }

// ── Service ──────────────────────────────────────────────────────────────────

export class ChallengeService {
  /**
   * Ensures all weekly challenges exist for the current week.
   * Idempotent — safe to call on every request.
   * Selects templates via deterministic rotation (see selectWeeklyTemplates).
   */
  static async ensureWeeklyChallenges(): Promise<void> {
    const weekStart = isoWeekStart();
    const weekEnd   = isoWeekEnd();
    const templates = selectWeeklyTemplates();

    const existing = await challengeRepo().find({
      where: { weekStart, isActive: true },
    });

    if (existing.length >= templates.length) return;

    const existingCategories = new Set(existing.map(c => c.category));

    for (const tpl of templates) {
      if (existingCategories.has(tpl.category)) continue;
      await challengeRepo().save(
        challengeRepo().create({ ...tpl, weekStart, weekEnd })
      );
    }
  }

  /** Returns all active challenges for the current week with join status and progress. */
  static async getActiveChallenges(userId: string): Promise<Array<Challenge & {
    joined: boolean;
    progress: number;
    completed: boolean;
  }>> {
    await this.ensureWeeklyChallenges();

    const weekStart = isoWeekStart();
    const challenges = await challengeRepo().find({
      where: { weekStart, isActive: true },
      order: { xpReward: "DESC" },
    });

    const participants = await participantRepo().find({
      where: challenges.map(c => ({ userId, challengeId: c.id })),
    });
    const participantMap = new Map(participants.map(p => [p.challengeId, p]));

    const joinedIds = participants.map(p => p.challengeId);
    const progressMap = new Map<string, number>();

    if (joinedIds.length > 0) {
      const joined = challenges.filter(c => joinedIds.includes(c.id));
      await Promise.all(joined.map(async c => {
        const count = await this.computeProgress(userId, c);
        progressMap.set(c.id, count);
      }));
    }

    return challenges.map(c => {
      const participant = participantMap.get(c.id);
      const progress    = progressMap.get(c.id) ?? 0;
      return {
        ...c,
        joined:    !!participant,
        progress,
        completed: !!participant?.completedAt,
      };
    });
  }

  /**
   * Counts completed RoutineBlocks matching the challenge category
   * within the challenge's week window for a given user.
   * category = "any" counts all block types.
   */
  static async computeProgress(userId: string, challenge: Challenge): Promise<number> {
    const qb = blockRepo()
      .createQueryBuilder("b")
      .where("b.user_id = :userId", { userId })
      .andWhere("b.completed_at IS NOT NULL")
      .andWhere("b.routine_date >= :start", { start: challenge.weekStart })
      .andWhere("b.routine_date <= :end",   { end:   challenge.weekEnd });

    if (challenge.category !== "any") {
      qb.andWhere("b.type = :cat", { cat: challenge.category });
    }

    return qb.getCount();
  }

  /** User joins a challenge. Idempotent. */
  static async joinChallenge(userId: string, challengeId: string): Promise<ChallengeParticipant> {
    const existing = await participantRepo().findOneBy({ userId, challengeId });
    if (existing) return existing;

    const challenge = await challengeRepo().findOneBy({ id: challengeId, isActive: true });
    if (!challenge) throw new Error("Desafio não encontrado.");

    const p = participantRepo().create({ userId, challengeId });
    return participantRepo().save(p);
  }

  /**
   * Checks whether the user has reached the target for a challenge and,
   * if so, marks it as completed and awards XP (once).
   * Returns the XP awarded (0 if already completed or not yet done).
   */
  static async checkAndAwardCompletion(userId: string, challengeId: string): Promise<number> {
    const participant = await participantRepo().findOneBy({ userId, challengeId });
    if (!participant || participant.completedAt) return 0;

    const challenge = await challengeRepo().findOneBy({ id: challengeId });
    if (!challenge) return 0;

    const progress = await this.computeProgress(userId, challenge);
    if (progress < challenge.targetCount) return 0;

    participant.completedAt = new Date();
    await participantRepo().save(participant);
    await GamificationService.awardXp(userId, challenge.xpReward, "challenge", challengeId);
    return challenge.xpReward;
  }

  /**
   * Called from RoutineController after every block completion.
   * Finds joined challenges that match the block type and auto-awards
   * completion XP if the user just hit the target.
   */
  static async handleBlockCompleted(userId: string, blockType: string): Promise<number> {
    const weekStart = isoWeekStart();
    const challenges = await challengeRepo()
      .createQueryBuilder("c")
      .where("c.week_start = :weekStart", { weekStart })
      .andWhere("c.is_active = true")
      .andWhere("(c.category = :type OR c.category = 'any')", { type: blockType })
      .getMany();

    if (!challenges.length) return 0;

    let totalAwarded = 0;
    for (const c of challenges) {
      const xp = await this.checkAndAwardCompletion(userId, c.id);
      totalAwarded += xp;
    }
    return totalAwarded;
  }
}
