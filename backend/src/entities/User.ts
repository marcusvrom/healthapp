import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from "typeorm";
import { HealthProfile } from "./HealthProfile";
import { BloodTest } from "./BloodTest";
import { RoutineBlock } from "./RoutineBlock";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true, type: "text" })
  email!: string;

  @Column({ type: "text" })
  name!: string;

  @Column({ name: "password_hash", type: "text" })
  passwordHash!: string;

  @Column({ default: true, name: "is_active", type: "boolean" })
  isActive!: boolean;

  @Column({ name: "avatar_url", type: "text", nullable: true })
  avatarUrl?: string;

  @Column({ type: "int", default: 0 })
  xp!: number;

  @Column({ type: "varchar", length: 80, nullable: true })
  city?: string;

  @Column({ type: "varchar", length: 80, nullable: true })
  state?: string;

  @Column({ name: "notifications_enabled", type: "boolean", default: true })
  notificationsEnabled!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  // ── Relations ──────────────────────────────────────────────────────────────
  @OneToOne(() => HealthProfile, (profile) => profile.user, {
    cascade: true,
  })
  healthProfile?: HealthProfile;

  @OneToMany(() => BloodTest, (bt) => bt.user, { cascade: true })
  bloodTests?: BloodTest[];

  @OneToMany(() => RoutineBlock, (rb) => rb.user, { cascade: true })
  routineBlocks?: RoutineBlock[];
}
