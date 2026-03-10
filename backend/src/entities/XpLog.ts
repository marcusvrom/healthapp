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
 * XpLog — immutable audit record for every XP award.
 *
 * Used for:
 *  • Weekly ranking (SUM over the last 7 days per user)
 *  • Daily cap enforcement (SUM over today per category)
 *  • Future analytics / history timeline
 */
@Entity("xp_logs")
@Index("IDX_xp_logs_user_awarded", ["userId", "awardedAt"])
export class XpLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  /** XP amount awarded (always positive) */
  @Column({ type: "int" })
  amount!: number;

  /**
   * Logical category of the award — used for daily-cap grouping.
   * Mirrors block types + custom action names.
   * e.g. "exercise" | "meal" | "water" | "sleep" | "recipe" | "general"
   */
  @Column({ type: "text" })
  category!: string;

  /** Optional reference to the entity that triggered the award (blockId, mealId …) */
  @Column({ name: "source_id", type: "uuid", nullable: true })
  sourceId?: string;

  @CreateDateColumn({ name: "awarded_at" })
  awardedAt!: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;
}
