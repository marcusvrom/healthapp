import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration: RecipesAndDiabetic
 * ─────────────────────────────
 * 1. Creates the `recipes` table (community recipe library with macro data)
 * 2. Creates the `recipe_reviews` table (ratings + likes, one per user/recipe)
 * 3. Notes: `diabetico` is a new value for the `primary_goal` TEXT column that
 *    already exists in `health_profiles` — no DDL change needed for it since
 *    the column is a plain TEXT type.
 */
export class RecipesAndDiabetic1709500006000 implements MigrationInterface {
  name = "RecipesAndDiabetic1709500006000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── recipes ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recipes" (
        "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
        "author_id"    TEXT        NOT NULL,
        "title"        TEXT        NOT NULL,
        "description"  TEXT,
        "instructions" TEXT        NOT NULL,
        "kcal"         NUMERIC(8,2) NOT NULL,
        "protein_g"    NUMERIC(6,2) NOT NULL DEFAULT 0,
        "carbs_g"      NUMERIC(6,2) NOT NULL DEFAULT 0,
        "fat_g"        NUMERIC(6,2) NOT NULL DEFAULT 0,
        "servings"     INTEGER      NOT NULL DEFAULT 1,
        "prep_time_min" INTEGER,
        "is_public"    BOOLEAN      NOT NULL DEFAULT false,
        "is_active"    BOOLEAN      NOT NULL DEFAULT true,
        "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recipes" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_recipes_author" ON "recipes" ("author_id")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_recipes_public" ON "recipes" ("is_public", "is_active")`
    );

    // ── recipe_reviews ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recipe_reviews" (
        "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
        "recipe_id"  TEXT        NOT NULL,
        "user_id"    TEXT        NOT NULL,
        "rating"     SMALLINT    NOT NULL DEFAULT 0,
        "is_liked"   BOOLEAN     NOT NULL DEFAULT false,
        "comment"    TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recipe_reviews" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_recipe_review_user_recipe" UNIQUE ("recipe_id", "user_id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_recipe_reviews_recipe" ON "recipe_reviews" ("recipe_id")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_recipe_reviews_user" ON "recipe_reviews" ("user_id")`
    );

    // ── FK: recipe_reviews → recipes (cascade delete reviews when recipe deleted) ─
    await queryRunner.query(`
      ALTER TABLE "recipe_reviews"
        ADD CONSTRAINT "FK_recipe_reviews_recipe"
        FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id")
        ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "recipe_reviews"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "recipes"`);
  }
}
