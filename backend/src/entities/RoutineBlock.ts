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
  SLEEP        = "sleep",
  WORK         = "work",
  EXERCISE     = "exercise",
  MEAL         = "meal",
  WATER        = "water",
  SUN_EXPOSURE = "sun_exposure",
  FREE         = "free",
  CUSTOM       = "custom",
  MEDICATION   = "medication",
  STUDY        = "study",
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
 * Represents a single time-block in a user's daily routine.
 * Blocks can be one-off (for a specific date) or recurring (weekly pattern).
 * Each block has a start/end time (HH:MM), a type and optional metadata.
 */
@Entity("routine_blocks")
export class RoutineBlock {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  /** ISO date string (YYYY-MM-DD) this block applies to (null for recurring-only blocks) */
  @Column({ name: "routine_date", type: "date", nullable: true })
  routineDate!: string;

  @Column({ type: "enum", enum: BlockType })
  type!: BlockType;

  /**
   * Whether this block repeats weekly.
   * When true, `daysOfWeek` defines which days it appears on.
   * When false, it only appears on the specific `routineDate`.
   */
  @Column({ name: "is_recurring", type: "boolean", default: false })
  isRecurring!: boolean;

  /**
   * Days of the week this block recurs on (0 = Sunday … 6 = Saturday).
   * Only meaningful when `isRecurring` is true.
   */
  @Column({ name: "days_of_week", type: "jsonb", default: "[]" })
  daysOfWeek!: number[];

  /** Start time as HH:MM */
  @Column({ name: "start_time", type: "text" })
  startTime!: string;

  /** End time as HH:MM */
  @Column({ name: "end_time", type: "text" })
  endTime!: string;

  /** Human-readable label shown in the UI */
  @Column({ type: "text" })
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
  @Column({ name: "sort_order", default: 0, type: "numeric" })
  sortOrder!: number;

  /**
   * Timestamp when the user marked this block as completed.
   * Null = not yet done.
   */
  @Column({ name: "completed_at", type: "timestamptz", nullable: true })
  completedAt?: Date;

  /** Prevents double-awarding XP if the block is toggled multiple times. */
  @Column({ name: "xp_awarded", type: "boolean", default: false })
  xpAwarded!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  // ── Relations ──────────────────────────────────────────────────────────────
  @ManyToOne(() => User, (user) => user.routineBlocks, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;
}
