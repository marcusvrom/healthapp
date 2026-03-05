import { MigrationInterface, QueryRunner } from "typeorm";

export class RoutineBlockCompletion1709500010000 implements MigrationInterface {
  name = "RoutineBlockCompletion1709500010000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "routine_blocks"
        ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "xp_awarded"   BOOLEAN NOT NULL DEFAULT FALSE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "routine_blocks"
        DROP COLUMN IF EXISTS "completed_at",
        DROP COLUMN IF EXISTS "xp_awarded"
    `);
  }
}
