import { AppDataSource } from "../config/typeorm.config";
import { UserBadge } from "../entities/Badge";
import { BlockCompletion } from "../entities/BlockCompletion";
import { XpLog } from "../entities/XpLog";
import { WeeklyCheckIn } from "../entities/WeeklyCheckIn";
import { WorkoutSheet } from "../entities/WorkoutSheet";
import { WaterLog } from "../entities/WaterLog";
import { Recipe } from "../entities/Recipe";
import { User } from "../entities/User";

// ── Badge definitions ────────────────────────────────────────────────────────

export interface BadgeDefinition {
  slug: string;
  name: string;
  description: string;
  emoji: string;
  category: "milestone" | "streak" | "social" | "nutrition" | "workout" | "special";
  tier: "bronze" | "silver" | "gold";
}

export const BADGE_CATALOG: BadgeDefinition[] = [
  // ── Milestone badges ──
  { slug: "first-workout",      name: "Primeiro Treino",        description: "Complete seu primeiro treino",                 emoji: "🏋️", category: "milestone", tier: "bronze" },
  { slug: "first-week",         name: "Primeira Semana",        description: "Complete 7 dias usando o app",                 emoji: "📅", category: "milestone", tier: "bronze" },
  { slug: "first-checkin",      name: "Primeiro Check-in",      description: "Faca seu primeiro check-in semanal",           emoji: "📸", category: "milestone", tier: "bronze" },
  { slug: "first-recipe",       name: "Chef Iniciante",         description: "Crie sua primeira receita",                    emoji: "👨‍🍳", category: "milestone", tier: "bronze" },

  // ── Workout badges ──
  { slug: "workouts-10",        name: "10 Treinos",             description: "Complete 10 treinos",                          emoji: "💪", category: "workout",   tier: "bronze" },
  { slug: "workouts-50",        name: "50 Treinos",             description: "Complete 50 treinos",                          emoji: "🔥", category: "workout",   tier: "silver" },
  { slug: "workouts-100",       name: "Centuriao",              description: "Complete 100 treinos",                         emoji: "🏆", category: "workout",   tier: "gold" },
  { slug: "workouts-3-sheets",  name: "Variedade",              description: "Tenha 3 fichas de treino diferentes",          emoji: "📋", category: "workout",   tier: "bronze" },

  // ── Streak badges ──
  { slug: "streak-7",           name: "Semana Perfeita",        description: "Complete blocos por 7 dias consecutivos",      emoji: "⚡", category: "streak",    tier: "bronze" },
  { slug: "streak-30",          name: "Mes de Ferro",           description: "Complete blocos por 30 dias consecutivos",     emoji: "🗓️", category: "streak",    tier: "silver" },
  { slug: "streak-90",          name: "Trimestre Imparavel",    description: "Complete blocos por 90 dias consecutivos",     emoji: "💎", category: "streak",    tier: "gold" },

  // ── Nutrition badges ──
  { slug: "hydration-7",        name: "Hidratado",              description: "Bata a meta de agua por 7 dias",              emoji: "💧", category: "nutrition", tier: "bronze" },
  { slug: "hydration-30",       name: "Fonte de Vida",          description: "Bata a meta de agua por 30 dias",             emoji: "🌊", category: "nutrition", tier: "silver" },
  { slug: "meals-logged-50",    name: "Dieta Controlada",       description: "Registre 50 refeicoes",                       emoji: "🍽️", category: "nutrition", tier: "bronze" },
  { slug: "meals-logged-200",   name: "Mestre da Nutricao",     description: "Registre 200 refeicoes",                      emoji: "🥗", category: "nutrition", tier: "silver" },

  // ── Social badges ──
  { slug: "social-first-post",  name: "Social",                 description: "Faca sua primeira publicacao no feed",        emoji: "🌐", category: "social",    tier: "bronze" },
  { slug: "challenge-5",        name: "Desafiante",             description: "Complete 5 desafios semanais",                emoji: "🎯", category: "social",    tier: "bronze" },
  { slug: "challenge-20",       name: "Imparavel",              description: "Complete 20 desafios semanais",               emoji: "🏅", category: "social",    tier: "silver" },

  // ── Special badges ──
  { slug: "xp-1000",            name: "1.000 XP",               description: "Acumule 1.000 XP no total",                  emoji: "⭐", category: "special",   tier: "bronze" },
  { slug: "xp-5000",            name: "5.000 XP",               description: "Acumule 5.000 XP no total",                  emoji: "🌟", category: "special",   tier: "silver" },
  { slug: "xp-10000",           name: "Lendario",               description: "Acumule 10.000 XP no total",                 emoji: "✨", category: "special",   tier: "gold" },
  { slug: "level-max",          name: "Campeao",                description: "Alcance o nivel maximo (Nivel 7)",            emoji: "👑", category: "special",   tier: "gold" },
];

// ── Service ──────────────────────────────────────────────────────────────────

export class BadgeService {
  private static get repo() { return AppDataSource.getRepository(UserBadge); }

  static async getUserBadges(userId: string): Promise<Array<BadgeDefinition & { unlockedAt: Date | null }>> {
    const unlocked = await this.repo.find({ where: { userId } });
    const unlockedMap = new Map(unlocked.map(b => [b.slug, b.unlockedAt]));

    return BADGE_CATALOG.map(def => ({
      ...def,
      unlockedAt: unlockedMap.get(def.slug) ?? null,
    }));
  }

