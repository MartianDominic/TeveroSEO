-- Phase 62-01: Agency Command Center Schema
-- Creates tables for follow-ups, workflows, deal outcomes, pipeline metrics, alerts, and preferences
-- Transaction wrapper added for atomic execution (FIX-13: HIGH-02-01)

BEGIN;

-- Follow-up rules table (must be created before follow_ups due to FK)
CREATE TABLE IF NOT EXISTS "follow_up_rules" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "entity_type" text NOT NULL,
  "trigger_conditions" jsonb NOT NULL,
  "action_type" text NOT NULL,
  "action_config" jsonb NOT NULL,
  "delay_hours" integer DEFAULT 0,
  "repeat_interval_hours" integer,
  "max_repeats" integer DEFAULT 1,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "chk_follow_up_rules_entity_type" CHECK (entity_type IN ('prospect', 'proposal', 'contract', 'invoice', 'client')),
  CONSTRAINT "chk_follow_up_rules_action_type" CHECK (action_type IN ('create_follow_up', 'send_notification', 'escalate', 'auto_reminder'))
);

CREATE INDEX IF NOT EXISTS "ix_follow_up_rules_workspace_active" ON "follow_up_rules"("workspace_id", "is_active");
CREATE INDEX IF NOT EXISTS "ix_follow_up_rules_entity_active" ON "follow_up_rules"("entity_type", "is_active");

-- Follow-ups table
CREATE TABLE IF NOT EXISTS "follow_ups" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "follow_up_type" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "scheduled_at" timestamptz NOT NULL,
  "snoozed_until" timestamptz,
  "completed_at" timestamptz,
  "status" text NOT NULL DEFAULT 'pending',
  "assigned_to" text REFERENCES "user"("id"),
  "created_by" text NOT NULL REFERENCES "user"("id"),
  "priority" text NOT NULL DEFAULT 'medium',
  "is_automated" boolean DEFAULT false,
  "rule_id" text REFERENCES "follow_up_rules"("id"),
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "chk_follow_ups_entity_type" CHECK (entity_type IN ('prospect', 'proposal', 'contract', 'invoice', 'client')),
  CONSTRAINT "chk_follow_ups_type" CHECK (follow_up_type IN ('reminder', 'check_in', 'escalation', 'deadline', 'custom')),
  CONSTRAINT "chk_follow_ups_status" CHECK (status IN ('pending', 'snoozed', 'completed', 'cancelled', 'auto_resolved')),
  CONSTRAINT "chk_follow_ups_priority" CHECK (priority IN ('low', 'medium', 'high', 'critical'))
);

CREATE INDEX IF NOT EXISTS "ix_follow_ups_workspace_status" ON "follow_ups"("workspace_id", "status");
CREATE INDEX IF NOT EXISTS "ix_follow_ups_scheduled_pending" ON "follow_ups"("workspace_id", "scheduled_at");
CREATE INDEX IF NOT EXISTS "ix_follow_ups_entity" ON "follow_ups"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "ix_follow_ups_assigned_status" ON "follow_ups"("assigned_to", "status");

-- Workflow templates table
CREATE TABLE IF NOT EXISTS "workflow_templates" (
  "id" text PRIMARY KEY,
  "workspace_id" text REFERENCES "organization"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "entity_type" text NOT NULL,
  "trigger_event" text NOT NULL,
  "max_touches_per_week" integer NOT NULL DEFAULT 3,
  "cooldown_hours" integer NOT NULL DEFAULT 48,
  "skip_on_response" boolean NOT NULL DEFAULT true,
  "pause_on_negative_signal" boolean NOT NULL DEFAULT true,
  "steps" jsonb NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "is_system" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "chk_workflow_templates_entity_type" CHECK (entity_type IN ('prospect', 'proposal', 'contract', 'invoice', 'client'))
);

CREATE INDEX IF NOT EXISTS "ix_workflow_templates_workspace_active" ON "workflow_templates"("workspace_id", "is_active");
CREATE INDEX IF NOT EXISTS "ix_workflow_templates_trigger" ON "workflow_templates"("entity_type", "trigger_event", "is_active");

-- Workflow instances table
CREATE TABLE IF NOT EXISTS "workflow_instances" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "template_id" text NOT NULL REFERENCES "workflow_templates"("id"),
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "current_step" integer NOT NULL DEFAULT 0,
  "snoozed_until" timestamptz,
  "snooze_reason" text,
  "touches_this_week" integer DEFAULT 0,
  "last_touch_at" timestamptz,
  "last_response_at" timestamptz,
  "completed_at" timestamptz,
  "outcome_reason" text,
  "context" jsonb DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "chk_workflow_instances_entity_type" CHECK (entity_type IN ('prospect', 'proposal', 'contract', 'invoice', 'client')),
  CONSTRAINT "chk_workflow_instances_status" CHECK (status IN ('pending', 'active', 'paused', 'snoozed', 'completed', 'cancelled', 'won', 'lost'))
);

