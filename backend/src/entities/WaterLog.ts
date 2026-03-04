import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./User";

/**
 * WaterLog
 * ─────────
 * Records each water intake event.
 * `loggedAt` defaults to now() but can be set retroactively.
 */
@Entity("water_logs")
@Index("IDX_water_logs_user_date", ["userId", "loggedAt"])
export class WaterLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id" })
  userId!: string;

  /** Amount consumed in millilitres */
  @Column({ name: "quantity_ml", type: "int" })
  quantityMl!: number;

  /** Actual drink time (can be set retroactively) */
  @Column({ name: "logged_at", type: "timestamptz" })
  loggedAt!: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;
}
