import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./User";

export enum MedicationType {
  SUPLEMENTO          = "SUPLEMENTO",
  VITAMINA            = "VITAMINA",
  REMEDIO_CONTROLADO  = "REMEDIO_CONTROLADO",
  TRT                 = "TRT",
}

/**
 * Medication / Supplement
 * ────────────────────────
 * Represents a recurring daily medication or supplement the user takes.
 * The scheduledTime determines where it appears in the daily timeline.
 * Actual consumption is tracked via MedicationLog.
 */
@Entity("medications")
@Index("IDX_medications_user", ["userId"])
export class Medication {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "text" })
  userId!: string;

  @Column({ type: "text" })
  name!: string;

  /** Category for grouping and XP logic */
  @Column({ type: "text", default: MedicationType.SUPLEMENTO })
  type!: MedicationType;

  /** Human-readable dosage, e.g. "20mg", "1 scoop", "2 cápsulas" */
  @Column({ type: "text" })
  dosage!: string;

  /** HH:MM – daily time this should be taken */
  @Column({ name: "scheduled_time", type: "text" })
  scheduledTime!: string;

  @Column({ type: "text", nullable: true })
  notes?: string;

  /** Set to false to hide from timeline without deleting history */
  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;
}
