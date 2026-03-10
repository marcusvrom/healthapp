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
 *
 * Sections
 * ─────────
 *  1. Glucose & Insulin  (Metabolic Panel)
 *  2. Lipid Panel
 *  3. Vitamins & Minerals
 *  4. Thyroid (TSH + Free T3/T4)
 *  5. Hormonal Panel (Testosterone free/total, E2, SHBG, PRL, DHT, FSH, LH, Cortisol)
 *  6. Hepatic & Renal (AST, ALT, GGT, Creatinine, Urea)
 *  7. Inflammation (CRP-us)
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

  // ── 1. Glucose & Insulin ──────────────────────────────────────────────────

  /** Fasting blood glucose (mg/dL) */
  @Column({ name: "glucose_mg_dl", type: "numeric", precision: 6, scale: 2, nullable: true })
  glucoseMgDl?: number;

  /** Fasting insulin (μIU/mL) */
  @Column({ name: "insulin_uiu_ml", type: "numeric", precision: 6, scale: 2, nullable: true })
  insulinUiuMl?: number;

  /** Glycated haemoglobin – HbA1c (%) */
  @Column({ name: "hba1c_pct", type: "numeric", precision: 4, scale: 2, nullable: true })
  hba1cPct?: number;

  // ── 2. Lipid Panel ────────────────────────────────────────────────────────

  /** Total cholesterol (mg/dL) */
  @Column({ name: "cholesterol_total_mg_dl", type: "numeric", precision: 6, scale: 2, nullable: true })
  cholesterolTotalMgDl?: number;

  /** LDL cholesterol (mg/dL) */
  @Column({ name: "ldl_mg_dl", type: "numeric", precision: 6, scale: 2, nullable: true })
  ldlMgDl?: number;

  /** HDL cholesterol (mg/dL) */
  @Column({ name: "hdl_mg_dl", type: "numeric", precision: 6, scale: 2, nullable: true })
  hdlMgDl?: number;

  /** Triglycerides (mg/dL) */
  @Column({ name: "triglycerides_mg_dl", type: "numeric", precision: 6, scale: 2, nullable: true })
  triglyceridesMgDl?: number;

  // ── 3. Vitamins & Minerals ────────────────────────────────────────────────

  /** Vitamin D – 25(OH)D (ng/mL) */
  @Column({ name: "vitamin_d_ng_ml", type: "numeric", precision: 5, scale: 2, nullable: true })
  vitaminDNgMl?: number;

  /** Vitamin B12 (pg/mL) */
  @Column({ name: "vitamin_b12_pg_ml", type: "numeric", precision: 7, scale: 2, nullable: true })
  vitaminB12PgMl?: number;

  /** Ferritin (ng/mL) */
  @Column({ name: "ferritin_ng_ml", type: "numeric", precision: 7, scale: 2, nullable: true })
  ferritinNgMl?: number;

  // ── 4. Thyroid ────────────────────────────────────────────────────────────

  /** TSH – Thyroid-Stimulating Hormone (μIU/mL) */
  @Column({ name: "tsh_miu_l", type: "numeric", precision: 6, scale: 3, nullable: true })
  tshMiuL?: number;

  /** Free T3 – triiodothyronine (pg/mL) */
  @Column({ name: "t3_free_pg_ml", type: "numeric", precision: 5, scale: 2, nullable: true })
  t3FreePgMl?: number;

  /** Free T4 – thyroxine (ng/dL) */
  @Column({ name: "t4_free_ng_dl", type: "numeric", precision: 5, scale: 2, nullable: true })
  t4FreeNgDl?: number;

  // ── 5. Hormonal Panel ─────────────────────────────────────────────────────

  /** Total Testosterone (ng/dL) */
  @Column({ name: "testosterone_total_ng_dl", type: "numeric", precision: 7, scale: 2, nullable: true })
  testosteroneTotalNgDl?: number;

  /** Free Testosterone (ng/dL) */
  @Column({ name: "testosterone_free_ng_dl", type: "numeric", precision: 6, scale: 3, nullable: true })
  testosteroneFreeNgDl?: number;

  /** Estradiol – E2 (pg/mL) */
  @Column({ name: "estradiol_pg_ml", type: "numeric", precision: 7, scale: 2, nullable: true })
  estradiolPgMl?: number;

  /** SHBG – Sex Hormone-Binding Globulin (nmol/L) */
  @Column({ name: "shbg_nmol_l", type: "numeric", precision: 6, scale: 2, nullable: true })
  shbgNmolL?: number;

  /** Prolactin (ng/mL) */
  @Column({ name: "prolactin_ng_ml", type: "numeric", precision: 6, scale: 2, nullable: true })
  prolactinNgMl?: number;

  /** DHT – Dihydrotestosterone (pg/mL) */
  @Column({ name: "dht_pg_ml", type: "numeric", precision: 7, scale: 2, nullable: true })
  dhtPgMl?: number;

  /** FSH – Follicle-Stimulating Hormone (mUI/mL) */
  @Column({ name: "fsh_mui_ml", type: "numeric", precision: 6, scale: 2, nullable: true })
  fshMuiMl?: number;

  /** LH – Luteinising Hormone (mUI/mL) */
  @Column({ name: "lh_mui_ml", type: "numeric", precision: 6, scale: 2, nullable: true })
  lhMuiMl?: number;

  /** Cortisol – morning basal (μg/dL) */
  @Column({ name: "cortisol_mcg_dl", type: "numeric", precision: 6, scale: 2, nullable: true })
  cortisolMcgDl?: number;

  // ── 6. Hepatic & Renal ────────────────────────────────────────────────────

  /** AST – Aspartate Aminotransferase (U/L) */
  @Column({ name: "ast_u_l", type: "numeric", precision: 6, scale: 1, nullable: true })
  astUL?: number;

  /** ALT – Alanine Aminotransferase (U/L) */
  @Column({ name: "alt_u_l", type: "numeric", precision: 6, scale: 1, nullable: true })
  altUL?: number;

  /** GGT – Gamma-Glutamyltransferase (U/L) */
  @Column({ name: "gama_gt_u_l", type: "numeric", precision: 6, scale: 1, nullable: true })
  gamaGtUL?: number;

  /** Creatinine (mg/dL) */
  @Column({ name: "creatinine_mg_dl", type: "numeric", precision: 5, scale: 2, nullable: true })
  creatinineMgDl?: number;

  /** Urea / BUN (mg/dL) */
  @Column({ name: "urea_mg_dl", type: "numeric", precision: 5, scale: 1, nullable: true })
  ureaMgDl?: number;

  // ── 7. Inflammation ───────────────────────────────────────────────────────

  /** C-reactive protein – high-sensitivity (mg/L) */
  @Column({ name: "crp_mg_l", type: "numeric", precision: 5, scale: 2, nullable: true })
  crpMgL?: number;

  // ── Notes & Computed ──────────────────────────────────────────────────────

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
