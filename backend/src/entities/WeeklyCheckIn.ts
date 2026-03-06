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
 * WeeklyCheckIn
 * ─────────────
 * One entry per week per user — records current body metrics and
 * subjective plan adherence. Consumed by the CopilotService to detect
 * metabolic adaptation (stagnation) and generate personalised insights.
 */
@Entity("weekly_check_ins")
@Index("IDX_weekly_check_ins_user_date", ["userId", "date"])
export class WeeklyCheckIn {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  /** ISO date string of the check-in day (YYYY-MM-DD) */
  @Column({ type: "date" })
  date!: string;

  /** Body weight at the time of check-in (kg) */
  @Column({ name: "current_weight", type: "numeric", precision: 5, scale: 2 })
  currentWeight!: number;

  /** Optional waist circumference in centimetres */
  @Column({ name: "waist_circumference", type: "numeric", precision: 5, scale: 1, nullable: true })
  waistCircumference?: number;

  /**
   * How well the user followed the diet plan this week.
   * 1 = very poorly … 5 = perfectly.
   */
  @Column({ name: "adherence_score", type: "smallint" })
  adherenceScore!: number;

  @Column({ type: "text", nullable: true })
  notes?: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;
}
