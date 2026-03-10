import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds support for the BLOCKED friendship status.
 *
 * The "status" column is stored as VARCHAR(10), so no column change is needed —
 * the word "BLOCKED" (7 chars) fits within the existing length.
 * This migration only drops the old CHECK constraint (if present) and recreates
 * it to include the new value.
 */
export class FriendshipBlockedStatus1709500017000 implements MigrationInterface {
  name = "FriendshipBlockedStatus1709500017000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop legacy check constraint if it exists (idempotent)
    await queryRunner.query(`
      ALTER TABLE "friendships"
        DROP CONSTRAINT IF EXISTS "CHK_friendship_status"
    `);

    // Recreate with BLOCKED included
    await queryRunner.query(`
      ALTER TABLE "friendships"
        ADD CONSTRAINT "CHK_friendship_status"
        CHECK ("status" IN ('PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "friendships"
        DROP CONSTRAINT IF EXISTS "CHK_friendship_status"
    `);

    await queryRunner.query(`
      ALTER TABLE "friendships"
        ADD CONSTRAINT "CHK_friendship_status"
        CHECK ("status" IN ('PENDING', 'ACCEPTED', 'DECLINED'))
    `);
  }
}
