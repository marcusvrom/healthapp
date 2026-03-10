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

/**
 * WeightLog
 * ──────────
 * Immutable time-series of body-weight measurements.
 * Each entry is a snapshot; the latest is used as the "current weight"
 * in metabolic calculations. The full series powers the progress chart.
 */
@Entity("weight_logs")
@Index("IDX_weight_logs_user_date", ["userId", "recordedAt"])
export class WeightLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({ name: "weight_kg", type: "numeric", precision: 5, scale: 2 })
  weightKg!: number;

  /** Date of measurement (YYYY-MM-DD) */
  @Column({ name: "recorded_at", type: "date" })
  recordedAt!: string;

  @Column({ type: "text", nullable: true })
  notes?: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;
}
