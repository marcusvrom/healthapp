import { MigrationInterface, QueryRunner } from "typeorm";

export class WeeklyCheckIn1709500012000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "weekly_check_ins" (
        "id"                   UUID         NOT NULL DEFAULT gen_random_uuid(),
        "user_id"              UUID         NOT NULL,
        "date"                 DATE         NOT NULL,
        "current_weight"       NUMERIC(5,2) NOT NULL,
        "waist_circumference"  NUMERIC(5,1),
        "adherence_score"      SMALLINT     NOT NULL CHECK ("adherence_score" BETWEEN 1 AND 5),
        "notes"                TEXT,
        "created_at"           TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_weekly_check_ins" PRIMARY KEY ("id"),
        CONSTRAINT "FK_weekly_check_ins_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_weekly_check_ins_user_date"
        ON "weekly_check_ins" ("user_id", "date")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "weekly_check_ins"`);
  }
}
