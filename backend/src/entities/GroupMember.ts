import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

/** Many-to-many pivot between User and Group. */
@Entity("group_members")
@Index("IDX_group_members_unique", ["userId", "groupId"], { unique: true })
@Index("IDX_group_members_group", ["groupId"])
export class GroupMember {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({ name: "group_id", type: "uuid" })
  groupId!: string;

  @CreateDateColumn({ name: "joined_at" })
  joinedAt!: Date;
}
