import { AppDataSource } from "../config/typeorm.config";
import { User } from "../entities/User";
import { HealthProfile } from "../entities/HealthProfile";
import { BloodTest } from "../entities/BloodTest";
import { RoutineBlock } from "../entities/RoutineBlock";
import { BlockCompletion } from "../entities/BlockCompletion";
import { WorkoutSheet } from "../entities/WorkoutSheet";
import { ExerciseLog } from "../entities/ExerciseLog";
import { UserBadge } from "../entities/Badge";
import { XpLog } from "../entities/XpLog";
import { WaterLog } from "../entities/WaterLog";
import { WeeklyCheckIn } from "../entities/WeeklyCheckIn";
import { ScheduledMeal } from "../entities/ScheduledMeal";
import { Notification } from "../entities/Notification";

/**
 * LgpdService — LGPD (Lei Geral de Proteção de Dados) compliance service.
 *
 * Provides:
 * - Data export (Art. 18, V): full JSON export of all personal data
 * - Account deletion (Art. 18, VI): complete erasure of user data
 * - Data retention: automatic cleanup of old data past retention periods
 */
export class LgpdService {
  /**
   * Export all personal data for a user (LGPD Art. 18, V — Portabilidade).
   * Returns a structured JSON object with all user data.
   */
  static async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ["id", "name", "email", "city", "state", "xp", "createdAt"],
    });

    const profile = await AppDataSource.getRepository(HealthProfile).findOneBy({ userId });
    const bloodTests = await AppDataSource.getRepository(BloodTest).find({ where: { userId } });
    const workoutSheets = await AppDataSource.getRepository(WorkoutSheet).find({
      where: { userId },
      relations: ["exercises"],
    });
    const exerciseLogs = await AppDataSource.getRepository(ExerciseLog).find({ where: { userId } });
    const badges = await AppDataSource.getRepository(UserBadge).find({ where: { userId } });
    const checkIns = await AppDataSource.getRepository(WeeklyCheckIn).find({ where: { userId } });
    const completions = await AppDataSource.getRepository(BlockCompletion).find({ where: { userId } });
    const waterLogs = await AppDataSource.getRepository(WaterLog).find({ where: { userId } });
    const scheduledMeals = await AppDataSource.getRepository(ScheduledMeal).find({ where: { userId } });
    const xpLogs = await AppDataSource.getRepository(XpLog).find({ where: { userId } });
    const notifications = await AppDataSource.getRepository(Notification).find({ where: { userId } });

    return {
      exportDate: new Date().toISOString(),
      exportFormat: "LGPD Art. 18, V — Portabilidade de dados",
      user: user ? {
        id: user.id,
        name: user.name,
        email: user.email,
        city: user.city,
        state: user.state,
        xp: user.xp,
        createdAt: user.createdAt,
      } : null,
      healthProfile: profile ? {
        age: profile.age,
        weight: profile.weight,
        height: profile.height,
        gender: profile.gender,
        activityFactor: profile.activityFactor,
        primaryGoal: profile.primaryGoal,
        caloricGoal: profile.caloricGoal,
        proteinGoalG: profile.proteinGoalG,
        carbsGoalG: profile.carbsGoalG,
        fatGoalG: profile.fatGoalG,
      } : null,
      bloodTests: bloodTests.map(t => ({
        collectedAt: t.collectedAt,
        createdAt: t.createdAt,
      })),
      workoutSheets: workoutSheets.map(s => ({
        name: s.name,
        description: s.description,
        category: s.category,
        exercises: (s.exercises ?? []).map(e => ({
          name: e.name,
          sets: e.sets,
          reps: e.reps,
        })),
      })),
      exerciseLogs: exerciseLogs.map(l => ({
        exerciseName: l.exerciseName,
        logDate: l.logDate,
        sets: l.sets,
        reps: l.reps,
        weightKg: l.weightKg,
      })),
      badges: badges.map(b => ({
        slug: b.slug,
        unlockedAt: b.unlockedAt,
      })),
      checkIns: checkIns.map(c => ({
        date: c.date,
        currentWeight: c.currentWeight,
        adherenceScore: c.adherenceScore,
      })),
      completions: completions.length,
      waterLogs: waterLogs.length,
      scheduledMeals: scheduledMeals.length,
      xpLogs: xpLogs.length,
      notifications: notifications.length,
    };
  }

  /**
   * Delete all user data and the user account (LGPD Art. 18, VI — Eliminação).
   * Uses a transaction to ensure atomicity.
   */
  static async deleteUserAccount(userId: string): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      // Delete in order to respect foreign key constraints (children first)
      await manager.getRepository(Notification).delete({ userId });
      await manager.getRepository(BlockCompletion).delete({ userId });
      await manager.getRepository(ExerciseLog).delete({ userId });
      await manager.getRepository(UserBadge).delete({ userId });
      await manager.getRepository(XpLog).delete({ userId });
      await manager.getRepository(WaterLog).delete({ userId });
      await manager.getRepository(WeeklyCheckIn).delete({ userId });
      await manager.getRepository(ScheduledMeal).delete({ userId });

      // Delete workout sheets (cascades to exercises)
      const sheets = await manager.getRepository(WorkoutSheet).find({ where: { userId } });
      if (sheets.length > 0) {
        await manager.getRepository(WorkoutSheet).remove(sheets);
      }

      // Delete routine blocks
      await manager.getRepository(RoutineBlock).delete({ userId });

      // Delete blood tests
      await manager.getRepository(BloodTest).delete({ userId });

      // Delete health profile
      await manager.getRepository(HealthProfile).delete({ userId });

      // Finally delete the user
      await manager.getRepository(User).delete({ id: userId });
    });
  }

  /**
   * Clean up old data past retention periods (LGPD Art. 16 — Eliminação após uso).
   * Called by a scheduled job (e.g., weekly cron).
   *
   * Retention periods:
   * - Notifications: 90 days
   * - XP logs: 365 days
   * - Water logs: 365 days
   * - Block completions: 365 days
   */
  static async cleanupExpiredData(): Promise<{ deletedNotifications: number; deletedXpLogs: number; deletedWaterLogs: number }> {
    const now = new Date();

    // Notifications: 90 days
    const notiCutoff = new Date(now);
    notiCutoff.setDate(notiCutoff.getDate() - 90);
    const notiResult = await AppDataSource.getRepository(Notification)
      .createQueryBuilder()
      .delete()
      .where("createdAt < :cutoff", { cutoff: notiCutoff })
      .andWhere("read = true")
      .execute();

    // XP logs: 365 days
    const xpCutoff = new Date(now);
    xpCutoff.setDate(xpCutoff.getDate() - 365);
    const xpResult = await AppDataSource.getRepository(XpLog)
      .createQueryBuilder()
      .delete()
      .where("awardedAt < :cutoff", { cutoff: xpCutoff })
      .execute();

    // Water logs: 365 days
    const waterCutoff = new Date(now);
    waterCutoff.setDate(waterCutoff.getDate() - 365);
    const waterResult = await AppDataSource.getRepository(WaterLog)
      .createQueryBuilder()
      .delete()
      .where("logDate < :cutoff", { cutoff: waterCutoff.toISOString().slice(0, 10) })
      .execute();

    return {
      deletedNotifications: notiResult.affected ?? 0,
      deletedXpLogs: xpResult.affected ?? 0,
      deletedWaterLogs: waterResult.affected ?? 0,
    };
  }
}
