import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNotifications1709500021000 implements MigrationInterface {
  name = "CreateNotifications1709500021000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Notification type enum ──────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "notification_type_enum" AS ENUM (
          'meal_reminder', 'water_reminder', 'exercise_reminder',
          'medication_reminder', 'block_reminder', 'system'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    // ── Notifications table ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"           UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "type"              notification_type_enum NOT NULL DEFAULT 'system',
        "title"             TEXT NOT NULL,
        "message"           TEXT NOT NULL,
        "block_id"          UUID,
        "scheduled_time"    TEXT,
        "notification_date" DATE,
        "is_read"           BOOLEAN NOT NULL DEFAULT false,
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_user_date"
        ON "notifications" ("user_id", "notification_date")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_user_unread"
        ON "notifications" ("user_id", "is_read")
        WHERE "is_read" = false
    `);

    // ── Push subscriptions table ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "push_subscriptions" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"     UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "endpoint"    TEXT NOT NULL,
        "auth_key"    TEXT NOT NULL,
        "p256dh_key"  TEXT NOT NULL,
        "is_active"   BOOLEAN NOT NULL DEFAULT true,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_push_subscriptions_user"
        ON "push_subscriptions" ("user_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_push_subscriptions_endpoint"
        ON "push_subscriptions" ("endpoint")
    `);

    // ── Add notifications_enabled column to users ───────────────────────
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "notifications_enabled" BOOLEAN NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "notifications_enabled"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "push_subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_type_enum"`);
  }
}
