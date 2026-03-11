import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMainActivity1709500019000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "health_profiles"
        ADD COLUMN IF NOT EXISTS "main_activity" TEXT;
    `);

    // Make work times nullable for "flexible" users
    await queryRunner.query(`
      ALTER TABLE "health_profiles"
        ALTER COLUMN "work_start_time" DROP NOT NULL,
        ALTER COLUMN "work_end_time" DROP NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "health_profiles"
        DROP COLUMN IF EXISTS "main_activity";
    `);

    await queryRunner.query(`
      ALTER TABLE "health_profiles"
        ALTER COLUMN "work_start_time" SET NOT NULL,
        ALTER COLUMN "work_end_time" SET NOT NULL;
    `);
  }
}
