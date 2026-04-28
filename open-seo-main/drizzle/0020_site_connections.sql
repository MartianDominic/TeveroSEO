-- Phase 31-01: Site Connections Schema
-- Stores platform connection credentials (encrypted) and status

CREATE TABLE IF NOT EXISTS "site_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"platform" text NOT NULL,
	"site_url" text NOT NULL,
	"display_name" text,
	"encrypted_credentials" text,
	"capabilities" text[],
	"status" text DEFAULT 'pending' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"last_error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "site_connections" ADD CONSTRAINT "site_connections_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_site_connections_client" ON "site_connections" USING btree ("client_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_site_connections_platform" ON "site_connections" USING btree ("platform");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_site_connections_status" ON "site_connections" USING btree ("status");
