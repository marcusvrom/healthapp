import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User";

/**
 * Stores one blood-test snapshot per row.
 * All marker values are in their standard clinical units (mg/dL, ng/mL, etc.).
 * Nullable columns mean the marker was not measured in that test.
 */
@Entity("blood_tests")
export class BloodTest {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  /** Date the blood sample was collected */
  @Column({ name: "collected_at", type: "date" })
  collectedAt!: string;

  // ── Glucose & Insulin ──────────────────────────────────────────────────────
  /** Fasting blood glucose (mg/dL) */
  @Column({
    name: "glucose_mg_dl",
    type: "numeric",
    precision: 6,
    scale: 2,
    nullable: true,
  })
  glucoseMgDl?: number;

  /** Fasting insulin (μIU/mL) */
  @Column({
    name: "insulin_uiu_ml",
    type: "numeric",
    precision: 6,
    scale: 2,
    nullable: true,
  })
  insulinUiuMl?: number;

  /** HbA1c (%) */
  @Column({
    name: "hba1c_pct",
    type: "numeric",
    precision: 4,
    scale: 2,
    nullable: true,
  })
  hba1cPct?: number;

  // ── Lipid Panel ────────────────────────────────────────────────────────────
  /** Total cholesterol (mg/dL) */
  @Column({
    name: "cholesterol_total_mg_dl",
    type: "numeric",
    precision: 6,
    scale: 2,
    nullable: true,
  })
  cholesterolTotalMgDl?: number;

  /** LDL cholesterol (mg/dL) */
  @Column({
    name: "ldl_mg_dl",
    type: "numeric",
    precision: 6,
    scale: 2,
    nullable: true,
  })
  ldlMgDl?: number;

  /** HDL cholesterol (mg/dL) */
  @Column({
    name: "hdl_mg_dl",
    type: "numeric",
    precision: 6,
    scale: 2,
    nullable: true,
  })
  hdlMgDl?: number;

  /** Triglycerides (mg/dL) */
  @Column({
    name: "triglycerides_mg_dl",
    type: "numeric",
    precision: 6,
    scale: 2,
    nullable: true,
  })
  triglyceridesMgDl?: number;

  // ── Vitamins & Minerals ────────────────────────────────────────────────────
  /** Vitamin D – 25(OH)D (ng/mL) */
  @Column({
    name: "vitamin_d_ng_ml",
    type: "numeric",
    precision: 5,
    scale: 2,
    nullable: true,
  })
  vitaminDNgMl?: number;

  /** Vitamin B12 (pg/mL) */
  @Column({
    name: "vitamin_b12_pg_ml",
    type: "numeric",
    precision: 7,
    scale: 2,
    nullable: true,
  })
  vitaminB12PgMl?: number;

  /** Ferritin (ng/mL) */
  @Column({
    name: "ferritin_ng_ml",
    type: "numeric",
    precision: 7,
    scale: 2,
    nullable: true,
  })
  ferritinNgMl?: number;

  // ── Thyroid ────────────────────────────────────────────────────────────────
  /** TSH (mIU/L) */
  @Column({
    name: "tsh_miu_l",
    type: "numeric",
    precision: 6,
    scale: 3,
    nullable: true,
  })
  tshMiuL?: number;

  // ── Hormones (blood-test results, not dose logs) ────────────────────────────
  /** Total Testosterone (ng/dL) – relevant for TRT monitoring */
  @Column({
    name: "testosterone_total_ng_dl",
    type: "numeric",
    precision: 7,
    scale: 2,
    nullable: true,
  })
  testosteroneTotalNgDl?: number;

  /** Estradiol (pg/mL) */
  @Column({
    name: "estradiol_pg_ml",
    type: "numeric",
    precision: 7,
    scale: 2,
    nullable: true,
  })
  estradiolPgMl?: number;

  // ── Inflammation ───────────────────────────────────────────────────────────
  /** C-reactive protein – high-sensitivity (mg/L) */
  @Column({
    name: "crp_mg_l",
    type: "numeric",
    precision: 5,
    scale: 2,
    nullable: true,
  })
  crpMgL?: number;

  // ── Notes ──────────────────────────────────────────────────────────────────
  @Column({ type: "text", nullable: true })
  notes?: string;

  /** Macro adjustments computed from this test (JSON blob) */
  @Column({ name: "computed_adjustments", type: "jsonb", nullable: true })
  computedAdjustments?: Record<string, unknown>;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  // ── Relations ──────────────────────────────────────────────────────────────
  @ManyToOne(() => User, (user) => user.bloodTests, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;
}
