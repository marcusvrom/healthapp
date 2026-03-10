import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

export enum ClinicalCategory {
  SUPLEMENTO          = "SUPLEMENTO",
  REMEDIO_CONTROLADO  = "REMEDIO_CONTROLADO",
  TRT                 = "TRT",
  HORMONIO_FEMININO   = "HORMONIO_FEMININO",
  SONO                = "SONO",
}

/**
 * ClinicalProtocol
 * ─────────────────
 * Unified entity for medications, supplements and hormones.
 * daysOfWeek: [0-6] — Sunday=0, Saturday=6.
 */
@Entity("clinical_protocols")
@Index("IDX_clinical_protocols_user", ["userId"])
export class ClinicalProtocol {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "text" })
  userId!: string;

  @Column({ type: "text" })
  name!: string;

  /** Category stored as plain text (avoids PostgreSQL ENUM versioning) */
  @Column({ type: "text", default: ClinicalCategory.SUPLEMENTO })
  category!: ClinicalCategory;

  /** Dosage description: "20mg", "1 scoop", "0.5ml" */
  @Column({ type: "text" })
  dosage!: string;

  /** Base time this item is scheduled – HH:MM (24-h) */
  @Column({ name: "scheduled_time", type: "text" })
  scheduledTime!: string;

  /** Array of integers 0–6 (Sun–Sat) indicating which days to take */
  @Column({ name: "days_of_week", type: "jsonb", default: () => "'[0,1,2,3,4,5,6]'" })
  daysOfWeek!: number[];

  @Column({ type: "text", nullable: true })
  notes?: string;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
