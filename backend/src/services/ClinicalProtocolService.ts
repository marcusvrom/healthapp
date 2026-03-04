import { AppDataSource } from "../config/typeorm.config";
import { ClinicalProtocol } from "../entities/ClinicalProtocol";
import { ClinicalProtocolLog } from "../entities/ClinicalProtocolLog";
import { GamificationService, XP_REWARDS } from "./GamificationService";

const repo    = () => AppDataSource.getRepository(ClinicalProtocol);
const logRepo = () => AppDataSource.getRepository(ClinicalProtocolLog);

export interface ClinicalProtocolWithLog extends ClinicalProtocol {
  log?: ClinicalProtocolLog;
}

export class ClinicalProtocolService {

  /** List all protocols for the user (active only by default) */
  static async list(userId: string, includeInactive = false): Promise<ClinicalProtocol[]> {
    const where: Record<string, unknown> = { userId };
    if (!includeInactive) where["isActive"] = true;
    return repo().find({ where, order: { scheduledTime: "ASC" } });
  }

  /** Create a new protocol */
  static async create(userId: string, dto: Partial<ClinicalProtocol>): Promise<ClinicalProtocol> {
    const entity = repo().create({ ...dto, userId });
    return repo().save(entity);
  }

  /** Update an existing protocol (ownership checked) */
  static async update(id: string, userId: string, dto: Partial<ClinicalProtocol>): Promise<ClinicalProtocol> {
    const existing = await repo().findOneBy({ id, userId });
    if (!existing) throw Object.assign(new Error("Protocolo não encontrado."), { statusCode: 404 });
    Object.assign(existing, dto);
    return repo().save(existing);
  }

  /** Soft-delete (or hard-delete) a protocol */
  static async remove(id: string, userId: string): Promise<void> {
    const existing = await repo().findOneBy({ id, userId });
    if (!existing) throw Object.assign(new Error("Protocolo não encontrado."), { statusCode: 404 });
    await repo().delete({ id });
  }

  /**
   * Returns all active protocols for the user on the given date,
   * each enriched with its log entry for that day (if any).
   */
  static async logsForDate(userId: string, date: string): Promise<ClinicalProtocolWithLog[]> {
    const protocols = await repo().find({
      where: { userId, isActive: true },
      order: { scheduledTime: "ASC" },
    });

    // Filter by dayOfWeek
    const dow = new Date(date + "T12:00:00").getDay();
    const forDay = protocols.filter(p =>
      !p.daysOfWeek || p.daysOfWeek.length === 0 || p.daysOfWeek.includes(dow)
    );

    // Fetch logs for this date
    const logs = await logRepo().find({ where: { userId, takenDate: date } });
    const logMap = new Map(logs.map(l => [l.protocolId, l]));

    return forDay.map(p => ({ ...p, log: logMap.get(p.id) }));
  }

  /**
   * Returns active protocols scheduled for the given date (for routine injection).
   * Does NOT include logs — used by the RoutineGeneratorService.
   */
  static async forDay(userId: string, date: string): Promise<ClinicalProtocol[]> {
    const dow = new Date(date + "T12:00:00").getDay();
    const all = await repo().find({ where: { userId, isActive: true }, order: { scheduledTime: "ASC" } });
    return all.filter(p => !p.daysOfWeek || p.daysOfWeek.length === 0 || p.daysOfWeek.includes(dow));
  }

  /**
   * Toggle the taken status for a protocol on a given date.
   * Awards +5 XP when marking as taken.
   */
  static async toggle(protocolId: string, userId: string, date?: string): Promise<{
    taken: boolean; xpGained: number; totalXp: number;
  }> {
    const d = date ?? new Date().toISOString().slice(0, 10);
    const existing = await logRepo().findOne({ where: { protocolId, userId, takenDate: d } });

    const totalXp = await GamificationService.getXp(userId);

    if (existing) {
      await logRepo().delete({ id: existing.id });
      return { taken: false, xpGained: 0, totalXp };
    }

    await logRepo().save(logRepo().create({
      userId,
      protocolId,
      takenDate: d,
      takenAt: new Date(),
      xpAwarded: true,
    }));
    const newTotalXp = await GamificationService.awardXp(userId, XP_REWARDS.MEDICATION_TAKEN);
    return { taken: true, xpGained: XP_REWARDS.MEDICATION_TAKEN, totalXp: newTotalXp };
  }
}
