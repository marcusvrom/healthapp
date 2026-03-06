import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

export enum MissionType {
  WATER_GOAL      = "WATER_GOAL",
  ALL_MEALS       = "ALL_MEALS",
  ACTIVITY        = "ACTIVITY",
  WEIGHT_LOG      = "WEIGHT_LOG",
  BLOOD_TEST      = "BLOOD_TEST",
  SLEEP_BLOCK     = "SLEEP_BLOCK",
  CHECK_IN        = "CHECK_IN",
}

@Entity("daily_missions")
@Index("IDX_daily_missions_user_date", ["userId", "date"])
export class DailyMission {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  /** Calendar date the mission belongs to — format YYYY-MM-DD */
  @Column({ type: "date" })
  date!: string;

  @Column({ type: "varchar", length: 120 })
  title!: string;

  @Column({ name: "xp_reward", type: "int" })
  xpReward!: number;

  @Column({ name: "is_completed", type: "boolean", default: false })
  isCompleted!: boolean;

  @Column({ name: "mission_type", type: "varchar", length: 30 })
  missionType!: MissionType;

  @Column({ name: "completed_at", type: "timestamptz", nullable: true })
  completedAt?: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
