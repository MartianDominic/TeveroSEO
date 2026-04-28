-- Phase 33-01: Auto-fix Change Tracking Schema
-- Stores all SEO changes, backups, and rollback triggers

CREATE TABLE IF NOT EXISTS "site_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"change_type" text NOT NULL,
	"category" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"resource_url" text NOT NULL,
	"field" text NOT NULL,
	"before_value" text,
	"after_value" text,
	"before_snapshot" jsonb,
	"after_snapshot" jsonb,
	"triggered_by" text NOT NULL,
	"audit_id" text,
	"finding_id" text,
	"user_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"applied_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"reverted_at" timestamp with time zone,
	"reverted_by_change_id" text,
	"batch_id" text,
	"batch_sequence" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "change_backups" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"scope" text NOT NULL,
	"resource_ids" jsonb,
	"snapshot_data" jsonb,
	"created_before_change_id" text,
	"size_bytes" integer,
	"expires_at" timestamp with time zone,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rollback_triggers" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"trigger_type" text NOT NULL,
	"config" jsonb,
	"rollback_scope" jsonb,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"last_check_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "site_changes" ADD CONSTRAINT "site_changes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "site_changes" ADD CONSTRAINT "site_changes_connection_id_site_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."site_connections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "change_backups" ADD CONSTRAINT "change_backups_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rollback_triggers" ADD CONSTRAINT "rollback_triggers_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_site_changes_client" ON "site_changes" USING btree ("client_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_site_changes_connection" ON "site_changes" USING btree ("connection_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_site_changes_category" ON "site_changes" USING btree ("category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_site_changes_status" ON "site_changes" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_site_changes_resource" ON "site_changes" USING btree ("resource_id","resource_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_site_changes_batch" ON "site_changes" USING btree ("batch_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_site_changes_created" ON "site_changes" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_site_changes_reverted" ON "site_changes" USING btree ("reverted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_change_backups_client" ON "change_backups" USING btree ("client_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_change_backups_expires" ON "change_backups" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_change_backups_scope" ON "change_backups" USING btree ("scope");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_rollback_triggers_client" ON "rollback_triggers" USING btree ("client_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_rollback_triggers_type" ON "rollback_triggers" USING btree ("trigger_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_rollback_triggers_enabled" ON "rollback_triggers" USING btree ("is_enabled");
