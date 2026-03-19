import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBadgesAndExerciseLogs1709500024000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_badges" (
        "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId"      uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "slug"        varchar(80) NOT NULL,
        "unlockedAt"  timestamptz NOT NULL DEFAULT now(),
        "createdAt"   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_badge_slug" UNIQUE ("userId", "slug")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_badges_userId" ON "user_badges"("userId");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "exercise_logs" (
        "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId"       uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "sheetId"      uuid NOT NULL REFERENCES "workout_sheets"("id") ON DELETE CASCADE,
        "exerciseName" varchar(255) NOT NULL,
        "logDate"      varchar(10) NOT NULL,
        "sets"         int NOT NULL,
        "reps"         varchar(20) NOT NULL,
        "weightKg"     decimal(6,2) DEFAULT 0,
        "notes"        varchar(255),
        "createdAt"    timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_exercise_logs_user_name" ON "exercise_logs"("userId", "exerciseName");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_exercise_logs_user_date" ON "exercise_logs"("userId", "logDate");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "exercise_logs";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_badges";`);
  }
}
