import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from "typeorm";
import { MealFood } from "./Meal";

export enum FoodSource {
  TACO = "TACO",
  TBCA = "TBCA",
  OPEN_FOOD_FACTS = "OpenFoodFacts",
  USER_CUSTOM = "UserCustom",
}

/**
 * Food
 * ────
 * All nutritional values are stored per 100g reference.
 * householdMeasure + gramsReference define the "standard serving" label shown
 * in the UI (e.g. "1 escumadeira = 80g").
 */
@Entity("foods")
@Index("IDX_foods_name_trgm", { synchronize: false }) // created in migration via pg_trgm
export class Food {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ length: 512 })
  name!: string;

  /** Human-friendly portion description, e.g. "1 escumadeira", "1 colher de sopa" */
  @Column({ name: "household_measure", length: 255, nullable: true })
  householdMeasure?: string;

  /** How many grams correspond to the household measure above */
  @Column({
    name: "grams_reference",
    type: "numeric",
    precision: 7,
    scale: 2,
    nullable: true,
  })
  gramsReference?: number;

  // ── Macros per 100 g ──────────────────────────────────────────────────────

  /** kcal per 100 g */
  @Column({ type: "numeric", precision: 7, scale: 2, default: 0 })
  calories!: number;

  /** Carbohydrates (g) per 100 g */
  @Column({ type: "numeric", precision: 6, scale: 2, default: 0 })
  carbs!: number;

  /** Protein (g) per 100 g */
  @Column({ type: "numeric", precision: 6, scale: 2, default: 0 })
  protein!: number;

  /** Total fat (g) per 100 g */
  @Column({ type: "numeric", precision: 6, scale: 2, default: 0 })
  fat!: number;

  /** Dietary fiber (g) per 100 g */
  @Column({ type: "numeric", precision: 6, scale: 2, nullable: true })
  fiber?: number;

  /** Sodium (mg) per 100 g */
  @Column({ type: "numeric", precision: 7, scale: 2, nullable: true })
  sodium?: number;

  // ── Provenance ────────────────────────────────────────────────────────────

  @Column({ type: "enum", enum: FoodSource, default: FoodSource.USER_CUSTOM })
  source!: FoodSource;

  /** EAN/barcode (used for OpenFoodFacts lookups) */
  @Column({ length: 64, nullable: true, unique: true })
  barcode?: string;

  /** Original ID in the external dataset */
  @Column({ name: "external_id", length: 128, nullable: true })
  externalId?: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  // ── Relations ──────────────────────────────────────────────────────────────
  @OneToMany(() => MealFood, (mf) => mf.food)
  mealFoods?: MealFood[];
}
