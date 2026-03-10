import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

/**
 * Challenge
 * ─────────
 * A weekly themed challenge users can join.
 * Progress is computed on-demand by counting completed RoutineBlocks
 * of the matching category within [weekStart, weekEnd].
 *
 * Challenges are seeded automatically by ChallengeService.ensureWeeklyChallenges()
 * for the current ISO week.
 */
@Entity("challenges")
@Index("IDX_challenges_week", ["weekStart", "weekEnd"])
export class Challenge {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 120 })
  title!: string;

  @Column({ type: "text" })
  description!: string;

  /**
   * Matches RoutineBlock.type (e.g. "exercise", "sleep", "water").
   * "any" means any block type counts toward progress.
   */
  @Column({ type: "varchar", length: 40 })
  category!: string;

  /** Number of completions needed to finish the challenge. */
  @Column({ name: "target_count", type: "int" })
  targetCount!: number;

  /** XP awarded when the user first reaches targetCount. */
  @Column({ name: "xp_reward", type: "int", default: 50 })
  xpReward!: number;

  /** Emoji icon for the challenge card. */
  @Column({ type: "varchar", length: 8, default: "🏆" })
  emoji!: string;

  /** ISO date of Monday for this challenge's week (YYYY-MM-DD). */
  @Column({ name: "week_start", type: "date" })
  weekStart!: string;

  /** ISO date of Sunday for this challenge's week (YYYY-MM-DD). */
  @Column({ name: "week_end", type: "date" })
  weekEnd!: string;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
