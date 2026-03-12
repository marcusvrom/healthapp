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
import { RecipeIngredient } from "./RecipeIngredient";

/**
 * Recipe
 * ──────
 * Community recipe with full macro breakdown and ingredient list.
 * Can be public (visible to all users) or private (only visible to the author).
 *
 * Versioning: each recipe has a monotonically increasing `version` number.
 * When a user imports a community recipe, a private fork is created with
 * `forkedFromId` pointing to the original and `forkedAtVersion` capturing
 * the snapshot version. This ensures edits by the original author do not
 * affect other users' imported copies.
 */
@Entity("recipes")
@Index("IDX_recipes_author", ["authorId"])
@Index("IDX_recipes_public", ["isPublic", "isActive"])
@Index("IDX_recipes_forked_from", ["forkedFromId"])
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

  // ── Versioning ──────────────────────────────────────────────────────────

  /** Monotonically increasing version; bumped on every update */
  @Column({ type: "integer", default: 1 })
  version!: number;

  /** If this recipe is a fork (import) of a community recipe, points to the original */
  @Column({ name: "forked_from_id", type: "text", nullable: true })
  forkedFromId?: string;

  /** Version of the original recipe at the time of forking */
  @Column({ name: "forked_at_version", type: "integer", nullable: true })
  forkedAtVersion?: number;

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

  @OneToMany(() => RecipeIngredient, (i) => i.recipe, { cascade: true, eager: false })
  ingredients?: RecipeIngredient[];
}
