import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm";
import { WorkoutSheetExercise } from "./WorkoutSheetExercise";

@Entity("workout_sheets")
@Index("IDX_workout_sheets_user", ["userId"])
export class WorkoutSheet {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  /** Display name — e.g. "Treino A – Peito / Tríceps" */
  @Column({ type: "text" })
  name!: string;

  /** Optional description or notes */
  @Column({ type: "text", nullable: true })
  description?: string;

  /** Optional category tag for grouping */
  @Column({ type: "varchar", length: 40, nullable: true })
  category?: string;

  /** Preferred days of the week (0=Sun … 6=Sat) */
  @Column({ name: "days_of_week", type: "int", array: true, default: () => "'{}'" })
  daysOfWeek!: number[];

  /** Estimated session duration in minutes */
  @Column({ name: "estimated_minutes", type: "smallint", default: 60 })
  estimatedMinutes!: number;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  /** If created from a template, stores the template slug */
  @Column({ name: "from_template", type: "varchar", length: 60, nullable: true })
  fromTemplate?: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  // ── Relations ──────────────────────────────────────────────────────────
  @OneToMany(() => WorkoutSheetExercise, (e) => e.sheet, { cascade: true })
  exercises?: WorkoutSheetExercise[];
}
