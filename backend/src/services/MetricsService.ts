import { Repository } from "typeorm";
import { AppDataSource } from "../config/typeorm.config";
import { WeightLog } from "../entities/WeightLog";
import { HealthProfile } from "../entities/HealthProfile";
import { WaterService, WaterDayStats } from "./WaterService";
import { CalculationService } from "./CalculationService";

export interface WeightPoint { date: string; weightKg: number; }
export interface StreakData   { waterCurrentStreak: number; waterLongestStreak: number; }

export class MetricsService {
  private static get weightRepo(): Repository<WeightLog> {
    return AppDataSource.getRepository(WeightLog);
  }

  // ── Weight ─────────────────────────────────────────────────────────────────

  static async logWeight(userId: string, weightKg: number, recordedAt?: string, notes?: string): Promise<WeightLog> {
    const entry = this.weightRepo.create({
      userId,
      weightKg,
      recordedAt: recordedAt ?? new Date().toISOString().slice(0, 10),
      notes,
    });
    return this.weightRepo.save(entry);
  }

  /** Return up to `limit` weight points ordered oldest → newest (for charts) */
  static async weightHistory(userId: string, limit = 30): Promise<WeightPoint[]> {
    const logs = await this.weightRepo.find({
      where:  { userId },
      order:  { recordedAt: "ASC" },
      take:   limit,
    });
    return logs.map(l => ({ date: l.recordedAt, weightKg: Number(l.weightKg) }));
  }

  // ── Water ──────────────────────────────────────────────────────────────────

  /** 7-day water consistency for charts (consumed vs goal per day) */
  static async waterConsistency(userId: string, days = 7): Promise<WaterDayStats[]> {
    const goalMl = await this.resolveWaterGoal(userId);
    return WaterService.getHistory(userId, goalMl, days);
  }

  // ── Streaks ────────────────────────────────────────────────────────────────

  static async streaks(userId: string): Promise<StreakData> {
    const goalMl = await this.resolveWaterGoal(userId);
    const { currentStreak, longestStreak } = await WaterService.streaks(userId, goalMl);
    return {
      waterCurrentStreak: currentStreak,
      waterLongestStreak: longestStreak,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Pull water goal from the user's HealthProfile, fall back to 2000 ml */
  private static async resolveWaterGoal(userId: string): Promise<number> {
    try {
      const profile = await AppDataSource.getRepository(HealthProfile).findOneBy({ userId });
      if (!profile) return 2000;
      const result = CalculationService.computeMetabolicResult(
        Number(profile.weight), Number(profile.height),
        profile.age, profile.gender, profile.activityFactor, []
      );
      return result.waterMlTotal ?? 2000;
    } catch {
      return 2000;
    }
  }
}
