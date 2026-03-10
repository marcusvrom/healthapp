import { MigrationInterface, QueryRunner } from "typeorm";

export class ClinicalAvatarScheduledMeals1709500003000 implements MigrationInterface {
  name = "ClinicalAvatarScheduledMeals1709500003000";

  public async up(qr: QueryRunner): Promise<void> {
    // ── users: add avatarUrl + xp ─────────────────────────────────────────────
    await qr.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "avatar_url"  TEXT,
        ADD COLUMN IF NOT EXISTS "xp"          INTEGER NOT NULL DEFAULT 0;
    `);

    // ── blood_tests: add testosterone + estradiol markers ────────────────────
    await qr.query(`
      ALTER TABLE "blood_tests"
        ADD COLUMN IF NOT EXISTS "testosterone_total_ng_dl" NUMERIC(7,2),
        ADD COLUMN IF NOT EXISTS "estradiol_pg_ml"          NUMERIC(7,2);
    `);

    // ── scheduled_meals ───────────────────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "scheduled_meals" (
        "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
        "user_id"          UUID         NOT NULL,
        "scheduled_date"   DATE         NOT NULL,
        "name"             TEXT         NOT NULL,
        "scheduled_time"   TEXT         NOT NULL,
        "caloric_target"   NUMERIC(7,2),
        "protein_g"        NUMERIC(6,2),
        "carbs_g"          NUMERIC(6,2),
        "fat_g"            NUMERIC(6,2),
        "foods"            JSONB,
        "is_consumed"      BOOLEAN      NOT NULL DEFAULT FALSE,
        "consumed_at"      TIMESTAMPTZ,
        "xp_awarded"       BOOLEAN      NOT NULL DEFAULT FALSE,
        "notes"            TEXT,
        "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_scheduled_meals" PRIMARY KEY ("id")
      );
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sched_meals_user_date"
        ON "scheduled_meals" ("user_id", "scheduled_date");
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS "scheduled_meals";`);
    await qr.query(`
      ALTER TABLE "blood_tests"
        DROP COLUMN IF EXISTS "testosterone_total_ng_dl",
        DROP COLUMN IF EXISTS "estradiol_pg_ml";
    `);
    await qr.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "avatar_url",
        DROP COLUMN IF EXISTS "xp";
    `);
  }
}
