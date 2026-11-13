ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "attachment_url" text;
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "attachment_name" text;
