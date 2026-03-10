import { MigrationInterface, QueryRunner } from "typeorm";

export class FriendshipDailyMissionRegional1709500016000 implements MigrationInterface {
  name = "FriendshipDailyMissionRegional1709500016000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── users: city + state ────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "city"  VARCHAR(80),
        ADD COLUMN IF NOT EXISTS "state" VARCHAR(80)
    `);

    // ── friendships ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "friendships" (
        "id"           UUID        NOT NULL DEFAULT uuid_generate_v4(),
        "requester_id" UUID        NOT NULL,
        "addressee_id" UUID        NOT NULL,
        "status"       VARCHAR(10) NOT NULL DEFAULT 'PENDING',
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_friendships" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_friendship_pair" UNIQUE ("requester_id", "addressee_id"),
        CONSTRAINT "FK_friendships_requester" FOREIGN KEY ("requester_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_friendships_addressee" FOREIGN KEY ("addressee_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_friendships_requester" ON "friendships" ("requester_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_friendships_addressee" ON "friendships" ("addressee_id")
    `);

    // ── daily_missions ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "daily_missions" (
        "id"           UUID        NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"      UUID        NOT NULL,
        "date"         DATE        NOT NULL,
        "title"        VARCHAR(120) NOT NULL,
        "xp_reward"    INT         NOT NULL,
        "is_completed" BOOLEAN     NOT NULL DEFAULT false,
        "mission_type" VARCHAR(30) NOT NULL,
        "completed_at" TIMESTAMPTZ,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_daily_missions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_daily_missions_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_daily_missions_user_date"
        ON "daily_missions" ("user_id", "date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "daily_missions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "friendships"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "city"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "state"`);
  }
}
