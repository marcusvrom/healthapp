import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration: RecipeIngredientsAndVersioning
 * ──────────────────────────────────────────
 * 1. Adds `version`, `forked_from_id`, `forked_at_version` columns to `recipes`
 * 2. Creates the `recipe_ingredients` table
 * 3. Adds indexes for ingredient name search and forked_from lookups
 */
export class RecipeIngredientsAndVersioning1709500020000 implements MigrationInterface {
  name = "RecipeIngredientsAndVersioning1709500020000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Add versioning columns to recipes ──────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "recipes"
        ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      ALTER TABLE "recipes"
        ADD COLUMN IF NOT EXISTS "forked_from_id" UUID
    `);
    await queryRunner.query(`
      ALTER TABLE "recipes"
        ADD COLUMN IF NOT EXISTS "forked_at_version" INTEGER
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_recipes_forked_from"
        ON "recipes" ("forked_from_id")
        WHERE "forked_from_id" IS NOT NULL
    `);

    // ── recipe_ingredients ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recipe_ingredients" (
        "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
        "recipe_id"  UUID        NOT NULL,
        "name"       TEXT        NOT NULL,
        "quantity"   NUMERIC(8,2) NOT NULL,
        "unit"       TEXT        NOT NULL,
        "sort_order" INTEGER     NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recipe_ingredients" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_recipe_ingredients_recipe" ON "recipe_ingredients" ("recipe_id")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_recipe_ingredients_name" ON "recipe_ingredients" (LOWER("name"))`
    );

    // ── FK: recipe_ingredients → recipes (cascade delete) ──────────────────
    await queryRunner.query(`
      ALTER TABLE "recipe_ingredients"
        ADD CONSTRAINT "FK_recipe_ingredients_recipe"
        FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id")
        ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "recipe_ingredients"`);
    await queryRunner.query(`ALTER TABLE "recipes" DROP COLUMN IF EXISTS "forked_at_version"`);
    await queryRunner.query(`ALTER TABLE "recipes" DROP COLUMN IF EXISTS "forked_from_id"`);
    await queryRunner.query(`ALTER TABLE "recipes" DROP COLUMN IF EXISTS "version"`);
  }
}
