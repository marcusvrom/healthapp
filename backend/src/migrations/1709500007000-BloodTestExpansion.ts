import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * BloodTestExpansion
 * ──────────────────
 * Extends the `blood_tests` table with a comprehensive hormonal, thyroid,
 * and hepatic/renal panel on top of the existing metabolic + lipid columns.
 *
 * New columns (14 total):
 *
 *  Thyroid (extended)
 *    t3_free_pg_ml          — Free T3 (pg/mL)
 *    t4_free_ng_dl          — Free T4 (ng/dL)
 *
 *  Hormonal panel
 *    testosterone_free_ng_dl — Free Testosterone (ng/dL)
 *    shbg_nmol_l             — SHBG (nmol/L)
 *    prolactin_ng_ml         — Prolactin (ng/mL)
 *    dht_pg_ml               — DHT (pg/mL)
 *    fsh_mui_ml              — FSH (mUI/mL)
 *    lh_mui_ml               — LH (mUI/mL)
 *    cortisol_mcg_dl         — Cortisol morning basal (μg/dL)
 *
 *  Hepatic & Renal
 *    ast_u_l                 — AST (U/L)
 *    alt_u_l                 — ALT (U/L)
 *    gama_gt_u_l             — GGT (U/L)
 *    creatinine_mg_dl        — Creatinine (mg/dL)
 *    urea_mg_dl              — Urea/BUN (mg/dL)
 *
 * All columns are nullable — a NULL value means the marker was not measured
 * in that test snapshot.
 *
 * Already present (added in earlier migrations, no change here):
 *   testosterone_total_ng_dl, estradiol_pg_ml (migration 1709500003000)
 *   tsh_miu_l, hba1c_pct                     (InitialSchema 1709500000000)
 */
export class BloodTestExpansion1709500007000 implements MigrationInterface {
  name = "BloodTestExpansion1709500007000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Thyroid (extended) ────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "blood_tests"
        ADD COLUMN IF NOT EXISTS "t3_free_pg_ml"  NUMERIC(5,2),
        ADD COLUMN IF NOT EXISTS "t4_free_ng_dl"  NUMERIC(5,2)
    `);

    // ── Hormonal panel ────────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "blood_tests"
        ADD COLUMN IF NOT EXISTS "testosterone_free_ng_dl" NUMERIC(6,3),
        ADD COLUMN IF NOT EXISTS "shbg_nmol_l"             NUMERIC(6,2),
        ADD COLUMN IF NOT EXISTS "prolactin_ng_ml"         NUMERIC(6,2),
        ADD COLUMN IF NOT EXISTS "dht_pg_ml"               NUMERIC(7,2),
        ADD COLUMN IF NOT EXISTS "fsh_mui_ml"              NUMERIC(6,2),
        ADD COLUMN IF NOT EXISTS "lh_mui_ml"               NUMERIC(6,2),
        ADD COLUMN IF NOT EXISTS "cortisol_mcg_dl"         NUMERIC(6,2)
    `);

    // ── Hepatic & Renal ───────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "blood_tests"
        ADD COLUMN IF NOT EXISTS "ast_u_l"          NUMERIC(6,1),
        ADD COLUMN IF NOT EXISTS "alt_u_l"          NUMERIC(6,1),
        ADD COLUMN IF NOT EXISTS "gama_gt_u_l"      NUMERIC(6,1),
        ADD COLUMN IF NOT EXISTS "creatinine_mg_dl" NUMERIC(5,2),
        ADD COLUMN IF NOT EXISTS "urea_mg_dl"       NUMERIC(5,1)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "blood_tests"
        DROP COLUMN IF EXISTS "t3_free_pg_ml",
        DROP COLUMN IF EXISTS "t4_free_ng_dl",
        DROP COLUMN IF EXISTS "testosterone_free_ng_dl",
        DROP COLUMN IF EXISTS "shbg_nmol_l",
        DROP COLUMN IF EXISTS "prolactin_ng_ml",
        DROP COLUMN IF EXISTS "dht_pg_ml",
        DROP COLUMN IF EXISTS "fsh_mui_ml",
        DROP COLUMN IF EXISTS "lh_mui_ml",
        DROP COLUMN IF EXISTS "cortisol_mcg_dl",
        DROP COLUMN IF EXISTS "ast_u_l",
        DROP COLUMN IF EXISTS "alt_u_l",
        DROP COLUMN IF EXISTS "gama_gt_u_l",
        DROP COLUMN IF EXISTS "creatinine_mg_dl",
        DROP COLUMN IF EXISTS "urea_mg_dl"
    `);
  }
}
