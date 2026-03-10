import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

/**
 * Tracks a user's participation in a Challenge.
 * completedAt is set (once) when the user's progress first reaches targetCount.
 */
@Entity("challenge_participants")
@Index("IDX_challenge_participants_unique", ["userId", "challengeId"], { unique: true })
@Index("IDX_challenge_participants_challenge", ["challengeId"])
export class ChallengeParticipant {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({ name: "challenge_id", type: "uuid" })
  challengeId!: string;

  /** Set when the user first completes the challenge (progress >= targetCount). */
  @Column({ name: "completed_at", type: "timestamptz", nullable: true })
  completedAt?: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