CREATE INDEX IF NOT EXISTS "ix_workflow_instances_workspace_status" ON "workflow_instances"("workspace_id", "status");
CREATE INDEX IF NOT EXISTS "ix_workflow_instances_entity" ON "workflow_instances"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "ix_workflow_instances_snoozed" ON "workflow_instances"("snoozed_until");
CREATE INDEX IF NOT EXISTS "ix_workflow_instances_active" ON "workflow_instances"("workspace_id");

-- Workflow events table
CREATE TABLE IF NOT EXISTS "workflow_events" (
  "id" text PRIMARY KEY,
  "instance_id" text NOT NULL REFERENCES "workflow_instances"("id") ON DELETE CASCADE,
  "event_type" text NOT NULL,
  "step_index" integer,
  "action_taken" text,
  "result" jsonb,
  "error_message" text,
  "triggered_by" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "chk_workflow_events_event_type" CHECK (event_type IN ('started', 'step_executed', 'step_skipped', 'paused', 'resumed', 'snoozed', 'unsnoozed', 'response_detected', 'completed', 'cancelled', 'error'))
);

CREATE INDEX IF NOT EXISTS "ix_workflow_events_instance_created" ON "workflow_events"("instance_id", "created_at");

-- Deal outcomes table
CREATE TABLE IF NOT EXISTS "deal_outcomes" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "outcome" text NOT NULL,
  "loss_reason" text,
  "loss_reason_detail" text,
  "competitor_name" text,
  "deal_value_cents" integer,
  "currency" text NOT NULL DEFAULT 'EUR',
  "first_contact_at" timestamptz,
  "proposal_sent_at" timestamptz,
  "outcome_at" timestamptz NOT NULL DEFAULT now(),
  "cycle_days" integer,
  "owner_id" text REFERENCES "user"("id"),
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "chk_deal_outcomes_entity_type" CHECK (entity_type IN ('prospect', 'proposal')),
  CONSTRAINT "chk_deal_outcomes_outcome" CHECK (outcome IN ('won', 'lost')),
  CONSTRAINT "chk_deal_outcomes_loss_reason" CHECK (loss_reason IS NULL OR loss_reason IN (
    'too_expensive', 'budget_cut', 'competitor_cheaper',
    'bad_timing', 'project_delayed', 'internal_changes',
    'wrong_fit', 'scope_mismatch', 'different_direction',
    'chose_competitor', 'went_internal', 'found_alternative',
    'unresponsive', 'ghosted', 'decision_maker_left',
    'unknown', 'other'
  ))
);

CREATE INDEX IF NOT EXISTS "ix_deal_outcomes_workspace_outcome" ON "deal_outcomes"("workspace_id", "outcome");
CREATE INDEX IF NOT EXISTS "ix_deal_outcomes_workspace_date" ON "deal_outcomes"("workspace_id", "outcome_at");
CREATE INDEX IF NOT EXISTS "ix_deal_outcomes_workspace_reason" ON "deal_outcomes"("workspace_id", "loss_reason");

