import { AppDataSource } from "../config/typeorm.config";
import { User } from "../entities/User";
import { HealthProfile, PrimaryGoal } from "../entities/HealthProfile";
import { DailyMission } from "../entities/DailyMission";
import { GamificationService } from "../services/GamificationService";

// ─── DTO ─────────────────────────────────────────────────────────────────────

/** Safe public-facing user profile — never exposes PII or health data. */
export interface PublicProfileDto {
  id:                     string;
  name:                   string;
  avatarUrl:              string | null;
  city:                   string | null;
  state:                  string | null;
  level:                  number;
  levelTitle:             string;
  xp:                     number;
  totalMissionsCompleted: number;
  primaryGoal:            PrimaryGoal | null;
  primaryGoalLabel:       string | null;
}

// ─── Goal labels (human-readable) ────────────────────────────────────────────

const GOAL_LABELS: Record<PrimaryGoal, string> = {
  [PrimaryGoal.EMAGRECIMENTO]: "Focado em Emagrecimento",
  [PrimaryGoal.GANHO_MASSA]:   "Focado em Hipertrofia",
  [PrimaryGoal.MANUTENCAO]:    "Manutenção do Peso",
  [PrimaryGoal.SAUDE_GERAL]:   "Saúde Geral",
  [PrimaryGoal.DIABETICO]:     "Controle Glicêmico",
};

// ─── Single mapper ────────────────────────────────────────────────────────────

/**
 * Converts a single User entity to its safe public representation.
 * Runs two extra DB queries (health_profile + missions count).
 */
export async function toPublicProfile(user: User): Promise<PublicProfileDto> {
  const { level, title } = GamificationService.levelFromXp(user.xp);

  const [profile, totalMissionsCompleted] = await Promise.all([
    AppDataSource.getRepository(HealthProfile).findOne({
      where: { userId: user.id },
      select: ["primaryGoal"],
    }),
    AppDataSource.getRepository(DailyMission).count({
      where: { userId: user.id, isCompleted: true },
    }),
  ]);

  const primaryGoal = profile?.primaryGoal ?? null;

  return {
    id:                     user.id,
    name:                   user.name,
    avatarUrl:              user.avatarUrl ?? null,
    city:                   user.city ?? null,
    state:                  user.state ?? null,
    level,
    levelTitle:             title,
    xp:                     user.xp,
    totalMissionsCompleted,
    primaryGoal,
    primaryGoalLabel:       primaryGoal ? (GOAL_LABELS[primaryGoal] ?? null) : null,
  };
}

// ─── Batch mapper ─────────────────────────────────────────────────────────────

/**
 * Efficiently converts multiple User entities to public profiles.
 * Uses two batched DB queries instead of N×2 individual ones.
 */
export async function toPublicProfileBatch(users: User[]): Promise<PublicProfileDto[]> {
  if (!users.length) return [];

  const ids = users.map(u => u.id);

  const [profiles, missionCounts] = await Promise.all([
    AppDataSource.getRepository(HealthProfile)
      .createQueryBuilder("hp")
      .select(["hp.userId", "hp.primaryGoal"])
      .where("hp.user_id IN (:...ids)", { ids })
      .getMany(),
    AppDataSource.getRepository(DailyMission)
      .createQueryBuilder("m")
      .select("m.user_id", "userId")
      .addSelect("COUNT(*)", "count")
      .where("m.user_id IN (:...ids)", { ids })
      .andWhere("m.is_completed = true")
      .groupBy("m.user_id")
      .getRawMany<{ userId: string; count: string }>(),
  ]);

  const profileMap  = new Map(profiles.map(p => [p.userId, p.primaryGoal]));
  const missionMap  = new Map(missionCounts.map(r => [r.userId, parseInt(r.count, 10)]));

  return users.map(u => {
    const { level, title } = GamificationService.levelFromXp(u.xp);
    const primaryGoal = profileMap.get(u.id) ?? null;
    return {
      id:                     u.id,
      name:                   u.name,
      avatarUrl:              u.avatarUrl ?? null,
      city:                   u.city ?? null,
      state:                  u.state ?? null,
      level,
      levelTitle:             title,
      xp:                     u.xp,
      totalMissionsCompleted: missionMap.get(u.id) ?? 0,
      primaryGoal,
      primaryGoalLabel:       primaryGoal ? (GOAL_LABELS[primaryGoal] ?? null) : null,
    };
  });
}
