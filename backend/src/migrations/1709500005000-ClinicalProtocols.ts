import { MigrationInterface, QueryRunner } from "typeorm";

export class ClinicalProtocols1709500005000 implements MigrationInterface {
  name = "ClinicalProtocols1709500005000";

  public async up(qr: QueryRunner): Promise<void> {
    // ── Extend block_type PostgreSQL ENUM with 'medication' ──────────────────
    // ALTER TYPE ... ADD VALUE is not transactional in PG, so we check first
    await qr.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'medication'
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'block_type')
        ) THEN
          ALTER TYPE block_type ADD VALUE 'medication';
        END IF;
      END
      $$;
    `);

    // ── clinical_protocols ────────────────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "clinical_protocols" (
        "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
        "user_id"        TEXT         NOT NULL,
        "name"           TEXT         NOT NULL,
        "category"       TEXT         NOT NULL DEFAULT 'SUPLEMENTO',
        "dosage"         TEXT         NOT NULL,
        "scheduled_time" TEXT         NOT NULL,
        "days_of_week"   JSONB        NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
        "notes"          TEXT,
        "is_active"      BOOLEAN      NOT NULL DEFAULT TRUE,
        "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_clinical_protocols" PRIMARY KEY ("id")
      );
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS "IDX_clinical_protocols_user"
        ON "clinical_protocols" ("user_id");
    `);

    // ── clinical_protocol_logs ────────────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "clinical_protocol_logs" (
        "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
        "user_id"     TEXT         NOT NULL,
        "protocol_id" TEXT         NOT NULL,
        "taken_date"  DATE         NOT NULL,
        "taken_at"    TIMESTAMPTZ  NOT NULL,
        "xp_awarded"  BOOLEAN      NOT NULL DEFAULT FALSE,
        "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_clinical_protocol_logs"     PRIMARY KEY ("id"),
        CONSTRAINT "UQ_cp_log_proto_date" UNIQUE ("protocol_id", "taken_date")
      );
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cp_logs_user_date"
        ON "clinical_protocol_logs" ("user_id", "taken_date");
    `);

    // Ensure primary_goal column exists in health_profiles (idempotent)
    await qr.query(`
      ALTER TABLE "health_profiles"
        ADD COLUMN IF NOT EXISTS "primary_goal"   TEXT,
        ADD COLUMN IF NOT EXISTS "target_weight"  NUMERIC(5,2);
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS "clinical_protocol_logs";`);
    await qr.query(`DROP TABLE IF EXISTS "clinical_protocols";`);
    // Note: cannot remove enum values in PostgreSQL without recreating the type
  }
}
