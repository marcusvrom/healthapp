import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds linked_recipes JSONB column to scheduled_meals.
 * This column stores recipe references with nutrition snapshots,
 * enabling recipe-to-meal linking with correct daily consumption tracking.
 */
export class ScheduledMealRecipeLinks1709500008000 implements MigrationInterface {
  name = "ScheduledMealRecipeLinks1709500008000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "scheduled_meals"
        ADD COLUMN IF NOT EXISTS "linked_recipes" JSONB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "scheduled_meals"
        DROP COLUMN IF EXISTS "linked_recipes"
    `);
  }
}
