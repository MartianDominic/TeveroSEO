-- Migration: 0003_analytics_snapshots
-- Description: Create analytics snapshot tables for GSC and GA4 data
--
-- Tables created:
--   - gsc_snapshots: Daily GSC aggregate metrics per client
--   - gsc_query_snapshots: Top queries per day per client (up to 50)
--   - ga4_snapshots: Daily GA4 metrics per client
--
-- Note: client_id is a UUID reference to AI-Writer's clients table.
-- No FK constraint since tables are in different databases.

-- GSC daily aggregate snapshots
CREATE TABLE IF NOT EXISTS "gsc_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"date" date NOT NULL,
	"site_url" text NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"ctr" real DEFAULT 0 NOT NULL,
	"position" real DEFAULT 0 NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_gsc_snapshots_client_date" UNIQUE("client_id","date")
);

CREATE INDEX IF NOT EXISTS "ix_gsc_snapshots_client_date" ON "gsc_snapshots" USING btree ("client_id","date");

-- GSC top queries per day
CREATE TABLE IF NOT EXISTS "gsc_query_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"date" date NOT NULL,
	"query" text NOT NULL,
	"clicks" integer DEFAULT 0,
	"impressions" integer DEFAULT 0,
	"ctr" real DEFAULT 0,
	"position" real DEFAULT 0,
	CONSTRAINT "uq_gsc_query_snapshots_client_date_query" UNIQUE("client_id","date","query")
);

CREATE INDEX IF NOT EXISTS "ix_gsc_query_snapshots_client_date" ON "gsc_query_snapshots" USING btree ("client_id","date");

-- GA4 daily aggregate snapshots
CREATE TABLE IF NOT EXISTS "ga4_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"date" date NOT NULL,
	"property_id" text NOT NULL,
	"sessions" integer DEFAULT 0,
	"users" integer DEFAULT 0,
	"new_users" integer DEFAULT 0,
	"bounce_rate" real DEFAULT 0,
	"avg_session_duration" real DEFAULT 0,
	"conversions" integer DEFAULT 0,
	"revenue" real DEFAULT 0,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_ga4_snapshots_client_date" UNIQUE("client_id","date")
);

CREATE INDEX IF NOT EXISTS "ix_ga4_snapshots_client_date" ON "ga4_snapshots" USING btree ("client_id","date");
