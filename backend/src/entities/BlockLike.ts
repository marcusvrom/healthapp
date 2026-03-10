import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

/** One row = one user liked one post. Unique constraint prevents double-likes. */
@Entity("block_likes")
@Index("IDX_block_likes_unique", ["userId", "postId"], { unique: true })
@Index("IDX_block_likes_post", ["postId"])
export class BlockLike {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({ name: "post_id", type: "uuid" })
  postId!: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
