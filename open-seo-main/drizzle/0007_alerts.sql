-- Migration: alert_rules and alerts tables
-- Phase 18-01: Alert Schema + Rule Engine

-- Create alert_rules table
CREATE TABLE IF NOT EXISTS "alert_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"alert_type" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"threshold" integer,
	"severity" text DEFAULT 'warning' NOT NULL,
	"email_notify" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create alerts table
CREATE TABLE IF NOT EXISTS "alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"rule_id" text,
	"alert_type" text NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"source_event_id" text,
	"email_sent_at" timestamp with time zone,
	"email_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"resolved_at" timestamp with time zone
);

-- Add foreign key for rule_id
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_rule_id_alert_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE set null ON UPDATE no action;

-- Create indexes for alert_rules
CREATE UNIQUE INDEX IF NOT EXISTS "uq_alert_rules_client_type" ON "alert_rules" USING btree ("client_id","alert_type");
CREATE INDEX IF NOT EXISTS "ix_alert_rules_client" ON "alert_rules" USING btree ("client_id");

-- Create indexes for alerts
CREATE INDEX IF NOT EXISTS "ix_alerts_client_status" ON "alerts" USING btree ("client_id","status");
CREATE INDEX IF NOT EXISTS "ix_alerts_client_created" ON "alerts" USING btree ("client_id","created_at");
CREATE INDEX IF NOT EXISTS "ix_alerts_source_event" ON "alerts" USING btree ("source_event_id");
