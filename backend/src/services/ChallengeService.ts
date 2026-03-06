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

// ── Predefined challenge templates ───────────────────────────────────────────

interface ChallengeTemplate {
  title: string;
  description: string;
  category: string;
  targetCount: number;
  xpReward: number;
  emoji: string;
}

const WEEKLY_TEMPLATES: ChallengeTemplate[] = [
  {
    title:       "Semana Ativa",
    description: "Complete 5 blocos de exercício esta semana.",
    category:    "exercise",
    targetCount: 5,
    xpReward:    75,
    emoji:       "🏋️",
  },
  {
    title:       "Hidratação Constante",
    description: "Complete 5 blocos de água esta semana.",
    category:    "water",
    targetCount: 5,
    xpReward:    50,
    emoji:       "💧",
  },
  {
    title:       "Mestre do Sono",
    description: "Registre 5 blocos de sono esta semana.",
    category:    "sleep",
    targetCount: 5,
    xpReward:    50,
    emoji:       "😴",
  },
  {
    title:       "Vitamina D",
    description: "Complete 3 blocos de exposição solar esta semana.",
    category:    "sun_exposure",
    targetCount: 3,
    xpReward:    40,
    emoji:       "☀️",
  },
  {
    title:       "Foco Total",
    description: "Complete 4 blocos de trabalho esta semana.",
    category:    "work",
    targetCount: 4,
    xpReward:    40,
    emoji:       "💼",
  },
];

// ── Repository helpers ────────────────────────────────────────────────────────

function challengeRepo()     { return AppDataSource.getRepository(Challenge); }
function participantRepo()   { return AppDataSource.getRepository(ChallengeParticipant); }
function blockRepo()         { return AppDataSource.getRepository(RoutineBlock); }

// ── Service ──────────────────────────────────────────────────────────────────

export class ChallengeService {
  /**
   * Ensures all weekly challenge templates exist for the current week.
   * Idempotent — safe to call on every request.
   */
  static async ensureWeeklyChallenges(): Promise<void> {
    const weekStart = isoWeekStart();
    const weekEnd   = isoWeekEnd();

    const existing = await challengeRepo().find({
      where: { weekStart, isActive: true },
    });

    if (existing.length >= WEEKLY_TEMPLATES.length) return;

    const existingCategories = new Set(existing.map(c => c.category));

    for (const tpl of WEEKLY_TEMPLATES) {
      if (existingCategories.has(tpl.category)) continue;
      await challengeRepo().save(
        challengeRepo().create({ ...tpl, weekStart, weekEnd })
      );
    }
  }

  /** Returns all active challenges for the current week with join status. */
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

    // Compute progress for joined challenges in one batch query
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
   * After a block completion, checks all joined challenges for the given
   * category and auto-awards completion XP if thresholds are met.
   * Called from RoutineController.
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
