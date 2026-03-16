import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateWorkoutSheets1709500022000 implements MigrationInterface {
  name = "CreateWorkoutSheets1709500022000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Workout sheets table ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workout_sheets" (
        "id"                uuid DEFAULT gen_random_uuid() NOT NULL,
        "user_id"           uuid NOT NULL,
        "name"              text NOT NULL,
        "description"       text,
        "category"          varchar(40),
        "days_of_week"      integer[] DEFAULT '{}',
        "estimated_minutes" smallint DEFAULT 60,
        "is_active"         boolean DEFAULT true,
        "from_template"     varchar(60),
        "created_at"        TIMESTAMP DEFAULT now() NOT NULL,
        "updated_at"        TIMESTAMP DEFAULT now() NOT NULL,
        CONSTRAINT "PK_workout_sheets" PRIMARY KEY ("id"),
        CONSTRAINT "FK_workout_sheets_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_workout_sheets_user" ON "workout_sheets" ("user_id")
    `);

    // ── Workout sheet exercises table ─────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workout_sheet_exercises" (
        "id"            uuid DEFAULT gen_random_uuid() NOT NULL,
        "sheet_id"      uuid NOT NULL,
        "name"          text NOT NULL,
        "sets"          smallint DEFAULT 3,
        "reps"          varchar(20) DEFAULT '8-12',
        "rest_seconds"  smallint DEFAULT 60,
        "notes"         text,
        "sort_order"    smallint DEFAULT 0,
        CONSTRAINT "PK_workout_sheet_exercises" PRIMARY KEY ("id"),
        CONSTRAINT "FK_wse_sheet" FOREIGN KEY ("sheet_id")
          REFERENCES "workout_sheets"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_wse_sheet" ON "workout_sheet_exercises" ("sheet_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "workout_sheet_exercises"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workout_sheets"`);
  }
}
