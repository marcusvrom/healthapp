import { AppDataSource } from "../config/typeorm.config";
import { User } from "../entities/User";
import { XpLog } from "../entities/XpLog";

export const XP_REWARDS = {
  MEAL_CONSUMED:      10,
  WATER_GOAL_MET:      5,
  WEIGHT_LOGGED:       3,
  BLOOD_TEST_ADDED:   20,
  MEDICATION_TAKEN:    5,
  RECIPE_CREATED:     10,
  RECIPE_IMPORTED:    15,
  RECIPE_REVIEWED:     5,
  // Routine block completions
  BLOCK_EXERCISE:     25,
  BLOCK_WATER:         5,
  BLOCK_SUN_EXPOSURE: 10,
  BLOCK_SLEEP:        10,
  BLOCK_WORK:          5,
  BLOCK_FREE:          5,
  BLOCK_CUSTOM:        5,
  // Social bonus
  BLOCK_PHOTO:        10,
} as const;

/**
 * Maximum XP a user can earn per category per calendar day.
 * Prevents unlimited XP farming through repeated toggling.
 */
export const DAILY_XP_CAPS: Partial<Record<string, number>> = {
  exercise:     100, // 4 × 25 XP
  meal:          50, // 5 × 10 XP
  water:         25, // 5 ×  5 XP
  sleep:         10,
  sun_exposure:  10,
  work:          15,
  free:          15,
  custom:        25,
};

export interface RankingEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  weeklyXp: number;
  totalXp: number;
  level: number;
  levelTitle: string;
}

export class GamificationService {
  private static get userRepo() {
    return AppDataSource.getRepository(User);
  }

  private static get logRepo() {
    return AppDataSource.getRepository(XpLog);
  }

  /**
   * Awards XP to a user.
   *  1. Atomically increments users.xp.
   *  2. Inserts an immutable XpLog entry for audit / ranking.
   * Returns the new total XP.
   */
  static async awardXp(
    userId: string,
    amount: number,
    category = "general",
    sourceId?: string
  ): Promise<number> {
    const abs = Math.abs(amount);

    await this.userRepo
      .createQueryBuilder()
      .update(User)
      .set({ xp: () => `xp + ${abs}` })
      .where("id = :userId", { userId })
      .execute();

    const log = this.logRepo.create({ userId, amount: abs, category, sourceId });
    await this.logRepo.save(log);

    const user = await this.userRepo.findOneBy({ id: userId });
    return user?.xp ?? 0;
  }

  /** Returns the current XP total for a user. */
  static async getXp(userId: string): Promise<number> {
    const user = await this.userRepo.findOneBy({ id: userId });
    return user?.xp ?? 0;
  }

  /**
   * Total XP earned today (UTC) in a specific category.
   * Used to enforce daily caps before awarding.
   */
  static async getDailyEarnedXp(
    userId: string,
    date: string,  // YYYY-MM-DD
    category: string
  ): Promise<number> {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end   = new Date(`${date}T23:59:59.999Z`);

    const result = await this.logRepo
      .createQueryBuilder("l")
      .select("COALESCE(SUM(l.amount), 0)", "total")
      .where("l.user_id = :userId", { userId })
      .andWhere("l.category = :cat",   { cat: category })
      .andWhere("l.awarded_at >= :start", { start })
      .andWhere("l.awarded_at <= :end",   { end })
      .getRawOne<{ total: string }>();

    return Number(result?.total ?? 0);
  }

  /**
   * Remaining XP budget for a category today.
   * Returns Infinity when no cap exists for that category.
   */
  static async remainingDailyXp(
    userId: string,
    date: string,
    category: string
  ): Promise<number> {
    const cap = DAILY_XP_CAPS[category];
    if (cap == null) return Infinity;
    const earned = await this.getDailyEarnedXp(userId, date, category);
    return Math.max(0, cap - earned);
  }

  /**
   * Weekly leaderboard — top N users sorted by XP earned in the last 7 days.
   */
  static async getWeeklyRanking(limit = 20): Promise<RankingEntry[]> {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const rows = await this.logRepo
      .createQueryBuilder("l")
      .select("l.user_id", "userId")
      .addSelect("COALESCE(SUM(l.amount), 0)", "weeklyXp")
      .where("l.awarded_at >= :since", { since })
      .groupBy("l.user_id")
      .orderBy('"weeklyXp"', "DESC")
      .limit(limit)
      .getRawMany<{ userId: string; weeklyXp: string }>();

    if (!rows.length) return [];

    const userIds = rows.map(r => r.userId);
    const users = await this.userRepo
      .createQueryBuilder("u")
      .whereInIds(userIds)
      .getMany();

    const userMap = new Map(users.map(u => [u.id, u]));

    return rows.map(row => {
      const user = userMap.get(row.userId);
      const weeklyXp = Number(row.weeklyXp);
      const { level, title } = this.levelFromXp(user?.xp ?? 0);
      return {
        userId:     row.userId,
        name:       user?.name ?? "Usuário",
        avatarUrl:  user?.avatarUrl ?? null,
        weeklyXp,
        totalXp:    user?.xp ?? 0,
        level,
        levelTitle: title,
      };
    });
  }

  /** Returns a human-readable level title based on XP. */
  static levelFromXp(xp: number): { level: number; title: string; nextLevelXp: number } {
    const thresholds = [
      { level: 1, title: "Iniciante",      xp: 0 },
      { level: 2, title: "Comprometido",   xp: 100 },
      { level: 3, title: "Consistente",    xp: 300 },
      { level: 4, title: "Dedicado",       xp: 600 },
      { level: 5, title: "Atleta",         xp: 1000 },
      { level: 6, title: "Elite",          xp: 2000 },
      { level: 7, title: "Campeão",        xp: 5000 },
    ];

    let current = thresholds[0]!;
    for (const t of thresholds) {
      if (xp >= t.xp) current = t;
    }
    const nextIdx = thresholds.findIndex(t => t.level === current.level) + 1;
    const nextLevelXp =
      nextIdx < thresholds.length ? thresholds[nextIdx]!.xp : current.xp;

    return { level: current.level, title: current.title, nextLevelXp };
  }
}
