import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds 'medication' to the block_type_enum so clinical-protocol blocks
 * (supplements, hormones, medications) can be inserted into routine_blocks.
 */
export class AddMedicationBlockType1709500011000 implements MigrationInterface {
  name = "AddMedicationBlockType1709500011000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ALTER TYPE … ADD VALUE is idempotent when guarded with IF NOT EXISTS
    await queryRunner.query(`
      ALTER TYPE "block_type_enum" ADD VALUE IF NOT EXISTS 'medication'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support DROP VALUE from an enum.
    // The safest rollback is a no-op; a full enum recreation would break
    // existing rows that reference this value.
  }
}