-- Pipeline metrics table
CREATE TABLE IF NOT EXISTS "pipeline_metrics" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "prospects_new" integer NOT NULL DEFAULT 0,
  "prospects_analyzing" integer NOT NULL DEFAULT 0,
  "prospects_scored" integer NOT NULL DEFAULT 0,
  "prospects_qualified" integer NOT NULL DEFAULT 0,
  "prospects_contacted" integer NOT NULL DEFAULT 0,
  "prospects_negotiating" integer NOT NULL DEFAULT 0,
  "prospects_converted_30d" integer NOT NULL DEFAULT 0,
  "prospects_archived_30d" integer NOT NULL DEFAULT 0,
  "proposals_draft" integer NOT NULL DEFAULT 0,
  "proposals_sent" integer NOT NULL DEFAULT 0,
  "proposals_viewed" integer NOT NULL DEFAULT 0,
  "proposals_accepted" integer NOT NULL DEFAULT 0,
  "proposals_declined_30d" integer NOT NULL DEFAULT 0,
  "proposals_expired_30d" integer NOT NULL DEFAULT 0,
  "contracts_draft" integer NOT NULL DEFAULT 0,
  "contracts_sent" integer NOT NULL DEFAULT 0,
  "contracts_pending_signature" integer NOT NULL DEFAULT 0,
  "contracts_signed" integer NOT NULL DEFAULT 0,
  "contracts_executed" integer NOT NULL DEFAULT 0,
  "contracts_expiring_7d" integer NOT NULL DEFAULT 0,
  "invoices_draft" integer NOT NULL DEFAULT 0,
  "invoices_sent" integer NOT NULL DEFAULT 0,
  "invoices_paid_30d" integer NOT NULL DEFAULT 0,
  "invoices_overdue" integer NOT NULL DEFAULT 0,
  "pipeline_value_draft_cents" integer NOT NULL DEFAULT 0,
  "pipeline_value_sent_cents" integer NOT NULL DEFAULT 0,
  "pipeline_value_signed_cents" integer NOT NULL DEFAULT 0,
  "revenue_this_month_cents" integer NOT NULL DEFAULT 0,
  "revenue_last_month_cents" integer NOT NULL DEFAULT 0,
  "outstanding_cents" integer NOT NULL DEFAULT 0,
  "overdue_amount_cents" integer NOT NULL DEFAULT 0,
  "win_rate_pct" integer NOT NULL DEFAULT 0,
  "prospect_to_qualified_pct" integer NOT NULL DEFAULT 0,
  "qualified_to_proposal_pct" integer NOT NULL DEFAULT 0,
  "proposal_to_signed_pct" integer NOT NULL DEFAULT 0,
  "avg_cycle_days" integer NOT NULL DEFAULT 0,
  "avg_collection_days" integer NOT NULL DEFAULT 0,
  "currency" text NOT NULL DEFAULT 'EUR',
  "computed_at" timestamptz NOT NULL DEFAULT now(),
  "computation_duration_ms" integer,
  CONSTRAINT "uq_pipeline_metrics_workspace" UNIQUE("workspace_id")
);

CREATE INDEX IF NOT EXISTS "ix_pipeline_metrics_workspace" ON "pipeline_metrics"("workspace_id");

-- Smart alerts table
CREATE TABLE IF NOT EXISTS "smart_alerts" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "alert_type" text NOT NULL,
  "severity" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "entity_type" text,
  "entity_id" text,
  "metric_current" numeric,
  "metric_previous" numeric,
  "metric_unit" text,
  "suggested_action" text,
  "action_url" text,
  "is_dismissed" boolean NOT NULL DEFAULT false,
  "dismissed_by" text REFERENCES "user"("id"),
  "dismissed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz,
  "resolved_at" timestamptz,
  CONSTRAINT "chk_smart_alerts_severity" CHECK (severity IN ('critical', 'high', 'medium', 'low'))
);

CREATE INDEX IF NOT EXISTS "ix_smart_alerts_workspace_dismissed" ON "smart_alerts"("workspace_id", "is_dismissed");
CREATE INDEX IF NOT EXISTS "ix_smart_alerts_active" ON "smart_alerts"("workspace_id");
CREATE INDEX IF NOT EXISTS "ix_smart_alerts_type" ON "smart_alerts"("workspace_id", "alert_type");

-- Command Center dashboard views table (cc_ prefix to distinguish from Phase 21 dashboard_views)
CREATE TABLE IF NOT EXISTS "cc_dashboard_views" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "user_id" text REFERENCES "user"("id"),
  "name" text NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "filters" jsonb NOT NULL DEFAULT '{}',
  "layout" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ix_cc_dashboard_views_workspace" ON "cc_dashboard_views"("workspace_id");
CREATE INDEX IF NOT EXISTS "ix_cc_dashboard_views_user" ON "cc_dashboard_views"("user_id");

-- Notification preferences table
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "workspace_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "email_enabled" boolean NOT NULL DEFAULT true,
  "in_app_enabled" boolean NOT NULL DEFAULT true,
  "slack_enabled" boolean NOT NULL DEFAULT false,
  "slack_channel" text,
  "notify_overdue_invoice" boolean NOT NULL DEFAULT true,
  "notify_contract_expiring" boolean NOT NULL DEFAULT true,
  "notify_proposal_viewed" boolean NOT NULL DEFAULT true,
  "notify_contract_signed" boolean NOT NULL DEFAULT true,
  "notify_payment_received" boolean NOT NULL DEFAULT true,
  "notify_smart_alerts" boolean NOT NULL DEFAULT true,
  "notify_follow_up_due" boolean NOT NULL DEFAULT true,
  "daily_digest_enabled" boolean NOT NULL DEFAULT true,
  "daily_digest_hour" integer NOT NULL DEFAULT 9,
  "quiet_hours_start" integer,
  "quiet_hours_end" integer,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "uq_notification_preferences_user_workspace" UNIQUE("user_id", "workspace_id")
);

CREATE INDEX IF NOT EXISTS "ix_notification_preferences_user" ON "notification_preferences"("user_id");
CREATE INDEX IF NOT EXISTS "ix_notification_preferences_workspace" ON "notification_preferences"("workspace_id");

COMMIT;
