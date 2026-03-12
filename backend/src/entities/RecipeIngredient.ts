import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Recipe } from "./Recipe";

/**
 * RecipeIngredient
 * ────────────────
 * Individual ingredient entry for a recipe.
 * Stores ingredient name, quantity, and measurement unit.
 */
@Entity("recipe_ingredients")
@Index("IDX_recipe_ingredients_recipe", ["recipeId"])
@Index("IDX_recipe_ingredients_name", ["name"])
export class RecipeIngredient {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "recipe_id", type: "text" })
  recipeId!: string;

  /** Ingredient name (e.g. "Frango desfiado", "Azeite de oliva") */
  @Column({ type: "text" })
  name!: string;

  /** Quantity (e.g. 100, 2, 0.5) */
  @Column({ type: "numeric", precision: 8, scale: 2 })
  quantity!: number;

  /** Measurement unit (e.g. "g", "ml", "colher de sopa", "unidade", "xícara") */
  @Column({ type: "text" })
  unit!: string;

  /** Sort position within the recipe */
  @Column({ name: "sort_order", type: "integer", default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  // ── Relations ─────────────────────────────────────────────────────────────
  @ManyToOne(() => Recipe, (r) => r.ingredients, { onDelete: "CASCADE" })
  @JoinColumn({ name: "recipe_id" })
  recipe?: Recipe;
}
