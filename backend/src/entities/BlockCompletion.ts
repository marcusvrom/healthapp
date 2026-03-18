import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from "typeorm";
import { User } from "./User";
import { RoutineBlock } from "./RoutineBlock";

/**
 * Tracks per-date completions for routine blocks.
 * This solves the problem where recurring blocks stored completedAt directly
 * on the entity — meaning a block completed on Monday appeared completed
 * on Wednesday too. Now each completion is a separate row keyed by (blockId, date).
 */
@Entity("block_completions")
@Unique("UQ_block_completion_date", ["blockId", "completionDate"])
export class BlockCompletion {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "block_id", type: "uuid" })
  blockId!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  /** The date this completion applies to (YYYY-MM-DD) */
  @Column({ name: "completion_date", type: "date" })
  completionDate!: string;

  /** Timestamp when the user completed the block */
  @Column({ name: "completed_at", type: "timestamptz" })
  completedAt!: Date;

  /** Prevents double-awarding XP for same block on same date */
  @Column({ name: "xp_awarded", type: "boolean", default: false })
  xpAwarded!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  // ── Relations ──────────────────────────────────────────────────────────────
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @ManyToOne(() => RoutineBlock, { onDelete: "CASCADE" })
  @JoinColumn({ name: "block_id" })
  block!: RoutineBlock;
}
