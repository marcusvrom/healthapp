import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm";

@Entity("exercise_logs")
@Index("IDX_exercise_logs_user_name", ["userId", "exerciseName"])
@Index("IDX_exercise_logs_user_date", ["userId", "logDate"])
export class ExerciseLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  userId!: string;

  @Column()
  sheetId!: string;

  @Column()
  exerciseName!: string;

  @Column({ type: "varchar", length: 10 })
  logDate!: string; // YYYY-MM-DD

  @Column({ type: "int" })
  sets!: number;

  @Column({ type: "varchar", length: 20 })
  reps!: string; // "8-12" or "10"

  @Column({ type: "decimal", precision: 6, scale: 2, default: 0 })
  weightKg!: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
