import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User";

export enum BlockType {
  SLEEP = "sleep",
  WORK = "work",
  EXERCISE = "exercise",
  MEAL = "meal",
  WATER = "water",
  SUN_EXPOSURE = "sun_exposure",
  FREE = "free",
  CUSTOM = "custom",
}

export enum MealType {
  BREAKFAST = "breakfast",
  MORNING_SNACK = "morning_snack",
  LUNCH = "lunch",
  AFTERNOON_SNACK = "afternoon_snack",
  PRE_WORKOUT = "pre_workout",
  POST_WORKOUT = "post_workout",
  DINNER = "dinner",
  SUPPER = "supper",
}

/**
 * Represents a single time-block in a user's generated daily routine.
 * Each block has a start/end time (HH:MM), a type and optional metadata.
 */
@Entity("routine_blocks")
export class RoutineBlock {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id" })
  userId!: string;

  /** ISO date string (YYYY-MM-DD) this block applies to */
  @Column({ name: "routine_date", type: "date" })
  routineDate!: string;

  @Column({ type: "enum", enum: BlockType })
  type!: BlockType;

  /** Start time as HH:MM */
  @Column({ name: "start_time", length: 5 })
  startTime!: string;

  /** End time as HH:MM */
  @Column({ name: "end_time", length: 5 })
  endTime!: string;

  /** Human-readable label shown in the UI */
  @Column({ length: 255 })
  label!: string;

  /**
   * For MEAL blocks: which meal it represents.
   * For EXERCISE blocks: the exercise id.
   * For WATER blocks: ml to drink.
   */
  @Column({ type: "enum", enum: MealType, name: "meal_type", nullable: true })
  mealType?: MealType;

  /** Caloric target for this block (kcal) */
  @Column({
    name: "caloric_target",
    type: "numeric",
    precision: 7,
    scale: 2,
    nullable: true,
  })
  caloricTarget?: number;

  /** Water volume for this block (ml) */
  @Column({
    name: "water_ml",
    type: "numeric",
    precision: 6,
    scale: 2,
    nullable: true,
  })
  waterMl?: number;

  /** Arbitrary metadata (exercise id, suggestions, etc.) */
  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, unknown>;

  /** Sort order within the day */
  @Column({ name: "sort_order", default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  // ── Relations ──────────────────────────────────────────────────────────────
  @ManyToOne(() => User, (user) => user.routineBlocks, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;
}
