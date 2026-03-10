import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { User } from "./User";
import { Food } from "./Food";
import { MealType } from "./RoutineBlock";

/**
 * Meal
 * ────
 * Represents a single eating event (e.g. "Almoço on 2024-06-10").
 * Nutritional totals are computed on-the-fly from its MealFood children.
 */
@Entity("meals")
export class Meal {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  /** ISO date (YYYY-MM-DD) */
  @Column({ name: "meal_date", type: "date" })
  mealDate!: string;

  @Column({ type: "enum", enum: MealType, name: "meal_type" })
  mealType!: MealType;

  /** Free-text note (e.g. "pré-treino leve") */
  @Column({ type: "text", nullable: true })
  notes?: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  // ── Relations ──────────────────────────────────────────────────────────────
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @OneToMany(() => MealFood, (mf) => mf.meal, { cascade: true, eager: true })
  mealFoods!: MealFood[];

  // ── Computed helpers (not persisted) ──────────────────────────────────────
  get totalCalories(): number {
    return this.mealFoods?.reduce((s, mf) => s + mf.computedCalories, 0) ?? 0;
  }
  get totalProtein(): number {
    return this.mealFoods?.reduce((s, mf) => s + mf.computedProtein, 0) ?? 0;
  }
  get totalCarbs(): number {
    return this.mealFoods?.reduce((s, mf) => s + mf.computedCarbs, 0) ?? 0;
  }
  get totalFat(): number {
    return this.mealFoods?.reduce((s, mf) => s + mf.computedFat, 0) ?? 0;
  }
  get totalFiber(): number {
    return this.mealFoods?.reduce((s, mf) => s + mf.computedFiber, 0) ?? 0;
  }
}

/**
 * MealFood
 * ─────────
 * Join table between Meal and Food with the actual quantity consumed (grams).
 * All macro values are derived → computedX = food.macro * quantityG / 100
 */
@Entity("meal_foods")
export class MealFood {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "meal_id", type: "text" })
  mealId!: string;

  @Column({ name: "food_id", type: "text" })
  foodId!: string;

  /** Quantity consumed, in grams */
  @Column({ name: "quantity_g", type: "numeric", precision: 7, scale: 2 })
  quantityG!: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  // ── Relations ──────────────────────────────────────────────────────────────
  @ManyToOne(() => Meal, (meal) => meal.mealFoods, { onDelete: "CASCADE" })
  @JoinColumn({ name: "meal_id" })
  meal!: Meal;

  @ManyToOne(() => Food, (food) => food.mealFoods, { eager: true })
  @JoinColumn({ name: "food_id" })
  food!: Food;

  // ── Computed getters (not persisted) ──────────────────────────────────────
  private macro(per100g: number): number {
    return Math.round((per100g * Number(this.quantityG)) / 100 * 100) / 100;
  }
  get computedCalories(): number { return this.macro(Number(this.food?.calories ?? 0)); }
  get computedProtein(): number  { return this.macro(Number(this.food?.protein  ?? 0)); }
  get computedCarbs(): number    { return this.macro(Number(this.food?.carbs    ?? 0)); }
  get computedFat(): number      { return this.macro(Number(this.food?.fat      ?? 0)); }
  get computedFiber(): number    { return this.macro(Number(this.food?.fiber    ?? 0)); }
}
