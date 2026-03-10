import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Recipe } from "./Recipe";

/**
 * RecipeReview
 * ────────────
 * One review per (recipe, user) pair — enforced by a unique composite index.
 * Supports a star rating (0–5) and a quick "like" toggle.
 */
@Entity("recipe_reviews")
@Index("IDX_recipe_reviews_recipe", ["recipeId"])
@Index("IDX_recipe_reviews_user",   ["userId"])
@Index("UQ_recipe_review_user_recipe", ["recipeId", "userId"], { unique: true })
export class RecipeReview {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  /** Recipe being reviewed */
  @Column({ name: "recipe_id", type: "text" })
  recipeId!: string;

  /** Reviewer's user id — stored as TEXT to avoid FK type-mismatch */
  @Column({ name: "user_id", type: "text" })
  userId!: string;

  /**
   * Star rating: 0 = not rated, 1–5 = rated.
   * Stored as smallint to save space.
   */
  @Column({ type: "smallint", default: 0 })
  rating!: number;

  /** Quick like/bookmark without a written review */
  @Column({ name: "is_liked", type: "boolean", default: false })
  isLiked!: boolean;

  /** Optional written comment */
  @Column({ type: "text", nullable: true })
  comment?: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  // ── Relations ─────────────────────────────────────────────────────────────
  @ManyToOne(() => Recipe, (r) => r.reviews, { onDelete: "CASCADE" })
  @JoinColumn({ name: "recipe_id" })
  recipe?: Recipe;
}
