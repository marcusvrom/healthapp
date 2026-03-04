import { AppDataSource } from "../config/typeorm.config";
import { User } from "../entities/User";

export const XP_REWARDS = {
  MEAL_CONSUMED: 10,
  WATER_GOAL_MET: 5,
  WEIGHT_LOGGED: 3,
  BLOOD_TEST_ADDED: 20,
} as const;

/**
 * GamificationService
 * ────────────────────
 * Awards XP to users for completing health actions.
 * XP is stored directly on the User row for simplicity.
 */
export class GamificationService {
  private static get repo() {
    return AppDataSource.getRepository(User);
  }

  /**
   * Atomically increments the user's XP.
   * Returns the new total XP value.
   */
  static async awardXp(userId: string, amount: number): Promise<number> {
    await this.repo
      .createQueryBuilder()
      .update(User)
      .set({ xp: () => `xp + ${Math.abs(amount)}` })
      .where("id = :userId", { userId })
      .execute();

    const user = await this.repo.findOneBy({ id: userId });
    return user?.xp ?? 0;
  }

  /** Returns the current XP total for a user. */
  static async getXp(userId: string): Promise<number> {
    const user = await this.repo.findOneBy({ id: userId });
    return user?.xp ?? 0;
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
    const nextLevelXp = nextIdx < thresholds.length ? thresholds[nextIdx]!.xp : current.xp;

    return { level: current.level, title: current.title, nextLevelXp };
  }
}
