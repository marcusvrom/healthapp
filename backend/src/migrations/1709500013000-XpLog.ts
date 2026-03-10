import { MigrationInterface, QueryRunner } from "typeorm";

export class XpLog1709500013000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "xp_logs" (
        "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
        "user_id"     UUID        NOT NULL,
        "amount"      INTEGER     NOT NULL,
        "category"    TEXT        NOT NULL,
        "source_id"   UUID,
        "awarded_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_xp_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_xp_logs_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_xp_logs_user_awarded"
        ON "xp_logs" ("user_id", "awarded_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "xp_logs"`);
  }
}
