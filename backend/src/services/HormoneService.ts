import { Repository } from "typeorm";
import { AppDataSource } from "../config/typeorm.config";
import { HormoneLog, HormoneCategory } from "../entities/HormoneLog";

export interface LogHormoneDto {
  category:       HormoneCategory;
  name:           string;
  dosage:         number;
  unit:           string;
  administeredAt: string; // ISO string
  notes?:         string;
}

export interface LatestPerCategory {
  category:   HormoneCategory;
  lastLog:    HormoneLog | null;
}

export class HormoneService {
  private static get repo(): Repository<HormoneLog> {
    return AppDataSource.getRepository(HormoneLog);
  }

  /** Create a new administration record */
  static async log(userId: string, dto: LogHormoneDto): Promise<HormoneLog> {
    const entry = this.repo.create({
      userId,
      category:       dto.category,
      name:           dto.name.trim(),
      dosage:         dto.dosage,
      unit:           dto.unit.trim(),
      administeredAt: new Date(dto.administeredAt),
      notes:          dto.notes?.trim(),
    });
    return this.repo.save(entry);
  }

  /**
   * List hormone logs for a user.
   * Optional filters: category, page-based pagination.
   */
  static async list(
    userId: string,
    opts: { category?: HormoneCategory; page?: number; pageSize?: number } = {}
  ): Promise<{ data: HormoneLog[]; total: number }> {
    const { category, page = 1, pageSize = 30 } = opts;

    const qb = this.repo
      .createQueryBuilder("hl")
      .where("hl.user_id = :userId", { userId })
      .orderBy("hl.administered_at", "DESC")
      .take(pageSize)
      .skip((page - 1) * pageSize);

    if (category) qb.andWhere("hl.category = :category", { category });

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  /**
   * Returns the most recent log for every category the user has used.
   * Useful for the "last dose" summary cards.
   */
  static async latestPerCategory(userId: string): Promise<LatestPerCategory[]> {
    const categories = Object.values(HormoneCategory);
    const result: LatestPerCategory[] = [];

    for (const category of categories) {
      const lastLog = await this.repo.findOne({
        where: { userId, category },
        order: { administeredAt: "DESC" },
      });
      if (lastLog) result.push({ category, lastLog });
    }

    return result;
  }

  /** Update notes on an existing log */
  static async update(
    id: string,
    userId: string,
    dto: Partial<Pick<LogHormoneDto, "dosage" | "notes" | "administeredAt">>
  ): Promise<HormoneLog> {
    const entry = await this.repo.findOneBy({ id, userId });
    if (!entry) throw Object.assign(new Error("Registro não encontrado."), { statusCode: 404 });

    if (dto.dosage)         entry.dosage         = dto.dosage;
    if (dto.notes != null)  entry.notes          = dto.notes;
    if (dto.administeredAt) entry.administeredAt = new Date(dto.administeredAt);

    return this.repo.save(entry);
  }

  /** Hard delete a single log entry */
  static async remove(id: string, userId: string): Promise<void> {
    const r = await this.repo.delete({ id, userId });
    if (r.affected === 0) {
      throw Object.assign(new Error("Registro não encontrado."), { statusCode: 404 });
    }
  }
}
