import { Repository } from "typeorm";
import { AppDataSource } from "../config/typeorm.config";
import { Medication, MedicationType } from "../entities/Medication";
import { MedicationLog } from "../entities/MedicationLog";
import { GamificationService, XP_REWARDS } from "./GamificationService";

export interface CreateMedicationDto {
  name: string;
  type?: MedicationType;
  dosage: string;
  scheduledTime: string;
  notes?: string;
}

export interface UpdateMedicationDto {
  name?: string;
  type?: MedicationType;
  dosage?: string;
  scheduledTime?: string;
  notes?: string;
  isActive?: boolean;
}

export class MedicationService {
  private static get repo(): Repository<Medication> {
    return AppDataSource.getRepository(Medication);
  }
  private static get logRepo(): Repository<MedicationLog> {
    return AppDataSource.getRepository(MedicationLog);
  }

  static async list(userId: string, activeOnly = true): Promise<Medication[]> {
    const where = activeOnly ? { userId, isActive: true } : { userId };
    return this.repo.find({ where, order: { scheduledTime: "ASC" } });
  }

  static async create(userId: string, dto: CreateMedicationDto): Promise<Medication> {
    const med = this.repo.create({
      userId,
      name: dto.name.trim(),
      type: dto.type ?? MedicationType.SUPLEMENTO,
      dosage: dto.dosage.trim(),
      scheduledTime: dto.scheduledTime,
      notes: dto.notes?.trim(),
      isActive: true,
    });
    return this.repo.save(med);
  }

  static async update(id: string, userId: string, dto: UpdateMedicationDto): Promise<Medication> {
    const med = await this.repo.findOneBy({ id, userId });
    if (!med) throw Object.assign(new Error("Medicação não encontrada."), { statusCode: 404 });
    if (dto.name        !== undefined) med.name          = dto.name.trim();
    if (dto.type        !== undefined) med.type          = dto.type;
    if (dto.dosage      !== undefined) med.dosage        = dto.dosage.trim();
    if (dto.scheduledTime !== undefined) med.scheduledTime = dto.scheduledTime;
    if (dto.notes       !== undefined) med.notes         = dto.notes?.trim();
    if (dto.isActive    !== undefined) med.isActive      = dto.isActive;
    return this.repo.save(med);
  }

  static async remove(id: string, userId: string): Promise<void> {
    const r = await this.repo.delete({ id, userId });
    if (r.affected === 0) throw Object.assign(new Error("Medicação não encontrada."), { statusCode: 404 });
  }

  /** Returns logs for a list of medicationIds on a specific date */
  static async logsForDate(userId: string, date: string): Promise<MedicationLog[]> {
    return this.logRepo.find({ where: { userId, takenDate: date } });
  }

  /**
   * Toggle taken/not-taken for a medication on a given date.
   * Awards XP once on first toggle to taken.
   */
  static async toggle(
    medicationId: string,
    userId: string,
    date?: string
  ): Promise<{ taken: boolean; xpGained: number; totalXp: number }> {
    const d = date ?? new Date().toISOString().slice(0, 10);

    const med = await this.repo.findOneBy({ id: medicationId, userId });
    if (!med) throw Object.assign(new Error("Medicação não encontrada."), { statusCode: 404 });

    const existing = await this.logRepo.findOne({
      where: { medicationId, userId, takenDate: d },
    });

    if (existing) {
      // Un-take: delete the log (XP is NOT reversed)
      await this.logRepo.delete({ id: existing.id });
      return { taken: false, xpGained: 0, totalXp: await GamificationService.getXp(userId) };
    }

    // Take: create log + award XP
    const log = this.logRepo.create({
      userId,
      medicationId,
      takenDate: d,
      takenAt: new Date(),
      xpAwarded: true,
    });
    await this.logRepo.save(log);

    const totalXp = await GamificationService.awardXp(userId, XP_REWARDS.MEDICATION_TAKEN, "medication");
    return { taken: true, xpGained: XP_REWARDS.MEDICATION_TAKEN, totalXp };
  }
}
