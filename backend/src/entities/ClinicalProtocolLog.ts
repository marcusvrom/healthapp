import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from "typeorm";

/**
 * ClinicalProtocolLog
 * ────────────────────
 * One record per (protocol, date) when the user marks a dose as taken.
 * Unique constraint prevents double-logging on the same day.
 */
@Entity("clinical_protocol_logs")
@Index("IDX_cp_logs_user_date",    ["userId", "takenDate"])
@Index("IDX_cp_logs_proto_date",   ["protocolId", "takenDate"], { unique: true })
export class ClinicalProtocolLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id",     type: "text" })
  userId!: string;

  @Column({ name: "protocol_id", type: "text" })
  protocolId!: string;

  @Column({ name: "taken_date",  type: "date" })
  takenDate!: string;

  @Column({ name: "taken_at",    type: "timestamptz" })
  takenAt!: Date;

  @Column({ name: "xp_awarded",  type: "boolean", default: false })
  xpAwarded!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
