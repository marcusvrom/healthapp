import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { WorkoutSheet } from "./WorkoutSheet";

@Entity("workout_sheet_exercises")
@Index("IDX_wse_sheet", ["sheetId"])
export class WorkoutSheetExercise {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "sheet_id", type: "uuid" })
  sheetId!: string;

  /** Exercise display name */
  @Column({ type: "text" })
  name!: string;

  /** Number of sets */
  @Column({ type: "smallint", default: 3 })
  sets!: number;

  /** Rep range or target — e.g. "8-12" or "30s" */
  @Column({ type: "varchar", length: 20, default: "8-12" })
  reps!: string;

  /** Rest period in seconds between sets */
  @Column({ name: "rest_seconds", type: "smallint", default: 60 })
  restSeconds!: number;

  /** Optional notes (e.g. "até a falha", "drop set") */
  @Column({ type: "text", nullable: true })
  notes?: string;

  /** Visual ordering */
  @Column({ name: "sort_order", type: "smallint", default: 0 })
  sortOrder!: number;

  // ── Relations ──────────────────────────────────────────────────────────
  @ManyToOne(() => WorkoutSheet, (s) => s.exercises, { onDelete: "CASCADE" })
  @JoinColumn({ name: "sheet_id" })
  sheet!: WorkoutSheet;
}
