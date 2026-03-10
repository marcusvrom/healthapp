import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from "typeorm";
import { User } from "./User";

/**
 * RecipeSchedule
 * ─────────────
 * Defines a recurring recipe that should be auto-linked to a specific
 * named meal on selected days of the week.
 *
 * Example: "Link Omelete de Espinafre to 'Café da Manhã' every Mon/Wed/Fri"
 *
 * Unique per (userId, mealName, recipeId) — upsert by this composite key.
 */
@Entity("recipe_schedules")
@Index("IDX_recipe_schedules_user", ["userId"])
@Unique("UQ_recipe_schedule_user_meal_recipe", ["userId", "mealName", "recipeId"])
export class RecipeSchedule {
  @PrimaryGeneratedColumn("text")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  /** Matches ScheduledMeal.name exactly (e.g. "Café da Manhã") */
  @Column({ name: "meal_name", type: "text" })
  mealName!: string;

  @Column({ name: "recipe_id", type: "text" })
  recipeId!: string;

  /** Snapshot of recipe title at schedule-creation time */
  @Column({ type: "text" })
  title!: string;

  /** Nutrition snapshot — so schedule stays accurate if recipe is edited */
  @Column({ name: "kcal_per_serving", type: "numeric", precision: 7, scale: 2 })
  kcalPerServing!: number;

  @Column({ name: "protein_g_per_serving", type: "numeric", precision: 6, scale: 2 })
  proteinGPerServing!: number;

  @Column({ name: "carbs_g_per_serving", type: "numeric", precision: 6, scale: 2 })
  carbsGPerServing!: number;

  @Column({ name: "fat_g_per_serving", type: "numeric", precision: 6, scale: 2 })
  fatGPerServing!: number;

  @Column({ type: "numeric", precision: 5, scale: 2, default: 1 })
  servings!: number;

  /** Days of week as integers: 0=Sunday, 1=Monday, … 6=Saturday */
  @Column({ name: "days_of_week", type: "int", array: true })
  daysOfWeek!: number[];

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
