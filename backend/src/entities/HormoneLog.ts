import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./User";

export enum HormoneCategory {
  TRT             = "TRT",
  FEMALE_HORMONES = "Female_Hormones",
  SLEEP           = "Sleep",
  OTHER           = "Other",
}

/**
 * HormoneLog
 * Tracks each hormone / supplement administration with full audit trail.
 * NOTE: All string columns need explicit type to work with tsx/esbuild.
 */
@Entity("hormone_logs")
@Index("IDX_hormone_logs_user_cat", ["userId", "category"])
@Index("IDX_hormone_logs_user_at",  ["userId", "administeredAt"])
export class HormoneLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "text" })
  userId!: string;

  @Column({ type: "enum", enum: HormoneCategory, default: HormoneCategory.OTHER })
  category!: HormoneCategory;

  /** Generic/brand name (e.g. "Enantato de Testosterona", "Melatonina") */
  @Column({ type: "varchar", length: 255 })
  name!: string;

  /** Numeric dose amount */
  @Column({ type: "numeric", precision: 10, scale: 3 })
  dosage!: number;

  /** Unit of measurement: mg, ml, ui, mcg, comprimido … */
  @Column({ type: "varchar", length: 32 })
  unit!: string;

  /** Exact date & time of administration / consumption */
  @Column({ name: "administered_at", type: "timestamptz" })
  administeredAt!: Date;

  /** Free-form notes: injection site, mood, side-effects … */
  @Column({ type: "text", nullable: true })
  notes?: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;
}
