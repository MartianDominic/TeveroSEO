-- Migration: Add goal columns to client_dashboard_metrics
-- Phase 22: Goal-Based Metrics System

ALTER TABLE "client_dashboard_metrics" ADD COLUMN IF NOT EXISTS "goal_attainment_pct" numeric;
ALTER TABLE "client_dashboard_metrics" ADD COLUMN IF NOT EXISTS "goals_met_count" integer DEFAULT 0;
ALTER TABLE "client_dashboard_metrics" ADD COLUMN IF NOT EXISTS "goals_total_count" integer DEFAULT 0;
ALTER TABLE "client_dashboard_metrics" ADD COLUMN IF NOT EXISTS "primary_goal_name" text;
ALTER TABLE "client_dashboard_metrics" ADD COLUMN IF NOT EXISTS "primary_goal_pct" numeric;
ALTER TABLE "client_dashboard_metrics" ADD COLUMN IF NOT EXISTS "primary_goal_trend" text;
ALTER TABLE "client_dashboard_metrics" ADD COLUMN IF NOT EXISTS "priority_score" integer DEFAULT 0;
