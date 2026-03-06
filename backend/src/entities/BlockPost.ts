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
 * BlockPost
 * ─────────
 * Optional social post created when a user completes a routine block.
 * A photo is optional — text-only posts are allowed too.
 * isPublic = false means visible only to the author (private journal mode).
 */
@Entity("block_posts")
@Index("IDX_block_posts_user_created", ["userId", "createdAt"])
export class BlockPost {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  /** The routine block that triggered this post (nullable for manual posts). */
  @Column({ name: "block_id", type: "uuid", nullable: true })
  blockId?: string;

  /** Block type label snapshot so feed still shows correct info after block deletion. */
  @Column({ name: "block_type", type: "varchar", length: 40, nullable: true })
  blockType?: string;

  /** Local file path served via /uploads/posts/<filename> */
  @Column({ name: "photo_url", type: "text", nullable: true })
  photoUrl?: string;

  @Column({ type: "text", nullable: true })
  caption?: string;

  @Column({ name: "is_public", type: "boolean", default: true })
  isPublic!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;
}
