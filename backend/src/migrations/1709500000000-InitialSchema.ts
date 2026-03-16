import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * InitialSchema – creates all tables for the AiraFit MVP.
 *
 * Tables created:
 *   users, health_profiles, blood_tests, exercises, routine_blocks
 *
 * Run via:  make migrate
 * Revert via: make migrate-revert
 */
export class InitialSchema1709500000000 implements MigrationInterface {
  name = "InitialSchema1709500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── ENUMs ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "gender_enum" AS ENUM ('male', 'female', 'other')
    `);

    await queryRunner.query(`
      CREATE TYPE "activity_factor_enum" AS ENUM (
        'sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "exercise_category_enum" AS ENUM (
        'strength', 'cardio', 'flexibility', 'mind_body', 'sports'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "block_type_enum" AS ENUM (
        'sleep', 'work', 'exercise', 'meal', 'water', 'sun_exposure', 'free', 'custom'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "meal_type_enum" AS ENUM (
        'breakfast', 'morning_snack', 'lunch', 'afternoon_snack',
        'pre_workout', 'post_workout', 'dinner', 'supper'
      )
    `);

    // ── users ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
        "email"         VARCHAR(255)  NOT NULL,
        "name"          VARCHAR(255)  NOT NULL,
        "password_hash" VARCHAR(255)  NOT NULL,
        "is_active"     BOOLEAN       NOT NULL DEFAULT true,
        "created_at"    TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    // ── health_profiles ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "health_profiles" (
        "id"              UUID                    NOT NULL DEFAULT gen_random_uuid(),
        "user_id"         UUID                    NOT NULL,
        "age"             INTEGER                 NOT NULL,
        "weight"          NUMERIC(5,2)            NOT NULL,
        "height"          NUMERIC(5,2)            NOT NULL,
        "gender"          "gender_enum"           NOT NULL,
        "activity_factor" "activity_factor_enum"  NOT NULL DEFAULT 'sedentary',
        "wake_up_time"    VARCHAR(5)              NOT NULL DEFAULT '07:00',
        "sleep_time"      VARCHAR(5)              NOT NULL DEFAULT '23:00',
        "work_start_time" VARCHAR(5)              NOT NULL DEFAULT '09:00',
        "work_end_time"   VARCHAR(5)              NOT NULL DEFAULT '18:00',
        "caloric_goal"    NUMERIC(7,2),
        "protein_goal_g"  NUMERIC(6,2),
        "carbs_goal_g"    NUMERIC(6,2),
        "fat_goal_g"      NUMERIC(6,2),
        "created_at"      TIMESTAMPTZ             NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMPTZ             NOT NULL DEFAULT now(),
        CONSTRAINT "PK_health_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_health_profiles_user_id" UNIQUE ("user_id"),
        CONSTRAINT "FK_health_profiles_users"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // ── blood_tests ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "blood_tests" (
        "id"                       UUID         NOT NULL DEFAULT gen_random_uuid(),
        "user_id"                  UUID         NOT NULL,
        "collected_at"             DATE         NOT NULL,
        "glucose_mg_dl"            NUMERIC(6,2),
        "insulin_uiu_ml"           NUMERIC(6,2),
        "hba1c_pct"                NUMERIC(4,2),
        "cholesterol_total_mg_dl"  NUMERIC(6,2),
        "ldl_mg_dl"                NUMERIC(6,2),
        "hdl_mg_dl"                NUMERIC(6,2),
        "triglycerides_mg_dl"      NUMERIC(6,2),
        "vitamin_d_ng_ml"          NUMERIC(5,2),
        "vitamin_b12_pg_ml"        NUMERIC(7,2),
        "ferritin_ng_ml"           NUMERIC(7,2),
        "tsh_miu_l"                NUMERIC(6,3),
        "crp_mg_l"                 NUMERIC(5,2),
        "notes"                    TEXT,
        "computed_adjustments"     JSONB,
        "created_at"               TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"               TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_blood_tests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_blood_tests_users"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_blood_tests_user_collected"
        ON "blood_tests" ("user_id", "collected_at" DESC)
    `);

    // ── exercises ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "exercises" (
        "id"                UUID                      NOT NULL DEFAULT gen_random_uuid(),
        "health_profile_id" UUID                      NOT NULL,
        "name"              VARCHAR(255)              NOT NULL,
        "category"          "exercise_category_enum"  NOT NULL DEFAULT 'strength',
        "met"               NUMERIC(5,2)              NOT NULL,
        "hypertrophy_score" SMALLINT                  NOT NULL DEFAULT 5,
        "duration_minutes"  SMALLINT                  NOT NULL DEFAULT 60,
        "preferred_time"    VARCHAR(5),
        "days_of_week"      INTEGER[]                 NOT NULL DEFAULT '{}',
        "created_at"        TIMESTAMPTZ               NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMPTZ               NOT NULL DEFAULT now(),
        CONSTRAINT "PK_exercises" PRIMARY KEY ("id"),
        CONSTRAINT "FK_exercises_health_profiles"
          FOREIGN KEY ("health_profile_id") REFERENCES "health_profiles"("id") ON DELETE CASCADE
      )
    `);

    // ── routine_blocks ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "routine_blocks" (
        "id"              UUID               NOT NULL DEFAULT gen_random_uuid(),
        "user_id"         UUID               NOT NULL,
        "routine_date"    DATE               NOT NULL,
        "type"            "block_type_enum"  NOT NULL,
        "start_time"      VARCHAR(5)         NOT NULL,
        "end_time"        VARCHAR(5)         NOT NULL,
        "label"           VARCHAR(255)       NOT NULL,
        "meal_type"       "meal_type_enum",
        "caloric_target"  NUMERIC(7,2),
        "water_ml"        NUMERIC(6,2),
        "metadata"        JSONB,
        "sort_order"      INTEGER            NOT NULL DEFAULT 0,
        "created_at"      TIMESTAMPTZ        NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMPTZ        NOT NULL DEFAULT now(),
        CONSTRAINT "PK_routine_blocks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_routine_blocks_users"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_routine_blocks_user_date"
        ON "routine_blocks" ("user_id", "routine_date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "routine_blocks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "exercises"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "blood_tests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "health_profiles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "meal_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "block_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "exercise_category_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "activity_factor_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "gender_enum"`);
  }
}
