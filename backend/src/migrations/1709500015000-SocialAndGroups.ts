import { MigrationInterface, QueryRunner } from "typeorm";

export class SocialAndGroups1709500015000 implements MigrationInterface {
  name = "SocialAndGroups1709500015000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── block_posts ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "block_posts" (
        "id"             UUID        NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"        UUID        NOT NULL,
        "block_id"       UUID,
        "block_type"     VARCHAR(40),
        "photo_url"      TEXT,
        "photo_verified" BOOLEAN     NOT NULL DEFAULT false,
        "caption"        TEXT,
        "is_public"      BOOLEAN     NOT NULL DEFAULT true,
        "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_block_posts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_block_posts_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_block_posts_user_created"
        ON "block_posts" ("user_id", "created_at")
    `);

    // ── block_likes ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "block_likes" (
        "id"         UUID        NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"    UUID        NOT NULL,
        "post_id"    UUID        NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_block_likes" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_block_likes_unique"
        ON "block_likes" ("user_id", "post_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_block_likes_post"
        ON "block_likes" ("post_id")
    `);

    // ── block_comments ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "block_comments" (
        "id"         UUID        NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"    UUID        NOT NULL,
        "post_id"    UUID        NOT NULL,
        "body"       TEXT        NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_block_comments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_block_comments_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_block_comments_post"
        ON "block_comments" ("post_id")
    `);

    // ── groups ────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "groups" (
        "id"           UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "name"         VARCHAR(80)  NOT NULL,
        "description"  TEXT,
        "owner_id"     UUID         NOT NULL,
        "invite_code"  VARCHAR(10)  NOT NULL,
        "avatar_emoji" VARCHAR(8)   NOT NULL DEFAULT '👥',
        "is_active"    BOOLEAN      NOT NULL DEFAULT true,
        "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_groups" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_groups_invite_code" UNIQUE ("invite_code")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_groups_invite_code"
        ON "groups" ("invite_code")
    `);

    // ── group_members ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "group_members" (
        "id"        UUID        NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"   UUID        NOT NULL,
        "group_id"  UUID        NOT NULL,
        "joined_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_group_members" PRIMARY KEY ("id"),
        CONSTRAINT "FK_group_members_group" FOREIGN KEY ("group_id")
          REFERENCES "groups"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_group_members_unique"
        ON "group_members" ("user_id", "group_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_group_members_group"
        ON "group_members" ("group_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "group_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "groups"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "block_comments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "block_likes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "block_posts"`);
  }
}