  static async checkAndUnlock(userId: string): Promise<UserBadge[]> {
    const existing = await this.repo.find({ where: { userId } });
    const owned = new Set(existing.map(b => b.slug));
    const newBadges: UserBadge[] = [];

    for (const def of BADGE_CATALOG) {
      if (owned.has(def.slug)) continue;
      const earned = await this.evaluateBadge(userId, def.slug);
      if (earned) {
        const badge = this.repo.create({ userId, slug: def.slug, unlockedAt: new Date() });
        await this.repo.save(badge);
        newBadges.push(badge);
      }
    }
    return newBadges;
  }

  private static async evaluateBadge(userId: string, slug: string): Promise<boolean> {
    switch (slug) {
      // ── Milestones ──
      case "first-workout":
        return (await this.countExerciseCompletions(userId)) >= 1;
      case "first-week":
        return (await this.countDistinctCompletionDays(userId)) >= 7;
      case "first-checkin":
        return (await AppDataSource.getRepository(WeeklyCheckIn).count({ where: { userId } })) >= 1;
      case "first-recipe":
        return (await AppDataSource.getRepository(Recipe).count({ where: { authorId: userId } })) >= 1;

      // ── Workouts ──
      case "workouts-10":
        return (await this.countExerciseCompletions(userId)) >= 10;
      case "workouts-50":
        return (await this.countExerciseCompletions(userId)) >= 50;
      case "workouts-100":
        return (await this.countExerciseCompletions(userId)) >= 100;
      case "workouts-3-sheets":
        return (await AppDataSource.getRepository(WorkoutSheet).count({ where: { userId, isActive: true } })) >= 3;

      // ── Streaks ──
      case "streak-7":
        return (await this.longestStreak(userId)) >= 7;
      case "streak-30":
        return (await this.longestStreak(userId)) >= 30;
      case "streak-90":
        return (await this.longestStreak(userId)) >= 90;

      // ── Nutrition ──
      case "hydration-7":
        return (await this.waterGoalDays(userId)) >= 7;
      case "hydration-30":
        return (await this.waterGoalDays(userId)) >= 30;
      case "meals-logged-50":
        return (await this.countMealCompletions(userId)) >= 50;
      case "meals-logged-200":
        return (await this.countMealCompletions(userId)) >= 200;

      // ── Social ──
      case "social-first-post":
        return (await AppDataSource.query(
          `SELECT COUNT(*) as c FROM block_posts WHERE "userId" = $1`, [userId]
        ).then(r => Number(r[0]?.c ?? 0))) >= 1;
      case "challenge-5":
        return (await this.completedChallenges(userId)) >= 5;
      case "challenge-20":
        return (await this.completedChallenges(userId)) >= 20;

      // ── Special ──
      case "xp-1000": {
        const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId } });
        return (user?.xp ?? 0) >= 1000;
      }
      case "xp-5000": {
        const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId } });
        return (user?.xp ?? 0) >= 5000;
      }
      case "xp-10000": {
        const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId } });
        return (user?.xp ?? 0) >= 10000;
      }
      case "level-max": {
        const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId } });
        return (user?.xp ?? 0) >= 5000; // Level 7 threshold
      }

      default:
        return false;
    }
  }

  // ── Helpers ──

  private static async countExerciseCompletions(userId: string): Promise<number> {
    const result = await AppDataSource.query(
      `SELECT COUNT(*) as c FROM block_completions bc
       JOIN routine_blocks rb ON rb.id = bc."blockId"
       WHERE bc."userId" = $1 AND rb.type = 'exercise'`,
      [userId]
    );
    return Number(result[0]?.c ?? 0);
  }

  private static async countMealCompletions(userId: string): Promise<number> {
    const result = await AppDataSource.query(
      `SELECT COUNT(*) as c FROM block_completions bc
       JOIN routine_blocks rb ON rb.id = bc."blockId"
       WHERE bc."userId" = $1 AND rb.type = 'meal'`,
      [userId]
    );
    return Number(result[0]?.c ?? 0);
  }

  private static async countDistinctCompletionDays(userId: string): Promise<number> {
    const result = await AppDataSource.query(
      `SELECT COUNT(DISTINCT "completionDate") as c FROM block_completions WHERE "userId" = $1`,
      [userId]
    );
    return Number(result[0]?.c ?? 0);
  }

  private static async longestStreak(userId: string): Promise<number> {
    const rows: Array<{ d: string }> = await AppDataSource.query(
      `SELECT DISTINCT "completionDate" as d FROM block_completions
       WHERE "userId" = $1 ORDER BY d`, [userId]
    );
    if (rows.length === 0) return 0;
    let maxStreak = 1, current = 1;
    for (let i = 1; i < rows.length; i++) {
      const prev = new Date(rows[i - 1]!.d);
      const curr = new Date(rows[i]!.d);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) { current++; maxStreak = Math.max(maxStreak, current); }
      else { current = 1; }
    }
    return maxStreak;
  }

  private static async waterGoalDays(userId: string): Promise<number> {
    const result = await AppDataSource.query(
      `SELECT COUNT(DISTINCT "completionDate") as c FROM block_completions bc
       JOIN routine_blocks rb ON rb.id = bc."blockId"
       WHERE bc."userId" = $1 AND rb.type = 'water'`,
      [userId]
    );
    return Number(result[0]?.c ?? 0);
  }

  private static async completedChallenges(userId: string): Promise<number> {
    const result = await AppDataSource.query(
      `SELECT COUNT(*) as c FROM challenge_participants
       WHERE "userId" = $1 AND "completedAt" IS NOT NULL`,
      [userId]
    );
    return Number(result[0]?.c ?? 0);
  }
}
