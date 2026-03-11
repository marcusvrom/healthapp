import { MigrationInterface, QueryRunner } from "typeorm";

export class CanvasRecurrenceColumns1709500018000 implements MigrationInterface {
  name = "CanvasRecurrenceColumns1709500018000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── RoutineBlock: add recurrence support ──────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "routine_blocks"
        ADD COLUMN IF NOT EXISTS "is_recurring" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "days_of_week" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);

    // Allow routine_date to be nullable (recurring blocks may not have a specific date)
    await queryRunner.query(`
      ALTER TABLE "routine_blocks"
        ALTER COLUMN "routine_date" DROP NOT NULL
    `);

    // Add 'study' to the block type enum
    await queryRunner.query(`
      ALTER TYPE "routine_blocks_type_enum" ADD VALUE IF NOT EXISTS 'study'
    `);

    // ── ScheduledMeal: add recurrence support ─────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "scheduled_meals"
        ADD COLUMN IF NOT EXISTS "is_recurring" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "days_of_week" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);

    // Allow scheduled_date to be nullable (recurring meals may not have a specific date)
    await queryRunner.query(`
      ALTER TABLE "scheduled_meals"
        ALTER COLUMN "scheduled_date" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── ScheduledMeal: revert ─────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "scheduled_meals"
        ALTER COLUMN "scheduled_date" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "scheduled_meals"
        DROP COLUMN IF EXISTS "days_of_week",
        DROP COLUMN IF EXISTS "is_recurring"
    `);

    // ── RoutineBlock: revert ──────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "routine_blocks"
        ALTER COLUMN "routine_date" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "routine_blocks"
        DROP COLUMN IF EXISTS "days_of_week",
        DROP COLUMN IF EXISTS "is_recurring"
    `);
  }
}
