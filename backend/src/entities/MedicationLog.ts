import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./User";
import { Medication } from "./Medication";

/**
 * MedicationLog
 * ─────────────
 * One row = one instance of the user confirming they took a medication.
 * Unique per (user, medication, date) – prevents double-logging.
 * XP is awarded once per entry via GamificationService.
 */
@Entity("medication_logs")
@Index("IDX_med_logs_user_date", ["userId", "takenDate"])
@Index("IDX_med_logs_med_date",  ["medicationId", "takenDate"], { unique: true })
export class MedicationLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "text" })
  userId!: string;

  @Column({ name: "medication_id", type: "text" })
  medicationId!: string;

  @Column({ name: "taken_date", type: "date" })
  takenDate!: string;

  @Column({ name: "taken_at", type: "timestamptz" })
  takenAt!: Date;

  @Column({ name: "xp_awarded", type: "boolean", default: false })
  xpAwarded!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @ManyToOne(() => Medication, { onDelete: "CASCADE" })
  @JoinColumn({ name: "medication_id" })
  medication!: Medication;
}
