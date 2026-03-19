import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from "typeorm";

@Entity("user_badges")
@Unique("UQ_user_badge", ["userId", "slug"])
export class UserBadge {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  userId!: string;

  @Column()
  slug!: string;

  @Column({ type: "timestamp" })
  unlockedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
