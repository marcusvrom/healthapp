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

/**
 * A single recipe linked to a ScheduledMeal.
 * Stores an immutable snapshot of the recipe's per-serving nutrition so
 * historical records stay accurate even if the recipe is later edited.
 */
export interface LinkedRecipe {
  recipeId: string;
  title: string;
  kcalPerServing: number;
  proteinGPerServing: number;
  carbsGPerServing: number;
  fatGPerServing: number;
  /** Number of servings the user is eating (min 0.5) */
  servings: number;
}

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
 * A planned meal for a specific date, created manually by the user.
 * Can be one-off (specific date) or recurring (weekly pattern).
 * Marking as consumed awards XP via GamificationService.
 */
@Entity("scheduled_meals")
@Index("IDX_sched_meals_user_date", ["userId", "scheduledDate"])
export class ScheduledMeal {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({ name: "scheduled_date", type: "date", nullable: true })
  scheduledDate!: string;

  /**
   * Whether this meal repeats weekly.
   * When true, `daysOfWeek` defines which days it appears on.
   */
  @Column({ name: "is_recurring", type: "boolean", default: false })
  isRecurring!: boolean;

  /**
   * Days of the week this meal recurs on (0 = Sunday … 6 = Saturday).
   * Only meaningful when `isRecurring` is true.
   */
  @Column({ name: "days_of_week", type: "jsonb", default: "[]" })
  daysOfWeek!: number[];

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

  /**
   * Recipes the user has linked to this meal.
   * This is the single source of truth for recipe-based consumption.
   * Totals (kcal, macros) are derived by summing linkedRecipes × servings.
   */
  @Column({ name: "linked_recipes", type: "jsonb", nullable: true })
  linkedRecipes?: LinkedRecipe[];

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
