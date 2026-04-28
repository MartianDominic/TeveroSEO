-- 0032_indexes_batch3.sql - Index creation batch 3 of 3
-- Date: 2026-04-28
--
-- Run this after batch2 completes successfully.
--
-- drizzle-kit:disable-transaction

-- Voice system indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_protection_rules_profile_id"
ON "content_protection_rules" ("profile_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_voice_audit_log_profile_id"
ON "voice_audit_log" ("voice_profile_id");

-- Change tracking indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_site_changes_client_id"
ON "site_changes" ("client_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_site_changes_connection_id"
ON "site_changes" ("connection_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_change_backups_client_id"
ON "change_backups" ("client_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_rollback_triggers_client_id"
ON "rollback_triggers" ("client_id");

-- Other FK indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_keyword_rankings_keyword_id"
ON "keyword_rankings" ("keyword_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_prospect_analyses_prospect_id"
ON "prospect_analyses" ("prospect_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_goal_snapshots_goal_id"
ON "goal_snapshots" ("goal_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_client_goals_client_id"
ON "client_goals" ("client_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_client_goals_template_id"
ON "client_goals" ("template_id");

-- Auth indexes (if tables exist)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_session_user_id"
ON "session" ("user_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_account_user_id"
ON "account" ("user_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_member_organization_id"
ON "member" ("organization_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_member_user_id"
ON "member" ("user_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_invitation_organization_id"
ON "invitation" ("organization_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_invitation_inviter_id"
ON "invitation" ("inviter_id");

-- Batch 3 complete: 17 indexes created
-- Total: 37 indexes across all batches
