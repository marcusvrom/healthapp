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

export interface ScheduledFoodItem {
  name: string;
  quantityG: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/**
 * ScheduledMeal
 * ─────────────
 * A planned meal for a specific date. Generated from the user's caloric
 * goals and routine times, or created manually.
 * Marking as consumed awards XP via GamificationService.
 */
@Entity("scheduled_meals")
@Index("IDX_sched_meals_user_date", ["userId", "scheduledDate"])
export class ScheduledMeal {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "text" })
  userId!: string;

  @Column({ name: "scheduled_date", type: "date" })
  scheduledDate!: string;

  /** e.g. "Café da Manhã", "Almoço" */
  @Column({ type: "text" })
  name!: string;

  /** HH:MM format */
  @Column({ name: "scheduled_time", type: "text" })
  scheduledTime!: string;

  @Column({ name: "caloric_target", type: "numeric", precision: 7, scale: 2, nullable: true })
  caloricTarget?: number;

  @Column({ name: "protein_g", type: "numeric", precision: 6, scale: 2, nullable: true })
  proteinG?: number;

  @Column({ name: "carbs_g", type: "numeric", precision: 6, scale: 2, nullable: true })
  carbsG?: number;

  @Column({ name: "fat_g", type: "numeric", precision: 6, scale: 2, nullable: true })
  fatG?: number;

  /** Suggested foods/quantities as a JSON array */
  @Column({ type: "jsonb", nullable: true })
  foods?: ScheduledFoodItem[];

  @Column({ name: "is_consumed", type: "boolean", default: false })
  isConsumed!: boolean;

  @Column({ name: "consumed_at", type: "timestamptz", nullable: true })
  consumedAt?: Date;

  /** Prevents double-awarding XP if toggle is called multiple times */
  @Column({ name: "xp_awarded", type: "boolean", default: false })
  xpAwarded!: boolean;

  @Column({ type: "text", nullable: true })
  notes?: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;
}
