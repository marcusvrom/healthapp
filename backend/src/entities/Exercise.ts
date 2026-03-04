import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { HealthProfile } from "./HealthProfile";

export enum ExerciseCategory {
  STRENGTH = "strength",
  CARDIO = "cardio",
  FLEXIBILITY = "flexibility",
  MIND_BODY = "mind_body",
  SPORTS = "sports",
}

/**
 * Built-in exercise library with MET values and hypertrophy scores.
 * MET (Metabolic Equivalent of Task) reference values from the
 * Compendium of Physical Activities (Ainsworth et al.).
 *
 * Hypertrophy Score (1–10):
 *   10 = maximal anabolic stimulus (e.g. heavy compound weight-training)
 *   1  = negligible (e.g. slow walking)
 */
export const EXERCISE_PRESETS: Array<{
  name: string;
  category: ExerciseCategory;
  met: number;
  hypertrophyScore: number;
}> = [
  { name: "Musculação (hipertrofia)", category: ExerciseCategory.STRENGTH, met: 6.0, hypertrophyScore: 10 },
  { name: "Musculação (resistência)", category: ExerciseCategory.STRENGTH, met: 5.0, hypertrophyScore: 7 },
  { name: "Natação", category: ExerciseCategory.CARDIO, met: 8.0, hypertrophyScore: 4 },
  { name: "Spinning / Ciclismo indoor", category: ExerciseCategory.CARDIO, met: 8.5, hypertrophyScore: 3 },
  { name: "Corrida (moderada)", category: ExerciseCategory.CARDIO, met: 9.8, hypertrophyScore: 2 },
  { name: "Caminhada (moderada)", category: ExerciseCategory.CARDIO, met: 3.5, hypertrophyScore: 1 },
  { name: "Pilates", category: ExerciseCategory.FLEXIBILITY, met: 3.0, hypertrophyScore: 3 },
  { name: "Yoga", category: ExerciseCategory.MIND_BODY, met: 2.5, hypertrophyScore: 2 },
  { name: "Crossfit", category: ExerciseCategory.STRENGTH, met: 8.0, hypertrophyScore: 8 },
  { name: "Futebol", category: ExerciseCategory.SPORTS, met: 7.0, hypertrophyScore: 3 },
  { name: "Basquete", category: ExerciseCategory.SPORTS, met: 6.5, hypertrophyScore: 3 },
  { name: "Boxe / Artes Marciais", category: ExerciseCategory.SPORTS, met: 9.0, hypertrophyScore: 6 },
];

@Entity("exercises")
export class Exercise {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "health_profile_id", type: "text" })
  healthProfileId!: string;

  @Column({ type: "text"})
  name!: string;

  @Column({ type: "enum", enum: ExerciseCategory, default: ExerciseCategory.STRENGTH })
  category!: ExerciseCategory;

  /**
   * MET – Metabolic Equivalent of Task.
   * Calories burned = MET × weight(kg) × duration(h)
   */
  @Column({ type: "numeric", precision: 5, scale: 2 })
  met!: number;

  /**
   * Score 1–10 indicating the anabolic/hypertrophy stimulus.
   * Score ≥ 8 forces protein target to 2.2 g/kg.
   */
  @Column({
    name: "hypertrophy_score",
    type: "smallint",
    default: 5,
  })
  hypertrophyScore!: number;

  /** Duration per session in minutes */
  @Column({ name: "duration_minutes", type: "smallint", default: 60 })
  durationMinutes!: number;

  /** Preferred start time for the session (HH:MM) */
  @Column({
    name: "preferred_time",
    type: "text",
    nullable: true,
  })
  preferredTime?: string;

  /** Days of the week (0=Sun … 6=Sat) stored as integer array */
  @Column({
    name: "days_of_week",
    type: "int",
    array: true,
    default: () => "'{}'",
  })
  daysOfWeek!: number[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  // ── Relations ──────────────────────────────────────────────────────────────
  @ManyToOne(() => HealthProfile, (hp) => hp.exercises, { onDelete: "CASCADE" })
  @JoinColumn({ name: "health_profile_id" })
  healthProfile!: HealthProfile;
}
