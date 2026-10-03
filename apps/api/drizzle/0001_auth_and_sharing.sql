CREATE TYPE "public"."media_visibility" AS ENUM('private', 'public');--> statement-breakpoint
CREATE TABLE "media_shares" (
	"media_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "media_shares_media_id_user_id_pk" PRIMARY KEY("media_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
DROP INDEX "media_kind_status_created_idx";--> statement-breakpoint
DROP INDEX "media_status_created_idx";--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
-- Hand-written: media uploaded before authentication existed has no owner. Park it on a
-- placeholder account that cannot log in (the password hash is not a valid scrypt hash),
-- then hand it to a real user with `pnpm --filter @media-upload/api media:transfer-legacy <email>`.
DO $$
DECLARE legacy_id uuid := '00000000-0000-0000-0000-00000000000a';
BEGIN
  IF EXISTS (SELECT 1 FROM "media" WHERE "owner_id" IS NULL) THEN
    INSERT INTO "users" ("id", "email", "name", "password_hash", "created_at", "updated_at")
    VALUES (legacy_id, 'legacy-owner@invalid', 'Legacy uploads', '!', now(), now())
    ON CONFLICT DO NOTHING;
    UPDATE "media" SET "owner_id" = legacy_id WHERE "owner_id" IS NULL;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "media" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "visibility" "media_visibility" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_shares" ADD CONSTRAINT "media_shares_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_shares" ADD CONSTRAINT "media_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_shares_user_idx" ON "media_shares" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_owner_status_created_idx" ON "media" USING btree ("owner_id","status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "media_status_created_idx" ON "media" USING btree ("status","created_at");