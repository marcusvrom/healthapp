import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User";

export enum NotificationType {
  MEAL_REMINDER = "meal_reminder",
  WATER_REMINDER = "water_reminder",
  EXERCISE_REMINDER = "exercise_reminder",
  MEDICATION_REMINDER = "medication_reminder",
  BLOCK_REMINDER = "block_reminder",
  SYSTEM = "system",
}

@Entity("notifications")
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({ type: "enum", enum: NotificationType, default: NotificationType.SYSTEM })
  type!: NotificationType;

  @Column({ type: "text" })
  title!: string;

  @Column({ type: "text" })
  message!: string;

  /** Optional reference to the routine block that triggered this notification */
  @Column({ name: "block_id", type: "uuid", nullable: true })
  blockId?: string;

  /** Scheduled time for the notification (HH:MM format) */
  @Column({ name: "scheduled_time", type: "text", nullable: true })
  scheduledTime?: string;

  /** ISO date this notification is for */
  @Column({ name: "notification_date", type: "date", nullable: true })
  notificationDate?: string;

  @Column({ name: "is_read", type: "boolean", default: false })
  isRead!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  // ── Relations ──────────────────────────────────────────────────────────────
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;
}
