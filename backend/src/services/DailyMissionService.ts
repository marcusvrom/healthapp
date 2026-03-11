import { AppDataSource } from "../config/typeorm.config";
import { DailyMission, MissionType } from "../entities/DailyMission";
import { GamificationService } from "./GamificationService";

interface MissionTemplate {
  type:      MissionType;
  title:     string;
  xpReward:  number;
}

const MISSION_POOL: MissionTemplate[] = [
  { type: MissionType.WATER_GOAL,  title: "Bater a meta de água hoje",           xpReward: 20 },
  { type: MissionType.ALL_MEALS,   title: "Registrar todas as refeições do dia",  xpReward: 30 },
  { type: MissionType.ACTIVITY,    title: "Completar 30 min de atividade física", xpReward: 40 },
  { type: MissionType.WEIGHT_LOG,  title: "Registrar seu peso hoje",              xpReward: 15 },
  { type: MissionType.SLEEP_BLOCK, title: "Marcar seu bloco de sono completo",    xpReward: 20 },
];

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  // Deterministic Fisher-Yates using a simple LCG seeded by userId hash + date
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function dateSeed(userId: string, date: string): number {
  let h = 0;
  for (const ch of userId + date) {
    h = (Math.imul(31, h) + ch.charCodeAt(0)) | 0;
  }
  return h;
}

export class DailyMissionService {
  private static get repo() {
    return AppDataSource.getRepository(DailyMission);
  }

  /**
   * Returns today's 3 missions for a user, generating them if they don't exist yet.
   */
  static async getTodayMissions(userId: string): Promise<DailyMission[]> {
    const today = new Date().toISOString().slice(0, 10);

    const existing = await this.repo.find({
      where: { userId, date: today },
      order: { createdAt: "ASC" },
    });

    if (existing.length >= 3) return existing;

    // Generate deterministically so the same user always gets the same 3 missions
    const seed      = dateSeed(userId, today);
    const shuffled  = seededShuffle(MISSION_POOL, seed);
    const templates = shuffled.slice(0, 3);

    const missions = templates.map(t =>
      this.repo.create({ userId, date: today, title: t.title, xpReward: t.xpReward, missionType: t.type })
    );

    return this.repo.save(missions);
  }

  /**
   * Marks a mission as complete and awards XP (idempotent).
   * Returns the updated mission and new XP total.
   */
  static async completeMission(
    userId: string,
    missionId: string
  ): Promise<{ mission: DailyMission; xpGained: number; totalXp: number }> {
    const mission = await this.repo.findOneBy({ id: missionId, userId });
    if (!mission) throw Object.assign(new Error("Missão não encontrada"), { status: 404 });
    if (mission.isCompleted) return { mission, xpGained: 0, totalXp: await GamificationService.getXp(userId) };

    mission.isCompleted = true;
    mission.completedAt = new Date();
    await this.repo.save(mission);

    const totalXp = await GamificationService.awardXp(userId, mission.xpReward, "mission", mission.id);
    return { mission, xpGained: mission.xpReward, totalXp };
  }

  /**
   * Automatically checks and completes a mission by type for today.
   * Called from action endpoints (water, meals, exercise, weight, sleep)
   * when the user performs the corresponding action.
   * Safe to call multiple times — idempotent.
   */
  static async checkAndComplete(
    userId: string,
    missionType: MissionType
  ): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);

    const mission = await this.repo.findOneBy({
      userId,
      date: today,
      missionType,
      isCompleted: false,
    });

    if (!mission) return; // No pending mission of this type today

    mission.isCompleted = true;
    mission.completedAt = new Date();
    await this.repo.save(mission);

    await GamificationService.awardXp(userId, mission.xpReward, "mission", mission.id);
  }
}
