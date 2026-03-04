import { MigrationInterface, QueryRunner } from "typeorm";

export class GoalAndMedications1709500004000 implements MigrationInterface {
  name = "GoalAndMedications1709500004000";

  public async up(qr: QueryRunner): Promise<void> {
    // ── health_profiles: add primaryGoal + targetWeight ───────────────────────
    await qr.query(`
      ALTER TABLE "health_profiles"
        ADD COLUMN IF NOT EXISTS "primary_goal"  TEXT,
        ADD COLUMN IF NOT EXISTS "target_weight" NUMERIC(5,2);
    `);

    // ── medications ───────────────────────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "medications" (
        "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
        "user_id"        TEXT        NOT NULL,
        "name"           TEXT        NOT NULL,
        "type"           TEXT        NOT NULL DEFAULT 'SUPLEMENTO',
        "dosage"         TEXT        NOT NULL,
        "scheduled_time" TEXT        NOT NULL,
        "notes"          TEXT,
        "is_active"      BOOLEAN     NOT NULL DEFAULT TRUE,
        "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_medications" PRIMARY KEY ("id")
      );
    `);
    await qr.query(`CREATE INDEX IF NOT EXISTS "IDX_medications_user" ON "medications" ("user_id");`);

    // ── medication_logs ───────────────────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "medication_logs" (
        "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
        "user_id"        TEXT        NOT NULL,
        "medication_id"  TEXT        NOT NULL,
        "taken_date"     DATE        NOT NULL,
        "taken_at"       TIMESTAMPTZ NOT NULL,
        "xp_awarded"     BOOLEAN     NOT NULL DEFAULT FALSE,
        "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_medication_logs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_med_log_med_date" UNIQUE ("medication_id", "taken_date")
      );
    `);
    await qr.query(`CREATE INDEX IF NOT EXISTS "IDX_med_logs_user_date" ON "medication_logs" ("user_id", "taken_date");`);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS "medication_logs";`);
    await qr.query(`DROP TABLE IF EXISTS "medications";`);
    await qr.query(`
      ALTER TABLE "health_profiles"
        DROP COLUMN IF EXISTS "primary_goal",
        DROP COLUMN IF EXISTS "target_weight";
    `);
  }
}
