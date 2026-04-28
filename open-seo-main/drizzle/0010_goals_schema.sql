-- Migration: Goal-based metrics schema
-- Phase 22: Goal-Based Metrics System

-- Goal templates table (system-level definitions)
CREATE TABLE IF NOT EXISTS "goal_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"goal_type" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"description" text,
	"unit" text,
	"default_target" numeric,
	"has_denominator" boolean DEFAULT false,
	"computation_method" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);

-- Client goals table (per-client configurations)
CREATE TABLE IF NOT EXISTS "client_goals" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"template_id" text NOT NULL REFERENCES "goal_templates"("id"),
	"target_value" numeric NOT NULL,
	"target_denominator" integer,
	"custom_name" text,
	"custom_description" text,
	"current_value" numeric,
	"attainment_pct" numeric,
	"trend_direction" text,
	"trend_value" numeric,
	"last_computed_at" timestamp with time zone,
	"is_primary" boolean DEFAULT false,
	"is_client_visible" boolean DEFAULT true,
	"notify_on_regression" boolean DEFAULT true,
	"regression_threshold" numeric DEFAULT '10',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);

-- Goal snapshots table (historical tracking)
CREATE TABLE IF NOT EXISTS "goal_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"goal_id" text NOT NULL REFERENCES "client_goals"("id") ON DELETE CASCADE,
	"snapshot_date" timestamp with time zone NOT NULL,
	"current_value" numeric,
	"attainment_pct" numeric,
	"created_at" timestamp with time zone DEFAULT now()
);

-- Indexes for client_goals
CREATE INDEX IF NOT EXISTS "idx_client_goals_client" ON "client_goals" USING btree ("client_id");
CREATE INDEX IF NOT EXISTS "idx_client_goals_workspace" ON "client_goals" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_client_goals_template" ON "client_goals" USING btree ("template_id");

-- Index for goal_snapshots
CREATE INDEX IF NOT EXISTS "idx_goal_snapshots_goal_date" ON "goal_snapshots" USING btree ("goal_id", "snapshot_date");
