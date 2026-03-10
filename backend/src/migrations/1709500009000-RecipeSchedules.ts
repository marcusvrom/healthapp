import { MigrationInterface, QueryRunner } from "typeorm";

export class RecipeSchedules1709500009000 implements MigrationInterface {
  name = "RecipeSchedules1709500009000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recipe_schedules" (
        "id"                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "user_id"               UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "meal_name"             TEXT NOT NULL,
        "recipe_id"             TEXT NOT NULL,
        "title"                 TEXT NOT NULL,
        "kcal_per_serving"      NUMERIC(7,2) NOT NULL DEFAULT 0,
        "protein_g_per_serving" NUMERIC(6,2) NOT NULL DEFAULT 0,
        "carbs_g_per_serving"   NUMERIC(6,2) NOT NULL DEFAULT 0,
        "fat_g_per_serving"     NUMERIC(6,2) NOT NULL DEFAULT 0,
        "servings"              NUMERIC(5,2) NOT NULL DEFAULT 1,
        "days_of_week"          INT[] NOT NULL DEFAULT '{}',
        "is_active"             BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "UQ_recipe_schedule_user_meal_recipe"
          UNIQUE ("user_id", "meal_name", "recipe_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_recipe_schedules_user"
        ON "recipe_schedules" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "recipe_schedules"`);
  }
}
