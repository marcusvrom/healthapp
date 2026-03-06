import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

/**
 * A social group (team) that users can join to compete collectively.
 * Members share a weekly leaderboard and see each other's challenge progress.
 */
@Entity("groups")
export class Group {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 80 })
  name!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ name: "owner_id", type: "uuid" })
  ownerId!: string;

  /** 8-character alphanumeric code used to join the group. */
  @Index("IDX_groups_invite_code", { unique: true })
  @Column({ name: "invite_code", type: "varchar", length: 10, unique: true })
  inviteCode!: string;

  @Column({ name: "avatar_emoji", type: "varchar", length: 8, default: "👥" })
  avatarEmoji!: string;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
