import { Between, Repository } from "typeorm";
import { AppDataSource } from "../config/typeorm.config";
import { WaterLog } from "../entities/WaterLog";

export interface AddWaterDto {
  quantityMl: number;
  loggedAt?: string; // ISO string; defaults to now()
}

export interface WaterDayStats {
  date: string; // YYYY-MM-DD
  consumedMl: number;
  goalMl: number;
  metGoal: boolean;
  logs: Array<{ id: string; quantityMl: number; loggedAt: Date }>;
}

export class WaterService {
  private static get repo(): Repository<WaterLog> {
    return AppDataSource.getRepository(WaterLog);
  }

  /** Add a water intake log entry */
  static async add(userId: string, dto: AddWaterDto): Promise<WaterLog> {
    const entry = this.repo.create({
      userId,
      quantityMl: dto.quantityMl,
      loggedAt:   dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
    });
    return this.repo.save(entry);
  }

  /** Get all logs for a specific date (defaults to today) */
  static async getDay(userId: string, date?: string): Promise<{ logs: WaterLog[]; totalMl: number }> {
    const d   = date ?? new Date().toISOString().slice(0, 10);
    const from = new Date(`${d}T00:00:00.000Z`);
    const to   = new Date(`${d}T23:59:59.999Z`);

    const logs = await this.repo.find({
      where: { userId, loggedAt: Between(from, to) },
      order: { loggedAt: "ASC" },
    });

    return {
      logs,
      totalMl: logs.reduce((s, l) => s + l.quantityMl, 0),
    };
  }

  /**
   * Hydration consistency for the last N days.
   * goalMl comes from the caller (MetabolicResult.waterMlTotal or a fallback).
   */
  static async getHistory(
    userId: string,
    goalMl: number,
    days = 7
  ): Promise<WaterDayStats[]> {
    const result: WaterDayStats[] = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d   = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const { logs, totalMl } = await this.getDay(userId, dateStr);

      result.push({
        date:       dateStr,
        consumedMl: totalMl,
        goalMl,
        metGoal:    totalMl >= goalMl,
        logs: logs.map(l => ({ id: l.id, quantityMl: l.quantityMl, loggedAt: l.loggedAt })),
      });
    }

    return result;
  }

  /** Delete a single log entry (user must own it) */
  static async remove(id: string, userId: string): Promise<void> {
    const r = await this.repo.delete({ id, userId });
    if (r.affected === 0) {
      throw Object.assign(new Error("Registro não encontrado."), { statusCode: 404 });
    }
  }

  /**
   * Calculate streak (consecutive days meeting the goal).
   * Returns { currentStreak, longestStreak }.
   */
  static async streaks(userId: string, goalMl: number): Promise<{ currentStreak: number; longestStreak: number }> {
    const history = await this.getHistory(userId, goalMl, 30);
    // Reverse so index-0 is today
    const days = [...history].reverse();

    let current = 0;
    for (const d of days) {
      if (d.metGoal) current++;
      else break;
    }

    let longest = 0;
    let run = 0;
    for (const d of history) {
      run = d.metGoal ? run + 1 : 0;
      if (run > longest) longest = run;
    }

    return { currentStreak: current, longestStreak: longest };
  }
}
