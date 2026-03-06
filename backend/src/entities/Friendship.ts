import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

export enum FriendshipStatus {
  PENDING  = "PENDING",
  ACCEPTED = "ACCEPTED",
  DECLINED = "DECLINED",
}

@Entity("friendships")
@Index("IDX_friendship_requester",  ["requesterId"])
@Index("IDX_friendship_addressee",  ["addresseeId"])
@Index("IDX_friendship_pair", ["requesterId", "addresseeId"], { unique: true })
export class Friendship {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "requester_id", type: "uuid" })
  requesterId!: string;

  @Column({ name: "addressee_id", type: "uuid" })
  addresseeId!: string;

  @Column({
    type: "varchar",
    length: 10,
    default: FriendshipStatus.PENDING,
  })
  status!: FriendshipStatus;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
