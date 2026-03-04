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

  @Column({ unique: true, length: 255 })
  email!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ name: "password_hash", length: 255 })
  passwordHash!: string;

  @Column({ default: true, name: "is_active" })
  isActive!: boolean;

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
