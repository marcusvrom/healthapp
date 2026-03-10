import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * WaterHormoneWeightSchema
 * ─────────────────────────
 * Creates:
 *   water_logs   – per-drink water intake with retroactive timestamps
 *   hormone_logs – hormone / supplement administration records
 *   weight_logs  – time-series body-weight measurements
 */
export class WaterHormoneWeightSchema1709500002000 implements MigrationInterface {
  name = "WaterHormoneWeightSchema1709500002000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── ENUM: hormone categories ───────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "hormone_category_enum" AS ENUM (
        'TRT', 'Female_Hormones', 'Sleep', 'Other'
      )
    `);

    // ── water_logs ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "water_logs" (
        "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
        "user_id"     UUID         NOT NULL,
        "quantity_ml" INT          NOT NULL CHECK ("quantity_ml" > 0),
        "logged_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_water_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_water_logs_users"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_water_logs_user_date"
        ON "water_logs" ("user_id", "logged_at")
    `);

    // ── hormone_logs ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "hormone_logs" (
        "id"              UUID                    NOT NULL DEFAULT gen_random_uuid(),
        "user_id"         UUID                    NOT NULL,
        "category"        "hormone_category_enum" NOT NULL DEFAULT 'Other',
        "name"            VARCHAR(255)            NOT NULL,
        "dosage"          NUMERIC(10,3)           NOT NULL,
        "unit"            VARCHAR(32)             NOT NULL,
        "administered_at" TIMESTAMPTZ             NOT NULL,
        "notes"           TEXT,
        "created_at"      TIMESTAMPTZ             NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMPTZ             NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hormone_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_hormone_logs_users"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_hormone_logs_user_cat"
        ON "hormone_logs" ("user_id", "category")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_hormone_logs_user_at"
        ON "hormone_logs" ("user_id", "administered_at" DESC)
    `);

    // ── weight_logs ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "weight_logs" (
        "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
        "user_id"     UUID         NOT NULL,
        "weight_kg"   NUMERIC(5,2) NOT NULL CHECK ("weight_kg" > 0),
        "recorded_at" DATE         NOT NULL,
        "notes"       TEXT,
        "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_weight_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_weight_logs_users"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_weight_logs_user_date"
        ON "weight_logs" ("user_id", "recorded_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "weight_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hormone_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "water_logs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "hormone_category_enum"`);
  }
}
