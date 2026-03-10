import { MigrationInterface, QueryRunner } from "typeorm";

export class ChallengesAndParticipants1709500014000 implements MigrationInterface {
  name = "ChallengesAndParticipants1709500014000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "challenges" (
        "id"           UUID              NOT NULL DEFAULT uuid_generate_v4(),
        "title"        VARCHAR(120)      NOT NULL,
        "description"  TEXT              NOT NULL,
        "category"     VARCHAR(40)       NOT NULL,
        "target_count" INTEGER           NOT NULL,
        "xp_reward"    INTEGER           NOT NULL DEFAULT 50,
        "emoji"        VARCHAR(8)        NOT NULL DEFAULT '🏆',
        "week_start"   DATE              NOT NULL,
        "week_end"     DATE              NOT NULL,
        "is_active"    BOOLEAN           NOT NULL DEFAULT true,
        "created_at"   TIMESTAMPTZ       NOT NULL DEFAULT now(),
        CONSTRAINT "PK_challenges" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_challenges_week"
        ON "challenges" ("week_start", "week_end")
    `);

    await queryRunner.query(`
      CREATE TABLE "challenge_participants" (
        "id"           UUID        NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"      UUID        NOT NULL,
        "challenge_id" UUID        NOT NULL,
        "completed_at" TIMESTAMPTZ,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_challenge_participants" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_challenge_participants_unique"
        ON "challenge_participants" ("user_id", "challenge_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_challenge_participants_challenge"
        ON "challenge_participants" ("challenge_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "challenge_participants"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "challenges"`);
  }
}
