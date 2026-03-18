import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBlockCompletions1709500023000 implements MigrationInterface {
  name = "CreateBlockCompletions1709500023000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "block_completions" (
        "id"              uuid DEFAULT gen_random_uuid() NOT NULL,
        "block_id"        uuid NOT NULL,
        "user_id"         uuid NOT NULL,
        "completion_date" date NOT NULL,
        "completed_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
        "xp_awarded"      boolean DEFAULT false,
        "created_at"      TIMESTAMP DEFAULT now() NOT NULL,
        CONSTRAINT "PK_block_completions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_block_completion_date" UNIQUE ("block_id", "completion_date"),
        CONSTRAINT "FK_block_completions_block" FOREIGN KEY ("block_id")
          REFERENCES "routine_blocks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_block_completions_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_block_completions_user_date"
        ON "block_completions" ("user_id", "completion_date")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_block_completions_block"
        ON "block_completions" ("block_id")
    `);

    // Migrate existing completedAt data from routine_blocks to block_completions
    await queryRunner.query(`
      INSERT INTO "block_completions" ("block_id", "user_id", "completion_date", "completed_at", "xp_awarded")
      SELECT "id", "user_id",
        COALESCE("routine_date", ("completed_at" AT TIME ZONE 'UTC')::date),
        "completed_at",
        "xp_awarded"
      FROM "routine_blocks"
      WHERE "completed_at" IS NOT NULL
      ON CONFLICT ("block_id", "completion_date") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "block_completions"`);
  }
}
