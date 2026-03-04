import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from "typeorm";
import { RecipeReview } from "./RecipeReview";

/**
 * Recipe
 * ──────
 * Community recipe with full macro breakdown.
 * Can be public (visible to all users) or private (only visible to the author).
 * "Import Recipe" copies the macros into a ScheduledMeal for the requesting user.
 */
@Entity("recipes")
@Index("IDX_recipes_author", ["authorId"])
@Index("IDX_recipes_public", ["isPublic", "isActive"])
export class Recipe {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  /** Author's user id — stored as TEXT to avoid FK type-mismatch with uuid users.id */
  @Column({ name: "author_id", type: "text" })
  authorId!: string;

  @Column({ type: "text" })
  title!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  /** Preparation + cooking instructions (markdown or plain text) */
  @Column({ type: "text" })
  instructions!: string;

  // ── Nutrition per serving ─────────────────────────────────────────────────

  /** Calories per serving (kcal) */
  @Column({ type: "numeric", precision: 8, scale: 2 })
  kcal!: number;

  /** Protein per serving in grams */
  @Column({ name: "protein_g", type: "numeric", precision: 6, scale: 2, default: 0 })
  proteinG!: number;

  /** Carbohydrates per serving in grams */
  @Column({ name: "carbs_g", type: "numeric", precision: 6, scale: 2, default: 0 })
  carbsG!: number;

  /** Fat per serving in grams */
  @Column({ name: "fat_g", type: "numeric", precision: 6, scale: 2, default: 0 })
  fatG!: number;

  /** Number of servings described by the recipe (default 1) */
  @Column({ type: "integer", default: 1 })
  servings!: number;

  /** Estimated preparation time in minutes */
  @Column({ name: "prep_time_min", type: "integer", nullable: true })
  prepTimeMin?: number;

  // ── Visibility & lifecycle ────────────────────────────────────────────────

  /** When true, the recipe appears in the community feed */
  @Column({ name: "is_public", type: "boolean", default: false })
  isPublic!: boolean;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  // ── Relations ─────────────────────────────────────────────────────────────
  @OneToMany(() => RecipeReview, (r) => r.recipe, { cascade: false })
  reviews?: RecipeReview[];
}
