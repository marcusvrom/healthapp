import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { User } from "./User";
import { Exercise } from "./Exercise";

export enum Gender {
  MALE = "male",
  FEMALE = "female",
  OTHER = "other",
}

export enum ActivityFactor {
  SEDENTARY = "sedentary",          // desk job, no exercise   → ×1.2
  LIGHTLY_ACTIVE = "lightly_active", // light exercise 1-3×/wk  → ×1.375
  MODERATELY_ACTIVE = "moderately_active", // moderate 3-5×/wk → ×1.55
  VERY_ACTIVE = "very_active",      // hard exercise 6-7×/wk   → ×1.725
  EXTRA_ACTIVE = "extra_active",    // physical job + daily training → ×1.9
}

/** Maps ActivityFactor enum values to PAL multipliers (Mifflin-St Jeor) */
export const ACTIVITY_MULTIPLIERS: Record<ActivityFactor, number> = {
  [ActivityFactor.SEDENTARY]: 1.2,
  [ActivityFactor.LIGHTLY_ACTIVE]: 1.375,
  [ActivityFactor.MODERATELY_ACTIVE]: 1.55,
  [ActivityFactor.VERY_ACTIVE]: 1.725,
  [ActivityFactor.EXTRA_ACTIVE]: 1.9,
};

export enum PrimaryGoal {
  EMAGRECIMENTO = "emagrecimento",
  GANHO_MASSA   = "ganho_massa",
  MANUTENCAO    = "manutencao",
  SAUDE_GERAL   = "saude_geral",
  DIABETICO     = "diabetico",
}

/** Caloric offset applied to TEE+exercise based on the user\'s primary goal */
export const GOAL_CALORIC_ADJUSTMENT: Record<PrimaryGoal, number> = {
  [PrimaryGoal.EMAGRECIMENTO]: -500,
  [PrimaryGoal.GANHO_MASSA]:   +400,
  [PrimaryGoal.MANUTENCAO]:       0,
  [PrimaryGoal.SAUDE_GERAL]:      0,
  [PrimaryGoal.DIABETICO]:        0,
};

@Entity("health_profiles")
export class HealthProfile {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  // ── Biometrics ─────────────────────────────────────────────────────────────
  @Column({ type: "numeric" })
  age!: number;

  /** Weight in kilograms */
  @Column({ type: "numeric", precision: 5, scale: 2 })
  weight!: number;

  /** Height in centimetres */
  @Column({ type: "numeric", precision: 5, scale: 2 })
  height!: number;

  @Column({ type: "enum", enum: Gender })
  gender!: Gender;

  @Column({
    type: "enum",
    enum: ActivityFactor,
    name: "activity_factor",
    default: ActivityFactor.SEDENTARY,
  })
  activityFactor!: ActivityFactor;

  // ── Daily routine times (stored as HH:MM strings) ─────────────────────────
  @Column({ name: "wake_up_time", default: "07:00", type: "text" })
  wakeUpTime!: string;

  @Column({ name: "sleep_time", default: "23:00", type: "text" })
  sleepTime!: string;

  @Column({ name: "work_start_time", default: "09:00", type: "text" })
  workStartTime!: string;

  @Column({ name: "work_end_time", default: "18:00", type: "text" })
  workEndTime!: string;

  // ── Caloric goal (overridden by blood-test analysis when present) ──────────
  @Column({
    name: "caloric_goal",
    type: "numeric",
    precision: 7,
    scale: 2,
    nullable: true,
  })
  caloricGoal?: number;

  @Column({
    name: "protein_goal_g",
    type: "numeric",
    precision: 6,
    scale: 2,
    nullable: true,
  })
  proteinGoalG?: number;

  @Column({
    name: "carbs_goal_g",
    type: "numeric",
    precision: 6,
    scale: 2,
    nullable: true,
  })
  carbsGoalG?: number;

  @Column({
    name: "fat_goal_g",
    type: "numeric",
    precision: 6,
    scale: 2,
    nullable: true,
  })
  fatGoalG?: number;

  @Column({ name: "primary_goal", type: "text", nullable: true })
  primaryGoal?: PrimaryGoal;

  @Column({ name: "target_weight", type: "numeric", precision: 5, scale: 2, nullable: true })
  targetWeight?: number;

    @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  // ── Relations ──────────────────────────────────────────────────────────────
  @OneToOne(() => User, (user) => user.healthProfile)
  @JoinColumn({ name: "user_id" })
  user!: User;

  @OneToMany(() => Exercise, (ex) => ex.healthProfile, { cascade: true })
  exercises?: Exercise[];
}
