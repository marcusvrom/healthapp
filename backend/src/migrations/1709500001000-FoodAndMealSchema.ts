import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * FoodAndMealSchema
 * ─────────────────
 * Creates:
 *   foods      – nutritional database (TACO / TBCA / OpenFoodFacts / UserCustom)
 *   meals      – eating events per user per day
 *   meal_foods – join table: meal ↔ food + quantity consumed
 *
 * Also enables pg_trgm for fast trigram-based full-text search on food names.
 */
export class FoodAndMealSchema1709500001000 implements MigrationInterface {
  name = "FoodAndMealSchema1709500001000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable trigram extension for fuzzy / partial-name search
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    // ── ENUM ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "food_source_enum" AS ENUM (
        'TACO', 'TBCA', 'OpenFoodFacts', 'UserCustom'
      )
    `);

    // ── foods ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "foods" (
        "id"                UUID            NOT NULL DEFAULT gen_random_uuid(),
        "name"              VARCHAR(512)    NOT NULL,
        "household_measure" VARCHAR(255),
        "grams_reference"   NUMERIC(7,2),
        "calories"          NUMERIC(7,2)    NOT NULL DEFAULT 0,
        "carbs"             NUMERIC(6,2)    NOT NULL DEFAULT 0,
        "protein"           NUMERIC(6,2)    NOT NULL DEFAULT 0,
        "fat"               NUMERIC(6,2)    NOT NULL DEFAULT 0,
        "fiber"             NUMERIC(6,2),
        "sodium"            NUMERIC(7,2),
        "source"            "food_source_enum" NOT NULL DEFAULT 'UserCustom',
        "barcode"           VARCHAR(64)     UNIQUE,
        "external_id"       VARCHAR(128),
        "created_at"        TIMESTAMPTZ     NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMPTZ     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_foods" PRIMARY KEY ("id")
      )
    `);

    // GIN trigram index for fast ILIKE name searches
    await queryRunner.query(`
      CREATE INDEX "IDX_foods_name_trgm"
        ON "foods" USING GIN ("name" gin_trgm_ops)
    `);

    // ── meals ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "meals" (
        "id"         UUID              NOT NULL DEFAULT gen_random_uuid(),
        "user_id"    UUID              NOT NULL,
        "meal_date"  DATE              NOT NULL,
        "meal_type"  "meal_type_enum"  NOT NULL,
        "notes"      TEXT,
        "created_at" TIMESTAMPTZ       NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ       NOT NULL DEFAULT now(),
        CONSTRAINT "PK_meals" PRIMARY KEY ("id"),
        CONSTRAINT "FK_meals_users"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_meals_user_date"
        ON "meals" ("user_id", "meal_date")
    `);

    // ── meal_foods ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "meal_foods" (
        "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
        "meal_id"    UUID         NOT NULL,
        "food_id"    UUID         NOT NULL,
        "quantity_g" NUMERIC(7,2) NOT NULL,
        "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_meal_foods" PRIMARY KEY ("id"),
        CONSTRAINT "FK_meal_foods_meals"
          FOREIGN KEY ("meal_id") REFERENCES "meals"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_meal_foods_foods"
          FOREIGN KEY ("food_id") REFERENCES "foods"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_meal_foods_meal_id"
        ON "meal_foods" ("meal_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "meal_foods"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "meals"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "foods"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "food_source_enum"`);
  }
}
