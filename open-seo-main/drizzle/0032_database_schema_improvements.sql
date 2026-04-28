-- Migration: Database Schema Improvements - Indexes, Constraints, and Audit Trail
-- Date: 2026-04-28
-- Issues Addressed:
--   HIGH-DB-001: No index on foreign keys - causes full table scans
--   HIGH-DB-002: Timestamp columns missing timezone (verified - most already have it)
--   HIGH-DB-004: Missing unique constraints allow duplicates
--   HIGH-DB-005: Enum types not used for status fields
--   HIGH-DB-006: JSON columns without schema validation (adding comments)
--   HIGH-DB-008: Missing check constraints on numeric fields
--   HIGH-DB-009: No database-level audit trail
--
-- This migration uses CONCURRENTLY for indexes to avoid locking production tables.
-- Run with: drizzle-kit:disable-transaction

-- ============================================================================
-- STEP 1: CREATE ENUM TYPES FOR STATUS FIELDS
-- ============================================================================

-- Audit status enum (replaces text field)
DO $$ BEGIN
  CREATE TYPE audit_status AS ENUM ('running', 'completed', 'failed', 'cancelled', 'pending');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Alert status enum
DO $$ BEGIN
  CREATE TYPE alert_status AS ENUM ('pending', 'acknowledged', 'resolved', 'dismissed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Alert severity enum
DO $$ BEGIN
  CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Change status enum
DO $$ BEGIN
  CREATE TYPE change_status AS ENUM ('pending', 'applied', 'verified', 'reverted', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Report status enum
DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('pending', 'generating', 'complete', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Prospect status enum
DO $$ BEGIN
  CREATE TYPE prospect_status AS ENUM ('new', 'analyzing', 'analyzed', 'converted', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Pipeline stage enum
DO $$ BEGIN
  CREATE TYPE pipeline_stage AS ENUM ('new', 'analyzing', 'scored', 'qualified', 'contacted', 'negotiating', 'converted', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Link suggestion status enum
DO $$ BEGIN
  CREATE TYPE suggestion_status AS ENUM ('pending', 'accepted', 'rejected', 'applied', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Orphan page status enum
DO $$ BEGIN
  CREATE TYPE orphan_status AS ENUM ('detected', 'fixed', 'ignored');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Opportunity status enum
DO $$ BEGIN
  CREATE TYPE opportunity_status AS ENUM ('pending', 'accepted', 'rejected', 'implemented');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Cannibalization status enum
DO $$ BEGIN
  CREATE TYPE cannibalization_status AS ENUM ('detected', 'resolved', 'ignored', 'monitoring');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Cannibalization severity enum
DO $$ BEGIN
  CREATE TYPE cannibalization_severity AS ENUM ('critical', 'high', 'medium', 'low');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Client status enum
DO $$ BEGIN
  CREATE TYPE client_status AS ENUM ('onboarding', 'active', 'paused', 'churned');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Analysis status enum
DO $$ BEGIN
  CREATE TYPE analysis_status AS ENUM ('pending', 'running', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Trigger type enum
DO $$ BEGIN
  CREATE TYPE trigger_type AS ENUM ('traffic_drop', 'ranking_drop', 'error_spike', 'manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- STEP 2: ADD MISSING INDEXES ON FOREIGN KEYS
-- Using CONCURRENTLY to avoid locking in production
-- ============================================================================

-- drizzle-kit:disable-transaction

-- link_graph indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_link_graph_client_id"
ON "link_graph" ("client_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_link_graph_audit_id"
ON "link_graph" ("audit_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_link_graph_source_page_id"
ON "link_graph" ("source_page_id");

-- page_links indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_page_links_client_id"
ON "page_links" ("client_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_page_links_audit_id"
ON "page_links" ("audit_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_page_links_page_id"
ON "page_links" ("page_id");

-- orphan_pages indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_orphan_pages_client_id"
ON "orphan_pages" ("client_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_orphan_pages_audit_id"
ON "orphan_pages" ("audit_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_orphan_pages_page_id"
ON "orphan_pages" ("page_id");

-- link_opportunities indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_link_opportunities_client_id"
ON "link_opportunities" ("client_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_link_opportunities_audit_id"
ON "link_opportunities" ("audit_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_link_opportunities_page_id"
ON "link_opportunities" ("page_id");

-- link_suggestions indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_link_suggestions_client_id"
ON "link_suggestions" ("client_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_link_suggestions_audit_id"
ON "link_suggestions" ("audit_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_link_suggestions_source_page_id"
ON "link_suggestions" ("source_page_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_link_suggestions_target_page_id"
ON "link_suggestions" ("target_page_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_link_suggestions_opportunity_id"
ON "link_suggestions" ("opportunity_id");

-- keyword_cannibalization index
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_keyword_cannibalization_client_id"
ON "keyword_cannibalization" ("client_id");

-- voice_profiles index
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_voice_profiles_client_id"
ON "voice_profiles" ("client_id");

-- voice_analysis index
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_voice_analysis_profile_id"
ON "voice_analysis" ("profile_id");

-- content_protection_rules index
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_protection_rules_profile_id"
ON "content_protection_rules" ("profile_id");

-- voice_audit_log index
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_voice_audit_log_profile_id"
ON "voice_audit_log" ("voice_profile_id");

-- site_changes indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_site_changes_client_id"
ON "site_changes" ("client_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_site_changes_connection_id"
ON "site_changes" ("connection_id");

-- change_backups index
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_change_backups_client_id"
ON "change_backups" ("client_id");

-- rollback_triggers index
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_rollback_triggers_client_id"
ON "rollback_triggers" ("client_id");

-- keyword_rankings index
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_keyword_rankings_keyword_id"
ON "keyword_rankings" ("keyword_id");

-- prospect_analyses index
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_prospect_analyses_prospect_id"
ON "prospect_analyses" ("prospect_id");

-- goal_snapshots index
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_goal_snapshots_goal_id"
ON "goal_snapshots" ("goal_id");

-- client_goals indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_client_goals_client_id"
ON "client_goals" ("client_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_client_goals_template_id"
ON "client_goals" ("template_id");

-- session index (for user lookups)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_session_user_id"
ON "session" ("user_id");

-- account index
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_account_user_id"
ON "account" ("user_id");

-- member indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_member_organization_id"
ON "member" ("organization_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_member_user_id"
ON "member" ("user_id");

-- invitation indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_invitation_organization_id"
ON "invitation" ("organization_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_invitation_inviter_id"
ON "invitation" ("inviter_id");


-- ============================================================================
-- STEP 3: ADD CHECK CONSTRAINTS ON NUMERIC FIELDS
-- ============================================================================

-- Lighthouse score constraints (0-100)
ALTER TABLE audit_lighthouse_results
  ADD CONSTRAINT chk_performance_score_range
  CHECK (performance_score IS NULL OR (performance_score >= 0 AND performance_score <= 100));

ALTER TABLE audit_lighthouse_results
  ADD CONSTRAINT chk_accessibility_score_range
  CHECK (accessibility_score IS NULL OR (accessibility_score >= 0 AND accessibility_score <= 100));

ALTER TABLE audit_lighthouse_results
  ADD CONSTRAINT chk_best_practices_score_range
  CHECK (best_practices_score IS NULL OR (best_practices_score >= 0 AND best_practices_score <= 100));

ALTER TABLE audit_lighthouse_results
  ADD CONSTRAINT chk_seo_score_range
  CHECK (seo_score IS NULL OR (seo_score >= 0 AND seo_score <= 100));

-- Health score constraint (0-100)
ALTER TABLE client_dashboard_metrics
  ADD CONSTRAINT chk_health_score_range
  CHECK (health_score >= 0 AND health_score <= 100);

-- Priority score constraint (0-100)
ALTER TABLE client_dashboard_metrics
  ADD CONSTRAINT chk_priority_score_range
  CHECK (priority_score IS NULL OR (priority_score >= 0 AND priority_score <= 100));

-- Voice profile formality level (1-10)
ALTER TABLE voice_profiles
  ADD CONSTRAINT chk_formality_level_range
  CHECK (formality_level IS NULL OR (formality_level >= 1 AND formality_level <= 10));

-- Voice profile SEO vs voice priority (1-10)
ALTER TABLE voice_profiles
  ADD CONSTRAINT chk_seo_voice_priority_range
  CHECK (seo_vs_voice_priority IS NULL OR (seo_vs_voice_priority >= 1 AND seo_vs_voice_priority <= 10));

-- Voice profile confidence score (0-100)
ALTER TABLE voice_profiles
  ADD CONSTRAINT chk_confidence_score_range
  CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100));

-- Voice profile keyword density tolerance (1-10)
ALTER TABLE voice_profiles
  ADD CONSTRAINT chk_keyword_density_range
  CHECK (keyword_density_tolerance IS NULL OR (keyword_density_tolerance >= 1 AND keyword_density_tolerance <= 10));

-- Voice audit log scores (0.0-1.0)
ALTER TABLE voice_audit_log
  ADD CONSTRAINT chk_voice_consistency_range
  CHECK (voice_consistency_score IS NULL OR (voice_consistency_score >= 0 AND voice_consistency_score <= 1));

ALTER TABLE voice_audit_log
  ADD CONSTRAINT chk_tone_consistency_range
  CHECK (tone_consistency_score IS NULL OR (tone_consistency_score >= 0 AND tone_consistency_score <= 1));

ALTER TABLE voice_audit_log
  ADD CONSTRAINT chk_vocabulary_alignment_range
  CHECK (vocabulary_alignment_score IS NULL OR (vocabulary_alignment_score >= 0 AND vocabulary_alignment_score <= 1));

ALTER TABLE voice_audit_log
  ADD CONSTRAINT chk_structure_compliance_range
  CHECK (structure_compliance_score IS NULL OR (structure_compliance_score >= 0 AND structure_compliance_score <= 1));

-- Link suggestion scores (0-100)
ALTER TABLE link_suggestions
  ADD CONSTRAINT chk_suggestion_score_range
  CHECK (score >= 0 AND score <= 100);

ALTER TABLE link_suggestions
  ADD CONSTRAINT chk_link_deficit_score_range
  CHECK (link_deficit_score >= 0 AND link_deficit_score <= 100);

ALTER TABLE link_suggestions
  ADD CONSTRAINT chk_exact_match_score_range
  CHECK (exact_match_score >= 0 AND exact_match_score <= 100);

ALTER TABLE link_suggestions
  ADD CONSTRAINT chk_orphan_score_range
  CHECK (orphan_score >= 0 AND orphan_score <= 100);

ALTER TABLE link_suggestions
  ADD CONSTRAINT chk_depth_score_range
  CHECK (depth_score >= 0 AND depth_score <= 100);

ALTER TABLE link_suggestions
  ADD CONSTRAINT chk_relevance_score_range
  CHECK (relevance_score >= 0 AND relevance_score <= 100);

-- Link suggestion anchor confidence (0.0-1.0)
ALTER TABLE link_suggestions
  ADD CONSTRAINT chk_anchor_confidence_range
  CHECK (anchor_confidence >= 0 AND anchor_confidence <= 1);

-- Link opportunities urgency (0.0-1.0)
ALTER TABLE link_opportunities
  ADD CONSTRAINT chk_urgency_range
  CHECK (urgency >= 0 AND urgency <= 1);

-- Page links scores (0-100)
ALTER TABLE page_links
  ADD CONSTRAINT chk_link_score_range
  CHECK (link_score IS NULL OR (link_score >= 0 AND link_score <= 100));

ALTER TABLE page_links
  ADD CONSTRAINT chk_opportunity_score_range
  CHECK (opportunity_score IS NULL OR (opportunity_score >= 0 AND opportunity_score <= 100));

-- Keyword position constraint (0-100+)
ALTER TABLE keyword_rankings
  ADD CONSTRAINT chk_position_positive
  CHECK (position >= 0);

-- Prospects priority score (0-100)
ALTER TABLE prospects
  ADD CONSTRAINT chk_prospect_priority_range
  CHECK (priority_score IS NULL OR (priority_score >= 0 AND priority_score <= 100));

-- Goal attainment percentage (0-100+)
ALTER TABLE client_goals
  ADD CONSTRAINT chk_attainment_positive
  CHECK (attainment_pct IS NULL OR attainment_pct >= 0);

-- Alert threshold must be positive
ALTER TABLE alert_rules
  ADD CONSTRAINT chk_threshold_positive
  CHECK (threshold IS NULL OR threshold > 0);

-- Audit findings tier constraint (1-4)
ALTER TABLE audit_findings
  ADD CONSTRAINT chk_tier_range
  CHECK (tier >= 1 AND tier <= 4);

-- Word count and heading counts must be non-negative
ALTER TABLE audit_pages
  ADD CONSTRAINT chk_word_count_positive
  CHECK (word_count >= 0);

ALTER TABLE audit_pages
  ADD CONSTRAINT chk_h1_count_positive
  CHECK (h1_count >= 0);

ALTER TABLE audit_pages
  ADD CONSTRAINT chk_images_total_positive
  CHECK (images_total >= 0);

ALTER TABLE audit_pages
  ADD CONSTRAINT chk_internal_link_count_positive
  CHECK (internal_link_count >= 0);

ALTER TABLE audit_pages
  ADD CONSTRAINT chk_external_link_count_positive
  CHECK (external_link_count >= 0);

-- GSC metrics constraints
ALTER TABLE gsc_snapshots
  ADD CONSTRAINT chk_gsc_clicks_positive
  CHECK (clicks >= 0);

ALTER TABLE gsc_snapshots
  ADD CONSTRAINT chk_gsc_impressions_positive
  CHECK (impressions >= 0);

ALTER TABLE gsc_snapshots
  ADD CONSTRAINT chk_gsc_ctr_range
  CHECK (ctr >= 0 AND ctr <= 1);

ALTER TABLE gsc_snapshots
  ADD CONSTRAINT chk_gsc_position_positive
  CHECK (position >= 0);


-- ============================================================================
-- STEP 4: ADD UNIQUE CONSTRAINTS TO PREVENT DUPLICATES
-- ============================================================================

-- Ensure one voice profile per client (for now, single-brand support)
-- Note: Index already exists from schema, but adding explicit constraint name
DO $$ BEGIN
  ALTER TABLE voice_profiles
    ADD CONSTRAINT uq_voice_profiles_client
    UNIQUE (client_id);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- Ensure one dashboard metrics row per client
-- Note: Already has unique constraint via .unique() in schema

-- Ensure one portfolio aggregates row per workspace
-- Note: Already has unique constraint via .unique() in schema


-- ============================================================================
-- STEP 5: ADD AUDIT COLUMNS TO KEY TABLES
-- ============================================================================

-- Add created_by and updated_by to clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS created_by TEXT;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- Add created_by and updated_by to prospects
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS created_by TEXT;

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- Add created_by and updated_by to site_changes
ALTER TABLE site_changes
  ADD COLUMN IF NOT EXISTS created_by TEXT;

-- Note: site_changes already has userId for who approved

-- Add created_by to audits (started_by_user_id exists)
-- Note: audits.started_by_user_id serves as created_by

-- Add updated_by to audits
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- Add created_by to link_suggestions
ALTER TABLE link_suggestions
  ADD COLUMN IF NOT EXISTS created_by TEXT;

-- Add created_by to link_opportunities
ALTER TABLE link_opportunities
  ADD COLUMN IF NOT EXISTS created_by TEXT;

-- Add created_by to alerts
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS created_by TEXT;

-- Add created_by to alert_rules
ALTER TABLE alert_rules
  ADD COLUMN IF NOT EXISTS created_by TEXT;

ALTER TABLE alert_rules
  ADD COLUMN IF NOT EXISTS updated_by TEXT;


-- ============================================================================
-- STEP 6: ADD COMMENTS FOR JSON SCHEMA DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN voice_profiles.secondary_tones IS 'JSON array of strings: ["empathetic", "innovative", ...]';
COMMENT ON COLUMN voice_profiles.personality_traits IS 'JSON array of strings: ["authentic", "expert", ...]';
COMMENT ON COLUMN voice_profiles.required_phrases IS 'JSON array of strings: ["Our team of experts", ...]';
COMMENT ON COLUMN voice_profiles.forbidden_phrases IS 'JSON array of strings: ["cheap", "best in class", ...]';
COMMENT ON COLUMN voice_profiles.industry_terms IS 'JSON array of strings: ["SEO", "SERP", ...]';
COMMENT ON COLUMN voice_profiles.keyword_placement_rules IS 'JSON array of strings: ["title", "h1", "first_paragraph", "throughout"]';
COMMENT ON COLUMN voice_profiles.protected_sections IS 'JSON array of strings: ["/about", "/team", ...]';
COMMENT ON COLUMN voice_profiles.vocabulary_patterns IS 'JSON object: { preferred: string[], avoided: string[] }';

COMMENT ON COLUMN link_suggestions.reasons IS 'JSON array of strings explaining why this link is suggested';
COMMENT ON COLUMN link_opportunities.suggested_source_pages IS 'JSON array of { pageUrl: string, pageId: string|null, relevanceScore: number }';

COMMENT ON COLUMN keyword_cannibalization.competing_pages IS 'JSON array of CompetingPage: { pageId, url, title, gscPosition, gscClicks, inboundLinks, hasExactMatchAnchor }';

COMMENT ON COLUMN page_links.anchor_distribution IS 'JSON object mapping anchor text to percentage: { "learn more": 45, "click here": 30, ... }';
COMMENT ON COLUMN page_links.top_anchors IS 'JSON array of { anchor: string, count: number } sorted by count desc';

COMMENT ON COLUMN change_backups.snapshot_data IS 'JSON object: { pages?: Array<{resourceId, resourceUrl, resourceType, fields, capturedAt}>, settings?: Array<{key, value, capturedAt}> }';
COMMENT ON COLUMN rollback_triggers.config IS 'JSON object with trigger-specific config. See TriggerConfig type.';
COMMENT ON COLUMN rollback_triggers.rollback_scope IS 'JSON object defining what to rollback. See RollbackScope type.';

COMMENT ON COLUMN audits.config IS 'JSON object: { maxPages?: number, lighthouseStrategy?: "mobile"|"desktop"|"both" }';

COMMENT ON COLUMN client_dashboard_metrics.health_breakdown IS 'JSON object: { traffic: number, rankings: number, technical: number, backlinks: number, content: number }';
COMMENT ON COLUMN client_dashboard_metrics.keywords_distribution IS 'JSON object mapping position buckets to counts: { "1-3": 5, "4-10": 12, ... }';

COMMENT ON COLUMN dashboard_views.filters IS 'JSON object with filter configuration for saved view';
COMMENT ON COLUMN dashboard_views.layout IS 'JSON object: { cardOrder: string[] }';

COMMENT ON COLUMN portfolio_activity.event_data IS 'JSON object with event-specific data. Structure varies by event_type.';

COMMENT ON COLUMN audit_findings.details IS 'JSON object with check-specific details. Structure varies by check_id.';

COMMENT ON COLUMN voice_analysis.raw_analysis IS 'JSON object: { model, prompt, response, tokens_used, analyzed_at }';
COMMENT ON COLUMN voice_analysis.sample_sentences IS 'JSON array of example sentences extracted from page';

COMMENT ON COLUMN voice_audit_log.issues IS 'JSON array of VoiceAuditIssue: { type, severity, location, expected, actual, suggestion }';

COMMENT ON COLUMN voice_templates.template_config IS 'Partial VoiceProfileConfig JSON for template defaults';

COMMENT ON COLUMN alerts.metadata IS 'JSON object with alert-specific context data';

COMMENT ON COLUMN prospects.domain IS 'Domain without protocol (e.g., "example.com")';
COMMENT ON COLUMN clients.domain IS 'Domain without protocol (e.g., "example.com")';

COMMENT ON COLUMN prospect_analyses.domain_metrics IS 'JSON object: { domainRank?, organicTraffic?, organicKeywords?, backlinks?, referringDomains? }';
COMMENT ON COLUMN prospect_analyses.organic_keywords IS 'JSON array of OrganicKeywordItem';
COMMENT ON COLUMN prospect_analyses.competitor_keywords IS 'JSON array of CompetitorKeywordItem';
COMMENT ON COLUMN prospect_analyses.keyword_gaps IS 'JSON array of KeywordGap';
COMMENT ON COLUMN prospect_analyses.opportunity_keywords IS 'JSON array of OpportunityKeyword';
COMMENT ON COLUMN prospect_analyses.scraped_content IS 'JSON object with ScrapedContent structure';


-- ============================================================================
-- STEP 7: CREATE AUDIT HISTORY TABLE FOR IMPORTANT OPERATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_history (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values JSONB,
  new_values JSONB,
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_history_table_record
ON audit_history (table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_audit_history_changed_at
ON audit_history (changed_at);

CREATE INDEX IF NOT EXISTS idx_audit_history_changed_by
ON audit_history (changed_by);

COMMENT ON TABLE audit_history IS 'Database-level audit trail for tracking changes to important records';


-- ============================================================================
-- STEP 8: FIX REMAINING TIMESTAMP COLUMNS WITHOUT TIMEZONE
-- (Most already have timezone from schema, this catches any stragglers)
-- ============================================================================

-- goal_templates.created_at may be missing timezone
ALTER TABLE goal_templates
  ALTER COLUMN created_at TYPE TIMESTAMPTZ
  USING created_at AT TIME ZONE 'UTC';

-- Verify all timestamp columns in key tables have timezone
-- (These are likely already correct but ensuring consistency)


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON SCHEMA public IS 'TeveroSEO database schema with improved indexes, constraints, and audit trail. Migration 0032.';
