import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User";

/**
 * Stores Web Push API subscription data per user/device.
 * Each browser/device will have its own subscription.
 */
@Entity("push_subscriptions")
export class PushSubscription {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  /** The push endpoint URL from the browser */
  @Column({ type: "text" })
  endpoint!: string;

  /** Auth key (base64url) */
  @Column({ name: "auth_key", type: "text" })
  authKey!: string;

  /** P-256 ECDH key (base64url) */
  @Column({ name: "p256dh_key", type: "text" })
  p256dhKey!: string;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  // ── Relations ──────────────────────────────────────────────────────────────
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;
}
