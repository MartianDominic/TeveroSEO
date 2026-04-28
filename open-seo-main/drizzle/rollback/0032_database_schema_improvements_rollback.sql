-- Rollback for migration 0032_database_schema_improvements.sql
-- Date: 2026-04-28
--
-- This rollback removes indexes, check constraints, enum types, and audit columns
-- added in the schema improvements migration.

BEGIN;

-- ============================================================================
-- STEP 1: Drop audit_history table
-- ============================================================================

DROP TABLE IF EXISTS audit_history;

-- ============================================================================
-- STEP 2: Remove audit columns from tables
-- ============================================================================

ALTER TABLE clients DROP COLUMN IF EXISTS created_by;
ALTER TABLE clients DROP COLUMN IF EXISTS updated_by;

ALTER TABLE prospects DROP COLUMN IF EXISTS created_by;
ALTER TABLE prospects DROP COLUMN IF EXISTS updated_by;

ALTER TABLE site_changes DROP COLUMN IF EXISTS created_by;

ALTER TABLE audits DROP COLUMN IF EXISTS updated_by;

ALTER TABLE link_suggestions DROP COLUMN IF EXISTS created_by;

ALTER TABLE link_opportunities DROP COLUMN IF EXISTS created_by;

ALTER TABLE alerts DROP COLUMN IF EXISTS created_by;

ALTER TABLE alert_rules DROP COLUMN IF EXISTS created_by;
ALTER TABLE alert_rules DROP COLUMN IF EXISTS updated_by;

-- ============================================================================
-- STEP 3: Remove unique constraints
-- ============================================================================

ALTER TABLE voice_profiles DROP CONSTRAINT IF EXISTS uq_voice_profiles_client;

-- ============================================================================
-- STEP 4: Remove check constraints
-- ============================================================================

-- Lighthouse scores
ALTER TABLE audit_lighthouse_results DROP CONSTRAINT IF EXISTS chk_performance_score_range;
ALTER TABLE audit_lighthouse_results DROP CONSTRAINT IF EXISTS chk_accessibility_score_range;
ALTER TABLE audit_lighthouse_results DROP CONSTRAINT IF EXISTS chk_best_practices_score_range;
ALTER TABLE audit_lighthouse_results DROP CONSTRAINT IF EXISTS chk_seo_score_range;

-- Dashboard metrics
ALTER TABLE client_dashboard_metrics DROP CONSTRAINT IF EXISTS chk_health_score_range;
ALTER TABLE client_dashboard_metrics DROP CONSTRAINT IF EXISTS chk_priority_score_range;

-- Voice profiles
ALTER TABLE voice_profiles DROP CONSTRAINT IF EXISTS chk_formality_level_range;
ALTER TABLE voice_profiles DROP CONSTRAINT IF EXISTS chk_seo_voice_priority_range;
ALTER TABLE voice_profiles DROP CONSTRAINT IF EXISTS chk_confidence_score_range;
ALTER TABLE voice_profiles DROP CONSTRAINT IF EXISTS chk_keyword_density_range;

-- Voice audit log
ALTER TABLE voice_audit_log DROP CONSTRAINT IF EXISTS chk_voice_consistency_range;
ALTER TABLE voice_audit_log DROP CONSTRAINT IF EXISTS chk_tone_consistency_range;
ALTER TABLE voice_audit_log DROP CONSTRAINT IF EXISTS chk_vocabulary_alignment_range;
ALTER TABLE voice_audit_log DROP CONSTRAINT IF EXISTS chk_structure_compliance_range;

-- Link suggestions
ALTER TABLE link_suggestions DROP CONSTRAINT IF EXISTS chk_suggestion_score_range;
ALTER TABLE link_suggestions DROP CONSTRAINT IF EXISTS chk_link_deficit_score_range;
ALTER TABLE link_suggestions DROP CONSTRAINT IF EXISTS chk_exact_match_score_range;
ALTER TABLE link_suggestions DROP CONSTRAINT IF EXISTS chk_orphan_score_range;
ALTER TABLE link_suggestions DROP CONSTRAINT IF EXISTS chk_depth_score_range;
ALTER TABLE link_suggestions DROP CONSTRAINT IF EXISTS chk_relevance_score_range;
ALTER TABLE link_suggestions DROP CONSTRAINT IF EXISTS chk_anchor_confidence_range;

-- Link opportunities
ALTER TABLE link_opportunities DROP CONSTRAINT IF EXISTS chk_urgency_range;

