-- Phase 30-07: Auto-Onboarding
-- Creates clients table for converted prospects

CREATE TABLE IF NOT EXISTS "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"contact_email" text,
	"contact_name" text,
	"industry" text,
	"status" text DEFAULT 'onboarding' NOT NULL,
	"converted_from_prospect_id" text,
	"gsc_refresh_token" text,
	"gsc_site_url" text,
	"gsc_connected_at" timestamp with time zone,
	"kickoff_scheduled_at" timestamp with time zone,
	"kickoff_completed_at" timestamp with time zone,
	"onboarding_completed_at" timestamp with time zone,
	"baseline_metrics" jsonb,
	"target_keywords" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "clients_converted_from_prospect_id_prospects_id_fk" FOREIGN KEY ("converted_from_prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_clients_workspace" ON "clients" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_clients_status" ON "clients" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ix_clients_workspace_domain" ON "clients" USING btree ("workspace_id","domain");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_clients_converted_prospect" ON "clients" USING btree ("converted_from_prospect_id");