-- Page links
ALTER TABLE page_links DROP CONSTRAINT IF EXISTS chk_link_score_range;
ALTER TABLE page_links DROP CONSTRAINT IF EXISTS chk_opportunity_score_range;

-- Keywords
ALTER TABLE keyword_rankings DROP CONSTRAINT IF EXISTS chk_position_positive;

-- Prospects
ALTER TABLE prospects DROP CONSTRAINT IF EXISTS chk_prospect_priority_range;

-- Goals
ALTER TABLE client_goals DROP CONSTRAINT IF EXISTS chk_attainment_positive;

-- Alerts
ALTER TABLE alert_rules DROP CONSTRAINT IF EXISTS chk_threshold_positive;

-- Audit findings
ALTER TABLE audit_findings DROP CONSTRAINT IF EXISTS chk_tier_range;

-- Audit pages
ALTER TABLE audit_pages DROP CONSTRAINT IF EXISTS chk_word_count_positive;
ALTER TABLE audit_pages DROP CONSTRAINT IF EXISTS chk_h1_count_positive;
ALTER TABLE audit_pages DROP CONSTRAINT IF EXISTS chk_images_total_positive;
ALTER TABLE audit_pages DROP CONSTRAINT IF EXISTS chk_internal_link_count_positive;
ALTER TABLE audit_pages DROP CONSTRAINT IF EXISTS chk_external_link_count_positive;

-- GSC snapshots
ALTER TABLE gsc_snapshots DROP CONSTRAINT IF EXISTS chk_gsc_clicks_positive;
ALTER TABLE gsc_snapshots DROP CONSTRAINT IF EXISTS chk_gsc_impressions_positive;
ALTER TABLE gsc_snapshots DROP CONSTRAINT IF EXISTS chk_gsc_ctr_range;
ALTER TABLE gsc_snapshots DROP CONSTRAINT IF EXISTS chk_gsc_position_positive;

-- ============================================================================
-- STEP 5: Drop indexes (CONCURRENTLY to avoid locks)
-- ============================================================================

COMMIT;
-- Must be outside transaction for CONCURRENTLY

DROP INDEX CONCURRENTLY IF EXISTS "idx_link_graph_client_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_link_graph_audit_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_link_graph_source_page_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_page_links_client_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_page_links_audit_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_page_links_page_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_orphan_pages_client_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_orphan_pages_audit_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_orphan_pages_page_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_link_opportunities_client_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_link_opportunities_audit_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_link_opportunities_page_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_link_suggestions_client_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_link_suggestions_audit_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_link_suggestions_source_page_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_link_suggestions_target_page_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_link_suggestions_opportunity_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_keyword_cannibalization_client_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_voice_profiles_client_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_voice_analysis_profile_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_protection_rules_profile_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_voice_audit_log_profile_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_site_changes_client_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_site_changes_connection_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_change_backups_client_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_rollback_triggers_client_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_keyword_rankings_keyword_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_prospect_analyses_prospect_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_goal_snapshots_goal_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_client_goals_client_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_client_goals_template_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_session_user_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_account_user_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_member_organization_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_member_user_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_invitation_organization_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_invitation_inviter_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_audit_history_table_record";
DROP INDEX CONCURRENTLY IF EXISTS "idx_audit_history_changed_at";
DROP INDEX CONCURRENTLY IF EXISTS "idx_audit_history_changed_by";

BEGIN;

-- ============================================================================
-- STEP 6: Drop enum types (in reverse order of dependency)
-- ============================================================================

DROP TYPE IF EXISTS trigger_type;
DROP TYPE IF EXISTS analysis_status;
DROP TYPE IF EXISTS client_status;
DROP TYPE IF EXISTS cannibalization_severity;
DROP TYPE IF EXISTS cannibalization_status;
DROP TYPE IF EXISTS opportunity_status;
DROP TYPE IF EXISTS orphan_status;
DROP TYPE IF EXISTS suggestion_status;
DROP TYPE IF EXISTS pipeline_stage;
DROP TYPE IF EXISTS prospect_status;
DROP TYPE IF EXISTS report_status;
DROP TYPE IF EXISTS change_status;
DROP TYPE IF EXISTS alert_severity;
DROP TYPE IF EXISTS alert_status;
DROP TYPE IF EXISTS audit_status;

-- ============================================================================
-- STEP 7: Remove migration record
-- ============================================================================

DELETE FROM drizzle.__drizzle_migrations WHERE hash = '0032_database_schema_improvements';

COMMIT;
